import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Eye,
  FileText,
  MessageSquare,
  Printer,
  Save,
  Sparkles,
  Trash2,
  Wand2,
  X,
  Search,
} from 'lucide-react';
import { CompanyHeader } from '../../components/shared/CompanyHeader';
import { UNIT_OPTIONS } from '../../data/company';
import { formatMoney } from '../../utils/format';

// 1. IMPORT YOUR LOGO DIRECTLY HERE
import logo from './three_leaves_logo.png';

// ==========================================
// SEARCHABLE PRODUCT DROPDOWN
// ==========================================
function ProductSearchSelect({ value, inventory, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProduct = inventory.find((entry) => entry.id === value);
  const displayName = selectedProduct ? (selectedProduct.name || selectedProduct.Items) : '';

  const filteredInventory = inventory.filter((item) => {
    const itemName = (item.name || item.Items || '').toLowerCase();
    return itemName.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setSearchTerm(''); 
          }}
          className={`w-full text-left text-xs font-bold p-1 border border-transparent rounded hover:bg-slate-200 transition-colors focus:outline-none ${
            displayName ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          {displayName || '- Search Product -'}
        </button>
      ) : (
        <div className="absolute z-[5000] top-0 left-0 w-72 bg-white border border-slate-300 rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center p-2 border-b border-slate-200 bg-slate-50">
            <Search size={14} className="text-slate-400 ml-1 mr-2 shrink-0" />
            <input
              autoFocus
              type="text"
              className="w-full bg-transparent border-none text-xs font-bold text-slate-800 p-1 focus:ring-0 placeholder:text-slate-400 outline-none"
              placeholder="Type to search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => {
                const itemName = item.name || item.Items || 'Unnamed Product';
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 border-b border-slate-100 last:border-0 transition-colors"
                    onClick={() => {
                      onChange(item.id);
                      setIsOpen(false);
                    }}
                  >
                    {itemName}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-400 font-medium">
                No products found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// EXACT MATCH PDF PREVIEW
// ==========================================
function InvoicePreview({
  customer,
  gst,
  invoiceNumber,
  items,
  onBack,
  onRegister,
  paymentTerms,
  subtotal,
  sys,
  total,
  existingInvoice
}) {
  return (
    <div className="fixed inset-0 z-[3000] overflow-y-auto bg-slate-950/90 print:bg-white print:p-0">
      <div className="flex min-h-full justify-center py-12 print:py-0">
        <div className="relative flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-white p-8 shadow-2xl print:w-full print:p-0 print:shadow-none">
          
          <div className="absolute -top-16 left-0 right-0 flex items-center justify-between px-4 print:hidden">
            <button
              className="flex items-center rounded bg-slate-800 px-6 py-2.5 font-bold text-white transition-all hover:bg-slate-700"
              onClick={onBack}
              type="button"
            >
              Edit Draft
            </button>
            <div className="flex space-x-3">
              <button
                className="flex items-center rounded border border-slate-300 bg-white px-6 py-2.5 font-bold text-slate-900 shadow-lg transition-all hover:bg-slate-50"
                onClick={() => onRegister(false)}
                type="button"
              >
                <Save className="mr-2" size={18} /> Save to History
              </button>
              <button
                className="flex items-center rounded bg-blue-600 px-8 py-2.5 font-bold text-white shadow-xl transition-all hover:bg-blue-700"
                onClick={() => onRegister(true)}
                type="button"
              >
                <Printer className="mr-2" size={18} /> Print
              </button>
            </div>
          </div>

          <div id="printable-invoice" className="bg-white text-black font-sans w-full h-full flex flex-col pt-0">
            
            <div className="flex justify-between items-start mb-6">
              <div className="w-[25%]">
                <img src={logo} alt="Three Leaves Logo" className="w-[110px] h-auto object-contain" />
              </div>

              <div className="w-[50%] text-center leading-tight pt-2">
                <h1 className="font-bold text-[14px]">THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
                <h2 className="font-bold text-[13px] mb-1">三叶（新加坡） 贸易公司</h2>
                <p className="font-bold text-[10px] mb-0.5">CO.REG NO.53033969B &nbsp;&nbsp;&nbsp; GST REG NO. M90355440L</p>
                <p className="text-[10px] mb-0.5">280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
                <p className="text-[10px]">HP: 97578869 (Mr Ye) &nbsp; HP: 91113505 (Min) &nbsp; Email: 3leaves.sg@gmail.com</p>
              </div>

              <div className="w-[25%] flex flex-col items-end pt-1">
                <div className="text-center w-full mb-2">
                  <h2 className="text-[18px] font-bold tracking-[0.2em] leading-none mb-0.5">發票</h2>
                  <h3 className="text-[14px] font-bold tracking-widest uppercase">TAX INVOICE</h3>
                </div>
                <div className="w-full text-[12px] text-left mt-2 px-2">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold">No.</span>
                    <span className="text-red-600 font-bold tracking-wider">{invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Term:</span>
                    <span className="font-bold">{paymentTerms === 'cod' ? 'COD' : '30 Days'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4 text-[12px] font-bold flex flex-col w-full">
              <div className="flex justify-between w-full mb-2">
                <div className="flex items-end w-[65%] pr-4">
                  <span className="w-10 shrink-0">TO:</span>
                  <span className="flex-1 uppercase border-b border-black pb-0.5">
                    {customer?.name || existingInvoice?.customer || ''}
                  </span>
                </div>
                <div className="flex items-end w-[35%] pl-4">
                  <span className="w-12 shrink-0">DATE:</span>
                  <span className="flex-1 text-center border-b border-black pb-0.5">
                    {existingInvoice?.date 
                      ? new Date(existingInvoice.date).toLocaleDateString('en-GB').replace(/\//g, '-') 
                      : new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}
                  </span>
                </div>
              </div>
              <div className="flex items-end w-full">
                <span className="w-20 shrink-0">ADDRESS:</span>
                <span className="flex-1 uppercase leading-tight border-b border-black pb-0.5">
                  {customer?.address || ''}
                </span>
              </div>
            </div>

            <table className="w-full text-[12px] border-2 border-black text-center mb-0 leading-tight flex-grow">
              <thead className="border-b-2 border-black">
                <tr className="font-bold bg-white">
                  <th className="py-2 px-1 border-r border-black w-12">NO.</th>
                  <th className="py-2 px-2 border-r border-black text-left">DESCRIPTION</th>
                  <th className="py-2 px-1 border-r border-black w-32">QUANTITY</th>
                  <th className="py-2 px-1 border-r border-black w-28">UNIT PRICE</th>
                  <th className="py-2 px-1 w-28">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const foundProduct = sys.inventory.find((entry) => entry.id === item.itemId);
                  const productName = foundProduct ? (foundProduct.name || foundProduct.Items) : (item.name || '-');

                  return (
                    <tr key={idx} className="h-[28px] align-top">
                      <td className="p-1 border-r border-black font-medium">{idx + 1}</td>
                      <td className="p-1 border-r border-black text-left pl-2 font-bold">{productName}</td>
                      <td className="p-1 border-r border-black font-medium">{item.qty} {item.unit}</td>
                      <td className="p-1 border-r border-black text-right pr-2">${formatMoney(item.unitPrice)}</td>
                      <td className="p-1 text-right pr-2 font-bold">
                        ${formatMoney((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}
                      </td>
                    </tr>
                  );
                })}
                {items.length < 20 && Array.from({ length: 20 - items.length }).map((_, i) => (
                  <tr key={`blank-${i}`} className="h-[28px]">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex w-full mt-4">
              <div className="w-[70%] pr-4 text-[11px] font-bold leading-snug flex flex-col justify-between">
                <div>
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
                <div className="mt-8 mb-2">
                  <div className="w-48 border-t border-black text-center pt-1">Received By</div>
                </div>
              </div>

              <div className="w-[30%] flex flex-col font-bold text-[12px] pt-2">
                <div className="flex justify-between p-1">
                  <span className="pl-1">SUBTOTAL</span>
                  <span className="pr-1">${formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between p-1">
                  <span className="pl-1">9% GST</span>
                  <span className="pr-1">${formatMoney(gst)}</span>
                </div>
                <div className="flex justify-between p-1 mt-4 text-[14px]">
                  <span className="pl-1">TOTAL</span>
                  <span className="pr-1">${formatMoney(total)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN INVOICE GENERATOR COMPONENT
// ==========================================
export function InvoiceGenerator({ sys, existingInvoice = null, onClose }) {
  
  const generatedInvoiceNumber = useMemo(() => {
    if (existingInvoice) return existingInvoice.number; 

    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2); 
    const mm = String(date.getMonth() + 1).padStart(2, '0'); 
    const prefix = `${yy}${mm}`;

    const monthlyInvoices = sys.invoices.filter(inv => String(inv.number).startsWith(prefix));
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
  }, [sys.invoices, existingInvoice]);

  const [customerId, setCustomerId] = useState(existingInvoice ? existingInvoice.customerId : '');
  const [paymentTerms, setPaymentTerms] = useState(existingInvoice ? existingInvoice.paymentTerms : '30_days');
  const [items, setItems] = useState(existingInvoice ? existingInvoice.items : []);
  
  const [isParsing, setIsParsing] = useState(false);
  const [parseText, setParseText] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [autoFillNotif, setAutoFillNotif] = useState(false);
  
  const customer = sys.customers.find((entry) => entry.id === customerId);

  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const gst = subtotal * 0.09;
  const total = subtotal + gst;

  const getSafePrice = (product) => {
    let price = sys.getApplicablePrice ? sys.getApplicablePrice(product.id, customerId) : null;
    if (price === null || price === undefined || isNaN(price)) {
      price = product.unitPrice || product['Unit Price (SG)'] || 0;
    }
    return price;
  };

  useEffect(() => {
    // --- THE FIX: PREVENT AUTO-FILL FROM WIPING EXISTING ITEMS ---
    if (existingInvoice && customerId === existingInvoice.customerId) {
      return; 
    }

    if (!customerId) {
      setItems([]);
      setAutoFillNotif(false);
      return;
    }

    const history = sys.invoices.filter((invoice) => invoice.customerId === customerId);
    if (history.length === 0) {
      setItems([]);
      setAutoFillNotif(false);
      return;
    }

    const itemStats = {};
    history.forEach((invoice) => {
      invoice.items?.forEach((item) => {
        if (!itemStats[item.itemId]) {
          itemStats[item.itemId] = { count: 0, totalQty: 0, unit: item.unit };
        }
        itemStats[item.itemId].count += 1;
        itemStats[item.itemId].totalQty += Number(item.qty || 0);
      });
    });

    const autoFilled = [];
    Object.entries(itemStats).forEach(([itemId, stats]) => {
      if (stats.count / history.length >= 0.9) {
        const product = sys.inventory.find((entry) => entry.id === itemId);
        if (product) {
          autoFilled.push({
            itemId,
            name: product.name || product.Items,
            unit: stats.unit || product.unit || product.Unit || '箱',
            qty: Math.max(1, Math.round(stats.totalQty / stats.count)),
            unitPrice: getSafePrice(product),
            picked: false,
          });
        }
      }
    });

    if (autoFilled.length > 0) {
      setItems(autoFilled);
      setAutoFillNotif(true);
      setTimeout(() => setAutoFillNotif(false), 4000);
    } else {
      setItems([]);
      setAutoFillNotif(false);
    }
  }, [customerId, sys.invoices, sys.inventory, existingInvoice]);

  const suggestions = useMemo(() => {
    if (!customerId) return [];
    const history = sys.invoices.filter((invoice) => invoice.customerId === customerId);
    if (history.length === 0) return [];

    const counts = {};
    history.forEach((invoice) => {
      invoice.items?.forEach((item) => {
        counts[item.itemId] = (counts[item.itemId] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .filter(([, count]) => {
        const confidence = count / history.length;
        return confidence >= 0.3 && confidence < 0.9;
      })
      .map(([itemId]) => sys.inventory.find((entry) => entry.id === itemId))
      .filter((item) => item && !items.find((draftItem) => draftItem.itemId === item.id));
  }, [customerId, items, sys.invoices, sys.inventory]);

  const handleSmartExtract = () => {
    const lines = parseText.split('\n');
    const nextDraftItems = [...items];

    lines.forEach((line) => {
      const quantityMatch = line.match(/(\d+)/);
      const qty = quantityMatch ? parseInt(quantityMatch[0], 10) : 1;
      
      const foundItem = sys.inventory.find((inventoryItem) => {
        const itemName = inventoryItem.name || inventoryItem.Items || '';
        return line.toLowerCase().includes(itemName.toLowerCase());
      });

      if (foundItem) {
        nextDraftItems.push({
          itemId: foundItem.id,
          name: foundItem.name || foundItem.Items,
          unit: foundItem.unit || foundItem.Unit || '箱',
          qty,
          unitPrice: getSafePrice(foundItem),
          picked: false,
        });
      }
    });

    setItems(nextDraftItems);
    setIsParsing(false);
    setParseText('');
  };

  const handleRegister = (printAfter = false) => {
    const invoice = {
      id: existingInvoice ? existingInvoice.id : `INV-${generatedInvoiceNumber}`,
      number: generatedInvoiceNumber,
      customerId,
      customer: customer?.name || existingInvoice?.customer || 'Unknown Customer',
      region: customer?.region || existingInvoice?.region || '',
      date: existingInvoice ? existingInvoice.date : new Date().toISOString().split('T')[0],
      items,
      total,
      status: 'Paid',
      paymentTerms,
    };

    if (!existingInvoice) {
      const nextInventory = [...sys.inventory];
      items.forEach((item) => {
        const index = nextInventory.findIndex((entry) => entry.id === item.itemId);
        if (index > -1) {
          nextInventory[index].stock -= Number(item.qty) || 0;
        }
      });
      sys.setInventory(nextInventory);
    }

    if (existingInvoice) {
      sys.setInvoices(sys.invoices.map(inv => inv.id === existingInvoice.id ? invoice : inv));
    } else {
      sys.setInvoices([...sys.invoices, invoice]);
    }

    if (printAfter) {
      setTimeout(() => {
        window.print();
        onClose();
      }, 500);
    } else {
      onClose();
    }
  };

  if (previewMode) {
    return (
      <InvoicePreview
        customer={customer}
        gst={gst}
        invoiceNumber={generatedInvoiceNumber}
        items={items}
        onBack={() => setPreviewMode(false)}
        onRegister={handleRegister}
        paymentTerms={paymentTerms}
        setItems={setItems}
        subtotal={subtotal}
        sys={sys}
        total={total}
        existingInvoice={existingInvoice}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div className="flex h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-slate-900 p-4 px-8 text-white">
          <div className="flex items-center space-x-3">
            <FileText className="text-blue-500" />
            <h2 className="text-sm font-black uppercase tracking-widest">
              {existingInvoice ? 'Edit Existing Invoice' : 'Draft Invoice Workspace'}
            </h2>
          </div>
          <div className="flex space-x-3">
            <button
              className="flex items-center rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-black shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500"
              onClick={() => setIsParsing(true)}
              type="button"
            >
              <MessageSquare className="mr-2" size={14} /> Paste Order Message
            </button>
            <button
              className="rounded-full p-1.5 transition-colors hover:bg-slate-800"
              onClick={onClose}
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 p-8">
          {isParsing && (
            <div className="mb-8 rounded-2xl bg-blue-600 p-8 text-white shadow-2xl">
              <h3 className="mb-2 flex items-center text-lg font-black">
                <Wand2 className="mr-3" size={24} /> Smart Order Extractor
              </h3>
              <textarea
                className="mb-4 h-32 w-full rounded border border-blue-400 bg-blue-700/50 p-4 text-sm font-medium outline-none placeholder:text-blue-300"
                onChange={(event) => setParseText(event.target.value)}
                placeholder="Paste order details here..."
                value={parseText}
              />
              <div className="flex justify-end space-x-3">
                <button className="px-6 py-2 text-xs font-bold text-blue-200" onClick={() => setIsParsing(false)} type="button">
                  Cancel
                </button>
                <button
                  className="rounded bg-white px-8 py-2 text-xs font-black text-blue-600"
                  onClick={handleSmartExtract}
                  type="button"
                >
                  Extract Order
                </button>
              </div>
            </div>
          )}

          <div className="mx-auto mb-12 w-full max-w-[800px] border-b-8 border-blue-600 bg-white p-12 text-sm text-gray-800 shadow-xl">
            <CompanyHeader />

            <div className="mb-12 flex justify-between">
              <div className="w-1/3 border-r border-slate-100 pr-6">
                <label className="text-[10px] font-black uppercase text-gray-400">Customer Account:</label>
                <select
                  className="mt-1 w-full border-none bg-transparent p-0 text-xl font-black focus:ring-0"
                  onChange={(event) => setCustomerId(event.target.value)}
                  value={customerId}
                  disabled={!!existingInvoice} 
                >
                  <option value="">Select Entity...</option>
                  {sys.customers.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
                {autoFillNotif && (
                  <p className="mt-2 flex items-center text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    <Sparkles className="mr-1" size={12} /> Predictively Prefilled
                  </p>
                )}
              </div>

              <div className="w-1/3 border-r border-slate-100 px-6">
                <label className="text-[10px] font-black uppercase text-gray-400">Payment Terms:</label>
                <select
                  className="mt-1 w-full cursor-pointer border-none bg-transparent p-0 text-xl font-black text-slate-800 focus:ring-0"
                  onChange={(event) => setPaymentTerms(event.target.value)}
                  value={paymentTerms}
                >
                  <option value="30_days">30 Days Term</option>
                  <option value="cod">Cash on Delivery</option>
                </select>
              </div>

              <div className="w-1/3 pl-6 text-right">
                <label className="text-[10px] font-black uppercase text-gray-400">Serial No.</label>
                <p className="text-3xl font-black tracking-tighter text-red-600">#{generatedInvoiceNumber}</p>
              </div>
            </div>

            {suggestions.length > 0 && !existingInvoice && (
              <div className="mb-6 rounded border border-dashed border-blue-200 bg-blue-50/50 p-4">
                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-blue-400">
                  Secondary Recommendations (Occasional Buys)
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((item) => (
                    <button
                      className="rounded border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-bold text-blue-700 shadow-sm"
                      key={item.id}
                      onClick={() =>
                        setItems([
                          ...items,
                          {
                            itemId: item.id,
                            name: item.name || item.Items,
                            unit: item.unit || item.Unit || '箱',
                            qty: 1,
                            unitPrice: getSafePrice(item),
                            picked: false,
                          },
                        ])
                      }
                      type="button"
                    >
                      + {item.name || item.Items}
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
                {items.map((item, index) => (
                  <tr className="border-b border-gray-100 font-bold" key={`${item.itemId}-${index}`}>
                    <td className="p-4 text-center font-mono text-xs text-slate-300">{index + 1}</td>
                    
                    <td className="p-2 relative">
                      <div className="flex items-center space-x-2">
                        <input
                          checked={item.picked || false}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                          onChange={(event) => {
                            const nextItems = [...items];
                            nextItems[index].picked = event.target.checked;
                            setItems(nextItems);
                          }}
                          type="checkbox"
                        />
                        <ProductSearchSelect
                          value={item.itemId}
                          inventory={sys.inventory}
                          onChange={(selectedId) => {
                            const product = sys.inventory.find((entry) => entry.id === selectedId);
                            if (!product) return;
                            
                            const nextItems = [...items];
                            nextItems[index] = {
                              ...nextItems[index],
                              itemId: selectedId,
                              name: product.name || product.Items,
                              unit: product.unit || product.Unit || '箱',
                              unitPrice: getSafePrice(product),
                            };
                            setItems(nextItems);
                          }}
                        />
                      </div>
                    </td>

                    <td className="p-2">
                      <select
                        className="w-full border-none text-center text-xs font-bold focus:ring-0 bg-transparent"
                        onChange={(event) => {
                          const nextItems = [...items];
                          nextItems[index].unit = event.target.value;
                          setItems(nextItems);
                        }}
                        value={item.unit}
                      >
                        {UNIT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        className="w-full border-none bg-transparent p-1 text-center font-black text-blue-600 focus:ring-0"
                        onChange={(event) => {
                          const nextItems = [...items];
                          nextItems[index].qty = event.target.value;
                          setItems(nextItems);
                        }}
                        type="number"
                        value={item.qty}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        className="w-full border-none bg-transparent p-1 text-right font-black focus:ring-0"
                        onChange={(event) => {
                          const nextItems = [...items];
                          nextItems[index].unitPrice = event.target.value;
                          setItems(nextItems);
                        }}
                        step="0.01"
                        type="number"
                        value={item.unitPrice}
                      />
                    </td>
                    <td className="p-4 text-right font-mono text-lg font-black tracking-tighter text-slate-900">
                      ${formatMoney((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}
                    </td>
                    <td className="w-8 p-0">
                      <button
                        className="ml-2 text-red-200 hover:text-red-500"
                        onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}
                        type="button"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              className="mt-8 rounded bg-blue-50 px-5 py-2 text-[10px] font-bold uppercase text-blue-600 shadow-sm transition-all"
              onClick={() =>
                setItems([
                  ...items,
                  { itemId: '', name: '', unit: '箱', qty: 1, unitPrice: 0, picked: false },
                ])
              }
              type="button"
            >
              + Add Row Manually
            </button>

            <div className="mt-12 flex justify-end border-t-2 border-slate-900 pt-6">
              <div className="w-72 space-y-1">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <span>Sub-Total ($)</span>
                  <span className="text-slate-900">${formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <span>GST 9% Included</span>
                  <span className="text-slate-900">${formatMoney(gst)}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-black uppercase">Total Due</span>
                  <span className="text-3xl font-black tracking-tighter">${formatMoney(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 rounded-b-3xl border-t bg-white p-8 shadow-inner">
          <div className="flex justify-end space-x-4">
            <button
              className="px-8 py-3 text-sm font-black uppercase tracking-widest text-gray-400"
              onClick={onClose}
              type="button"
            >
              Discard
            </button>
            <button
              className="flex items-center rounded bg-indigo-600 px-10 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              disabled={!customerId || items.length === 0}
              onClick={() => setPreviewMode(true)}
              type="button"
            >
              <Eye className="mr-2" size={18} /> Preview Document
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
