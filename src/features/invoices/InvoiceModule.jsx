import { useMemo, useState, useEffect } from 'react';
import { Plus, FileText, X, Edit, Search, ChevronLeft, ChevronRight, Printer, Trash2 } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { InvoiceGenerator } from './InvoiceGenerator';
import logo from './three_leaves_logo.png';

// ==========================================
// COMPONENT 1: INVOICE PREVIEW MODAL
// ==========================================
function InvoicePreviewModal({ invoice, onClose, onEdit, sys }) {
  if (!invoice) return null;

  const customerObj = sys.customers.find(c => c.id === invoice.customerId) || {};
  const customerAddress = customerObj.address || '';
  const subtotal = invoice.items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0);
  const gst = subtotal * 0.09;
  const total = subtotal + gst;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm print:bg-white print:p-0 print:block print:absolute print:inset-0 print:z-[9999]">
      <style type="text/css">
        {`
          @media print {
            @page { margin: 0; }
            body {
              margin: 1cm;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            *, html, body {
              font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", "SimHei", "黑体", Arial, sans-serif !important;
            }
          }
        `}
      </style>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] print:hidden">
        <div className="bg-slate-900 px-8 py-5 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center">
            <FileText size={22} className="mr-3 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold">Invoice #{invoice.number || invoice.id}</h2>
              <p className="text-sm text-slate-400 mt-0.5">{invoice.customer || 'Unknown Customer'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => window.print()} className="flex items-center text-sm font-bold bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-colors">
              <Printer size={16} className="mr-2" /> Print
            </button>
            <button onClick={() => onEdit(invoice)} className="flex items-center text-sm font-bold bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl transition-colors">
              <Edit size={16} className="mr-2" /> Edit
            </button>
            <button onClick={onClose} className="hover:bg-slate-800 p-2 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-8 overflow-y-auto bg-slate-50 flex-grow">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
              <p className="text-base font-semibold text-slate-800">{invoice.date || '-'}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Terms</p>
              <p className="text-base font-semibold text-slate-800">{invoice.paymentTerms === 'cod' ? 'Cash on Delivery' : '30 Days'}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
              <p className="text-base font-semibold text-blue-600">{invoice.deliveryStatus || 'Pending'}</p>
            </div>
          </div>

          {/* Table */}
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
                {invoice.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-4 pl-6 text-sm text-slate-800">{item.name || item.Items}</td>
                    <td className="p-4 text-center text-sm text-slate-600">{item.qty || item.quantity}</td>
                    <td className="p-4 text-right text-sm text-slate-600">${formatMoney(item.unitPrice || 0)}</td>
                    <td className="p-4 pr-6 text-right text-sm font-medium text-slate-800">
                      ${formatMoney((item.qty || item.quantity || 1) * (item.unitPrice || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PRINT VIEW */}
      <div className="hidden print:flex w-[210mm] min-h-[297mm] flex-col bg-white p-8 text-black">
        {/* ... (Print view logic remains same as before) ... */}
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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // 1. THE DELETE FUNCTION
  const handleDeleteInvoice = (e, invoiceId) => {
    e.stopPropagation(); // Stop the row from opening the preview
    
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this invoice? This cannot be undone.");
    
    if (confirmDelete) {
      // Filter out the deleted invoice from the system state
      const updatedInvoices = sys.invoices.filter(inv => inv.id !== invoiceId);
      sys.setInvoices(updatedInvoices);
    }
  };

  const filteredInvoices = useMemo(() => {
    let result = [...(sys?.invoices || [])];
    result.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(inv => 
        (inv.customer || '').toLowerCase().includes(searchLower) ||
        String(inv.number || inv.id || '').toLowerCase().includes(searchLower)
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    result = result.filter(inv => {
      if (filter === 'All') return true;
      const [year, month, day] = (inv.date || '').split('-').map(Number);
      if (!year || !month || !day) return false;
      const invDate = new Date(year, month - 1, day);
      invDate.setHours(0,0,0,0);
      
      if (filter === 'Today') return invDate.getTime() === today.getTime();
      if (filter === 'This Week') {
        const diffDays = Math.ceil(Math.abs(today - invDate) / (1000 * 60 * 60 * 24));
        return diffDays <= 7; 
      }
      if (filter === 'This Month') return invDate.getMonth() === today.getMonth() && invDate.getFullYear() === today.getFullYear();
      return true;
    });

    return result;
  }, [sys.invoices, filter, searchTerm]);

  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="p-8 h-full overflow-y-auto relative">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
          <FileText className="mr-3 text-blue-600" size={28} /> Invoice History
        </h1>
        <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg hover:bg-blue-700" onClick={() => setIsGeneratorOpen(true)}>
          <Plus className="mr-2" size={18} /> New Invoice
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Filters */}
        <div className="flex justify-between items-center border-b bg-slate-50 p-4">
          <div className="flex bg-white rounded-lg p-1 border">
            {['All', 'Today', 'This Week', 'This Month'].map((opt) => (
              <button key={opt} onClick={() => setFilter(opt)} className={`px-4 py-1.5 text-[11px] font-black uppercase rounded-md ${filter === opt ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>
                {opt}
              </button>
            ))}
          </div>
          <div className="flex items-center bg-white border rounded-xl px-4 py-2 w-72">
            <Search className="text-slate-400 mr-2" size={18} />
            <input type="text" placeholder="Search..." className="w-full bg-transparent outline-none text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs uppercase tracking-widest text-slate-500 font-semibold border-b">
              <th className="p-5 pl-8">Invoice No.</th>
              <th className="p-5">Date</th>
              <th className="p-5">Customer</th>
              <th className="p-5 text-right">Total</th>
              <th className="p-5 text-center w-20">Delete</th> {/* New Column */}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {paginatedInvoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-blue-50 cursor-pointer transition-colors group" onClick={() => setPreviewInvoice(inv)}>
                <td className="p-5 pl-8 font-mono font-bold text-blue-600">#{inv.number || inv.id}</td>
                <td className="p-5 text-slate-500">{inv.date}</td>
                <td className="p-5 text-slate-800">{inv.customer}</td>
                <td className="p-5 text-right font-black text-slate-900">${formatMoney(inv.total)}</td>
                
                {/* 2. THE DELETE BUTTON CELL */}
                <td className="p-5 text-center">
                  <button 
                    onClick={(e) => handleDeleteInvoice(e, inv.id)}
                    className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewInvoice && <InvoicePreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} sys={sys} onEdit={(inv) => { setEditingInvoice(inv); setIsGeneratorOpen(true); setPreviewInvoice(null); }} />}
      {isGeneratorOpen && <InvoiceGenerator sys={sys} existingInvoice={editingInvoice} onClose={() => { setIsGeneratorOpen(false); setEditingInvoice(null); }} />}
    </div>
  );
}
