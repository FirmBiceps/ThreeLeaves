import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { CompanyHeader } from '../../components/shared/CompanyHeader';
import { UNIT_OPTIONS } from '../../data/company';
import { formatMoney } from '../../utils/format';

// 1. IMPORT YOUR LOGO DIRECTLY HERE
// (Make sure three_leaves_logo.png is sitting in the exact same folder as this file!)
import logo from './three_leaves_logo.png';


function InvoicePreview({
  customer,
  gst,
  items,
  lastNumber,
  onBack,
  onRegister,
  paymentTerms,
  setItems,
  subtotal,
  sys,
  total,
}) {
  return (
    <div className="fixed inset-0 z-[3000] overflow-y-auto bg-slate-950/90 print:bg-white print:p-0">
      <div className="flex min-h-full justify-center py-24 print:py-0">
        <div className="relative flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-white p-12 shadow-2xl print:w-full print:p-0 print:shadow-none">
          
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
                <Printer className="mr-2" size={18} /> Authorize & Print
              </button>
            </div>
          </div>

          {/* --- PRINTABLE TEMPLATE --- */}
          <div id="printable-invoice" className="bg-white text-black font-sans w-full h-full flex flex-col pt-0">
            
            {/* HEADER ROW */}
            <div className="flex justify-between items-start mb-6">
              {/* Left: Logo */}
              <div className="w-1/4">
                <img src={logo} alt="Three Leaves Logo" className="w-32 h-auto" />
              </div>

              {/* Center: Company Details */}
              <div className="w-2/4 text-center text-[11px] leading-tight pt-2">
                <h1 className="font-bold text-lg mb-1">THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
                <h2 className="font-bold text-base mb-1">三叶（新加坡） 贸易公司</h2>
                <p className="font-bold">CO.REG NO.53033969B &nbsp;&nbsp;&nbsp; GST REG NO. M90355440L</p>
                <p>280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
                <p className="font-bold">HP: 97578869 (Mr Ye) &nbsp; HP: 91113505 (Min) &nbsp; Email: 3leaves.sg@gmail.com</p>
              </div>

              {/* Right: Invoice Number & Date */}
              <div className="w-1/4 flex flex-col items-end pt-2">
                <div className="w-full text-right">
                  <h2 className="text-xl font-bold tracking-widest uppercase">INVOICE</h2>
                  <div className="border-t-2 border-b-2 border-black py-1 my-1 flex justify-end gap-2">
                    <span className="font-bold text-sm">No.</span>
                    <span className="font-bold text-sm text-red-600">{lastNumber + 1}</span>
                  </div>
                  <div className="flex justify-end gap-2 font-bold text-xs">
                    <span>DATE:</span>
                    <span>{new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}</span>
                  </div>
                  <div className="flex justify-end gap-2 font-bold text-xs mt-1">
                    <span>Term:</span>
                    <span>{paymentTerms === 'cod' ? 'COD' : '30 Days'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CUSTOMER INFO ROW */}
            <div className="mb-4 text-sm font-bold flex flex-col gap-1">
              <div className="flex">
                <span className="w-20">TO:</span>
                <span className="border-b border-black flex-1 uppercase pb-1">{customer?.name || ''}</span>
              </div>
              <div className="flex">
                <span className="w-20">ADDRESS:</span>
                <span className="border-b border-black flex-1 uppercase pb-1">{customer?.address || ''}</span>
              </div>
            </div>

            {/* ITEM TABLE (REMOVED INNER GRID LINES) */}
            <table className="w-full text-sm border-2 border-black text-center mb-0">
              <thead className="border-b-2 border-black">
                <tr className="font-bold bg-white">
                  <th className="p-2 w-12">NO.</th>
                  <th className="p-2 text-left">DESCRIPTION</th>
                  <th className="p-2 w-24">QUANTITY</th>
                  <th className="p-2 w-32">UNIT PRICE</th>
                  <th className="p-2 w-32">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="h-7">
                    <td className="p-1">{idx + 1}</td>
                    <td className="p-1 text-left">
                      {sys.inventory.find((entry) => entry.id === item.itemId)?.name || '-'}
                    </td>
                    <td className="p-1">{item.qty} {item.unit}</td>
                    <td className="p-1 text-right">${formatMoney(item.unitPrice)}</td>
                    <td className="p-1 text-right pr-2">
                      ${formatMoney((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}
                    </td>
                  </tr>
                ))}
                {/* Dynamically add blank rows to pad out the space (minimum 15 rows) */}
                {items.length < 15 && Array.from({ length: 15 - items.length }).map((_, i) => (
                  <tr key={`blank-${i}`} className="h-7">
                    <td className="p-1"></td>
                    <td className="p-1"></td>
                    <td className="p-1"></td>
                    <td className="p-1"></td>
                    <td className="p-1"></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* TOTALS BOX */}
            <div className="flex justify-end mt-0">
              <table className="w-64 text-sm border-2 border-t-0 border-black text-right bg-white">
                <tbody>
                  <tr>
                    <td className="p-2 font-bold text-center">SUBTOTAL</td>
                    <td className="p-2 w-32 pr-2">${formatMoney(subtotal)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-center">9% GST</td>
                    <td className="p-2 pr-2">${formatMoney(gst)}</td>
                  </tr>
                  <tr className="border-t-2 border-black">
                    <td className="p-2 font-bold text-center">TOTAL</td>
                    <td className="p-2 font-bold pr-2">${formatMoney(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* FOOTER NOTES */}
            <div className="mt-8 text-[11px] font-bold flex flex-col gap-1 mt-auto pb-4">
              <p>请提前一天提交订单，同日送达的截止时间为下午12点前。每周日休息</p>
              <p>Please submit orders one day in advance. The cut-off time for same-day delivery is before 12 PM. Closed on Sundays</p>
              <p className="mt-2">UEN: 53033969B</p>
              <p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p>
            </div>

          </div>
          {/* --- END PRINTABLE TEMPLATE --- */}

        </div>
      </div>
    </div>
  );
}

export function InvoiceGenerator({ sys, onClose }) {
  const lastNumber = sys.invoices.length > 0 ? Number(sys.invoices[sys.invoices.length - 1].number) : 2604300;
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
            name: product.name,
            unit: stats.unit || product.unit,
            qty: Math.max(1, Math.round(stats.totalQty / stats.count)),
            unitPrice: sys.getApplicablePrice(itemId, customerId),
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
    if (!customerId) {
      return [];
    }
    const history = sys.invoices.filter((invoice) => invoice.customerId === customerId);
    if (history.length === 0) {
      return [];
    }

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
      const foundItem = sys.inventory.find((inventoryItem) =>
        line.toLowerCase().includes(inventoryItem.name.toLowerCase()),
      );

      if (foundItem) {
        nextDraftItems.push({
          itemId: foundItem.id,
          name: foundItem.name,
          unit: foundItem.unit,
          qty,
          unitPrice: sys.getApplicablePrice(foundItem.id, customerId),
          picked: false,
        });
      }
    });

    setItems(nextDraftItems);
    setIsParsing(false);
    setParseText('');
  };

  const handleRegister = (printAfter = false) => {
    const nextNumber = lastNumber + 1;
    const invoice = {
      id: `INV-${nextNumber}`,
      number: String(nextNumber),
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
        items={items}
        lastNumber={lastNumber}
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
                <label className="text-[10px] font-black uppercase text-gray-400">Next Serial No.</label>
                <p className="text-3xl font-black tracking-tighter text-red-600">#{lastNumber + 1}</p>
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
                            name: item.name,
                            unit: item.unit,
                            qty: 1,
                            unitPrice: sys.getApplicablePrice(item.id, customerId),
                            picked: false,
                          },
                        ])
                      }
                      type="button"
                    >
                      + {item.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <table className="w-full text-left">
              <thead className="border-y-2 border-slate-900 bg-slate-50">
                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <th className="w-12 p-4 text-center">No.</th>
                  <th className="p-4">Description</th>
                  <th className="w-24 p-4 text-center">Unit</th>
                  <th className="w-20 p-4 text-center">Qty</th>
                  <th className="w-28 p-4 text-right">Cost</th>
                  <th className="w-28 p-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr className="border-b border-gray-50 font-bold" key={`${item.itemId}-${index}`}>
                    <td className="p-4 text-center font-mono text-xs text-slate-300">{index + 1}</td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <input
                          checked={item.picked || false}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          onChange={(event) => {
                            const nextItems = [...items];
                            nextItems[index].picked = event.target.checked;
                            setItems(nextItems);
                          }}
                          type="checkbox"
                        />
                        <select
                          className="w-full border-none text-xs font-bold"
                          onChange={(event) => {
                            const product = sys.inventory.find((entry) => entry.id === event.target.value);
                            if (!product) {
                              return;
                            }
                            const nextItems = [...items];
                            nextItems[index] = {
                              ...nextItems[index],
                              itemId: event.target.value,
                              name: product.name,
                              unit: product.unit,
                              unitPrice: sys.getApplicablePrice(event.target.value, customerId),
                            };
                            setItems(nextItems);
                          }}
                          value={item.itemId}
                        >
                          <option value="">- Product -</option>
                          {sys.inventory.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full border-none text-center text-xs font-bold"
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
                    <td className="w-0 p-0">
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
