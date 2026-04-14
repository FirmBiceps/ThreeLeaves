// ==========================================
// COMPONENT 1: INVOICE PREVIEW MODAL
// ==========================================
function InvoicePreviewModal({ invoice, onClose }) {
  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm print:bg-white print:p-0 print:block print:absolute print:inset-0 print:z-[9999]">
      
      {/* THE FIX: Perfect A4 margins, zero browser headers/footers, and forced Chinese fonts */}
      <style type="text/css">
        {`
          @media print {
            /* 1. This completely nukes the URL, Date, and Page Numbers */
            @page { 
              size: A4;
              margin: 0 !important; 
            }
            
            /* 2. Remove the body margin that was causing the right-shift */
            body {
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            /* 3. Uses the native Chinese script names (微软雅黑, 黑体) to force stubborn printer drivers */
            *, html, body, div, p, span, h1, h2, h3, table, th, td {
              font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", "SimHei", "黑体", Arial, sans-serif !important;
            }
          }
        `}
      </style>

      {/* THE LAYOUT FIX: Set the print container to exactly 210mm wide and center it automatically */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] print:w-[210mm] print:min-h-[297mm] print:mx-auto print:shadow-none print:max-h-none print:rounded-none">
        
        {/* Header (Hidden when printing so buttons don't show on paper) */}
        <div className="bg-slate-900 px-8 py-5 flex justify-between items-center text-white shrink-0 print:hidden">
          <div className="flex items-center">
            <FileText size={22} className="mr-3 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold">Invoice #{invoice.number || invoice.id}</h2>
              <p className="text-sm text-slate-400 mt-0.5">{invoice.customer || 'Unknown Customer'}</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button onClick={() => window.print()} className="flex items-center bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              <Printer size={16} className="mr-2" /> Print
            </button>
            <button onClick={onClose} className="hover:bg-slate-800 p-2 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content: THE PADDING FIX: added print:p-[15mm] to create a perfect inner border */}
        <div 
          className="p-8 overflow-y-auto bg-slate-50 flex-grow print:bg-white print:p-[15mm] print:overflow-visible"
          style={{ fontFamily: '"Microsoft YaHei", "微软雅黑", "PingFang SC", "SimHei", "黑体", Arial, sans-serif' }}
        >
          
          {/* Top Info Cards */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 print:text-black">Date</p>
              <p className="text-base font-semibold text-slate-800 print:text-black">{invoice.date || '-'}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 print:text-black">Terms</p>
              <p className="text-base font-semibold text-slate-800 print:text-black">
                {invoice.paymentTerms === 'cod' ? 'Cash on Delivery' : '30 Days'}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 print:text-black">Status</p>
              <p className="text-base font-semibold text-blue-600 print:text-black">{invoice.deliveryStatus || 'Pending'}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6 print:border-black print:rounded-none print:shadow-none">
            <table className="w-full text-left border-collapse print:border-2 print:border-black">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold print:border-b-2 print:border-black print:text-black">
                  <th className="p-4 pl-6 print:border-r print:border-black">Item Description</th>
                  <th className="p-4 text-center print:border-r print:border-black">Qty</th>
                  <th className="p-4 text-right print:border-r print:border-black">Unit Price</th>
                  <th className="p-4 pr-6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-black">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-4 pl-6 text-sm text-slate-800 print:border-r print:border-black">{item.name || item.Items || 'Unknown Item'}</td>
                      <td className="p-4 text-center text-sm text-slate-600 print:border-r print:border-black">{item.quantity || item.qty || 1}</td>
                      <td className="p-4 text-right text-sm text-slate-600 print:border-r print:border-black">${formatMoney(item.unitPrice || 0)}</td>
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
          <div className="flex justify-end print:justify-end">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm w-72 print:border-none print:shadow-none print:p-0">
              <div className="flex justify-between items-center mb-3 text-sm text-slate-500 print:text-black font-bold">
                <span>Subtotal</span>
                <span>${formatMoney(invoice.subtotal || invoice.total - (invoice.total * 0.09))}</span>
              </div>
              <div className="flex justify-between items-center mb-4 text-sm text-slate-500 print:text-black font-bold">
                <span>GST (9%)</span>
                <span>${formatMoney(invoice.gst || invoice.total * 0.09)}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 print:border-black print:border-t-2">
                <span className="font-semibold text-slate-900 print:text-black">Total</span>
                <span className="text-xl font-bold text-blue-600 print:text-black">${formatMoney(invoice.total)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
