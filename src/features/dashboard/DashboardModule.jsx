import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  MapPinned,
  Package,
  Receipt,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  WalletCards,
  Activity,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  Filter,
  Gauge,
  Map as MapIcon,
  SlidersHorizontal,
  Sparkles,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { ShortcutBtn } from '../../components/shared/ShortcutBtn';
import { supabase } from '../../lib/supabaseClient';
import { formatMoney } from '../../utils/format';
import { getTodayString } from '../../utils/date';

const LOW_STOCK_THRESHOLD = 20;
const CASH_FETCH_PAGE_SIZE = 1000;
const RECENT_TRANSACTION_LIMIT = 8;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getInvoiceDate(invoice) {
  return String(invoice?.date || '').trim();
}

function getInvoiceNumber(invoice) {
  return String(
    invoice?.number ||
      invoice?.invoiceNumber ||
      invoice?.invoice_number ||
      invoice?.id ||
      ''
  ).trim();
}

function getInvoiceCustomerName(invoice) {
  return String(
    invoice?.customer ||
      invoice?.customerName ||
      invoice?.customer_name ||
      invoice?.companyName ||
      invoice?.company_name ||
      'Unknown customer'
  ).trim();
}

function getInvoiceStatus(invoice) {
  return String(invoice?.status || 'Unpaid').trim();
}

function isPaid(invoice) {
  return getInvoiceStatus(invoice).toLowerCase() === 'paid';
}

function getInvoiceItems(invoice) {
  return Array.isArray(invoice?.items) ? invoice.items : [];
}

function getLineQty(item) {
  return toNumber(item?.qty ?? item?.quantity ?? 0);
}

function getLinePrice(item) {
  return toNumber(
    item?.unitPrice ??
      item?.unit_price ??
      item?.price ??
      item?.Price ??
      0
  );
}

function getStoredGstAmount(invoice) {
  const raw =
    invoice?.gst_amount ??
    invoice?.gstAmount ??
    invoice?.gst ??
    null;

  if (raw === null || raw === undefined || raw === '') {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function getSubtotalExGst(invoice) {
  const candidates = [
    invoice?.subtotal_ex_gst,
    invoice?.subtotalExGst,
    invoice?.subtotal,
  ];

  for (const candidate of candidates) {
    if (
      candidate !== null &&
      candidate !== undefined &&
      candidate !== '' &&
      Number.isFinite(Number(candidate))
    ) {
      return Number(candidate);
    }
  }

  const items = getInvoiceItems(invoice);

  if (items.length > 0) {
    return items.reduce(
      (sum, item) => sum + getLineQty(item) * getLinePrice(item),
      0
    );
  }

  const total = getInvoiceTotal(invoice);
  const gstAmount = getStoredGstAmount(invoice);

  if (gstAmount !== null && total >= gstAmount) {
    return total - gstAmount;
  }

  if (invoice?.includeGst === false) {
    return total;
  }

  if (invoice?.includeGst === true && total > 0) {
    return total / 1.09;
  }

  return total;
}

function getInvoiceGstAmount(invoice) {
  const stored = getStoredGstAmount(invoice);

  if (stored !== null) {
    return stored;
  }

  const total = getInvoiceTotal(invoice);
  const subtotal = getSubtotalExGstWithoutGstFallback(invoice);

  if (
    Number.isFinite(total) &&
    Number.isFinite(subtotal) &&
    total >= subtotal
  ) {
    const difference = total - subtotal;

    if (difference >= 0) {
      return difference;
    }
  }

  if (invoice?.includeGst === true && subtotal > 0) {
    return subtotal * 0.09;
  }

  return 0;
}

function getSubtotalExGstWithoutGstFallback(invoice) {
  const candidates = [
    invoice?.subtotal_ex_gst,
    invoice?.subtotalExGst,
    invoice?.subtotal,
  ];

  for (const candidate of candidates) {
    if (
      candidate !== null &&
      candidate !== undefined &&
      candidate !== '' &&
      Number.isFinite(Number(candidate))
    ) {
      return Number(candidate);
    }
  }

  const items = getInvoiceItems(invoice);

  if (items.length > 0) {
    return items.reduce(
      (sum, item) => sum + getLineQty(item) * getLinePrice(item),
      0
    );
  }

  return 0;
}

function getInvoiceTotal(invoice) {
  const candidates = [
    invoice?.total,
    invoice?.amount_total,
    invoice?.amountTotal,
  ];

  for (const candidate of candidates) {
    if (
      candidate !== null &&
      candidate !== undefined &&
      candidate !== '' &&
      Number.isFinite(Number(candidate))
    ) {
      return Number(candidate);
    }
  }

  const subtotal = getSubtotalExGstWithoutGstFallback(invoice);
  const gstAmount = getStoredGstAmount(invoice);

  if (gstAmount !== null) {
    return subtotal + gstAmount;
  }

  if (invoice?.includeGst === true) {
    return subtotal * 1.09;
  }

  return subtotal;
}

function getStoredProfit(invoice) {
  const raw = invoice?.gross_profit;

  if (
    raw === null ||
    raw === undefined ||
    raw === '' ||
    !Number.isFinite(Number(raw))
  ) {
    return null;
  }

  return Number(raw);
}

function getMissingCostCount(invoice) {
  const value = Number(invoice?.profit_missing_cost_count || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getProfitStatus(invoice) {
  const profit = getStoredProfit(invoice);
  const missingCostCount = getMissingCostCount(invoice);

  if (missingCostCount > 0) {
    return {
      profit: null,
      needsReview: true,
      missingCostCount,
    };
  }

  if (profit === null) {
    return {
      profit: null,
      needsReview: true,
      missingCostCount: 0,
    };
  }

  return {
    profit,
    needsReview: false,
    missingCostCount: 0,
  };
}

function getInventoryStock(item) {
  const candidates = [
    item?.stock,
    item?.Stock,
    item?.quantity,
    item?.qty,
    item?.current_stock,
    item?.currentStock,
  ];

  for (const candidate of candidates) {
    if (
      candidate !== null &&
      candidate !== undefined &&
      candidate !== '' &&
      Number.isFinite(Number(candidate))
    ) {
      return Number(candidate);
    }
  }

  return 0;
}

function getInventoryName(item) {
  return String(
    item?.Name ||
      item?.name ||
      item?.Items ||
      item?.item_name ||
      item?.description ||
      'Unnamed item'
  ).trim();
}

function getInventorySku(item) {
  return String(
    item?.SKU ||
      item?.sku ||
      item?.code ||
      item?.item_code ||
      ''
  ).trim();
}

function getInventoryUnit(item) {
  return String(item?.Unit || item?.unit || '').trim();
}

function normaliseLookupValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getCustomerName(customer) {
  return String(
    customer?.name ||
      customer?.companyName ||
      customer?.company_name ||
      customer?.customerName ||
      customer?.customer_name ||
      ''
  ).trim();
}

function getCustomerAddress(customer) {
  return String(
    customer?.address ||
      customer?.deliveryAddress ||
      customer?.delivery_address ||
      customer?.shippingAddress ||
      customer?.shipping_address ||
      ''
  ).trim();
}

function findCustomerForInvoice(invoice, customers) {
  const customerId =
    invoice?.customerId ??
    invoice?.customer_id ??
    invoice?.customerID ??
    null;

  if (
    customerId !== null &&
    customerId !== undefined &&
    customerId !== ''
  ) {
    const matchedById = customers.find(
      (customer) => String(customer?.id) === String(customerId)
    );

    if (matchedById) return matchedById;
  }

  const invoiceCustomerName = normaliseLookupValue(
    getInvoiceCustomerName(invoice)
  );

  if (!invoiceCustomerName) return null;

  return (
    customers.find(
      (customer) =>
        normaliseLookupValue(getCustomerName(customer)) ===
        invoiceCustomerName
    ) || null
  );
}

function getInvoiceAddress(invoice) {
  return String(
    invoice?.deliveryAddress ||
      invoice?.delivery_address ||
      invoice?.shippingAddress ||
      invoice?.shipping_address ||
      invoice?.customerAddress ||
      invoice?.customer_address ||
      invoice?.address ||
      ''
  ).trim();
}

function getDeliveryAddress(invoice, customer) {
  return getCustomerAddress(customer) || getInvoiceAddress(invoice);
}

function getDeliveryRegion(invoice, customer) {
  return String(customer?.region || invoice?.region || '').trim();
}

function formatDisplayDate(dateString) {
  const match = String(dateString || '').match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return String(dateString || '');

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );

  return new Intl.DateTimeFormat('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatMonthLabel(monthKey) {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);

  if (!match) return monthKey;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);

  return new Intl.DateTimeFormat('en-SG', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getNextMonthStart(monthKey) {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);

  if (!match) return '';

  const nextMonth = new Date(
    Number(match[1]),
    Number(match[2]),
    1
  );

  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}-01`;
}

function buildLedgerSummary(invoices) {
  return invoices.reduce(
    (summary, invoice) => {
      const subtotal = getSubtotalExGst(invoice);
      const total = getInvoiceTotal(invoice);
      const gst = getInvoiceGstAmount(invoice);
      const profitStatus = getProfitStatus(invoice);

      summary.subtotal += subtotal;
      summary.total += total;
      summary.gst += gst;
      summary.count += 1;

      if (isPaid(invoice)) {
        summary.paid += total;
        summary.paidCount += 1;
      } else {
        summary.outstanding += total;
        summary.unpaidCount += 1;
      }

      if (profitStatus.profit !== null) {
        summary.profit += profitStatus.profit;
        summary.profitCount += 1;
      }

      if (profitStatus.needsReview) {
        summary.costReviewCount += 1;
      }

      return summary;
    },
    {
      subtotal: 0,
      total: 0,
      gst: 0,
      paid: 0,
      outstanding: 0,
      profit: 0,
      count: 0,
      paidCount: 0,
      unpaidCount: 0,
      profitCount: 0,
      costReviewCount: 0,
    }
  );
}

function ExecutiveMetric({
  label,
  value,
  subtext,
  icon: Icon,
  tone = 'blue',
  onClick,
}) {
  const tones = {
    blue: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    violet: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
    rose: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`group relative min-h-[150px] overflow-hidden px-5 py-5 text-left transition ${
        onClick ? 'cursor-pointer hover:bg-white/[0.055]' : ''
      }`}
    >
      <div className="flex h-full items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>

          <p className="mt-3 break-words text-[28px] font-semibold tracking-[-0.03em] text-white">
            {value}
          </p>

          {subtext && (
            <p className="mt-2 max-w-[290px] text-[11px] leading-5 text-slate-400">
              {subtext}
            </p>
          )}
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            tones[tone] || tones.blue
          }`}
        >
          <Icon size={18} />
        </div>
      </div>

      {onClick && (
        <ArrowRight
          size={14}
          className="absolute bottom-4 right-5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300"
        />
      )}
    </Component>
  );
}

function SmallFinancialCard({
  label,
  value,
  subtext,
  icon: Icon,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 hover:bg-slate-50/70"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>

        <Icon
          size={15}
          className="shrink-0 text-slate-400 transition group-hover:text-slate-600"
        />
      </div>

      <p className="mt-2 text-[21px] font-semibold tracking-[-0.02em] text-slate-900">
        {value}
      </p>

      {subtext && (
        <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
          {subtext}
        </p>
      )}
    </button>
  );
}

function AttentionItem({
  icon: Icon,
  title,
  detail,
  tone = 'amber',
  actionLabel,
  onClick,
}) {
  const tones = {
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  };

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${
            tones[tone] || tones.amber
          }`}
        >
          <Icon size={16} />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      >
        {actionLabel}
        <ArrowRight size={12} className="ml-1.5" />
      </button>
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {eyebrow}
          </p>
        )}

        <h2 className="mt-1 text-lg font-semibold tracking-[-0.015em] text-slate-900">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function TransactionTypeBadge({ type }) {
  const isCash = type === 'Cash';

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${
        isCash
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'
      }`}
    >
      {type}
    </span>
  );
}

function WorkflowCard({
  eyebrow,
  title,
  value,
  detail,
  icon: Icon,
  tone = 'blue',
  onClick,
  children,
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-800">{title}</h3>
        </div>

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${
            tones[tone] || tones.blue
          }`}
        >
          <Icon size={16} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[28px] font-semibold tracking-[-0.03em] text-slate-900">
          {value}
        </p>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p>
      </div>

      {children}

      {onClick && (
        <button
          type="button"
          onClick={onClick}
          className="mt-4 inline-flex items-center text-[11px] font-semibold text-slate-600 transition hover:text-slate-900"
        >
          Open workflow
          <ArrowRight size={12} className="ml-1.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Operational ERP dashboard.
 *
 * Normal invoices come from sys.invoices.
 * Cash invoices are loaded directly from Supabase because Cash is intentionally
 * kept in its own cash_invoices ledger.
 */
export function DashboardModule({
  sys,
  setActiveTab,
  lowStockThreshold = LOW_STOCK_THRESHOLD,
}) {
  const [cashInvoices, setCashInvoices] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [inventoryMovements, setInventoryMovements] = useState([]);
  const [cashLoading, setCashLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [cashError, setCashError] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [period, setPeriod] = useState('30');
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [metric, setMetric] = useState('sales');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const customers = Array.isArray(sys?.customers) ? sys.customers : [];
  const invoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const inventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const users = Array.isArray(sys?.users) ? sys.users : [];

  const systemToday = getTodayString();
  const today = selectedDate || systemToday;
  const todayDate = useMemo(() => new Date(`${today}T00:00:00`), [today]);
  const periodDays = Number(period) || 30;
  const periodStart = useMemo(() => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - periodDays + 1);
    return d.toISOString().slice(0, 10);
  }, [todayDate, periodDays]);

  const monthKey = String(today || '').slice(0, 7);
  const monthStart = `${monthKey}-01`;
  const nextMonthStart = getNextMonthStart(monthKey);

  useEffect(() => {
    let cancelled = false;

    const loadDashboardSources = async () => {
      setCashLoading(true);
      setAnalyticsLoading(true);
      setCashError('');

      try {
        const cashPromise = supabase
          .from('cash_invoices')
          .select('*')
          .gte('date', periodStart)
          .lte('date', today)
          .order('date', { ascending: false })
          .limit(5000);

        const creditPromise = supabase
          .from('credit_notes')
          .select('*')
          .gte('created_at', `${periodStart}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`)
          .order('created_at', { ascending: false })
          .limit(5000);

        const movementPromise = supabase
          .from('inventory_movements')
          .select('*')
          .gte('movement_date', `${periodStart}T00:00:00`)
          .lte('movement_date', `${today}T23:59:59`)
          .order('movement_date', { ascending: false })
          .limit(10000);

        const [cashResult, creditResult, movementResult] = await Promise.all([
          cashPromise,
          creditPromise,
          movementPromise,
        ]);

        if (!cancelled) {
          if (cashResult.error) {
            setCashInvoices([]);
            setCashError(cashResult.error.message || 'Unable to load Cash data.');
          } else {
            setCashInvoices(Array.isArray(cashResult.data) ? cashResult.data : []);
          }

          setCreditNotes(
            creditResult.error || !Array.isArray(creditResult.data)
              ? []
              : creditResult.data
          );
          setInventoryMovements(
            movementResult.error || !Array.isArray(movementResult.data)
              ? []
              : movementResult.data
          );
        }
      } catch (error) {
        console.error('Failed to load dashboard intelligence sources:', error);
        if (!cancelled) {
          setCashInvoices([]);
          setCreditNotes([]);
          setInventoryMovements([]);
          setCashError(error instanceof Error ? error.message : 'Unable to load dashboard data.');
        }
      } finally {
        if (!cancelled) {
          setCashLoading(false);
          setAnalyticsLoading(false);
        }
      }
    };

    void loadDashboardSources();
    return () => { cancelled = true; };
  }, [periodStart, today, refreshNonce]);

  const intelligence = useMemo(() => {
    const normal = invoices.filter((i) => {
      const d = getInvoiceDate(i);
      return d >= periodStart && d <= today;
    });
    const cash = cashInvoices.filter((i) => {
      const d = getInvoiceDate(i);
      return d >= periodStart && d <= today;
    });
    const allTransactions = [
      ...normal.map((invoice) => ({ invoice, type: 'Invoice' })),
      ...cash.map((invoice) => ({ invoice, type: 'Cash' })),
    ];

    const filteredTransactions = allTransactions.filter(({ invoice }) => {
      const customer = findCustomerForInvoice(invoice, customers);
      const customerId = String(customer?.id ?? invoice?.customerId ?? invoice?.customer_id ?? '');
      const customerName = normaliseLookupValue(getInvoiceCustomerName(invoice));
      const productMatch = productFilter === 'all' || getInvoiceItems(invoice).some((item) => {
        const id = String(item?.productId ?? item?.product_id ?? item?.id ?? item?.sku ?? '');
        return id === productFilter;
      });
      const customerMatch = customerFilter === 'all' || customerId === customerFilter || customerName === normaliseLookupValue(customerFilter);
      return customerMatch && productMatch;
    });

    const summary = buildLedgerSummary(filteredTransactions.map((x) => x.invoice));
    const previousStartDate = new Date(`${periodStart}T00:00:00`);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);
    const previousStart = previousStartDate.toISOString().slice(0, 10);
    const previousEndDate = new Date(`${periodStart}T00:00:00`);
    previousEndDate.setDate(previousEndDate.getDate() - 1);
    const previousEnd = previousEndDate.toISOString().slice(0, 10);
    const previousTransactions = [
      ...invoices.filter((i) => getInvoiceDate(i) >= previousStart && getInvoiceDate(i) <= previousEnd),
      ...cashInvoices.filter((i) => getInvoiceDate(i) >= previousStart && getInvoiceDate(i) <= previousEnd),
    ];
    const previousSummary = buildLedgerSummary(previousTransactions);

    const salesChange = previousSummary.subtotal === 0
      ? null
      : ((summary.subtotal - previousSummary.subtotal) / Math.abs(previousSummary.subtotal)) * 100;
    const profitChange = previousSummary.profit === 0
      ? null
      : ((summary.profit - previousSummary.profit) / Math.abs(previousSummary.profit)) * 100;

    const dailyMap = new Map();
    for (let i = periodDays - 1; i >= 0; i -= 1) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { date: key, sales: 0, profit: 0, orders: 0, units: 0 });
    }

    filteredTransactions.forEach(({ invoice }) => {
      const key = getInvoiceDate(invoice);
      if (!dailyMap.has(key)) return;
      const row = dailyMap.get(key);
      row.sales += getSubtotalExGst(invoice);
      row.orders += 1;
      const profitStatus = getProfitStatus(invoice);
      if (profitStatus.profit !== null) row.profit += profitStatus.profit;
      row.units += getInvoiceItems(invoice).reduce((sum, item) => sum + getLineQty(item), 0);
    });

    const dailySeries = Array.from(dailyMap.values());
    const nonZeroSales = dailySeries.filter((d) => d.sales > 0);
    const mean = nonZeroSales.length
      ? nonZeroSales.reduce((s, d) => s + d.sales, 0) / nonZeroSales.length
      : 0;
    const variance = nonZeroSales.length > 1
      ? nonZeroSales.reduce((s, d) => s + ((d.sales - mean) ** 2), 0) / (nonZeroSales.length - 1)
      : 0;
    const stdDev = Math.sqrt(variance);

    const anomalies = dailySeries
      .filter((d) => stdDev > 0 && Math.abs((d.sales - mean) / stdDev) >= 2)
      .map((d) => ({ ...d, z: (d.sales - mean) / stdDev }));

    const recent = dailySeries.slice(-7);
    const recentMean = recent.length ? recent.reduce((s, d) => s + d.sales, 0) / recent.length : 0;
    const prior = dailySeries.slice(-14, -7);
    const priorMean = prior.length ? prior.reduce((s, d) => s + d.sales, 0) / prior.length : 0;
    const weeklyMomentum = priorMean === 0 ? null : ((recentMean - priorMean) / Math.abs(priorMean)) * 100;

    const regressionSource = dailySeries.map((d, index) => ({ x: index, y: d.sales }));
    const n = regressionSource.length;
    const sumX = regressionSource.reduce((s, p) => s + p.x, 0);
    const sumY = regressionSource.reduce((s, p) => s + p.y, 0);
    const sumXY = regressionSource.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = regressionSource.reduce((s, p) => s + p.x * p.x, 0);
    const denominator = n * sumXX - sumX * sumX;
    const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
    const intercept = n === 0 ? 0 : (sumY - slope * sumX) / n;
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const x = n + i;
      return Math.max(0, intercept + slope * x);
    });

    const customerMap = new Map();
    filteredTransactions.forEach(({ invoice }) => {
      const customer = findCustomerForInvoice(invoice, customers);
      const id = String(customer?.id ?? invoice?.customerId ?? invoice?.customer_id ?? getInvoiceCustomerName(invoice));
      const name = getCustomerName(customer) || getInvoiceCustomerName(invoice);
      if (!customerMap.has(id)) customerMap.set(id, { id, name, sales: 0, orders: 0, lastDate: '', profit: 0 });
      const row = customerMap.get(id);
      row.sales += getSubtotalExGst(invoice);
      row.orders += 1;
      row.lastDate = row.lastDate > getInvoiceDate(invoice) ? row.lastDate : getInvoiceDate(invoice);
      const ps = getProfitStatus(invoice);
      if (ps.profit !== null) row.profit += ps.profit;
    });

    const customerSignals = Array.from(customerMap.values()).map((c) => {
      const daysSince = c.lastDate ? Math.max(0, Math.round((todayDate - new Date(`${c.lastDate}T00:00:00`)) / 86400000)) : periodDays;
      const expectedGap = c.orders > 1 ? periodDays / c.orders : periodDays;
      const risk = Math.min(100, Math.round((daysSince / Math.max(expectedGap * 1.5, 7)) * 100));
      return { ...c, daysSince, expectedGap, risk: Math.max(0, risk) };
    }).sort((a, b) => b.sales - a.sales);

    const productMap = new Map();
    filteredTransactions.forEach(({ invoice }) => {
      getInvoiceItems(invoice).forEach((item) => {
        const id = String(item?.productId ?? item?.product_id ?? item?.id ?? item?.sku ?? item?.name ?? 'unknown');
        const name = String(item?.name ?? item?.productName ?? item?.product_name ?? item?.description ?? id);
        if (!productMap.has(id)) productMap.set(id, { id, name, units: 0, sales: 0, orders: 0 });
        const row = productMap.get(id);
        row.units += getLineQty(item);
        row.sales += getLineQty(item) * getLinePrice(item);
        row.orders += 1;
      });
    });

    const productPerformance = Array.from(productMap.values()).sort((a, b) => b.sales - a.sales);
    const totalProductSales = productPerformance.reduce((s, p) => s + p.sales, 0);
    let cumulative = 0;
    const abcProducts = productPerformance.map((p) => {
      cumulative += p.sales;
      const share = totalProductSales ? cumulative / totalProductSales : 0;
      return { ...p, abc: share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C' };
    });

    const lowStockItems = inventory
      .map((item) => ({ item, stock: getInventoryStock(item) }))
      .filter(({ stock }) => stock < lowStockThreshold)
      .sort((a, b) => a.stock - b.stock);

    const inventoryRisk = inventory.map((item) => {
      const name = getInventoryName(item);
      const id = String(item?.id ?? item?.SKU ?? item?.sku ?? name);
      const match = productPerformance.find((p) => normaliseLookupValue(p.name) === normaliseLookupValue(name) || String(p.id) === id || String(p.id) === String(item?.SKU ?? item?.sku ?? ''));
      const dailyDemand = match ? match.units / Math.max(periodDays, 1) : 0;
      const stock = getInventoryStock(item);
      const daysCover = dailyDemand > 0 ? stock / dailyDemand : Infinity;
      const risk = dailyDemand > 0 ? Math.max(0, Math.min(100, Math.round((1 - Math.min(daysCover / 30, 1)) * 100))) : (stock < lowStockThreshold ? 70 : 0);
      return { item, name, stock, dailyDemand, daysCover, risk, matchedSales: match?.sales ?? 0 };
    }).sort((a, b) => b.risk - a.risk);

    const regionMap = new Map();
    filteredTransactions.forEach(({ invoice }) => {
      const customer = findCustomerForInvoice(invoice, customers);
      const region = getDeliveryRegion(invoice, customer) || 'Unassigned';
      const row = regionMap.get(region) || { region, sales: 0, orders: 0 };
      row.sales += getSubtotalExGst(invoice);
      row.orders += 1;
      regionMap.set(region, row);
    });

    const regionPerformance = Array.from(regionMap.values()).sort((a, b) => b.sales - a.sales);
    const grossMargin = summary.subtotal ? (summary.profit / summary.subtotal) * 100 : 0;
    const collectionRate = summary.total ? (summary.paid / summary.total) * 100 : 0;
    const creditNoteValue = creditNotes.reduce((sum, cn) => sum + toNumber(cn?.total_amount ?? cn?.total ?? cn?.amount, 0), 0);
    const movementUnits = inventoryMovements.reduce((sum, m) => sum + Math.abs(toNumber(m?.quantity_change)), 0);

    const riskItems = [
      ...inventoryRisk.filter((x) => x.risk >= 70).slice(0, 5).map((x) => ({
        key: `stock-${x.name}`,
        severity: x.risk >= 90 ? 'critical' : 'warning',
        title: `${x.name} has elevated stockout risk`,
        detail: x.dailyDemand > 0 ? `${Math.max(0, Math.round(x.daysCover))} days of estimated cover at current demand.` : `Stock is below the ${lowStockThreshold}-unit threshold.`,
        action: 'Inventory',
        tab: 'inventory',
      })),
      ...customerSignals.filter((x) => x.risk >= 70).slice(0, 4).map((x) => ({
        key: `customer-${x.id}`,
        severity: x.risk >= 90 ? 'critical' : 'warning',
        title: `${x.name} is showing weaker purchase cadence`,
        detail: `${x.daysSince} days since last order versus an estimated ${Math.round(x.expectedGap)}-day cycle.`,
        action: 'Customers',
        tab: 'customers',
      })),
      ...anomalies.slice(-3).map((x) => ({
        key: `anomaly-${x.date}`,
        severity: Math.abs(x.z) >= 3 ? 'critical' : 'warning',
        title: `Sales anomaly detected on ${formatDisplayDate(x.date)}`,
        detail: `${x.z > 0 ? 'Above' : 'Below'} the recent statistical baseline by ${Math.abs(x.z).toFixed(1)} standard deviations.`,
        action: 'Invoices',
        tab: 'invoices',
      })),
    ].filter((item, index, arr) => arr.findIndex((x) => x.key === item.key) === index);

    return {
      normal,
      cash,
      filteredTransactions,
      summary,
      previousSummary,
      salesChange,
      profitChange,
      dailySeries,
      mean,
      stdDev,
      anomalies,
      weeklyMomentum,
      forecast,
      customerSignals,
      abcProducts,
      productPerformance,
      inventoryRisk,
      lowStockItems,
      regionPerformance,
      grossMargin,
      collectionRate,
      creditNoteValue,
      movementUnits,
      riskItems,
    };
  }, [
    cashInvoices,
    creditNotes,
    customers,
    invoices,
    inventory,
    inventoryMovements,
    lowStockThreshold,
    periodDays,
    periodStart,
    productFilter,
    customerFilter,
    today,
    todayDate,
  ]);

  const filteredRisks = intelligence.riskItems.filter((item) => {
    if (riskFilter === 'all') return true;
    return item.severity === riskFilter;
  });

  const customerOptions = useMemo(() => {
    return customers
      .map((c) => ({ id: String(c?.id ?? ''), name: getCustomerName(c) }))
      .filter((c) => c.id && c.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers]);

  const productOptions = useMemo(() => {
    const fromInventory = inventory.map((item) => ({
      id: String(item?.id ?? item?.SKU ?? item?.sku ?? ''),
      name: getInventoryName(item),
    }));
    return fromInventory.filter((p) => p.id && p.name).sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory]);

  const todayIntelligence = useMemo(() => {
    const all = [
      ...invoices.filter((i) => getInvoiceDate(i) === today).map((invoice) => ({ invoice, type: 'Invoice' })),
      ...cashInvoices.filter((i) => getInvoiceDate(i) === today).map((invoice) => ({ invoice, type: 'Cash' })),
    ];

    const lastWeekDateObj = new Date(`${today}T00:00:00`);
    lastWeekDateObj.setDate(lastWeekDateObj.getDate() - 7);
    const lastWeekDate = lastWeekDateObj.toISOString().slice(0, 10);
    const lastWeek = [
      ...invoices.filter((i) => getInvoiceDate(i) === lastWeekDate),
      ...cashInvoices.filter((i) => getInvoiceDate(i) === lastWeekDate),
    ];

    const sales = all.reduce((sum, x) => sum + getSubtotalExGst(x.invoice), 0);
    const lastWeekSales = lastWeek.reduce((sum, invoice) => sum + getSubtotalExGst(invoice), 0);
    const profit = all.reduce((sum, x) => {
      const status = getProfitStatus(x.invoice);
      return sum + (status.profit ?? 0);
    }, 0);
    const orders = all.length;
    const units = all.reduce((sum, x) => sum + getInvoiceItems(x.invoice).reduce((q, item) => q + getLineQty(item), 0), 0);
    const paid = all.filter((x) => isPaid(x.invoice)).reduce((sum, x) => sum + getInvoiceTotal(x.invoice), 0);
    const outstanding = all.reduce((sum, x) => sum + (isPaid(x.invoice) ? 0 : getInvoiceTotal(x.invoice)), 0);
    const change = lastWeekSales === 0 ? null : ((sales - lastWeekSales) / Math.abs(lastWeekSales)) * 100;

    const customerMap = new Map();
    const productMap = new Map();
    all.forEach(({ invoice }) => {
      const customer = findCustomerForInvoice(invoice, customers);
      const customerId = String(customer?.id ?? invoice?.customerId ?? invoice?.customer_id ?? getInvoiceCustomerName(invoice));
      const customerName = getCustomerName(customer) || getInvoiceCustomerName(invoice);
      const customerRow = customerMap.get(customerId) || { id: customerId, name: customerName, sales: 0, orders: 0 };
      customerRow.sales += getSubtotalExGst(invoice);
      customerRow.orders += 1;
      customerMap.set(customerId, customerRow);

      getInvoiceItems(invoice).forEach((item) => {
        const id = String(item?.productId ?? item?.product_id ?? item?.id ?? item?.sku ?? item?.name ?? 'unknown');
        const name = String(item?.name ?? item?.productName ?? item?.product_name ?? item?.description ?? id);
        const row = productMap.get(id) || { id, name, units: 0, sales: 0 };
        row.units += getLineQty(item);
        row.sales += getLineQty(item) * getLinePrice(item);
        productMap.set(id, row);
      });
    });

    return {
      transactions: all,
      sales,
      lastWeekSales,
      change,
      profit,
      orders,
      units,
      averageOrder: orders ? sales / orders : 0,
      margin: sales ? (profit / sales) * 100 : 0,
      paid,
      outstanding,
      customers: Array.from(customerMap.values()).sort((a, b) => b.sales - a.sales).slice(0, 8),
      products: Array.from(productMap.values()).sort((a, b) => b.sales - a.sales).slice(0, 8),
      cashSales: all.filter((x) => x.type === 'Cash').reduce((sum, x) => sum + getSubtotalExGst(x.invoice), 0),
      creditSales: all.filter((x) => x.type !== 'Cash').reduce((sum, x) => sum + getSubtotalExGst(x.invoice), 0),
    };
  }, [cashInvoices, customers, invoices, today]);

  const portfolioIntelligence = useMemo(() => {
    const signals = intelligence.customerSignals;
    const active = signals.filter((c) => c.orders > 0).length;
    const declining = signals.filter((c) => c.risk >= 40).length;
    const atRisk = signals.filter((c) => c.risk >= 70).reduce((sum, c) => sum + c.sales, 0);
    const top10Sales = signals.slice(0, 10).reduce((sum, c) => sum + c.sales, 0);
    const totalSales = signals.reduce((sum, c) => sum + c.sales, 0);
    return {
      active,
      declining,
      inactive: Math.max(0, customers.length - active),
      atRisk,
      top10Share: totalSales ? (top10Sales / totalSales) * 100 : 0,
    };
  }, [customers.length, intelligence.customerSignals]);

  const receivables = useMemo(() => {
    const all = [...invoices, ...cashInvoices];
    const outstanding = all.filter((invoice) => !isPaid(invoice));
    const total = outstanding.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
    const dueDateOf = (invoice) => String(invoice?.due_date ?? invoice?.dueDate ?? invoice?.payment_due_date ?? '').slice(0, 10);
    const overdue = outstanding.filter((invoice) => {
      const due = dueDateOf(invoice);
      return due && due < today;
    });
    const overdueValue = overdue.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
    const customerMap = new Map();
    overdue.forEach((invoice) => {
      const name = getInvoiceCustomerName(invoice);
      customerMap.set(name, (customerMap.get(name) || 0) + getInvoiceTotal(invoice));
    });
    return {
      total,
      overdue: overdueValue,
      overdueCount: overdue.length,
      topCustomers: Array.from(customerMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5),
    };
  }, [cashInvoices, invoices, today]);

  const maxRegion = Math.max(1, ...intelligence.regionPerformance.map((r) => r.sales));
  const maxProduct = Math.max(1, ...intelligence.productPerformance.slice(0, 8).map((p) => p.sales));
  const maxDaily = Math.max(1, ...intelligence.dailySeries.map((d) => d[metric === 'profit' ? 'profit' : 'sales']));

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-5 pb-10">
      <section className="border-b border-slate-200 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Management dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Operations overview</h1>
            <p className="mt-1 text-sm text-slate-500">What happened today, what is changing, and what requires attention.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <label className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700">
              <CalendarDays size={13} className="text-slate-500" />
              <span className="hidden sm:inline">Sales date</span>
              <input
                type="date"
                value={selectedDate}
                max={systemToday}
                onChange={(e) => setSelectedDate(e.target.value || systemToday)}
                className="h-6 border-0 bg-transparent p-0 text-xs font-medium text-slate-800 outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setSelectedDate(systemToday)}
              disabled={selectedDate === systemToday}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
            >
              Today
            </button>
            <button type="button" onClick={() => setRefreshNonce((v) => v + 1)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50">
              <RefreshCw size={13} className={analyticsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{selectedDate === systemToday ? 'Today' : 'Selected day'}</p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-950">Sales at a glance</h2>
          </div>
          <span className="text-xs text-slate-500">Compared with the same weekday last week · {formatDisplayDate(selectedDate)}</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 md:grid-cols-4 xl:grid-cols-8 xl:divide-y-0">
          {[
            ['Sales', `$${formatMoney(todayIntelligence.sales)}`, todayIntelligence.change === null ? 'No comparison' : `${todayIntelligence.change >= 0 ? '+' : ''}${todayIntelligence.change.toFixed(1)}% vs last week`],
            ['Orders', todayIntelligence.orders, `${todayIntelligence.units.toFixed(0)} units`],
            ['Avg order', `$${formatMoney(todayIntelligence.averageOrder)}`, formatDisplayDate(selectedDate)],
            ['Gross profit', `$${formatMoney(todayIntelligence.profit)}`, `${todayIntelligence.margin.toFixed(1)}% margin`],
            ['Paid', `$${formatMoney(todayIntelligence.paid)}`, formatDisplayDate(selectedDate)],
            ['Outstanding', `$${formatMoney(todayIntelligence.outstanding)}`, 'Unpaid today'],
            ['Cash sales', `$${formatMoney(todayIntelligence.cashSales)}`, 'Cash invoices'],
            ['Credit sales', `$${formatMoney(todayIntelligence.creditSales)}`, 'Normal invoices'],
          ].map(([label, value, sub]) => (
            <div key={label} className="px-4 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{value}</p>
              <p className={`mt-0.5 text-[10px] ${String(sub).startsWith('+') ? 'font-semibold text-emerald-700' : String(sub).startsWith('-') ? 'font-semibold text-rose-700' : 'text-slate-500'}`}>{sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="border border-slate-200 bg-white p-4 xl:col-span-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Daily performance</p>
              <h2 className="mt-1 text-base font-semibold text-slate-950">Sales trend</h2>
            </div>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none">
              <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="180">6 months</option><option value="365">12 months</option>
            </select>
          </div>
          <div className="mt-4 h-64 w-full">
            <svg viewBox="0 0 900 260" className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Sales trend">
              <line x1="0" y1="225" x2="900" y2="225" stroke="currentColor" className="text-slate-200" />
              {[0,1,2,3].map((i) => <line key={i} x1="0" y1={55 + i * 55} x2="900" y2={55 + i * 55} stroke="currentColor" className="text-slate-100" />)}
              {intelligence.dailySeries.length > 1 && (() => {
                const pts = intelligence.dailySeries.map((d, i) => {
                  const x = (i / (intelligence.dailySeries.length - 1)) * 900;
                  const value = d[metric === 'profit' ? 'profit' : 'sales'] || 0;
                  const y = 225 - (value / maxDaily) * 180;
                  return `${x},${y}`;
                }).join(' ');
                return <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-900" />;
              })()}
              {intelligence.dailySeries.map((d, i) => {
                const value = d[metric === 'profit' ? 'profit' : 'sales'] || 0;
                const x = intelligence.dailySeries.length === 1 ? 450 : (i / (intelligence.dailySeries.length - 1)) * 900;
                const y = 225 - (value / maxDaily) * 180;
                const anomaly = intelligence.anomalies.some((a) => a.date === d.date);
                return <circle key={d.date} cx={x} cy={y} r={anomaly ? 5 : 2.5} fill="currentColor" className={anomaly ? 'text-rose-500' : 'text-slate-900'} />;
              })}
            </svg>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-500">
            <span>{intelligence.weeklyMomentum === null ? 'Insufficient comparison history' : `${intelligence.weeklyMomentum >= 0 ? '+' : ''}${intelligence.weeklyMomentum.toFixed(1)}% 7-day momentum`}</span>
            <label className="flex items-center gap-2">Metric <select value={metric} onChange={(e) => setMetric(e.target.value)} className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[10px]"><option value="sales">Sales</option><option value="profit">Gross profit</option></select></label>
          </div>
        </div>

        <div className="border border-slate-200 bg-white p-4 xl:col-span-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{selectedDate === systemToday ? "Today's leaders" : "Selected day's leaders"}</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">Customers and products</h2>
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-1">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Top customers</p>
              <div className="space-y-2">
                {todayIntelligence.customers.slice(0, 5).map((c) => <div key={c.id} className="flex items-center gap-2"><span className="w-4 text-[10px] text-slate-400">{todayIntelligence.customers.indexOf(c) + 1}</span><span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">{c.name}</span><span className="font-mono text-xs text-slate-600">${formatMoney(c.sales)}</span></div>)}
                {todayIntelligence.customers.length === 0 && <p className="text-xs text-slate-400">No sales recorded today.</p>}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Top products</p>
              <div className="space-y-2">
                {todayIntelligence.products.slice(0, 5).map((p, index) => <div key={p.id} className="flex items-center gap-2"><span className="w-4 text-[10px] text-slate-400">{index + 1}</span><span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">{p.name}</span><span className="font-mono text-xs text-slate-600">${formatMoney(p.sales)}</span></div>)}
                {todayIntelligence.products.length === 0 && <p className="text-xs text-slate-400">No product sales recorded today.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Customer portfolio</p><h2 className="mt-1 text-base font-semibold text-slate-950">Portfolio health</h2></div>
          <button type="button" onClick={() => setActiveTab('customers')} className="text-xs font-medium text-slate-600 hover:text-slate-950">Open customers →</button>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 md:grid-cols-5 md:divide-y-0">
          {[
            ['Active customers', portfolioIntelligence.active, 'With orders in scope'],
            ['Declining cadence', portfolioIntelligence.declining, 'Risk ≥ 40'],
            ['Inactive', portfolioIntelligence.inactive, 'No orders in scope'],
            ['Revenue at risk', `$${formatMoney(portfolioIntelligence.atRisk)}`, 'Risk ≥ 70'],
            ['Top 10 concentration', `${portfolioIntelligence.top10Share.toFixed(1)}%`, 'Share of sales'],
          ].map(([label, value, sub]) => <div key={label} className="px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">{label}</p><p className="mt-1 text-lg font-semibold text-slate-950">{value}</p><p className="mt-0.5 text-[10px] text-slate-500">{sub}</p></div>)}
        </div>
        <div className="grid grid-cols-1 gap-6 border-t border-slate-200 p-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Customers requiring attention</p>
            <div className="divide-y divide-slate-100">
              {intelligence.customerSignals.filter((c) => c.risk >= 40).slice(0, 7).map((c) => <button type="button" key={c.id} onClick={() => setActiveTab('customers')} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50"><span className={`h-2 w-2 shrink-0 rounded-full ${c.risk >= 70 ? 'bg-rose-500' : 'bg-amber-400'}`} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-800">{c.name}</span><span className="block text-[10px] text-slate-500">{c.daysSince}d since last order · usual cycle {Math.round(c.expectedGap)}d</span></span><span className="font-mono text-xs text-slate-600">${formatMoney(c.sales)}</span></button>)}
              {intelligence.customerSignals.filter((c) => c.risk >= 40).length === 0 && <p className="py-5 text-xs text-slate-400">No material customer cadence changes detected.</p>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Revenue concentration</p>
            <div className="space-y-2.5">
              {intelligence.customerSignals.slice(0, 8).map((c, index) => <div key={c.id}><div className="flex items-center gap-2"><span className="w-5 text-[10px] text-slate-400">{index + 1}</span><span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">{c.name}</span><span className="font-mono text-xs text-slate-600">${formatMoney(c.sales)}</span></div><div className="ml-5 mt-1 h-1 bg-slate-100"><div className="h-full bg-slate-800" style={{ width: `${Math.min(100, (c.sales / Math.max(1, intelligence.summary.subtotal)) * 100) * 4}%` }} /></div></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="border border-slate-200 bg-white p-4 xl:col-span-7">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Product economics</p><h2 className="mt-1 text-base font-semibold text-slate-950">What is driving revenue</h2></div><button type="button" onClick={() => setActiveTab('inventory')} className="text-xs font-medium text-slate-600 hover:text-slate-950">Open inventory →</button></div>
          <div className="mt-4 space-y-3">
            {intelligence.abcProducts.slice(0, 8).map((p, index) => <div key={p.id} className="flex items-center gap-3"><span className="w-4 text-[10px] text-slate-400">{index + 1}</span><span className={`flex h-5 w-5 items-center justify-center rounded-sm text-[9px] font-bold ${p.abc === 'A' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600'}`}>{p.abc}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-medium text-slate-800">{p.name}</span><span className="font-mono text-xs text-slate-700">${formatMoney(p.sales)}</span></div><div className="mt-1 h-1 bg-slate-100"><div className="h-full bg-slate-700" style={{ width: `${Math.min(100, (p.sales / maxProduct) * 100)}%` }} /></div></div></div>)}
          </div>
        </div>
        <div className="border border-slate-200 bg-white p-4 xl:col-span-5">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Inventory coverage</p><h2 className="mt-1 text-base font-semibold text-slate-950">Stock decisions</h2></div><button type="button" onClick={() => setActiveTab('inventory')} className="text-xs font-medium text-slate-600 hover:text-slate-950">Open inventory →</button></div>
          <div className="mt-4 divide-y divide-slate-100">
            {intelligence.inventoryRisk.slice(0, 7).map((x) => <div key={String(x.item?.id ?? x.name)} className="py-2.5"><div className="flex items-center gap-3"><span className={`h-2 w-2 shrink-0 rounded-full ${x.risk >= 70 ? 'bg-rose-500' : x.risk >= 40 ? 'bg-amber-400' : 'bg-emerald-500'}`} /><span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">{x.name}</span><span className="font-mono text-[10px] text-slate-500">{Number.isFinite(x.daysCover) ? `${Math.round(x.daysCover)}d cover` : 'no demand'}</span></div></div>)}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Receivables</p><h2 className="mt-1 text-base font-semibold text-slate-950">Cash collection</h2></div><button type="button" onClick={() => setActiveTab('invoices')} className="text-xs font-medium text-slate-600 hover:text-slate-950">Open cash →</button></div>
          <div className="mt-4 grid grid-cols-2 divide-x divide-slate-200 border-y border-slate-200"><div className="py-3 pr-4"><p className="text-[9px] uppercase tracking-wider text-slate-400">Outstanding</p><p className="mt-1 text-lg font-semibold text-slate-950">${formatMoney(receivables.total)}</p></div><div className="py-3 pl-4"><p className="text-[9px] uppercase tracking-wider text-slate-400">Overdue</p><p className="mt-1 text-lg font-semibold text-rose-700">${formatMoney(receivables.overdue)}</p><p className="text-[10px] text-slate-500">{receivables.overdueCount} invoices with due dates</p></div></div>
          <div className="mt-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Largest overdue customers</p>{receivables.topCustomers.map((c) => <div key={c.name} className="flex items-center justify-between border-b border-slate-100 py-2 text-xs"><span className="truncate pr-3 text-slate-700">{c.name}</span><span className="font-mono text-slate-600">${formatMoney(c.value)}</span></div>)}{receivables.topCustomers.length === 0 && <p className="text-xs text-slate-400">No due-date data available for overdue ranking.</p>}</div>
        </div>
        <div className="border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Geography</p><h2 className="mt-1 text-base font-semibold text-slate-950">Revenue concentration by region</h2></div><button type="button" onClick={() => setActiveTab('logistics')} className="text-xs font-medium text-slate-600 hover:text-slate-950">Open logistics →</button></div>
          <div className="mt-4 space-y-3">{intelligence.regionPerformance.slice(0, 8).map((r) => <div key={r.region}><div className="flex items-center justify-between text-xs"><span className="font-medium text-slate-700">{r.region}</span><span className="font-mono text-slate-500">${formatMoney(r.sales)} · {r.orders}</span></div><div className="mt-1 h-2 bg-slate-100"><div className="h-full bg-slate-800" style={{ width: `${(r.sales / maxRegion) * 100}%` }} /></div></div>)}</div>
        </div>
      </section>

      <section className="border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Early warning centre</p><h2 className="mt-1 text-base font-semibold text-slate-950">Decisions that may need action</h2></div><span className="text-xs text-slate-500">{filteredRisks.length} active signals</span></div>
        <div className="divide-y divide-slate-100">
          {filteredRisks.slice(0, 10).map((item) => <div key={item.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-400'}`} /><div className="min-w-0"><p className="text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 text-[11px] leading-5 text-slate-500">{item.detail}</p></div></div><button type="button" onClick={() => setActiveTab(item.tab)} className="shrink-0 text-xs font-medium text-slate-600 hover:text-slate-950">{item.action} →</button></div>)}
          {filteredRisks.length === 0 && <div className="px-4 py-8 text-center"><CheckCircle2 size={20} className="mx-auto text-emerald-600" /><p className="mt-2 text-sm font-semibold text-slate-800">No elevated signals</p><p className="mt-1 text-xs text-slate-500">The dashboard will surface customer, inventory and sales changes as data accumulates.</p></div>}
        </div>
      </section>

      <section className="border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Optional drill-down</p><h2 className="mt-1 text-base font-semibold text-slate-950">Explore the data</h2></div><p className="text-xs text-slate-500">Start aggregated; filter only when you need a specific slice.</p></div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Customer<select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-normal normal-case tracking-normal text-slate-800 outline-none"><option value="all">All customers</option>{customerOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Product<select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-normal normal-case tracking-normal text-slate-800 outline-none"><option value="all">All products</option>{productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Risk<select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-normal normal-case tracking-normal text-slate-800 outline-none"><option value="all">All signals</option><option value="critical">Critical</option><option value="warning">Warning</option></select></label>
          <button type="button" onClick={() => { setCustomerFilter('all'); setProductFilter('all'); setRiskFilter('all'); }} className="mt-auto h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Reset drill-down filters</button>
        </div>
      </section>

      {cashError && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><b>Cash data warning:</b> {cashError}. Other dashboard intelligence remains available.</div>}
    </div>
  );
}
