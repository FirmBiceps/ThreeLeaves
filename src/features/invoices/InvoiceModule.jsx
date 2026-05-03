import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Filter, ArrowUpDown, Search, ScanBarcode, CheckCircle, AlertCircle, ChevronDown, Trash2 } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';
import { InvoiceGenerator } from './InvoiceGenerator';
import { InvoicePreviewModal } from './InvoicePreview';

export function InvoiceModule({ sys }) {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [termFilter, setTermFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  const [pricingGroups, setPricingGroups] = useState([]);
  
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
    if (searchTerm) {
      const searchLower = String(searchTerm).toLowerCase();
      result = result.filter(inv => String(inv?.customer || '').toLowerCase().includes(searchLower) || String(inv?.number || inv?.id || '').toLowerCase().includes(searchLower));
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
      const custA = String(a?.customer || ''); const custB = String(b?.customer || '');
      switch (sortOption) {
        case 'date_asc': return dateA - dateB; case 'number_desc': return numB.localeCompare(numA, undefined, { numeric: true });
        case 'number_asc': return numA.localeCompare(numB, undefined, { numeric: true }); case 'total_desc': return totB - totA;
        case 'total_asc': return totA - totB; case 'customer_asc': return custA.localeCompare(custB);
        case 'customer_desc': return custB.localeCompare(custA); case 'date_desc': default: return dateB - dateA;
      }
    });
    return result;
  }, [safeInvoices, filter, termFilter, searchTerm, sortOption]);

  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="p-8 h-full overflow-y-auto relative print:p-0 print:overflow-visible">
      <div className={(previewInvoice || isGeneratorOpen) ? "print:hidden" : "block"}>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center"><FileText className="mr-3 text-blue-600" size={28} /> Invoice History</h1>
          <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg hover:bg-blue-700" onClick={() => setIsGeneratorOpen(true)}><Plus className="mr-2" size={18} /> New Invoice</button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-wrap justify-between items-center border-b bg-slate-50 p-4 gap-4">
            <div className="flex bg-white rounded-lg p-1 border shadow-sm">
              {['All', 'Today', 'This Week', 'This Month'].map((opt) => (
                <button key={opt} onClick={() => setFilter(opt)} className={`px-4 py-1.5 text-[11px] font-black uppercase rounded-md ${filter === opt ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>{opt}</button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex items-center bg-white border rounded-xl shadow-sm px-3 py-2 w-full sm:w-36 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <Filter className="text-slate-400 mr-2 shrink-0" size={16} />
                <select className="w-full bg-transparent outline-none text-xs font-bold text-slate-700 cursor-pointer appearance-none" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
                  <option value="All">All Terms</option><option value="cod">C.O.D</option><option value="30_days">30 Days</option>
                </select>
              </div>

              <div className="relative flex items-center bg-white border rounded-xl shadow-sm px-3 py-2 w-full sm:w-48 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <ArrowUpDown className="text-slate-400 mr-2 shrink-0" size={16} />
                <select className="w-full bg-transparent outline-none text-xs font-bold text-slate-700 cursor-pointer appearance-none" value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                  <option value="date_desc">Date (Newest First)</option><option value="date_asc">Date (Oldest First)</option><option value="number_desc">Invoice No. (Highest)</option>
                  <option value="number_asc">Invoice No. (Lowest)</option><option value="total_desc">Amount (Highest)</option><option value="total_asc">Amount (Lowest)</option>
                  <option value="customer_asc">Customer (A-Z)</option><option value="customer_desc">Customer (Z-A)</option>
                </select>
              </div>

              <div className="flex items-center bg-white border rounded-xl px-4 py-2 w-full sm:w-64 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <Search className="text-slate-400 mr-2 shrink-0" size={16} />
                <input type="text" placeholder="Search..." className="w-full bg-transparent outline-none text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-slate-500 font-semibold border-b">
                <th className="p-5 pl-8">Invoice No.</th><th className="p-5">Date</th><th className="p-5">Customer</th><th className="p-5 text-center">Terms</th><th className="p-5 text-right">Total</th><th className="p-5 text-center">Status</th><th className="p-5 text-center w-20">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedInvoices.map((inv) => (
                <tr key={inv?.id} className="hover:bg-blue-50 cursor-pointer transition-colors group" onClick={() => setPreviewInvoice(inv)}>
                  <td className="p-5 pl-8 font-mono font-bold text-blue-600">
                    #{String(inv?.number || inv?.id || '')}
                    {inv?.isSpecialFormat && <span className="ml-2 bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-black inline-flex items-center"><ScanBarcode size={8} className="mr-0.5" /> Spec</span>}
                  </td>
                  <td className="p-5 text-slate-500">{String(inv?.date || '')}</td>
                  <td className="p-5 text-slate-800">{String(inv?.customer || '')}</td>
                  <td className="p-5 text-center"><span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md whitespace-nowrap">{inv?.paymentTerms === 'cod' ? 'C.O.D' : '30 Days'}</span></td>
                  <td className="p-5 text-right font-black text-slate-900">${formatMoney(inv?.total)}</td>
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
              ))}
              {paginatedInvoices.length === 0 && (<tr><td colSpan="7" className="p-12 text-center text-sm font-bold text-slate-400">No invoices match your current search and sorting criteria.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {previewInvoice && <InvoicePreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} sys={sys} onEdit={(inv) => { setEditingInvoice(inv); setIsGeneratorOpen(true); setPreviewInvoice(null); }} />}
      {isGeneratorOpen && <InvoiceGenerator sys={sys} groups={pricingGroups} setGroups={setPricingGroups} existingInvoice={editingInvoice} onClose={() => { setIsGeneratorOpen(false); setEditingInvoice(null); }} />}
    </div>
  );
}
