import { useEffect, useMemo, useState, useRef } from 'react';
import { Eye, FileText, MessageSquare, Printer, Save, Sparkles, Trash2, Search, BrainCircuit, ChevronLeft, X, Settings, AlertTriangle, ArrowUpDown, Plus, Edit, Filter, CheckCircle, AlertCircle, ChevronDown, Check, Layers, User, ScanBarcode } from 'lucide-react';
import { CompanyHeader } from '../../components/shared/CompanyHeader';
import { UNIT_OPTIONS } from '../../data/company';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';

import logo from './three_leaves_logo.png';
import paynowQr from './paynow_qr.jpg';

const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

// ==========================================
// COMPONENT: SEARCHABLE PRODUCT DROPDOWN
// ==========================================
function ProductSearchSelect({ value, inventory, onChange, isAutoFilled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) { setIsOpen(false); }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const selectedProduct = safeInventory.find((entry) => entry?.id === value);
  
  const getDisplayName = (item) => {
    if (!item) return '';
    const name = String(item.Name || item.name || item.Items || 'Unnamed Product');
    const sku = item.SKU || item.sku;
    return sku ? `[${sku}] ${name}` : name;
  };

  const displayName = getDisplayName(selectedProduct);

  const filteredInventory = safeInventory.filter((item) => {
    if (!item) return false;
    const itemName = String(item.Name || item.name || item.Items || '').toLowerCase();
    const itemSku = String(item.SKU || item.sku || '').toLowerCase();
    const searchLower = String(searchTerm).toLowerCase();
    return itemName.includes(searchLower) || itemSku.includes(searchLower);
  });

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => { setIsOpen(true); setSearchTerm(''); }}
          className={`w-full text-left text-xs font-bold p-1 border border-transparent rounded hover:bg-slate-200 transition-colors focus:outline-none ${displayName ? (isAutoFilled ? 'text-indigo-600' : 'text-slate-900') : 'text-slate-400'}`}
        >
          {displayName || '- Search Product or SKU -'}
        </button>
      ) : (
        <div className="absolute z-[5000] top-0 left-0 w-72 bg-white border border-slate-300 rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center p-2 border-b border-slate-200 bg-slate-50">
            <Search size={14} className="text-slate-400 ml-1 mr-2 shrink-0" />
            <input autoFocus type="text" className="w-full bg-transparent border-none text-xs font-bold text-slate-800 p-1 focus:ring-0 placeholder:text-slate-400 outline-none" placeholder="Type name or SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => {
                return (
                  <button key={item.id} type="button" className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 border-b border-slate-100 last:border-0 transition-colors" onClick={() => { onChange(item.id); setIsOpen(false); }}>
                    {getDisplayName(item)}
                  </button>
                );
              })
            ) : (<div className="p-3 text-center text-xs text-slate-400 font-medium">No products found.</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENT: SEARCHABLE CUSTOMER DROPDOWN
// ==========================================
function CustomerSearchSelect({ value, customers, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) { setIsOpen(false); }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const selectedCustomer = safeCustomers.find((c) => c?.id === value);
  const displayName = selectedCustomer ? String(selectedCustomer.name || '') : '';

  const filteredCustomers = safeCustomers.filter((c) => c && String(c.name || '').toLowerCase().includes(String(searchTerm).toLowerCase()));

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      {!isOpen ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setIsOpen(true); setSearchTerm(''); }}
          className={`mt-1 w-full text-left text-[16px] font-black p-0 border border-transparent bg-transparent focus:outline-none transition-colors ${displayName ? 'text-slate-900' : 'text-slate-400'} ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:text-blue-600'}`}
        >
          {displayName || 'Select Entity...'}
        </button>
      ) : (
        <div className="absolute z-[5000] top-8 left-0 w-80 bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center p-3 border-b border-slate-200 bg-slate-50">
            <Search size={16} className="text-slate-400 ml-1 mr-2 shrink-0" />
            <input autoFocus type="text" className="w-full bg-transparent border-none text-sm font-bold text-slate-800 p-1 focus:ring-0 placeholder:text-slate-400 outline-none" placeholder="Search customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((c) => (
                <button key={c.id} type="button" className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors" onClick={() => { onChange(c.id); setIsOpen(false); }}>
                  {String(c.name || '')}
                </button>
              ))
            ) : (<div className="p-4 text-center text-sm text-slate-400 font-medium">No customers found.</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENT: LAYOUT CHECK (Generator Preview)
// ==========================================
function InvoicePreview({ customer, gst, invoiceNumber, invoiceDate, items, onBack, onRegister, paymentTerms, subtotal, sys, total, existingInvoice, isSpecialFormat, poNumber, carPlateNo }) {
  const customerAddress = customer?.address || existingInvoice?.address || '';
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  // DYNAMIC A4 SIZING ENGINE - VERTICAL SPACING FOCUS
  const itemCount = safeItems.length;
  let baseText = "text-[15px]";
  let cellPad = "py-1";
  let descPad = "pt-1.5";
  let totalText = "text-[17px]";
  let subtotalText = "text-[15px]";
  let gstText = "text-[14px]";

  if (itemCount > 20) {
    baseText = "text-[13px] leading-none"; // Keep font readable, tighten line height
    cellPad = "py-0"; // aggressively strip vertical padding
    descPad = "pt-0.5";
    totalText = "text-[15px]";
    subtotalText = "text-[13px]";
    gstText = "text-[12px]";
  } else if (itemCount > 14) {
    baseText = "text-[14px] leading-tight";
    cellPad = "py-0.5";
    descPad = "pt-1";
    totalText = "text-[16px]";
    subtotalText = "text-[14px]";
    gstText = "text-[13px]";
  }

  return (
    <div className="fixed inset-0 z-[3000] overflow-y-auto bg-slate-950/90 print:static print:block print:bg-white print:p-0 print:backdrop-filter-none">
      <style type="text/css">
        {`
          @media print {
            @page { size: A4; margin: 0 !important; }
            html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body * { visibility: hidden !important; }
            #printable-invoice-generator, #printable-invoice-generator * { visibility: visible !important; }
            #printable-invoice-generator { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; height: 297mm !important; padding: 15mm 10mm !important; margin: 0 !important; background: white !important; backdrop-filter: none !important; box-sizing: border-box !important; display: flex !important; flex-direction: column !important;}
            *, html, body, div, p, span, h1, h2, h3, table, th, td { font-family: ${CJK_FONT} !important; }
            tr, td, th { page-break-inside: avoid; break-inside: avoid; }
          }
        `}
      </style>
      <div className="flex min-h-full flex-col items-center py-12 print:block print:py-0 print:m-0">
        <div className="w-full max-w-[210mm] shrink-0 bg-slate-900 px-8 py-4 flex justify-between items-center text-white rounded-t-2xl shadow-2xl print:hidden border-b-4 border-blue-600">
          <div className="flex items-center"><Eye size={24} className="mr-3 text-blue-400" /><div><h2 className="text-sm font-black tracking-widest uppercase text-slate-200">Invoice Layout Check</h2><p className="text-lg font-bold text-white leading-none mt-0.5">#{String(invoiceNumber)}</p></div></div>
          <div className="flex items-center space-x-3">
            <button className="flex items-center rounded bg-slate-800 px-5 py-2.5 font-bold text-white transition-all hover:bg-slate-700 border border-slate-700 text-sm" onClick={onBack} type="button"><ChevronLeft size={16} className="mr-1" /> Edit Draft</button>
            <button className="flex items-center rounded bg-white px-5 py-2.5 font-bold text-slate-900 shadow-lg transition-all hover:bg-slate-50 text-sm" onClick={() => onRegister(false)} type="button"><Save className="mr-2" size={16} /> Save Invoice</button>
          </div>
        </div>
        <div id="printable-invoice-generator" lang="zh" className="flex w-full max-w-[210mm] h-[297mm] flex-col bg-white py-[15mm] px-[10mm] text-black shadow-2xl rounded-b-2xl print:w-[210mm] print:h-[297mm] print:max-w-none print:rounded-none print:shadow-none box-border shrink-0" style={{ fontFamily: CJK_FONT }}>
          
          {isSpecialFormat ? (
            // ==========================================
            // SPECIAL FORMAT LAYOUT (REDESIGNED HEADER)
            // ==========================================
            <div className="flex flex-col w-full">
              
              <div className="flex w-full justify-between items-start border-b-2 border-slate-800 pb-4 mb-3 shrink-0">
                {/* Left: Company Details (Fixed 55% width) */}
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
                
                {/* Right: Barcode & Invoice Meta (Fixed 45% width) */}
                <div className="flex flex-col items-end w-[45%] text-right pl-4">
                  {/* PERFECT ASPECT RATIO BARCODE */}
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

              {/* BILL TO & DATE */}
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
            // ==========================================
            // STANDARD FORMAT LAYOUT
            // ==========================================
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

          <table className={`w-full h-full flex-grow border-2 border-black text-center mb-0 mt-2 ${baseText}`} style={{ fontFamily: CJK_FONT }}>
            <thead className="border-b-2 border-black">
              <tr className="font-bold bg-white text-[14px]"><th className="py-2 px-1 w-12 text-center">NO.</th><th className="py-2 px-2 text-left">DESCRIPTION</th><th className="py-2 px-1 w-24 text-center">QUANTITY</th><th className="py-2 px-1 w-32 text-center">UNIT PRICE</th><th className="py-2 px-1 w-32 text-center">AMOUNT</th></tr>
            </thead>
            <tbody style={{ fontFamily: CJK_FONT }}>
              {safeItems.map((item, idx) => {
                const foundProduct = safeInventory.find((entry) => entry?.id === item?.itemId);
                const productName = foundProduct ? String(foundProduct.Name || foundProduct.name || foundProduct.Items || '') : String(item?.name || item?.Items || item?.rawSearchString || '-');
                return (
                  <tr key={idx} className="align-top text-slate-900" style={{ fontFamily: CJK_FONT }}>
                    <td className={`px-1 text-center font-normal ${cellPad}`}>{idx + 1}</td>
                    <td className={`px-1 text-left pl-2 font-normal ${cellPad} ${descPad}`} style={{ fontFamily: CJK_FONT }}>{productName}</td>
                    <td className={`px-1 text-center font-normal ${cellPad}`} style={{ fontFamily: CJK_FONT }}>{String(item?.qty || item?.quantity || 0)} {String(item?.unit || item?.Unit || '')}</td>
                    <td className={`px-1 text-center font-normal ${cellPad}`}>${formatMoney(item?.unitPrice)}</td>
                    <td className={`px-1 text-center font-normal ${cellPad}`}>${formatMoney((Number(item?.qty || item?.quantity) || 0) * (Number(item?.unitPrice) || 0))}</td>
                  </tr>
                );
              })}
              
              <tr className="h-full">
                <td></td>
                <td className="text-center align-middle">
                  {/* CLEAN TEXT CENTERED CAR PLATE */}
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
                <td colSpan="3" rowSpan="3" className="bg-white border-r-2 border-black p-2 align-top text-left"></td>
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

// ==========================================
// COMPONENT: HISTORY PREVIEW MODAL
// ==========================================
function InvoicePreviewModal({ invoice, onClose, onEdit, sys }) {
  if (!invoice) return null;

  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const safeItems = Array.isArray(invoice?.items) ? invoice.items.filter(Boolean) : [];

  const customerObj = safeCustomers.find(c => c?.id === invoice?.customerId) || {};
  const customerAddress = String(customerObj?.address || '');
  const subtotal = safeItems.reduce((sum, item) => sum + (Number(item?.qty || item?.quantity) || 0) * (Number(item?.unitPrice) || 0), 0);
  const gst = subtotal * 0.09;
  const total = subtotal + gst;

  const isSpecialFormat = invoice.isSpecialFormat;
  const poNumber = invoice.poNumber;
  const carPlateNo = invoice.carPlateNo;
  const invoiceNumber = String(invoice?.number || invoice?.id || '');

  // DYNAMIC A4 SIZING ENGINE - VERTICAL SPACING FOCUS
  const itemCount = safeItems.length;
  let baseText = "text-[15px]";
  let cellPad = "py-1";
  let descPad = "pt-1.5";
  let totalText = "text-[17px]";
  let subtotalText = "text-[15px]";
  let gstText = "text-[14px]";

  if (itemCount > 20) {
    baseText = "text-[13px] leading-none"; 
    cellPad = "py-0"; 
    descPad = "pt-0.5";
    totalText = "text-[15px]";
    subtotalText = "text-[13px]";
    gstText = "text-[12px]";
  } else if (itemCount > 14) {
    baseText = "text-[14px] leading-tight";
    cellPad = "py-0.5";
    descPad = "pt-1";
    totalText = "text-[16px]";
    subtotalText = "text-[14px]";
    gstText = "text-[13px]";
  }

  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto bg-slate-950/90 print:static print:block print:bg-white print:p-0 print:backdrop-filter-none">
      <style type="text/css">
        {`
          @media print {
            @page { size: A4; margin: 0 !important; }
            html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body * { visibility: hidden !important; }
            #printable-invoice-history, #printable-invoice-history * { visibility: visible !important; }
            #printable-invoice-history { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; height: 297mm !important; padding: 15mm 10mm !important; margin: 0 !important; background: white !important; backdrop-filter: none !important; display: flex !important; flex-direction: column !important; }
            *, html, body, div, p, span, h1, h2, h3, table, th, td { font-family: ${CJK_FONT} !important; }
            tr, td, th { page-break-inside: avoid; break-inside: avoid; }
          }
        `}
      </style>
      <div className="flex min-h-full flex-col items-center py-12 print:block print:py-0 print:m-0">
        <div className="w-full max-w-[210mm] shrink-0 bg-slate-900 px-8 py-4 flex justify-between items-center text-white rounded-t-2xl shadow-2xl print:hidden border-b-4 border-blue-600">
          <div className="flex items-center"><FileText size={24} className="mr-3 text-blue-400" /><div><h2 className="text-sm font-black tracking-widest uppercase text-slate-200">A4 Print Preview</h2><p className="text-lg font-bold text-white leading-none mt-0.5">#{invoiceNumber}</p></div></div>
          <div className="flex items-center space-x-3">
            <button onClick={() => window.print()} className="flex items-center text-sm font-bold bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl transition-colors shadow-lg"><Printer size={18} className="mr-2" /> Print Document</button>
            <button onClick={() => onEdit(invoice)} className="flex items-center text-sm font-bold bg-slate-800 hover:bg-slate-700 px-5 py-2.5 rounded-xl transition-colors border border-slate-700"><Edit size={16} className="mr-2" /> Edit</button>
            <button onClick={onClose} className="hover:bg-slate-700 p-2.5 rounded-full transition-colors ml-2 bg-slate-800"><X size={20} /></button>
          </div>
        </div>
        <div id="printable-invoice-history" lang="zh" className="flex w-full max-w-[210mm] h-[297mm] flex-col bg-white py-[15mm] px-[10mm] text-black shadow-2xl rounded-b-2xl print:w-[210mm] print:h-[297mm] print:max-w-none print:rounded-none print:shadow-none box-border" style={{ fontFamily: CJK_FONT }}>
          
          {isSpecialFormat ? (
            <div className="flex flex-col w-full">
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
                        <td className="pb-1">{invoice?.paymentTerms === 'cod' ? 'COD' : '30 Days'}</td>
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
                    <span className="flex-1 uppercase border-b border-slate-800 pb-0.5">{String(invoice?.customer || '')}</span>
                  </div>
                  <div className="flex items-start mt-1">
                    <span className="w-[45px] shrink-0 text-slate-500">ADD:</span>
                    <span className="flex-1 uppercase border-b border-slate-800 pb-0.5 truncate">{String(customerAddress)}</span>
                  </div>
                </div>
                <div className="w-[30%] flex items-end">
                  <span className="w-[45px] shrink-0 text-slate-500">DATE:</span>
                  <span className="flex-1 border-b border-slate-800 pb-0.5 text-right">{invoice?.date && !isNaN(new Date(invoice.date).getTime()) ? new Date(invoice.date).toLocaleDateString('en-GB').replace(/\//g, '-') : new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}</span>
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
                    <div className="flex items-end flex-1 pr-4"><span className="shrink-0 mr-2 text-black">TO:</span><span className="flex-1 uppercase border-b border-black pb-0.5 whitespace-nowrap text-[13px] tracking-tight" style={{ fontFamily: CJK_FONT }}>{String(invoice?.customer || '')}</span></div>
                    <div className="flex items-end w-[35%] pl-2"><span className="shrink-0 mr-2 text-black">DATE:</span><span className="flex-1 text-center border-b border-black pb-0.5">{invoice?.date && !isNaN(new Date(invoice.date).getTime()) ? new Date(invoice.date).toLocaleDateString('en-GB').replace(/\//g, '-') : new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}</span></div>
                  </div>
                  <div className="flex items-end w-full text-[14px] font-bold"><span className="shrink-0 mr-2 text-black">ADDRESS:</span><span className="flex-1 uppercase border-b border-black pb-0.5 whitespace-nowrap text-[12px] tracking-tighter" style={{ fontFamily: CJK_FONT }}>{String(customerAddress)}</span></div>
                </div>
                <div className="w-[180px] shrink-0 flex flex-col items-start pl-4 pt-1">
                  <h2 className="text-[22px] font-bold tracking-[0.4em] leading-none mb-1" style={{ fontFamily: CJK_FONT }}>發票</h2><h3 className="text-[15px] font-black tracking-wide uppercase mb-2 text-black">TAX INVOICE</h3>
                  <div className="w-full flex flex-col gap-3 mt-auto mb-2">
                    <div className="flex items-baseline"><span className="font-bold w-[50px] shrink-0 text-black text-[15px]">No.</span><span className="text-red-600 font-bold tracking-wider text-[17px] leading-none">{String(invoiceNumber)}</span></div>
                    <div className="flex items-baseline"><span className="font-bold w-[50px] shrink-0 text-black text-[15px]">Term:</span><span className="text-red-600 font-bold text-[16px] leading-none">{invoice?.paymentTerms === 'cod' ? 'COD' : '30 Days'}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <table className={`w-full h-full flex-grow border-2 border-black text-center mb-0 mt-2 ${baseText}`} style={{ fontFamily: CJK_FONT }}>
            <thead className="border-b-2 border-black">
              <tr className="font-bold bg-white text-[14px]"><th className="py-2 px-1 w-12 text-center">NO.</th><th className="py-2 px-2 text-left">DESCRIPTION</th><th className="py-2 px-1 w-24 text-center">QUANTITY</th><th className="py-2 px-1 w-32 text-center">UNIT PRICE</th><th className="py-2 px-1 w-32 text-center">AMOUNT</th></tr>
            </thead>
            <tbody style={{ fontFamily: CJK_FONT }}>
              {safeItems.map((item, idx) => {
                const productName = String(item?.name || item?.Items || item?.rawSearchString || '-');
                return (
                  <tr key={idx} className="align-top text-slate-900" style={{ fontFamily: CJK_FONT }}>
                    <td className={`px-1 text-center font-normal ${cellPad}`}>{idx + 1}</td>
                    <td className={`px-1 text-left pl-2 font-normal ${cellPad} ${descPad}`} style={{ fontFamily: CJK_FONT }}>{productName}</td>
                    <td className={`px-1 text-center font-normal ${cellPad}`} style={{ fontFamily: CJK_FONT }}>{String(item?.qty || item?.quantity || 0)} {String(item?.unit || '')}</td>
                    <td className={`px-1 text-center font-normal ${cellPad}`}>${formatMoney(item?.unitPrice)}</td>
                    <td className={`px-1 text-center font-normal ${cellPad}`}>
                      ${formatMoney((Number(item?.qty || item?.quantity) || 0) * (Number(item?.unitPrice) || 0))}
                    </td>
                  </tr>
                );
              })}
              <tr className="h-full">
                <td></td>
                <td className="text-center align-middle">
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
                <td colSpan="3" rowSpan="3" className="bg-white border-r-2 border-black p-2 align-top text-left"></td>
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

// ==========================================
// MAIN EXPORT: INVOICE GENERATOR WORKSPACE
// ==========================================
export function InvoiceGenerator({ sys, groups, setGroups, existingInvoice = null, onClose }) {
  const [invoiceDate, setInvoiceDate] = useState(existingInvoice ? String(existingInvoice.date || '') : new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState(existingInvoice?.customerId || '');
  const [isAutofillEnabled, setIsAutofillEnabled] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState(existingInvoice?.status || 'Unpaid');

  const [isSpecialFormat, setIsSpecialFormat] = useState(existingInvoice?.isSpecialFormat || false);
  const [poNumber, setPoNumber] = useState(existingInvoice?.poNumber || '');
  const [carPlateNo, setCarPlateNo] = useState(existingInvoice?.carPlateNo || '');

  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];
  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeGroups = Array.isArray(groups) ? groups : []; 

  const [items, setItems] = useState(() => {
    if (existingInvoice && Array.isArray(existingInvoice.items)) {
      return JSON.parse(JSON.stringify(existingInvoice.items.filter(Boolean)));
    }
    return [];
  });

  const [paymentTerms, setPaymentTerms] = useState(existingInvoice?.paymentTerms || '30_days');

  const autoInvoiceNumber = useMemo(() => {
    if (existingInvoice && invoiceDate === existingInvoice.date) return String(existingInvoice.number || ''); 
    const dateObj = new Date(invoiceDate);
    if (isNaN(dateObj.getTime())) return '';

    const yy = String(dateObj.getFullYear()).slice(-2); 
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0'); 
    const prefix = `${yy}${mm}`;

    const monthlyInvoices = safeInvoices.filter(inv => String(inv?.number || '').startsWith(prefix));
    let maxSequence = 0;
    
    monthlyInvoices.forEach(inv => {
      const seqStr = String(inv?.number || '').slice(4); 
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSequence) maxSequence = seqNum;
    });

    return `${prefix}${String(maxSequence + 1).padStart(3, '0')}`;
  }, [safeInvoices, existingInvoice, invoiceDate]);

  const [invoiceNumber, setInvoiceNumber] = useState(autoInvoiceNumber);
  useEffect(() => { setInvoiceNumber(autoInvoiceNumber); }, [autoInvoiceNumber]);
  
  const [isParsing, setIsParsing] = useState(false);
  const [parseText, setParseText] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [autoFillNotif, setAutoFillNotif] = useState(false);
  const [priceModal, setPriceModal] = useState(null);

  const customer = safeCustomers.find((entry) => entry?.id === customerId);

  const isDuplicateNumber = useMemo(() => {
    return safeInvoices.some(inv => String(inv?.number || '') === String(invoiceNumber) && inv?.id !== (existingInvoice ? existingInvoice.id : null));
  }, [invoiceNumber, safeInvoices, existingInvoice]);

  const subtotal = (Array.isArray(items) ? items.filter(Boolean) : []).reduce((sum, item) => sum + (Number(item?.qty || item?.quantity) || 0) * (Number(item?.unitPrice) || 0), 0);
  const gst = subtotal * 0.09;
  const total = subtotal + gst;

  const getSafePrice = (product, unit = '箱') => {
    if (!product) return 0;
    const ruleKey = `${product.id}|${unit}`;
    
    if (customer?.custom_prices && typeof customer.custom_prices === 'object' && customer.custom_prices[ruleKey] !== undefined) {
      return Number(customer.custom_prices[ruleKey]) || 0;
    }
    
    if (customer?.pricing_group_id) {
      const assignedGroup = safeGroups.find(g => g.id === customer.pricing_group_id);
      if (assignedGroup?.prices && typeof assignedGroup.prices === 'object' && assignedGroup.prices[ruleKey] !== undefined) {
        return Number(assignedGroup.prices[ruleKey]) || 0;
      }
    }
    
    let price = product.Price || product.unitPrice || product['Unit Price (SG)'] || 0;
    return Number(price) || 0;
  };

  useEffect(() => {
    const originalCustomer = existingInvoice?.customerId || '';
    if (existingInvoice && customerId === originalCustomer) return; 

    if (!customerId) { setItems([]); setAutoFillNotif(false); return; }

    if (!isAutofillEnabled) {
      setItems(prevItems => prevItems.filter(i => i && !i.isAutoFilled));
      setAutoFillNotif(false);
      return;
    }

    const history = safeInvoices.filter((invoice) => invoice?.customerId === customerId);
    if (history.length === 0) { setItems([]); setAutoFillNotif(false); return; }

    const itemStats = {};
    history.forEach((invoice) => {
      (Array.isArray(invoice?.items) ? invoice.items.filter(Boolean) : []).forEach((item) => {
        const itemId = item.itemId;
        if(!itemId) return;
        if (!itemStats[itemId]) { itemStats[itemId] = { count: 0, totalQty: 0, unit: String(item.unit || item.Unit || '') }; }
        itemStats[itemId].count += 1;
        itemStats[itemId].totalQty += Number(item.qty || item.quantity || 0);
      });
    });

    const autoFilled = [];
    Object.entries(itemStats).forEach(([itemId, stats]) => {
      if (stats.count / history.length >= 0.9) {
        const product = safeInventory.find((entry) => entry?.id === itemId);
        if (product) {
          const determinedUnit = String(stats.unit || product.Unit || product.unit || '箱');
          autoFilled.push({
            itemId, name: String(product.Name || product.name || product.Items || ''), unit: determinedUnit,
            qty: Math.max(1, Math.round(stats.totalQty / stats.count)), unitPrice: getSafePrice(product, determinedUnit), picked: false, isAutoFilled: true, suggestions: []
          });
        }
      }
    });

    if (autoFilled.length > 0) {
      setItems(prevItems => [...prevItems.filter(i => i && !i.isAutoFilled), ...autoFilled]);
      setAutoFillNotif(true); setTimeout(() => setAutoFillNotif(false), 4000);
    } else {
      setItems(prevItems => prevItems.filter(i => i && !i.isAutoFilled)); setAutoFillNotif(false);
    }
  }, [customerId, isAutofillEnabled, safeInvoices, safeInventory, existingInvoice]);

  const suggestions = useMemo(() => {
    if (!customerId) return [];
    const history = safeInvoices.filter((invoice) => invoice?.customerId === customerId);
    if (history.length === 0) return [];
    const counts = {};
    history.forEach((invoice) => { (Array.isArray(invoice?.items) ? invoice.items.filter(Boolean) : []).forEach((item) => { if(item.itemId) counts[item.itemId] = (counts[item.itemId] || 0) + 1; }); });
    return Object.entries(counts).filter(([, count]) => { const confidence = count / history.length; return confidence >= 0.3 && confidence < 0.9; }).map(([itemId]) => safeInventory.find((entry) => entry?.id === itemId)).filter((item) => item && !(Array.isArray(items) ? items.filter(Boolean) : []).find((draftItem) => draftItem.itemId === item.id));
  }, [customerId, items, safeInvoices, safeInventory]);

  const handleSmartExtract = () => {
    const lines = String(parseText || '').split('\n').filter(l => l.trim() !== '');
    const nextDraftItems = [...(Array.isArray(items) ? items.filter(Boolean) : [])];

    lines.forEach((line) => {
      const quantityMatch = line.match(/(\d+)/);
      const qty = quantityMatch ? parseInt(quantityMatch[0], 10) : 1;
      const searchString = line.replace(/(\d+)/g, '').trim().toLowerCase();
      if (!searchString) return;

      const scoredItems = safeInventory.map((inventoryItem) => {
        if(!inventoryItem) return { item: null, score: 0 };
        const itemName = String(inventoryItem.Name || inventoryItem.name || inventoryItem.Items || '').toLowerCase();
        let score = 0;
        if (itemName === searchString) { score += 50; } 
        else if (itemName.includes(searchString) || searchString.includes(itemName)) { score += 10; } 
        else {
          const searchChars = new Set(searchString.replace(/\s/g, '').split(''));
          if (searchChars.size > 0) {
            let matchCount = 0;
            searchChars.forEach(char => { if (itemName.includes(char)) matchCount++; });
            if (matchCount / searchChars.size >= 0.5) { score += (matchCount / searchChars.size) * 5; }
          }
        }
        if (inventoryItem.learned_phrases && typeof inventoryItem.learned_phrases === 'object' && inventoryItem.learned_phrases[searchString]) { score += (Number(inventoryItem.learned_phrases[searchString]) || 0) * 20; }
        return { item: inventoryItem, score };
      }).filter(si => si.item !== null);

      scoredItems.sort((a, b) => b.score - a.score);
      const bestMatch = scoredItems[0];

      if (bestMatch && bestMatch.score >= 10) {
        const determinedUnit = String(bestMatch.item.Unit || bestMatch.item.unit || '箱');
        nextDraftItems.push({ itemId: bestMatch.item.id, name: String(bestMatch.item.Name || bestMatch.item.name || bestMatch.item.Items || ''), unit: determinedUnit, qty, unitPrice: getSafePrice(bestMatch.item, determinedUnit), picked: false, rawSearchString: searchString, originalPredictedId: bestMatch.item.id, suggestions: [], isAutoFilled: true });
      } else {
        const topSuggestions = scoredItems.filter(si => si.score > 0).slice(0, 3).map(si => si.item);
        nextDraftItems.push({ itemId: '', name: '', unit: '箱', qty, unitPrice: 0, picked: false, rawSearchString: searchString, originalPredictedId: null, suggestions: topSuggestions, isAutoFilled: true });
      }
    });
    setItems(nextDraftItems); setIsParsing(false); setParseText('');
  };

  const handleRegister = async (printAfter = false) => {
    const cleanItems = (Array.isArray(items) ? items.filter(Boolean) : []).map(item => { 
      const { suggestions, originalPredictedId, ...rest } = item; 
      return rest; 
    });

    const finalItems = cleanItems.filter(item => item.itemId || item.rawSearchString || item.name);

    const invoice = {
      id: existingInvoice ? existingInvoice.id : `INV-${invoiceNumber}`,
      number: String(invoiceNumber), customerId, customer: String(customer?.name || existingInvoice?.customer || 'Unknown Customer'),
      region: String(customer?.region || existingInvoice?.region || ''), date: String(invoiceDate), items: finalItems, total,
      status: invoiceStatus, deliveryStatus: existingInvoice ? String(existingInvoice.deliveryStatus || 'Pending') : 'Pending', paymentTerms: String(paymentTerms),
      isSpecialFormat: !!isSpecialFormat, poNumber: poNumber || null, carPlateNo: carPlateNo || null 
    };

    try {
      const { error } = await supabase.from('invoices').upsert([invoice]);
      if (error) throw error;

      if (existingInvoice) { 
        sys.setInvoices(safeInvoices.map(inv => inv?.id === existingInvoice.id ? invoice : inv)); 
      } else { 
        sys.setInvoices([...safeInvoices, invoice]); 
      }
      
      if (printAfter) { setTimeout(() => { window.print(); onClose(); }, 500); } else { onClose(); }

    } catch (err) {
      alert(`CRITICAL ERROR: Failed to save invoice to database.\n\n${err.message}`);
    }
  };

  const executePriceSave = async (type, newPriceStr) => {
    const { index, item, product, assignedGroup } = priceModal;
    const newPrice = Number(newPriceStr) || 0;
    const ruleKey = `${product.id}|${item.unit}`;

    try {
      if (type === 'CUSTOMER') {
        const updatedCustomPrices = { ...(customer.custom_prices || {}), [ruleKey]: newPrice };
        const { error } = await supabase.from('customers').update({ custom_prices: updatedCustomPrices }).eq('id', customer.id);
        if (error) throw error;
        sys.setCustomers(safeCustomers.map(c => c?.id === customer.id ? { ...c, custom_prices: updatedCustomPrices } : c));
      } 
      else if (type === 'GROUP' && assignedGroup) {
        const updatedGroupPrices = { ...(assignedGroup.prices || {}), [ruleKey]: newPrice };
        const { error } = await supabase.from('pricing_groups').update({ prices: updatedGroupPrices }).eq('id', assignedGroup.id);
        if (error) throw error;
        setGroups(safeGroups.map(g => g.id === assignedGroup.id ? { ...g, prices: updatedGroupPrices } : g));
      }
      else if (type === 'GLOBAL') {
        const isUUID = product.id && String(product.id).length === 36 && String(product.id).includes('-');
        let dbError;
        if (isUUID) { const { error } = await supabase.from('product_list').update({ Price: newPrice }).eq('id', product.id); dbError = error; } 
        else { const legacyName = String(product.Name || product.name || product.Items || ''); const { error } = await supabase.from('product_list').update({ Price: newPrice }).eq('Name', legacyName); dbError = error; }
        if (dbError) throw dbError;
        sys.setInventory(safeInventory.map(p => p?.id === product.id ? { ...p, Price: newPrice } : p));
      }
      else if (type === 'REMOVE_CUSTOMER') {
        const updatedCustomPrices = { ...(customer.custom_prices || {}) };
        delete updatedCustomPrices[ruleKey];
        const { error } = await supabase.from('customers').update({ custom_prices: updatedCustomPrices }).eq('id', customer.id);
        if (error) throw error;
        sys.setCustomers(safeCustomers.map(c => c?.id === customer.id ? { ...c, custom_prices: updatedCustomPrices } : c));
        
        const fallbackPrice = getSafePrice(product, item.unit); 
        const nextItems = [...(Array.isArray(items) ? items : [])];
        if (nextItems[index]) nextItems[index].unitPrice = fallbackPrice;
        setItems(nextItems);
        setPriceModal(null);
        return;
      }

      const nextItems = [...(Array.isArray(items) ? items : [])];
      if (nextItems[index]) nextItems[index].unitPrice = newPrice;
      setItems(nextItems);
      setPriceModal(null);

    } catch (error) { alert(`Database Update Failed: ${error.message}`); }
  };

  if (previewMode) {
    return (
      <InvoicePreview
        customer={customer} gst={gst} invoiceNumber={invoiceNumber} invoiceDate={invoiceDate} items={items}
        onBack={() => setPreviewMode(false)} onRegister={handleRegister} paymentTerms={paymentTerms} setItems={setItems}
        subtotal={subtotal} sys={sys} total={total} existingInvoice={existingInvoice}
        isSpecialFormat={isSpecialFormat} poNumber={poNumber} carPlateNo={carPlateNo}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div className="flex h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-slate-900 p-4 px-8 text-white">
          <div className="flex items-center space-x-3">
            <FileText className="text-blue-500" />
            <h2 className="text-sm font-black uppercase tracking-widest">{existingInvoice ? 'Edit Existing Invoice' : 'Draft Invoice Workspace'}</h2>
          </div>
          <div className="flex space-x-3">
            <button className="flex items-center rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-black shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500" onClick={() => setIsParsing(true)} type="button"><MessageSquare className="mr-2" size={14} /> Paste Order Message</button>
            <button className="rounded-full p-1.5 transition-colors hover:bg-slate-800" onClick={onClose} type="button"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 p-8">
          {isParsing && (
            <div className="mb-8 rounded-2xl bg-blue-600 p-8 text-white shadow-2xl">
              <h3 className="mb-2 flex items-center text-lg font-black"><BrainCircuit className="mr-3" size={24} /> AI Order Extractor</h3>
              <p className="mb-4 text-xs font-medium text-blue-200">Paste your messy text below. The system will auto-predict the items and will automatically unlearn any mistakes when you correct them.</p>
              <textarea className="mb-4 h-32 w-full rounded border border-blue-400 bg-blue-700/50 p-4 text-sm font-medium outline-none placeholder:text-blue-300" onChange={(event) => setParseText(event.target.value)} placeholder="Paste order details here..." value={parseText} />
              <div className="flex justify-end space-x-3">
                <button className="px-6 py-2 text-xs font-bold text-blue-200" onClick={() => setIsParsing(false)} type="button">Cancel</button>
                <button className="rounded bg-white px-8 py-2 text-xs font-black text-blue-600" onClick={handleSmartExtract} type="button">Extract Order</button>
              </div>
            </div>
          )}

          <div className="mx-auto mb-12 w-full max-w-[800px] border-b-8 border-blue-600 bg-white p-12 text-sm text-gray-800 shadow-xl">
            <CompanyHeader />
            <div className="mb-6 flex justify-between">
              <div className="w-[35%] border-r border-slate-100 pr-6">
                <div className="flex justify-between items-end mb-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Customer Account:</label>
                  {!existingInvoice && (
                    <label className="flex items-center space-x-1.5 cursor-pointer bg-slate-50 border border-slate-200 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors">
                      <input type="checkbox" checked={isAutofillEnabled} onChange={(e) => { const checked = e.target.checked; setIsAutofillEnabled(checked); if (!checked) { setItems(prev => prev.filter(i => i && !i.isAutoFilled)); setAutoFillNotif(false); } }} className="w-3 h-3 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Auto-Predict</span>
                    </label>
                  )}
                </div>
                <CustomerSearchSelect value={customerId} customers={safeCustomers} onChange={setCustomerId} disabled={!!existingInvoice} />
                {autoFillNotif && (<p className="mt-2 flex items-center text-[10px] font-black uppercase tracking-widest text-indigo-500"><Sparkles className="mr-1" size={12} /> Unverified Predictions Added</p>)}
              </div>
              <div className="w-[20%] border-r border-slate-100 px-6">
                <label className="text-[10px] font-black uppercase text-gray-400">Invoice Date:</label>
                <input type="date" className="mt-1 w-full cursor-pointer border-none bg-transparent p-0 text-[16px] font-black text-slate-800 focus:ring-0 outline-none" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
              </div>
              <div className="w-[20%] border-r border-slate-100 px-6">
                <label className="text-[10px] font-black uppercase text-gray-400">Terms:</label>
                <select className="mt-1 w-full cursor-pointer border-none bg-transparent p-0 text-lg font-black text-slate-800 focus:ring-0" onChange={(event) => setPaymentTerms(event.target.value)} value={paymentTerms}>
                  <option value="30_days">30 Days</option><option value="cod">C.O.D</option>
                </select>
              </div>
              <div className="w-[25%] pl-6 text-right relative">
                <label className="text-[10px] font-black uppercase text-gray-400">Serial No.</label>
                <div className="flex items-center justify-end text-3xl font-black tracking-tighter text-red-600 mt-1">
                  <span className="mr-1">#</span>
                  <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={`w-full max-w-[140px] bg-transparent border-b-2 outline-none text-right focus:ring-0 p-0 m-0 ${isDuplicateNumber ? 'border-red-500 text-red-600' : 'border-transparent hover:border-red-200 focus:border-red-600'}`} />
                </div>
                {isDuplicateNumber && (<p className="text-[10px] font-black text-red-500 uppercase mt-1">Number Already Exists!</p>)}
              </div>
            </div>

            <div className="flex flex-col mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="flex items-center space-x-2 cursor-pointer w-max">
                <input type="checkbox" checked={isSpecialFormat} onChange={e => setIsSpecialFormat(e.target.checked)} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-700 flex items-center"><ScanBarcode size={14} className="mr-1 text-purple-500"/> Enable Special Format (Barcode & Car Plate)</span>
              </label>
              {isSpecialFormat && (
                <div className="flex space-x-6 mt-4 pt-4 border-t border-slate-200">
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">PO Number</label>
                    <input type="text" placeholder="e.g. POC121950" value={poNumber} onChange={e => setPoNumber(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-bold outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Car Plate No.</label>
                    <input type="text" placeholder="e.g. GBF4684U" value={carPlateNo} onChange={e => setCarPlateNo(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-bold outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                  </div>
                </div>
              )}
            </div>

            {suggestions.length > 0 && !existingInvoice && (
              <div className="mb-6 rounded border border-dashed border-blue-200 bg-blue-50/50 p-4">
                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-blue-400">Secondary Recommendations</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((item) => (
                    <button key={item.id} className="rounded border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-bold text-blue-700 shadow-sm" onClick={() => { const determinedUnit = String(item.Unit || item.unit || '箱'); setItems([...(Array.isArray(items) ? items.filter(Boolean) : []), { itemId: item.id, name: String(item.Name || item.name || item.Items || ''), unit: determinedUnit, qty: 1, unitPrice: getSafePrice(item, determinedUnit), picked: false, suggestions: [] }]) }} type="button">
                      + {String(item.Name || item.name || item.Items || '')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <table className="w-full text-left relative z-10">
              <thead className="border-y-2 border-slate-900 bg-slate-50">
                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <th className="w-12 p-4 text-center">No.</th><th className="p-4 w-72">Description</th><th className="w-24 p-4 text-center">Unit</th><th className="w-20 p-4 text-center">Qty</th><th className="w-28 p-4 text-right">Cost</th><th className="w-28 p-4 text-right">Total</th><th className="w-8 p-4"></th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(items) ? items.filter(Boolean) : []).map((item, index) => {
                  const safeItemUnit = String(item.unit || '');
                  const ruleKey = `${item.itemId}|${safeItemUnit}`;
                  
                  const hasIndividualPrice = customer?.custom_prices && typeof customer.custom_prices === 'object' && customer.custom_prices[ruleKey] !== undefined;
                  const assignedGroup = customer?.pricing_group_id ? safeGroups.find(g => g.id === customer.pricing_group_id) : null;
                  const hasGroupPrice = assignedGroup?.prices && typeof assignedGroup.prices === 'object' && assignedGroup.prices[ruleKey] !== undefined;

                  const selectedProduct = safeInventory.find(p => p?.id === item.itemId);
                  let rowUnitOptions = [];

                  if (selectedProduct) {
                    const defaultUnit = String(selectedProduct.Unit || selectedProduct.unit || '箱');
                    rowUnitOptions.push({ value: defaultUnit, label: defaultUnit });
                    if (customer?.custom_prices && typeof customer.custom_prices === 'object') {
                      Object.keys(customer.custom_prices).forEach(key => { const [pid, pUnit] = key.split('|'); if (pid === selectedProduct.id && pUnit !== defaultUnit) { rowUnitOptions.push({ value: pUnit, label: `${pUnit} (Custom)` }); } });
                    }
                    if (safeItemUnit && !rowUnitOptions.find(opt => opt.value === safeItemUnit)) { rowUnitOptions.push({ value: safeItemUnit, label: safeItemUnit }); }
                  } else {
                    rowUnitOptions = Array.isArray(UNIT_OPTIONS) ? UNIT_OPTIONS : [];
                    if (safeItemUnit && !rowUnitOptions.find(opt => opt.value === safeItemUnit)) { rowUnitOptions.push({ value: safeItemUnit, label: safeItemUnit }); }
                  }

                  const isPredicted = item.isAutoFilled;
                  const rowClass = isPredicted ? 'bg-indigo-50/40 border-indigo-200 text-indigo-700' : (!item.itemId && item.rawSearchString ? 'bg-amber-50/30 border-amber-100' : 'border-gray-100');

                  return (
                    <tr className={`border-b font-bold transition-colors ${rowClass}`} key={`${item.itemId}-${index}`}>
                      <td className="p-4 text-center font-mono text-xs text-slate-300 align-top pt-5">{index + 1}</td>
                      <td className="p-2 relative align-top pt-3">
                        <div className="flex items-center space-x-2">
                          <input checked={item.picked || false} className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0" onChange={(event) => { const nextItems = [...items]; if (nextItems[index]) nextItems[index].picked = event.target.checked; setItems(nextItems); }} type="checkbox" />
                          <ProductSearchSelect value={item.itemId} inventory={safeInventory} isAutoFilled={isPredicted} onChange={(selectedId) => { const product = safeInventory.find((entry) => entry?.id === selectedId); if (!product) return; const nextItems = [...items]; const determinedUnit = String(product.Unit || product.unit || '箱'); if (nextItems[index]) { nextItems[index] = { ...nextItems[index], itemId: selectedId, name: String(product.Name || product.name || product.Items || ''), unit: determinedUnit, unitPrice: getSafePrice(product, determinedUnit), suggestions: [], isAutoFilled: false, rawSearchString: null }; } setItems(nextItems); }} />
                        </div>
                        
                        {isPredicted && (
                          <div className="ml-6 mt-1 flex items-center">
                            <button onClick={() => { const next = [...items]; if(next[index]) { next[index].isAutoFilled = false; next[index].rawSearchString = null; } setItems(next); }} className="text-[9px] font-black uppercase tracking-widest bg-indigo-200 text-indigo-800 px-2 py-1 rounded shadow-sm hover:bg-indigo-300 transition-colors flex items-center" type="button"><Check size={10} className="mr-1" /> Verify Match</button>
                          </div>
                        )}
                        {item.rawSearchString && item.itemId && !isPredicted && (<p className="text-[9px] text-blue-400 font-medium ml-6 mt-1 flex items-center"><BrainCircuit size={10} className="mr-1" /> Predicted from: "{item.rawSearchString}"</p>)}
                        {!item.itemId && item.suggestions && item.suggestions.length > 0 && (
                          <div className="ml-6 mt-2 mb-1 p-2.5 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 mb-2 flex items-center"><AlertTriangle size={12} className="mr-1.5" /> Did you mean?</p>
                            <div className="flex flex-wrap gap-2">
                              {item.suggestions.map((sugg) => {
                                const suggName = String(sugg?.Name || sugg?.name || sugg?.Items || '');
                                const suggUnit = String(sugg?.Unit || sugg?.unit || '箱');
                                return (<button key={sugg.id} type="button" onClick={() => { const nextItems = [...items]; if(nextItems[index]) { nextItems[index] = { ...nextItems[index], itemId: sugg.id, name: suggName, unit: suggUnit, unitPrice: getSafePrice(sugg, suggUnit), suggestions: [], originalPredictedId: sugg.id, isAutoFilled: false, rawSearchString: null }; } setItems(nextItems); }} className="text-[11px] bg-white border border-amber-300 text-amber-900 font-bold px-2 py-1 rounded shadow-sm hover:bg-amber-200 transition-colors">{suggName}</button>);
                              })}
                            </div>
                          </div>
                        )}
                        {!item.itemId && item.rawSearchString && (!item.suggestions || item.suggestions.length === 0) && (<p className="text-[9px] text-amber-500 font-medium ml-6 mt-1 flex items-center"><AlertTriangle size={10} className="mr-1" /> No matches found for "{item.rawSearchString}"</p>)}
                      </td>
                      <td className="p-2 align-top pt-4">
                        <select className={`w-full border-none text-center text-xs font-bold focus:ring-0 bg-transparent m-0 cursor-pointer ${isPredicted ? 'text-indigo-600' : ''}`} onChange={(event) => { const nextItems = [...items]; const newUnit = event.target.value; if(nextItems[index]) { nextItems[index].unit = newUnit; const product = safeInventory.find(p => p?.id === nextItems[index].itemId); if (product) { nextItems[index].unitPrice = getSafePrice(product, newUnit); } } setItems(nextItems); }} value={safeItemUnit}>
                          {rowUnitOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                        </select>
                      </td>
                      <td className="p-2 align-top pt-3">
                        <input className={`w-full border-none bg-transparent p-1 text-center font-black focus:ring-0 m-0 ${isPredicted ? 'text-indigo-700' : 'text-blue-600'}`} onChange={(event) => { const nextItems = [...items]; if(nextItems[index]) nextItems[index].qty = event.target.value; setItems(nextItems); }} type="number" value={item.qty || item.quantity || ''} />
                      </td>
                      <td className="p-2 align-top pt-3 text-right">
                        <input className={`w-full border-none bg-transparent p-1 text-right font-black focus:ring-0 m-0 leading-none ${isPredicted ? 'text-indigo-900' : ''}`} onChange={(event) => { const nextItems = [...items]; if(nextItems[index]) nextItems[index].unitPrice = event.target.value; setItems(nextItems); }} step="0.01" type="number" value={item.unitPrice || ''} />
                        
                        {item.itemId && customer && (
                          <button 
                            type="button"
                            onClick={() => {
                              const product = safeInventory.find((entry) => entry?.id === item.itemId);
                              if (product) setPriceModal({ index, item, product, hasIndividualPrice, assignedGroup });
                            }}
                            className={`text-[9px] uppercase tracking-widest mt-0.5 px-2 py-1 rounded transition-colors flex items-center justify-end w-full ${
                              hasIndividualPrice ? (isPredicted ? 'text-indigo-600 hover:bg-indigo-100' : 'text-emerald-500 font-black hover:bg-emerald-50') 
                              : hasGroupPrice ? 'text-indigo-500 font-black hover:bg-indigo-50' 
                              : 'text-slate-400 font-semibold hover:bg-slate-100'
                            }`}
                          >
                            {hasIndividualPrice ? '★ Custom (Ind)' : hasGroupPrice ? <><Layers size={10} className="mr-1" /> Custom (Grp)</> : <><Settings size={10} className="mr-1" /> Default</>}
                          </button>
                        )}
                      </td>
                      <td className={`p-4 text-right font-mono text-lg font-black tracking-tighter align-top pt-3 ${isPredicted ? 'text-indigo-900' : 'text-slate-900'}`}>${formatMoney((Number(item.qty || item.quantity) || 0) * (Number(item.unitPrice) || 0))}</td>
                      <td className="w-8 p-0 align-top pt-5">
                        <button className={`ml-2 hover:text-red-500 ${isPredicted ? 'text-indigo-300 hover:bg-indigo-100' : 'text-red-200'}`} onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button className="mt-8 rounded bg-blue-50 px-5 py-2 text-[10px] font-bold uppercase text-blue-600 shadow-sm transition-all hover:bg-blue-100" onClick={() => setItems([...(Array.isArray(items) ? items.filter(Boolean) : []), { itemId: '', name: '', unit: '箱', qty: 1, unitPrice: 0, picked: false, suggestions: [] }])} type="button">+ Add Row Manually</button>
            <div className="mt-12 flex justify-end border-t-2 border-slate-900 pt-6">
              <div className="w-72 space-y-1">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400"><span>Sub-Total ($)</span><span className="text-slate-900">${formatMoney(subtotal)}</span></div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400"><span>GST 9% Included</span><span className="text-slate-900">${formatMoney(gst)}</span></div>
                <div className="flex items-center justify-between pt-2"><span className="text-sm font-black uppercase">Total Due</span><span className="text-3xl font-black tracking-tighter">${formatMoney(total)}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 rounded-b-3xl border-t bg-white p-8 shadow-inner">
          <div className="flex justify-end space-x-4">
            <button className="px-8 py-3 text-sm font-black uppercase tracking-widest text-gray-400" onClick={onClose} type="button">Discard</button>
            <button className="flex items-center rounded bg-indigo-600 px-10 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50" disabled={!customerId || items.length === 0 || isDuplicateNumber} onClick={() => setPreviewMode(true)} type="button">
              <Eye className="mr-2" size={18} /> Preview Document
            </button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* PRICING MANAGER MODAL - UPDATED CASCADE */}
      {/* ========================================== */}
      {priceModal && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <h2 className="text-sm font-black tracking-widest uppercase flex items-center"><Settings size={16} className="mr-2 text-blue-400" /> Pricing Cascade</h2>
              <button onClick={() => setPriceModal(null)} className="hover:bg-slate-800 p-1 rounded-full transition-colors"><X size={18} /></button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-1">Editing price for:</p>
              <p className="text-base font-bold text-slate-900 mb-4">{String(priceModal.product?.Name || priceModal.product?.name || '')} ({String(priceModal.item?.unit || '')})</p>
              
              <div className="mb-6">
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Long-Term New Price ($)</label>
                <input type="number" step="0.01" className="w-full text-2xl font-black text-blue-600 border-2 border-blue-100 rounded-xl p-4 outline-none focus:border-blue-500 bg-blue-50/50" defaultValue={priceModal.item?.unitPrice} id="pricingManagerInput" />
              </div>

              <div className="space-y-3">
                <button onClick={() => executePriceSave('CUSTOMER', document.getElementById('pricingManagerInput').value)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl flex items-center transition-colors shadow-lg shadow-emerald-500/20 text-sm">
                  <User size={16} className="mr-3 shrink-0" /> <span className="flex-1 text-left">Save for {String(customer?.name || 'Customer')}</span>
                </button>

                {priceModal.assignedGroup && (
                  <button onClick={() => executePriceSave('GROUP', document.getElementById('pricingManagerInput').value)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl flex items-center transition-colors shadow-lg shadow-indigo-500/20 text-sm">
                    <Layers size={16} className="mr-3 shrink-0" /> <span className="flex-1 text-left">Save for {priceModal.assignedGroup.name} Group</span>
                  </button>
                )}
                
                <button onClick={() => executePriceSave('GLOBAL', document.getElementById('pricingManagerInput').value)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl flex items-center transition-colors shadow-lg shadow-blue-500/20 text-sm">
                   <Settings size={16} className="mr-3 shrink-0" /> <span className="flex-1 text-left">Update Global Catalog</span>
                </button>

                {priceModal.hasIndividualPrice && (
                  <button onClick={() => executePriceSave('REMOVE_CUSTOMER')} className="w-full bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 font-bold py-3 px-4 rounded-xl flex items-center transition-colors text-sm mt-4">
                    <Trash2 size={16} className="mr-3 shrink-0" /> <span className="flex-1 text-left">Clear Individual Override</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ==========================================
// MAIN EXPORT: INVOICE DASHBOARD
// ==========================================
export function InvoiceModule({ sys }) {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [termFilter, setTermFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  const [pricingGroups, setPricingGroups] = useState([]);
  
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const { data, error } = await supabase.from('pricing_groups').select('*');
        if (!error && data) setPricingGroups(data);
      } catch (err) { console.error("Error fetching pricing groups:", err); }
    };
    fetchGroups();
  }, [isGeneratorOpen]);

  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];

  const handleDeleteInvoice = async (e, invoiceId) => {
    e.stopPropagation(); 
    if (window.confirm("Are you sure you want to permanently delete this invoice? This cannot be undone.")) {
      try {
        const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
        if (error) throw error;
        
        const updatedInvoices = safeInvoices.filter(inv => inv?.id !== invoiceId);
        sys.setInvoices(updatedInvoices);
        if (sys.deleteRecord) { await sys.deleteRecord('invoices', invoiceId); }
      } catch (err) { alert(`Failed to delete invoice: ${err.message}`); }
    }
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    try {
      const { error } = await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId);
      if (error) throw error;

      const updatedInvoices = safeInvoices.map(inv => { if (inv?.id === invoiceId) { return { ...inv, status: newStatus }; } return inv; });
      sys.setInvoices(updatedInvoices);
    } catch (err) { alert(`Failed to update status: ${err.message}`); }
  };

  const filteredInvoices = useMemo(() => {
    let result = [...safeInvoices];
    if (searchTerm) {
      const searchLower = String(searchTerm).toLowerCase();
      result = result.filter(inv => String(inv?.customer || '').toLowerCase().includes(searchLower) || String(inv?.number || inv?.id || '').toLowerCase().includes(searchLower));
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    result = result.filter(inv => {
      if (termFilter !== 'All' && String(inv?.paymentTerms) !== termFilter) return false;
      if (filter === 'All') return true;
      const [year, month, day] = String(inv?.date || '').split('-').map(Number);
      if (!year || !month || !day) return false;
      const invDate = new Date(year, month - 1, day);
      if (isNaN(invDate.getTime())) return false; 
      invDate.setHours(0,0,0,0);
      if (filter === 'Today') return invDate.getTime() === today.getTime();
      if (filter === 'This Week') { const diffDays = Math.ceil(Math.abs(today - invDate) / (1000 * 60 * 60 * 24)); return diffDays <= 7; }
      if (filter === 'This Month') return invDate.getMonth() === today.getMonth() && invDate.getFullYear() === today.getFullYear();
      return true;
    });

    result.sort((a, b) => {
      const dateA = new Date(a?.date || 0).getTime() || 0; const dateB = new Date(b?.date || 0).getTime() || 0;
      const numA = String(a?.number || a?.id || ''); const numB = String(b?.number || b?.id || '');
      const totA = Number(a?.total) || 0; const totB = Number(b?.total) || 0;
      const custA = String(a?.customer || ''); const custB = String(b?.customer || '');
      switch (sortOption) {
        case 'date_asc': return dateA - dateB; case 'number_desc': return numB.localeCompare(numA, undefined, { numeric: true });
        case 'number_asc': return numA.localeCompare(numB, undefined, { numeric: true }); case 'total_desc': return totB - totA;
        case 'total_asc': return totA - totB; case 'customer_asc': return custA.localeCompare(custB);
        case 'customer_desc': return custB.localeCompare(custA); case 'date_desc': default: return dateB - dateA;
      }
    });
    return result;
  }, [safeInvoices, filter, termFilter, searchTerm, sortOption]);

  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="p-8 h-full overflow-y-auto relative print:p-0 print:overflow-visible">
      <div className={(previewInvoice || isGeneratorOpen) ? "print:hidden" : "block"}>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center"><FileText className="mr-3 text-blue-600" size={28} /> Invoice History</h1>
          <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg hover:bg-blue-700" onClick={() => setIsGeneratorOpen(true)}><Plus className="mr-2" size={18} /> New Invoice</button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-wrap justify-between items-center border-b bg-slate-50 p-4 gap-4">
            <div className="flex bg-white rounded-lg p-1 border shadow-sm">
              {['All', 'Today', 'This Week', 'This Month'].map((opt) => (
                <button key={opt} onClick={() => setFilter(opt)} className={`px-4 py-1.5 text-[11px] font-black uppercase rounded-md ${filter === opt ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>{opt}</button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex items-center bg-white border rounded-xl shadow-sm px-3 py-2 w-full sm:w-36 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <Filter className="text-slate-400 mr-2 shrink-0" size={16} />
                <select className="w-full bg-transparent outline-none text-xs font-bold text-slate-700 cursor-pointer appearance-none" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
                  <option value="All">All Terms</option><option value="cod">C.O.D</option><option value="30_days">30 Days</option>
                </select>
              </div>

              <div className="relative flex items-center bg-white border rounded-xl shadow-sm px-3 py-2 w-full sm:w-48 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <ArrowUpDown className="text-slate-400 mr-2 shrink-0" size={16} />
                <select className="w-full bg-transparent outline-none text-xs font-bold text-slate-700 cursor-pointer appearance-none" value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                  <option value="date_desc">Date (Newest First)</option><option value="date_asc">Date (Oldest First)</option><option value="number_desc">Invoice No. (Highest)</option>
                  <option value="number_asc">Invoice No. (Lowest)</option><option value="total_desc">Amount (Highest)</option><option value="total_asc">Amount (Lowest)</option>
                  <option value="customer_asc">Customer (A-Z)</option><option value="customer_desc">Customer (Z-A)</option>
                </select>
              </div>

              <div className="flex items-center bg-white border rounded-xl px-4 py-2 w-full sm:w-64 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <Search className="text-slate-400 mr-2 shrink-0" size={16} />
                <input type="text" placeholder="Search..." className="w-full bg-transparent outline-none text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-slate-500 font-semibold border-b">
                <th className="p-5 pl-8">Invoice No.</th><th className="p-5">Date</th><th className="p-5">Customer</th><th className="p-5 text-center">Terms</th><th className="p-5 text-right">Total</th><th className="p-5 text-center">Status</th><th className="p-5 text-center w-20">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedInvoices.map((inv) => (
                <tr key={inv?.id} className="hover:bg-blue-50 cursor-pointer transition-colors group" onClick={() => setPreviewInvoice(inv)}>
                  <td className="p-5 pl-8 font-mono font-bold text-blue-600">
                    #{String(inv?.number || inv?.id || '')}
                    {inv?.isSpecialFormat && <span className="ml-2 bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-black inline-flex items-center"><ScanBarcode size={8} className="mr-0.5" /> Spec</span>}
                  </td>
                  <td className="p-5 text-slate-500">{String(inv?.date || '')}</td>
                  <td className="p-5 text-slate-800">{String(inv?.customer || '')}</td>
                  <td className="p-5 text-center"><span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md whitespace-nowrap">{inv?.paymentTerms === 'cod' ? 'C.O.D' : '30 Days'}</span></td>
                  <td className="p-5 text-right font-black text-slate-900">${formatMoney(inv?.total)}</td>
                  <td className="p-5 text-center">
                    <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                      <select value={inv?.status || 'Unpaid'} onChange={(e) => handleStatusChange(inv.id, e.target.value)} className={`appearance-none cursor-pointer pl-8 pr-8 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none transition-all ${(inv?.status || 'Unpaid') === 'Paid' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200' : 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200'}`}>
                        <option value="Paid">PAID</option><option value="Unpaid">UNPAID</option>
                      </select>
                      <div className="absolute left-2.5 pointer-events-none">{(inv?.status || 'Unpaid') === 'Paid' ? <CheckCircle size={12} className="text-emerald-600" /> : <AlertCircle size={12} className="text-orange-600" />}</div>
                      <div className="absolute right-2.5 pointer-events-none"><ChevronDown size={12} className={(inv?.status || 'Unpaid') === 'Paid' ? "text-emerald-600" : "text-orange-600"} /></div>
                    </div>
                  </td>
                  <td className="p-5 text-center"><button onClick={(e) => handleDeleteInvoice(e, inv?.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18} /></button></td>
                </tr>
              ))}
              {paginatedInvoices.length === 0 && (<tr><td colSpan="7" className="p-12 text-center text-sm font-bold text-slate-400">No invoices match your current search and sorting criteria.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {previewInvoice && <InvoicePreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} sys={sys} onEdit={(inv) => { setEditingInvoice(inv); setIsGeneratorOpen(true); setPreviewInvoice(null); }} />}
      {isGeneratorOpen && <InvoiceGenerator sys={sys} groups={pricingGroups} setGroups={setPricingGroups} existingInvoice={editingInvoice} onClose={() => { setIsGeneratorOpen(false); setEditingInvoice(null); }} />}
    </div>
  );
}
