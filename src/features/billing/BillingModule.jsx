import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  Users,
  WalletCards,
} from 'lucide-react';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';
import logo from '../invoices/three_leaves_logo.png';
import paynowQr from '../invoices/paynow_qr.jpg';

const CJK_FONT =
  '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

const CASH_FETCH_BATCH_SIZE = 1000;
const STATEMENT_ITEMS_PER_PAGE = 18;

function getCustomerName(customer) {
  return String(
    customer?.name ??
      customer?.Name ??
      customer?.customerName ??
      customer?.customer_name ??
      ''
  ).trim();
}

function getPaymentTermValue(customer, invoice) {
  return String(
    customer?.payment_terms ??
      customer?.paymentTerms ??
      invoice?.payment_terms ??
      invoice?.paymentTerms ??
      '30_days'
  )
    .trim()
    .toLowerCase();
}

function getPaymentTermLabel(value) {
  const term = String(value || '').trim().toLowerCase();

  if (term === 'cod') return 'C.O.D';
  if (term === 'paynow') return 'PayNow';
  return '30 Days';
}

function normaliseSearch(value) {
  return String(value ?? '').trim().toLowerCase();
}

function formatDateOnly(value) {
  const raw = String(value || '');
  const [year, month, day] = raw.split('-');

  if (year && month && day) {
    return `${day}-${month}-${year}`;
  }

  return raw || '-';
}

function getInvoiceSubtotal(invoice) {
  const storedSubtotal = Number(invoice?.subtotal);

  if (Number.isFinite(storedSubtotal) && storedSubtotal >= 0) {
    return storedSubtotal;
  }

  const items = Array.isArray(invoice?.items) ? invoice.items : [];

  return items.reduce((sum, item) => {
    const qty = Number(item?.qty ?? item?.quantity ?? 0) || 0;
    const price =
      Number(item?.unitPrice ?? item?.price ?? item?.Price ?? 0) || 0;

    return sum + qty * price;
  }, 0);
}

function getInvoiceGst(invoice) {
  if (invoice?.includeGst === false) return 0;

  const storedGst = Number(
    invoice?.gstAmount ??
      invoice?.gst_amount
  );

  if (Number.isFinite(storedGst) && storedGst >= 0) {
    return storedGst;
  }

  const subtotal = getInvoiceSubtotal(invoice);
  const total = Number(invoice?.total);

  if (Number.isFinite(total) && total >= subtotal) {
    return Math.max(total - subtotal, 0);
  }

  return subtotal * 0.09;
}

async function fetchAllCashInvoices() {
  const allRows = [];
  let from = 0;

  while (true) {
    const to = from + CASH_FETCH_BATCH_SIZE - 1;

    const { data, error } = await supabase
      .from('cash_invoices')
      .select('*')
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    allRows.push(...rows);

    if (rows.length < CASH_FETCH_BATCH_SIZE) break;

    from += CASH_FETCH_BATCH_SIZE;

    if (from > 1000000) {
      throw new Error(
        'Cash Billing stopped after 1,000,000 rows. Please review the database query.'
      );
    }
  }

  return allRows;
}

function BillingSummaryCard({
  label,
  value,
  subtext,
  icon,
  tone = 'blue',
}) {
  return (
    <div className="tl-metric-card">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="tl-metric-card__label">{label}</p>
          <p className="tl-metric-card__value truncate">{value}</p>
        </div>
        <div className="tl-metric-card__icon" aria-hidden="true">{icon}</div>
      </div>
      <p className="tl-metric-card__helper">{subtext}</p>
    </div>
  );
}

export function CashBilling({ sys }) {
  const [cashInvoices, setCashInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();

    return `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}`;
  });

  const [termFilter, setTermFilter] = useState('All');
  const [gstFilter, setGstFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [printTarget, setPrintTarget] = useState(null);
  const [isZipping, setIsZipping] = useState(false);
  const [statusUpdatingCustomer, setStatusUpdatingCustomer] = useState('');

  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];

  const refreshCashBilling = async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const rows = await fetchAllCashInvoices();
      setCashInvoices(rows);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Unable to load Cash Billing:', error);
      setLoadError(error?.message || 'Unable to load Cash Billing.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshCashBilling();
  }, []);

  const displayMonth = useMemo(() => {
    const [year, month] = String(selectedMonth).split('-').map(Number);

    if (!year || !month) return '';

    return new Date(year, month - 1, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [selectedMonth]);

  const changeSelectedMonth = (offset) => {
    const [year, month] = String(selectedMonth).split('-').map(Number);

    if (!year || !month) return;

    const nextDate = new Date(year, month - 1 + offset, 1);

    setSelectedMonth(
      `${nextDate.getFullYear()}-${String(
        nextDate.getMonth() + 1
      ).padStart(2, '0')}`
    );
  };

  const analytics = useMemo(() => {
    const customerById = new Map(
      safeCustomers.map((customer) => [
        String(customer?.id || ''),
        customer,
      ])
    );

    const monthInvoices = cashInvoices.filter((invoice) =>
      String(invoice?.date || '').startsWith(selectedMonth)
    );

    const gstFilteredInvoices = monthInvoices.filter((invoice) => {
      if (gstFilter === 'With GST') {
        return invoice?.includeGst !== false;
      }

      if (gstFilter === 'No GST') {
        return invoice?.includeGst === false;
      }

      return true;
    });

    const groups = new Map();

    gstFilteredInvoices.forEach((invoice) => {
      const customerId = String(invoice?.customerId || '');
      const customer = customerById.get(customerId) || null;
      const customerName =
        getCustomerName(customer) ||
        String(invoice?.customer || 'Unknown Customer').trim() ||
        'Unknown Customer';

      const groupKey = customerId || `name:${normaliseSearch(customerName)}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          customerId,
          customer,
          customerName,
          paymentTerm: getPaymentTermValue(customer, invoice),
          invoices: [],
          invoiceCount: 0,
          totalBilled: 0,
          subtotalExGst: 0,
          gstTotal: 0,
          paidTotal: 0,
          outstandingTotal: 0,
          monthStatus: 'Paid',
        });
      }

      const group = groups.get(groupKey);
      const total = Number(invoice?.total) || 0;
      const subtotal = getInvoiceSubtotal(invoice);
      const gst = getInvoiceGst(invoice);
      const status = String(invoice?.status || 'Unpaid');

      group.invoices.push(invoice);
      group.invoiceCount += 1;
      group.totalBilled += total;
      group.subtotalExGst += subtotal;
      group.gstTotal += gst;

      if (status === 'Paid') {
        group.paidTotal += total;
      } else {
        group.outstandingTotal += total;
        group.monthStatus = 'Unpaid';
      }
    });

    let rows = Array.from(groups.values()).filter((group) => {
      if (termFilter !== 'All' && group.paymentTerm !== termFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const search = normaliseSearch(searchTerm);

        return [
          group.customerName,
          group.customerId,
          getPaymentTermLabel(group.paymentTerm),
        ]
          .map(normaliseSearch)
          .some((value) => value.includes(search));
      }

      return true;
    });

    rows.forEach((row) => {
      row.invoices.sort((left, right) => {
        const dateCompare = String(left?.date || '').localeCompare(
          String(right?.date || '')
        );

        if (dateCompare !== 0) return dateCompare;

        return String(left?.number || left?.id || '').localeCompare(
          String(right?.number || right?.id || ''),
          undefined,
          { numeric: true, sensitivity: 'base' }
        );
      });
    });

    rows.sort((left, right) =>
      left.customerName.localeCompare(right.customerName)
    );

    const totals = rows.reduce(
      (summary, row) => {
        summary.totalBilled += row.totalBilled;
        summary.subtotalExGst += row.subtotalExGst;
        summary.gstTotal += row.gstTotal;
        summary.paidTotal += row.paidTotal;
        summary.outstandingTotal += row.outstandingTotal;
        summary.invoiceCount += row.invoiceCount;

        return summary;
      },
      {
        totalBilled: 0,
        subtotalExGst: 0,
        gstTotal: 0,
        paidTotal: 0,
        outstandingTotal: 0,
        invoiceCount: 0,
      }
    );

    return {
      rows,
      allCustomerStats: rows,
      ...totals,
      activeCustomers: rows.length,
    };
  }, [
    cashInvoices,
    gstFilter,
    safeCustomers,
    searchTerm,
    selectedMonth,
    termFilter,
  ]);

  const handleMonthStatusChange = async (row, newStatus) => {
    const invoiceIds = row.invoices
      .map((invoice) => invoice?.id)
      .filter(Boolean);

    if (invoiceIds.length === 0) return;

    setStatusUpdatingCustomer(row.key);

    try {
      const { error } = await supabase
        .from('cash_invoices')
        .update({ status: newStatus })
        .in('id', invoiceIds);

      if (error) throw error;

      const idSet = new Set(invoiceIds.map(String));

      setCashInvoices((current) =>
        current.map((invoice) =>
          idSet.has(String(invoice?.id))
            ? { ...invoice, status: newStatus }
            : invoice
        )
      );
    } catch (error) {
      window.alert(
        `Unable to update Cash billing status: ${
          error?.message || 'Unknown error'
        }`
      );
    } finally {
      setStatusUpdatingCustomer('');
    }
  };

  const statementsToPrint = useMemo(() => {
    if (printTarget === 'ALL') {
      return analytics.allCustomerStats;
    }

    if (printTarget) {
      return analytics.allCustomerStats.filter(
        (row) => row.key === printTarget
      );
    }

    return [];
  }, [analytics.allCustomerStats, printTarget]);

  const handlePrint = (target) => {
    setPrintTarget(target);

    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 350);
  };

  const ensureReadiness = async (container) => {
    await new Promise((resolve) => setTimeout(resolve, 350));

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const images = container.querySelectorAll('img');

    await Promise.all(
      Array.from(images).map((image) => {
        if (image.complete) return Promise.resolve();

        return new Promise((resolve) => {
          image.onload = resolve;
          image.onerror = resolve;
        });
      })
    );
  };

  const generatePdfFromWrapper = async (wrapperNode) => {
    const pages = wrapperNode.querySelectorAll('.cash-billing-a4-page');
    const pdf = new jsPDF('p', 'mm', 'a4');

    for (let index = 0; index < pages.length; index += 1) {
      const canvas = await html2canvas(pages[index], {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imageData = canvas.toDataURL('image/jpeg', 1.0);

      pdf.addImage(imageData, 'JPEG', 0, 0, 210, 297);

      if (index < pages.length - 1) {
        pdf.addPage();
      }
    }

    return pdf.output('blob');
  };

  const handleDownloadZip = async () => {
    if (analytics.allCustomerStats.length === 0) return;

    setIsZipping(true);

    try {
      const zip = new JSZip();
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthShort = new Date(year, month - 1, 1).toLocaleString(
        'en-US',
        { month: 'short' }
      );
      const yearShort = String(year).slice(-2);

      for (const row of analytics.allCustomerStats) {
        setPrintTarget(row.key);

        await new Promise((resolve) => setTimeout(resolve, 60));

        const wrapper = document.querySelector(
          '.cash-billing-customer-print-wrapper'
        );

        if (!wrapper) continue;

        await ensureReadiness(wrapper);

        const pdfBlob = await generatePdfFromWrapper(wrapper);

        const safeName = row.customerName
          .replace(/[<>:"/\\|?*]/g, '')
          .trim();

        zip.file(
          `${safeName}_${monthShort}_${yearShort}_Cash.pdf`,
          pdfBlob
        );
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `Cash_Billing_${monthShort}_${yearShort}.zip`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Unable to create Cash Billing ZIP:', error);
      window.alert(
        `Unable to generate Cash Billing ZIP: ${
          error?.message || 'Unknown error'
        }`
      );
    } finally {
      setIsZipping(false);
      setPrintTarget(null);
    }
  };

  const printContent = printTarget ? (
    <div
      id="cash-billing-print-root"
      className="absolute left-[-9999px] top-0 z-[-100] bg-white text-black"
      style={{ width: '210mm' }}
    >
      <style type="text/css">
        {`
          .cash-billing-a4-page {
            width: 210mm;
            height: 297mm;
            padding: 10mm 15mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            background: white;
            margin-bottom: 10px;
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

            #cash-billing-print-root {
              display: block !important;
              position: static !important;
              width: 100% !important;
              left: auto !important;
              top: auto !important;
              z-index: auto !important;
              opacity: 1 !important;
              visibility: visible !important;
            }

            .cash-billing-a4-page {
              margin-bottom: 0 !important;
              page-break-after: always !important;
              break-after: page !important;
            }

            .cash-billing-a4-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
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

      <div className="flex w-full flex-col items-center">
        {statementsToPrint.map((row) => {
          const pages = [];

          for (
            let index = 0;
            index < row.invoices.length;
            index += STATEMENT_ITEMS_PER_PAGE
          ) {
            pages.push(
              row.invoices.slice(
                index,
                index + STATEMENT_ITEMS_PER_PAGE
              )
            );
          }

          if (pages.length === 0) pages.push([]);

          return (
            <div
              key={row.key}
              className="cash-billing-customer-print-wrapper w-full"
            >
              {pages.map((pageItems, pageIndex) => {
                const isLastPage = pageIndex === pages.length - 1;

                return (
                  <div
                    key={`${row.key}-${pageIndex}`}
                    className="cash-billing-a4-page mx-auto"
                    style={{ fontFamily: CJK_FONT }}
                  >
                    <div className="mb-5 flex w-full shrink-0 items-start justify-between border-b-2 border-black pb-3">
                      <div className="w-[100px] shrink-0">
                        <img
                          src={logo}
                          alt="Three Leaves Logo"
                          className="h-auto w-[100px] object-contain"
                        />
                      </div>

                      <div className="flex flex-1 flex-col items-center px-3 pt-1 text-center">
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

                        <p className="mb-0.5 text-[9px] font-bold">
                          CO.REG NO.53033969B &nbsp;|&nbsp; GST REG NO.
                          M90355440L
                        </p>

                        <p className="mb-0.5 text-[9px]">
                          280 Woodlands Industrial Park E5 #06-35/36
                          Harvest @ Singapore 757322
                        </p>

                        <p className="text-[9px]">
                          HP: 97578869 (Mr Ye) &nbsp;|&nbsp; HP: 91113505
                          (Min) &nbsp;|&nbsp; Email: 3leaves.sg@gmail.com
                        </p>
                      </div>

                      <div className="flex w-[115px] shrink-0 flex-col items-end pt-1 text-right">
                        <h2
                          className="mb-1 text-[19px] font-black leading-none"
                          style={{ fontFamily: CJK_FONT }}
                        >
                          现金结账单
                        </h2>
                        <h3 className="text-[11px] font-black uppercase tracking-wide">
                          CASH BILLING
                        </h3>
                      </div>
                    </div>

                    <div className="mb-4 flex w-full shrink-0 items-end justify-between text-[12px] font-bold">
                      <div className="flex w-[65%] min-w-0 flex-col pr-4">
                        <div className="mb-1.5 flex items-end">
                          <span className="w-12 shrink-0 text-slate-500">
                            TO:
                          </span>
                          <span
                            className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap border-b border-black pb-0.5 text-[14px] font-black uppercase"
                            style={{ fontFamily: CJK_FONT }}
                          >
                            {row.customerName}
                          </span>
                        </div>

                        <div className="flex items-end">
                          <span className="w-20 shrink-0 text-slate-500">
                            ADDRESS:
                          </span>
                          <span
                            className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap border-b border-black pb-0.5 text-[11px] uppercase"
                            style={{ fontFamily: CJK_FONT }}
                          >
                            {row.customer?.address || '-'}
                          </span>
                        </div>
                      </div>

                      <div className="flex w-[35%] flex-col items-end pl-4">
                        <div className="mb-1.5 flex w-full items-end justify-end">
                          <span className="mr-2 shrink-0 text-slate-500">
                            MONTH:
                          </span>
                          <span className="w-28 border-b border-black pb-0.5 text-center font-black uppercase">
                            {displayMonth}
                          </span>
                        </div>

                        <div className="flex w-full items-end justify-end">
                          <span className="mr-2 shrink-0 text-slate-500">
                            TERMS:
                          </span>
                          <span className="w-28 border-b border-black pb-0.5 text-center font-bold">
                            {getPaymentTermLabel(row.paymentTerm)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-h-0 w-full flex-1 flex-col">
                      <table className="w-full border-collapse text-center text-[12px]">
                        <thead>
                          <tr className="border-y-2 border-black text-[11px] font-black uppercase tracking-wide">
                            <th className="w-10 px-1 py-2">
                              No.
                            </th>
                            <th className="w-24 px-2 py-2">
                              Date
                            </th>
                            <th className="px-2 py-2">
                              Cash Invoice
                            </th>
                            <th className="w-20 px-2 py-2">
                              GST
                            </th>
                            <th className="w-20 px-2 py-2">
                              Status
                            </th>
                            <th className="w-32 px-2 py-2 text-right">
                              Amount
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {pageItems.map((invoice, itemIndex) => {
                            const absoluteIndex =
                              pageIndex * STATEMENT_ITEMS_PER_PAGE +
                              itemIndex +
                              1;

                            return (
                              <tr
                                key={invoice?.id || absoluteIndex}
                                className="h-[28px]"
                              >
                                <td className="px-1 py-1">
                                  {absoluteIndex}
                                </td>

                                <td className="px-2 py-1">
                                  {formatDateOnly(invoice?.date)}
                                </td>

                                <td className="px-2 py-1 font-bold">
                                  {String(
                                    invoice?.number ||
                                      invoice?.id ||
                                      '-'
                                  )}
                                </td>

                                <td className="px-2 py-1">
                                  {invoice?.includeGst === false
                                    ? 'No GST'
                                    : 'GST 9%'}
                                </td>

                                <td className="px-2 py-1">
                                  {String(
                                    invoice?.status || 'Unpaid'
                                  )}
                                </td>

                                <td className="px-2 py-1 text-right font-bold">
                                  $
                                  {formatMoney(
                                    Number(invoice?.total) || 0
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {pageItems.length < STATEMENT_ITEMS_PER_PAGE &&
                            Array.from({
                              length:
                                STATEMENT_ITEMS_PER_PAGE -
                                pageItems.length,
                            }).map((_, blankIndex) => (
                              <tr
                                key={`blank-${blankIndex}`}
                                className="h-[28px]"
                              >
                                <td />
                                <td />
                                <td />
                                <td />
                                <td />
                                <td />
                              </tr>
                            ))}

                          {isLastPage && (
                            <>
                              <tr className="border-t-2 border-black">
                                <td
                                  colSpan="5"
                                  className="px-3 py-2 text-right text-[11px] font-black uppercase tracking-wide"
                                >
                                  Total Cash Billed
                                </td>
                                <td className="px-2 py-2 text-right text-[13px] font-black">
                                  ${formatMoney(row.totalBilled)}
                                </td>
                              </tr>

                              <tr>
                                <td
                                  colSpan="5"
                                  className="px-3 py-1.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-600"
                                >
                                  Paid
                                </td>
                                <td className="px-2 py-1.5 text-right font-bold">
                                  ${formatMoney(row.paidTotal)}
                                </td>
                              </tr>

                              <tr className="border-b-2 border-black">
                                <td
                                  colSpan="5"
                                  className="px-3 py-2 text-right text-[12px] font-black uppercase tracking-wide"
                                >
                                  Outstanding
                                </td>
                                <td className="px-2 py-2 text-right text-[14px] font-black">
                                  ${formatMoney(row.outstandingTotal)}
                                </td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="relative mt-auto flex w-full shrink-0 items-end pt-3">
                      <div className="w-[75%] pr-4 text-[11px] font-bold leading-snug">
                        <p
                          className="text-[11px]"
                          style={{ fontFamily: CJK_FONT }}
                        >
                          请提前一天提交订单,同日送达的截止时间为下午12点前。每周日休息
                        </p>

                        <p className="text-[9px] text-slate-700">
                          Please submit orders one day in advance. The
                          cut-off time for same-day delivery is before 12
                          PM. Closed on Sundays.
                        </p>

                        <div className="mt-2 flex items-center">
                          <div className="mr-3 flex h-[58px] w-[58px] shrink-0 items-center justify-center">
                            <img
                              src={paynowQr}
                              alt="PayNow QR Code"
                              className="h-[58px] w-[58px] object-contain"
                            />
                          </div>

                          <div className="text-[9px] leading-4">
                            <p>UEN: 53033969B</p>
                            <p>
                              A/C Name: Three Leaves (Singapore)
                              Trading Enterprise
                            </p>
                            <p>A/C Number: 535-846562-001</p>
                            <p>Bank Name: OCBC</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-[25%] flex-col justify-end pb-1 pl-2">
                        <div className="h-10" />
                        <div className="border-t border-black pt-1 text-center text-[10px] font-bold uppercase tracking-widest">
                          Received By
                        </div>
                      </div>

                      <div className="absolute right-0 top-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Page {pageIndex + 1} of {pages.length}
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
    <div className="tl-module-page relative h-full overflow-y-auto p-5 sm:p-8">
      <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
        <img src={logo} alt="Preload logo" />
        <img src={paynowQr} alt="Preload PayNow" />
      </div>

      <div className="tl-page-header mb-7">
        <div className="flex items-center">
          <div className="mr-3 flex h-11 w-11 items-center justify-center border border-slate-200 bg-white text-slate-700">
            <ReceiptText className="text-slate-700" size={23} />
          </div>

          <div>
            <h1 className="tl-page-header__title">Cash Billing</h1>
            <p className="tl-page-header__subtitle">Monthly Cash billing summaries, customer statements, print and ZIP exports.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshCashBilling()}
            disabled={isLoading || isZipping}
            className="tl-secondary-action disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={`mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={
              analytics.allCustomerStats.length === 0 ||
              isLoading ||
              isZipping
            }
            className="tl-primary-action disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isZipping ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Download size={16} className="mr-2" />
            )}
            {isZipping ? 'Building ZIP…' : 'Download ZIP'}
          </button>

          <button
            type="button"
            onClick={() => handlePrint('ALL')}
            disabled={
              analytics.allCustomerStats.length === 0 ||
              isLoading ||
              isZipping
            }
            className="tl-primary-action disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer size={16} className="mr-2" />
            Print All
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />

          <div className="flex-1">
            <p>Unable to load Cash Billing records.</p>
            <p className="mt-1 text-xs font-medium text-red-500">
              {loadError}
            </p>
          </div>
        </div>
      )}

      {!loadError && lastRefresh && (
        <div className="mb-5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Last refreshed{' '}
          {lastRefresh.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BillingSummaryCard
          label="Cash Billed"
          value={`$${formatMoney(analytics.totalBilled)}`}
          subtext={`$${formatMoney(
            analytics.subtotalExGst
          )} before GST · $${formatMoney(analytics.gstTotal)} GST`}
          icon={<WalletCards size={20} />}
          tone="emerald"
        />

        <BillingSummaryCard
          label="Outstanding"
          value={`$${formatMoney(analytics.outstandingTotal)}`}
          subtext={`$${formatMoney(analytics.paidTotal)} marked paid`}
          icon={<AlertCircle size={20} />}
          tone="amber"
        />

        <BillingSummaryCard
          label="Cash Invoices"
          value={analytics.invoiceCount}
          subtext={`Matching ${displayMonth} and current filters`}
          icon={<FileText size={20} />}
          tone="indigo"
        />

        <BillingSummaryCard
          label="Customers"
          value={analytics.activeCustomers}
          subtext="Customers with Cash invoices in this result set"
          icon={<Users size={20} />}
          tone="blue"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-sm font-bold text-slate-800">
              Monthly Cash billing
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Choose a month, narrow the billing population, then print or download customer summaries.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex h-11 shrink-0 items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100">
              <button
                type="button"
                onClick={() => changeSelectedMonth(-1)}
                className="relative z-20 flex h-full w-10 items-center justify-center border-r border-slate-100 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-800"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex min-w-[176px] items-center justify-center gap-2.5 px-4">
                <Calendar size={17} className="text-slate-400" />
                <span className="whitespace-nowrap text-sm font-semibold text-slate-800">
                  {displayMonth}
                </span>
              </div>

              <input
                type="month"
                value={selectedMonth}
                onChange={(event) =>
                  setSelectedMonth(event.target.value)
                }
                className="absolute inset-y-0 left-10 right-10 z-10 cursor-pointer opacity-0"
                aria-label={`Select Cash billing month. Current month: ${displayMonth}`}
              />

              <button
                type="button"
                onClick={() => changeSelectedMonth(1)}
                className="relative z-20 flex h-full w-10 items-center justify-center border-l border-slate-100 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-800"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-3 shadow-sm xl:w-48">
              <Filter size={16} className="mr-2 text-slate-400" />
              <select
                value={termFilter}
                onChange={(event) => setTermFilter(event.target.value)}
                className="w-full cursor-pointer appearance-none bg-transparent text-xs font-bold text-slate-700 outline-none"
              >
                <option value="All">All Payment Terms</option>
                <option value="30_days">30 Days</option>
                <option value="cod">C.O.D</option>
                <option value="paynow">PayNow</option>
              </select>
            </div>

            <div className="flex h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-3 shadow-sm xl:w-40">
              <WalletCards size={16} className="mr-2 text-slate-400" />
              <select
                value={gstFilter}
                onChange={(event) => setGstFilter(event.target.value)}
                className="w-full cursor-pointer appearance-none bg-transparent text-xs font-bold text-slate-700 outline-none"
              >
                <option value="All">All GST</option>
                <option value="With GST">With GST</option>
                <option value="No GST">No GST</option>
              </select>
            </div>

            <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition-all focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100">
              <Search size={16} className="mr-2 shrink-0 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search customer..."
                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                <th className="p-5 pl-8">Customer</th>
                <th className="p-5 text-center">Cash Invoices</th>
                <th className="p-5 text-right">Cash Billed</th>
                <th className="p-5 text-right">Outstanding</th>
                <th className="p-5 text-center">Month Status</th>
                <th className="p-5 pr-8 text-right">Statement</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-16 text-center text-sm font-bold text-slate-400"
                  >
                    <Loader2
                      size={20}
                      className="mx-auto mb-3 animate-spin"
                    />
                    Loading Cash billing…
                  </td>
                </tr>
              ) : analytics.rows.length > 0 ? (
                analytics.rows.map((row) => (
                  <tr
                    key={row.key}
                    className="transition-colors hover:bg-blue-50/40"
                  >
                    <td className="p-5 pl-8">
                      <p className="font-black text-slate-800">
                        {row.customerName}
                      </p>

                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
                          {getPaymentTermLabel(row.paymentTerm)}
                        </span>

                        <span className="text-[10px] font-semibold text-slate-400">
                          GST ${formatMoney(row.gstTotal)}
                        </span>
                      </div>
                    </td>

                    <td className="p-5 text-center font-black text-slate-700">
                      {row.invoiceCount}
                    </td>

                    <td className="p-5 text-right text-base font-black text-slate-900">
                      ${formatMoney(row.totalBilled)}
                    </td>

                    <td className="p-5 text-right">
                      <p
                        className={`font-black ${
                          row.outstandingTotal > 0
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        ${formatMoney(row.outstandingTotal)}
                      </p>

                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        ${formatMoney(row.paidTotal)} paid
                      </p>
                    </td>

                    <td className="p-5 text-center">
                      <div className="relative inline-flex items-center">
                        <select
                          value={row.monthStatus}
                          disabled={
                            statusUpdatingCustomer === row.key
                          }
                          onChange={(event) =>
                            void handleMonthStatusChange(
                              row,
                              event.target.value
                            )
                          }
                          className={`cursor-pointer appearance-none rounded-lg py-1.5 pl-8 pr-8 text-[10px] font-black uppercase tracking-widest outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                            row.monthStatus === 'Paid'
                              ? 'border border-emerald-200 bg-emerald-100 text-emerald-700'
                              : 'border border-orange-200 bg-orange-100 text-orange-700'
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

                        <ChevronDown
                          size={12}
                          className="pointer-events-none absolute right-2.5 text-slate-500"
                        />
                      </div>
                    </td>

                    <td className="p-5 pr-8 text-right">
                      <button
                        type="button"
                        onClick={() => handlePrint(row.key)}
                        className="inline-flex items-center rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-600 transition-colors hover:bg-blue-600 hover:text-white"
                      >
                        <Printer size={12} className="mr-1.5" />
                        Print
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-16 text-center"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <Search size={22} />
                    </div>

                    <p className="mt-4 text-sm font-black text-slate-700">
                      No Cash billing records
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Try another month, payment term, GST filter or customer.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {printTarget && createPortal(printContent, document.body)}
    </div>
  );
}
