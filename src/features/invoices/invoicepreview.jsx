import { FileText, X, Edit, Printer } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import logo from './three_leaves_logo.png';

// 1. Define a robust CJK font stack
const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

function InvoicePreviewModal({ invoice, onClose, onEdit, sys }) {
  if (!invoice) return null;

  // SAFETY NETS: Prevent crashes if data is still loading
  const customerObj = (sys?.customers || []).find(c => c.id === invoice.customerId) || {};
  const customerAddress = customerObj.address || '';
  
  const subtotal = (invoice?.items || []).reduce((sum, item) => sum + (Number(item.qty || item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const gst = subtotal * 0.09;
  const total = subtotal + gst;

  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto bg-slate-950/90 print:bg-white print:p-0">
      
      {/* ===== ENHANCED PRINT STYLES ===== */}
      <style type="text/css">
        {`
          @media print {
            @page {
              margin: 0 !important;
              size: A4;
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body * { visibility: hidden; }
            #printable-modal-invoice, #printable-modal-invoice * { visibility: visible; }
            
            #printable-modal-invoice {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 210mm !important;
              min-height: 297mm !important;
              height: auto !important;
              padding: 15mm !important;
              margin: 0 !important;
              background: white !important;
              box-sizing: border-box !important;
            }

            /* Force the font on the entire print container */
            .print-container,
            .print-container * {
              font-family: ${CJK_FONT} !important;
            }

            /* Prevent rows from splitting across pages */
            tr, td, th {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        `}
      </style>

      {/* ===== WYSIWYG A4 PAPER PREVIEW SCROLL CONTAINER ===== */}
      <div className="flex min-h-full flex-col items-center py-12 print:py-0 print:block">
        
        {/* ===== ACTION BAR (Visible on screen, hidden on print) ===== */}
        <div className="w-full max-w-[210mm] shrink-0 bg-slate-900 px-8 py-4 flex justify-between items-center text-white rounded-t-2xl shadow-2xl print:hidden border-b-4 border-blue-600">
          <div className="flex items-center">
            <FileText size={24} className="mr-3 text-blue-400" />
            <div>
              <h2 className="text-sm font-black tracking-widest uppercase text-slate-200">A4 Print Preview</h2>
              <p className="text-lg font-bold text-white leading-none mt-0.5">#{invoice.number || invoice.id}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => window.print()} 
              className="flex items-center text-sm font-bold bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl transition-colors shadow-lg"
            >
              <Printer size={18} className="mr-2" /> Print Document
            </button>
            <button 
              onClick={() => onEdit(invoice)} 
              className="flex items-center text-sm font-bold bg-slate-800 hover:bg-slate-700 px-5 py-2.5 rounded-xl transition-colors border border-slate-700"
            >
              <Edit size={16} className="mr-2" /> Edit
            </button>
            <button onClick={onClose} className="hover:bg-slate-800 p-2.5 rounded-full transition-colors ml-2 bg-slate-800">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ===== ACTUAL A4 PAPER (Visible on both screen AND print) ===== */}
        <div 
          id="printable-modal-invoice"
          className="print-container flex w-full max-w-[210mm] min-h-[297mm] flex-col bg-white p-[15mm] text-black shadow-2xl rounded-b-2xl print:rounded-none print:shadow-none box-border shrink-0"
          style={{ fontFamily: CJK_FONT }}
        >
          <div className="flex justify-between items-start mb-6">
            <div className="w-[25%]">
              <img src={logo} alt="Three Leaves Logo" className="w-[110px] h-auto object-contain" />
            </div>

            <div className="w-[50%] text-center leading-tight pt-2">
              <h1 className="font-bold text-[14px]" style={{ fontFamily: CJK_FONT }}>THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
              <h2 className="font-bold text-[13px] mb-1" style={{ fontFamily: CJK_FONT }}>三叶（新加坡） 贸易公司</h2>
              <p className="font-bold text-[10px] mb-0.5">CO.REG NO.53033969B &nbsp;&nbsp;&nbsp; GST REG NO. M90355440L</p>
              <p className="text-[10px] mb-0.5">280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
              <p className="text-[10px]">HP: 97578869 (Mr Ye) &nbsp; HP: 91113505 (Min) &nbsp; Email: 3leaves.sg@gmail.com</p>
            </div>

            <div className="w-[25%] flex flex-col items-end pt-1">
              <div className="text-center w-full mb-2">
                <h2 className="text-[18px] font-bold tracking-[0.2em] leading-none mb-0.5" style={{ fontFamily: CJK_FONT }}>發票</h2>
                <h3 className="text-[14px] font-bold tracking-widest uppercase">TAX INVOICE</h3>
              </div>
              
              <div className="w-full text-[16px] text-left mt-1 pl-4 flex flex-col leading-tight gap-1">
                <div className="flex items-center">
                  <span className="font-bold w-14 shrink-0">No.</span>
                  <span className="text-red-600 font-bold tracking-wider">{invoice.number}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-bold w-14 shrink-0">Term:</span>
                  <span className="font-bold">{invoice.paymentTerms === 'cod' ? 'COD' : '30 Days'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 text-[15px] font-bold flex flex-col w-full">
            <div className="flex justify-between w-full mb-2">
              <div className="flex items-end w-[65%] pr-4">
                <span className="w-12 shrink-0">TO:</span>
                <span className="flex-1 uppercase border-b border-black pb-0.5" style={{ fontFamily: CJK_FONT }}>
                  {invoice.customer || ''}
                </span>
              </div>
              <div className="flex items-end w-[35%] pl-4">
                <span className="w-14 shrink-0">DATE:</span>
                <span className="flex-1 text-center border-b border-black pb-0.5">
                  {/* SAFETY NET: Prevent crash on invalid date strings */}
                  {invoice.date && !isNaN(new Date(invoice.date).getTime()) 
                    ? new Date(invoice.date).toLocaleDateString('en-GB').replace(/\//g, '-') 
                    : new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}
                </span>
              </div>
            </div>
            <div className="flex items-end w-full mt-1">
              <span className="w-24 shrink-0">ADDRESS:</span>
              <span className="flex-1 uppercase leading-tight border-b border-black pb-0.5 break-words whitespace-pre-wrap" style={{ fontFamily: CJK_FONT }}>
                {customerAddress}
              </span>
            </div>
          </div>

          <table 
            className="w-full text-[15px] border-2 border-black text-center mb-0 leading-tight flex-grow"
            style={{ fontFamily: CJK_FONT }}
          >
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
              {/* SAFETY NET: Ensure items map doesn't crash if undefined */}
              {(invoice.items || []).map((item, idx) => {
                const productName = item.name || item.Items || '-';

                return (
                  <tr key={idx} className="h-[32px] align-top" style={{ fontFamily: CJK_FONT }}>
                    <td className="p-1 border-r border-black font-medium text-center">{idx + 1}</td>
                    <td 
                      className="p-1 border-r border-black text-left pl-2 font-bold" 
                      style={{ fontFamily: CJK_FONT }}
                    >
                      {productName}
                    </td>
                    <td className="p-1 border-r border-black font-medium text-center" style={{ fontFamily: CJK_FONT }}>
                      {item.qty || item.quantity} {item.unit}
                    </td>
                    <td className="p-1 border-r border-black text-center">${formatMoney(item.unitPrice)}</td>
                    <td className="p-1 text-center font-bold">
                      ${formatMoney((Number(item.qty || item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                    </td>
                  </tr>
                );
              })}
              {invoice.items && invoice.items.length < 15 && Array.from({ length: 15 - invoice.items.length }).map((_, i) => (
                <tr key={`blank-${i}`} className="h-[32px]">
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex w-full mt-2">
            <div className="flex-1 pr-4 text-[12px] font-bold leading-snug flex flex-col justify-between">
              <div style={{ fontFamily: CJK_FONT }}>
                <p>请提前一天提交订单,同日送达的截止时间为下午12点前。每周日休息</p>
                <p>Please submit orders one day in advance. The cut-off time for same-day delivery is before 12 PM. Closed on Sundays.</p>
                <div className="mt-4">
                  <p>UEN: 53033969B</p>
                  <p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p>
                  <p>A/C Number: 535-846562-001</p>
                  <p>Bank Name: OCBC</p>
                </div>
                <p className="mt-4 font-normal">All payments mode have to be made payable to Three Leaves (Singapore) Trading Enterprise.</p>
              </div>
              <div className="mt-6 mb-1">
                <div className="w-48 border-t border-black text-center pt-1 text-[12px]">Received By</div>
              </div>
            </div>

            <div className="flex flex-col font-bold text-[15px] shrink-0 w-[16rem]">
              <div className="flex">
                <div className="w-32 p-1 text-center">SUBTOTAL</div>
                <div className="w-32 p-1 text-center">${formatMoney(subtotal)}</div>
              </div>
              <div className="flex">
                <div className="w-32 p-1 text-center">9% GST</div>
                <div className="w-32 p-1 text-center">${formatMoney(gst)}</div>
              </div>
              <div className="flex mt-2 pt-2 border-t-2 border-black text-[17px]">
                <div className="w-32 p-1 text-center">TOTAL</div>
                <div className="w-32 p-1 text-center">${formatMoney(total)}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default InvoicePreviewModal;
