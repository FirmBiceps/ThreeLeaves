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
  return Number(
    product?.['cost_price (SGD)'] ??
      product?.cost_price ??
      product?.costPrice ??
      product?.Cost ??
      product?.cost ??
      0
  ) || 0;
}

function calculateCashProfit(invoice, inventory) {
  if (!invoice || !Array.isArray(invoice.items)) return 0;
  const safeInventory = Array.isArray(inventory) ? inventory : [];

  return invoice.items.reduce((acc, item) => {
    const qty = Number(item?.quantity || item?.qty || 0) || 0;
    const sellPrice = Number(
      item?.unitPrice ?? item?.price ?? item?.Price ?? 0
    ) || 0;
    const product = safeInventory.find(
      (entry) => String(entry?.id || '') === String(item?.itemId || '')
    );
    const snapshottedCost = Number(
      item?.['cost_price (SGD)'] ?? item?.cost_price ?? item?.costPrice
    );
    const costPrice = Number.isFinite(snapshottedCost)
      ? snapshottedCost
      : getProductCost(product);

    return acc + qty * (sellPrice - costPrice);
  }, 0);
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
          return profitB - profitA;
        case 'profit_asc':
          return profitA - profitB;
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
        summary.totalProfit += calculateCashProfit(invoice, safeInventory);
        if ((invoice?.status || 'Unpaid') === 'Unpaid') summary.unpaidCount += 1;
        if (invoice?.includeGst !== false) summary.gstCount += 1;
        return summary;
      },
      { totalAmount: 0, totalProfit: 0, unpaidCount: 0, gstCount: 0 }
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
          <SummaryCard label="Estimated Profit" value={`$${formatMoney(cashSummary.totalProfit)}`} icon={<TrendingUp size={20} />} tone="emerald" />
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
                    const profit = calculateCashProfit(invoice, safeInventory);
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
                        <td className="whitespace-nowrap p-5 text-right font-black text-emerald-600">${formatMoney(profit)}</td>
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
