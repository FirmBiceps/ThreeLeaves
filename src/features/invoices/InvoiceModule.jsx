import { useMemo, useState, useEffect } from 'react';
import { Plus, FileText, X, Edit, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { InvoiceGenerator } from './InvoiceGenerator';

// ==========================================
// COMPONENT 1: INVOICE PREVIEW MODAL
// ==========================================
function InvoicePreviewModal({ invoice, onClose, onEdit }) {
  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="bg-slate-900 px-8 py-5 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center">
            <FileText size={22} className="mr-3 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold">Invoice #{invoice.number || invoice.id}</h2>
              <p className="text-sm text-slate-400 mt-0.5">{invoice.customer || 'Unknown Customer'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => onEdit(invoice)} 
              className="flex items-center text-sm font-bold bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl transition-colors"
            >
              <Edit size={16} className="mr-2" /> Edit
            </button>
            <button onClick={onClose} className="hover:bg-slate-800 p-2 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-8 overflow-y-auto bg-slate-50 flex-grow">
          
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
              <p className="text-base font-semibold text-slate-800">{invoice.date || '-'}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Terms</p>
              <p className="text-base font-semibold text-slate-800">
                {invoice.paymentTerms === 'cod' ? 'Cash on Delivery' : '30 Days'}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Delivery Status</p>
              <p className="text-base font-semibold text-blue-600">{invoice.deliveryStatus || 'Pending'}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                  <th className="p-4 pl-6">Item Description</th>
                  <th className="p-4 text-center">Qty</th>
                  <th className="p-4 text-right">Unit Price</th>
                  <th className="p-4 pr-6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-4 pl-6 text-sm text-slate-800">{item.name || item.Items || 'Unknown Item'}</td>
                      <td className="p-4 text-center text-sm text-slate-600">{item.quantity || item.qty || 1}</td>
                      <td className="p-4 text-right text-sm text-slate-600">${formatMoney(item.unitPrice || 0)}</td>
                      <td className="p-4 pr-6 text-right text-sm font-medium text-slate-800">
                        ${formatMoney((item.quantity || item.qty || 1) * (item.unitPrice || 0))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-slate-400 text-sm">No items found on this invoice.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm w-72">
              <div className="flex justify-between items-center mb-3 text-sm text-slate-500">
                <span>Subtotal</span>
                <span>${formatMoney(invoice.subtotal || invoice.total - (invoice.total * 0.09)) }</span>
              </div>
              <div className="flex justify-between items-center mb-4 text-sm text-slate-500">
                <span>GST (9%)</span>
                <span>${formatMoney(invoice.gst || invoice.total * 0.09)}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-xl font-bold text-blue-600">${formatMoney(invoice.total)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENT 2: MAIN INVOICE MODULE
// ==========================================
export function InvoiceModule({ sys }) {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

  const filteredInvoices = useMemo(() => {
    let result = [...(sys?.invoices || [])];

    // 1. Default Sort: Latest Date First
    result.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 2. Apply Search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(inv => 
        (inv.customer || '').toLowerCase().includes(searchLower) ||
        String(inv.number || inv.id || '').toLowerCase().includes(searchLower)
      );
    }

    // 3. Apply Date Filters
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    result = result.filter(inv => {
      if (filter === 'All') return true;
      
      const invDate = new Date(inv.date);
      invDate.setHours(0,0,0,0);
      
      if (filter === 'Today') {
        return invDate.getTime() === today.getTime();
      }
      if (filter === 'This Week') {
        const diffTime = Math.abs(today - invDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7; 
      }
      if (filter === 'This Month') {
        return invDate.getMonth() === today.getMonth() && invDate.getFullYear() === today.getFullYear();
      }
      if (filter === 'This Year') {
        return invDate.getFullYear() === today.getFullYear();
      }
      return true;
    });

    return result;
  }, [sys.invoices, filter, searchTerm]);

  // Calculate Pagination
  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE) || 1;
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleNewInvoice = () => {
    setEditingInvoice(null);
    setIsGeneratorOpen(true);
  };

  const handleEditInvoice = (invoiceToEdit) => {
    setPreviewInvoice(null);
    setEditingInvoice(invoiceToEdit);
    setIsGeneratorOpen(true);
  };

  // Instant inline status update
  const handleStatusChange = (e, invoiceId, fieldKey, newValue) => {
    e.stopPropagation(); // Prevents the row click (preview) from triggering
    const updatedInvoices = sys.invoices.map(inv => 
      inv.id === invoiceId ? { ...inv, [fieldKey]: newValue } : inv
    );
    sys.setInvoices(updatedInvoices);
  };

  return (
    <div className="p-8 h-full overflow-y-auto relative">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
            <FileText className="mr-3 text-blue-600" size={28} />
            Invoice Tracking
          </h1>
          <p className="text-base text-slate-500 mt-1">
            Manage your billing history, payments, and delivery statuses.
          </p>
        </div>
        {sys.hasPerm('create_invoices') && (
          <button
            className="flex items-center rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95"
            onClick={handleNewInvoice}
            type="button"
          >
            <Plus className="mr-2" size={18} /> New Invoice
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* FILTERS & SEARCH */}
        <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-100 bg-slate-50 p-4 gap-4">
          <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
            {['All', 'Today', 'This Week', 'This Month', 'This Year'].map((option) => (
              <button
                className={`rounded-md px-4 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all ${
                  filter === option ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-100'
                }`}
                key={option}
                onClick={() => setFilter(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm w-full sm:w-72">
            <Search className="text-slate-400 mr-2" size={18} />
            <input
              type="text"
              placeholder="Search invoice or customer..."
              className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* DATA TABLE */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
              <th className="p-5 pl-8">Invoice No.</th>
              <th className="p-5">Date</th>
              <th className="p-5">Client Entity</th>
              <th className="p-5 text-center">Payment Status</th>
              <th className="p-5 text-center">Delivery Status</th>
              <th className="p-5 pr-8 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {paginatedInvoices.map((invoice) => (
              <tr 
                className="font-medium hover:bg-blue-50 cursor-pointer transition-colors group" 
                key={invoice.id || invoice.number}
                onClick={() => setPreviewInvoice(invoice)}
              >
                <td className="p-5 pl-8 font-mono font-bold text-blue-600 group-hover:text-blue-800">
                  #{invoice.number || invoice.id}
                </td>
                <td className="p-5 text-slate-500">{invoice.date}</td>
                <td className="p-5 text-slate-800">{invoice.customer}</td>
                
                {/* PAYMENT STATUS EDITABLE DROPDOWN */}
                <td className="p-5 text-center">
                  <div className="inline-block relative">
                    <select
                      className={`appearance-none rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-widest border-none cursor-pointer pr-8 outline-none ${
                        invoice.status === 'Unpaid' ? 'bg-red-50 text-red-700' :
                        invoice.status === 'Overdue' ? 'bg-orange-50 text-orange-700' :
                        'bg-emerald-50 text-emerald-700' // Default to Paid
                      }`}
                      value={invoice.status || 'Paid'}
                      onChange={(e) => handleStatusChange(e, invoice.id, 'status', e.target.value)}
                      onClick={(e) => e.stopPropagation()} // Stop row click
                    >
                      <option value="Paid">Paid</option>
                      <option value="Unpaid">Unpaid</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                      <span className="text-current opacity-50 text-[10px]">▼</span>
                    </div>
                  </div>
                </td>

                {/* DELIVERY STATUS EDITABLE DROPDOWN */}
                <td className="p-5 text-center">
                  <div className="inline-block relative">
                    <select
                      className={`appearance-none rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-widest border-none cursor-pointer pr-8 outline-none ${
                        invoice.deliveryStatus === 'Delivered' ? 'bg-emerald-50 text-emerald-700' :
                        invoice.deliveryStatus === 'Cancelled' ? 'bg-slate-100 text-slate-500' :
                        'bg-blue-50 text-blue-700' // Default to Pending
                      }`}
                      value={invoice.deliveryStatus || 'Pending'}
                      onChange={(e) => handleStatusChange(e, invoice.id, 'deliveryStatus', e.target.value)}
                      onClick={(e) => e.stopPropagation()} // Stop row click
                    >
                      <option value="Pending">Pending</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                      <span className="text-current opacity-50 text-[10px]">▼</span>
                    </div>
                  </div>
                </td>

                <td className="p-5 pr-8 text-right font-black text-slate-900">
                  ${formatMoney(invoice.total)}
                </td>
              </tr>
            ))}
            {paginatedInvoices.length === 0 && (
              <tr>
                <td className="p-12 text-center text-sm font-bold text-slate-400" colSpan="6">
                  No invoices found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-white p-4 px-8">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredInvoices.length)} of {filteredInvoices.length} Entries
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center px-3 py-1.5 text-sm font-semibold text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} className="mr-1" /> Prev
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="flex items-center px-3 py-1.5 text-sm font-semibold text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight size={16} className="ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {previewInvoice && (
        <InvoicePreviewModal 
          invoice={previewInvoice} 
          onClose={() => setPreviewInvoice(null)}
          onEdit={handleEditInvoice}
        />
      )}

      {isGeneratorOpen && (
        <InvoiceGenerator 
          sys={sys} 
          existingInvoice={editingInvoice} 
          onClose={() => {
            setIsGeneratorOpen(false);
            setEditingInvoice(null);
          }} 
        />
      )}
    </div>
  );
}
