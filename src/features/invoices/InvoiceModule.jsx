import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Filter, ArrowUpDown, Search, ScanBarcode, CheckCircle, AlertCircle, ChevronDown, Trash2, ChevronLeft, ChevronRight, DollarSign, TrendingUp, Clock3, RotateCcw, X, Calculator, Lock, Eye } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';
import { InvoiceGenerator } from './InvoiceGenerator';
import { InvoicePreviewModal } from './InvoicePreview';

// ============================================================================
// DATABASE LOADING
// ============================================================================
// Supabase/PostgREST can cap a single select request. Fetch invoices in stable
// 1,000-row ranges so Invoice History receives every accessible invoice.
const INVOICE_FETCH_BATCH_SIZE = 1000;

async function fetchAllInvoiceRows() {
  const allInvoices = [];
  let from = 0;

  while (true) {
    const to = from + INVOICE_FETCH_BATCH_SIZE - 1;

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    allInvoices.push(...rows);

    if (rows.length < INVOICE_FETCH_BATCH_SIZE) break;

    from += INVOICE_FETCH_BATCH_SIZE;

    if (from > 1000000) {
      throw new Error(
        'Invoice loading stopped after 1,000,000 rows. Please review the database query.'
      );
    }
  }

  return allInvoices;
}

// ============================================================================
// PROFIT REPORTING
// ============================================================================
// Prefer the immutable values stored on the invoice. For legacy invoices that
// have not been backfilled yet, a current-cost estimate is shown so the module
// remains useful during the transition. Once the migration/backfill is run,
// future inventory price changes no longer affect historical invoice profit.

const getInventoryCost = (product) => {
  const rawValue =
    product?.['cost_price (SGD)'] ??
    product?.cost_price ??
    product?.costPrice ??
    null;

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  const value = Number(rawValue);

  // Do not silently treat a missing/zero cost as "free".
  return Number.isFinite(value) && value > 0 ? value : null;
};

const getSnapshotCost = (item) => {
  const rawValue =
    item?.costPriceSnapshot ??
    item?.cost_price_snapshot ??
    null;

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const getLineQty = (item) =>
  Number(item?.qty ?? item?.quantity ?? 0) || 0;

const getLineSellPrice = (item) =>
  Number(item?.unitPrice ?? item?.price ?? item?.Price ?? 0) || 0;

const getLineUnit = (item) =>
  String(item?.unit ?? item?.Unit ?? '').trim();

const getInventoryUnit = (product) =>
  String(product?.Unit ?? product?.unit ?? '').trim();

const getProductName = (item, product) =>
  String(
    item?.name ??
    item?.Name ??
    item?.description ??
    item?.Description ??
    product?.Name ??
    product?.name ??
    product?.Items ??
    'Unnamed item'
  );

const getProductSku = (item, product) =>
  String(
    item?.sku ??
    item?.SKU ??
    item?.productSku ??
    item?.product_sku ??
    product?.SKU ??
    product?.sku ??
    ''
  );

const getProfitLineDetail = (item, itemIndex, inventory = []) => {
  const itemId = String(item?.itemId || '');
  const product = (Array.isArray(inventory) ? inventory : []).find(
    (entry) => String(entry?.id || '') === itemId
  );

  const qty = getLineQty(item);
  const sellPrice = getLineSellPrice(item);

  const explicitRevenue =
    item?.lineRevenueSnapshot !== null &&
    item?.lineRevenueSnapshot !== undefined &&
    Number.isFinite(Number(item.lineRevenueSnapshot))
      ? Number(item.lineRevenueSnapshot)
      : null;

  const revenue = explicitRevenue ?? qty * sellPrice;

  const invoiceUnit = getLineUnit(item);
  const inventoryUnit = getInventoryUnit(product);

  const snapshotCost = getSnapshotCost(item);

  const snapshotItemId = String(
    item?.costSnapshotItemId ??
    item?.cost_snapshot_item_id ??
    ''
  );

  // A valid stored snapshot is authoritative for historical reporting.
  // Older rows may not have costSnapshotItemId, so allow the snapshot when
  // there is no conflicting item id.
  const snapshotMatchesProduct =
    snapshotCost !== null &&
    (
      !snapshotItemId ||
      !itemId ||
      snapshotItemId === itemId
    );

  let costPrice = null;
  let source = 'missing_cost';
  let sourceLabel = 'Missing cost';
  let needsReview = false;
  let reviewReason = null;
  let canLockCurrentCost = false;

  if (snapshotMatchesProduct && item?.costNeedsReview !== true) {
    costPrice = snapshotCost;
    source = 'locked_snapshot';
    sourceLabel = 'Locked cost';
  } else {
    if (!product) {
      needsReview = true;
      source = 'product_missing';
      sourceLabel = 'Product not found';
      reviewReason =
        'This invoice item cannot be matched to the current product list.';
    } else {
      const currentCost = getInventoryCost(product);

      if (
        invoiceUnit &&
        inventoryUnit &&
        invoiceUnit !== inventoryUnit
      ) {
        needsReview = true;
        source = 'unit_mismatch';
        sourceLabel = 'Unit mismatch';
        reviewReason = `Invoice unit "${invoiceUnit}" differs from inventory cost unit "${inventoryUnit}".`;
      } else if (currentCost === null) {
        needsReview = true;
        source = 'missing_cost';
        sourceLabel = 'Missing cost';
        reviewReason =
          'No valid cost_price (SGD) is available for this product.';
      } else {
        // This is the transitional path for an unresolved historical line:
        // use today's cost for calculation, but clearly label it as current
        // until the user chooses to lock it.
        costPrice = currentCost;
        source = 'current_inventory';
        sourceLabel = 'Current cost';
        canLockCurrentCost = true;
      }
    }
  }

  const lineCost =
    costPrice === null || needsReview ? null : qty * costPrice;

  const lineProfit =
    lineCost === null ? null : revenue - lineCost;

  const marginPct =
    lineProfit === null || revenue <= 0
      ? null
      : (lineProfit / revenue) * 100;

  return {
    item,
    itemIndex,
    itemId,
    product,
    name: getProductName(item, product),
    sku: getProductSku(item, product),
    qty,
    invoiceUnit,
    inventoryUnit,
    sellPrice,
    revenue,
    costPrice,
    lineCost,
    lineProfit,
    marginPct,
    source,
    sourceLabel,
    needsReview,
    reviewReason,
    canLockCurrentCost,
  };
};

const buildInvoiceProfitBreakdown = (invoice, inventory = []) => {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];

  const rows = items.map((item, itemIndex) =>
    getProfitLineDetail(item, itemIndex, inventory)
  );

  const subtotal = rows.reduce(
    (sum, row) => sum + (Number(row.revenue) || 0),
    0
  );

  const knownCostTotal = rows.reduce(
    (sum, row) =>
      sum + (row.lineCost === null ? 0 : Number(row.lineCost) || 0),
    0
  );

  const unresolvedRows = rows.filter((row) => row.needsReview);
  const currentCostRows = rows.filter(
    (row) => row.canLockCurrentCost && !row.needsReview
  );

  const isComplete = rows.length > 0 && unresolvedRows.length === 0;

  const calculatedProfit = isComplete
    ? subtotal - knownCostTotal
    : null;

  const calculatedMarginPct =
    calculatedProfit === null || subtotal <= 0
      ? null
      : (calculatedProfit / subtotal) * 100;

  const storedProfit =
    invoice?.gross_profit !== null &&
    invoice?.gross_profit !== undefined &&
    invoice?.gross_profit !== '' &&
    Number.isFinite(Number(invoice.gross_profit))
      ? Number(invoice.gross_profit)
      : null;

  const storedCost =
    invoice?.cost_total !== null &&
    invoice?.cost_total !== undefined &&
    invoice?.cost_total !== '' &&
    Number.isFinite(Number(invoice.cost_total))
      ? Number(invoice.cost_total)
      : null;

  const storedMargin =
    invoice?.gross_margin_pct !== null &&
    invoice?.gross_margin_pct !== undefined &&
    invoice?.gross_margin_pct !== '' &&
    Number.isFinite(Number(invoice.gross_margin_pct))
      ? Number(invoice.gross_margin_pct)
      : null;

  const storedMissingCount = Number(
    invoice?.profit_missing_cost_count || 0
  );

  const hasAuthoritativeStoredProfit =
    storedProfit !== null &&
    storedMissingCount === 0;

  const finalProfit = hasAuthoritativeStoredProfit
    ? storedProfit
    : calculatedProfit;

  const finalCost = hasAuthoritativeStoredProfit
    ? storedCost ?? knownCostTotal
    : isComplete
      ? knownCostTotal
      : null;

  const finalMargin = hasAuthoritativeStoredProfit
    ? storedMargin ??
      (subtotal > 0 && finalProfit !== null
        ? (finalProfit / subtotal) * 100
        : null)
    : calculatedMarginPct;

  const storedVariance =
    hasAuthoritativeStoredProfit &&
    calculatedProfit !== null
      ? storedProfit - calculatedProfit
      : 0;

  return {
    rows,
    subtotal,
    knownCostTotal,
    unresolvedRows,
    currentCostRows,
    isComplete,
    calculatedProfit,
    calculatedMarginPct,
    storedProfit,
    storedCost,
    storedMargin,
    hasAuthoritativeStoredProfit,
    finalProfit,
    finalCost,
    finalMargin,
    storedVariance,
  };
};

const getInvoiceProfitInfo = (invoice, inventory = []) => {
  if (!invoice) {
    return {
      profit: null,
      costTotal: null,
      marginPct: null,
      source: 'missing',
      isEstimated: false,
      needsReview: true,
      missingCostCount: 0,
      readyToLockCount: 0,
    };
  }

  const breakdown = buildInvoiceProfitBreakdown(invoice, inventory);
  const storedMissingCount = Number(
    invoice?.profit_missing_cost_count || 0
  );

  if (breakdown.hasAuthoritativeStoredProfit) {
    return {
      profit: breakdown.finalProfit,
      costTotal: breakdown.finalCost,
      marginPct: breakdown.finalMargin,
      source: String(invoice?.profit_basis || 'locked_snapshot'),
      isEstimated: invoice?.profit_is_estimated === true,
      needsReview: false,
      missingCostCount: 0,
      readyToLockCount: 0,
    };
  }

  if (breakdown.unresolvedRows.length > 0 || breakdown.rows.length === 0) {
    return {
      profit: null,
      costTotal: null,
      marginPct: null,
      source: 'needs_cost_review',
      isEstimated: true,
      needsReview: true,
      missingCostCount: breakdown.unresolvedRows.length || storedMissingCount,
      readyToLockCount: breakdown.currentCostRows.length,
    };
  }

  // Complete, but one or more lines are currently using today's inventory
  // cost instead of a historical snapshot. The number is useful now, but it
  // remains an estimate until those available costs are locked.
  if (breakdown.currentCostRows.length > 0) {
    return {
      profit: breakdown.calculatedProfit,
      costTotal: breakdown.knownCostTotal,
      marginPct: breakdown.calculatedMarginPct,
      source: 'current_cost_estimate',
      isEstimated: true,
      needsReview: false,
      missingCostCount: 0,
      readyToLockCount: breakdown.currentCostRows.length,
    };
  }

  return {
    profit: breakdown.calculatedProfit,
    costTotal: breakdown.knownCostTotal,
    marginPct: breakdown.calculatedMarginPct,
    source: 'item_locked_snapshot',
    isEstimated: invoice?.profit_is_estimated === true,
    needsReview: false,
    missingCostCount: 0,
    readyToLockCount: 0,
  };
};

const calculateInvoiceProfit = (invoice, inventory = []) => {
  const info = getInvoiceProfitInfo(invoice, inventory);
  return info.profit === null ? null : info.profit;
};

// Convert any searchable value into a consistent lowercase string.
const normaliseSearchValue = (value) =>
  String(value ?? '').trim().toLowerCase();

// Return all useful SKU and product-description values from one invoice item.
// Several possible property names are supported because older and newer
// invoices may store product data under different keys.
const getInvoiceItemSearchValues = (item) => {
  if (!item || typeof item !== 'object') return [];

  return [
    item.sku,
    item.SKU,
    item.productSku,
    item.product_sku,
    item.code,
    item.itemCode,
    item.item_code,
    item.productCode,
    item.product_code,

    item.description,
    item.Description,
    item.productDescription,
    item.product_description,
    item.itemDescription,
    item.item_description,

    item.name,
    item.Name,
    item.productName,
    item.product_name,
    item.itemName,
    item.item_name,

    item.product?.sku,
    item.product?.SKU,
    item.product?.code,
    item.product?.description,
    item.product?.name,
  ]
    .map(normaliseSearchValue)
    .filter(Boolean);
};

// Search customer, invoice number, SKU and product description.
// Every typed word must appear somewhere in the invoice, while the words
// may match different fields or different invoice items.
const invoiceMatchesSearch = (invoice, searchTerm) => {
  const searchTokens = normaliseSearchValue(searchTerm)
    .split(/\s+/)
    .filter(Boolean);

  if (searchTokens.length === 0) return true;

  const invoiceItems = Array.isArray(invoice?.items) ? invoice.items : [];

  const searchableValues = [
    invoice?.customer,
    invoice?.customerName,
    invoice?.customer_name,
    invoice?.number,
    invoice?.invoiceNumber,
    invoice?.invoice_number,
    invoice?.id,
    ...invoiceItems.flatMap(getInvoiceItemSearchValues),
  ]
    .map(normaliseSearchValue)
    .filter(Boolean);

  const combinedSearchText = searchableValues.join(' ');

  return searchTokens.every((token) => combinedSearchText.includes(token));
};


// ============================================================================
// PROFIT BREAKDOWN MODAL
// ============================================================================
function ProfitBreakdownModal({
  invoice,
  inventory,
  onClose,
  onViewInvoice,
  onLockResolvedCosts,
}) {
  const [itemFilter, setItemFilter] = useState('all');
  const [itemSearch, setItemSearch] = useState('');
  const [isLocking, setIsLocking] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const breakdown = useMemo(
    () => buildInvoiceProfitBreakdown(invoice, inventory),
    [invoice, inventory]
  );

  const profitInfo = useMemo(
    () => getInvoiceProfitInfo(invoice, inventory),
    [invoice, inventory]
  );

  const visibleRows = useMemo(() => {
    const search = itemSearch.trim().toLowerCase();

    return breakdown.rows.filter((row) => {
      const matchesFilter =
        itemFilter === 'all'
          ? true
          : itemFilter === 'attention'
            ? row.needsReview
            : itemFilter === 'ready'
              ? row.canLockCurrentCost && !row.needsReview
              : itemFilter === 'locked'
                ? row.source === 'locked_snapshot'
                : true;

      if (!matchesFilter) return false;
      if (!search) return true;

      return [
        row.name,
        row.sku,
        row.itemId,
        row.invoiceUnit,
        row.sourceLabel,
        row.reviewReason,
      ]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(search));
    });
  }, [breakdown.rows, itemFilter, itemSearch]);

  const handleLock = async () => {
    if (!onLockResolvedCosts || breakdown.currentCostRows.length === 0) {
      return;
    }

    setIsLocking(true);
    setActionMessage('');

    try {
      const result = await onLockResolvedCosts(invoice);

      if (result?.lockedCount > 0) {
        setActionMessage(
          result.remainingCount > 0
            ? `${result.lockedCount} available cost${result.lockedCount === 1 ? '' : 's'} locked. ${result.remainingCount} item${result.remainingCount === 1 ? '' : 's'} still need attention.`
            : `${result.lockedCount} available cost${result.lockedCount === 1 ? '' : 's'} locked. Profit is now fully calculated.`
        );
      }
    } catch (error) {
      setActionMessage(`Unable to lock costs: ${error.message}`);
    } finally {
      setIsLocking(false);
    }
  };

  const isLegacy =
    invoice?.profit_is_estimated === true ||
    String(invoice?.profit_basis || '').startsWith('legacy');

  const statusText = profitInfo.needsReview
    ? 'Needs cost review'
    : profitInfo.source === 'current_cost_estimate'
      ? 'Current-cost estimate'
      : isLegacy
        ? 'Legacy estimate • locked'
        : 'Locked profit';

  const statusClasses = profitInfo.needsReview
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : profitInfo.source === 'current_cost_estimate'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : isLegacy
        ? 'bg-violet-100 text-violet-700 border-violet-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  const hasVariance =
    breakdown.hasAuthoritativeStoredProfit &&
    Math.abs(Number(breakdown.storedVariance) || 0) > 0.01;

  return (
    <div
      className="fixed inset-0 z-[7500] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[1450px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-6 border-b border-slate-200 bg-slate-50 px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Calculator size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Profit Breakdown
                </p>
                <h2 className="mt-0.5 text-xl font-black text-slate-900">
                  Invoice #{String(invoice?.number || invoice?.id || '')}
                </h2>
              </div>
              <span className={`ml-1 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${statusClasses}`}>
                {statusText}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-semibold text-slate-500">
              <span>{String(invoice?.customer || 'Unknown customer')}</span>
              <span>{String(invoice?.date || '')}</span>
              <span>
                Invoice total incl. GST: ${formatMoney(Number(invoice?.total) || 0)}
              </span>
              <span className="font-black text-slate-400">
                Profit excludes GST
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close profit breakdown"
          >
            <X size={20} />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-5 sm:px-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                Sales excl. GST
              </p>
              <p className="mt-2 text-xl font-black text-slate-900">
                ${formatMoney(breakdown.subtotal)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                Product Cost
              </p>
              <p className="mt-2 text-xl font-black text-slate-900">
                {profitInfo.costTotal === null
                  ? `$${formatMoney(breakdown.knownCostTotal)} known`
                  : `$${formatMoney(profitInfo.costTotal)}`}
              </p>
            </div>

            <div className={`rounded-2xl border p-4 ${
              profitInfo.profit === null
                ? 'border-amber-200 bg-amber-50'
                : 'border-emerald-200 bg-emerald-50'
            }`}>
              <p className={`text-[9px] font-black uppercase tracking-[0.16em] ${
                profitInfo.profit === null ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                Gross Profit
              </p>
              <p className={`mt-2 text-xl font-black ${
                profitInfo.profit === null ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                {profitInfo.profit === null
                  ? 'Needs review'
                  : `$${formatMoney(profitInfo.profit)}`}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                Gross Margin
              </p>
              <p className="mt-2 text-xl font-black text-slate-900">
                {profitInfo.marginPct === null
                  ? '—'
                  : `${Number(profitInfo.marginPct).toFixed(2)}%`}
              </p>
            </div>

            <div className={`rounded-2xl border p-4 ${
              breakdown.unresolvedRows.length > 0
                ? 'border-amber-200 bg-amber-50'
                : breakdown.currentCostRows.length > 0
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-emerald-200 bg-emerald-50'
            }`}>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                Cost Status
              </p>
              <p className="mt-2 text-xl font-black text-slate-900">
                {breakdown.unresolvedRows.length > 0
                  ? `${breakdown.unresolvedRows.length} issue${breakdown.unresolvedRows.length === 1 ? '' : 's'}`
                  : breakdown.currentCostRows.length > 0
                    ? `${breakdown.currentCostRows.length} ready`
                    : 'Complete'}
              </p>
            </div>
          </div>

          {breakdown.unresolvedRows.length > 0 && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-black text-amber-800">
                  Final profit is intentionally withheld.
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-700">
                  At least one item has no safe cost. The table below shows exactly which item needs attention, instead of treating the missing cost as $0.
                </p>
              </div>
            </div>
          )}

          {breakdown.currentCostRows.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-blue-600" />
                <div>
                  <p className="text-xs font-black text-blue-800">
                    {breakdown.currentCostRows.length} item{breakdown.currentCostRows.length === 1 ? '' : 's'} now have a usable current inventory cost.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-blue-700">
                    They are included in the current estimate but are not historical snapshots yet. Locking copies those costs into this invoice so later inventory changes cannot move the result.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLock}
                disabled={isLocking}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Lock size={14} className="mr-2" />
                {isLocking ? 'Locking…' : 'Lock Available Costs'}
              </button>
            </div>
          )}

          {hasVariance && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
              <div>
                <p className="text-xs font-black text-red-800">
                  Stored profit does not match the current line breakdown.
                </p>
                <p className="mt-1 text-xs leading-5 text-red-700">
                  Difference: ${formatMoney(Math.abs(breakdown.storedVariance))}. This can happen after unusual manual or legacy edits. Review this invoice before relying on it in a formal report.
                </p>
              </div>
            </div>
          )}

          {actionMessage && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
              {actionMessage}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                ['all', `All (${breakdown.rows.length})`],
                ['attention', `Needs attention (${breakdown.unresolvedRows.length})`],
                ['ready', `Ready to lock (${breakdown.currentCostRows.length})`],
                ['locked', `Locked (${breakdown.rows.filter((row) => row.source === 'locked_snapshot').length})`],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setItemFilter(value)}
                  className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                    itemFilter === value
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex w-full items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm lg:w-72">
              <Search size={14} className="mr-2 shrink-0 text-slate-400" />
              <input
                type="text"
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
                placeholder="Search product / SKU..."
                className="w-full bg-transparent text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400"
              />
              {itemSearch && (
                <button
                  type="button"
                  onClick={() => setItemSearch('')}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 pl-8">Item</th>
                  <th className="px-4 py-3 text-center">Qty / Unit</th>
                  <th className="px-4 py-3 text-right">Sell / Unit</th>
                  <th className="px-4 py-3 text-right">Sales</th>
                  <th className="px-4 py-3 text-right">Cost / Unit</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                  <th className="px-4 py-3 text-right">Margin</th>
                  <th className="px-5 py-3 pr-8">Cost Source</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleRows.map((row) => (
                  <tr
                    key={`${row.itemIndex}-${row.itemId}-${row.name}`}
                    className={
                      row.needsReview
                        ? 'bg-amber-50/60'
                        : row.canLockCurrentCost
                          ? 'bg-blue-50/40'
                          : 'bg-white'
                    }
                  >
                    <td className="px-5 py-4 pl-8">
                      <p className="max-w-[340px] font-black text-slate-800">
                        {row.name}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        {row.sku && <span>SKU: {row.sku}</span>}
                        {row.itemId && <span>ID: {row.itemId}</span>}
                      </div>
                      {row.reviewReason && (
                        <p className="mt-2 max-w-[420px] text-[10px] font-semibold leading-4 text-amber-700">
                          {row.reviewReason}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center font-bold text-slate-700">
                      {row.qty} {row.invoiceUnit || ''}
                    </td>

                    <td className="px-4 py-4 text-right font-mono font-bold text-slate-700">
                      ${formatMoney(row.sellPrice)}
                    </td>

                    <td className="px-4 py-4 text-right font-mono font-black text-slate-900">
                      ${formatMoney(row.revenue)}
                    </td>

                    <td className="px-4 py-4 text-right font-mono font-bold">
                      {row.costPrice === null ? (
                        <span className="text-amber-600">—</span>
                      ) : (
                        <span className="text-slate-700">
                          ${formatMoney(row.costPrice)}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right font-mono font-bold">
                      {row.lineCost === null ? (
                        <span className="text-amber-600">—</span>
                      ) : (
                        <span className="text-slate-700">
                          ${formatMoney(row.lineCost)}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right font-mono font-black">
                      {row.lineProfit === null ? (
                        <span className="text-amber-600">—</span>
                      ) : (
                        <span className={row.lineProfit < 0 ? 'text-red-600' : 'text-emerald-600'}>
                          ${formatMoney(row.lineProfit)}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right font-black text-slate-600">
                      {row.marginPct === null
                        ? '—'
                        : `${Number(row.marginPct).toFixed(1)}%`}
                    </td>

                    <td className="px-5 py-4 pr-8">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                          row.needsReview
                            ? 'border-amber-200 bg-amber-100 text-amber-700'
                            : row.canLockCurrentCost
                              ? 'border-blue-200 bg-blue-100 text-blue-700'
                              : 'border-emerald-200 bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {row.sourceLabel}
                      </span>

                      {row.canLockCurrentCost && (
                        <p className="mt-1.5 text-[9px] font-semibold text-blue-600">
                          Ready to lock
                        </p>
                      )}

                      {row.source === 'locked_snapshot' && row.inventoryUnit && (
                        <p className="mt-1.5 text-[9px] font-semibold text-slate-400">
                          Cost unit: {row.inventoryUnit}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}

                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan="9" className="px-8 py-14 text-center">
                      <p className="text-sm font-black text-slate-600">
                        No items match this view
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Try a different profit-status filter or search term.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="max-w-3xl text-[10px] font-semibold leading-5 text-slate-400">
            Profit = sales excluding GST − product cost. Locked line costs are never replaced by later inventory cost changes. Only unresolved historical lines may use today's inventory cost until you lock them.
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 transition-colors hover:bg-slate-50"
            >
              Close
            </button>

            <button
              type="button"
              onClick={() => onViewInvoice?.(invoice)}
              className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-slate-800"
            >
              <Eye size={14} className="mr-2" />
              View Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InvoiceModule({ sys }) {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [termFilter, setTermFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('number_desc');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [profitBreakdownInvoice, setProfitBreakdownInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  const [pricingGroups, setPricingGroups] = useState([]);

  // This module now performs its own complete Supabase invoice refresh so it
  // can be tested without changing the app-wide loader first.
  const [isRefreshingInvoices, setIsRefreshingInvoices] = useState(false);
  const [invoiceLoadError, setInvoiceLoadError] = useState('');
  const [lastInvoiceRefresh, setLastInvoiceRefresh] = useState(null);
  
  // Auto-reset back to Page 1 whenever the user searches or changes a filter
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter, termFilter, sortOption]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const { data, error } = await supabase.from('pricing_groups').select('*');
        if (!error && data) setPricingGroups(data);
      } catch (err) { console.error("Error fetching pricing groups:", err); }
    };
    fetchGroups();
  }, [isGeneratorOpen]);

  const refreshAllInvoices = async () => {
    setIsRefreshingInvoices(true);
    setInvoiceLoadError('');

    try {
      const allInvoices = await fetchAllInvoiceRows();

      if (typeof sys?.setInvoices === 'function') {
        sys.setInvoices(allInvoices);
      }

      setLastInvoiceRefresh(new Date());
      return allInvoices;
    } catch (error) {
      console.error('Failed to load all invoices:', error);
      setInvoiceLoadError(
        error?.message || 'Unable to refresh invoices from Supabase.'
      );
      throw error;
    } finally {
      setIsRefreshingInvoices(false);
    }
  };

  // Test fix: when Invoice History opens, load the complete invoices table
  // directly in stable batches rather than relying only on the app-wide
  // initial sys.invoices payload.
  useEffect(() => {
    let cancelled = false;

    const loadAllInvoices = async () => {
      setIsRefreshingInvoices(true);
      setInvoiceLoadError('');

      try {
        const allInvoices = await fetchAllInvoiceRows();

        if (!cancelled && typeof sys?.setInvoices === 'function') {
          sys.setInvoices(allInvoices);
          setLastInvoiceRefresh(new Date());
        }
      } catch (error) {
        console.error('Failed to load all invoices:', error);

        if (!cancelled) {
          setInvoiceLoadError(
            error?.message || 'Unable to refresh invoices from Supabase.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsRefreshingInvoices(false);
        }
      }
    };

    loadAllInvoices();

    return () => {
      cancelled = true;
    };
    // Run once when this module mounts. Use the Refresh Invoices button to
    // re-sync later if another user creates invoices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];

  const handleDeleteInvoice = async (e, invoiceId) => {
    e.stopPropagation(); 
    if (window.confirm("Are you sure you want to permanently delete this invoice? This cannot be undone.")) {
      try {
        const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
        if (error) throw error;
        
        const updatedInvoices = safeInvoices.filter(inv => inv?.id !== invoiceId);
        sys.setInvoices(updatedInvoices);
        if (sys.deleteRecord) { await sys.deleteRecord('invoices', invoiceId); }
      } catch (err) { alert(`Failed to delete invoice: ${err.message}`); }
    }
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    try {
      const { error } = await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId);
      if (error) throw error;

      const updatedInvoices = safeInvoices.map(inv => { if (inv?.id === invoiceId) { return { ...inv, status: newStatus }; } return inv; });
      sys.setInvoices(updatedInvoices);
    } catch (err) { alert(`Failed to update status: ${err.message}`); }
  };

  const handleLockResolvedCosts = async (invoice) => {
    if (!invoice?.id) {
      throw new Error('Invoice ID is missing.');
    }

    const items = Array.isArray(invoice?.items) ? invoice.items : [];
    const currentBreakdown = buildInvoiceProfitBreakdown(
      invoice,
      safeInventory
    );

    const rowsByIndex = new Map(
      currentBreakdown.rows.map((row) => [row.itemIndex, row])
    );

    const capturedAt = new Date().toISOString();
    let lockedCount = 0;

    const nextItems = items.map((item, itemIndex) => {
      const row = rowsByIndex.get(itemIndex);

      if (
        !row ||
        !row.canLockCurrentCost ||
        row.needsReview ||
        row.costPrice === null
      ) {
        return item;
      }

      lockedCount += 1;

      return {
        ...item,
        sellingPriceSnapshot: row.sellPrice,
        lineRevenueSnapshot: row.revenue,
        costPriceSnapshot: row.costPrice,
        costSnapshotItemId: row.itemId || null,
        inventoryUnitSnapshot: row.inventoryUnit || null,
        lineCostSnapshot: row.lineCost,
        lineProfitSnapshot: row.lineProfit,
        costNeedsReview: false,
        costReviewReason: null,
        costSnapshotBasis: 'review_locked_current_cost',
        costCapturedAt: capturedAt,
      };
    });

    if (lockedCount === 0) {
      return {
        updatedInvoice: invoice,
        lockedCount: 0,
        remainingCount: currentBreakdown.unresolvedRows.length,
      };
    }

    const recalculationInvoice = {
      ...invoice,
      items: nextItems,

      // Ignore an older incomplete invoice-level summary while rebuilding it
      // from the newly locked line-level values.
      gross_profit: null,
      cost_total: null,
      gross_margin_pct: null,
      profit_missing_cost_count: 0,
    };

    const nextBreakdown = buildInvoiceProfitBreakdown(
      recalculationInvoice,
      safeInventory
    );

    const remainingCount = nextBreakdown.unresolvedRows.length;

    const costTotal =
      remainingCount === 0
        ? nextBreakdown.knownCostTotal
        : null;

    const grossProfit =
      remainingCount === 0
        ? nextBreakdown.calculatedProfit
        : null;

    const grossMarginPct =
      remainingCount === 0
        ? nextBreakdown.calculatedMarginPct
        : null;

    const subtotalExGst = nextBreakdown.subtotal;

    const existingTotal = Number(invoice?.total) || 0;
    const gstAmount =
      invoice?.gst_amount !== null &&
      invoice?.gst_amount !== undefined &&
      Number.isFinite(Number(invoice.gst_amount))
        ? Number(invoice.gst_amount)
        : Math.max(existingTotal - subtotalExGst, 0);

    const previousBasis = String(invoice?.profit_basis || '');

    const profitBasis = previousBasis.startsWith('legacy')
      ? 'legacy_backfill_resolved_current_cost'
      : 'post_invoice_cost_resolution';

    const payload = {
      items: nextItems,
      subtotal_ex_gst: subtotalExGst,
      gst_amount: gstAmount,
      cost_total: costTotal,
      gross_profit: grossProfit,
      gross_margin_pct: grossMarginPct,
      profit_basis: profitBasis,

      // Post-hoc cost resolution is still an estimate of what the historical
      // cost was, even though it is now frozen for reporting.
      profit_is_estimated: true,
      profit_missing_cost_count: remainingCount,

      // Only call the invoice fully profit-locked when every line is safe.
      profit_locked_at: remainingCount === 0 ? capturedAt : null,
    };

    const { error } = await supabase
      .from('invoices')
      .update(payload)
      .eq('id', invoice.id);

    if (error) throw error;

    const updatedInvoice = {
      ...invoice,
      ...payload,
    };

    sys.setInvoices(
      safeInvoices.map((entry) =>
        entry?.id === invoice.id ? updatedInvoice : entry
      )
    );

    setProfitBreakdownInvoice(updatedInvoice);

    return {
      updatedInvoice,
      lockedCount,
      remainingCount,
    };
  };

  const filteredInvoices = useMemo(() => {
    let result = [...safeInvoices];
    if (searchTerm.trim()) {
      result = result.filter((invoice) =>
        invoiceMatchesSearch(invoice, searchTerm)
      );
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    result = result.filter(inv => {
      if (termFilter !== 'All' && String(inv?.paymentTerms) !== termFilter) return false;
      if (filter === 'All') return true;
      const [year, month, day] = String(inv?.date || '').split('-').map(Number);
      if (!year || !month || !day) return false;
      const invDate = new Date(year, month - 1, day);
      if (isNaN(invDate.getTime())) return false; 
      invDate.setHours(0,0,0,0);
      if (filter === 'Today') return invDate.getTime() === today.getTime();
      if (filter === 'This Week') { const diffDays = Math.ceil(Math.abs(today - invDate) / (1000 * 60 * 60 * 24)); return diffDays <= 7; }
      if (filter === 'This Month') return invDate.getMonth() === today.getMonth() && invDate.getFullYear() === today.getFullYear();
      return true;
    });

    result.sort((a, b) => {
      const dateA = new Date(a?.date || 0).getTime() || 0; const dateB = new Date(b?.date || 0).getTime() || 0;
      const numA = String(a?.number || a?.id || ''); const numB = String(b?.number || b?.id || '');
      const totA = Number(a?.total) || 0; const totB = Number(b?.total) || 0;
      const profA = calculateInvoiceProfit(a, safeInventory); const profB = calculateInvoiceProfit(b, safeInventory);
      const custA = String(a?.customer || ''); const custB = String(b?.customer || '');
      
      switch (sortOption) {
        case 'date_asc': return dateA - dateB; 
        case 'number_desc': return numB.localeCompare(numA, undefined, { numeric: true });
        case 'number_asc': return numA.localeCompare(numB, undefined, { numeric: true }); 
        case 'total_desc': return totB - totA;
        case 'total_asc': return totA - totB; 
        case 'profit_desc':
          return (profB ?? Number.NEGATIVE_INFINITY) - (profA ?? Number.NEGATIVE_INFINITY);
        case 'profit_asc':
          return (profA ?? Number.POSITIVE_INFINITY) - (profB ?? Number.POSITIVE_INFINITY);
        case 'customer_asc': return custA.localeCompare(custB);
        case 'customer_desc': return custB.localeCompare(custA); 
        case 'date_desc': default: return dateB - dateA;
      }
    });
    return result;
  }, [safeInvoices, safeInventory, filter, termFilter, searchTerm, sortOption]);

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE) || 1;
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Dashboard-style summary for the currently filtered invoice list.
  // Profit totals include only invoices with a complete profit figure. We also
  // surface how many are legacy estimates / need cost review.
  const invoiceSummary = useMemo(() => {
    return filteredInvoices.reduce(
      (summary, invoice) => {
        summary.totalAmount += Number(invoice?.total) || 0;

        const profitInfo = getInvoiceProfitInfo(invoice, safeInventory);

        if (profitInfo.profit !== null) {
          summary.totalProfit += profitInfo.profit;
          summary.profitInvoiceCount += 1;
        }

        if (profitInfo.isEstimated) {
          summary.estimatedProfitCount += 1;
        }

        if (profitInfo.needsReview) {
          summary.profitReviewCount += 1;
        }

        if ((invoice?.status || 'Unpaid') === 'Unpaid') {
          summary.unpaidCount += 1;
        }

        return summary;
      },
      {
        totalAmount: 0,
        totalProfit: 0,
        profitInvoiceCount: 0,
        estimatedProfitCount: 0,
        profitReviewCount: 0,
        unpaidCount: 0,
      }
    );
  }, [filteredInvoices, safeInventory]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    filter !== 'All' ||
    termFilter !== 'All' ||
    sortOption !== 'number_desc';

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilter('All');
    setTermFilter('All');
    setSortOption('number_desc');
    setCurrentPage(1);
  };

  return (
    <div className="tl-module-ui tl-module-page p-8 h-full overflow-y-auto relative print:p-0 print:overflow-visible">
      <div className={(previewInvoice || isGeneratorOpen) ? "print:hidden" : "block tl-screen-section"}>
        <div className="tl-page-header">
          <div>
            <div className="flex items-center">
              <div className="mr-3 flex h-11 w-11 items-center justify-center border border-slate-200 bg-white text-slate-700">
                <FileText className="text-slate-700" size={24} />
              </div>
              <div>
                <h1 className="tl-page-header__title">Invoice History</h1>
                <p className="tl-page-header__subtitle">
                  Review, search and manage customer invoices from one place.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => {
                refreshAllInvoices().catch(() => {
                  // Error is displayed in the status banner below.
                });
              }}
              disabled={isRefreshingInvoices}
              className="tl-secondary-action disabled:cursor-not-allowed disabled:opacity-60"
              title="Reload every accessible invoice from Supabase"
            >
              <RotateCcw
                className={`mr-2 ${isRefreshingInvoices ? 'animate-spin' : ''}`}
                size={16}
              />
              {isRefreshingInvoices ? 'Loading Invoices…' : 'Refresh Invoices'}
            </button>

            <button
              className="tl-primary-action"
              onClick={() => setIsGeneratorOpen(true)}
            >
              <Plus className="mr-2" size={18} />
              New Invoice
            </button>
          </div>
        </div>

        {(isRefreshingInvoices || invoiceLoadError || lastInvoiceRefresh) && (
          <div
            className={`mb-4 flex flex-col gap-2 rounded-xl border px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between ${
              invoiceLoadError
                ? 'border-red-200 bg-red-50 text-red-700'
                : isRefreshingInvoices
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            <div className="font-bold">
              {invoiceLoadError
                ? `Invoice refresh failed: ${invoiceLoadError}`
                : isRefreshingInvoices
                  ? 'Loading all invoice batches from Supabase…'
                  : `Loaded ${safeInvoices.length} invoice${safeInvoices.length === 1 ? '' : 's'} from Supabase.`}
            </div>

            {!invoiceLoadError && lastInvoiceRefresh && !isRefreshingInvoices && (
              <div className="font-semibold opacity-80">
                Last refreshed {lastInvoiceRefresh.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
            )}
          </div>
        )}

        <div className="tl-metric-grid mb-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <div className="tl-metric-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="tl-metric-card__label">Invoices</p>
                <p className="tl-metric-card__value">{filteredInvoices.length}</p>
              </div>
              <div className="tl-metric-card__icon">
                <FileText size={20} />
              </div>
            </div>
            <p className="tl-metric-card__helper">Matching the current view</p>
          </div>

          <div className="tl-metric-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="tl-metric-card__label">Invoice Value</p>
                <p className="tl-metric-card__value">${formatMoney(invoiceSummary.totalAmount)}</p>
              </div>
              <div className="tl-metric-card__icon">
                <DollarSign size={20} />
              </div>
            </div>
            <p className="tl-metric-card__helper">Total value in this result set</p>
          </div>

          <div className="tl-metric-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="tl-metric-card__label">Gross Profit</p>
                <p className="tl-metric-card__value">${formatMoney(invoiceSummary.totalProfit)}</p>
              </div>
              <div className="tl-metric-card__icon">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="tl-metric-card__helper">
              {invoiceSummary.profitReviewCount > 0
                ? `${invoiceSummary.profitReviewCount} invoice${invoiceSummary.profitReviewCount === 1 ? '' : 's'} need cost review.`
                : invoiceSummary.estimatedProfitCount > 0
                  ? `${invoiceSummary.estimatedProfitCount} legacy/current-cost estimate${invoiceSummary.estimatedProfitCount === 1 ? '' : 's'} included.`
                  : 'Uses locked historical cost snapshots.'}
            </p>
          </div>

          <div className="tl-metric-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="tl-metric-card__label">Unpaid</p>
                <p className="tl-metric-card__value">{invoiceSummary.unpaidCount}</p>
              </div>
              <div className="tl-metric-card__icon">
                <Clock3 size={20} />
              </div>
            </div>
            <p className="tl-metric-card__helper">Invoices still awaiting payment</p>
          </div>
        </div>

        <div className="tl-data-panel flex flex-col">
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Find an invoice</p>
                <p className="mt-0.5 text-xs text-slate-500">Search by customer, invoice number, SKU or product description.</p>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <RotateCcw size={14} className="mr-1.5" />
                  Reset filters
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="tl-segmented w-full overflow-x-auto xl:w-auto">
                {['All', 'Today', 'This Week', 'This Month'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setFilter(opt)}
                    className={`tl-segmented__item whitespace-nowrap ${filter === opt ? 'is-active' : ''}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
              <div className="tl-control-group relative flex items-center w-full sm:w-36">
                <Filter className="text-slate-400 mr-2 shrink-0" size={16} />
                <select className="w-full bg-transparent outline-none text-xs font-bold text-slate-700 cursor-pointer appearance-none" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
                  <option value="All">All Terms</option><option value="cod">C.O.D</option><option value="30_days">30 Days</option><option value="paynow">PayNow</option>
                </select>
              </div>

              <div className="tl-control-group relative flex items-center w-full sm:w-48">
                <ArrowUpDown className="text-slate-400 mr-2 shrink-0" size={16} />
                <select className="w-full bg-transparent outline-none text-xs font-bold text-slate-700 cursor-pointer appearance-none" value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                  <option value="number_desc">Invoice No. (Highest)</option>
                  <option value="number_asc">Invoice No. (Lowest)</option>
                  <option value="date_desc">Date (Newest First)</option>
                  <option value="date_asc">Date (Oldest First)</option>
                  <option value="total_desc">Amount (Highest)</option>
                  <option value="total_asc">Amount (Lowest)</option>
                  <option value="profit_desc">Profit (Highest)</option>
                  <option value="profit_asc">Profit (Lowest)</option>
                  <option value="customer_asc">Customer (A-Z)</option>
                  <option value="customer_desc">Customer (Z-A)</option>
                </select>
              </div>

              <div className="tl-search-control flex w-full items-center sm:w-72">
                <Search className="mr-2 shrink-0 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Customer, invoice no., SKU or product..."
                  className="w-full bg-transparent text-[13px] outline-none placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="ml-2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  <th className="p-5 pl-8">Invoice No.</th>
                  <th className="p-5">Date</th>
                  <th className="p-5">Customer</th>
                  <th className="p-4 text-center">Terms</th>
                  <th className="p-5 text-right">Total</th>
                  <th className="p-5 text-right">Profit</th>
                  <th className="p-5 text-center">Status</th>
                  <th className="p-5 text-center w-20">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedInvoices.map((inv) => {
                  const profitInfo = getInvoiceProfitInfo(inv, safeInventory);
                  const invoiceProfit = profitInfo.profit;

                  return (
                    <tr key={inv?.id} className="group cursor-pointer transition-colors hover:bg-[#f8fafb]" onClick={() => setPreviewInvoice(inv)}>
                      <td className="p-4 pl-5 font-mono font-semibold text-[#2457a6] whitespace-nowrap">
                        #{String(inv?.number || inv?.id || '')}
                        {inv?.isSpecialFormat && <span className="ml-2 bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-black inline-flex items-center"><ScanBarcode size={8} className="mr-0.5" /> Spec</span>}
                      </td>
                      <td className="p-4 text-slate-500 whitespace-nowrap">{String(inv?.date || '')}</td>
                      <td className="p-4 text-slate-800 font-medium whitespace-nowrap">{String(inv?.customer || '')}</td>
                      <td className="p-5 text-center">
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md whitespace-nowrap">
                          {inv?.paymentTerms === 'cod' ? 'C.O.D' : inv?.paymentTerms === 'paynow' ? 'PayNow' : '30 Days'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-semibold text-slate-900 whitespace-nowrap">${formatMoney(inv?.total)}</td>
                      <td
                        className="p-3 text-right whitespace-nowrap"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setProfitBreakdownInvoice(inv)}
                          className={`group/profit inline-flex min-w-[118px] flex-col items-end rounded-xl border px-3 py-2 text-right transition-all ${
                            invoiceProfit === null
                              ? 'border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100'
                              : profitInfo.source === 'current_cost_estimate'
                                ? 'border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100'
                                : 'border-transparent hover:border-emerald-200 hover:bg-emerald-50'
                          }`}
                          title="Click to view item-by-item profit breakdown"
                        >
                          {invoiceProfit === null ? (
                            <>
                              <span className="flex items-center text-xs font-black text-amber-700">
                                <AlertCircle size={12} className="mr-1.5" />
                                NEEDS COST
                              </span>
                              <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600">
                                {profitInfo.missingCostCount > 0
                                  ? `${profitInfo.missingCostCount} item${profitInfo.missingCostCount === 1 ? '' : 's'}`
                                  : 'Review'}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="flex items-center font-black text-emerald-600">
                                ${formatMoney(invoiceProfit)}
                                <Calculator
                                  size={12}
                                  className="ml-1.5 opacity-40 transition-opacity group-hover/profit:opacity-100"
                                />
                              </span>
                              <span
                                className={`mt-0.5 text-[9px] font-black uppercase tracking-wider ${
                                  profitInfo.source === 'current_cost_estimate'
                                    ? 'text-blue-600'
                                    : profitInfo.isEstimated
                                      ? 'text-amber-500'
                                      : 'text-slate-400'
                                }`}
                              >
                                {profitInfo.source === 'current_cost_estimate'
                                  ? 'Current estimate'
                                  : profitInfo.isEstimated
                                    ? 'Legacy estimate'
                                    : 'Locked'}
                              </span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="p-5 text-center">
                        <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                          <select value={inv?.status || 'Unpaid'} onChange={(e) => handleStatusChange(inv.id, e.target.value)} className={`appearance-none cursor-pointer pl-8 pr-8 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none transition-all ${(inv?.status || 'Unpaid') === 'Paid' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200' : 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200'}`}>
                            <option value="Paid">PAID</option><option value="Unpaid">UNPAID</option>
                          </select>
                          <div className="absolute left-2.5 pointer-events-none">{(inv?.status || 'Unpaid') === 'Paid' ? <CheckCircle size={12} className="text-emerald-600" /> : <AlertCircle size={12} className="text-orange-600" />}</div>
                          <div className="absolute right-2.5 pointer-events-none"><ChevronDown size={12} className={(inv?.status || 'Unpaid') === 'Paid' ? "text-emerald-600" : "text-orange-600"} /></div>
                        </div>
                      </td>
                      <td className="p-5 text-center"><button onClick={(e) => handleDeleteInvoice(e, inv?.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18} /></button></td>
                    </tr>
                  );
                })}
                {paginatedInvoices.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Search size={24} />
                      </div>
                      <p className="mt-4 text-sm font-bold text-slate-700">No matching invoices</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Try a different customer, invoice number, SKU, product description, date range or payment term.
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="mt-4 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50"
                        >
                          <RotateCcw size={14} className="mr-1.5" />
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ===== PAGINATION CONTROLS ===== */}
          {totalPages > 1 && (
            <div className="flex shrink-0 flex-col gap-4 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredInvoices.length)} of {filteredInvoices.length} invoices
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center shadow-sm"
                >
                  <ChevronLeft size={16} className="mr-1" /> Prev
                </button>
                <div className="flex items-center px-4 font-black text-xs text-slate-700 uppercase tracking-widest">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center shadow-sm"
                >
                  Next <ChevronRight size={16} className="ml-1" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {profitBreakdownInvoice && (
        <ProfitBreakdownModal
          invoice={profitBreakdownInvoice}
          inventory={safeInventory}
          onClose={() => setProfitBreakdownInvoice(null)}
          onLockResolvedCosts={handleLockResolvedCosts}
          onViewInvoice={(invoice) => {
            setProfitBreakdownInvoice(null);
            setPreviewInvoice(invoice);
          }}
        />
      )}

      {previewInvoice && <InvoicePreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} sys={sys} onEdit={(inv) => { setEditingInvoice(inv); setIsGeneratorOpen(true); setPreviewInvoice(null); }} />}
      {isGeneratorOpen && <InvoiceGenerator sys={sys} groups={pricingGroups} setGroups={setPricingGroups} existingInvoice={editingInvoice} onClose={() => { setIsGeneratorOpen(false); setEditingInvoice(null); }} />}
    </div>
  );
}
