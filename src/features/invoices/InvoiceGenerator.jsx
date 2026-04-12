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
// INVOICE PREVIEW COMPONENT (UPDATED LAYOUT)
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
        <div className="relative flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-white p-10 shadow-2xl print:w-full print:p-0 print:shadow-none">
          
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
            
            {/* EXACT MATCH HEADER */}
            <div className="flex justify-between items-start mb-4">
              <div className="w-[20%]">
                <img src={logo} alt="Three Leaves Logo" className="w-28 h-auto object-contain" />
              </div>

              <div className="w-[60%] text-center text-xs leading-tight pt-2">
                <h1 className="font-bold text-[15px] mb-1">THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
                <h2 className="font-bold text-[15px] mb-1">三叶（新加坡） 贸易公司</h2>
                <p className="font-bold text-[10px]">CO.REG NO.53033969B &nbsp;&nbsp;&nbsp; GST REG NO. M90355440L</p>
                <p className="text-[10px]">280 Woodlands Industrial Park E5 #06-35 Harvest @ Singapore 757322</p>
                <p className="font-bold text-[10px]">HP: 97578869 &nbsp; Tel: 67942592 &nbsp; Email: tl.sg@hotmail.com</p>
              </div>

              <div className="w-[20%] text-right pt-2">
                {/* Empty block to balance the logo flex space */}
              </div>
            </div>

            {/* CUSTOMER & INVOICE DETAILS ROW */}
            <div className="flex justify-between items-end mb-4 border-b-2 border-black pb-2">
              <div className="w-2/3 text-[13px] font-bold flex flex-col gap-1 pr-4">
                <div className="flex items-start">
                  <span className="w-20 shrink-0">TO:</span>
                  <span className="flex-1 uppercase">{customer?.name || ''}</span>
                </div>
              </div>
              <div className="w-1/3 text-right">
                <h2 className="text-2xl font-black tracking-widest uppercase mb-1">INVOICE</h2>
                <div className="flex justify-end gap-2 font-bold text-sm">
                  <span>No.</span>
                  <span className="text-red-600 font-mono tracking-wider">{invoiceNumber}</span>
                </div>
                <div className="flex justify-end gap-2 font-bold text-xs mt-1">
                  <span>DATE:</span>
                  <span>{new Date().toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            </div>

            {/* TABLE BODY (SOLID BORDERS) */}
            <table className="w-full text-xs border-2 border-black text-center mb-0">
              <thead className="border-b-2 border-black">
                <tr className="font-bold bg-white">
                  <th className="p-2 border-r-2 border-black w-12">NO.</th>
                  <th className="p-2 border-r-2 border-black text-left pl-4">DESCRIPTION</th>
                  <th className="p-2 border-r-2 border-black w-28">QUANTITY</th>
                  <th className="p-2 border-r-2 border-black w-32">UNIT PRICE</th>
                  <th className="p-2 w-32">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const foundProduct = sys.inventory.find((entry) => entry.id === item.itemId);
                  const productName = foundProduct ? (foundProduct.name || foundProduct.Items) : '-';

                  return (
                    <tr key={idx} className="h-8 border-b border-black/20 last:border-b-0">
                      <td className="p-1 border-r-2 border-black font-medium">{idx + 1}</td>
                      <td className="p-1 border-r-2 border-black text-left pl-4 font-bold">{productName}</td>
                      <td className="p-1 border-r-2 border-black font-medium">{item.qty} {item.unit}</td>
                      <td className="p-1 border-r-2 border-black text-right pr-4">${formatMoney(item.unitPrice)}</td>
                      <td className="p-1 text-right pr-4 font-bold">
                        ${formatMoney((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}
                      </td>
                    </tr>
                  );
                })}
                {/* Dynamically pad out rows to match the reference look */}
                {items.length < 12 && Array.from({ length: 12 - items.length }).map((_, i) => (
                  <tr key={`blank-${i}`} className="h-8 border-b border-black/20 last:border-b-0">
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* TOTALS GRID */}
            <div className="flex justify-end border-x-2 border-b-2 border-black">
              <table className="w-64 text-xs font-bold text-right bg-white">
                <tbody>
                  <tr className="border-b border-black/20">
                    <td className="p-2 border-r-2 border-black text-center">SUBTOTAL</td>
                    <td className="p-2 pr-4 w-32">${formatMoney(subtotal)}</td>
                  </tr>
                  <tr className="border-b border-black/20">
                    <td className="p-2 border-r-2 border-black text-center">9% GST</td>
                    <td className="p-2 pr-4">${formatMoney(gst)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r-2 border-black text-center text-sm">TOTAL</td>
                    <td className="p-2 pr-4 text-sm">${formatMoney(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* EXACT MATCH FOOTER */}
            <div className="mt-8 text-[11px] font-bold flex flex-col gap-1 flex-grow">
              <p>请在下午3点之前下单。之后将无法保证配送。</p>
              <p>Please order before 3pm. Delivery will not be guaranteed afterwards.</p>
              
              <div className="mt-4 flex flex-col gap-0.5">
                <p>UEN: 53033969B</p>
                <p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p>
                <p>A/C Number: 535-846562-001</p>
                <p>Bank Name: OCBC</p>
              </div>

              <p className="mt-4">所有付款方式必须支付给 Three Leaves (Singapore) Trading Enterprise</p>
              <p>All payments mode have to be made payable to Three Leaves (Singapore) Trading Enterprise.</p>
            </div>

            {/* SIGNATURE BLOCK */}
            <div className="border-t border-black mt-8 pt-2 w-48 text-center text-xs font-bold">
              Received By
            </div>

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
    const yy = String(date.getFullYear()).slice(-2); // e.g., '26'
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // e.g., '04'
    const prefix = `${yy}${mm}`;

    // Look at existing invoices to find the highest sequence this month
    const monthlyInvoices = sys.invoices.filter(inv => String(inv.number).startsWith(prefix));
    let maxSequence = 0;
    
    monthlyInvoices.forEach(inv => {
      const seqStr = String(inv.number).slice(4); // Extract the 'xxx' part
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
