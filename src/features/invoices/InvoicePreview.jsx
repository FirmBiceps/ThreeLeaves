import { Eye, FileText, ChevronLeft, Save, Printer, Edit, X } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import logo from './three_leaves_logo.png';
import paynowQr from './paynow_qr.jpg';

const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

export function InvoicePreview({ 
  mode = 'generator', // 'generator' | 'history'
  customer, gst, invoiceNumber, invoiceDate, items, remarks,
  onBack, onRegister, onPrint, onEdit, onClose, 
  paymentTerms, subtotal, sys, total, existingInvoice, isSpecialFormat, poNumber, carPlateNo 
}) {
  const customerAddress = customer?.address || existingInvoice?.address || '';
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  const actualItemCount = safeItems.filter(item => {
    const n = String(item?.name || item?.Items || item?.rawSearchString || '').trim();
    return n !== '' && n !== '-';
  }).length;

  let baseText = "text-[15px]";
  let cellPad = "py-1";
  let descPad = "pt-1.5";
  let totalText = "text-[17px]";
  let subtotalText = "text-[15px]";
  let gstText = "text-[14px]";

  let spBaseText = "text-[14px]";
  let spCellPad = "py-1.5";

  if (actualItemCount > 20) {
    baseText = "text-[13px] leading-none"; 
    cellPad = "py-0"; 
    descPad = "pt-0.5";
    totalText = "text-[15px]";
    subtotalText = "text-[13px]";
    gstText = "text-[12px]";
    
    spBaseText = "text-[11px] leading-tight";
    spCellPad = "py-0";
  } else if (actualItemCount > 14) {
    baseText = "text-[14px] leading-tight";
    cellPad = "py-0.5";
    descPad = "pt-1";
    totalText = "text-[16px]";
    subtotalText = "text-[14px]";
    gstText = "text-[13px]";
    
    spBaseText = "text-[12px] leading-tight";
    spCellPad = "py-0.5";
  }

  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto bg-slate-950/90 print:static print:block print:bg-white print:p-0 print:backdrop-filter-none">
      <style type="text/css">
        {`
          @media print {
            @page { size: A4; margin: 0 !important; }
            html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body * { visibility: hidden !important; }
            #printable-invoice-wrapper, #printable-invoice-wrapper * { visibility: visible !important; }
            #printable-invoice-wrapper { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; height: 297mm !important; padding: 15mm 10mm !important; margin: 0 !important; background: white !important; backdrop-filter: none !important; box-sizing: border-box !important; display: flex !important; flex-direction: column !important;}
            *, html, body, div, p, span, h1, h2, h3, table, th, td { font-family: ${CJK_FONT} !important; }
            tr, td, th { page-break-inside: avoid; break-inside: avoid; }
          }
        `}
      </style>
      <div className="flex min-h-full flex-col items-center py-12 print:block print:py-0 print:m-0">
        <div className="w-full max-w-[210mm] shrink-0 bg-slate-900 px-8 py-4 flex justify-between items-center text-white rounded-t-2xl shadow-2xl print:hidden border-b-4 border-blue-600">
          <div className="flex items-center">
            {mode === 'generator' ? <Eye size={24} className="mr-3 text-blue-400" /> : <FileText size={24} className="mr-3 text-blue-400" />}
            <div>
              <h2 className="text-sm font-black tracking-widest uppercase text-slate-200">{mode === 'generator' ? 'Invoice Layout Check' : 'A4 Print Preview'}</h2>
              <p className="text-lg font-bold text-white leading-none mt-0.5">#{String(invoiceNumber)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {mode === 'generator' ? (
              <>
                <button className="flex items-center rounded bg-slate-800 px-5 py-2.5 font-bold text-white transition-all hover:bg-slate-700 border border-slate-700 text-sm" onClick={onBack} type="button"><ChevronLeft size={16} className="mr-1" /> Edit Draft</button>
                <button className="flex items-center rounded bg-white px-5 py-2.5 font-bold text-slate-900 shadow-lg transition-all hover:bg-slate-50 text-sm" onClick={() => onRegister(false)} type="button"><Save className="mr-2" size={16} /> Save Invoice</button>
              </>
            ) : (
              <>
                <button onClick={onPrint} className="flex items-center text-sm font-bold bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl transition-colors shadow-lg"><Printer size={18} className="mr-2" /> Print</button>
                <button onClick={onEdit} className="flex items-center text-sm font-bold bg-slate-800 hover:bg-slate-700 px-5 py-2.5 rounded-xl transition-colors border border-slate-700"><Edit size={16} className="mr-2" /> Edit</button>
                <button onClick={onClose} className="hover:bg-slate-700 p-2.5 rounded-full transition-colors ml-2 bg-slate-800"><X size={20} /></button>
              </>
            )}
          </div>
        </div>
        
        <div id="printable-invoice-wrapper" lang="zh" className="flex w-full max-w-[210mm] h-[297mm] flex-col bg-white py-[15mm] px-[10mm] text-black shadow-2xl rounded-b-2xl print:w-[210mm] print:h-[297mm] print:max-w-none print:rounded-none print:shadow-none box-border" style={{ fontFamily: CJK_FONT }}>
          
          {isSpecialFormat ? (
            <div className="flex flex-col h-full w-full">
              <div className="flex w-full justify-between items-start border-b-2 border-slate-800 pb-4 mb-3 shrink-0">
                <div className="flex flex-col gap-2 w-[55%] pr-4">
                  <img src={logo} className="w-[100px] h-auto object-contain" alt="Logo" />
                  <div className="leading-snug">
                    <h1 className="font-black text-[16px] uppercase tracking-tight" style={{ fontFamily: CJK_FONT }}>Three Leaves (Singapore) Trading Enterprise</h1>
                    <h2 className="font-bold text-[14px] mb-1" style={{ fontFamily: CJK_FONT }}>三叶（新加坡） 贸易公司</h2>
                    <div className="text-[#d55e2d] font-bold text-[9px] leading-tight tracking-tight">
                      <p>CO.REG NO.53033969B &nbsp;|&nbsp; GST REG NO. M90355440L</p>
                      <p>280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
                      <p>HP: 97578869 (Mr Ye) &nbsp;|&nbsp; HP: 91113505 (Min) &nbsp;|&nbsp; 3leaves.sg@gmail.com</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end w-[45%] text-right pl-4">
                  <img 
                    src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${invoiceNumber}&scale=3&height=10&includetext=true&textxalign=center`} 
                    alt="Barcode" 
                    className="h-[60px] w-auto max-w-full object-contain mb-3" 
                  />
                  <h2 className="text-[20px] font-black tracking-[0.3em] leading-none mb-1" style={{ fontFamily: CJK_FONT }}>發票</h2>
                  <h3 className="text-[14px] font-black tracking-widest uppercase mb-3 text-black">TAX INVOICE</h3>
                  
                  <table className="text-[12px] font-bold text-slate-800 text-right w-full max-w-[200px]">
                    <tbody>
                      <tr>
                        <td className="text-slate-500 pb-1 text-left w-[40%]">NO:</td>
                        <td className="text-red-600 text-[14px] font-black pb-1">{invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 pb-1 text-left">TERM:</td>
                        <td className="pb-1">{paymentTerms === 'cod' ? 'COD' : '30 Days'}</td>
                      </tr>
                      {poNumber && (
                        <tr>
                          <td className="text-slate-500 text-left">PO NO:</td>
                          <td>{poNumber}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-end mb-3 shrink-0 text-[12px] font-bold">
                <div className="w-[65%] leading-relaxed">
                  <div className="flex items-start">
                    <span className="w-[45px] shrink-0 text-slate-500">TO:</span>
                    <span className="flex-1 uppercase border-b border-slate-800 pb-0.5">{String(customer?.name || existingInvoice?.customer || '')}</span>
                  </div>
                  <div className="flex items-start mt-1">
                    <span className="w-[45px] shrink-0 text-slate-500">ADD:</span>
                    <span className="flex-1 uppercase border-b border-slate-800 pb-0.5 truncate">{String(customerAddress)}</span>
                  </div>
                </div>
                <div className="w-[30%] flex items-end">
                  <span className="w-[45px] shrink-0 text-slate-500">DATE:</span>
                  <span className="flex-1 border-b border-slate-800 pb-0.5 text-right">{invoiceDate && !isNaN(new Date(invoiceDate).getTime()) ? new Date(invoiceDate).toLocaleDateString('en-GB').replace(/\//g, '-') : new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col w-full shrink-0">
              <div className="flex w-full mb-4 justify-between shrink-0">
                <div className="flex-1 flex flex-col pr-4">
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center">
                      <div className="w-[110px] shrink-0 mr-4"><img src={logo} alt="Three Leaves Logo" className="w-full h-auto object-contain" /></div>
                      <div className="flex-1 text-left leading-snug pt-2 whitespace-nowrap overflow-visible">
                        <h1 className="font-black text-[17px]" style={{ fontFamily: CJK_FONT }}>THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1><h2 className="font-bold text-[16px] mb-1" style={{ fontFamily: CJK_FONT }}>三叶（新加坡） 贸易公司</h2>
                        <div className="text-[#d55e2d] font-bold text-[10.5px] leading-tight tracking-tight"><p className="whitespace-nowrap">CO.REG NO.53033969B &nbsp;&nbsp; GST REG NO. M90355440L</p><p className="whitespace-nowrap">280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p><p className="whitespace-nowrap">HP: 97578869 (Mr Ye) &nbsp;&nbsp; HP: 91113505 (Min) &nbsp;&nbsp; Email: 3leaves.sg@gmail.com</p></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-end w-full mb-2 text-[14px] font-bold">
                    <div className="flex items-end flex-1 pr-4"><span className="shrink-0 mr-2 text-black">TO:</span><span className="flex-1 uppercase border-b border-black pb-0.5 whitespace-nowrap text-[13px] tracking-tight" style={{ fontFamily: CJK_FONT }}>{String(customer?.name || existingInvoice?.customer || '')}</span></div>
                    <div className="flex items-end w-[35%] pl-2"><span className="shrink-0 mr-2 text-black">DATE:</span><span className="flex-1 text-center border-b border-black pb-0.5">{invoiceDate && !isNaN(new Date(invoiceDate).getTime()) ? new Date(invoiceDate).toLocaleDateString('en-GB').replace(/\//g, '-') : new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}</span></div>
                  </div>
                  <div className="flex items-end w-full text-[14px] font-bold"><span className="shrink-0 mr-2 text-black">ADDRESS:</span><span className="flex-1 uppercase border-b border-black pb-0.5 whitespace-nowrap text-[12px] tracking-tighter" style={{ fontFamily: CJK_FONT }}>{String(customerAddress)}</span></div>
                </div>
                <div className="w-[180px] shrink-0 flex flex-col items-start pl-4 pt-1">
                  <h2 className="text-[22px] font-bold tracking-[0.4em] leading-none mb-1" style={{ fontFamily: CJK_FONT }}>發票</h2><h3 className="text-[15px] font-black tracking-wide uppercase mb-2 text-black">TAX INVOICE</h3>
                  <div className="w-full flex flex-col gap-3 mt-auto mb-2">
                    <div className="flex items-baseline"><span className="font-bold w-[50px] shrink-0 text-black text-[15px]">No.</span><span className="text-red-600 font-bold tracking-wider text-[17px] leading-none">{String(invoiceNumber)}</span></div>
                    <div className="flex items-baseline"><span className="font-bold w-[50px] shrink-0 text-black text-[15px]">Term:</span><span className="text-red-600 font-bold text-[16px] leading-none">{paymentTerms === 'cod' ? 'COD' : '30 Days'}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <table className={`w-full h-full flex-grow border-2 border-black text-center mb-0 mt-2 ${isSpecialFormat ? spBaseText : baseText}`} style={{ fontFamily: CJK_FONT }}>
            <thead className="border-b-2 border-black">
              <tr className="font-bold bg-white text-[14px]"><th className="py-2 px-1 w-12 text-center">NO.</th><th className="py-2 px-2 text-left">DESCRIPTION</th><th className="py-2 px-1 w-24 text-center">QUANTITY</th><th className="py-2 px-1 w-32 text-center">UNIT PRICE</th><th className="py-2 px-1 w-32 text-center">AMOUNT</th></tr>
            </thead>
            <tbody style={{ fontFamily: CJK_FONT }}>
              {safeItems.map((item, idx) => {
                const foundProduct = safeInventory.find((entry) => entry?.id === item?.itemId);
                const productName = foundProduct ? String(foundProduct.Name || foundProduct.name || foundProduct.Items || '') : String(item?.name || item?.Items || item?.rawSearchString || '').trim();
                const isBlank = productName === '' || productName === '-';
                
                return (
                  <tr key={idx} className="align-top text-slate-900" style={{ fontFamily: CJK_FONT }}>
                    <td className={`px-1 text-center font-normal ${isSpecialFormat ? spCellPad : cellPad}`}>{idx + 1}</td>
                    <td className={`px-1 text-left pl-2 font-normal ${isSpecialFormat ? spCellPad : cellPad} ${isSpecialFormat ? '' : descPad}`} style={{ fontFamily: CJK_FONT }}>
                      {!isBlank ? (
                        <span>☐ {productName}</span>
                      ) : (
                        <div className="text-transparent select-none">☐</div>
                      )}
                    </td>
                    <td className={`px-1 text-center font-normal ${isSpecialFormat ? spCellPad : cellPad}`} style={{ fontFamily: CJK_FONT }}>{String(item?.qty || item?.quantity || 0)} {String(item?.unit || '')}</td>
                    <td className={`px-1 text-center font-normal ${isSpecialFormat ? spCellPad : cellPad}`}>${formatMoney(item?.unitPrice)}</td>
                    <td className={`px-1 text-center font-normal ${isSpecialFormat ? spCellPad : cellPad}`}>
                      ${formatMoney((Number(item?.qty || item?.quantity) || 0) * (Number(item?.unitPrice) || 0))}
                    </td>
                  </tr>
                );
              })}
              
              <tr className="h-full">
                <td></td>
                <td className="text-center align-middle py-4">
                  {isSpecialFormat && carPlateNo && (
                    <div className="inline-block text-slate-900">
                       <span className="text-[14px] font-bold">Car Plate No: </span>
                       <span className="text-[16px] font-black">{carPlateNo}</span>
                    </div>
                  )}
                </td>
                <td></td><td></td><td></td>
              </tr>
              
              <tr className="border-t-2 border-black font-bold h-[28px]">
                <td colSpan="3" rowSpan="3" className="bg-white border-r-2 border-black p-2 align-top text-left">
                  {(!isSpecialFormat && remarks) && (
                    <div className="w-full max-h-[72px] overflow-hidden text-[11px] font-normal text-slate-800 whitespace-pre-wrap break-words leading-tight" style={{ fontFamily: CJK_FONT }}>
                      <span className="font-bold underline block mb-0.5">Remarks / Notes:</span>
                      {remarks}
                    </div>
                  )}
                </td>
                <td className={`p-1 text-center bg-white ${gstText}`}>SUBTOTAL</td><td className={`p-1 text-center bg-white ${subtotalText}`}>${formatMoney(subtotal)}</td>
              </tr>
              <tr className="font-bold h-[28px] border-t border-black bg-white"><td className={`p-1 text-center ${gstText}`}>9% GST</td><td className={`p-1 text-center ${subtotalText}`}>${formatMoney(gst)}</td></tr>
              <tr className="font-bold h-[32px] border-t-2 border-black bg-white"><td className="p-1 text-center text-[16px]">TOTAL</td><td className={`p-1 text-center ${totalText}`}>${formatMoney(total)}</td></tr>
            </tbody>
          </table>
          <div className="flex w-full mt-4 pt-2 items-end shrink-0">
            <div className="w-[70%] text-[12px] font-bold leading-snug pr-4">
              <div style={{ fontFamily: CJK_FONT }}>
                <p className="text-[12px]">请提前一天提交订单,同日送达的截止时间为下午12点前。每周日休息</p><p className="text-[10px] whitespace-nowrap text-slate-800">Please submit orders one day in advance. The cut-off time for same-day delivery is before 12 PM. Closed on Sundays.</p>
                <div className="mt-2 flex items-center">
                  <div className="w-[80px] h-[80px] shrink-0 mr-3 flex items-center justify-center"><img src={paynowQr} alt="PayNow QR Code" className="w-[80px] h-[80px] object-contain" /></div>
                  <div className="flex flex-col justify-center text-[11px]"><p>UEN: 53033969B</p><p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p><p>A/C Number: 535-846562-001</p><p>Bank Name: OCBC</p><p className="mt-0.5 font-normal text-[10px] text-slate-800">All payments must be made payable to Three Leaves (Singapore) Trading Enterprise.</p></div>
                </div>
              </div>
            </div>
            <div className="w-[30%] shrink-0 flex flex-col justify-end pb-1 pl-2"><div className="h-12"></div><div className="border-t-2 border-black text-center pt-1.5 text-[12px] font-bold uppercase tracking-widest">Received By</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InvoicePreviewModal({ invoice, onClose, onEdit, sys }) {
  if (!invoice) return null;
  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];
  const customerObj = safeCustomers.find(c => c?.id === invoice?.customerId) || {};
  const customerAddress = String(customerObj?.address || '');
  const subtotal = (invoice?.items || []).filter(Boolean).reduce((sum, item) => sum + (Number(item?.qty || item?.quantity) || 0) * (Number(item?.unitPrice) || 0), 0);
  const gst = subtotal * 0.09;

  return (
    <InvoicePreview
      mode="history"
      customer={{ name: invoice.customer, address: customerAddress }}
      gst={gst}
      invoiceNumber={invoice.number || invoice.id}
      invoiceDate={invoice.date}
      items={invoice.items}
      remarks={invoice.remarks}
      onPrint={() => window.print()}
      onEdit={() => onEdit(invoice)}
      onClose={onClose}
      paymentTerms={invoice.paymentTerms}
      subtotal={subtotal}
      sys={sys}
      total={subtotal + gst}
      isSpecialFormat={invoice.isSpecialFormat}
      poNumber={invoice.poNumber}
      carPlateNo={invoice.carPlateNo}
    />
  );
}
