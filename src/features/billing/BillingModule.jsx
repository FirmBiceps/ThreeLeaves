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
  BarChart3,
  Package,
  DollarSign,
  Percent,
  Target,
  UsersRound,
  X,
  ArrowUpDown,
  AlertTriangle,
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

  // Locks the number to exactly 2 decimal places using standard JS rules 
  // (which matches how your Invoice module renders numbers on screen),
  // preventing any aggressive string-formatting rounding.
  const strictTwoDecimals = numericValue.toFixed(2);

  // Safely converts the resulting strict "854.01" string into 85401 integer cents
  return Math.round(Number(strictTwoDecimals) * 100);
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

  // Product Sales Intelligence is deliberately isolated from the existing
  // statement engine. If the optional product RPC is unavailable, the
  // customer billing/statement functionality continues to work normally.
  const [productSalesRows, setProductSalesRows] = useState([]);
  const [productAnalyticsLoading, setProductAnalyticsLoading] = useState(false);
  const [productAnalyticsError, setProductAnalyticsError] = useState(null);
  const [selectedProductKey, setSelectedProductKey] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productRankingMetric, setProductRankingMetric] = useState('sales');
  const [productCustomerFilter, setProductCustomerFilter] = useState('All');
  const [productTopN, setProductTopN] = useState('20');

  const [printTarget, setPrintTarget] = useState(null);
  const [isZipping, setIsZipping] = useState(false);

  // Dedicated Credit Notes view: users can see every issued credit note
  // directly from Billing instead of having to locate the original invoice.
  const [billingView, setBillingView] = useState('statements');
  const [creditNotes, setCreditNotes] = useState([]);
  const [creditNotesLoading, setCreditNotesLoading] = useState(false);
  const [creditNotesError, setCreditNotesError] = useState(null);
  const [creditNoteSearch, setCreditNoteSearch] = useState('');
  const [creditNoteStatus, setCreditNoteStatus] = useState('All');
  const [creditNoteRefreshKey, setCreditNoteRefreshKey] = useState(0);
  const [creditNoteFromMonth, setCreditNoteFromMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [creditNoteToMonth, setCreditNoteToMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [creditNotePdfLoading, setCreditNotePdfLoading] = useState(null);
  const [creditNotePreview, setCreditNotePreview] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadCreditNotes = async () => {
      if (billingView !== 'credit-notes') return;

      setCreditNotesLoading(true);
      setCreditNotesError(null);

      try {
        const { data, error } = await supabase
          .from('credit_notes')
          .select('*')
          .order('credit_note_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!cancelled) setCreditNotes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Credit notes load failed:', error);
        if (!cancelled) {
          setCreditNotes([]);
          setCreditNotesError(
            error?.message || 'Unable to load credit notes from Supabase.'
          );
        }
      } finally {
        if (!cancelled) setCreditNotesLoading(false);
      }
    };

    void loadCreditNotes();

    return () => {
      cancelled = true;
    };
  }, [billingView, creditNoteRefreshKey]);

  const filteredCreditNotes = useMemo(() => {
    const query = creditNoteSearch.trim().toLowerCase();
    const from = `${creditNoteFromMonth}-01`;
    const toParts = String(creditNoteToMonth).split('-').map(Number);
    const toDate = new Date(toParts[0], toParts[1], 1);
    const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-01`;

    return creditNotes
      .filter((note) => {
        const statusMatches =
          creditNoteStatus === 'All' ||
          String(note.status || '').toLowerCase() === creditNoteStatus.toLowerCase();
        if (!statusMatches) return false;

        const noteDate = String(note.credit_note_date || note.created_at || '').slice(0, 10);
        const dateMatches = !noteDate || (noteDate >= from && noteDate < to);
        if (!dateMatches) return false;

        if (!query) return true;

        return [
          note.credit_note_number,
          note.invoice_number,
          note.customer_name,
          note.reason,
          note.settlement_method,
          note.settlement_status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const dateA = String(a.credit_note_date || a.created_at || '');
        const dateB = String(b.credit_note_date || b.created_at || '');
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return String(b.credit_note_number || '').localeCompare(String(a.credit_note_number || ''), undefined, { numeric: true });
      });
  }, [creditNotes, creditNoteSearch, creditNoteStatus, creditNoteFromMonth, creditNoteToMonth]);

  const creditNoteMonthlySummary = useMemo(() => {
    const monthMap = new Map();
    filteredCreditNotes.forEach((note) => {
      const rawDate = String(note.credit_note_date || note.created_at || '');
      const month = rawDate.slice(0, 7) || 'Unknown';
      if (!monthMap.has(month)) {
        monthMap.set(month, { month, count: 0, total: 0, gst: 0 });
      }
      const row = monthMap.get(month);
      const isVoid = String(note.status || '').toLowerCase() === 'void';
      if (!isVoid) {
        row.count += 1;
        row.total += Number(note.total_amount || 0);
        row.gst += Number(note.gst_amount || 0);
      }
    });
    return Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredCreditNotes]);

  const creditNoteSummary = useMemo(() => {
    const active = filteredCreditNotes.filter(
      (note) => String(note.status || 'issued').toLowerCase() !== 'void'
    );

    return {
      count: active.length,
      total: active.reduce((sum, note) => sum + Number(note.total_amount || 0), 0),
      gst: active.reduce((sum, note) => sum + Number(note.gst_amount || 0), 0),
      pending: active
        .filter((note) => String(note.settlement_status || '').toLowerCase() === 'pending')
        .reduce((sum, note) => sum + Number(note.total_amount || 0), 0),
      cancelled: filteredCreditNotes.filter(
        (note) => String(note.status || '').toLowerCase() === 'void'
      ).length,
    };
  }, [filteredCreditNotes]);

  const formatCreditNoteMonth = (yyyyMm) => {
    if (!yyyyMm || yyyyMm === 'Unknown') return 'Unknown';
    const [year, month] = String(yyyyMm).split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });
  };

  const buildCreditNotePdf = async (note) => {
    if (!note?.id) throw new Error('Credit note record is missing.');

    const { data: items, error: itemsError } = await supabase
      .from('credit_note_items')
      .select('*')
      .eq('credit_note_id', note.id)
      .order('invoice_item_index', { ascending: true });

    if (itemsError) throw itemsError;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    const money = (value) => `$${Number(value || 0).toFixed(2)}`;
    const status = String(note.status || '').toLowerCase();
    const isVoid = status === 'void';
    const itemRows = Array.isArray(items) ? items : [];

    const addPageHeader = () => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.setTextColor(20, 20, 20);
      pdf.text('THREE LEAVES', margin, 17);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(95, 95, 95);
      pdf.text('SALES CREDIT NOTE', margin, 22);
      pdf.setDrawColor(30, 30, 30);
      pdf.setLineWidth(0.35);
      pdf.line(margin, 26, pageWidth - margin, 26);
    };

    const addFooter = (pageNumber) => {
      const footerY = pageHeight - 12;
      pdf.setDrawColor(190, 190, 190);
      pdf.setLineWidth(0.2);
      pdf.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 100, 100);
      pdf.text('This credit note is issued against the original invoice stated above.', margin, footerY);
      pdf.text(`Page ${pageNumber}`, pageWidth - margin, footerY, { align: 'right' });
    };

    addPageHeader();

    // Document identity block
    pdf.setTextColor(20, 20, 20);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text('CREDIT NOTE', pageWidth - margin, 18, { align: 'right' });
    pdf.setFontSize(10);
    pdf.text(String(note.credit_note_number || '—'), pageWidth - margin, 24, { align: 'right' });

    y = 36;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(90, 90, 90);
    pdf.text('CUSTOMER', margin, y);
    pdf.text('DOCUMENT DETAILS', 116, y);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(25, 25, 25);
    pdf.text(String(note.customer_name || '—'), margin, y + 6);
    if (note.customer_address) {
      const addressLines = pdf.splitTextToSize(String(note.customer_address), 82);
      pdf.text(addressLines, margin, y + 12);
    }

    const detailX = 116;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Credit Note Date', detailX, y + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.text(String(note.credit_note_date || '—'), pageWidth - margin, y + 6, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.text('Original Invoice', detailX, y + 12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(String(note.invoice_number || '—'), pageWidth - margin, y + 12, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.text('Status', detailX, y + 18);
    pdf.setFont('helvetica', 'normal');
    pdf.text(isVoid ? 'CANCELLED' : 'ISSUED', pageWidth - margin, y + 18, { align: 'right' });

    y = 75;
    pdf.setDrawColor(30, 30, 30);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 7;

    // Returned-item table — explicitly shows what was returned.
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(35, 35, 35);
    pdf.text('RETURNED ITEMS', margin, y);
    y += 6;

    const tableTop = y;
    const col = {
      item: margin + 2,
      qty: 122,
      unit: 154,
      amount: pageWidth - margin - 2,
    };
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, tableTop, contentWidth, 9, 'F');
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, tableTop, contentWidth, 9);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.text('ITEM RETURNED', col.item, tableTop + 5.8);
    pdf.text('QTY', col.qty, tableTop + 5.8, { align: 'right' });
    pdf.text('UNIT PRICE', col.unit, tableTop + 5.8, { align: 'right' });
    pdf.text('AMOUNT EX-GST', col.amount, tableTop + 5.8, { align: 'right' });
    y = tableTop + 9;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(25, 25, 25);

    if (itemRows.length === 0) {
      pdf.text('No returned-item detail was stored for this credit note.', col.item, y + 7);
      y += 14;
    } else {
      itemRows.forEach((item, index) => {
        const name = String(item.product_name || item.item_name || item.description || item.name || `Returned item ${index + 1}`);
        const lines = pdf.splitTextToSize(name, 82);
        const rowHeight = Math.max(10, lines.length * 4.2 + 5);
        if (y + rowHeight > pageHeight - 30) {
          addFooter(pdf.getNumberOfPages());
          pdf.addPage();
          addPageHeader();
          y = 35;
        }
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, y, contentWidth, rowHeight, 'F');
        }
        pdf.setDrawColor(220, 220, 220);
        pdf.rect(margin, y, contentWidth, rowHeight);
        pdf.text(lines, col.item, y + 6);
        pdf.text(String(item.returned_qty ?? item.quantity ?? 0), col.qty, y + 6, { align: 'right' });
        pdf.text(money(item.unit_price), col.unit, y + 6, { align: 'right' });
        pdf.text(money(item.amount_ex_gst ?? item.line_amount), col.amount, y + 6, { align: 'right' });
        y += rowHeight;
      });
    }

    // Totals block
    y += 10;
    const totalsX = 126;
    const totalsValueX = pageWidth - margin;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(40, 40, 40);
    pdf.text('Amount excluding GST', totalsX, y);
    pdf.text(money(note.subtotal_ex_gst), totalsValueX, y, { align: 'right' });
    y += 6;
    pdf.text('GST reversed', totalsX, y);
    pdf.text(money(note.gst_amount), totalsValueX, y, { align: 'right' });
    y += 7;
    pdf.setDrawColor(25, 25, 25);
    pdf.setLineWidth(0.4);
    pdf.line(totalsX, y - 4, totalsValueX, y - 4);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('CREDIT NOTE TOTAL', totalsX, y + 3);
    pdf.text(money(note.total_amount), totalsValueX, y + 3, { align: 'right' });

    // Return and settlement details
    y += 20;
    if (y > pageHeight - 55) {
      addFooter(pdf.getNumberOfPages());
      pdf.addPage();
      addPageHeader();
      y = 35;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(90, 90, 90);
    pdf.text('RETURN / SETTLEMENT DETAILS', margin, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(30, 30, 30);
    pdf.text(`Reason: ${String(note.reason || 'Customer return')}`, margin, y);
    y += 6;
    pdf.text(`Settlement: ${String(note.settlement_method || 'invoice_adjustment').replace(/_/g, ' ')}`, margin, y);
    if (note.remarks) {
      y += 6;
      const remarkLines = pdf.splitTextToSize(`Remarks: ${String(note.remarks)}`, contentWidth);
      pdf.text(remarkLines, margin, y);
      y += Math.max(5, remarkLines.length * 4.2);
    }

    if (isVoid && note.cancellation_reason) {
      y += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Cancellation reason:', margin, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(String(note.cancellation_reason), margin + 33, y);
    }

    if (isVoid) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.setTextColor(70, 70, 70);
      pdf.text('CANCELLED', pageWidth - margin, 58, { align: 'right' });
    }

    addFooter(pdf.getNumberOfPages());
    return { pdf, items: itemRows };
  };

  const handlePreviewCreditNote = async (note) => {
    if (!note?.id) return;
    setCreditNotePdfLoading(note.id);
    try {
      if (creditNotePreview?.url) URL.revokeObjectURL(creditNotePreview.url);
      const { pdf, items } = await buildCreditNotePdf(note);
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      setCreditNotePreview({ note, items, url, blob });
    } catch (error) {
      console.error('Credit note PDF preview failed:', error);
      alert(error?.message || 'Unable to preview the credit note PDF.');
    } finally {
      setCreditNotePdfLoading(null);
    }
  };

  const handleDownloadCreditNote = async () => {
    if (!creditNotePreview?.note) return;
    setCreditNotePdfLoading(creditNotePreview.note.id);
    try {
      let blob = creditNotePreview.blob;
      if (!blob) {
        const { pdf } = await buildCreditNotePdf(creditNotePreview.note);
        blob = pdf.output('blob');
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${creditNotePreview.note.credit_note_number || 'credit-note'}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Credit note PDF download failed:', error);
      alert(error?.message || 'Unable to download the credit note PDF.');
    } finally {
      setCreditNotePdfLoading(null);
    }
  };

  const closeCreditNotePreview = () => {
    if (creditNotePreview?.url) URL.revokeObjectURL(creditNotePreview.url);
    setCreditNotePreview(null);
  };

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

        const rows = (Array.isArray(data) ? data : []).map((row) => {
          // Lock the invoice amount to the same 2-decimal value that is
          // displayed on the customer's invoice before doing ANY monthly
          // aggregation. This prevents hidden 3dp/4dp values from leaking
          // into the statement total.
          const displayCents = toDisplayedCents(row.total);
          const displayTotal = displayCents / 100;

          return {
          id: row.invoice_id,
          number: row.invoice_number,
          date: row.invoice_date,
          customerId: row.customer_id,
          customer: row.customer_name,
          // `total` is deliberately the displayed 2dp invoice amount.
          // Do not use the raw database total for statement calculations.
          total: displayTotal,
          displayCents,
          status: row.status || 'Paid',
          statementCustomer: {
            id: row.customer_id,
            name: row.customer_name,
            address: row.customer_address || '',
            payment_terms: row.payment_terms || '30_days',
          },
        };
        });

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

  // ==========================================
  // PRODUCT SALES INTELLIGENCE DATA ENGINE
  // ==========================================
  // This is intentionally a separate RPC from billing_statement_rows.
  // Expected RPC contract: billing_product_sales_rows(p_start_date, p_end_date)
  // returning invoice/product/customer line-level data. The mapper below
  // accepts common field aliases so minor backend naming differences do not
  // require a UI rewrite. Missing product-cost data is treated as unavailable
  // rather than guessed.
  useEffect(() => {
    let cancelled = false;

    const loadProductSales = async () => {
      setProductAnalyticsLoading(true);
      setProductAnalyticsError(null);

      try {
        const { startDate, endDate } = getStatementMonthBounds(selectedMonth);
        const { data, error } = await supabase.rpc('billing_product_sales_rows', {
          p_start_date: startDate,
          p_end_date: endDate,
        });

        if (error) throw error;

        if (!cancelled) {
          setProductSalesRows(Array.isArray(data) ? data : []);
          setSelectedProductKey(null);
        }
      } catch (error) {
        console.warn(
          'Product sales analytics is unavailable. Existing billing statements remain unaffected.',
          error
        );

        if (!cancelled) {
          setProductSalesRows([]);
          setProductAnalyticsError(
            error?.message ||
              'Product analytics is not connected yet. Create the billing_product_sales_rows RPC to enable it.'
          );
        }
      } finally {
        if (!cancelled) setProductAnalyticsLoading(false);
      }
    };

    loadProductSales();

    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  const productAnalytics = useMemo(() => {
    const number = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };

    const first = (row, keys, fallback = null) => {
      for (const key of keys) {
        if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') {
          return row[key];
        }
      }
      return fallback;
    };

    const normalized = productSalesRows.map((row, index) => {
      const quantity = number(first(row, ['quantity', 'qty', 'units', 'unit_quantity']));
      const unitPrice = number(first(row, ['unit_price', 'selling_price', 'price', 'sale_price']));
      const sales = number(first(row, ['sales_amount', 'line_total', 'total', 'revenue', 'amount'], quantity * unitPrice));
      const unitCostRaw = first(row, ['unit_cost', 'cost_price', 'purchase_price', 'cost_per_unit']);
      const costAmountRaw = first(row, ['cost_amount', 'cogs', 'cost_of_goods_sold']);
      const unitCost = unitCostRaw === null ? null : number(unitCostRaw);
      const costAmount = costAmountRaw === null
        ? (unitCostRaw === null ? null : quantity * unitCost)
        : number(costAmountRaw);
      const grossProfit = costAmount === null ? null : sales - costAmount;
      const productId = String(first(row, ['product_id', 'product_uuid', 'item_id', 'sku', 'product_sku'], `row-${index}`));
      const productName = String(first(row, ['product_name', 'item_name', 'name', 'description'], 'Unnamed Product'));
      const customerId = String(first(row, ['customer_id', 'customer_uuid'], 'unknown'));
      const customerName = String(first(row, ['customer_name', 'customer', 'customer_entity'], 'Unknown Customer'));
      const category = String(first(row, ['category', 'product_category', 'category_name'], 'Uncategorised'));
      const sku = String(first(row, ['sku', 'product_sku', 'item_sku'], ''));

      return {
        ...row,
        productId,
        productName,
        customerId,
        customerName,
        category,
        sku,
        quantity,
        unitPrice,
        sales,
        unitCost,
        costAmount,
        grossProfit,
        hasKnownCost: costAmount !== null,
        invoiceId: first(row, ['invoice_id', 'invoice_uuid']),
        invoiceNumber: first(row, ['invoice_number', 'invoice_no', 'invoice']),
      };
    });

    const productMap = new Map();
    normalized.forEach((line) => {
      const key = line.productId || line.productName;
      if (!productMap.has(key)) {
        productMap.set(key, {
          key,
          productId: line.productId,
          productName: line.productName,
          category: line.category,
          sku: line.sku,
          units: 0,
          sales: 0,
          cost: 0,
          costKnown: true,
          profit: null,
          customers: new Map(),
          invoiceIds: new Set(),
        });
      }

      const product = productMap.get(key);
      product.units += line.quantity;
      product.sales += line.sales;
      if (line.costAmount !== null) {
        product.cost += line.costAmount;
      } else {
        product.costKnown = false;
      }
      product.profit = product.costKnown ? product.sales - product.cost : null;
      if (line.customerId) {
        if (!product.customers.has(line.customerId)) {
          product.customers.set(line.customerId, {
            customerId: line.customerId,
            customerName: line.customerName,
            units: 0,
            sales: 0,
          });
        }
        const customer = product.customers.get(line.customerId);
        customer.units += line.quantity;
        customer.sales += line.sales;
      }
      if (line.invoiceId) product.invoiceIds.add(line.invoiceId);
    });

    const products = Array.from(productMap.values()).map((product) => ({
      ...product,
      margin: !product.costKnown || product.sales === 0 ? null : (product.profit / product.sales) * 100,
      contribution: 0,
      customerList: Array.from(product.customers.values()).sort((a, b) => b.sales - a.sales),
      invoiceCount: product.invoiceIds.size,
    }));

    const totalSales = products.reduce((sum, p) => sum + p.sales, 0);
    const totalUnits = products.reduce((sum, p) => sum + p.units, 0);
    const productsWithCost = products.filter((p) => p.costKnown);
    const totalCost = products.length > 0 && productsWithCost.length === products.length
      ? products.reduce((sum, p) => sum + p.cost, 0)
      : null;
    const totalProfit = totalCost === null ? null : totalSales - totalCost;

    products.forEach((p) => {
      p.contribution = totalSales > 0 ? (p.sales / totalSales) * 100 : 0;
      p.topCustomerShare = p.sales > 0 && p.customerList[0]
        ? (p.customerList[0].sales / p.sales) * 100
        : 0;
    });

    const filteredProducts = products.filter((product) => {
      const search = productSearchTerm.trim().toLowerCase();
      const matchesSearch = !search ||
        product.productName.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search);
      const matchesCustomer = productCustomerFilter === 'All' ||
        product.customerList.some((customer) => customer.customerId === productCustomerFilter);
      return matchesSearch && matchesCustomer;
    });

    const metricValue = (p) => {
      if (productRankingMetric === 'units') return p.units;
      if (productRankingMetric === 'profit') return p.profit ?? -Infinity;
      if (productRankingMetric === 'margin') return p.margin ?? -Infinity;
      return p.sales;
    };

    const rankedProducts = [...filteredProducts].sort((a, b) => metricValue(b) - metricValue(a));
    const topN = productTopN === 'all' ? rankedProducts.length : Number(productTopN);
    const topProducts = rankedProducts.slice(0, Number.isFinite(topN) ? topN : 20);

    const customers = Array.from(
      new Map(normalized.map((line) => [line.customerId, { customerId: line.customerId, customerName: line.customerName }])).values()
    ).sort((a, b) => a.customerName.localeCompare(b.customerName));

    const selectedProduct = products.find((p) => p.key === selectedProductKey) || topProducts[0] || null;

    return {
      products,
      topProducts,
      totalSales,
      totalUnits,
      totalCost,
      totalProfit,
      grossMargin: totalSales > 0 && totalProfit !== null ? (totalProfit / totalSales) * 100 : null,
      customers,
      selectedProduct,
      hasRows: normalized.length > 0,
      hasCostData: products.length > 0 && products.every((p) => p.costKnown),
    };
  }, [productSalesRows, productSearchTerm, productRankingMetric, productCustomerFilter, productTopN, selectedProductKey]);

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
      const invoiceCents = Number.isInteger(inv.displayCents)
        ? inv.displayCents
        : toDisplayedCents(inv.total);

      row.invoices.push(inv);

      // Every invoice contributes only its customer-visible 2dp amount.
      // Therefore the customer total can never differ by 1 cent because of
      // hidden 3dp/4dp arithmetic.
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
                            const billedCents = Number.isInteger(inv.displayCents)
                              ? inv.displayCents
                              : toDisplayedCents(inv.total);

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
                                  $${formatStatementCents(billedCents)}
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
                                $${formatStatementCents(
                                  data.invoices.reduce(
                                    (sum, invoice) =>
                                      sum +
                                      (Number.isInteger(invoice.displayCents)
                                        ? invoice.displayCents
                                        : toDisplayedCents(invoice.total)),
                                    0
                                  )
                                )}
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

  if (billingView === 'credit-notes') {
    return (
      <div className="tl-module-page relative h-full overflow-y-auto bg-transparent p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="tl-page-header mb-5">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm">
                  <Receipt size={18} />
                </div>
                <div>
                  <h1 className="tl-page-header__title">Credit Notes</h1>
                  <p className="tl-page-header__subtitle">Customer returns, credits and refunds issued during the selected billing period</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setBillingView('statements')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                <FileText size={15} /> Statements
              </button>
              <button type="button" onClick={() => setCreditNoteRefreshKey((value) => value + 1)} disabled={creditNotesLoading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={15} className={creditNotesLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Billing Period</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Filter credit notes by the month they were issued</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">From</span>
                  <input type="month" value={creditNoteFromMonth} onChange={(event) => setCreditNoteFromMonth(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">To</span>
                  <input type="month" value={creditNoteToMonth} min={creditNoteFromMonth} onChange={(event) => setCreditNoteToMonth(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none" />
                </label>
                <button type="button" onClick={() => { const d = new Date(); const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; setCreditNoteFromMonth(m); setCreditNoteToMonth(m); }} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">This Month</button>
              </div>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:grid-cols-4">
            <div className="border-b border-slate-200 px-5 py-5 md:border-b-0 md:border-r">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Returns / Credit Notes</p>
              <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.025em] text-slate-950 tabular-nums">{formatDashboardInteger(creditNoteSummary.count)}</p>
            </div>
            <div className="border-b border-slate-200 px-5 py-5 md:border-b-0 md:border-r">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Credit Value</p>
              <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.025em] text-slate-950 tabular-nums">{formatDashboardMoney(creditNoteSummary.total)}</p>
            </div>
            <div className="border-b border-slate-200 px-5 py-5 md:border-b-0 md:border-r">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">GST Reversed</p>
              <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.025em] text-slate-950 tabular-nums">{formatDashboardMoney(creditNoteSummary.gst)}</p>
            </div>
            <div className="px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pending Settlement</p>
              <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.025em] text-slate-950 tabular-nums">{formatDashboardMoney(creditNoteSummary.pending)}</p>
            </div>
          </div>

          <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Monthly Credit Note Summary</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">A month-by-month view of customer returns within the selected billing period.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <tr><th className="px-5 py-3">Month</th><th className="px-4 py-3 text-right">Returns</th><th className="px-4 py-3 text-right">Credit Value</th><th className="px-5 py-3 text-right">GST Reversed</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creditNoteMonthlySummary.length === 0 ? (
                    <tr><td colSpan="4" className="px-5 py-8 text-center text-xs text-slate-400">No credit notes in the selected period.</td></tr>
                  ) : creditNoteMonthlySummary.map((row) => (
                    <tr key={row.month}>
                      <td className="px-5 py-3 font-semibold text-slate-800">{formatCreditNoteMonth(row.month)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{formatDashboardInteger(row.count)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatDashboardMoney(row.total)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">{formatDashboardMoney(row.gst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 md:max-w-md">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input value={creditNoteSearch} onChange={(event) => setCreditNoteSearch(event.target.value)} placeholder="Search credit note, customer or invoice…" className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              <select value={creditNoteStatus} onChange={(event) => setCreditNoteStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none">
                <option value="All">All statuses</option>
                <option value="issued">Issued</option>
                <option value="void">Cancelled</option>
              </select>
            </div>
          </div>

          {creditNotesError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              <div className="flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Credit Notes could not be loaded</p><p className="mt-1">{creditNotesError}</p></div></div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div><h2 className="text-sm font-semibold text-slate-900">Issued Credit Notes</h2><p className="mt-0.5 text-[11px] text-slate-500">Billing records for the selected period. Download the credit note PDF to send to the customer.</p></div>
              <span className="text-[11px] font-medium text-slate-400">{formatDashboardInteger(filteredCreditNotes.length)} records</span>
            </div>

            {creditNotesLoading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-14 text-xs text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading credit notes from Supabase…</div>
            ) : filteredCreditNotes.length === 0 ? (
              <div className="px-5 py-14 text-center"><Receipt size={24} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No credit notes found</p><p className="mt-1 text-xs text-slate-400">Issued credit notes will appear here automatically.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <tr><th className="whitespace-nowrap px-5 py-3">Credit Note</th><th className="whitespace-nowrap px-4 py-3">Date</th><th className="px-4 py-3">Customer</th><th className="whitespace-nowrap px-4 py-3">Original Invoice</th><th className="px-4 py-3">Reason</th><th className="whitespace-nowrap px-4 py-3 text-right">Credit Amount</th><th className="whitespace-nowrap px-4 py-3">Settlement</th><th className="whitespace-nowrap px-4 py-3">Status</th><th className="whitespace-nowrap px-5 py-3 text-right">PDF</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCreditNotes.map((note) => {
                      const isVoid = String(note.status || '').toLowerCase() === 'void';
                      const settlement = String(note.settlement_method || 'invoice_adjustment').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
                      return (
                        <tr key={note.id} className={`hover:bg-slate-50/70 ${isVoid ? 'opacity-60' : ''}`}>
                          <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-slate-900">{note.credit_note_number || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{note.credit_note_date || '—'}</td>
                          <td className="max-w-[240px] truncate px-4 py-3.5 font-medium text-slate-800">{note.customer_name || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-700">{note.invoice_number || '—'}</td>
                          <td className="max-w-[240px] truncate px-4 py-3.5 text-slate-600">{note.reason || 'Customer return'}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">{formatDashboardMoney(note.total_amount)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{settlement}</td>
                          <td className="whitespace-nowrap px-4 py-3.5"><span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700">{isVoid ? 'Cancelled' : 'Issued'}</span></td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <button type="button" onClick={() => handlePreviewCreditNote(note)} disabled={creditNotePdfLoading === note.id} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50" title="Preview credit note PDF">
                              {creditNotePdfLoading === note.id ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} Preview
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      {creditNotePreview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Credit note PDF preview">
          <div className="flex h-[94vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Credit Note Preview</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{creditNotePreview.note.credit_note_number || 'Credit Note'} · {creditNotePreview.note.customer_name || 'Customer'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={handleDownloadCreditNote} disabled={creditNotePdfLoading === creditNotePreview.note.id} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                  {creditNotePdfLoading === creditNotePreview.note.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Download PDF
                </button>
                <button type="button" onClick={closeCreditNotePreview} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Close preview">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100 p-4">
              <iframe title={`Credit note preview ${creditNotePreview.note.credit_note_number || ''}`} src={creditNotePreview.url} className="h-full w-full rounded-md border border-slate-300 bg-white shadow-sm" />
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  return (
    <div className="tl-module-page relative h-full overflow-y-auto bg-transparent p-8">
      {/* Invisible preloads */}
      <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
        <img src={logo} alt="preload logo" />
        <img src={paynowQr} alt="preload qr" />
      </div>

      {/* DASHBOARD SCREEN UI */}
      <div id="screen-ui" className="tl-screen-section">
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
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              onClick={() => setBillingView('credit-notes')}
              type="button"
              title="View all issued customer credit notes"
            >
              <Receipt className="mr-2" size={15} />
              Credit Notes
            </button>

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

        {/* ================================================================
            PRODUCT SALES INTELLIGENCE
            Isolated from statement rendering so existing billing/printing
            functionality remains unchanged.
        ================================================================ */}
        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-white px-5 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-semibold tracking-tight text-slate-900">Product Sales Intelligence</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Product contribution, customer demand and profitability for {displayMonth}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex h-9 min-w-[230px] items-center rounded-lg border border-slate-200 bg-white px-3">
                  <Search size={15} className="mr-2 shrink-0 text-slate-400" />
                  <input
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    placeholder="Search product or SKU…"
                    className="w-full border-none bg-transparent text-xs outline-none placeholder:text-slate-400 focus:ring-0"
                  />
                </div>
                <select
                  value={productRankingMetric}
                  onChange={(e) => setProductRankingMetric(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="sales">Rank by Sales</option>
                  <option value="units">Rank by Units</option>
                  <option value="profit">Rank by Gross Profit</option>
                  <option value="margin">Rank by Margin</option>
                </select>
                <select
                  value={productTopN}
                  onChange={(e) => setProductTopN(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="10">Top 10</option>
                  <option value="20">Top 20</option>
                  <option value="50">Top 50</option>
                  <option value="all">All Products</option>
                </select>
              </div>
            </div>
          </div>

          {productAnalyticsLoading ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center border-b border-slate-200">
              <Loader2 size={22} className="mb-3 animate-spin text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">Loading product sales</p>
              <p className="mt-1 text-xs text-slate-400">Reading product-level invoice data for {displayMonth}</p>
            </div>
          ) : productAnalyticsError && !productAnalytics.hasRows ? (
            <div className="m-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
              <div className="flex gap-3">
                <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Product analytics is not connected yet</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Your existing customer billing remains fully functional. Product analytics will appear once the Supabase <span className="font-mono font-semibold">billing_product_sales_rows</span> RPC is connected to your invoice line-item and product-cost data. No product figures are estimated.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 divide-y divide-slate-200 border-b border-slate-200 md:grid-cols-5 md:divide-x md:divide-y-0">
                {[
                  ['Products Sold', formatDashboardInteger(productAnalytics.products.length), Package],
                  ['Units Sold', formatDashboardInteger(productAnalytics.totalUnits), Target],
                  ['Product Sales', formatDashboardMoney(productAnalytics.totalSales), DollarSign],
                  ['Gross Profit', productAnalytics.totalProfit === null ? '—' : formatDashboardMoney(productAnalytics.totalProfit), TrendingUp],
                  ['Gross Margin', productAnalytics.grossMargin === null ? '—' : `${productAnalytics.grossMargin.toFixed(1)}%`, Percent],
                ].map(([label, value, Icon]) => (
                  <div key={label} className="min-w-0 px-5 py-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
                      <Icon size={14} className="text-slate-400" />
                    </div>
                    <div className="text-[22px] font-semibold tracking-tight text-slate-950" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                  </div>
                ))}
              </div>

              {!productAnalytics.hasCostData && productAnalytics.hasRows && (
                <div className="border-b border-amber-100 bg-amber-50/70 px-5 py-2.5 text-[11px] text-amber-800">
                  <span className="font-semibold">Profitability note:</span> product sales and contribution are available, but gross profit/margin are shown only where reliable product cost data is supplied. No cost is inferred from selling price.
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">
                <div className="min-w-0 border-b border-slate-200 xl:border-b-0 xl:border-r">
                  <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Top Products</h3>
                      <p className="mt-0.5 text-[11px] text-slate-400">Ranked products for the selected month</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <UsersRound size={14} className="text-slate-400" />
                      <select
                        value={productCustomerFilter}
                        onChange={(e) => setProductCustomerFilter(e.target.value)}
                        className="max-w-[210px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 outline-none"
                      >
                        <option value="All">All Customers</option>
                        {productAnalytics.customers.map((customer) => (
                          <option key={customer.customerId} value={customer.customerId}>{customer.customerName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] border-collapse text-left" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          <th className="w-10 px-4 py-3 text-center">#</th>
                          <th className="px-3 py-3">Product</th>
                          <th className="px-3 py-3 text-right">Units</th>
                          <th className="px-3 py-3 text-right">Sales</th>
                          <th className="px-3 py-3 text-right">Share</th>
                          <th className="px-3 py-3 text-right">Profit</th>
                          <th className="px-3 py-3 text-right">Margin</th>
                          <th className="px-4 py-3 text-right">Top Customer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {productAnalytics.topProducts.map((product, index) => {
                          const isSelected = product.key === productAnalytics.selectedProduct?.key;
                          return (
                            <tr
                              key={product.key}
                              onClick={() => setSelectedProductKey(product.key)}
                              className={`cursor-pointer transition-colors ${isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/70'}`}
                            >
                              <td className="px-4 py-3 text-center font-semibold text-slate-400">{index + 1}</td>
                              <td className="px-3 py-3">
                                <div className="font-semibold text-slate-800">{product.productName}</div>
                                <div className="mt-0.5 text-[10px] text-slate-400">{product.sku || product.category}</div>
                              </td>
                              <td className="px-3 py-3 text-right font-medium text-slate-700">{formatDashboardInteger(product.units)}</td>
                              <td className="px-3 py-3 text-right font-semibold text-slate-950">{formatDashboardMoney(product.sales)}</td>
                              <td className="px-3 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-slate-100 sm:block"><div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.min(product.contribution, 100)}%` }} /></div>
                                  <span className="font-semibold text-slate-700">{product.contribution.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-semibold">{product.profit === null ? '—' : formatDashboardMoney(product.profit)}</td>
                              <td className="px-3 py-3 text-right">{product.margin === null ? '—' : `${product.margin.toFixed(1)}%`}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="font-medium text-slate-700">{product.customerList[0]?.customerName || '—'}</div>
                                {product.customerList[0] && <div className="mt-0.5 text-[10px] text-slate-400">{product.topCustomerShare.toFixed(1)}% of product sales</div>}
                              </td>
                            </tr>
                          );
                        })}
                        {productAnalytics.topProducts.length === 0 && (
                          <tr><td colSpan="8" className="px-6 py-12 text-center text-sm text-slate-400">No product records match the current filters.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <aside className="min-w-0 bg-slate-50/40">
                  {productAnalytics.selectedProduct ? (
                    <div>
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Selected Product</p>
                          <h3 className="mt-1 truncate text-[15px] font-semibold text-slate-900">{productAnalytics.selectedProduct.productName}</h3>
                          <p className="mt-0.5 text-[10px] text-slate-400">{productAnalytics.selectedProduct.sku || productAnalytics.selectedProduct.category}</p>
                        </div>
                        <button type="button" onClick={() => setSelectedProductKey(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Clear selected product"><X size={15} /></button>
                      </div>

                      <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200">
                        <div className="bg-white px-4 py-3"><div className="text-[9px] uppercase tracking-widest text-slate-400">Sales</div><div className="mt-1 text-base font-semibold text-slate-900">{formatDashboardMoney(productAnalytics.selectedProduct.sales)}</div></div>
                        <div className="bg-white px-4 py-3"><div className="text-[9px] uppercase tracking-widest text-slate-400">Units</div><div className="mt-1 text-base font-semibold text-slate-900">{formatDashboardInteger(productAnalytics.selectedProduct.units)}</div></div>
                        <div className="bg-white px-4 py-3"><div className="text-[9px] uppercase tracking-widest text-slate-400">Contribution</div><div className="mt-1 text-base font-semibold text-slate-900">{productAnalytics.selectedProduct.contribution.toFixed(1)}%</div></div>
                        <div className="bg-white px-4 py-3"><div className="text-[9px] uppercase tracking-widest text-slate-400">Margin</div><div className="mt-1 text-base font-semibold text-slate-900">{productAnalytics.selectedProduct.margin === null ? '—' : `${productAnalytics.selectedProduct.margin.toFixed(1)}%`}</div></div>
                      </div>

                      <div className="border-b border-slate-200 px-5 py-4">
                        <div className="flex items-center justify-between">
                          <div><h4 className="text-xs font-semibold text-slate-900">Top Customers</h4><p className="mt-0.5 text-[10px] text-slate-400">Customers driving this product's sales</p></div>
                          <UsersRound size={14} className="text-slate-400" />
                        </div>
                        <div className="mt-3 space-y-2.5">
                          {productAnalytics.selectedProduct.customerList.slice(0, 8).map((customer) => {
                            const share = productAnalytics.selectedProduct.sales > 0 ? customer.sales / productAnalytics.selectedProduct.sales * 100 : 0;
                            return (
                              <div key={customer.customerId}>
                                <div className="flex items-center justify-between gap-3 text-[11px]">
                                  <span className="min-w-0 truncate font-medium text-slate-700">{customer.customerName}</span>
                                  <span className="shrink-0 font-semibold text-slate-800">{formatDashboardMoney(customer.sales)}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-slate-600" style={{ width: `${Math.min(share, 100)}%` }} /></div><span className="w-10 text-right text-[9px] text-slate-400">{share.toFixed(1)}%</span></div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="px-5 py-4">
                        <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Invoices containing product</span><span className="font-semibold text-slate-800">{formatDashboardInteger(productAnalytics.selectedProduct.invoiceCount)}</span></div>
                        <div className="mt-2 flex items-center justify-between text-[11px]"><span className="text-slate-500">Top customer concentration</span><span className="font-semibold text-slate-800">{productAnalytics.selectedProduct.topCustomerShare.toFixed(1)}%</span></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[300px] items-center justify-center px-8 text-center"><div><Package size={24} className="mx-auto mb-2 text-slate-300" /><p className="text-sm font-semibold text-slate-700">Select a product</p><p className="mt-1 text-xs leading-5 text-slate-400">Choose a row to inspect its customer mix and contribution.</p></div></div>
                  )}
                </aside>
              </div>

              <div className="border-t border-slate-200 px-5 py-5">
                <div className="mb-4 flex items-center justify-between">
                  <div><h3 className="text-sm font-semibold text-slate-900">Product Performance</h3><p className="mt-0.5 text-[11px] text-slate-400">Sales volume versus gross margin. Each point represents a product.</p></div>
                  <ArrowUpDown size={15} className="text-slate-400" />
                </div>
                <div className="relative mb-4 h-[280px] overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="absolute inset-x-12 bottom-10 top-5 border-b border-l border-slate-200">
                    {productAnalytics.products.filter((p) => p.margin !== null).slice(0, 80).map((product) => {
                      const maxSales = Math.max(...productAnalytics.products.map((p) => p.sales), 1);
                      const x = Math.min(98, Math.max(2, (product.sales / maxSales) * 100));
                      const y = Math.min(98, Math.max(2, product.margin));
                      return (
                        <button
                          key={`point-${product.key}`}
                          type="button"
                          title={`${product.productName}: ${formatDashboardMoney(product.sales)} sales, ${product.margin.toFixed(1)}% margin`}
                          onClick={() => setSelectedProductKey(product.key)}
                          className="absolute h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-slate-700 shadow-sm transition-transform hover:scale-150"
                          style={{ left: `${x}%`, bottom: `${y}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Monthly Sales →</div>
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Gross Margin →</div>
                  <div className="absolute right-3 top-2 text-[9px] text-slate-400">Higher margin</div>
                  <div className="absolute bottom-12 right-3 text-[9px] text-slate-400">Higher sales</div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['High sales / high margin', productAnalytics.products.filter(p => p.sales >= productAnalytics.totalSales / Math.max(productAnalytics.products.length, 1) && (p.margin ?? 0) >= 25).length],
                    ['High sales / low margin', productAnalytics.products.filter(p => p.sales >= productAnalytics.totalSales / Math.max(productAnalytics.products.length, 1) && p.margin !== null && p.margin < 25).length],
                    ['Lower sales / high margin', productAnalytics.products.filter(p => p.sales < productAnalytics.totalSales / Math.max(productAnalytics.products.length, 1) && (p.margin ?? 0) >= 25).length],
                    ['Lower sales / low margin', productAnalytics.products.filter(p => p.sales < productAnalytics.totalSales / Math.max(productAnalytics.products.length, 1) && p.margin !== null && p.margin < 25).length],
                  ].map(([label, count]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</div><div className="mt-1 text-lg font-semibold text-slate-900">{count}</div><div className="mt-0.5 text-[10px] text-slate-400">products</div></div>
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[11px] leading-5 text-slate-500">
                  The four-quadrant summary uses the average product sales level as the sales divider and 25% gross margin as the reference point. It is a descriptive management view, not a profitability recommendation.
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/50 px-5 py-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Top Revenue Driver</p><p className="mt-1 text-xs font-semibold text-slate-800">{productAnalytics.products.slice().sort((a,b) => b.sales-a.sales)[0]?.productName || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{productAnalytics.products[0] ? `${formatDashboardMoney(productAnalytics.products.slice().sort((a,b) => b.sales-a.sales)[0].sales)} sales` : ''}</p></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Highest Volume</p><p className="mt-1 text-xs font-semibold text-slate-800">{productAnalytics.products.slice().sort((a,b) => b.units-a.units)[0]?.productName || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{productAnalytics.products[0] ? `${formatDashboardInteger(productAnalytics.products.slice().sort((a,b) => b.units-a.units)[0].units)} units` : ''}</p></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Highest Margin</p><p className="mt-1 text-xs font-semibold text-slate-800">{productAnalytics.products.filter(p => p.margin !== null).sort((a,b) => b.margin-a.margin)[0]?.productName || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{productAnalytics.products.filter(p => p.margin !== null).sort((a,b) => b.margin-a.margin)[0] ? `${productAnalytics.products.filter(p => p.margin !== null).sort((a,b) => b.margin-a.margin)[0].margin.toFixed(1)}% gross margin` : 'Cost data unavailable'}</p></div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* RENDER THE SECURE PRINT PORTAL OUTSIDE THE REACT ROOT */}
      {printTarget && createPortal(printContent, document.body)}
    </div>
  );
}
