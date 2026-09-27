import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Printer,
  Search,
  Calendar,
  Download,
  Loader2,
  Database,
  RefreshCw,
  Clock3,
  TrendingUp,
  Users,
  Receipt,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Re-use the logo and QR code from your invoices folder
import logo from '../invoices/three_leaves_logo.png';
import paynowQr from '../invoices/paynow_qr.jpg';

const CJK_FONT =
  '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

const DASHBOARD_NUMBER_FORMAT = new Intl.NumberFormat('en-SG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DASHBOARD_INTEGER_FORMAT = new Intl.NumberFormat('en-SG', {
  maximumFractionDigits: 0,
});

// Statement amounts must follow exactly the same 2-decimal value that the
// customer sees on each invoice. Never sum hidden 3+ decimal values.
const STATEMENT_MONEY_FORMAT = new Intl.NumberFormat('en-SG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const toDisplayedCents = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return 0;

  // Format first, then convert the already-rounded display value into integer
  // cents. This avoids binary floating-point accumulation and guarantees that
  // the statement total is the sum of the amounts the customer can see.
  const displayed = STATEMENT_MONEY_FORMAT.format(numericValue);
  const normalized = displayed.replace(/,/g, '');

  return Math.round(Number(normalized) * 100);
};

const formatStatementMoney = (value) =>
  STATEMENT_MONEY_FORMAT.format(Number(value) || 0);

const formatStatementCents = (cents) =>
  STATEMENT_MONEY_FORMAT.format((Number(cents) || 0) / 100);

const formatDashboardMoney = (value) =>
  `S$ ${DASHBOARD_NUMBER_FORMAT.format(Number(value) || 0)}`;

const formatDashboardInteger = (value) =>
  DASHBOARD_INTEGER_FORMAT.format(Number(value) || 0);

const getStatementMonthBounds = (yyyyMm) => {
  const [year, month] = String(yyyyMm).split('-').map(Number);
  const nextMonth = new Date(year, month, 1);

  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`,
  };
};

export function BillingModule({ sys: _sys }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [termFilter, setTermFilter] = useState('All');

  const [statementInvoices, setStatementInvoices] = useState([]);
  const [statementLoading, setStatementLoading] = useState(true);
  const [statementError, setStatementError] = useState(null);
  const [statementLoadedAt, setStatementLoadedAt] = useState(null);
  const [statementRefreshKey, setStatementRefreshKey] = useState(0);

  const [printTarget, setPrintTarget] = useState(null);
  const [isZipping, setIsZipping] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadStatementData = async () => {
      setStatementLoading(true);
      setStatementError(null);
      setStatementLoadedAt(null);

      try {
        const { startDate, endDate } = getStatementMonthBounds(selectedMonth);

        const { data, error } = await supabase.rpc(
          'billing_statement_rows',
          {
            p_start_date: startDate,
            p_end_date: endDate,
            p_payment_terms: termFilter || 'All',
            p_status: 'All',
          }
        );

        if (error) throw error;

        const rows = (Array.isArray(data) ? data : []).map((row) => ({
          id: row.invoice_id,
          number: row.invoice_number,
          date: row.invoice_date,
          customerId: row.customer_id,
          customer: row.customer_name,
          total: Number(row.total ?? 0),
          status: row.status || 'Paid',
          statementCustomer: {
            id: row.customer_id,
            name: row.customer_name,
            address: row.customer_address || '',
            payment_terms: row.payment_terms || '30_days',
          },
        }));

        if (!cancelled) {
          setStatementInvoices(rows);
          setStatementLoadedAt(new Date());
        }
      } catch (error) {
        console.error('Statement data load failed:', error);

        if (!cancelled) {
          setStatementInvoices([]);
          setStatementError(
            error?.message || 'Unable to load statement data.'
          );
        }
      } finally {
        if (!cancelled) {
          setStatementLoading(false);
        }
      }
    };

    loadStatementData();

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, termFilter, statementRefreshKey]);

  const dataIsSyncing = statementLoading || Boolean(statementError);
  const dataStatusLabel = statementError
    ? 'Sync issue'
    : statementLoading
      ? 'Loading'
      : 'Live';

  const dataStatusClass = statementError
    ? 'border-red-200 bg-red-50 text-red-700'
    : statementLoading
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  // ==========================================
  // FINANCIAL ANALYTICS & DATA ENGINE
  // ==========================================
  // IMPORTANT: this calculation is based ONLY on the authoritative monthly
  // dataset returned directly by Supabase. It no longer depends on the global
  // sys.invoices cache or on the Invoice module being opened first.
  const analytics = useMemo(() => {
    const dataMap = new Map();

    statementInvoices.forEach((inv) => {
      const customerId =
        inv.customerId || `unknown:${inv.customer || 'unknown'}`;

      if (!dataMap.has(customerId)) {
        dataMap.set(customerId, {
          customer: inv.statementCustomer || {
            id: inv.customerId,
            name: inv.customer || 'Unknown Customer',
            address: '',
            payment_terms: '30_days',
          },
          customerName: String(inv.customer || 'Unknown Customer'),
          invoices: [],
          totalBilledCents: 0,
          totalBilled: 0,
          monthStatus: 'Paid',
        });
      }

      const row = dataMap.get(customerId);
      const invStatus = String(inv.status || 'Paid').toLowerCase();
      const invoiceCents = toDisplayedCents(inv.total);

      row.invoices.push(inv);
      row.totalBilledCents += invoiceCents;
      row.totalBilled = row.totalBilledCents / 100;

      if (invStatus === 'unpaid') {
        row.monthStatus = 'Unpaid';
      }
    });

    const relevantCustomers = Array.from(dataMap.values()).filter(
      (row) => row.invoices.length > 0
    );

    let totalRevenueCents = 0;
    let totalInvoicesCount = 0;

    relevantCustomers.forEach((row) => {
      totalRevenueCents += row.totalBilledCents;
      totalInvoicesCount += row.invoices.length;
    });

    const totalRevenue = totalRevenueCents / 100;

    const activeCustomers = relevantCustomers.length;
    const aov =
      totalInvoicesCount > 0 ? totalRevenue / totalInvoicesCount : 0;

    const sortedByRevenue = [...relevantCustomers].sort(
      (a, b) => b.totalBilled - a.totalBilled
    );

    const topCustomer = sortedByRevenue[0] || null;

    let displayList = [...relevantCustomers].sort((a, b) =>
      a.customerName.localeCompare(b.customerName)
    );

    if (searchTerm) {
      const lowerSearch = String(searchTerm).toLowerCase();

      displayList = displayList.filter((row) =>
        row.customerName.toLowerCase().includes(lowerSearch)
      );
    }

    displayList.forEach((row) => {
      row.invoices.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);

        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }

        const numA = String(a.number || a.id);
        const numB = String(b.number || b.id);

        return numA.localeCompare(numB, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });
    });

    return {
      totalRevenue,
      activeCustomers,
      totalInvoicesCount,
      aov,
      topCustomer,
      displayList,
      allCustomerStats: relevantCustomers,
    };
  }, [statementInvoices, searchTerm]);

  const visibleAnalytics = statementLoading
    ? {
        totalRevenue: null,
        activeCustomers: null,
        totalInvoicesCount: null,
        aov: null,
        topCustomer: null,
        displayList: [],
        allCustomerStats: [],
      }
    : analytics;

  const handleStatusChange = async (customerId, newStatus) => {
    const customerInvoices = statementInvoices.filter(
      (inv) => inv.customerId === customerId
    );

    const invoiceIds = customerInvoices
      .map((inv) => inv.id)
      .filter(Boolean);

    if (invoiceIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .in('id', invoiceIds);

      if (error) throw error;

      setStatementInvoices((current) =>
        current.map((inv) =>
          invoiceIds.includes(inv.id)
            ? { ...inv, status: newStatus }
            : inv
        )
      );
    } catch (error) {
      console.error('Invoice status update failed:', error);
      alert(error?.message || 'Unable to update invoice status.');
    }
  };

  const handlePrint = (target) => {
    setPrintTarget(target);

    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 300);
  };

  const handleRefreshStatement = () => {
    setStatementRefreshKey((value) => value + 1);
  };

  const dataStatusTime = statementLoadedAt
    ? statementLoadedAt.toLocaleTimeString('en-SG', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  // ==========================================
  // ZIP ENGINE: SEPARATED RESPONSIBILITIES
  // ==========================================

  // 1. Readiness: Ensures DOM, Fonts, and Images are 100% settled
  const ensureReadiness = async (container) => {
    // Wait for React to finish mounting the specific customer
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Wait for strict font loading completion
    await document.fonts.ready;

    // Wait for all images inside the container to finish
    const images = container.querySelectorAll('img');

    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();

      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });

    await Promise.all(imagePromises);
  };

  // 2. PDF Generation
  const generatePDFFromWrapper = async (wrapperNode) => {
    const pages = wrapperNode.querySelectorAll('.a4-statement-page');
    const pdf = new jsPDF('p', 'mm', 'a4');

    for (let p = 0; p < pages.length; p += 1) {
      const pageNode = pages[p];

      const canvas = await html2canvas(pageNode, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdfWidth = 210;
      const pdfHeight = 297;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      if (p < pages.length - 1) {
        pdf.addPage();
      }
    }

    return pdf.output('blob');
  };

  // 3. ZIP Packaging
  const handleDownloadZip = async () => {
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const d = new Date(`${selectedMonth}-01`);
      const monthShort = d.toLocaleString('en-US', { month: 'short' });
      const yearShort = String(d.getFullYear()).slice(-2);

      const typeStr =
        termFilter === 'All'
          ? 'All'
          : termFilter === 'cod'
            ? 'COD'
            : '30Days';

      // SEQUENTIAL RENDER LOOP: Process one customer at a time
      for (const data of analytics.allCustomerStats) {
        setPrintTarget(data.customer?.id);

        // Give React a micro-tick to mount the node
        await new Promise((resolve) => setTimeout(resolve, 50));

        const wrapper = document.querySelector('.customer-print-wrapper');

        if (wrapper) {
          await ensureReadiness(wrapper);

          const pdfBlob = await generatePDFFromWrapper(wrapper);

          const customerNameSafe = data.customerName
            .replace(/[<>:"/\\|?*]/g, '')
            .trim();

          const fileName = `${customerNameSafe}_${monthShort}_${yearShort}.pdf`;

          zip.file(fileName, pdfBlob);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${typeStr}_Statements_${monthShort}_${yearShort}.zip`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating ZIP:', error);

      alert(
        'Failed to generate ZIP folder. Please check the console for details.'
      );
    } finally {
      setIsZipping(false);
      setPrintTarget(null);
    }
  };

  const statementsToPrint = useMemo(() => {
    if (printTarget === 'ALL') {
      return analytics.allCustomerStats;
    }

    if (printTarget) {
      return analytics.allCustomerStats.filter(
        (data) => data.customer?.id === printTarget
      );
    }

    return [];
  }, [printTarget, analytics.allCustomerStats]);

  const displayMonth = useMemo(() => {
    if (!selectedMonth) return '';

    const [year, month] = selectedMonth.split('-');
    const date = new Date(year, parseInt(month, 10) - 1, 1);

    return date.toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  }, [selectedMonth]);

  // ==========================================
  // MODERN MONTH NAVIGATION
  // ==========================================
  // Keep the underlying value as YYYY-MM so the existing SOA filtering,
  // print and ZIP logic remains unchanged.
  const changeSelectedMonth = (offset) => {
    if (!selectedMonth) return;

    const [year, month] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(year, month - 1 + offset, 1);

    setSelectedMonth(
      `${nextDate.getFullYear()}-${String(
        nextDate.getMonth() + 1
      ).padStart(2, '0')}`
    );
  };

  const termLabel =
    termFilter === 'All'
      ? 'ALL'
      : termFilter === 'cod'
        ? 'COD'
        : '30-DAY';

  // =========================================================================
  // FOOLPROOF PRINT PORTAL
  // =========================================================================
  const printContent = printTarget ? (
    <div
      id="print-portal-root"
      className="absolute left-[-9999px] top-0 z-[-100] bg-white text-black"
      style={{ width: '210mm' }}
    >
      <style type="text/css">
        {`
          .a4-statement-page {
            width: 210mm;
            height: 297mm;
            padding: 10mm 15mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: white;
            margin-bottom: 10px;
          }

          table {
            border-collapse: collapse;
            width: 100%;
          }

          @media print {
            @page {
              size: A4;
              margin: 0 !important;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
            }

            #root {
              display: none !important;
            }

            #print-portal-root {
              display: block !important;
              position: static !important;
              width: 100% !important;
              left: auto !important;
              top: auto !important;
              z-index: auto !important;
              opacity: 1 !important;
              visibility: visible !important;
            }

            .a4-statement-page {
              margin-bottom: 0 !important;
              page-break-after: always !important;
              break-after: always !important;
            }

            tr,
            td,
            th {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        `}
      </style>

      <div
        id="print-pages-container"
        className="flex w-full flex-col items-center"
      >
        {statementsToPrint.map((data, index) => {
          const ITEMS_PER_PAGE = 18;
          const pages = [];

          for (
            let i = 0;
            i < data.invoices.length;
            i += ITEMS_PER_PAGE
          ) {
            pages.push(data.invoices.slice(i, i + ITEMS_PER_PAGE));
          }

          if (pages.length === 0) {
            pages.push([]);
          }

          return (
            <div
              key={data.customer?.id || index}
              className="customer-print-wrapper w-full"
            >
              {pages.map((pageItems, pageIndex) => {
                const isLastPage = pageIndex === pages.length - 1;

                return (
                  <div
                    key={pageIndex}
                    className="a4-statement-page mx-auto"
                    style={{ fontFamily: CJK_FONT }}
                  >
                    {/* --- HEADER --- */}
                    <div className="mb-5 flex w-full shrink-0 items-start justify-between border-b-2 border-black pb-3">
                      <div className="w-[100px] shrink-0">
                        <img
                          src={logo}
                          alt="Three Leaves Logo"
                          className="h-auto w-[100px] object-contain"
                        />
                      </div>

                      <div className="flex flex-1 flex-col items-center justify-start px-2 pt-1 text-center">
                        <h1
                          className="mb-1 text-[15px] font-black tracking-tight"
                          style={{ fontFamily: CJK_FONT }}
                        >
                          THREE LEAVES (SINGAPORE) TRADING ENTERPRISE
                        </h1>

                        <h2
                          className="mb-1 text-[14px] font-bold"
                          style={{ fontFamily: CJK_FONT }}
                        >
                          三叶（新加坡） 贸易公司
                        </h2>

                        <p className="mb-0.5 text-[9px] font-bold tracking-tight">
                          CO.REG NO.53033969B &nbsp;|&nbsp; GST REG NO.
                          M90355440L
                        </p>

                        <p className="mb-0.5 text-[9px] tracking-tight">
                          280 Woodlands Industrial Park E5 #06-35/36 Harvest
                          @ Singapore 757322
                        </p>

                        <p className="text-[9px] tracking-tight">
                          HP: 97578869 (Mr Ye) &nbsp;|&nbsp; HP: 91113505
                          (Min) &nbsp;|&nbsp; Email: 3leaves.sg@gmail.com
                        </p>
                      </div>

                      <div className="flex w-[100px] shrink-0 flex-col items-end pt-1">
                        <h2
                          className="mb-1 text-[20px] font-black leading-none tracking-widest"
                          style={{ fontFamily: CJK_FONT }}
                        >
                          结账单
                        </h2>

                        <h3 className="text-[12px] font-black uppercase text-black">
                          STATEMENT
                        </h3>
                      </div>
                    </div>

                    {/* --- CUSTOMER INFO --- */}
                    <div className="mb-4 flex w-full shrink-0 items-end justify-between text-[13px] font-bold leading-tight">
                      <div className="flex w-[65%] min-w-0 shrink-0 flex-col overflow-hidden pr-4">
                        <div className="mb-1.5 flex w-full min-w-0 items-end">
                          <span className="w-12 shrink-0 text-[12px] font-bold text-slate-500">
                            TO:
                          </span>

                          <span
                            className="block flex-1 overflow-hidden text-ellipsis whitespace-nowrap border-b border-black pb-0.5 text-[14px] font-black uppercase"
                            style={{ fontFamily: CJK_FONT }}
                          >
                            {data.customerName}
                          </span>
                        </div>

                        <div className="flex w-full min-w-0 items-end">
                          <span className="w-20 shrink-0 text-[12px] font-bold text-slate-500">
                            ADDRESS:
                          </span>

                          <span
                            className="block flex-1 overflow-hidden text-ellipsis whitespace-nowrap border-b border-black pb-0.5 text-[12px] uppercase"
                            style={{ fontFamily: CJK_FONT }}
                          >
                            {data.customer?.address || '-'}
                          </span>
                        </div>
                      </div>

                      <div className="flex w-[35%] shrink-0 flex-col items-end justify-end pl-4">
                        <div className="mb-1.5 flex w-full items-end justify-end">
                          <span className="mr-2 shrink-0 text-[12px] font-bold text-slate-500">
                            STMT MONTH:
                          </span>

                          <span className="inline-block w-24 border-b border-black pb-0.5 text-center text-[13px] font-black uppercase">
                            {displayMonth}
                          </span>
                        </div>

                        <div className="flex w-full items-end justify-end">
                          <span className="mr-2 shrink-0 text-[12px] font-bold text-slate-500">
                            TERMS:
                          </span>

                          <span className="inline-block w-24 border-b border-black pb-0.5 text-center text-[12px] font-bold uppercase">
                            {data.customer?.payment_terms === 'cod'
                              ? 'C.O.D'
                              : '30 DAYS'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* --- TABLE CONTENT --- */}
                    <div className="flex w-full flex-1 flex-col justify-start overflow-hidden">
                      <table
                        className="mb-0 w-full border-collapse text-center text-[13px]"
                        style={{ fontFamily: CJK_FONT }}
                      >
                        <thead>
                          <tr className="border-y-2 border-black text-[13px] font-bold">
                            <th className="w-12 px-2 py-2 text-center">
                              NO.
                            </th>
                            <th className="w-32 px-2 py-2 text-center">
                              DATE
                            </th>
                            <th className="px-2 py-2 text-center">
                              INVOICE NO.
                            </th>
                            <th className="w-48 py-2 pl-2 pr-4 text-right">
                              AMOUNT
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {pageItems.map((inv, idx) => {
                            const billed = Number(inv.total) || 0;
                            const absoluteIndex =
                              pageIndex * ITEMS_PER_PAGE + idx + 1;

                            return (
                              <tr
                                key={inv.id}
                                className="h-[28px] align-middle"
                              >
                                <td className="p-1 text-center font-medium">
                                  {absoluteIndex}
                                </td>

                                <td className="p-1 text-center font-medium">
                                  {inv.date
                                    ? new Date(
                                        inv.date
                                      )
                                        .toLocaleDateString('en-GB')
                                        .replace(/\//g, '-')
                                    : '-'}
                                </td>

                                <td className="p-1 text-center font-bold text-black">
                                  #{inv.number || inv.id}
                                </td>

                                <td className="p-1 pr-4 text-right font-bold text-black">
                                  $${formatStatementMoney(billed)}
                                </td>
                              </tr>
                            );
                          })}

                          {pageItems.length < ITEMS_PER_PAGE &&
                            Array.from({
                              length:
                                ITEMS_PER_PAGE - pageItems.length,
                            }).map((_, i) => (
                              <tr
                                key={`blank-${i}`}
                                className="h-[28px] align-middle"
                              >
                                <td />
                                <td />
                                <td />
                                <td />
                              </tr>
                            ))}

                          {isLastPage ? (
                            <tr className="h-[36px] border-y-2 border-black align-middle">
                              <td
                                colSpan="3"
                                className="px-4 py-2 text-right text-[14px] font-black uppercase tracking-widest text-black"
                              >
                                TOTAL AMOUNT DUE:
                              </td>

                              <td className="py-2 pr-4 text-right text-[16px] font-black text-black">
                                $${formatStatementCents(data.totalBilledCents)}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>

                    {/* --- FOOTER --- */}
                    <div className="relative mt-auto flex w-full shrink-0 items-end pt-3">
                      <div className="w-[75%] pr-4 text-[12px] font-bold leading-snug">
                        <div style={{ fontFamily: CJK_FONT }}>
                          <p className="text-[12px]">
                            请提前一天提交订单,同日送达的截止时间为下午12点前。每周日休息
                          </p>

                          <p className="text-[10px] text-slate-800">
                            Please submit orders one day in advance. The
                            cut-off time for same-day delivery is before 12
                            PM. Closed on Sundays.
                          </p>

                          <div className="mt-2 flex items-center">
                            <div className="mr-3 flex h-[60px] w-[60px] shrink-0 items-center justify-center">
                              <img
                                src={paynowQr}
                                alt="PayNow QR Code"
                                className="h-[60px] w-[60px] object-contain"
                              />
                            </div>

                            <div className="flex flex-col justify-center space-y-0.5 text-[10px]">
                              <p>
                                UEN:{' '}
                                <span className="text-[11px] font-black">
                                  53033969B
                                </span>
                              </p>

                              <p>
                                A/C Name:{' '}
                                <span className="text-[11px] font-black">
                                  Three Leaves (Singapore) Trading
                                  Enterprise
                                </span>
                              </p>

                              <p>
                                A/C Number:{' '}
                                <span className="text-[11px] font-black">
                                  535-846562-001
                                </span>
                              </p>

                              <p>
                                Bank Name:{' '}
                                <span className="text-[11px] font-black">
                                  OCBC
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-[25%] shrink-0 flex-col justify-end pb-1 pl-2">
                        <div className="h-10" />

                        <div className="border-t border-black pt-1 text-center text-[11px] font-bold uppercase tracking-widest">
                          Received By
                        </div>
                      </div>

                      <div className="absolute right-0 top-3 text-[10px] font-black tracking-widest text-slate-400">
                        PAGE {pageIndex + 1} OF {pages.length}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative h-full overflow-y-auto bg-slate-50/50 p-8">
      {/* Invisible preloads */}
      <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
        <img src={logo} alt="preload logo" />
        <img src={paynowQr} alt="preload qr" />
      </div>

      {/* DASHBOARD SCREEN UI */}
      <div id="screen-ui">
        <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm">
                <FileText size={18} />
              </div>

              <div>
                <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">
                  Statements of Account
                </h1>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Customer billing, collection status and monthly sales overview
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1">
                <Calendar size={12} className="text-slate-400" />
                {displayMonth}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${dataStatusClass}`}
                title={
                  statementError
                    ? statementError
                    : statementLoading
                      ? 'Loading the selected statement period directly from Supabase.'
                      : `Statement data loaded at ${dataStatusTime}.`
                }
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${
                      dataIsSyncing ? 'animate-ping bg-current' : ''
                    }`}
                  />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                </span>
                {dataStatusLabel}
              </span>

              <span className="inline-flex items-center gap-1.5 px-1 py-1">
                <Database size={12} className="text-slate-400" />
                {statementLoading ? 'Loading invoice records…' : `${formatDashboardInteger(statementInvoices.length)} invoice records in selected period`}
              </span>

              {!dataIsSyncing && dataStatusTime && (
                <span className="inline-flex items-center gap-1.5 px-1 py-1 text-slate-400">
                  <Clock3 size={12} />
                  Updated {dataStatusTime}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleRefreshStatement}
              disabled={isZipping || statementLoading}
              type="button"
              title="Reload the selected statement period directly from Supabase"
            >
              <RefreshCw
                className={`mr-2 ${dataIsSyncing ? 'animate-spin' : ''}`}
                size={15}
              />
              Refresh
            </button>

            <button
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleDownloadZip}
              disabled={
                dataIsSyncing ||
                visibleAnalytics.allCustomerStats.length === 0 ||
                isZipping
              }
              type="button"
            >
              {isZipping ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={15} />
                  Preparing ZIP
                </>
              ) : (
                <>
                  <Download className="mr-2" size={15} />
                  {termLabel} ZIP
                </>
              )}
            </button>

            <button
              className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handlePrint('ALL')}
              disabled={
                dataIsSyncing ||
                visibleAnalytics.allCustomerStats.length === 0 ||
                isZipping
              }
              type="button"
            >
              <Printer className="mr-2" size={15} />
              Print {termLabel}
            </button>
          </div>
        </div>

        {dataIsSyncing && (
          <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-800">
            <div className="flex min-w-0 items-center gap-2.5">
              <Loader2 className="shrink-0 animate-spin" size={15} />
              <div className="min-w-0">
                <p className="font-semibold">
                  {statementError
                    ? 'Statement data could not be loaded.'
                    : 'Loading statement data…'}
                </p>
                <p className="mt-0.5 text-amber-700/80">
                  Totals are withheld until the selected month has been
                  loaded directly from the database.
                </p>
              </div>
            </div>

            <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-wider text-amber-700 sm:inline">
              {statementLoading ? 'Loading…' : `${formatDashboardInteger(statementInvoices.length)} records`}
            </span>
          </div>
        )}

        <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
            <div className="min-w-0 px-5 py-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {termFilter === 'All' ? 'Total Sales' : `${termLabel} Sales`}
                </p>
                <Receipt size={15} className="text-slate-400" />
              </div>
              <p
                className="truncate text-[28px] font-semibold leading-none tracking-[-0.025em] text-slate-950"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {visibleAnalytics.totalRevenue === null ? '—' : formatDashboardMoney(visibleAnalytics.totalRevenue)}
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                {displayMonth}
              </p>
            </div>

            <div className="min-w-0 px-5 py-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Invoices
                </p>
                <FileText size={15} className="text-slate-400" />
              </div>
              <p
                className="text-[28px] font-semibold leading-none tracking-[-0.025em] text-slate-950"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {visibleAnalytics.totalInvoicesCount === null ? '—' : formatDashboardInteger(visibleAnalytics.totalInvoicesCount)}
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                Included in selected period
              </p>
            </div>

            <div className="min-w-0 px-5 py-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Average Order
                </p>
                <TrendingUp size={15} className="text-slate-400" />
              </div>
              <p
                className="truncate text-[28px] font-semibold leading-none tracking-[-0.025em] text-slate-950"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {visibleAnalytics.aov === null ? '—' : formatDashboardMoney(visibleAnalytics.aov)}
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                Per invoice
              </p>
            </div>

            <div className="min-w-0 px-5 py-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Active Accounts
                </p>
                <Users size={15} className="text-slate-400" />
              </div>
              <p
                className="text-[28px] font-semibold leading-none tracking-[-0.025em] text-slate-950"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {visibleAnalytics.activeCustomers === null ? '—' : formatDashboardInteger(visibleAnalytics.activeCustomers)}
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                Customers billed
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">
                Top account
              </span>
              <span className="truncate">
                {visibleAnalytics.topCustomer
                  ? visibleAnalytics.topCustomer.customerName
                  : 'No billed customers'}
              </span>
            </div>

            <span
              className="shrink-0 font-semibold text-slate-800"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {visibleAnalytics.topCustomer
                ? formatDashboardMoney(visibleAnalytics.topCustomer.totalBilled)
                : '—'}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:flex-row">
            <div className="flex w-full items-center space-x-4">
              {/* MODERN MONTH SELECTOR */}
              <div className="relative flex h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-white transition-all focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100">
                <button
                  type="button"
                  onClick={() => changeSelectedMonth(-1)}
                  className="relative z-20 flex h-full w-9 shrink-0 items-center justify-center border-r border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Previous month"
                  title="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex min-w-[170px] items-center justify-center gap-2 px-4">
                  <Calendar
                    className="shrink-0 text-slate-400"
                    size={17}
                  />

                  <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-slate-800">
                    {displayMonth}
                  </span>
                </div>

                {/* The real native month input remains present for browser
                    month-selection support, but is visually transparent.
                    This removes the duplicate browser calendar icon. */}
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) =>
                    setSelectedMonth(event.target.value)
                  }
                  className="absolute inset-y-0 left-10 right-10 z-10 cursor-pointer opacity-0"
                  aria-label={`Select statement month. Current month: ${displayMonth}`}
                />

                <button
                  type="button"
                  onClick={() => changeSelectedMonth(1)}
                  className="relative z-20 flex h-full w-9 shrink-0 items-center justify-center border-l border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Next month"
                  title="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex w-48 h-10 items-center rounded-lg border border-slate-200 bg-white px-3.5 shadow-sm">
                <Filter
                  className="mr-2 shrink-0 text-slate-400"
                  size={18}
                />

                <select
                  className="w-full cursor-pointer appearance-none border-none bg-transparent text-xs font-semibold text-slate-700 outline-none focus:ring-0"
                  value={termFilter}
                  onChange={(e) => setTermFilter(e.target.value)}
                >
                  <option value="All">All Payment Terms</option>
                  <option value="30_days">30 Days Credit</option>
                  <option value="cod">C.O.D. Only</option>
                </select>
              </div>

              <div className="flex h-10 flex-1 items-center rounded-lg border border-slate-200 bg-white px-3.5 shadow-sm">
                <Search
                  className="mr-2 shrink-0 text-slate-400"
                  size={18}
                />

                <input
                  type="text"
                  placeholder="Search customer entity..."
                  className="w-full border-none bg-transparent text-sm outline-none placeholder:text-slate-400 focus:ring-0"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <table className="w-full border-collapse text-left" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <th className="w-1/3 px-5 py-3.5 pl-6">
                  Customer Entity
                </th>

                <th className="px-5 py-3.5 text-right">
                  Total Billed
                </th>

                <th className="px-5 py-3.5 text-center">
                  Status
                </th>

                <th className="px-5 py-3.5 pr-6 text-right">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {dataIsSyncing ? (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2
                        className="mb-3 animate-spin text-slate-400"
                        size={20}
                      />
                      <p className="text-sm font-semibold text-slate-700">
                        Updating statement data
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        The customer table will appear once the invoice
                        dataset has settled.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {visibleAnalytics.displayList.map((row) => (
                    <tr
                      className="font-medium transition-colors hover:bg-slate-50"
                      key={row.customer?.id || row.customerName}
                    >
                      <td className="px-5 py-4 pl-6 font-semibold text-slate-800">
                        <div className="flex items-center">
                          {row.customerName}

                          <span
                            className={`ml-2 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${
                              row.customer?.payment_terms === 'cod'
                                ? 'border border-amber-200 bg-amber-100 text-amber-700'
                                : 'border border-indigo-200 bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {row.customer?.payment_terms === 'cod'
                              ? 'C.O.D'
                              : '30 Days'}
                          </span>
                        </div>

                        <div className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-400">
                          {row.invoices.length} Invoices
                        </div>
                      </td>

                      <td
                        className="px-5 py-4 text-right text-[15px] font-semibold text-slate-950"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatDashboardMoney(row.totalBilledCents / 100)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        {row.invoices.length > 0 ? (
                          <div className="relative inline-flex items-center">
                            <select
                              value={row.monthStatus}
                              onChange={(e) =>
                                handleStatusChange(
                                  row.customer?.id,
                                  e.target.value
                                )
                              }
                              className={`cursor-pointer appearance-none rounded-lg py-1.5 pl-8 pr-8 text-[10px] font-black uppercase tracking-widest outline-none transition-all ${
                                row.monthStatus === 'Paid'
                                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              }`}
                            >
                              <option value="Paid">PAID</option>
                              <option value="Unpaid">UNPAID</option>
                            </select>

                            <div className="pointer-events-none absolute left-2.5">
                              {row.monthStatus === 'Paid' ? (
                                <CheckCircle
                                  size={12}
                                  className="text-emerald-600"
                                />
                              ) : (
                                <AlertCircle
                                  size={12}
                                  className="text-amber-600"
                                />
                              )}
                            </div>

                            <div className="pointer-events-none absolute right-2.5">
                              <ChevronDown
                                size={12}
                                className={
                                  row.monthStatus === 'Paid'
                                    ? 'text-emerald-600'
                                    : 'text-amber-600'
                                }
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-medium italic text-slate-400">
                            No new invoices
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 pr-6 text-right">
                        <button
                          onClick={() => handlePrint(row.customer?.id)}
                          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-900 hover:text-white"
                        >
                          <Printer size={12} className="mr-1" />
                          Print
                        </button>
                      </td>
                    </tr>
                  ))}

                  {visibleAnalytics.displayList.length === 0 && (
                    <tr>
                      <td
                        className="p-12 text-center text-sm font-bold text-slate-400"
                        colSpan="4"
                      >
                        No transactions or outstanding balances found.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RENDER THE SECURE PRINT PORTAL OUTSIDE THE REACT ROOT */}
      {printTarget && createPortal(printContent, document.body)}
    </div>
  );
}
