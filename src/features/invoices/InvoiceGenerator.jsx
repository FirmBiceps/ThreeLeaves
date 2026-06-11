import { useEffect, useMemo, useState, useRef } from 'react';
import { FileText, MessageSquare, X, Search, BrainCircuit, Sparkles, AlertTriangle, Settings, Layers, User, Trash2, ScanBarcode, Check, Save, Eye } from 'lucide-react';
import { CompanyHeader } from '../../components/shared/CompanyHeader';
import { UNIT_OPTIONS } from '../../data/company';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';
import { InvoicePreview } from './InvoicePreview';

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

export function InvoiceGenerator({ sys, groups, setGroups, existingInvoice = null, onClose }) {
  const [invoiceDate, setInvoiceDate] = useState(existingInvoice ? String(existingInvoice.date || '') : new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState(existingInvoice?.customerId || '');
  const [isAutofillEnabled, setIsAutofillEnabled] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState(existingInvoice?.status || 'Unpaid');

  const [isSpecialFormat, setIsSpecialFormat] = useState(existingInvoice?.isSpecialFormat || false);
  const [poNumber, setPoNumber] = useState(existingInvoice?.poNumber || '');
  const [carPlateNo, setCarPlateNo] = useState(existingInvoice?.carPlateNo || '');
  
  const [invoiceRemarks, setInvoiceRemarks] = useState(existingInvoice?.remarks || '');
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);

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

  // AUTO-SYNC PAYMENT TERMS: When a new customer is selected, update terms to their default
  useEffect(() => {
    if (customerId && !existingInvoice) {
      const selectedCust = safeCustomers.find(c => c?.id === customerId);
      if (selectedCust && selectedCust.payment_terms) {
        setPaymentTerms(selectedCust.payment_terms);
      } else {
        setPaymentTerms('30_days'); // Fallback if customer has no specific default
      }
    }
  }, [customerId, safeCustomers, existingInvoice]);

  const autoInvoiceNumber = useMemo(() => {
    // BUGFIX: If an existing invoice is being edited, ALWAYS keep its original number.
    // Do not run the auto-generator just because the date changed!
    if (existingInvoice) return String(existingInvoice.number || ''); 

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
  
  // Ensure the state updates when autoInvoiceNumber changes (only applies to new invoices now)
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
      isSpecialFormat: !!isSpecialFormat, poNumber: poNumber || null, carPlateNo: carPlateNo || null,
      remarks: invoiceRemarks 
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
        mode="generator"
        customer={customer} gst={gst} invoiceNumber={invoiceNumber} invoiceDate={invoiceDate} items={items}
        remarks={invoiceRemarks}
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
                      <td className="p-2 relative align-top pt-3 pb-3">
                        <div className="flex items-center space-x-2">
                          <input checked={item.picked || false} className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0" onChange={(event) => { const nextItems = [...items]; if (nextItems[index]) nextItems[index].picked = event.target.checked; setItems(nextItems); }} type="checkbox" />
                          <ProductSearchSelect value={item.itemId} inventory={safeInventory} isAutoFilled={isPredicted} onChange={(selectedId) => { const product = safeInventory.find((entry) => entry?.id === selectedId); if (!product) return; const nextItems = [...items]; const determinedUnit = String(product.Unit || product.unit || '箱'); if (nextItems[index]) { nextItems[index] = { ...nextItems[index], itemId: selectedId, name: String(product.Name || product.name || product.Items || ''), unit: determinedUnit, unitPrice: getSafePrice(product, determinedUnit), suggestions: [], isAutoFilled: false, rawSearchString: null }; } setItems(nextItems); }} />
                        </div>

                        {isPredicted && (
                          <div className="ml-6 mt-1.5 flex items-center">
                            <button onClick={() => { const next = [...items]; if(next[index]) { next[index].isAutoFilled = false; next[index].rawSearchString = null; } setItems(next); }} className="text-[9px] font-black uppercase tracking-widest bg-indigo-200 text-indigo-800 px-2 py-1 rounded shadow-sm hover:bg-indigo-300 transition-colors flex items-center" type="button"><Check size={10} className="mr-1" /> Verify Match</button>
                          </div>
                        )}
                        {item.rawSearchString && item.itemId && !isPredicted && (<p className="text-[9px] text-blue-400 font-medium ml-6 mt-1.5 flex items-center"><BrainCircuit size={10} className="mr-1" /> Predicted from: "{item.rawSearchString}"</p>)}
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
                        {!item.itemId && item.rawSearchString && (!item.suggestions || item.suggestions.length === 0) && (<p className="text-[9px] text-amber-500 font-medium ml-6 mt-1.5 flex items-center"><AlertTriangle size={10} className="mr-1" /> No matches found for "{item.rawSearchString}"</p>)}
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
            
            <div className="flex gap-2 mt-8">
              <button className="rounded bg-blue-50 px-5 py-2 text-[10px] font-bold uppercase text-blue-600 shadow-sm transition-all hover:bg-blue-100" onClick={() => setItems([...(Array.isArray(items) ? items.filter(Boolean) : []), { itemId: '', name: '', unit: '箱', qty: 1, unitPrice: 0, picked: false, suggestions: [] }])} type="button">+ Add Row Manually</button>
              <button className="rounded bg-indigo-50 px-5 py-2 text-[10px] font-bold uppercase text-indigo-600 shadow-sm transition-all hover:bg-indigo-100 flex items-center" onClick={() => setIsRemarkModalOpen(true)} type="button"><MessageSquare size={12} className="mr-1.5"/> Add / Edit Invoice Remarks</button>
            </div>

            <div className="mt-8 flex justify-between border-t-2 border-slate-900 pt-6">
              <div className="w-[50%]">
                {invoiceRemarks && (
                  <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-yellow-600 mb-1">Invoice Remarks</h4>
                     <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{invoiceRemarks}</p>
                  </div>
                )}
              </div>
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

      {/* ========================================== */}
      {/* INVOICE REMARKS MANAGER MODAL */}
      {/* ========================================== */}
      {isRemarkModalOpen && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <h2 className="text-sm font-black tracking-widest uppercase flex items-center"><MessageSquare size={16} className="mr-2 text-blue-400" /> Invoice Remarks</h2>
              <button onClick={() => setIsRemarkModalOpen(false)} className="hover:bg-slate-800 p-1 rounded-full transition-colors"><X size={18} /></button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4">Add notes or special instructions for this invoice. These will appear in the bottom-left corner of the normal invoice template.</p>
              
              <div className="mb-6">
                <textarea 
                  id="invoiceRemarkInput" 
                  rows={5}
                  className="w-full text-sm font-medium text-slate-800 border-2 border-blue-100 rounded-xl p-4 outline-none focus:border-blue-500 bg-blue-50/50 resize-none shadow-inner" 
                  defaultValue={invoiceRemarks} 
                  placeholder="Enter any special instructions, backorder notes, or highlights..."
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setIsRemarkModalOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 px-4 rounded-xl transition-colors text-sm">
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setInvoiceRemarks(document.getElementById('invoiceRemarkInput').value);
                    setIsRemarkModalOpen(false);
                  }} 
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-blue-500/20 text-sm"
                >
                  <Save size={16} className="mr-2 shrink-0" /> Save Remarks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
