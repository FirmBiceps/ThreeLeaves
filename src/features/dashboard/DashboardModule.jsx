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
  const [metric, setMetric] = useState('sales');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const customers = Array.isArray(sys?.customers) ? sys.customers : [];
  const invoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const inventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const users = Array.isArray(sys?.users) ? sys.users : [];

  const today = getTodayString();
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

  const maxDaily = Math.max(1, ...intelligence.dailySeries.map((d) => d[metric === 'profit' ? 'profit' : 'sales']));
  const maxRegion = Math.max(1, ...intelligence.regionPerformance.map((r) => r.sales));
  const maxProduct = Math.max(1, ...intelligence.productPerformance.slice(0, 8).map((p) => p.sales));

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-5 pb-10">
      <section className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-5 text-white shadow-sm sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">
              <Sparkles size={13} /> Situational Intelligence
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Operations Situation</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              A live management view of demand, customers, inventory, profitability and operational risk. Statistical signals are derived from the ERP data currently available; predictive models become stronger as historical data accumulates.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setRefreshNonce((v) => v + 1)} className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:bg-slate-800">
              <RefreshCw size={13} className={`mr-1.5 ${analyticsLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <span className="inline-flex items-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <ShieldCheck size={13} className="mr-1.5" /> {sys?.storageMode === 'supabase' ? 'Live Data' : 'Local Data'}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-5">
          {[['7', '7 Days'], ['30', '30 Days'], ['90', '90 Days'], ['180', '6 Months'], ['365', '12 Months']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-lg border px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider transition ${period === value ? 'border-blue-400/40 bg-blue-400/10 text-blue-200' : 'border-slate-800 bg-slate-900/70 text-slate-500 hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <SlidersHorizontal size={14} /> Analysis slices
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[11px] font-medium text-slate-500">
            Customer
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-400">
              <option value="all">All customers</option>
              {customerOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">
            Product
            <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-400">
              <option value="all">All products</option>
              {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">
            Chart metric
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-400">
              <option value="sales">Sales</option>
              <option value="profit">Gross profit</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">
            Risk view
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-400">
              <option value="all">All signals</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        {[
          ['Revenue', `$${formatMoney(intelligence.summary.subtotal)}`, intelligence.salesChange, ShoppingCart],
          ['Gross profit', `$${formatMoney(intelligence.summary.profit)}`, intelligence.profitChange, TrendingUp],
          ['Gross margin', `${intelligence.grossMargin.toFixed(1)}%`, null, Gauge],
          ['Orders', intelligence.summary.count, null, FileText],
          ['Collection', `${intelligence.collectionRate.toFixed(1)}%`, null, CircleDollarSign],
          ['Credit notes', `$${formatMoney(intelligence.creditNoteValue)}`, null, Receipt],
        ].map(([label, value, change, Icon]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</span><Icon size={15} className="text-slate-400" /></div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{value}</div>
            {change !== null && <div className={`mt-1 text-[10px] font-semibold ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% vs prior period</div>}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-blue-600"><BarChart3 size={14} /> Demand signal</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Actual performance + short-term trend</h2><p className="mt-1 text-xs text-slate-500">The dotted extension is a transparent linear trend projection, not a black-box promise.</p></div>
            <div className="text-right"><div className="text-[10px] uppercase tracking-wider text-slate-400">7D momentum</div><div className={`mt-1 text-lg font-semibold ${intelligence.weeklyMomentum !== null && intelligence.weeklyMomentum >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{intelligence.weeklyMomentum === null ? '—' : `${intelligence.weeklyMomentum >= 0 ? '+' : ''}${intelligence.weeklyMomentum.toFixed(1)}%`}</div></div>
          </div>
          <div className="mt-5 h-64 w-full">
            <svg viewBox="0 0 900 260" className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Sales trend chart">
              <line x1="0" y1="225" x2="900" y2="225" stroke="currentColor" className="text-slate-200" />
              {[0,1,2,3].map((i) => <line key={i} x1="0" y1={55 + i*55} x2="900" y2={55 + i*55} stroke="currentColor" className="text-slate-100" />)}
              {intelligence.dailySeries.length > 1 && (() => {
                const pts = intelligence.dailySeries.map((d, i) => {
                  const x = (i / (intelligence.dailySeries.length - 1)) * 900;
                  const y = 225 - ((d[metric === 'profit' ? 'profit' : 'sales'] || 0) / maxDaily) * 180;
                  return `${x},${y}`;
                }).join(' ');
                const trendPts = intelligence.dailySeries.map((_, i) => {
                  const x = (i / (intelligence.dailySeries.length - 1)) * 900;
                  const yVal = Math.max(0, intelligence.mean + ((i - intelligence.dailySeries.length / 2) * (intelligence.dailySeries.length > 1 ? (intelligence.dailySeries[intelligence.dailySeries.length - 1].sales - intelligence.dailySeries[0].sales) / intelligence.dailySeries.length : 0)));
                  const y = 225 - (yVal / maxDaily) * 180;
                  return `${x},${y}`;
                }).join(' ');
                return <><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="3" className="text-blue-600" /><polyline points={trendPts} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="7 7" className="text-slate-400" /></>;
              })()}
              {intelligence.dailySeries.map((d, i) => {
                const value = d[metric === 'profit' ? 'profit' : 'sales'] || 0;
                const x = intelligence.dailySeries.length === 1 ? 450 : (i / (intelligence.dailySeries.length - 1)) * 900;
                const y = 225 - (value / maxDaily) * 180;
                const anomaly = intelligence.anomalies.some((a) => a.date === d.date);
                return <circle key={d.date} cx={x} cy={y} r={anomaly ? 5 : 2.5} fill="currentColor" className={anomaly ? 'text-rose-500' : 'text-blue-600'} />;
              })}
            </svg>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" /> Actual</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" /> Anomaly</span><span><i className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dashed border-slate-400" /> Trend</span></div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-violet-600"><BrainCircuit size={14} /> Intelligence layer</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">What the data is saying</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Demand</p><p className="mt-1 text-sm font-semibold text-slate-800">{intelligence.weeklyMomentum === null ? 'Not enough comparable history' : intelligence.weeklyMomentum >= 0 ? 'Demand is accelerating' : 'Demand is slowing'}</p><p className="mt-1 text-xs leading-5 text-slate-500">{intelligence.anomalies.length} statistical anomaly{intelligence.anomalies.length === 1 ? '' : 'ies'} detected in the selected window.</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Inventory</p><p className="mt-1 text-sm font-semibold text-slate-800">{intelligence.inventoryRisk.filter((x) => x.risk >= 70).length} high-risk stock positions</p><p className="mt-1 text-xs leading-5 text-slate-500">Risk uses current stock versus observed daily demand; it becomes more accurate once the movement ledger has sufficient history.</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Customer behaviour</p><p className="mt-1 text-sm font-semibold text-slate-800">{intelligence.customerSignals.filter((x) => x.risk >= 70).length} customers need attention</p><p className="mt-1 text-xs leading-5 text-slate-500">Signals are based on purchase recency versus the customer's observed ordering cadence.</p></div>
          </div>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Forecast readiness</p><p className="mt-1 text-sm font-semibold text-slate-800">{intelligence.summary.count < 30 ? 'Building history' : 'Ready for stronger forecasting'}</p><p className="mt-1 text-xs leading-5 text-slate-600">The current dashboard uses transparent statistical methods. A server-side forecasting model should be added once enough historical daily data is available.</p></div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-600"><Users size={14} /> Customer signals</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Customers changing behaviour</h2></div><button type="button" onClick={() => setActiveTab('customers')} className="text-xs font-semibold text-slate-500 hover:text-slate-900">Open Customers →</button></div>
          <div className="mt-4 space-y-2">
            {intelligence.customerSignals.slice(0, 6).map((c) => <button type="button" key={c.id} onClick={() => setActiveTab('customers')} className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-3 text-left hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{c.name}</p><p className="mt-1 text-[10px] text-slate-500">{c.orders} orders · ${formatMoney(c.sales)} · last order {c.daysSince}d ago</p></div><div className={`ml-3 rounded-md px-2 py-1 text-[9px] font-bold uppercase ${c.risk >= 70 ? 'bg-rose-50 text-rose-700' : c.risk >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{c.risk >= 70 ? 'Watch' : c.risk >= 40 ? 'Monitor' : 'Stable'}</div></button>)}
            {intelligence.customerSignals.length === 0 && <p className="py-8 text-center text-xs text-slate-400">Not enough customer transaction data in this scope.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-amber-600"><Boxes size={14} /> Inventory intelligence</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Stock coverage & risk</h2></div><button type="button" onClick={() => setActiveTab('inventory')} className="text-xs font-semibold text-slate-500 hover:text-slate-900">Open Inventory →</button></div>
          <div className="mt-4 space-y-3">
            {intelligence.inventoryRisk.slice(0, 6).map((x) => <div key={String(x.item?.id ?? x.name)}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{x.name}</p><p className="text-[10px] text-slate-500">Stock {x.stock} · {Number.isFinite(x.daysCover) ? `${Math.round(x.daysCover)}d cover` : 'no observed demand'}</p></div><span className={`rounded-md px-2 py-1 text-[9px] font-bold ${x.risk >= 70 ? 'bg-rose-50 text-rose-700' : x.risk >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{x.risk}% risk</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${x.risk >= 70 ? 'bg-rose-500' : x.risk >= 40 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, x.risk)}%` }} /></div></div>)}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-7">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-blue-600"><MapIcon size={14} /> Geographic intelligence</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Revenue concentration by region</h2>
          <div className="mt-5 space-y-3">
            {intelligence.regionPerformance.length === 0 ? <p className="py-10 text-center text-xs text-slate-400">No regional data available in the selected period.</p> : intelligence.regionPerformance.slice(0, 8).map((r) => <div key={r.region}><div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-700">{r.region}</span><span className="font-mono text-slate-500">${formatMoney(r.sales)} · {r.orders} orders</span></div><div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${(r.sales / maxRegion) * 100}%` }} /></div></div>)}
          </div>
          <p className="mt-5 text-[10px] leading-5 text-slate-400">This is the management view of geography. Detailed stop planning remains in Logistics.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-violet-600"><Target size={14} /> Product economics</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Top products + ABC signal</h2>
          <div className="mt-4 space-y-3">
            {intelligence.abcProducts.slice(0, 8).map((p) => <div key={p.id}><div className="flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${p.abc === 'A' ? 'bg-blue-50 text-blue-700' : p.abc === 'B' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{p.abc}</span><p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{p.name}</p><span className="text-xs font-mono text-slate-700">${formatMoney(p.sales)}</span></div><div className="ml-8 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-700" style={{ width: `${(p.sales / maxProduct) * 100}%` }} /></div></div>)}
            {intelligence.abcProducts.length === 0 && <p className="py-8 text-center text-xs text-slate-400">Product-line data is not available in the selected invoice records.</p>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-rose-600"><TriangleAlert size={14} /> Early warning centre</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Issues that may affect operations</h2></div><span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{filteredRisks.length} signals</span></div>
          <div className="mt-4 space-y-1">
            {filteredRisks.slice(0, 8).map((item) => <div key={item.key} className="flex flex-col gap-3 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-400'}`} /><div className="min-w-0"><p className="text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{item.detail}</p></div></div><button type="button" onClick={() => setActiveTab(item.tab)} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">{item.action} →</button></div>)}
            {filteredRisks.length === 0 && <div className="rounded-xl bg-emerald-50 p-5 text-center"><CheckCircle2 size={20} className="mx-auto text-emerald-600" /><p className="mt-2 text-sm font-semibold text-emerald-800">No elevated signals in this view</p><p className="mt-1 text-xs text-emerald-700">The dashboard will surface statistical, inventory and customer signals as the dataset grows.</p></div>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><CalendarDays size={14} /> Management snapshot</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">What to look at next</h2>
          <div className="mt-4 space-y-2 text-xs">
            <button type="button" onClick={() => setActiveTab('inventory')} className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-3 text-left hover:bg-slate-100"><span><b>Inventory</b><br /><span className="text-[10px] text-slate-500">{intelligence.lowStockItems.length} below threshold</span></span><ArrowRight size={14} /></button>
            <button type="button" onClick={() => setActiveTab('customers')} className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-3 text-left hover:bg-slate-100"><span><b>Customers</b><br /><span className="text-[10px] text-slate-500">{intelligence.customerSignals.filter((x) => x.risk >= 70).length} cadence changes</span></span><ArrowRight size={14} /></button>
            <button type="button" onClick={() => setActiveTab('invoices')} className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-3 text-left hover:bg-slate-100"><span><b>Sales</b><br /><span className="text-[10px] text-slate-500">{intelligence.anomalies.length} anomalies detected</span></span><ArrowRight size={14} /></button>
            <button type="button" onClick={() => setActiveTab('logistics')} className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-3 text-left hover:bg-slate-100"><span><b>Operations</b><br /><span className="text-[10px] text-slate-500">{intelligence.regionPerformance.length} active regions</span></span><ArrowRight size={14} /></button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><Activity size={14} /> Data foundation</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Intelligence coverage</h2></div><div className="text-[10px] text-slate-400">This section intentionally shows data readiness instead of pretending missing history is accurate ML.</div></div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {[
            ['Customers', customers.length, 'Customer behaviour'],
            ['Products', inventory.length, 'Inventory signals'],
            ['Transactions', intelligence.summary.count, 'Demand history'],
            ['Movements', intelligence.movementUnits.toFixed(0), 'Ledger volume'],
            ['Credit notes', creditNotes.length, 'Returns signal'],
            ['Team', users.length, 'Operational users'],
          ].map(([label, value, detail]) => <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-semibold text-slate-800">{value}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></div>)}
        </div>
      </section>

      {cashError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><b>Cash data warning:</b> {cashError}. Other dashboard intelligence remains available.</div>}
    </div>
  );
}
