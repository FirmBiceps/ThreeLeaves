import { useMemo, useState } from 'react';
import { Plus, FileText, X, Edit } from 'lucide-react';
import { isToday } from '../../utils/date';
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
        
        {/* Header */}
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

        {/* Scrollable Content */}
        <div className="p-8 overflow-y-auto bg-slate-50 flex-grow">
          
          {/* Top Info Cards */}
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
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
              <p className="text-base font-semibold text-blue-600">{invoice.deliveryStatus || 'Paid'}</p>
            </div>
          </div>

          {/* Line Items Table */}
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

          {/* Totals */}
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
  
  // NEW: State to track which invoice we are previewing or editing
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  const filteredInvoices = useMemo(
    () =>
      [...sys.invoices]
        .filter((invoice) => filter === 'All' || isToday(invoice.date || ''))
        .reverse(),
    [filter, sys.invoices],
  );

  // Handles opening the generator for a brand new invoice
  const handleNewInvoice = () => {
    setEditingInvoice(null);
    setIsGeneratorOpen(true);
  };

  // Handles moving from "Preview Mode" to "Edit Mode"
  const handleEditInvoice = (invoiceToEdit) => {
    setPreviewInvoice(null);
    setEditingInvoice(invoiceToEdit);
    setIsGeneratorOpen(true);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between rounded-t-xl border-b border-gray-100 bg-gray-50 p-4">
        <div className="flex space-x-2">
          {['All', 'Today'].map((option) => (
            <button
              className={`rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                filter === option ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'
              }`}
              key={option}
              onClick={() => setFilter(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
        {sys.hasPerm('create_invoices') && (
          <button
            className="flex items-center rounded-lg bg-blue-600 px-5 py-1.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700"
            onClick={handleNewInvoice}
            type="button"
          >
            <Plus className="mr-2" size={16} /> New Invoice
          </button>
        )}
      </div>

      <table className="w-full text-left">
        <thead className="border-b text-[10px] font-black uppercase tracking-widest text-gray-400">
          <tr>
            <th className="p-4">Inv No.</th>
            <th className="p-4">Client Entity</th>
            <th className="p-4">Date</th>
            <th className="p-4 text-center">Terms</th>
            <th className="p-4 text-right">Total Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm font-medium">
          {filteredInvoices.map((invoice) => (
            <tr 
              className="font-medium hover:bg-blue-50 cursor-pointer transition-colors" 
              key={invoice.id || invoice.number}
              onClick={() => setPreviewInvoice(invoice)} // Clicking a row opens the preview
            >
              <td className="p-4 font-mono font-bold text-blue-600">#{invoice.number}</td>
              <td className="p-4">{invoice.customer}</td>
              <td className="p-4 text-xs text-gray-500">{invoice.date}</td>
              <td className="p-4 text-center">
                <span
                  className={`rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                    invoice.paymentTerms === 'cod'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {invoice.paymentTerms === 'cod' ? 'COD' : '30 Days'}
                </span>
              </td>
              <td className="p-4 text-right font-black">${formatMoney(invoice.total)}</td>
            </tr>
          ))}
          {filteredInvoices.length === 0 && (
            <tr>
              <td className="p-12 text-center text-sm font-bold text-gray-400" colSpan="5">
                No invoices found for this filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Render the Preview Modal if an invoice is clicked */}
      {previewInvoice && (
        <InvoicePreviewModal 
          invoice={previewInvoice} 
          onClose={() => setPreviewInvoice(null)}
          onEdit={handleEditInvoice}
        />
      )}

      {/* Render the Generator if "New" or "Edit" is clicked */}
      {isGeneratorOpen && (
        <InvoiceGenerator 
          sys={sys} 
          existingInvoice={editingInvoice} // Pass the data to the generator!
          onClose={() => {
            setIsGeneratorOpen(false);
            setEditingInvoice(null);
          }} 
        />
      )}
    </div>
  );
}
