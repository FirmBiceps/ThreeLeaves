import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Filter, ArrowUpDown, Search, ScanBarcode, CheckCircle, AlertCircle, ChevronDown, Trash2, ChevronLeft, ChevronRight, DollarSign, TrendingUp, Clock3, RotateCcw, X } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';
import { InvoiceGenerator } from './InvoiceGenerator';
import { InvoicePreviewModal } from './InvoicePreview';

// Helper function to calculate 1st degree profit per invoice
const calculateInvoiceProfit = (invoice) => {
  if (!invoice || !Array.isArray(invoice.items)) return 0;
  return invoice.items.reduce((acc, item) => {
    const qty = Number(item.quantity || item.qty || 0);
    const sellPrice = Number(item.price || item.Price || 0);
    // Checks for standard cost price keys, including your updated SGD format
    const costPrice = Number(item['cost_price (SGD)'] || item.cost_price || item.costPrice || 0);
    
    // Use the explicit line amount if available, otherwise fallback to qty * sellPrice
    const lineRevenue = Number(item.amount) || (qty * sellPrice);
    const lineCost = qty * costPrice;
    
    return acc + (lineRevenue - lineCost);
  }, 0);
};

// Convert any searchable value into a consistent lowercase string.
const normaliseSearchValue = (value) =>
  String(value ?? '').trim().toLowerCase();

const getProductEnglishDescription = (product) =>
  String(product?.Description || product?.description || '').trim();

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
  const [previewDescriptionLanguage, setPreviewDescriptionLanguage] = useState('zh');
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

  // History previews default to Chinese. English mode is preview-only and
  // swaps the product display-name fields to the inventory Description field.
  // Nothing is written back to Supabase, so changing print language cannot
  // alter invoice history, product names, quantities or pricing.
  const historyPreviewSys = useMemo(() => {
    if (previewDescriptionLanguage !== 'en') return sys;

    const inventory = Array.isArray(sys?.inventory) ? sys.inventory : [];

    return {
      ...sys,
      inventory: inventory.map((product) => {
        const englishDescription = getProductEnglishDescription(product);

        if (!englishDescription) return product;

        return {
          ...product,
          Name: englishDescription,
          name: englishDescription,
          Items: englishDescription,
        };
      }),
    };
  }, [previewDescriptionLanguage, sys]);

  const openInvoicePreview = (invoice) => {
    setPreviewDescriptionLanguage('zh');
    setPreviewInvoice(invoice);
  };

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
      const profA = calculateInvoiceProfit(a); const profB = calculateInvoiceProfit(b);
      const custA = String(a?.customer || ''); const custB = String(b?.customer || '');
      
      switch (sortOption) {
        case 'date_asc': return dateA - dateB; 
        case 'number_desc': return numB.localeCompare(numA, undefined, { numeric: true });
        case 'number_asc': return numA.localeCompare(numB, undefined, { numeric: true }); 
        case 'total_desc': return totB - totA;
        case 'total_asc': return totA - totB; 
        case 'profit_desc': return profB - profA;
        case 'profit_asc': return profA - profB;
        case 'customer_asc': return custA.localeCompare(custB);
        case 'customer_desc': return custB.localeCompare(custA); 
        case 'date_desc': default: return dateB - dateA;
      }
    });
    return result;
  }, [safeInvoices, filter, termFilter, searchTerm, sortOption]);

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE) || 1;
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Dashboard-style summary for the currently filtered invoice list
  const invoiceSummary = useMemo(() => {
    return filteredInvoices.reduce(
      (summary, invoice) => {
        summary.totalAmount += Number(invoice?.total) || 0;
        summary.totalProfit += calculateInvoiceProfit(invoice);
        if ((invoice?.status || 'Unpaid') === 'Unpaid') summary.unpaidCount += 1;
        return summary;
      },
      {
        totalAmount: 0,
        totalProfit: 0,
        unpaidCount: 0,
      }
    );
  }, [filteredInvoices]);

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
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Estimated Profit</p>
                <p className="mt-2 text-2xl font-black text-emerald-600">${formatMoney(invoiceSummary.totalProfit)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Calculated from invoice line items</p>
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
                  <option value="All">All Terms</option><option value="cod">C.O.D</option><option value="30_days">30 Days</option>
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
                  const invoiceProfit = calculateInvoiceProfit(inv);

                  return (
                    <tr key={inv?.id} className="group cursor-pointer transition-all hover:bg-blue-50/70" onClick={() => openInvoicePreview(inv)}>
                      <td className="p-5 pl-8 font-mono font-bold text-blue-600 whitespace-nowrap">
                        #{String(inv?.number || inv?.id || '')}
                        {inv?.isSpecialFormat && <span className="ml-2 bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-black inline-flex items-center"><ScanBarcode size={8} className="mr-0.5" /> Spec</span>}
                      </td>
                      <td className="p-5 text-slate-500 whitespace-nowrap">{String(inv?.date || '')}</td>
                      <td className="p-5 text-slate-800 font-medium whitespace-nowrap">{String(inv?.customer || '')}</td>
                      <td className="p-5 text-center">
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md whitespace-nowrap">
                          {inv?.paymentTerms === 'cod' ? 'C.O.D' : '30 Days'}
                        </span>
                      </td>
                      <td className="p-5 text-right font-black text-slate-900 whitespace-nowrap">${formatMoney(inv?.total)}</td>
                      <td className="p-5 text-right font-black text-emerald-600 whitespace-nowrap">${formatMoney(invoiceProfit)}</td>
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

      {previewInvoice && (
        <>
          <InvoicePreviewModal
            invoice={previewInvoice}
            onClose={() => {
              setPreviewInvoice(null);
              setPreviewDescriptionLanguage('zh');
            }}
            sys={historyPreviewSys}
            onEdit={(inv) => {
              setEditingInvoice(inv);
              setIsGeneratorOpen(true);
              setPreviewInvoice(null);
              setPreviewDescriptionLanguage('zh');
            }}
          />

          <div className="fixed bottom-6 left-6 z-[6500] rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur print:hidden">
            <div className="mb-1 px-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
              Print Description
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setPreviewDescriptionLanguage('zh')}
                className={`rounded-lg px-3 py-2 text-[11px] font-black transition-all ${
                  previewDescriptionLanguage === 'zh'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                中文 Default
              </button>
              <button
                type="button"
                onClick={() => setPreviewDescriptionLanguage('en')}
                className={`rounded-lg px-3 py-2 text-[11px] font-black transition-all ${
                  previewDescriptionLanguage === 'en'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                English
              </button>
            </div>
          </div>
        </>
      )}
      {isGeneratorOpen && <InvoiceGenerator sys={sys} groups={pricingGroups} setGroups={setPricingGroups} existingInvoice={editingInvoice} onClose={() => { setIsGeneratorOpen(false); setEditingInvoice(null); }} />}
    </div>
  );
}
