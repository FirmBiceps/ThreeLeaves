import { useState } from 'react';
import { Search, FileText, X, Edit, CheckCircle2, AlertCircle, Truck } from 'lucide-react';
import { formatMoney } from '../../utils/format';

// ==========================================
// COMPONENT 1: INVOICE PREVIEW MODAL
// ==========================================
function InvoicePreviewModal({ invoice, onClose }) {
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
          <button onClick={onClose} className="hover:bg-slate-800 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
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
                      <td className="p-4 pl-6 text-sm text-slate-800">{item.name || item.Items || 'Unknown Item'}</td>
                      <td className="p-4 text-center text-sm text-slate-600">{item.quantity || 1}</td>
                      <td className="p-4 text-right text-sm text-slate-600">${formatMoney(item.unitPrice || 0)}</td>
                      <td className="p-4 pr-6 text-right text-sm font-medium text-slate-800">
                        ${formatMoney((item.quantity || 1) * (item.unitPrice || 0))}
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

// ==========================================
// COMPONENT 2: MAIN INVOICE LIST
// ==========================================
export function InvoiceModule({ sys }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [previewInvoice, setPreviewInvoice] = useState(null); // Tracks which invoice is clicked

  // Ensure sys.invoices exists before trying to filter it
  const invoiceList = sys?.invoices || [];

  const filteredInvoices = invoiceList.filter((inv) => {
    const customer = inv.customer || '';
    const number = inv.number || inv.id || '';
    const searchLower = searchTerm.toLowerCase();
    
    return (
      customer.toLowerCase().includes(searchLower) ||
      String(number).toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-8 h-full overflow-y-auto relative">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
            <FileText className="mr-3 text-blue-600" size={28} />
            Invoice History
          </h1>
          <p className="text-base text-slate-500 mt-1">
            Click on any historic invoice to view its detailed line items.
          </p>
        </div>
      </div>

      {/* SEARCH & TABLE SECTION */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Search Bar */}
        <div className="p-5 border-b border-slate-100 flex items-center bg-slate-50">
          <Search className="text-slate-400 mr-3" size={22} />
          <input
            type="text"
            placeholder="Search by customer name or invoice number..."
            className="w-full bg-transparent border-none focus:ring-0 text-base placeholder:text-slate-400 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Data Table */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
              <th className="p-5 pl-8">Invoice No.</th>
              <th className="p-5">Date</th>
              <th className="p-5">Customer</th>
              <th className="p-5 text-center">Status</th>
              <th className="p-5 pr-8 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredInvoices.map((inv, idx) => (
              <tr 
                key={inv.id || idx} 
                onClick={() => setPreviewInvoice(inv)} // This makes the row clickable!
                className="hover:bg-blue-50 cursor-pointer transition-colors group"
              >
                <td className="p-5 pl-8 text-base font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                  #{inv.number || inv.id}
                </td>
                <td className="p-5 text-sm text-slate-500">
                  {inv.date || '-'}
                </td>
                <td className="p-5 text-base text-slate-800">
                  {inv.customer || 'Unknown Customer'}
                </td>
                <td className="p-5 text-center">
                  <span className="text-xs px-3 py-1.5 rounded-md bg-slate-100 text-slate-600">
                    {inv.deliveryStatus || 'Pending'}
                  </span>
                </td>
                <td className="p-5 pr-8 text-right text-base font-semibold text-slate-900">
                  ${formatMoney(inv.total)}
                </td>
              </tr>
            ))}
            
            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan="5" className="p-12 text-center text-base text-slate-500">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* THE MODAL POPUP */}
      {previewInvoice && (
        <InvoicePreviewModal 
          invoice={previewInvoice} 
          onClose={() => setPreviewInvoice(null)} 
        />
      )}

    </div>
  );
}
