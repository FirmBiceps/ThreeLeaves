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
        <div className="absolute z-[5000] top-0 left-0 w-72 bg-white border border-blue-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center p-2 border-b border-slate-100 bg-slate-50">
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
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 border-b border-slate-50 last:border-0 transition-colors"
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
// INVOICE PREVIEW COMPONENT (HIGH DENSITY LAYOUT)
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
}) {
  return (
    <div className="fixed inset-0 z-[3000] overflow-y-auto bg-slate-950/90 print:bg-white print:p-0">
      <div className="flex min-h-full justify-center py-12 print:py-0">
        <div className="relative flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-white px-10 py-8 shadow-2xl print:w-full print:p-0 print:shadow-none">
          
          {/* Action Bar (Hidden when printing) */}
          <div className="absolute -top-16 left-0 right-0 flex items-center justify-between px-4 print:hidden">
            <button
              className="flex items-center rounded-xl bg-slate-800 px-6 py-2.5 font-bold text-white transition-all hover:bg-slate-700"
              onClick={onBack}
              type="button"
            >
              Edit Draft
            </button>
            <div className="flex space-x-3">
              <button
                className="flex items-center rounded-xl border border-slate-200 bg-white px-6 py-2.5 font-black text-slate-900 shadow-lg transition-all hover:bg-slate-100"
                onClick={() => onRegister(false)}
                type="button"
              >
                <Save className="mr-2" size={18} /> Save to History
              </button>
              <button
                className="flex items-center rounded-xl bg-blue-600 px-8 py-2.5 font-black text-white shadow-xl transition-all hover:bg-blue-700"
                onClick={() => onRegister(true)}
                type="button"
              >
                <Printer className="mr-2" size={18} /> Print
              </button>
            </div>
          </div>

          {/* --- PRINTABLE TEMPLATE --- */}
          <div id="printable-invoice" className="bg-white text-black font-sans w-full h-full flex flex-col pt-0">
            
            {/* HEADER ROW (Scaled down by 30%) */}
            <div className="flex justify-between items-start mb-3">
              <div className="w-[20%]">
                <img src={logo} alt="Three Leaves Logo" className="w-24 h-auto object-contain" />
              </div>

              <div className="w-[60%] text-center leading-[1.2] pt-1">
                <h1 className="font-bold text-[11px]">THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
                <h2 className="font-bold text-[11px] mb-0.5">三叶（新加坡） 贸易公司</h2>
                <p className="font-bold text-[8px]">CO.REG NO.53033969B &nbsp;&nbsp;&nbsp; GST REG NO. M90355440L</p>
                <p className="text-[8px]">280 Woodlands Industrial Park E5 #06-35 Harvest @ Singapore 757322</p>
                <p className="font-bold text-[8px]">HP: 97578869 &nbsp; Tel: 67942592 &nbsp; Email: tl.sg@hotmail.com</p>
              </div>

              <div className="w-[20%] text-right pt-2"></div>
            </div>

            {/* CUSTOMER & INVOICE DETAILS ROW */}
            <div className="flex justify-between items-end mb-2 border-b-2 border-black pb-1">
              <div className="w-2/3 text-xs font-bold flex flex-col gap-1 pr-4">
                <div className="flex items-start">
                  <span className="w-16 shrink-0">TO:</span>
                  <span className="flex-1 uppercase leading-tight">{customer?.name || ''}</span>
                </div>
              </div>
              <div className="w-1/3 text-right">
                <h2 className="text-lg font-black tracking-widest uppercase mb-1">INVOICE</h2>
                <div className="flex justify-end gap-2 font-bold text-xs">
                  <span>No.</span>
                  <span className="text-red-600 font-mono tracking-wider">{invoiceNumber}</span>
                </div>
                <div className="flex justify-end gap-2 font-bold text-[10px] mt-0.5">
                  <span>DATE:</span>
                  <span>{new Date().toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            </div>

            {/* TABLE (Products scaled up by 20%, fitting 25 items max) */}
            <table className="w-full text-[14px] border-2 border-black text-center mb-0 leading-tight">
              <thead className="border-b-2 border-black">
                <tr className="font-bold bg-white text-xs">
                  <th className="py-1 px-1 border-r-2 border-black w-10">NO.</th>
                  <th className="py-1 px-2 border-r-2 border-black text-left">DESCRIPTION</th>
                  <th className="py-1 px-1 border-r-2 border-black w-20">QTY</th>
                  <th className="py-1 px-1 border-r-2 border-black w-24">U.PRICE</th>
                  <th className="py-1 px-1 w-24">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const foundProduct = sys.inventory.find((entry) => entry.id === item.itemId);
                  const productName = foundProduct ? (foundProduct.name || foundProduct.Items) : '-';

                  return (
                    <tr key={idx} className="border-b border-black/20 h-[24px]">
                      <td className="p-0 border-r-2 border-black font-medium text-xs">{idx + 1}</td>
                      <td className="p-0 border-r-2 border-black text-left pl-2 font-bold truncate max-w-[200px]">{productName}</td>
                      <td className="p-0 border-r-2 border-black font-medium">{item.qty} {item.unit}</td>
                      <td className="p-0 border-r-2 border-black text-right pr-2">${formatMoney(item.unitPrice)}</td>
                      <td className="p-0 text-right pr-2 font-bold">
                        ${formatMoney((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}
                      </td>
                    </tr>
                  );
                })}
                {/* Dynamically pad out rows to ensure exactly 25 rows fit */}
                {items.length < 25 && Array.from({ length: 25 - items.length }).map((_, i) => (
                  <tr key={`blank-${i}`} className="border-b border-black/20 h-[24px]">
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
              
              {/* COMPACT FOOTER AND TOTALS (Merged directly into the table) */}
              <tfoot>
                <tr>
                  <td colSpan="3" rowSpan="3" className="border-r-2 border-black p-2 text-left align-top">
                    <div className="flex justify-between h-full">
                      {/* Left: Tucked Notes taking ~30% of horizontal page width */}
                      <div className="w-[48%] text-[8px] leading-[1.2] font-bold flex flex-col">
                        <p>请在下午3点之前下单。之后将无法保证配送。</p>
                        <p>Please order before 3pm. Delivery will not be guaranteed afterwards.</p>
                        <div className="mt-2">
                          <p>UEN: 53033969B</p>
                          <p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p>
                          <p>A/C Number: 535-846562-001</p>
                          <p>Bank Name: OCBC</p>
                        </div>
                        <p className="mt-2">所有付款方式必须支付给 Three Leaves (Singapore) Trading Enterprise</p>
                      </div>
                      
                      {/* Right: Signature Box */}
                      <div className="w-[35%] flex flex-col justify-end pb-2 pr-4">
                        <div className="border-t-[1.5px] border-black text-center text-[10px] font-bold pt-1">
                          Received By
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="border-r-2 border-b-2 border-black p-1 font-bold text-xs">SUBTOTAL</td>
                  <td className="border-b-2 border-black p-1 text-right pr-2 font-bold text-xs">${formatMoney(subtotal)}</td>
                </tr>
                <tr>
                  <td className="border-r-2 border-b-2 border-black p-1 font-bold text-xs">9% GST</td>
                  <td className="border-b-2 border-black p-1 text-right pr-2 font-bold text-xs">${formatMoney(gst)}</td>
                </tr>
                <tr>
                  <td className="border-r-2 border-black p-1 font-bold text-[14px]">TOTAL</td>
                  <td className="p-1 text-right pr-2 font-bold text-[14px]">${formatMoney(total)}</td>
                </tr>
              </tfoot>
            </table>

          </div>
          {/* --- END PRINTABLE TEMPLATE --- */}

        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN INVOICE GENERATOR COMPONENT
// ==========================================
export function InvoiceGenerator({ sys, onClose }) {
  // --- DYNAMIC YYMMXXX GENERATOR ---
  const generatedInvoiceNumber = useMemo(() => {
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
  }, [sys.invoices]);

  const [customerId, setCustomerId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30_days');
  const [items, setItems] = useState([]);
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
  }, [customerId, sys.invoices, sys.inventory]);

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
      id: `INV-${generatedInvoiceNumber}`,
      number: generatedInvoiceNumber,
      customerId,
      customer: customer.name,
      region: customer.region,
      date: new Date().toISOString().split('T')[0],
      items,
      total,
      status: 'Paid',
      paymentTerms,
    };

    const nextInventory = [...sys.inventory];
    items.forEach((item) => {
      const index = nextInventory.findIndex((entry) => entry.id === item.itemId);
      if (index > -1) {
        nextInventory[index].stock -= Number(item.qty) || 0;
      }
    });

    sys.setInventory(nextInventory);
    sys.setInvoices([...sys.invoices, invoice]);

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
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div className="flex h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-[48px] border border-white/20 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-slate-900 p-4 px-8 text-white">
          <div className="flex items-center space-x-3">
            <FileText className="text-blue-500" />
            <h2 className="text-sm font-black uppercase tracking-widest">Draft Invoice Workspace</h2>
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
            <div className="mb-8 rounded-[32px] bg-blue-600 p-8 text-white shadow-2xl">
              <h3 className="mb-2 flex items-center text-lg font-black">
                <Wand2 className="mr-3" size={24} /> Smart Order Extractor
              </h3>
              <textarea
                className="mb-4 h-32 w-full rounded-2xl border-2 border-blue-400 bg-blue-700/50 p-4 text-sm font-medium outline-none placeholder:text-blue-300"
                onChange={(event) => setParseText(event.target.value)}
                placeholder="Paste order details here..."
                value={parseText}
              />
              <div className="flex justify-end space-x-3">
                <button className="px-6 py-2 text-xs font-bold text-blue-200" onClick={() => setIsParsing(false)} type="button">
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-white px-8 py-2 text-xs font-black text-blue-600"
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

            {suggestions.length > 0 && (
              <div className="mb-6 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-4">
                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-blue-400">
                  Secondary Recommendations (Occasional Buys)
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((item) => (
                    <button
                      className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-bold text-blue-700 shadow-sm"
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
                  <tr className="border-b border-gray-50 font-bold" key={`${item.itemId}-${index}`}>
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
                        className="w-full border-none text-center text-xs font-bold focus:ring-0"
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
              className="mt-8 rounded-xl bg-blue-50 px-5 py-2 text-[9px] font-black uppercase text-blue-500 shadow-sm transition-all"
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

        <div className="shrink-0 rounded-t-3xl border-t bg-white p-10 shadow-inner">
          <div className="flex justify-end space-x-4">
            <button
              className="px-8 py-4 text-sm font-black uppercase tracking-widest text-gray-400"
              onClick={onClose}
              type="button"
            >
              Discard
            </button>
            <button
              className="flex items-center rounded-2xl bg-indigo-600 px-10 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
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
