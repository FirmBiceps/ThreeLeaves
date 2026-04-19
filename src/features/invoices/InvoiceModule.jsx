import { useMemo, useState } from 'react';
import { FileText, Printer, Trash2, Search, Plus, X, Edit } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { InvoiceGenerator } from './InvoiceGenerator'; 

import logo from './three_leaves_logo.png';
import paynowQr from './paynow_qr.jpg';
const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

// ==========================================
// COMPONENT: HISTORY PREVIEW MODAL
// ==========================================
function InvoicePreviewModal({ invoice, onClose, onEdit, sys }) {
  if (!invoice) return null;

  const customerObj = (sys?.customers || []).find(c => c.id === invoice.customerId) || {};
  const customerAddress = customerObj.address || '';
  const subtotal = (invoice?.items || []).reduce((sum, item) => sum + (Number(item.qty || item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const gst = subtotal * 0.09;
  const total = subtotal + gst;

  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto bg-slate-950/90 print:static print:block print:bg-white print:p-0 print:backdrop-filter-none">
      
      <style type="text/css">
        {`
          @media print {
            @page { size: A4; margin: 0 !important; }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body * { visibility: hidden !important; }
            #printable-invoice-history, #printable-invoice-history * { visibility: visible !important; }
            
            #printable-invoice-history {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important; 
              padding: 15mm !important; 
              box-sizing: border-box !important;
              background: white !important;
              backdrop-filter: none !important;
            }

            *, html, body, div, p, span, h1, h2, h3, table, th, td { font-family: ${CJK_FONT} !important; }
            tr, td, th { page-break-inside: avoid; break-inside: avoid; }
          }
        `}
      </style>

      <div className="flex min-h-full flex-col items-center py-12 print:block print:py-0 print:m-0">
        
        <div className="w-full max-w-[210mm] shrink-0 bg-slate-900 px-8 py-4 flex justify-between items-center text-white rounded-t-2xl shadow-2xl print:hidden border-b-4 border-blue-600">
          <div className="flex items-center">
            <FileText size={24} className="mr-3 text-blue-400" />
            <div>
              <h2 className="text-sm font-black tracking-widest uppercase text-slate-200">A4 Print Preview</h2>
              <p className="text-lg font-bold text-white leading-none mt-0.5">#{invoice.number || invoice.id}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => window.print()} className="flex items-center text-sm font-bold bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl transition-colors shadow-lg">
              <Printer size={18} className="mr-2" /> Print Document
            </button>
            <button onClick={() => onEdit(invoice)} className="flex items-center text-sm font-bold bg-slate-800 hover:bg-slate-700 px-5 py-2.5 rounded-xl transition-colors border border-slate-700">
              <Edit size={16} className="mr-2" /> Edit
            </button>
            <button onClick={onClose} className="hover:bg-slate-700 p-2.5 rounded-full transition-colors ml-2 bg-slate-800">
              <X size={20} />
            </button>
          </div>
        </div>

        <div 
          id="printable-invoice-history"
          className="flex w-full max-w-[210mm] min-h-[297mm] flex-col bg-white p-[15mm] text-black shadow-2xl rounded-b-2xl print:w-full print:max-w-none print:min-h-0 print:h-auto print:rounded-none print:shadow-none box-border shrink-0"
          style={{ fontFamily: CJK_FONT }}
        >
          <div className="flex w-full mb-4 justify-between">
            <div className="flex-1 flex flex-col pr-4">
              <div className="flex items-center mb-5">
                <div className="w-[110px] shrink-0 mr-4">
                  <img src={logo} alt="Three Leaves Logo" className="w-full h-auto object-contain" />
                </div>
                <div className="flex-1 text-left leading-snug pt-2 whitespace-nowrap overflow-visible">
                  <h1 className="font-black text-[17px]" style={{ fontFamily: CJK_FONT }}>THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
                  <h2 className="font-bold text-[16px] mb-1" style={{ fontFamily: CJK_FONT }}>三叶（新加坡） 贸易公司</h2>
                  
                  <div className="text-[#d55e2d] font-bold text-[10.5px] leading-tight tracking-tight">
                    <p className="whitespace-nowrap">CO.REG NO.53033969B &nbsp;&nbsp; GST REG NO. M90355440L</p>
                    <p className="whitespace-nowrap">280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
                    <p className="whitespace-nowrap">HP: 97578869 (Mr Ye) &nbsp;&nbsp; HP: 91113505 (Min) &nbsp;&nbsp; Email: 3leaves.sg@gmail.com</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end w-full mb-2 text-[14px] font-bold">
                <div className="flex items-end flex-1 pr-4">
                  <span className="shrink-0 mr-2 text-black">TO:</span>
                  <span className="flex-1 uppercase border-b border-black pb-0.5 whitespace-nowrap text-[13px] tracking-tight" style={{ fontFamily: CJK_FONT }}>
                    {invoice.customer || ''}
                  </span>
                </div>
                <div className="flex items-end w-[35%] pl-2">
                  <span className="shrink-0 mr-2 text-black">DATE:</span>
                  <span className="flex-1 text-center border-b border-black pb-0.5">
                    {invoice.date && !isNaN(new Date(invoice.date).getTime()) 
                      ? new Date(invoice.date).toLocaleDateString('en-GB').replace(/\//g, '-') 
                      : new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}
                  </span>
                </div>
              </div>

              <div className="flex items-end w-full text-[14px] font-bold">
                <span className="shrink-0 mr-2 text-black">ADDRESS:</span>
                <span className="flex-1 uppercase border-b border-black pb-0.5 whitespace-nowrap text-[12px] tracking-tighter" style={{ fontFamily: CJK_FONT }}>
                  {customerAddress}
                </span>
              </div>
            </div>

            <div className="w-[180px] shrink-0 flex flex-col items-start pl-4 pt-1">
              <h2 className="text-[22px] font-bold tracking-[0.4em] leading-none mb-1" style={{ fontFamily: CJK_FONT }}>發票</h2>
              <h3 className="text-[15px] font-black tracking-wide uppercase mb-6 text-black">TAX INVOICE</h3>
              
              <div className="w-full flex flex-col gap-3 mt-auto mb-2">
                <div className="flex items-baseline">
                  <span className="font-bold w-[50px] shrink-0 text-black text-[15px]">No.</span>
                  <span className="text-red-600 font-bold tracking-wider text-[17px] leading-none">{invoice.number}</span>
                </div>
                <div className="flex items-baseline">
                  <span className="font-bold w-[50px] shrink-0 text-black text-[15px]">Term:</span>
                  <span className="text-red-600 font-bold text-[16px] leading-none">{invoice.paymentTerms === 'cod' ? 'COD' : '30 Days'}</span>
                </div>
              </div>
            </div>
          </div>

          <table className="w-full text-[15px] border-2 border-black text-center mb-0 leading-tight flex-grow mt-2" style={{ fontFamily: CJK_FONT }}>
            <thead className="border-b-2 border-black">
              <tr className="font-bold bg-white text-[14px]">
                <th className="py-2 px-1 border-r border-black w-10">NO.</th>
                <th className="py-2 px-2 border-r border-black text-left">DESCRIPTION</th>
                <th className="py-2 px-1 border-r border-black w-24">QUANTITY</th>
                <th className="py-2 px-1 border-r border-black w-32 text-center">UNIT PRICE</th>
                <th className="py-2 px-1 w-32 text-center">AMOUNT</th>
              </tr>
            </thead>
            <tbody style={{ fontFamily: CJK_FONT }}>
              {(invoice.items || []).map((item, idx) => {
                const productName = item.name || item.Items || '-';

                return (
                  <tr key={idx} className="h-[32px] align-top" style={{ fontFamily: CJK_FONT }}>
                    <td className="p-1 border-r border-black font-medium text-center">{idx + 1}</td>
                    <td className="p-1 border-r border-black text-left pl-2 font-bold" style={{ fontFamily: CJK_FONT }}>{productName}</td>
                    <td className="p-1 border-r border-black font-medium text-center" style={{ fontFamily: CJK_FONT }}>{item.qty || item.quantity} {item.unit}</td>
                    <td className="p-1 border-r border-black text-center">${formatMoney(item.unitPrice)}</td>
                    <td className="p-1 text-center font-bold">
                      ${formatMoney((Number(item.qty || item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                    </td>
                  </tr>
                );
              })}
              
              {/* FIXED: Reduced to 15 rows to prevent A4 vertical overflow */}
              {invoice.items && invoice.items.length < 15 && Array.from({ length: 15 - invoice.items.length }).map((_, i) => (
                <tr key={`blank-${i}`} className="h-[32px]">
                  <td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td>
                </tr>
              ))}

              <tr className="border-t-2 border-black font-bold h-[28px]" style={{ fontFamily: CJK_FONT }}>
                <td colSpan="3" rowSpan="3" className="border-r border-black bg-white"></td>
                <td className="p-1 border-r border-black border-b border-black text-center text-[14px]">SUBTOTAL</td>
                <td className="p-1 text-center border-b border-black text-[15px]">${formatMoney(subtotal)}</td>
              </tr>
              <tr className="font-bold h-[28px]" style={{ fontFamily: CJK_FONT }}>
                <td className="p-1 border-r border-black border-b border-black text-center text-[14px]">9% GST</td>
                <td className="p-1 text-center border-b border-black text-[15px]">${formatMoney(gst)}</td>
              </tr>
              <tr className="font-bold h-[32px]" style={{ fontFamily: CJK_FONT }}>
                <td className="p-1 border-r border-black text-center text-[16px]">TOTAL</td>
                <td className="p-1 text-center text-[17px]">${formatMoney(total)}</td>
              </tr>
            </tbody>
          </table>

          {/* FIXED: mt-auto and shrink-0 force it to stay anchored at the bottom inside A4 bounds */}
          <div className="flex w-full mt-auto pt-4 justify-between items-end shrink-0">
            <div className="flex-1 text-[12px] font-bold leading-snug pr-4">
              <div style={{ fontFamily: CJK_FONT }}>
                <p>请提前一天提交订单,同日送达的截止时间为下午12点前。每周日休息</p>
                <p className="whitespace-nowrap">Please submit orders one day in advance. The cut-off time for same-day delivery is before 12 PM. Closed on Sundays.</p>
                
                <div className="mt-3 flex items-center">
                  <div className="w-[70px] h-[70px] shrink-0 mr-3">
                    <img src={paynowQr} alt="PayNow QR Code" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col justify-center pt-1">
                    <p>UEN: 53033969B</p>
                    <p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p>
                    <p>A/C Number: 535-846562-001</p>
                    <p>Bank Name: OCBC</p>
                    <p className="mt-1 font-normal">All payments must be made payable to Three Leaves (Singapore) Trading Enterprise.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-48 shrink-0 pb-1">
              <div className="border-t border-black text-center pt-1 text-[12px] font-bold">Received By</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENT: MAIN INVOICE DASHBOARD
// ==========================================
export function InvoiceModule({ sys }) {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  const handleDeleteInvoice = async (e, invoiceId) => {
    e.stopPropagation(); 
    
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this invoice? This cannot be undone.");
    
    if (confirmDelete) {
      const updatedInvoices = (sys.invoices || []).filter(inv => inv.id !== invoiceId);
      sys.setInvoices(updatedInvoices);
      if (sys.deleteRecord) { await sys.deleteRecord('invoices', invoiceId); }
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
      if (isNaN(invDate.getTime())) return false; 
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
    <div className="p-8 h-full overflow-y-auto relative print:p-0 print:overflow-visible">
      
      <div className={(previewInvoice || isGeneratorOpen) ? "print:hidden" : "block"}>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
            <FileText className="mr-3 text-blue-600" size={28} /> Invoice History
          </h1>
          <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg hover:bg-blue-700" onClick={() => setIsGeneratorOpen(true)}>
            <Plus className="mr-2" size={18} /> New Invoice
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
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

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-slate-500 font-semibold border-b">
                <th className="p-5 pl-8">Invoice No.</th>
                <th className="p-5">Date</th>
                <th className="p-5">Customer</th>
                <th className="p-5 text-right">Total</th>
                <th className="p-5 text-center w-20">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-blue-50 cursor-pointer transition-colors group" onClick={() => setPreviewInvoice(inv)}>
                  <td className="p-5 pl-8 font-mono font-bold text-blue-600">#{inv.number || inv.id}</td>
                  <td className="p-5 text-slate-500">{inv.date}</td>
                  <td className="p-5 text-slate-800">{inv.customer}</td>
                  <td className="p-5 text-right font-black text-slate-900">${formatMoney(inv.total)}</td>
                  <td className="p-5 text-center">
                    <button onClick={(e) => handleDeleteInvoice(e, inv.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previewInvoice && <InvoicePreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} sys={sys} onEdit={(inv) => { setEditingInvoice(inv); setIsGeneratorOpen(true); setPreviewInvoice(null); }} />}
      {isGeneratorOpen && <InvoiceGenerator sys={sys} existingInvoice={editingInvoice} onClose={() => { setIsGeneratorOpen(false); setEditingInvoice(null); }} />}
    </div>
  );
}
