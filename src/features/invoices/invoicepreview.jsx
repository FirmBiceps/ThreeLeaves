import { X, Printer, Edit, FileText, CheckCircle2, AlertCircle, Truck } from 'lucide-react';
import { formatMoney } from '../../utils/format';

// ==========================================
// INVOICE PREVIEW MODAL
// ==========================================
export function InvoicePreviewModal({ invoice, onClose, onEdit }) {
  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 px-8 py-5 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center">
            <FileText size={22} className="mr-3 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold">Invoice #{invoice.number}</h2>
              <p className="text-sm text-slate-400 mt-0.5">{invoice.customer}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onEdit(invoice)}
              className="text-sm font-medium bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl transition-colors flex items-center"
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
              <p className="text-base font-semibold text-blue-600">{invoice.deliveryStatus || 'Pending'}</p>
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
                      <td className="p-4 pl-6 text-sm text-slate-800">{item.name || item.Items}</td>
                      <td className="p-4 text-center text-sm text-slate-600">{item.quantity}</td>
                      <td className="p-4 text-right text-sm text-slate-600">${formatMoney(item.unitPrice)}</td>
                      <td className="p-4 pr-6 text-right text-sm font-medium text-slate-800">
                        ${formatMoney(item.quantity * item.unitPrice)}
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
                <span>${formatMoney(invoice.subtotal || invoice.total)}</span>
              </div>
              <div className="flex justify-between items-center mb-4 text-sm text-slate-500">
                <span>GST (9%)</span>
                <span>${formatMoney(invoice.gst || 0)}</span>
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
