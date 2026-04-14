import { FileText, X, Edit, Printer } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import logo from './three_leaves_logo.png';

// 1. Define a robust CJK font stack
const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

function InvoicePreviewModal({ invoice, onClose, onEdit, sys }) {
  if (!invoice) return null;

  const customerObj = sys.customers.find(c => c.id === invoice.customerId) || {};
  const customerAddress = customerObj.address || '';
  const subtotal = invoice.items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0);
  const gst = subtotal * 0.09;
  const total = subtotal + gst;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm print:bg-white print:p-0 print:block print:absolute print:inset-0 print:z-[9999]">
      
      {/* ===== ENHANCED PRINT STYLES ===== */}
      <style type="text/css">
        {`
          @media print {
            @page {
              margin: 0.4in 0.3in;
              size: A4;
            }

            html, body {
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            /* Force the font on the entire print container */
            .print-container,
            .print-container * {
              font-family: ${CJK_FONT} !important;
            }

            /* Ensure the print container respects the page margins */
            .print\\:flex {
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              padding: 0 !important;
            }

            /* Prevent rows from splitting across pages */
            tr, td, th {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        `}
      </style>

      {/* ===== SCREEN VIEW (unchanged, hidden when printing) ===== */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] print:hidden">
        {/* ... screen view unchanged ... */}
      </div>

      {/* ===== PRINT VIEW (with font‑forced container) ===== */}
      <div 
        className="print-container hidden print:flex w-[210mm] min-h-[297mm] flex-col bg-white p-8 text-black"
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
                {invoice.date 
                  ? new Date(invoice.date).toLocaleDateString('en-GB').replace(/\//g, '-') 
                  : new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}
              </span>
            </div>
          </div>
          <div className="flex items-end w-full mt-1">
            <span className="w-24 shrink-0">ADDRESS:</span>
            <span className="flex-1 uppercase leading-tight border-b border-black pb-0.5" style={{ fontFamily: CJK_FONT }}>
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
            {invoice.items && invoice.items.map((item, idx) => {
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
  );
}

export default InvoicePreviewModal;
