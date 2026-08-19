import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Filter, ArrowUpDown, Search, ScanBarcode, CheckCircle, AlertCircle, ChevronDown, Trash2, ChevronLeft, ChevronRight, DollarSign, TrendingUp, Clock3, RotateCcw, X } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';
import { InvoiceGenerator } from './InvoiceGenerator';
import { InvoicePreviewModal } from './InvoicePreview';

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
  return Number.isFinite(value) && value > 0 ? value : null;
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
    };
  }

  const missingCostCount = Number(invoice?.profit_missing_cost_count || 0);

  // 1. Authoritative invoice-level snapshot.
  if (
    invoice?.gross_profit !== null &&
    invoice?.gross_profit !== undefined &&
    invoice?.gross_profit !== '' &&
    Number.isFinite(Number(invoice.gross_profit)) &&
    missingCostCount === 0
  ) {
    return {
      profit: Number(invoice.gross_profit),
      costTotal:
        invoice?.cost_total === null || invoice?.cost_total === undefined
          ? null
          : Number(invoice.cost_total),
      marginPct:
        invoice?.gross_margin_pct === null ||
        invoice?.gross_margin_pct === undefined
          ? null
          : Number(invoice.gross_margin_pct),
      source: String(invoice?.profit_basis || 'locked_snapshot'),
      isEstimated: invoice?.profit_is_estimated === true,
      needsReview: false,
      missingCostCount: 0,
    };
  }

  const items = Array.isArray(invoice?.items) ? invoice.items : [];

  // 2. If item-level snapshots exist but invoice summary fields have not yet
  //    been populated, derive from the locked item snapshots.
  if (items.length > 0) {
    const itemSnapshotComplete = items.every((item) => {
      if (item?.costNeedsReview === true) return false;
      return (
        item?.lineCostSnapshot !== null &&
        item?.lineCostSnapshot !== undefined &&
        Number.isFinite(Number(item.lineCostSnapshot))
      );
    });

    if (itemSnapshotComplete) {
      const revenue = items.reduce(
        (sum, item) =>
          sum +
          (Number(item?.lineRevenueSnapshot) ||
            (Number(item?.qty ?? item?.quantity ?? 0) || 0) *
              (Number(item?.unitPrice ?? item?.price ?? item?.Price ?? 0) || 0)),
        0
      );

      const costTotal = items.reduce(
        (sum, item) => sum + (Number(item?.lineCostSnapshot) || 0),
        0
      );

      const profit = revenue - costTotal;

      return {
        profit,
        costTotal,
        marginPct: revenue > 0 ? (profit / revenue) * 100 : null,
        source: 'item_locked_snapshot',
        isEstimated: invoice?.profit_is_estimated === true,
        needsReview: false,
        missingCostCount: 0,
      };
    }
  }

  // 3. Transitional fallback for invoices created before cost snapshots.
  //    This uses TODAY'S inventory cost and is deliberately labelled as an
  //    estimate. Run the supplied SQL backfill to freeze this value.
  let liveRevenue = 0;
  let liveCost = 0;
  let liveMissingCostCount = 0;

  items.forEach((item) => {
    const qty = Number(item?.quantity ?? item?.qty ?? 0) || 0;
    const sellPrice =
      Number(item?.unitPrice ?? item?.price ?? item?.Price ?? 0) || 0;

    liveRevenue += qty * sellPrice;

    const product = (Array.isArray(inventory) ? inventory : []).find(
      (entry) =>
        String(entry?.id || '') === String(item?.itemId || '')
    );

    const cost = getInventoryCost(product);

    if (cost === null) {
      liveMissingCostCount += 1;
      return;
    }

    liveCost += qty * cost;
  });

  if (items.length === 0 || liveMissingCostCount > 0) {
    return {
      profit: null,
      costTotal: null,
      marginPct: null,
      source: 'needs_cost_review',
      isEstimated: true,
      needsReview: true,
      missingCostCount: liveMissingCostCount,
    };
  }

  const liveProfit = liveRevenue - liveCost;

  return {
    profit: liveProfit,
    costTotal: liveCost,
    marginPct: liveRevenue > 0 ? (liveProfit / liveRevenue) * 100 : null,
    source: 'live_current_cost_estimate',
    isEstimated: true,
    needsReview: false,
    missingCostCount: 0,
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
  const [editingInvoice, setEditingInvoice] = useState(null);

  const [pricingGroups, setPricingGroups] = useState([]);
  
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
    <div className="p-8 h-full overflow-y-auto relative print:p-0 print:overflow-visible">
      <div className={(previewInvoice || isGeneratorOpen) ? "print:hidden" : "block"}>
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center">
              <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 ring-1 ring-blue-100">
                <FileText className="text-blue-600" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Invoice History</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Review, search and manage customer invoices from one place.
                </p>
              </div>
            </div>
          </div>

          <button
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl active:translate-y-0"
            onClick={() => setIsGeneratorOpen(true)}
          >
            <Plus className="mr-2" size={18} />
            New Invoice
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Invoices</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{filteredInvoices.length}</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <FileText size={20} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Matching the current view</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Invoice Value</p>
                <p className="mt-2 text-2xl font-black text-slate-900">${formatMoney(invoiceSummary.totalAmount)}</p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
                <DollarSign size={20} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Total value in this result set</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Gross Profit</p>
                <p className="mt-2 text-2xl font-black text-emerald-600">${formatMoney(invoiceSummary.totalProfit)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {invoiceSummary.profitReviewCount > 0
                ? `${invoiceSummary.profitReviewCount} invoice${invoiceSummary.profitReviewCount === 1 ? '' : 's'} need cost review.`
                : invoiceSummary.estimatedProfitCount > 0
                  ? `${invoiceSummary.estimatedProfitCount} legacy/current-cost estimate${invoiceSummary.estimatedProfitCount === 1 ? '' : 's'} included.`
                  : 'Uses locked historical cost snapshots.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Unpaid</p>
                <p className="mt-2 text-2xl font-black text-orange-600">{invoiceSummary.unpaidCount}</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3 text-orange-600">
                <Clock3 size={20} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Invoices still awaiting payment</p>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
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
              <div className="flex w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm xl:w-auto">
                {['All', 'Today', 'This Week', 'This Month'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setFilter(opt)}
                    className={`whitespace-nowrap rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-wide transition-all ${
                      filter === opt
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
              <div className="relative flex items-center bg-white border rounded-xl shadow-sm px-3 py-2 w-full sm:w-36 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <Filter className="text-slate-400 mr-2 shrink-0" size={16} />
                <select className="w-full bg-transparent outline-none text-xs font-bold text-slate-700 cursor-pointer appearance-none" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
                  <option value="All">All Terms</option><option value="cod">C.O.D</option><option value="30_days">30 Days</option><option value="paynow">PayNow</option>
                </select>
              </div>

              <div className="relative flex items-center bg-white border rounded-xl shadow-sm px-3 py-2 w-full sm:w-48 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
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

              <div className="flex w-full items-center rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100 sm:w-72">
                <Search className="mr-2 shrink-0 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Customer, invoice no., SKU or product..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
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
                  <th className="p-5 text-center">Terms</th>
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
                    <tr key={inv?.id} className="group cursor-pointer transition-all hover:bg-blue-50/70" onClick={() => setPreviewInvoice(inv)}>
                      <td className="p-5 pl-8 font-mono font-bold text-blue-600 whitespace-nowrap">
                        #{String(inv?.number || inv?.id || '')}
                        {inv?.isSpecialFormat && <span className="ml-2 bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-black inline-flex items-center"><ScanBarcode size={8} className="mr-0.5" /> Spec</span>}
                      </td>
                      <td className="p-5 text-slate-500 whitespace-nowrap">{String(inv?.date || '')}</td>
                      <td className="p-5 text-slate-800 font-medium whitespace-nowrap">{String(inv?.customer || '')}</td>
                      <td className="p-5 text-center">
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md whitespace-nowrap">
                          {inv?.paymentTerms === 'cod' ? 'C.O.D' : inv?.paymentTerms === 'paynow' ? 'PayNow' : '30 Days'}
                        </span>
                      </td>
                      <td className="p-5 text-right font-black text-slate-900 whitespace-nowrap">${formatMoney(inv?.total)}</td>
                      <td className="p-5 text-right whitespace-nowrap">
                        {invoiceProfit === null ? (
                          <div>
                            <p className="text-xs font-black text-amber-600">NEEDS COST</p>
                            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                              Review
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-black text-emerald-600">
                              ${formatMoney(invoiceProfit)}
                            </p>
                            <p
                              className={`mt-0.5 text-[9px] font-black uppercase tracking-wider ${
                                profitInfo.isEstimated
                                  ? 'text-amber-500'
                                  : 'text-slate-400'
                              }`}
                              title={
                                profitInfo.source === 'live_current_cost_estimate'
                                  ? "Temporary estimate using today's inventory cost. Run the legacy backfill to lock it."
                                  : profitInfo.isEstimated
                                    ? 'Legacy invoice profit was backfilled using the cost available at migration time.'
                                    : 'Profit uses the historical cost snapshot saved with this invoice.'
                              }
                            >
                              {profitInfo.source === 'live_current_cost_estimate'
                                ? 'Live estimate'
                                : profitInfo.isEstimated
                                  ? 'Legacy estimate'
                                  : 'Locked'}
                            </p>
                          </div>
                        )}
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

      {previewInvoice && <InvoicePreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} sys={sys} onEdit={(inv) => { setEditingInvoice(inv); setIsGeneratorOpen(true); setPreviewInvoice(null); }} />}
      {isGeneratorOpen && <InvoiceGenerator sys={sys} groups={pricingGroups} setGroups={setPricingGroups} existingInvoice={editingInvoice} onClose={() => { setIsGeneratorOpen(false); setEditingInvoice(null); }} />}
    </div>
  );
}
