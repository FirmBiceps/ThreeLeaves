import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  Plus,
  RotateCcw,
  Search,
  ScanBarcode,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
  Calculator,
  Eye,
  Lock,
} from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';
import { CashGenerator } from './CashGenerator';
import { CashPreviewModal } from './CashPreview';

const ITEMS_PER_PAGE = 30;

const normaliseSearchValue = (value) => String(value ?? '').trim().toLowerCase();

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

const cashInvoiceMatchesSearch = (invoice, searchTerm) => {
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
    invoice?.id,
    ...invoiceItems.flatMap(getInvoiceItemSearchValues),
  ]
    .map(normaliseSearchValue)
    .filter(Boolean);

  const combinedSearchText = searchableValues.join(' ');
  return searchTokens.every((token) => combinedSearchText.includes(token));
};

function getProductCost(product) {
  const rawValue =
    product?.['cost_price (SGD)'] ??
    product?.cost_price ??
    product?.costPrice ??
    null;

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  const value = Number(rawValue);

  // Never silently treat a blank/zero cost as "free".
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getSnapshotCost(item) {
  const rawValue =
    item?.costPriceSnapshot ??
    item?.cost_price_snapshot ??
    null;

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function getLineQty(item) {
  return Number(item?.qty ?? item?.quantity ?? 0) || 0;
}

function getLineSellPrice(item) {
  return Number(item?.unitPrice ?? item?.price ?? item?.Price ?? 0) || 0;
}

function getLineUnit(item) {
  return String(item?.unit ?? item?.Unit ?? '').trim();
}

function getInventoryUnit(product) {
  return String(product?.Unit ?? product?.unit ?? '').trim();
}

function getLineProductName(item, product) {
  return String(
    item?.name ??
      item?.Name ??
      item?.description ??
      item?.Description ??
      product?.Name ??
      product?.name ??
      product?.Items ??
      'Unnamed item'
  );
}

function getLineProductSku(item, product) {
  return String(
    item?.sku ??
      item?.SKU ??
      item?.productSku ??
      item?.product_sku ??
      product?.SKU ??
      product?.sku ??
      ''
  );
}

function getCashProfitLineDetail(item, itemIndex, inventory = []) {
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

  const snapshotMatchesProduct =
    snapshotCost !== null &&
    (!snapshotItemId || !itemId || snapshotItemId === itemId);

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
  } else if (!product) {
    needsReview = true;
    source = 'product_missing';
    sourceLabel = 'Product not found';
    reviewReason =
      'This cash-invoice item cannot be matched to the current product list.';
  } else {
    const currentCost = getProductCost(product);

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
      // Existing Cash invoices without a historical snapshot may temporarily
      // use today's inventory cost. This is an estimate until explicitly locked.
      costPrice = currentCost;
      source = 'current_inventory';
      sourceLabel = 'Current cost';
      canLockCurrentCost = true;
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
    name: getLineProductName(item, product),
    sku: getLineProductSku(item, product),
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
}

function buildCashProfitBreakdown(invoice, inventory = []) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];

  const rows = items.map((item, itemIndex) =>
    getCashProfitLineDetail(item, itemIndex, inventory)
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
    storedProfit !== null && storedMissingCount === 0;

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
    hasAuthoritativeStoredProfit && calculatedProfit !== null
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
}

function getCashProfitInfo(invoice, inventory = []) {
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

  const breakdown = buildCashProfitBreakdown(invoice, inventory);

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
      missingCostCount: breakdown.unresolvedRows.length,
      readyToLockCount: breakdown.currentCostRows.length,
    };
  }

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
}

function calculateCashProfit(invoice, inventory = []) {
  const info = getCashProfitInfo(invoice, inventory);
  return info.profit;
}

// ============================================================================
// CASH PROFIT BREAKDOWN MODAL
// ============================================================================
function CashProfitBreakdownModal({
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
    () => buildCashProfitBreakdown(invoice, inventory),
    [invoice, inventory]
  );

  const profitInfo = useMemo(
    () => getCashProfitInfo(invoice, inventory),
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
                  Cash Profit Breakdown
                </p>
                <h2 className="mt-0.5 text-xl font-black text-slate-900">
                  {String(invoice?.number || invoice?.id || '')}
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
                Cash total incl. GST: ${formatMoney(Number(invoice?.total) || 0)}
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
            aria-label="Close cash profit breakdown"
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
                  At least one item has no safe cost. Missing cost is never treated as $0, because that would make profit equal sales and overstate profitability.
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
                    {breakdown.currentCostRows.length} historical item{breakdown.currentCostRows.length === 1 ? '' : 's'} currently use today's inventory cost.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-blue-700">
                    The estimate is usable now, but lock these available costs to stop future inventory price changes from moving this cash invoice's profit.
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
                  Difference: ${formatMoney(Math.abs(breakdown.storedVariance))}. Review the cash invoice before using it in a formal report.
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
            Profit = sales excluding GST − product cost. Missing cost never becomes $0. Locked line costs are not replaced by later inventory cost changes.
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
              View Cash Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CashModule({ sys }) {
  const [cashInvoices, setCashInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [gstFilter, setGstFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('number_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [profitBreakdownInvoice, setProfitBreakdownInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [pricingGroups, setPricingGroups] = useState([]);

  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];

  const fetchCashInvoices = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data, error } = await supabase
        .from('cash_invoices')
        .select('*')
        .order('date', { ascending: false })
        .order('number', { ascending: false });
      if (error) throw error;
      setCashInvoices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load cash invoices:', error);
      setLoadError(error?.message || 'Unable to load cash invoices.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchCashInvoices();
  }, []);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const { data, error } = await supabase.from('pricing_groups').select('*');
        if (!error && data) setPricingGroups(data);
      } catch (error) {
        console.error('Error fetching pricing groups:', error);
      }
    };
    void fetchGroups();
  }, [isGeneratorOpen]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter, gstFilter, sortOption]);

  const handleDeleteInvoice = async (event, invoiceId) => {
    event.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this cash invoice? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('cash_invoices')
        .delete()
        .eq('id', invoiceId);
      if (error) throw error;
      setCashInvoices((current) => current.filter((invoice) => invoice?.id !== invoiceId));
      if (previewInvoice?.id === invoiceId) setPreviewInvoice(null);
    } catch (error) {
      window.alert(`Failed to delete cash invoice: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    try {
      const { error } = await supabase
        .from('cash_invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId);
      if (error) throw error;

      setCashInvoices((current) =>
        current.map((invoice) =>
          invoice?.id === invoiceId ? { ...invoice, status: newStatus } : invoice
        )
      );
    } catch (error) {
      window.alert(`Failed to update status: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleLockResolvedCosts = async (invoice) => {
    if (!invoice?.id) {
      throw new Error('Cash invoice ID is missing.');
    }

    const items = Array.isArray(invoice?.items) ? invoice.items : [];
    const currentBreakdown = buildCashProfitBreakdown(
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
      gross_profit: null,
      cost_total: null,
      gross_margin_pct: null,
      profit_missing_cost_count: 0,
    };

    const nextBreakdown = buildCashProfitBreakdown(
      recalculationInvoice,
      safeInventory
    );

    const remainingCount = nextBreakdown.unresolvedRows.length;

    const payload = {
      items: nextItems,
      cost_total:
        remainingCount === 0
          ? nextBreakdown.knownCostTotal
          : null,
      gross_profit:
        remainingCount === 0
          ? nextBreakdown.calculatedProfit
          : null,
      gross_margin_pct:
        remainingCount === 0
          ? nextBreakdown.calculatedMarginPct
          : null,
      profit_basis: String(invoice?.profit_basis || '').startsWith('legacy')
        ? 'legacy_backfill_resolved_current_cost'
        : 'post_cash_invoice_cost_resolution',

      // Post-hoc historical reconstruction remains marked estimated for audit.
      profit_is_estimated: true,
      profit_missing_cost_count: remainingCount,
      profit_locked_at: remainingCount === 0 ? capturedAt : null,
    };

    const { error } = await supabase
      .from('cash_invoices')
      .update(payload)
      .eq('id', invoice.id);

    if (error) throw error;

    const updatedInvoice = {
      ...invoice,
      ...payload,
    };

    setCashInvoices((current) =>
      current.map((entry) =>
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
    let result = [...cashInvoices];

    if (searchTerm.trim()) {
      result = result.filter((invoice) => cashInvoiceMatchesSearch(invoice, searchTerm));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    result = result.filter((invoice) => {
      if (gstFilter === 'With GST' && invoice?.includeGst === false) return false;
      if (gstFilter === 'No GST' && invoice?.includeGst !== false) return false;
      if (filter === 'All') return true;

      const [year, month, day] = String(invoice?.date || '').split('-').map(Number);
      if (!year || !month || !day) return false;
      const invoiceDate = new Date(year, month - 1, day);
      if (Number.isNaN(invoiceDate.getTime())) return false;
      invoiceDate.setHours(0, 0, 0, 0);

      if (filter === 'Today') return invoiceDate.getTime() === today.getTime();
      if (filter === 'This Week') {
        const diffDays = Math.ceil(
          Math.abs(today - invoiceDate) / (1000 * 60 * 60 * 24)
        );
        return diffDays <= 7;
      }
      if (filter === 'This Month') {
        return (
          invoiceDate.getMonth() === today.getMonth() &&
          invoiceDate.getFullYear() === today.getFullYear()
        );
      }
      return true;
    });

    result.sort((left, right) => {
      const dateA = new Date(left?.date || 0).getTime() || 0;
      const dateB = new Date(right?.date || 0).getTime() || 0;
      const numberA = String(left?.number || left?.id || '');
      const numberB = String(right?.number || right?.id || '');
      const totalA = Number(left?.total) || 0;
      const totalB = Number(right?.total) || 0;
      const profitA = calculateCashProfit(left, safeInventory);
      const profitB = calculateCashProfit(right, safeInventory);
      const customerA = String(left?.customer || '');
      const customerB = String(right?.customer || '');

      switch (sortOption) {
        case 'date_asc':
          return dateA - dateB;
        case 'number_desc':
          return numberB.localeCompare(numberA, undefined, { numeric: true });
        case 'number_asc':
          return numberA.localeCompare(numberB, undefined, { numeric: true });
        case 'total_desc':
          return totalB - totalA;
        case 'total_asc':
          return totalA - totalB;
        case 'profit_desc':
          return (
            (profitB ?? Number.NEGATIVE_INFINITY) -
            (profitA ?? Number.NEGATIVE_INFINITY)
          );
        case 'profit_asc':
          return (
            (profitA ?? Number.POSITIVE_INFINITY) -
            (profitB ?? Number.POSITIVE_INFINITY)
          );
        case 'customer_asc':
          return customerA.localeCompare(customerB);
        case 'customer_desc':
          return customerB.localeCompare(customerA);
        case 'date_desc':
        default:
          return dateB - dateA;
      }
    });

    return result;
  }, [cashInvoices, filter, gstFilter, safeInventory, searchTerm, sortOption]);

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE) || 1;
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const cashSummary = useMemo(() => {
    return filteredInvoices.reduce(
      (summary, invoice) => {
        summary.totalAmount += Number(invoice?.total) || 0;

        const profitInfo = getCashProfitInfo(invoice, safeInventory);

        if (profitInfo.profit !== null) {
          summary.totalProfit += profitInfo.profit;
          summary.profitInvoiceCount += 1;
        }

        if (profitInfo.needsReview) {
          summary.profitReviewCount += 1;
        }

        if (profitInfo.isEstimated) {
          summary.estimatedProfitCount += 1;
        }

        if ((invoice?.status || 'Unpaid') === 'Unpaid') {
          summary.unpaidCount += 1;
        }

        if (invoice?.includeGst !== false) {
          summary.gstCount += 1;
        }

        return summary;
      },
      {
        totalAmount: 0,
        totalProfit: 0,
        profitInvoiceCount: 0,
        profitReviewCount: 0,
        estimatedProfitCount: 0,
        unpaidCount: 0,
        gstCount: 0,
      }
    );
  }, [filteredInvoices, safeInventory]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    filter !== 'All' ||
    gstFilter !== 'All' ||
    sortOption !== 'number_desc';

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilter('All');
    setGstFilter('All');
    setSortOption('number_desc');
    setCurrentPage(1);
  };

  const closeGenerator = () => {
    setIsGeneratorOpen(false);
    setEditingInvoice(null);
  };

  return (
    <div className="relative h-full overflow-y-auto p-8 print:overflow-visible print:p-0">
      <div className={previewInvoice || isGeneratorOpen ? 'print:hidden' : 'block'}>
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-center">
            <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
              <WalletCards className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Cash History</h1>
              <p className="mt-1 text-sm text-slate-500">
                Create, review, edit and manage cash invoices separately from your normal invoice ledger.
              </p>
            </div>
          </div>

          <button
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-xl active:translate-y-0"
            onClick={() => {
              setEditingInvoice(null);
              setIsGeneratorOpen(true);
            }}
            type="button"
          >
            <Plus className="mr-2" size={18} />
            New Cash Invoice
          </button>
        </div>

        {loadError && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p>Unable to load Cash records.</p>
              <p className="mt-1 text-xs font-medium text-red-500">{loadError}</p>
            </div>
            <button type="button" onClick={fetchCashInvoices} className="rounded-lg bg-white px-3 py-1.5 text-xs font-black uppercase shadow-sm">
              Retry
            </button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Cash Invoices" value={filteredInvoices.length} icon={<FileText size={20} />} />
          <SummaryCard label="Cash Value" value={`$${formatMoney(cashSummary.totalAmount)}`} icon={<DollarSign size={20} />} tone="indigo" />
          <SummaryCard
            label="Gross Profit"
            value={`$${formatMoney(cashSummary.totalProfit)}`}
            icon={<TrendingUp size={20} />}
            tone="emerald"
            subtext={
              cashSummary.profitReviewCount > 0
                ? `${cashSummary.profitReviewCount} cash invoice${cashSummary.profitReviewCount === 1 ? '' : 's'} need cost review`
                : cashSummary.estimatedProfitCount > 0
                  ? `${cashSummary.estimatedProfitCount} estimate${cashSummary.estimatedProfitCount === 1 ? '' : 's'} included`
                  : 'Uses locked historical cost snapshots'
            }
          />
          <SummaryCard label="GST Applied" value={cashSummary.gstCount} subtext={`${cashSummary.unpaidCount} unpaid in current view`} icon={<WalletCards size={20} />} tone="amber" />
        </div>

        <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Find a cash invoice</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Search by customer, cash number, SKU or product description.
                </p>
              </div>

              {hasActiveFilters && (
                <button type="button" onClick={clearAllFilters} className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-100">
                  <RotateCcw size={14} className="mr-1.5" /> Reset filters
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm xl:w-auto">
                {['All', 'Today', 'This Week', 'This Month'].map((option) => (
                  <button key={option} type="button" onClick={() => setFilter(option)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-wide transition-all ${filter === option ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
                    {option}
                  </button>
                ))}
              </div>

              <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
                <div className="relative flex w-full items-center rounded-xl border bg-white px-3 py-2 shadow-sm sm:w-40">
                  <WalletCards className="mr-2 shrink-0 text-slate-400" size={16} />
                  <select className="w-full cursor-pointer appearance-none bg-transparent text-xs font-bold text-slate-700 outline-none" value={gstFilter} onChange={(event) => setGstFilter(event.target.value)}>
                    <option value="All">All GST</option>
                    <option value="With GST">With GST</option>
                    <option value="No GST">No GST</option>
                  </select>
                </div>

                <div className="relative flex w-full items-center rounded-xl border bg-white px-3 py-2 shadow-sm sm:w-52">
                  <ArrowUpDown className="mr-2 shrink-0 text-slate-400" size={16} />
                  <select className="w-full cursor-pointer appearance-none bg-transparent text-xs font-bold text-slate-700 outline-none" value={sortOption} onChange={(event) => setSortOption(event.target.value)}>
                    <option value="number_desc">Cash No. (Highest)</option>
                    <option value="number_asc">Cash No. (Lowest)</option>
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

                <div className="flex w-full items-center rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm focus-within:border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-100 sm:w-80">
                  <Search className="mr-2 shrink-0 text-slate-400" size={16} />
                  <input type="text" placeholder="Customer, C-number, SKU or product..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
                  {searchTerm && (
                    <button type="button" onClick={() => setSearchTerm('')} className="ml-2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear search">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  <th className="p-5 pl-8">Cash No.</th>
                  <th className="p-5">Date</th>
                  <th className="p-5">Customer</th>
                  <th className="p-5 text-center">GST</th>
                  <th className="p-5 text-right">Total</th>
                  <th className="p-5 text-right">Profit</th>
                  <th className="p-5 text-center">Status</th>
                  <th className="w-20 p-5 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  <tr><td colSpan="8" className="px-6 py-16 text-center text-sm font-bold text-slate-400">Loading cash invoices…</td></tr>
                ) : paginatedInvoices.length > 0 ? (
                  paginatedInvoices.map((invoice) => {
                    const profitInfo = getCashProfitInfo(invoice, safeInventory);
                    const profit = profitInfo.profit;
                    const hasGst = invoice?.includeGst !== false;
                    return (
                      <tr key={invoice?.id} className="group cursor-pointer transition-all hover:bg-emerald-50/60" onClick={() => setPreviewInvoice(invoice)}>
                        <td className="whitespace-nowrap p-5 pl-8 font-mono font-bold text-emerald-700">
                          {String(invoice?.number || invoice?.id || '')}
                          {invoice?.isSpecialFormat && <span className="ml-2 inline-flex items-center rounded border border-purple-200 bg-purple-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-purple-700"><ScanBarcode size={8} className="mr-0.5" /> Spec</span>}
                        </td>
                        <td className="whitespace-nowrap p-5 text-slate-500">{String(invoice?.date || '')}</td>
                        <td className="whitespace-nowrap p-5 font-medium text-slate-800">{String(invoice?.customer || '')}</td>
                        <td className="p-5 text-center">
                          <span className={`whitespace-nowrap rounded-md border px-2 py-1 text-xs font-bold ${hasGst ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                            {hasGst ? 'GST 9%' : 'No GST'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap p-5 text-right font-black text-slate-900">${formatMoney(invoice?.total)}</td>
                        <td
                          className="whitespace-nowrap p-3 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setProfitBreakdownInvoice(invoice)}
                            className={`group/profit inline-flex min-w-[118px] flex-col items-end rounded-xl border px-3 py-2 text-right transition-all ${
                              profit === null
                                ? 'border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100'
                                : profitInfo.source === 'current_cost_estimate'
                                  ? 'border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100'
                                  : 'border-transparent hover:border-emerald-200 hover:bg-emerald-50'
                            }`}
                            title="Click to view item-by-item cash profit breakdown"
                          >
                            {profit === null ? (
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
                                  ${formatMoney(profit)}
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
                          <div className="relative inline-flex items-center" onClick={(event) => event.stopPropagation()}>
                            <select value={invoice?.status || 'Unpaid'} onChange={(event) => handleStatusChange(invoice.id, event.target.value)} className={`appearance-none cursor-pointer rounded-lg py-1.5 pl-8 pr-8 text-[10px] font-black uppercase tracking-widest outline-none ${(invoice?.status || 'Unpaid') === 'Paid' ? 'border border-emerald-200 bg-emerald-100 text-emerald-700' : 'border border-orange-200 bg-orange-100 text-orange-700'}`}>
                              <option value="Paid">PAID</option>
                              <option value="Unpaid">UNPAID</option>
                            </select>
                            <div className="pointer-events-none absolute left-2.5">{(invoice?.status || 'Unpaid') === 'Paid' ? <CheckCircle size={12} className="text-emerald-600" /> : <AlertCircle size={12} className="text-orange-600" />}</div>
                            <ChevronDown size={12} className="pointer-events-none absolute right-2.5 text-slate-500" />
                          </div>
                        </td>
                        <td className="p-5 text-center">
                          <button type="button" onClick={(event) => handleDeleteInvoice(event, invoice?.id)} className="rounded-lg p-2 text-slate-300 transition-all hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${invoice?.number || 'cash invoice'}`}>
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Search size={24} /></div>
                      <p className="mt-4 text-sm font-bold text-slate-700">No matching cash invoices</p>
                      <p className="mt-1 text-xs text-slate-500">Try a different customer, cash number, SKU, product description, date range or GST filter.</p>
                      {hasActiveFilters && <button type="button" onClick={clearAllFilters} className="mt-4 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50"><RotateCcw size={14} className="mr-1.5" /> Clear filters</button>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex shrink-0 flex-col gap-4 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredInvoices.length)} of {filteredInvoices.length} cash invoices
              </span>
              <div className="flex items-center space-x-2">
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} disabled={currentPage === 1} className="flex items-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><ChevronLeft size={16} className="mr-1" /> Prev</button>
                <div className="px-4 text-xs font-black uppercase tracking-widest text-slate-700">Page {currentPage} of {totalPages}</div>
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))} disabled={currentPage === totalPages} className="flex items-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Next <ChevronRight size={16} className="ml-1" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {profitBreakdownInvoice && (
        <CashProfitBreakdownModal
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

      {previewInvoice && (
        <CashPreviewModal
          invoice={previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          sys={sys}
          onEdit={(invoice) => {
            setEditingInvoice(invoice);
            setIsGeneratorOpen(true);
            setPreviewInvoice(null);
          }}
        />
      )}

      {isGeneratorOpen && (
        <CashGenerator
          sys={sys}
          groups={pricingGroups}
          setGroups={setPricingGroups}
          cashInvoices={cashInvoices}
          setCashInvoices={setCashInvoices}
          existingInvoice={editingInvoice}
          onClose={closeGenerator}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, tone = 'blue', subtext = 'Matching the current view' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${tones[tone] || tones.blue}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{subtext}</p>
    </div>
  );
}
