import { useEffect, useMemo, useState, useRef } from 'react';
import { Eye, FileText, MessageSquare, Printer, Save, Sparkles, Trash2, Search, BrainCircuit, ChevronLeft, X, Settings, AlertTriangle } from 'lucide-react';
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
function ProductSearchSelect({ value, inventory, onChange }) {
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

  const safeInventory = inventory || [];
  const selectedProduct = safeInventory.find((entry) => entry.id === value);
  const displayName = selectedProduct ? (selectedProduct.Name || selectedProduct.name || selectedProduct.Items) : '';

  const filteredInventory = safeInventory.filter((item) => {
    const itemName = (item.Name || item.name || item.Items || '').toLowerCase();
    return itemName.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => { setIsOpen(true); setSearchTerm(''); }}
          className={`w-full text-left text-xs font-bold p-1 border border-transparent rounded hover:bg-slate-200 transition-colors focus:outline-none ${displayName ? 'text-slate-900' : 'text-slate-400'}`}
        >
          {displayName || '- Search Product -'}
        </button>
      ) : (
        <div className="absolute z-[5000] top-0 left-0 w-72 bg-white border border-slate-300 rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center p-2 border-b border-slate-200 bg-slate-50">
            <Search size={14} className="text-slate-400 ml-1 mr-2 shrink-0" />
            <input autoFocus type="text" className="w-full bg-transparent border-none text-xs font-bold text-slate-800 p-1 focus:ring-0 placeholder:text-slate-400 outline-none" placeholder="Type to search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => {
                const itemName = item.Name || item.name || item.Items || 'Unnamed Product';
                return (
                  <button key={item.id} type="button" className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 border-b border-slate-100 last:border-0 transition-colors" onClick={() => { onChange(item.id); setIsOpen(false); }}>
                    {itemName}
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

  const safeCustomers = customers || [];
  const selectedCustomer = safeCustomers.find((c) => c.id === value);
  const displayName = selectedCustomer ? selectedCustomer.name : '';

  const filteredCustomers = safeCustomers.filter((c) => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

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
                  {c.name}
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
function InvoicePreview({ customer, gst, invoiceNumber, invoiceDate, items, onBack, onRegister, paymentTerms, subtotal, sys, total, existingInvoice }) {
  const customerAddress = customer?.address || existingInvoice?.address || '';

  return (
    <div className="fixed inset-0 z-[3000] overflow-y-auto bg-slate-950/90 print:static print:block print:bg-white print:p-0 print:backdrop-filter-none">
      
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
            #printable-invoice-generator, #printable-invoice-generator * { visibility: visible !important; }
            
            #printable-invoice-generator {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important; 
              padding: 15mm !important;
              margin: 0 !important;
              background: white !important;
              backdrop-filter: none !important;
              box-sizing: border-box !important;
            }
            
            *, html, body, div, p, span, h1, h2, h3, table, th, td { font-family: ${CJK_FONT} !important; }
            tr, td, th { page-break-inside: avoid; break-inside: avoid; }
          }
        `}
      </style>

      <div className="flex min-h-full flex-col items-center py-12 print:block print:py-0 print:m-0">
        
        <div className="w-full max-w-[210mm] shrink-0 bg-slate-900 px-8 py-4 flex justify-between items-center text-white rounded-t-2xl shadow-2xl print:hidden border-b-4 border-blue-600">
          <div className="flex items-center">
            <Eye size={24} className="mr-3 text-blue-400" />
            <div>
              <h2 className="text-sm font-black tracking-widest uppercase text-slate-200">Invoice Layout Check</h2>
              <p className="text-lg font-bold text-white leading-none mt-0.5">#{invoiceNumber}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button className="flex items-center rounded bg-slate-800 px-5 py-2.5 font-bold text-white transition-all hover:bg-slate-700 border border-slate-700 text-sm" onClick={onBack} type="button">
              <ChevronLeft size={16} className="mr-1" /> Edit Draft
            </button>
            <button className="flex items-center rounded bg-white px-5 py-2.5 font-bold text-slate-900 shadow-lg transition-all hover:bg-slate-50 text-sm" onClick={() => onRegister(false)} type="button">
              <Save className="mr-2" size={16} /> Save Invoice
            </button>
          </div>
        </div>

        <div 
          id="printable-invoice-generator"
          lang="zh" 
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
                    {customer?.name || existingInvoice?.customer || ''}
                  </span>
                </div>
                <div className="flex items-end w-[35%] pl-2">
                  <span className="shrink-0 mr-2 text-black">DATE:</span>
                  <span className="flex-1 text-center border-b border-black pb-0.5">
                    {invoiceDate && !isNaN(new Date(invoiceDate).getTime()) ? new Date(invoiceDate).toLocaleDateString('en-GB').replace(/\//g, '-') : new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}
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
                  <span className="text-red-600 font-bold tracking-wider text-[17px] leading-none">{invoiceNumber}</span>
                </div>
                <div className="flex items-baseline">
                  <span className="font-bold w-[50px] shrink-0 text-black text-[15px]">Term:</span>
                  <span className="text-red-600 font-bold text-[16px] leading-none">{paymentTerms === 'cod' ? 'COD' : '30 Days'}</span>
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
              {(items || []).map((item, idx) => {
                const foundProduct = (sys.inventory || []).find((entry) => entry.id === item.itemId);
                const productName = foundProduct ? (foundProduct.Name || foundProduct.name || foundProduct.Items) : (item.Name || item.name || '-');
                return (
                  <tr key={idx} className="h-[32px] align-top" style={{ fontFamily: CJK_FONT }}>
                    <td className="p-1 border-r border-black font-medium text-center">{idx + 1}</td>
                    <td className="p-1 border-r border-black text-left pl-2 font-bold" style={{ fontFamily: CJK_FONT }}>{productName}</td>
                    <td className="p-1 border-r border-black font-medium text-center" style={{ fontFamily: CJK_FONT }}>{item.qty || item.quantity} {item.unit || item.Unit}</td>
                    <td className="p-1 border-r border-black text-center">${formatMoney(item.unitPrice)}</td>
                    <td className="p-1 text-center font-bold">${formatMoney((Number(item.qty || item.quantity) || 0) * (Number(item.unitPrice) || 0))}</td>
                  </tr>
                );
              })}
              {items && items.length < 15 && Array.from({ length: 15 - items.length }).map((_, i) => (
                <tr key={`blank-${i}`} className="h-[32px]">
                  <td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex w-full mt-2">
            <div className="flex-1 flex pr-4">
              <div className="flex-1 text-[12px] font-bold leading-snug flex flex-col justify-between">
                <div style={{ fontFamily: CJK_FONT }}>
                  <p>请提前一天提交订单,同日送达的截止时间为下午12点前。每周日休息</p>
                  <p>Please submit orders one day in advance. The cut-off time for same-day delivery is before 12 PM. Closed on Sundays.</p>
                  <div className="mt-3 flex items-center">
                    <div className="w-[80px] h-[80px] shrink-0 mr-3">
                      <img src={paynowQr} alt="PayNow QR Code" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col justify-center pt-1">
                      <p>UEN: 53033969B</p>
                      <p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p>
                      <p>A/C Number: 535-846562-001</p>
                      <p>Bank Name: OCBC</p>
                    </div>
                  </div>
                  <p className="mt-2 font-normal">All payments mode have to be made payable to Three Leaves (Singapore) Trading Enterprise.</p>
                </div>
                <div className="mt-12 mb-1">
                  <div className="w-56 border-t border-black text-center pt-1 text-[12px] font-bold">Received By</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col font-bold text-[15px] shrink-0 w-[16rem]">
              <div className="flex"><div className="w-32 p-1 text-center">SUBTOTAL</div><div className="w-32 p-1 text-center">${formatMoney(subtotal)}</div></div>
              <div className="flex"><div className="w-32 p-1 text-center">9% GST</div><div className="w-32 p-1 text-center">${formatMoney(gst)}</div></div>
              <div className="flex mt-2 pt-2 border-t-2 border-black text-[17px]"><div className="w-32 p-1 text-center">TOTAL</div><div className="w-32 p-1 text-center">${formatMoney(total)}</div></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN EXPORT: INVOICE GENERATOR WORKSPACE
// ==========================================
export function InvoiceGenerator({ sys, existingInvoice = null, onClose }) {
  
  const [invoiceDate, setInvoiceDate] = useState(
    existingInvoice ? existingInvoice.date : new Date().toISOString().split('T')[0]
  );
  
  const [customerId, setCustomerId] = useState(existingInvoice?.customerId || '');
  
  const [items, setItems] = useState(() => {
    if (existingInvoice && Array.isArray(existingInvoice.items)) {
      return JSON.parse(JSON.stringify(existingInvoice.items));
    }
    return [];
  });

  const [paymentTerms, setPaymentTerms] = useState(existingInvoice?.paymentTerms || '30_days');

  const autoInvoiceNumber = useMemo(() => {
    if (existingInvoice && invoiceDate === existingInvoice.date) return existingInvoice.number; 

    const dateObj = new Date(invoiceDate);
    if (isNaN(dateObj.getTime())) return '';

    const yy = String(dateObj.getFullYear()).slice(-2); 
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0'); 
    const prefix = `${yy}${mm}`;

    const monthlyInvoices = (sys.invoices || []).filter(inv => String(inv.number).startsWith(prefix));
    let maxSequence = 0;
    
    monthlyInvoices.forEach(inv => {
      const seqStr = String(inv.number).slice(4); 
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSequence) {
        maxSequence = seqNum;
      }
    });

    const nextSequence = String(maxSequence + 1).padStart(3, '0');
    return `${prefix}${nextSequence}`;
  }, [sys.invoices, existingInvoice, invoiceDate]);

  const [invoiceNumber, setInvoiceNumber] = useState(autoInvoiceNumber);

  useEffect(() => {
    setInvoiceNumber(autoInvoiceNumber);
  }, [autoInvoiceNumber]);
  
  const [isParsing, setIsParsing] = useState(false);
  const [parseText, setParseText] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [autoFillNotif, setAutoFillNotif] = useState(false);
  
  const [priceModal, setPriceModal] = useState(null);

  const customer = (sys.customers || []).find((entry) => entry.id === customerId);

  const isDuplicateNumber = useMemo(() => {
    return (sys.invoices || []).some(inv => String(inv.number) === String(invoiceNumber) && inv.id !== (existingInvoice ? existingInvoice.id : null));
  }, [invoiceNumber, sys.invoices, existingInvoice]);

  const subtotal = (items || []).reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0);
  const gst = subtotal * 0.09;
  const total = subtotal + gst;

  const getSafePrice = (product, unit = '箱') => {
    const ruleKey = `${product.id}|${unit}`;
    if (customer?.custom_prices && customer.custom_prices[ruleKey] !== undefined) {
      return Number(customer.custom_prices[ruleKey]);
    }
    let price = product.Price || product.unitPrice || product['Unit Price (SG)'] || 0;
    return Number(price);
  };

  useEffect(() => {
    const originalCustomer = existingInvoice?.customerId || '';
    if (existingInvoice && customerId === originalCustomer) {
      return; 
    }

    if (!customerId) {
      setItems([]); 
      setAutoFillNotif(false); 
      return;
    }

    const history = (sys.invoices || []).filter((invoice) => invoice.customerId === customerId);
    if (history.length === 0) { setItems([]); setAutoFillNotif(false); return; }

    const itemStats = {};
    history.forEach((invoice) => {
      invoice.items?.forEach((item) => {
        if (!itemStats[item.itemId]) { itemStats[item.itemId] = { count: 0, totalQty: 0, unit: item.unit || item.Unit }; }
        itemStats[item.itemId].count += 1;
        itemStats[item.itemId].totalQty += Number(item.qty || 0);
      });
    });

    const autoFilled = [];
    Object.entries(itemStats).forEach(([itemId, stats]) => {
      if (stats.count / history.length >= 0.9) {
        const product = (sys.inventory || []).find((entry) => entry.id === itemId);
        if (product) {
          const determinedUnit = stats.unit || product.Unit || product.unit || '箱';
          autoFilled.push({
            itemId,
            name: product.Name || product.name || product.Items,
            unit: determinedUnit,
            qty: Math.max(1, Math.round(stats.totalQty / stats.count)),
            unitPrice: getSafePrice(product, determinedUnit), 
            picked: false,
            suggestions: []
          });
        }
      }
    });

    if (autoFilled.length > 0) {
      setItems(autoFilled); setAutoFillNotif(true); setTimeout(() => setAutoFillNotif(false), 4000);
    } else {
      setItems([]); setAutoFillNotif(false);
    }
  }, [customerId, sys.invoices, sys.inventory, existingInvoice]);

  const suggestions = useMemo(() => {
    if (!customerId) return [];
    const history = (sys.invoices || []).filter((invoice) => invoice.customerId === customerId);
    if (history.length === 0) return [];

    const counts = {};
    history.forEach((invoice) => {
      invoice.items?.forEach((item) => { counts[item.itemId] = (counts[item.itemId] || 0) + 1; });
    });

    return Object.entries(counts)
      .filter(([, count]) => { const confidence = count / history.length; return confidence >= 0.3 && confidence < 0.9; })
      .map(([itemId]) => (sys.inventory || []).find((entry) => entry.id === itemId))
      .filter((item) => item && !(items || []).find((draftItem) => draftItem.itemId === item.id));
  }, [customerId, items, sys.invoices, sys.inventory]);

  // ==========================================
  // UPDATED: AI SMART EXTRACT WITH FUZZY MATCH
  // ==========================================
  const handleSmartExtract = () => {
    const lines = parseText.split('\n').filter(l => l.trim() !== '');
    const nextDraftItems = [...items];

    lines.forEach((line) => {
      const quantityMatch = line.match(/(\d+)/);
      const qty = quantityMatch ? parseInt(quantityMatch[0], 10) : 1;
      
      // Strip numbers out of the string so we only fuzzy-match the text/characters
      const searchString = line.replace(/(\d+)/g, '').trim().toLowerCase();
      if (!searchString) return;

      // Score all items based on exact match, AI learned phrases, and partial fuzzy char overlap
      const scoredItems = (sys.inventory || []).map((inventoryItem) => {
        const itemName = (inventoryItem.Name || inventoryItem.name || inventoryItem.Items || '').toLowerCase();
        let score = 0;

        // 1. Exact match gets highest priority
        if (itemName === searchString) {
          score += 50;
        } 
        // 2. Exact substring inclusion gets strong priority
        else if (itemName.includes(searchString) || searchString.includes(itemName)) {
          score += 10;
        } 
        // 3. Fallback to Fuzzy Character Overlap (great for mixed English/Chinese typos)
        else {
          const searchChars = new Set(searchString.replace(/\s/g, '').split(''));
          if (searchChars.size > 0) {
            let matchCount = 0;
            searchChars.forEach(char => {
              if (itemName.includes(char)) matchCount++;
            });
            // Only award points if at least half the characters match, to prevent pure junk suggestions
            if (matchCount / searchChars.size >= 0.5) {
               score += (matchCount / searchChars.size) * 5; 
            }
          }
        }

        // Add historical learned phrases score
        if (inventoryItem.learned_phrases && inventoryItem.learned_phrases[searchString]) { 
          score += (inventoryItem.learned_phrases[searchString] * 20); 
        }

        return { item: inventoryItem, score };
      });

      // Sort by best score descending
      scoredItems.sort((a, b) => b.score - a.score);
      const bestMatch = scoredItems[0];

      // If the score is strong enough (>= 10), auto-lock the item
      if (bestMatch && bestMatch.score >= 10) {
        const determinedUnit = bestMatch.item.Unit || bestMatch.item.unit || '箱';
        nextDraftItems.push({
          itemId: bestMatch.item.id,
          name: bestMatch.item.Name || bestMatch.item.name || bestMatch.item.Items,
          unit: determinedUnit,
          qty,
          unitPrice: getSafePrice(bestMatch.item, determinedUnit),
          picked: false,
          rawSearchString: searchString, 
          originalPredictedId: bestMatch.item.id, 
          suggestions: [] // Strong match, no suggestions needed
        });
      } else {
        // Weak match! Prefill qty/unit, but leave product blank and provide top 3 fuzzy suggestions
        const topSuggestions = scoredItems
          .filter(si => si.score > 0)
          .slice(0, 3)
          .map(si => si.item);

        nextDraftItems.push({ 
          itemId: '', 
          name: '', 
          unit: '箱', 
          qty, 
          unitPrice: 0, 
          picked: false, 
          rawSearchString: searchString, 
          originalPredictedId: null,
          suggestions: topSuggestions
        });
      }
    });

    setItems(nextDraftItems);
    setIsParsing(false);
    setParseText('');
  };

  const handleRegister = (printAfter = false) => {
    const invoice = {
      id: existingInvoice ? existingInvoice.id : `INV-${invoiceNumber}`,
      number: invoiceNumber,
      customerId,
      customer: customer?.name || existingInvoice?.customer || 'Unknown Customer',
      region: customer?.region || existingInvoice?.region || '',
      date: invoiceDate,
      items,
      total,
      status: existingInvoice ? existingInvoice.status : 'Paid',
      deliveryStatus: existingInvoice ? existingInvoice.deliveryStatus : 'Pending',
      paymentTerms,
    };

    const nextInventory = [...(sys.inventory || [])];

    items.forEach((item) => {
      if (!existingInvoice && item.itemId) {
        const stockIndex = nextInventory.findIndex((entry) => entry.id === item.itemId);
        if (stockIndex > -1) { nextInventory[stockIndex].stock -= Number(item.qty) || 0; }
      }

      if (item.rawSearchString) {
        if (item.itemId) {
          const correctIndex = nextInventory.findIndex((entry) => entry.id === item.itemId);
          if (correctIndex > -1) {
            if (!nextInventory[correctIndex].learned_phrases) { nextInventory[correctIndex].learned_phrases = {}; }
            const currentScore = nextInventory[correctIndex].learned_phrases[item.rawSearchString] || 0;
            nextInventory[correctIndex].learned_phrases[item.rawSearchString] = currentScore + 1;
          }
        }
        if (item.originalPredictedId && item.originalPredictedId !== item.itemId) {
          const wrongIndex = nextInventory.findIndex((entry) => entry.id === item.originalPredictedId);
          if (wrongIndex > -1) {
            if (!nextInventory[wrongIndex].learned_phrases) { nextInventory[wrongIndex].learned_phrases = {}; }
            const currentScore = nextInventory[wrongIndex].learned_phrases[item.rawSearchString] || 0;
            nextInventory[wrongIndex].learned_phrases[item.rawSearchString] = currentScore - 1;
          }
        }
      }
    });

    sys.setInventory(nextInventory);

    if (existingInvoice) {
      sys.setInvoices((sys.invoices || []).map(inv => inv.id === existingInvoice.id ? invoice : inv));
    } else {
      sys.setInvoices([...(sys.invoices || []), invoice]);
    }

    if (printAfter) { setTimeout(() => { window.print(); onClose(); }, 500); } else { onClose(); }
  };

  const executePriceSave = async (type, newPriceStr) => {
    const { index, item, product } = priceModal;
    const newPrice = Number(newPriceStr);
    const ruleKey = `${product.id}|${item.unit}`;

    try {
      if (type === 'CUSTOMER') {
        const updatedCustomPrices = { ...(customer.custom_prices || {}), [ruleKey]: newPrice };
        const { error } = await supabase.from('customers').update({ custom_prices: updatedCustomPrices }).eq('id', customer.id);
        if (error) throw error;
        
        sys.setCustomers(sys.customers.map(c => c.id === customer.id ? { ...c, custom_prices: updatedCustomPrices } : c));
      } 
      
      else if (type === 'GLOBAL') {
        const isUUID = product.id && product.id.length === 36 && product.id.includes('-');
        let dbError;

        if (isUUID) {
          const { error } = await supabase.from('product_list').update({ Price: newPrice }).eq('id', product.id);
          dbError = error;
        } else {
          const legacyName = product.Name || product.name || product.Items;
          const { error } = await supabase.from('product_list').update({ Price: newPrice }).eq('Name', legacyName);
          dbError = error;
        }

        if (dbError) throw dbError;
        sys.setInventory(sys.inventory.map(p => p.id === product.id ? { ...p, Price: newPrice } : p));
      }
      
      else if (type === 'REMOVE_CUSTOMER') {
        const updatedCustomPrices = { ...(customer.custom_prices || {}) };
        delete updatedCustomPrices[ruleKey];
        
        const { error } = await supabase.from('customers').update({ custom_prices: updatedCustomPrices }).eq('id', customer.id);
        if (error) throw error;

        sys.setCustomers(sys.customers.map(c => c.id === customer.id ? { ...c, custom_prices: updatedCustomPrices } : c));
        
        const fallbackPrice = product.Price || product.unitPrice || product['Unit Price (SG)'] || 0;
        const nextItems = [...items];
        nextItems[index].unitPrice = fallbackPrice;
        setItems(nextItems);
        setPriceModal(null);
        return;
      }

      const nextItems = [...items];
      nextItems[index].unitPrice = newPrice;
      setItems(nextItems);
      setPriceModal(null);

    } catch (error) {
      console.error("Pricing update failed:", error);
      alert(`Database Update Failed: ${error.message || 'Could not verify connection.'}`);
    }
  };

  if (previewMode) {
    return (
      <InvoicePreview
        customer={customer} gst={gst} invoiceNumber={invoiceNumber} invoiceDate={invoiceDate} items={items}
        onBack={() => setPreviewMode(false)} onRegister={handleRegister} paymentTerms={paymentTerms} setItems={setItems}
        subtotal={subtotal} sys={sys} total={total} existingInvoice={existingInvoice}
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
            <button className="flex items-center rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-black shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500" onClick={() => setIsParsing(true)} type="button">
              <MessageSquare className="mr-2" size={14} /> Paste Order Message
            </button>
            <button className="rounded-full p-1.5 transition-colors hover:bg-slate-800" onClick={onClose} type="button">
              <X size={20} />
            </button>
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

            <div className="mb-12 flex justify-between">
              <div className="w-[30%] border-r border-slate-100 pr-6">
                <label className="text-[10px] font-black uppercase text-gray-400">Customer Account:</label>
                <CustomerSearchSelect value={customerId} customers={sys.customers} onChange={setCustomerId} disabled={!!existingInvoice} />
                {autoFillNotif && (<p className="mt-2 flex items-center text-[10px] font-black uppercase tracking-widest text-emerald-500"><Sparkles className="mr-1" size={12} /> Predictively Prefilled</p>)}
              </div>

              <div className="w-[20%] border-r border-slate-100 px-6">
                <label className="text-[10px] font-black uppercase text-gray-400">Invoice Date:</label>
                <input type="date" className="mt-1 w-full cursor-pointer border-none bg-transparent p-0 text-[16px] font-black text-slate-800 focus:ring-0 outline-none" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
              </div>

              <div className="w-[20%] border-r border-slate-100 px-6">
                <label className="text-[10px] font-black uppercase text-gray-400">Terms:</label>
                <select className="mt-1 w-full cursor-pointer border-none bg-transparent p-0 text-lg font-black text-slate-800 focus:ring-0" onChange={(event) => setPaymentTerms(event.target.value)} value={paymentTerms}>
                  <option value="30_days">30 Days</option>
                  <option value="cod">C.O.D</option>
                </select>
              </div>

              <div className="w-[30%] pl-6 text-right relative">
                <label className="text-[10px] font-black uppercase text-gray-400">Serial No.</label>
                <div className="flex items-center justify-end text-3xl font-black tracking-tighter text-red-600 mt-1">
                  <span className="mr-1">#</span>
                  <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={`w-full max-w-[140px] bg-transparent border-b-2 outline-none text-right focus:ring-0 p-0 m-0 ${isDuplicateNumber ? 'border-red-500 text-red-600' : 'border-transparent hover:border-red-200 focus:border-red-600'}`} />
                </div>
                {isDuplicateNumber && (<p className="text-[10px] font-black text-red-500 uppercase mt-1">Number Already Exists!</p>)}
              </div>
            </div>

            {suggestions.length > 0 && !existingInvoice && (
              <div className="mb-6 rounded border border-dashed border-blue-200 bg-blue-50/50 p-4">
                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-blue-400">Secondary Recommendations</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((item) => (
                    <button key={item.id} className="rounded border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-bold text-blue-700 shadow-sm"
                      onClick={() => {
                        const determinedUnit = item.Unit || item.unit || '箱';
                        setItems([...items, { itemId: item.id, name: item.Name || item.name || item.Items, unit: determinedUnit, qty: 1, unitPrice: getSafePrice(item, determinedUnit), picked: false, suggestions: [] }])
                      }} type="button">
                      + {item.Name || item.name || item.Items}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <table className="w-full text-left relative z-10">
              <thead className="border-y-2 border-slate-900 bg-slate-50">
                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <th className="w-12 p-4 text-center">No.</th>
                  <th className="p-4 w-72">Description</th>
                  <th className="w-24 p-4 text-center">Unit</th>
                  <th className="w-20 p-4 text-center">Qty</th>
                  <th className="w-28 p-4 text-right">Cost</th>
                  <th className="w-28 p-4 text-right">Total</th>
                  <th className="w-8 p-4"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const ruleKey = `${item.itemId}|${item.unit}`;
                  const hasCustomPrice = customer?.custom_prices && customer.custom_prices[ruleKey] !== undefined;

                  return (
                    <tr className={`border-b font-bold ${!item.itemId && item.rawSearchString ? 'bg-amber-50/30 border-amber-100' : 'border-gray-100'}`} key={`${item.itemId}-${index}`}>
                      <td className="p-4 text-center font-mono text-xs text-slate-300 align-top pt-5">{index + 1}</td>
                      <td className="p-2 relative align-top pt-3">
                        <div className="flex items-center space-x-2">
                          <input checked={item.picked || false} className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0" onChange={(event) => { const nextItems = [...items]; nextItems[index].picked = event.target.checked; setItems(nextItems); }} type="checkbox" />
                          <ProductSearchSelect value={item.itemId} inventory={sys.inventory} onChange={(selectedId) => { const product = (sys.inventory || []).find((entry) => entry.id === selectedId); if (!product) return; const nextItems = [...items]; const determinedUnit = product.Unit || product.unit || '箱'; nextItems[index] = { ...nextItems[index], itemId: selectedId, name: product.Name || product.name || product.Items, unit: determinedUnit, unitPrice: getSafePrice(product, determinedUnit), suggestions: [] }; setItems(nextItems); }} />
                        </div>
                        
                        {item.rawSearchString && item.itemId && (
                          <p className="text-[9px] text-blue-400 font-medium ml-6 mt-1 flex items-center">
                            <BrainCircuit size={10} className="mr-1" /> Predicted from: "{item.rawSearchString}"
                          </p>
                        )}

                        {/* NEW: FUZZY SUGGESTIONS BLOCK */}
                        {!item.itemId && item.suggestions && item.suggestions.length > 0 && (
                          <div className="ml-6 mt-2 mb-1 p-2.5 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 mb-2 flex items-center">
                              <AlertTriangle size={12} className="mr-1.5" /> Did you mean?
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {item.suggestions.map((sugg) => {
                                const suggName = sugg.Name || sugg.name || sugg.Items;
                                const suggUnit = sugg.Unit || sugg.unit || '箱';
                                return (
                                  <button
                                    key={sugg.id}
                                    type="button"
                                    onClick={() => {
                                      const nextItems = [...items];
                                      nextItems[index] = {
                                        ...nextItems[index],
                                        itemId: sugg.id,
                                        name: suggName,
                                        unit: suggUnit,
                                        unitPrice: getSafePrice(sugg, suggUnit),
                                        suggestions: [], 
                                        originalPredictedId: sugg.id
                                      };
                                      setItems(nextItems);
                                    }}
                                    className="text-[11px] bg-white border border-amber-300 text-amber-900 font-bold px-2 py-1 rounded shadow-sm hover:bg-amber-200 transition-colors"
                                  >
                                    {suggName}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {!item.itemId && item.rawSearchString && (!item.suggestions || item.suggestions.length === 0) && (
                          <p className="text-[9px] text-amber-500 font-medium ml-6 mt-1 flex items-center">
                            <AlertTriangle size={10} className="mr-1" /> No matches found for "{item.rawSearchString}"
                          </p>
                        )}
                      </td>
                      <td className="p-2 align-top pt-4">
                        <select className="w-full border-none text-center text-xs font-bold focus:ring-0 bg-transparent m-0" onChange={(event) => { const nextItems = [...items]; const newUnit = event.target.value; nextItems[index].unit = newUnit; const product = (sys.inventory || []).find(p => p.id === nextItems[index].itemId); if (product) { nextItems[index].unitPrice = getSafePrice(product, newUnit); } setItems(nextItems); }} value={item.unit}>
                          {UNIT_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                        </select>
                      </td>
                      <td className="p-2 align-top pt-3">
                        <input className="w-full border-none bg-transparent p-1 text-center font-black text-blue-600 focus:ring-0 m-0" onChange={(event) => { const nextItems = [...items]; nextItems[index].qty = event.target.value; setItems(nextItems); }} type="number" value={item.qty} />
                      </td>
                      <td className="p-2 align-top pt-3 text-right">
                        <input className="w-full border-none bg-transparent p-1 text-right font-black focus:ring-0 m-0 leading-none" onChange={(event) => { const nextItems = [...items]; nextItems[index].unitPrice = event.target.value; setItems(nextItems); }} step="0.01" type="number" value={item.unitPrice} />
                        
                        {item.itemId && customer && (
                          <button 
                            type="button"
                            onClick={() => {
                              const product = (sys.inventory || []).find((entry) => entry.id === item.itemId);
                              if (product) setPriceModal({ index, item, product, hasCustomPrice });
                            }}
                            className={`text-[9px] uppercase tracking-widest mt-0.5 px-2 py-1 rounded transition-colors flex items-center justify-end w-full ${
                              hasCustomPrice ? 'text-emerald-500 font-black hover:bg-emerald-50' : 'text-slate-400 font-semibold hover:bg-slate-100'
                            }`}
                          >
                            {hasCustomPrice ? '★ Custom' : <><Settings size={10} className="mr-1" /> Default</>}
                          </button>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono text-lg font-black tracking-tighter text-slate-900 align-top pt-3">${formatMoney((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}</td>
                      <td className="w-8 p-0 align-top pt-5">
                        <button className="ml-2 text-red-200 hover:text-red-500" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <button className="mt-8 rounded bg-blue-50 px-5 py-2 text-[10px] font-bold uppercase text-blue-600 shadow-sm transition-all" onClick={() => setItems([...items, { itemId: '', name: '', unit: '箱', qty: 1, unitPrice: 0, picked: false, suggestions: [] }])} type="button">
              + Add Row Manually
            </button>

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
      {/* PRICING MANAGER MODAL */}
      {/* ========================================== */}
      {priceModal && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <h2 className="text-sm font-black tracking-widest uppercase flex items-center">
                <Settings size={16} className="mr-2 text-blue-400" />
                Pricing Manager
              </h2>
              <button onClick={() => setPriceModal(null)} className="hover:bg-slate-800 p-1 rounded-full transition-colors"><X size={18} /></button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-1">Editing price for:</p>
              <p className="text-base font-bold text-slate-900 mb-4">{priceModal.product.Name || priceModal.product.name} ({priceModal.item.unit})</p>
              
              <div className="mb-6">
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Long-Term New Price ($)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full text-2xl font-black text-blue-600 border-2 border-blue-100 rounded-xl p-4 outline-none focus:border-blue-500 bg-blue-50/50"
                  defaultValue={priceModal.item.unitPrice}
                  id="pricingManagerInput"
                />
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => executePriceSave('CUSTOMER', document.getElementById('pricingManagerInput').value)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <Sparkles size={16} className="mr-2" /> Save for {customer.name} Only
                </button>
                
                <button 
                  onClick={() => executePriceSave('GLOBAL', document.getElementById('pricingManagerInput').value)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                >
                  Update Global Catalog Price
                </button>

                {priceModal.hasCustomPrice && (
                  <button 
                    onClick={() => executePriceSave('REMOVE_CUSTOMER')}
                    className="w-full bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 font-bold py-3 rounded-xl transition-colors"
                  >
                    Clear Custom Price
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
