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
  const [cashLoading, setCashLoading] = useState(true);
  const [cashError, setCashError] = useState('');
  const [cashRefreshNonce, setCashRefreshNonce] = useState(0);

  const customers = Array.isArray(sys?.customers) ? sys.customers : [];
  const invoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const inventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const users = Array.isArray(sys?.users) ? sys.users : [];

  const today = getTodayString();
  const monthKey = String(today || '').slice(0, 7);
  const monthStart = `${monthKey}-01`;
  const nextMonthStart = getNextMonthStart(monthKey);

  useEffect(() => {
    let cancelled = false;

    const fetchCashInvoices = async () => {
      setCashLoading(true);
      setCashError('');

      try {
        const collected = [];
        let from = 0;

        while (true) {
          const to = from + CASH_FETCH_PAGE_SIZE - 1;

          const { data, error } = await supabase
            .from('cash_invoices')
            .select('*')
            .gte('date', monthStart)
            .lt('date', nextMonthStart)
            .order('date', { ascending: false })
            .order('number', { ascending: false })
            .range(from, to);

          if (error) throw error;

          const batch = Array.isArray(data) ? data : [];
          collected.push(...batch);

          if (batch.length < CASH_FETCH_PAGE_SIZE) {
            break;
          }

          from += CASH_FETCH_PAGE_SIZE;
        }

        if (!cancelled) {
          setCashInvoices(collected);
        }
      } catch (error) {
        console.error('Failed to load dashboard Cash invoices:', error);

        if (!cancelled) {
          setCashInvoices([]);
          setCashError(
            error instanceof Error
              ? error.message
              : 'Unable to load Cash summary.'
          );
        }
      } finally {
        if (!cancelled) {
          setCashLoading(false);
        }
      }
    };

    if (monthKey && nextMonthStart) {
      void fetchCashInvoices();
    } else {
      setCashInvoices([]);
      setCashLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [monthKey, monthStart, nextMonthStart, cashRefreshNonce]);

  const dashboardData = useMemo(() => {
    const todayNormal = invoices.filter(
      (invoice) => getInvoiceDate(invoice) === today
    );

    const monthNormal = invoices.filter((invoice) =>
      getInvoiceDate(invoice).startsWith(`${monthKey}-`)
    );

    const todayCash = cashInvoices.filter(
      (invoice) => getInvoiceDate(invoice) === today
    );

    const monthCash = cashInvoices.filter((invoice) =>
      getInvoiceDate(invoice).startsWith(`${monthKey}-`)
    );

    const todayNormalSummary = buildLedgerSummary(todayNormal);
    const todayCashSummary = buildLedgerSummary(todayCash);
    const monthNormalSummary = buildLedgerSummary(monthNormal);
    const monthCashSummary = buildLedgerSummary(monthCash);

    const todayCombined = {
      subtotal:
        todayNormalSummary.subtotal + todayCashSummary.subtotal,
      profit:
        todayNormalSummary.profit + todayCashSummary.profit,
      count: todayNormalSummary.count + todayCashSummary.count,
      profitCount:
        todayNormalSummary.profitCount + todayCashSummary.profitCount,
      costReviewCount:
        todayNormalSummary.costReviewCount +
        todayCashSummary.costReviewCount,
    };

    const monthCombined = {
      billed: monthNormalSummary.total + monthCashSummary.total,
      paid: monthNormalSummary.paid + monthCashSummary.paid,
      outstanding:
        monthNormalSummary.outstanding + monthCashSummary.outstanding,
      gst: monthNormalSummary.gst + monthCashSummary.gst,
      unpaidCount:
        monthNormalSummary.unpaidCount + monthCashSummary.unpaidCount,
    };

    const lowStockItems = inventory
      .map((item) => ({
        item,
        stock: getInventoryStock(item),
      }))
      .filter(({ stock }) => stock < lowStockThreshold)
      .sort((left, right) => left.stock - right.stock);

    const outOfStockItems = lowStockItems.filter(
      ({ stock }) => stock <= 0
    );

    const deliveryRecords = todayNormal.map((invoice) => {
      const customer = findCustomerForInvoice(invoice, customers);
      const region = getDeliveryRegion(invoice, customer);
      const address = getDeliveryAddress(invoice, customer);

      return {
        invoice,
        customer,
        region,
        address,
      };
    });

    const regionCounts = {
      North: 0,
      West: 0,
      East: 0,
      Central: 0,
      Unassigned: 0,
    };

    deliveryRecords.forEach((record) => {
      if (Object.prototype.hasOwnProperty.call(regionCounts, record.region)) {
        regionCounts[record.region] += 1;
      } else {
        regionCounts.Unassigned += 1;
      }
    });

    const missingDeliveryAddressCount = deliveryRecords.filter(
      (record) => !record.address
    ).length;

    const recentTransactions = [
      ...monthNormal.map((invoice) => ({
        type: 'Invoice',
        invoice,
      })),
      ...monthCash.map((invoice) => ({
        type: 'Cash',
        invoice,
      })),
    ]
      .sort((left, right) => {
        const dateCompare = getInvoiceDate(right.invoice).localeCompare(
          getInvoiceDate(left.invoice)
        );

        if (dateCompare !== 0) return dateCompare;

        return getInvoiceNumber(right.invoice).localeCompare(
          getInvoiceNumber(left.invoice),
          undefined,
          { numeric: true }
        );
      })
      .slice(0, RECENT_TRANSACTION_LIMIT);

    return {
      todayNormal,
      monthNormal,
      todayCash,
      monthCash,
      todayNormalSummary,
      todayCashSummary,
      monthNormalSummary,
      monthCashSummary,
      todayCombined,
      monthCombined,
      lowStockItems,
      outOfStockItems,
      deliveryRecords,
      regionCounts,
      missingDeliveryAddressCount,
      recentTransactions,
    };
  }, [
    cashInvoices,
    customers,
    inventory,
    invoices,
    lowStockThreshold,
    monthKey,
    today,
  ]);

  const attentionItems = useMemo(() => {
    const items = [];

    if (dashboardData.lowStockItems.length > 0) {
      items.push({
        key: 'low-stock',
        icon: Package,
        title: `${dashboardData.lowStockItems.length} low-stock product${
          dashboardData.lowStockItems.length === 1 ? '' : 's'
        }`,
        detail:
          dashboardData.outOfStockItems.length > 0
            ? `${dashboardData.outOfStockItems.length} ${
                dashboardData.outOfStockItems.length === 1
                  ? 'item is'
                  : 'items are'
              } already out of stock.`
            : `All are below the ${lowStockThreshold}-unit dashboard threshold.`,
        tone: dashboardData.outOfStockItems.length > 0 ? 'rose' : 'amber',
        actionLabel: 'Inventory',
        onClick: () => setActiveTab('inventory'),
      });
    }

    if (dashboardData.monthNormalSummary.costReviewCount > 0) {
      items.push({
        key: 'normal-cost-review',
        icon: AlertCircle,
        title: `${dashboardData.monthNormalSummary.costReviewCount} normal invoice${
          dashboardData.monthNormalSummary.costReviewCount === 1 ? '' : 's'
        } need profit cost review`,
        detail:
          'Gross profit is excluded where a safe historical product cost is not available.',
        tone: 'amber',
        actionLabel: 'Invoices',
        onClick: () => setActiveTab('invoices'),
      });
    }

    if (dashboardData.monthCashSummary.costReviewCount > 0) {
      items.push({
        key: 'cash-cost-review',
        icon: AlertCircle,
        title: `${dashboardData.monthCashSummary.costReviewCount} Cash invoice${
          dashboardData.monthCashSummary.costReviewCount === 1 ? '' : 's'
        } need profit cost review`,
        detail:
          'Open Cash and use the Profit breakdown to resolve or lock available product costs.',
        tone: 'amber',
        actionLabel: 'Cash',
        onClick: () => setActiveTab('cash'),
      });
    }

    if (dashboardData.monthNormalSummary.unpaidCount > 0) {
      items.push({
        key: 'normal-outstanding',
        icon: Receipt,
        title: `${dashboardData.monthNormalSummary.unpaidCount} normal invoice${
          dashboardData.monthNormalSummary.unpaidCount === 1 ? '' : 's'
        } unpaid this month`,
        detail: `$${formatMoney(
          dashboardData.monthNormalSummary.outstanding
        )} remains outstanding in the normal invoice ledger.`,
        tone: 'blue',
        actionLabel: 'Billing',
        onClick: () => setActiveTab('billing'),
      });
    }

    if (dashboardData.monthCashSummary.unpaidCount > 0) {
      items.push({
        key: 'cash-outstanding',
        icon: WalletCards,
        title: `${dashboardData.monthCashSummary.unpaidCount} Cash invoice${
          dashboardData.monthCashSummary.unpaidCount === 1 ? '' : 's'
        } unpaid this month`,
        detail: `$${formatMoney(
          dashboardData.monthCashSummary.outstanding
        )} remains outstanding in the Cash ledger.`,
        tone: 'violet',
        actionLabel: 'Cash',
        onClick: () => setActiveTab('cash'),
      });
    }

    if (dashboardData.missingDeliveryAddressCount > 0) {
      items.push({
        key: 'missing-address',
        icon: MapPinned,
        title: `${dashboardData.missingDeliveryAddressCount} delivery ${
          dashboardData.missingDeliveryAddressCount === 1
            ? 'record is'
            : 'records are'
        } missing an address today`,
        detail:
          'Add the customer delivery address or invoice delivery address so Logistics can map the stop.',
        tone: 'rose',
        actionLabel: 'Delivery Map',
        onClick: () => setActiveTab('logistics'),
      });
    }

    return items;
  }, [dashboardData, lowStockThreshold, setActiveTab]);

  const hasAttentionItems = attentionItems.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-6 pb-8">
      {/* EXECUTIVE HEADER */}
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm">
        <div className="flex flex-col gap-5 px-5 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">
                Three Leaves ERP
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Operations
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-white sm:text-[30px]">
              Operations Dashboard
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {formatDisplayDate(today)} · a consolidated view of sales,
              profitability, receivables, stock and delivery workload.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center rounded-lg border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                sys?.storageMode === 'supabase'
                  ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              <ShieldCheck size={13} className="mr-1.5" />
              {sys?.storageMode === 'supabase'
                ? 'Supabase Connected'
                : 'Demo / Local Mode'}
            </div>

            <button
              type="button"
              onClick={() => setCashRefreshNonce((value) => value + 1)}
              disabled={cashLoading}
              className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={13}
                className={`mr-1.5 ${cashLoading ? 'animate-spin' : ''}`}
              />
              Refresh Cash
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-white/10 border-t border-white/10 bg-slate-900/40 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <ExecutiveMetric
            label="Sales Today · excl. GST"
            value={`$${formatMoney(dashboardData.todayCombined.subtotal)}`}
            subtext={`Normal $${formatMoney(
              dashboardData.todayNormalSummary.subtotal
            )} · Cash ${
              cashLoading
                ? 'loading…'
                : `$${formatMoney(dashboardData.todayCashSummary.subtotal)}`
            }`}
            icon={ShoppingCart}
            tone="blue"
            onClick={() => setActiveTab('invoices')}
          />

          <ExecutiveMetric
            label="Gross Profit Today"
            value={`$${formatMoney(dashboardData.todayCombined.profit)}`}
            subtext={
              dashboardData.todayCombined.costReviewCount > 0
                ? `${dashboardData.todayCombined.costReviewCount} transaction${
                    dashboardData.todayCombined.costReviewCount === 1 ? '' : 's'
                  } excluded pending cost review`
                : `${dashboardData.todayCombined.profitCount} transaction${
                    dashboardData.todayCombined.profitCount === 1 ? '' : 's'
                  } included`
            }
            icon={TrendingUp}
            tone={
              dashboardData.todayCombined.costReviewCount > 0
                ? 'amber'
                : 'emerald'
            }
          />

          <ExecutiveMetric
            label={`${formatMonthLabel(monthKey)} Outstanding`}
            value={`$${formatMoney(dashboardData.monthCombined.outstanding)}`}
            subtext={`${dashboardData.monthCombined.unpaidCount} unpaid · Normal $${formatMoney(
              dashboardData.monthNormalSummary.outstanding
            )} · Cash $${formatMoney(
              dashboardData.monthCashSummary.outstanding
            )}`}
            icon={CircleDollarSign}
            tone="violet"
            onClick={() => setActiveTab('billing')}
          />

          <ExecutiveMetric
            label="Deliveries Today"
            value={dashboardData.deliveryRecords.length}
            subtext={
              dashboardData.missingDeliveryAddressCount > 0
                ? `${dashboardData.missingDeliveryAddressCount} missing delivery address`
                : 'All delivery records have an address'
            }
            icon={Truck}
            tone={
              dashboardData.missingDeliveryAddressCount > 0
                ? 'amber'
                : 'emerald'
            }
            onClick={() => setActiveTab('logistics')}
          />
        </div>
      </section>

      {/* SYSTEM ALERTS */}
      {(cashError || sys?.lastSyncError) && (
        <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {cashError && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  Cash dashboard data could not be loaded
                </p>
                <p className="mt-1 text-xs leading-5 text-red-600">
                  {cashError}
                </p>
              </div>
            </div>
          )}

          {sys?.lastSyncError && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">ERP sync needs attention</p>
                <p className="mt-1 text-xs leading-5 text-amber-700">
                  Some figures may not include the latest remote changes until
                  synchronization succeeds.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ACTION CENTRE + DAILY WORKFLOW */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-7">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <SectionHeader
              eyebrow="Action Centre"
              title="Items requiring follow-up"
              subtitle="Priority operational exceptions are surfaced here so they can be resolved without searching through each module."
              action={
                hasAttentionItems ? (
                  <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700">
                    {attentionItems.length} open
                  </span>
                ) : null
              }
            />
          </div>

          <div className="px-5 sm:px-6">
            {hasAttentionItems ? (
              attentionItems.map((item) => (
                <AttentionItem
                  key={item.key}
                  icon={item.icon}
                  title={item.title}
                  detail={item.detail}
                  tone={item.tone}
                  actionLabel={item.actionLabel}
                  onClick={item.onClick}
                />
              ))
            ) : (
              <div className="flex items-center gap-3 py-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                  <CheckCircle2 size={19} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    No urgent operational exceptions
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    No low-stock, outstanding, missing-address or profit-review
                    alerts were detected in the current dashboard scope.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-5">
          <SectionHeader
            eyebrow="Today's Workflow"
            title="Operational workload"
            subtitle="A compact view of the work moving through invoicing, delivery and picking today."
          />

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <WorkflowCard
              eyebrow="Transactions"
              title="Invoice workload"
              value={dashboardData.todayCombined.count}
              detail={`${dashboardData.todayNormal.length} normal · ${dashboardData.todayCash.length} Cash`}
              icon={FileText}
              tone="blue"
            >
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('invoices')}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:bg-white"
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Normal
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    ${formatMoney(dashboardData.todayNormalSummary.total)}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('cash')}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:bg-white"
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Cash
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    ${formatMoney(dashboardData.todayCashSummary.total)}
                  </p>
                </button>
              </div>
            </WorkflowCard>

            <WorkflowCard
              eyebrow="Delivery"
              title="Regional workload"
              value={dashboardData.deliveryRecords.length}
              detail={
                dashboardData.missingDeliveryAddressCount > 0
                  ? `${dashboardData.missingDeliveryAddressCount} address exception${
                      dashboardData.missingDeliveryAddressCount === 1 ? '' : 's'
                    }`
                  : 'All delivery addresses ready'
              }
              icon={MapPinned}
              tone={
                dashboardData.missingDeliveryAddressCount > 0
                  ? 'amber'
                  : 'violet'
              }
              onClick={() => setActiveTab('logistics')}
            >
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {[
                  ['N', dashboardData.regionCounts.North],
                  ['W', dashboardData.regionCounts.West],
                  ['E', dashboardData.regionCounts.East],
                  ['C', dashboardData.regionCounts.Central],
                ].map(([label, count]) => (
                  <div
                    key={label}
                    className="rounded-lg bg-slate-50 px-2 py-2 text-center"
                  >
                    <p className="text-[9px] font-semibold text-slate-400">
                      {label}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-700">
                      {count}
                    </p>
                  </div>
                ))}
              </div>
            </WorkflowCard>

            <WorkflowCard
              eyebrow="Picking"
              title="Pick-list workload"
              value={dashboardData.todayNormal.length}
              detail="Today's normal invoices available to the picking workflow."
              icon={ClipboardList}
              tone="amber"
              onClick={() => setActiveTab('picking')}
            />
          </div>
        </div>
      </section>

      {/* MONTHLY FINANCIAL SNAPSHOT */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <SectionHeader
            eyebrow="Financial Snapshot"
            title={formatMonthLabel(monthKey)}
            subtitle="Normal and Cash ledgers remain separate while Paid, Outstanding and GST provide a consolidated operating view."
            action={
              <button
                type="button"
                onClick={() => setActiveTab('billing')}
                className="inline-flex items-center text-[11px] font-semibold text-slate-600 transition hover:text-slate-900"
              >
                Open Billing
                <ArrowRight size={12} className="ml-1.5" />
              </button>
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-5">
          <SmallFinancialCard
            label="Normal Billing"
            value={`$${formatMoney(dashboardData.monthNormalSummary.total)}`}
            subtext={`${dashboardData.monthNormalSummary.count} invoice${
              dashboardData.monthNormalSummary.count === 1 ? '' : 's'
            }`}
            icon={FileText}
            onClick={() => setActiveTab('billing')}
          />

          <SmallFinancialCard
            label="Cash Billing"
            value={
              cashLoading
                ? 'Loading…'
                : `$${formatMoney(dashboardData.monthCashSummary.total)}`
            }
            subtext={`${dashboardData.monthCashSummary.count} Cash invoice${
              dashboardData.monthCashSummary.count === 1 ? '' : 's'
            }`}
            icon={WalletCards}
            onClick={() => setActiveTab('cash')}
          />

          <SmallFinancialCard
            label="Paid"
            value={`$${formatMoney(dashboardData.monthCombined.paid)}`}
            subtext="Normal + Cash · incl. GST"
            icon={CheckCircle2}
            onClick={() => setActiveTab('billing')}
          />

          <SmallFinancialCard
            label="Outstanding"
            value={`$${formatMoney(dashboardData.monthCombined.outstanding)}`}
            subtext={`${dashboardData.monthCombined.unpaidCount} unpaid transaction${
              dashboardData.monthCombined.unpaidCount === 1 ? '' : 's'
            }`}
            icon={CircleDollarSign}
            onClick={() => setActiveTab('billing')}
          />

          <SmallFinancialCard
            label="GST"
            value={`$${formatMoney(dashboardData.monthCombined.gst)}`}
            subtext="GST recorded in Normal + Cash"
            icon={Receipt}
            onClick={() => setActiveTab('gst')}
          />
        </div>
      </section>

      {/* INVENTORY + QUICK ACCESS */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-5">
          <SectionHeader
            eyebrow="Inventory"
            title="Stock exceptions"
            subtitle={`${dashboardData.lowStockItems.length} product${
              dashboardData.lowStockItems.length === 1 ? '' : 's'
            } below the ${lowStockThreshold}-unit dashboard threshold.`}
            action={
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className="inline-flex items-center text-[11px] font-semibold text-slate-600 transition hover:text-slate-900"
              >
                View Inventory
                <ArrowRight size={12} className="ml-1.5" />
              </button>
            }
          />

          <div className="mt-5">
            {dashboardData.lowStockItems.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {dashboardData.lowStockItems
                  .slice(0, 5)
                  .map(({ item, stock }) => {
                    const name = getInventoryName(item);
                    const sku = getInventorySku(item);
                    const unit = getInventoryUnit(item);

                    return (
                      <button
                        type="button"
                        key={String(item?.id || `${sku}-${name}`)}
                        onClick={() => setActiveTab('inventory')}
                        className="flex w-full items-center justify-between gap-4 py-3 text-left transition hover:bg-slate-50/80"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {name}
                          </p>
                          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
                            {sku || 'No SKU'}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p
                            className={`text-sm font-semibold ${
                              stock <= 0 ? 'text-red-600' : 'text-amber-600'
                            }`}
                          >
                            {stock}
                            {unit ? ` ${unit}` : ''}
                          </p>
                          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            {stock <= 0 ? 'Out of stock' : 'Low stock'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Stock levels are within threshold
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    No product is currently below the dashboard threshold.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-7">
          <SectionHeader
            eyebrow="Quick Access"
            title="Frequently used workflows"
            subtitle="Direct access to the ERP functions used most often during daily operations."
          />

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap gap-3">
              <ShortcutBtn
                icon={FileText}
                label="Invoicing"
                onClick={() => setActiveTab('invoices')}
                perm="create_invoices"
                sys={sys}
              />

              <ShortcutBtn
                icon={WalletCards}
                label="Cash"
                onClick={() => setActiveTab('cash')}
                perm="create_invoices"
                sys={sys}
              />

              <ShortcutBtn
                icon={Receipt}
                label="Billing"
                onClick={() => setActiveTab('billing')}
                perm="manage_billing"
                sys={sys}
              />

              <ShortcutBtn
                icon={MapPinned}
                label="Delivery Map"
                onClick={() => setActiveTab('logistics')}
                sys={sys}
              />

              <ShortcutBtn
                icon={ClipboardList}
                label="Pick List"
                onClick={() => setActiveTab('picking')}
                sys={sys}
              />

              <ShortcutBtn
                icon={Package}
                label="Inventory"
                onClick={() => setActiveTab('inventory')}
                sys={sys}
              />

              <ShortcutBtn
                icon={UserPlus}
                label="Customers"
                onClick={() => setActiveTab('customers')}
                sys={sys}
              />

              <ShortcutBtn
                icon={Truck}
                label="Stock In"
                onClick={() => setActiveTab('suppliers')}
                perm="manage_suppliers"
                sys={sys}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 px-3 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Customers
              </p>
              <p className="mt-1.5 text-lg font-semibold text-slate-800">
                {customers.length}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 px-3 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Team
              </p>
              <p className="mt-1.5 text-lg font-semibold text-slate-800">
                {users.length}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 px-3 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Normal today
              </p>
              <p className="mt-1.5 text-lg font-semibold text-slate-800">
                {dashboardData.todayNormal.length}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 px-3 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Cash today
              </p>
              <p className="mt-1.5 text-lg font-semibold text-slate-800">
                {dashboardData.todayCash.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RECENT ACTIVITY */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <SectionHeader
            eyebrow="Recent Activity"
            title="Latest transactions"
            subtitle={`The ${RECENT_TRANSACTION_LIMIT} most recent Normal and Cash transactions in ${formatMonthLabel(
              monthKey
            )}.`}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-left">
            <thead className="bg-slate-50/80">
              <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                <th className="px-5 py-3 sm:px-6">Type</th>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Profit</th>
                <th className="px-5 py-3 text-center sm:px-6">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {dashboardData.recentTransactions.map(({ type, invoice }) => {
                const profitStatus = getProfitStatus(invoice);
                const paid = isPaid(invoice);

                return (
                  <tr
                    key={`${type}-${getInvoiceNumber(invoice)}-${getInvoiceDate(
                      invoice
                    )}`}
                    className="cursor-pointer bg-white transition hover:bg-slate-50/80"
                    onClick={() =>
                      setActiveTab(type === 'Cash' ? 'cash' : 'invoices')
                    }
                  >
                    <td className="px-5 py-3.5 sm:px-6">
                      <TransactionTypeBadge type={type} />
                    </td>

                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-800">
                      {getInvoiceNumber(invoice)}
                    </td>

                    <td className="px-4 py-3.5 text-slate-500">
                      {formatDisplayDate(getInvoiceDate(invoice))}
                    </td>

                    <td className="max-w-[300px] truncate px-4 py-3.5 font-medium text-slate-700">
                      {getInvoiceCustomerName(invoice)}
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-900">
                      ${formatMoney(getInvoiceTotal(invoice))}
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono">
                      {profitStatus.profit === null ? (
                        <span className="font-semibold text-amber-600">
                          Needs review
                        </span>
                      ) : (
                        <span
                          className={`font-semibold ${
                            profitStatus.profit < 0
                              ? 'text-red-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          ${formatMoney(profitStatus.profit)}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-center sm:px-6">
                      <span
                        className={`inline-flex rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                          paid
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-orange-200 bg-orange-50 text-orange-700'
                        }`}
                      >
                        {paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {dashboardData.recentTransactions.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <FileText size={22} className="mx-auto text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-600">
                      No transactions this month
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      New Normal and Cash transactions will appear here.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SYSTEM STATUS */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Users size={16} />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Customer Records
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {customers.length} customers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100">
              <Users size={16} />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Team Access
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {users.length} team members
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${
                cashError
                  ? 'bg-red-50 text-red-600 ring-red-100'
                  : cashLoading
                    ? 'bg-blue-50 text-blue-600 ring-blue-100'
                    : 'bg-emerald-50 text-emerald-600 ring-emerald-100'
              }`}
            >
              {cashError ? (
                <AlertCircle size={16} />
              ) : cashLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
            </div>

            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Cash Ledger
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {cashError
                  ? 'Load issue'
                  : cashLoading
                    ? 'Refreshing'
                    : `${cashInvoices.length} records this month`}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
