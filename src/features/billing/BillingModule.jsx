import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Printer,
  Search,
  Calendar,
  Download,
  Loader2,
  DollarSign,
  TrendingUp,
  Users,
  Crown,
  Receipt,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { formatMoney, formatMoneyWhole } from '../../utils/format';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Re-use the logo and QR code from your invoices folder
import logo from '../invoices/three_leaves_logo.png';
import paynowQr from '../invoices/paynow_qr.jpg';

const CJK_FONT =
  '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

export function BillingModule({ sys }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [termFilter, setTermFilter] = useState('All');

  const [printTarget, setPrintTarget] = useState(null);
  const [isZipping, setIsZipping] = useState(false);

  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];

  // ==========================================
  // FINANCIAL ANALYTICS & DATA ENGINE
  // ==========================================
  const analytics = useMemo(() => {
    const dataMap = {};

    safeInvoices.forEach((inv) => {
      const isCurrentMonth = String(inv.date).startsWith(selectedMonth);
      if (!isCurrentMonth) return;

      if (!dataMap[inv.customerId]) {
        const customerObj = safeCustomers.find((c) => c.id === inv.customerId);

        dataMap[inv.customerId] = {
          customer: customerObj,
          customerName: String(
            customerObj?.name || inv.customer || 'Unknown Customer'
          ),
          invoices: [],
          totalBilled: 0,
          monthStatus: 'Paid',
        };
      }

      const invTotal = Number(inv.total) || 0;
      const roundedInvTotal = Math.round(invTotal * 100) / 100;
      const invStatus = String(inv.status || 'Paid');

      dataMap[inv.customerId].invoices.push(inv);
      dataMap[inv.customerId].totalBilled += roundedInvTotal;

      if (invStatus === 'Unpaid') {
        dataMap[inv.customerId].monthStatus = 'Unpaid';
      }
    });

    const relevantCustomers = Object.values(dataMap).filter((row) => {
      const isActive = row.invoices.length > 0;
      if (!isActive) return false;

      if (termFilter !== 'All') {
        const cTerm =
          row.customer?.payment_terms === 'cod' ? 'cod' : '30_days';

        if (cTerm !== termFilter) return false;
      }

      return true;
    });

    let totalRevenue = 0;
    let totalInvoicesCount = 0;

    relevantCustomers.forEach((row) => {
      totalRevenue += row.totalBilled;
      totalInvoicesCount += row.invoices.length;
    });

    const activeCustomers = relevantCustomers.filter(
      (row) => row.invoices.length > 0
    ).length;

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
          return dateA - dateB;
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
  }, [
    safeInvoices,
    safeCustomers,
    selectedMonth,
    searchTerm,
    termFilter,
  ]);

  const handleStatusChange = (customerId, newStatus) => {
    const updatedInvoices = safeInvoices.map((inv) => {
      if (
        inv.customerId === customerId &&
        String(inv.date).startsWith(selectedMonth)
      ) {
        return {
          ...inv,
          status: newStatus,
        };
      }

      return inv;
    });

    sys.setInvoices(updatedInvoices);
  };

  const handlePrint = (target) => {
    setPrintTarget(target);

    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 300);
  };

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
                                  ${formatMoney(billed)}
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
                                ${formatMoney(data.totalBilled)}
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="flex items-center text-2xl font-semibold text-slate-900">
              <FileText className="mr-3 text-blue-600" size={28} />
              Statements of Account (SOA)
            </h1>

            <p className="mt-1 text-base text-slate-500">
              Generate, print, or download batch summaries for your
              customers.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              className="flex items-center rounded-xl bg-indigo-600 px-6 py-2.5 font-medium text-white shadow-lg transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
              onClick={handleDownloadZip}
              disabled={
                analytics.allCustomerStats.length === 0 || isZipping
              }
              type="button"
            >
              {isZipping ? (
                <>
                  <Loader2
                    className="mr-2 animate-spin"
                    size={18}
                  />
                  Zipping...
                </>
              ) : (
                <>
                  <Download className="mr-2" size={18} />
                  {termLabel} ZIP
                </>
              )}
            </button>

            <button
              className="flex items-center rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
              onClick={() => handlePrint('ALL')}
              disabled={
                analytics.allCustomerStats.length === 0 || isZipping
              }
              type="button"
            >
              <Printer className="mr-2" size={18} />
              Print {termLabel}
            </button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="absolute -right-4 -top-4 text-blue-600 opacity-5">
              <TrendingUp size={100} />
            </div>

            <p className="z-10 mb-1 flex items-center text-[11px] font-black uppercase tracking-widest text-slate-400">
              <DollarSign size={12} className="mr-1" />
              {termFilter === 'All' ? 'Total' : termLabel} Revenue
            </p>

            <p className="z-10 text-3xl font-black tracking-tighter text-blue-600">
              ${formatMoneyWhole(analytics.totalRevenue)}
            </p>
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-end justify-between">
              <p className="flex items-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                <Receipt size={12} className="mr-1" />
                Avg Order Value
              </p>

              <p className="text-xs font-bold text-slate-400">
                {analytics.totalInvoicesCount} Invoices
              </p>
            </div>

            <p className="text-2xl font-bold tracking-tight text-slate-800">
              ${formatMoney(analytics.aov)}{' '}
              <span className="text-sm font-medium text-slate-400">
                / order
              </span>
            </p>
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-1 flex items-center text-[11px] font-black uppercase tracking-widest text-slate-400">
              <Users size={12} className="mr-1" />
              {termFilter === 'All' ? 'Active' : termLabel} Accounts
            </p>

            <p className="text-2xl font-bold tracking-tight text-slate-800">
              {analytics.activeCustomers}{' '}
              <span className="text-sm font-medium text-slate-400">
                entities billed
              </span>
            </p>
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm">
            <p className="mb-1 flex items-center text-[11px] font-black uppercase tracking-widest text-amber-600">
              <Crown size={12} className="mr-1" />
              Top {termFilter !== 'All' ? termLabel : ''} Customer
            </p>

            {analytics.topCustomer ? (
              <>
                <p className="truncate text-sm font-bold leading-tight text-slate-900">
                  {analytics.topCustomer.customerName}
                </p>

                <p className="mt-0.5 text-lg font-black tracking-tight text-amber-600">
                  $
                  {formatMoneyWhole(
                    analytics.topCustomer.totalBilled
                  )}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm font-medium text-slate-400">
                No data available
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-slate-50 p-4 sm:flex-row">
            <div className="flex w-full items-center space-x-4">
              {/* MODERN MONTH SELECTOR */}
              <div className="relative flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100">
                <button
                  type="button"
                  onClick={() => changeSelectedMonth(-1)}
                  className="relative z-20 flex h-full w-10 shrink-0 items-center justify-center border-r border-slate-100 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Previous month"
                  title="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex min-w-[176px] items-center justify-center gap-2.5 px-4">
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
                  className="relative z-20 flex h-full w-10 shrink-0 items-center justify-center border-l border-slate-100 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Next month"
                  title="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex w-48 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <Filter
                  className="mr-2 shrink-0 text-slate-400"
                  size={18}
                />

                <select
                  className="w-full cursor-pointer appearance-none border-none bg-transparent text-sm font-bold text-slate-700 outline-none focus:ring-0"
                  value={termFilter}
                  onChange={(e) => setTermFilter(e.target.value)}
                >
                  <option value="All">All Payment Terms</option>
                  <option value="30_days">30 Days Credit</option>
                  <option value="cod">C.O.D. Only</option>
                </select>
              </div>

              <div className="flex flex-1 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
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

          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-xs font-semibold uppercase tracking-widest text-slate-500">
                <th className="w-1/3 p-5 pl-8">
                  Customer Entity
                </th>

                <th className="p-5 text-right">
                  Total Billed
                </th>

                <th className="p-5 text-center">
                  Status
                </th>

                <th className="p-5 pr-8 text-right">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {analytics.displayList.map((row) => (
                <tr
                  className="font-medium transition-colors hover:bg-blue-50/50"
                  key={row.customer?.id || row.customerName}
                >
                  <td className="p-5 pl-8 font-bold text-slate-800">
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

                  <td className="p-5 text-right text-base font-black text-slate-900">
                    ${formatMoney(row.totalBilled)}
                  </td>

                  <td className="p-5 text-center">
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
                              ? 'border border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'border border-orange-200 bg-orange-100 text-orange-700 hover:bg-orange-200'
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
                              className="text-orange-600"
                            />
                          )}
                        </div>

                        <div className="pointer-events-none absolute right-2.5">
                          <ChevronDown
                            size={12}
                            className={
                              row.monthStatus === 'Paid'
                                ? 'text-emerald-600'
                                : 'text-orange-600'
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

                  <td className="p-5 pr-8 text-right">
                    <button
                      onClick={() =>
                        handlePrint(row.customer?.id)
                      }
                      className="inline-flex items-center rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 transition-colors hover:bg-blue-600 hover:text-white"
                    >
                      <Printer size={12} className="mr-1" />
                      Print
                    </button>
                  </td>
                </tr>
              ))}

              {analytics.displayList.length === 0 && (
                <tr>
                  <td
                    className="p-12 text-center text-sm font-bold text-slate-400"
                    colSpan="4"
                  >
                    No transactions or outstanding balances found.
                  </td>
                </tr>
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
