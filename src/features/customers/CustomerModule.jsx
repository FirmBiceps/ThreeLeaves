import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  MapPin,
  Percent,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  UserMinus,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { EntityModal } from '../../components/shared/EntityModal';
import { formatMoney, formatMoneyWhole } from '../../utils/format';
import { UNIT_OPTIONS } from '../../data/company';
import { supabase } from '../../lib/supabaseClient';

const STATUS_STYLES = {
  active: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Active' },
  cooling: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: 'Cooling' },
  'at-risk': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', label: 'At Risk' },
  churned: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: 'Churned' },
  inactive: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', label: 'Inactive' },
};

// Existing customer-region choices are intentionally retained.
const REGION_OPTIONS = ['North', 'West', 'East', 'South', 'Central'];

const EMPTY_CUSTOMER = {
  name: '',
  contactPerson: '',
  contactNumber: '',
  address: '',
  region: 'North',
  payment_terms: '30_days',
  pricing_group_id: '',
  custom_prices: {},
  cash_gst_enabled: true,
};

const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';
const CASH_FETCH_PAGE_SIZE = 1000;
const ORDER_PAGE_SIZE = 20;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normaliseText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getCustomerName(customer) {
  return String(
    customer?.name || customer?.companyName || customer?.company_name ||
    customer?.customerName || customer?.customer_name || ''
  ).trim();
}

function getCustomerIdFromInvoice(invoice) {
  return invoice?.customerId ?? invoice?.customer_id ?? invoice?.customerID ?? null;
}

function getInvoiceCustomerName(invoice) {
  return String(
    invoice?.customer || invoice?.customerName || invoice?.customer_name ||
    invoice?.companyName || invoice?.company_name || ''
  ).trim();
}

function getInvoiceNumber(invoice) {
  return String(invoice?.number || invoice?.invoiceNumber || invoice?.invoice_number || invoice?.id || '').trim();
}

function getInvoiceDate(invoice) {
  return String(invoice?.date || '').trim();
}

function getInvoiceStatus(invoice) {
  return String(invoice?.status || 'Unpaid').trim();
}

function isInvoicePaid(invoice) {
  return getInvoiceStatus(invoice).toLowerCase() === 'paid';
}

function getInvoiceItems(invoice) {
  return Array.isArray(invoice?.items) ? invoice.items : [];
}

function getLineQty(item) {
  return toNumber(item?.qty ?? item?.quantity ?? 0);
}

function getLineUnitPrice(item) {
  return toNumber(item?.unitPrice ?? item?.unit_price ?? item?.price ?? item?.Price ?? 0);
}

function getItemsSubtotal(invoice) {
  return getInvoiceItems(invoice).reduce(
    (sum, item) => sum + getLineQty(item) * getLineUnitPrice(item),
    0
  );
}

function getStoredNumber(invoice, keys) {
  for (const key of keys) {
    const candidate = invoice?.[key];
    if (candidate !== null && candidate !== undefined && candidate !== '' && Number.isFinite(Number(candidate))) {
      return Number(candidate);
    }
  }
  return null;
}

function getInvoiceSubtotalExGst(invoice) {
  const storedSubtotal = getStoredNumber(invoice, ['subtotal_ex_gst', 'subtotalExGst', 'subtotal']);
  if (storedSubtotal !== null) return storedSubtotal;

  const items = getInvoiceItems(invoice);
  if (items.length > 0) return getItemsSubtotal(invoice);

  const total = getStoredNumber(invoice, ['total', 'amount_total', 'amountTotal']);
  const gst = getStoredNumber(invoice, ['gst_amount', 'gstAmount', 'gst']);
  if (total !== null && gst !== null) return Math.max(0, total - gst);
  if (total !== null && invoice?.includeGst === true) return total / 1.09;
  return total || 0;
}

function getInvoiceGst(invoice) {
  const storedGst = getStoredNumber(invoice, ['gst_amount', 'gstAmount', 'gst']);
  if (storedGst !== null) return storedGst;

  const total = getStoredNumber(invoice, ['total', 'amount_total', 'amountTotal']);
  const subtotal = getInvoiceSubtotalExGst(invoice);
  if (total !== null && total >= subtotal) return total - subtotal;
  return invoice?.includeGst === true ? subtotal * 0.09 : 0;
}

function getInvoiceTotal(invoice) {
  const storedTotal = getStoredNumber(invoice, ['total', 'amount_total', 'amountTotal']);
  if (storedTotal !== null) return storedTotal;
  return getInvoiceSubtotalExGst(invoice) + getInvoiceGst(invoice);
}

function getProductIdFromLine(item) {
  return item?.itemId ?? item?.item_id ?? item?.productId ?? item?.product_id ?? null;
}

function getProductName(product) {
  return String(
    product?.Name || product?.name || product?.Items || product?.item_name ||
    product?.description || 'Unknown Product'
  ).trim();
}

function getCatalogPrice(product) {
  return toNumber(
    product?.Price ?? product?.unitPrice ?? product?.['Unit Price (SG)'] ??
    product?.['Unit Price (SGD)'] ?? 0
  );
}

function getProductUnit(product) {
  return String(product?.Unit || product?.unit || '箱').trim() || '箱';
}

function getPaymentTermsLabel(value) {
  if (value === 'cod') return 'C.O.D';
  if (value === 'paynow') return 'PayNow';
  return '30 Days';
}

function getPaymentTermsClasses(value) {
  if (value === 'cod') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (value === 'paynow') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-indigo-200 bg-indigo-50 text-indigo-700';
}

function extractSingaporePostalCode(address) {
  const matches = [...String(address || '').matchAll(/(?:^|\D)(\d{6})(?!\d)/g)];
  return matches.length ? String(matches[matches.length - 1]?.[1] || '').trim() : '';
}

function getNavigateUrl(address) {
  const clean = String(address || '').trim();
  if (!clean) return '';
  const destination = /\bsingapore\b/i.test(clean) ? clean : `${clean}, Singapore`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

function parseInvoiceDate(dateString) {
  const value = String(dateString || '').trim();
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildCustomerInvoiceMap(invoices, customers) {
  const byId = new Map();
  const byName = new Map();
  const result = new Map();

  customers.forEach((customer) => {
    byId.set(String(customer.id), customer);
    const key = normaliseText(getCustomerName(customer));
    if (key && !byName.has(key)) byName.set(key, customer);
    result.set(String(customer.id), []);
  });

  invoices.forEach((invoice) => {
    const invoiceCustomerId = getCustomerIdFromInvoice(invoice);
    let customer = invoiceCustomerId !== null && invoiceCustomerId !== undefined
      ? byId.get(String(invoiceCustomerId)) || null
      : null;

    if (!customer) customer = byName.get(normaliseText(getInvoiceCustomerName(invoice))) || null;
    if (!customer) return;

    const key = String(customer.id);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(invoice);
  });

  return result;
}

function buildTransaction(invoice, type) {
  return {
    type,
    invoice,
    date: getInvoiceDate(invoice),
    number: getInvoiceNumber(invoice),
    total: getInvoiceTotal(invoice),
    status: getInvoiceStatus(invoice),
  };
}

function getAverageFrequency(transactions) {
  const dated = transactions
    .map((transaction) => ({ ...transaction, parsedDate: parseInvoiceDate(transaction.date) }))
    .filter((transaction) => transaction.parsedDate)
    .sort((a, b) => a.parsedDate - b.parsedDate);

  if (dated.length < 2) return null;

  const gaps = [];
  for (let index = 1; index < dated.length; index += 1) {
    gaps.push((dated[index].parsedDate - dated[index - 1].parsedDate) / (1000 * 60 * 60 * 24));
  }

  return Math.max(1, Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length));
}

function getTrendFromTransactions(transactions, now) {
  const recentStart = new Date(now);
  recentStart.setDate(recentStart.getDate() - 30);
  const priorStart = new Date(now);
  priorStart.setDate(priorStart.getDate() - 60);

  let recent = 0;
  let prior = 0;

  transactions.forEach((transaction) => {
    const date = parseInvoiceDate(transaction.date);
    if (!date) return;
    if (date >= recentStart && date <= now) recent += transaction.total;
    else if (date >= priorStart && date < recentStart) prior += transaction.total;
  });

  if (recent === 0 && prior === 0) return 'flat';
  if (prior === 0 && recent > 0) return 'growing';
  if (recent > prior * 1.2) return 'growing';
  if (recent < prior * 0.8) return 'declining';
  return 'flat';
}

function getTopItems(transactions, productById) {
  const counts = {};

  transactions.forEach((transaction) => {
    getInvoiceItems(transaction.invoice).forEach((line) => {
      const itemId = getProductIdFromLine(line);
      const product = itemId !== null && itemId !== undefined ? productById.get(String(itemId)) : null;
      const name = product ? getProductName(product) : String(line?.name || line?.description || itemId || 'Unknown');
      counts[name] = (counts[name] || 0) + getLineQty(line);
    });
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));
}

function getRuleParts(ruleKey) {
  return ruleKey.includes('|') ? ruleKey.split('|') : [ruleKey, '箱'];
}

function getDiscountData(catalogPrice, effectivePrice) {
  if (!(catalogPrice > 0) || !Number.isFinite(Number(effectivePrice))) return { amount: 0, percent: null };
  const amount = catalogPrice - Number(effectivePrice);
  return { amount, percent: (amount / catalogPrice) * 100 };
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const classes = toast.type === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : toast.type === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div className="fixed right-5 top-5 z-[9000] w-[min(420px,calc(100vw-40px))]">
      <div className={`rounded-2xl border px-4 py-3 shadow-2xl ${classes}`}>
        <div className="flex items-start gap-3">
          {toast.type === 'error' ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : toast.type === 'warning' ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">{toast.title}</p>
            {toast.message && <p className="mt-1 text-xs leading-5 opacity-80">{toast.message}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 opacity-60 hover:bg-white/50 hover:opacity-100"><X size={15} /></button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ isOpen, title, message, confirmLabel = 'Confirm', tone = 'red', isWorking = false, onCancel, onConfirm }) {
  if (!isOpen) return null;
  const buttonClass = tone === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : tone === 'amber' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700';

  return (
    <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone === 'blue' ? 'bg-blue-50 text-blue-600' : tone === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}><AlertTriangle size={21} /></div>
          <div><h3 className="text-lg font-black text-slate-900">{title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-500">{message}</p></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" disabled={isWorking} onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={isWorking} onClick={onConfirm} className={`rounded-xl px-4 py-2.5 text-xs font-black text-white shadow-sm disabled:opacity-50 ${buttonClass}`}>{isWorking ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subtext, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</p>{subtext && <p className="mt-1.5 text-xs leading-5 text-slate-500">{subtext}</p>}</div>
        <div className={`rounded-xl p-2.5 ${tones[tone] || tones.blue}`}><Icon size={19} /></div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return <span className={`${style.bg} ${style.text} ${style.border} inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider`}>{style.label}</span>;
}

function TrendBadge({ trend }) {
  if (trend === 'growing') return <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700"><TrendingUp size={11} className="mr-1" />Growing</span>;
  if (trend === 'declining') return <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-red-700"><TrendingDown size={11} className="mr-1" />Declining</span>;
  return <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-600"><ArrowRight size={11} className="mr-1" />Stable</span>;
}

// ============================================================================
// QUOTATION PREVIEW - existing 30-item-per-page behavior retained
// ============================================================================
function QuotationPreviewModal({ group, sys, onClose }) {
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const pricesList = Object.entries(group.prices || {}).map(([ruleKey, price]) => {
    const [itemId, unit] = getRuleParts(ruleKey);
    const product = safeInventory.find((entry) => String(entry.id) === String(itemId));
    return { name: getProductName(product), unit, price };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const ITEMS_PER_PAGE = 30;
  const pages = [];
  for (let index = 0; index < pricesList.length; index += ITEMS_PER_PAGE) pages.push(pricesList.slice(index, index + ITEMS_PER_PAGE));
  if (pages.length === 0) pages.push([]);

  return (
    <div className="fixed inset-0 z-[7000] overflow-y-auto bg-slate-950/90 print:bg-white print:p-0">
      <style type="text/css">{`
        @media print {
          @page { margin: 0 !important; size: A4; }
          html, body { margin:0 !important; padding:0 !important; background:white !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; height:auto !important; overflow:visible !important; }
          html, body, #root, html :has(#printable-quotation-spooler) { position:static !important; display:block !important; width:auto !important; height:auto !important; max-height:none !important; overflow:visible !important; padding:0 !important; margin:0 !important; background:white !important; }
          body * { visibility:hidden; }
          body *:not(:has(#printable-quotation-spooler)):not(#printable-quotation-spooler *) { position:absolute !important; height:0 !important; width:0 !important; margin:0 !important; padding:0 !important; overflow:hidden !important; border:none !important; }
          #printable-quotation-spooler, #printable-quotation-spooler * { visibility:visible; font-family:${CJK_FONT} !important; }
          #printable-quotation-spooler { position:static !important; width:210mm !important; height:auto !important; max-height:none !important; padding:0 !important; margin:0 !important; background:white !important; box-sizing:border-box !important; display:block !important; }
          .a4-quotation-page { page-break-after:always !important; break-after:always !important; width:210mm !important; height:297mm !important; padding:15mm !important; box-sizing:border-box !important; display:flex !important; flex-direction:column !important; justify-content:space-between !important; overflow:hidden !important; margin:0 !important; background:white !important; float:none !important; }
          tr, td, th { page-break-inside:avoid; break-inside:avoid; }
        }
      `}</style>

      <div className="flex min-h-full flex-col items-center py-12 print:block print:py-0">
        <div className="mb-4 flex w-full max-w-[210mm] shrink-0 items-center justify-between rounded-t-2xl border-b-4 border-emerald-500 bg-slate-900 px-8 py-4 text-white shadow-2xl print:hidden">
          <div className="flex items-center"><FileText size={24} className="mr-3 text-emerald-400" /><div><h2 className="text-sm font-black uppercase tracking-widest text-slate-200">A4 Quotation Preview</h2><p className="mt-0.5 text-lg font-bold leading-none text-white">{group.name}</p></div></div>
          <div className="flex items-center space-x-3"><button type="button" onClick={() => window.print()} className="flex items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-emerald-500"><Printer size={18} className="mr-2" />Print Document ({pages.length} Page{pages.length > 1 ? 's' : ''})</button><button type="button" onClick={onClose} className="ml-2 rounded-full bg-slate-800 p-2.5 hover:bg-slate-700"><X size={20} /></button></div>
        </div>

        <div id="printable-quotation-spooler" className="flex w-full shrink-0 flex-col items-center gap-8 print:block print:gap-0" style={{ fontFamily: CJK_FONT }}>
          {pages.map((pageItems, pageIndex) => (
            <div key={pageIndex} className="a4-quotation-page box-border flex h-[297mm] w-[210mm] shrink-0 flex-col justify-between rounded-2xl bg-white p-[15mm] text-black shadow-2xl print:rounded-none print:shadow-none" style={{ fontFamily: CJK_FONT }}>
              <div className="w-full shrink-0">
                <div className="mb-4 flex items-start justify-between border-b-2 border-black pb-4">
                  <div className="w-[20%]"><div className="rounded border-2 border-emerald-700 p-1 text-center text-[18px] font-black tracking-tighter text-emerald-700">THREE<br/>LEAVES</div></div>
                  <div className="w-[60%] pt-1 text-center leading-tight"><h1 className="text-[14px] font-bold">THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1><h2 className="mb-1 text-[13px] font-bold">三叶（新加坡） 贸易公司</h2><p className="mb-0.5 text-[10px] font-bold">CO.REG NO.53033969B &nbsp;&nbsp;&nbsp; GST REG NO. M90355440L</p><p className="mb-0.5 text-[10px]">280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p><p className="text-[10px]">HP: 97578869 (Mr Ye) &nbsp; HP: 91113505 (Min) &nbsp; Email: 3leaves.sg@gmail.com</p></div>
                  <div className="flex w-[20%] flex-col items-end pt-1"><div className="mb-1 w-full text-center"><h2 className="mb-0.5 text-[18px] font-bold leading-none tracking-[0.2em]">报价单</h2><h3 className="text-[12px] font-bold uppercase tracking-widest">QUOTATION</h3></div></div>
                </div>
                <div className="mb-2 flex items-end justify-between text-[13px] font-bold"><div className="flex w-[65%] items-end pr-4"><span className="w-16 shrink-0 text-[12px] text-slate-500">GROUP:</span><span className="flex-1 border-b border-black pb-0.5 text-[14px] font-black uppercase">{group.name}</span></div><div className="flex w-[35%] items-end justify-end pl-4"><span className="mr-2 w-12 shrink-0 text-right text-[12px] text-slate-500">DATE:</span><span className="w-24 border-b border-black pb-0.5 text-center">{today}</span></div></div>
              </div>

              <div className="my-2 flex w-full flex-1 flex-col justify-start overflow-hidden">
                <table className="w-full border-collapse border-2 border-black text-center text-[12px] leading-tight">
                  <thead className="border-b-2 border-black bg-slate-50"><tr className="h-[26px] font-bold text-slate-800"><th className="w-10 border-r border-black px-1">NO.</th><th className="border-r border-black px-2 text-left">DESCRIPTION (产品名称)</th><th className="w-20 border-r border-black px-1">UNIT</th><th className="w-28 px-1">UNIT PRICE</th></tr></thead>
                  <tbody className="divide-y divide-black">
                    {pageItems.map((item, index) => <tr key={`${item.name}-${item.unit}-${index}`} className="h-[25px]"><td className="border-r border-black px-1">{pageIndex * ITEMS_PER_PAGE + index + 1}</td><td className="max-w-[350px] truncate border-r border-black px-2 text-left font-bold">{item.name}</td><td className="border-r border-black px-1">{item.unit}</td><td className="px-1 font-black">${formatMoney(item.price)}</td></tr>)}
                    {pageItems.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - pageItems.length }).map((_, index) => <tr key={`blank-${index}`} className="h-[25px]"><td className="border-r border-black"/><td className="border-r border-black"/><td className="border-r border-black"/><td/></tr>)}
                  </tbody>
                </table>
              </div>

              <div className="mt-1 flex w-full shrink-0 items-end justify-between border-t border-slate-200 pt-3 text-[11px] font-bold leading-tight text-slate-600"><div><p className="mb-0.5 font-bold text-slate-800">Terms & Conditions:</p><ul className="list-disc space-y-0.5 pl-4 text-[10px]"><li>All prices quoted are in Singapore Dollars (SGD) and are subject to 9% GST.</li><li>This quotation is valid for 30 days from the date of issue.</li><li>Prices are strictly confidential and applicable only to assigned group members.</li></ul></div><div className="shrink-0 pb-0.5 text-right text-[10px] font-black tracking-widest text-slate-400">PAGE {pageIndex + 1} OF {pages.length}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductSearchSelect({ value, inventory, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const selectedProduct = safeInventory.find((entry) => String(entry.id) === String(value));
  const displayName = selectedProduct ? getProductName(selectedProduct) : '';
  const filtered = safeInventory.filter((item) => getProductName(item).toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 100);

  return (
    <div className="relative flex-1 text-left" ref={dropdownRef}>
      {!isOpen ? (
        <button type="button" onClick={() => { setIsOpen(true); setSearchTerm(''); }} className={`w-full rounded-lg border border-slate-200 bg-white p-2 text-left text-sm font-bold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${displayName ? 'text-slate-900' : 'text-slate-400'}`}>{displayName || '-- Search Product --'}</button>
      ) : (
        <div className="absolute left-0 top-0 z-[5000] w-full min-w-[300px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
          <div className="flex items-center border-b border-slate-200 bg-slate-50 p-2"><Search size={14} className="ml-1 mr-2 shrink-0 text-slate-400"/><input autoFocus type="text" className="w-full bg-transparent p-1 text-xs font-bold text-slate-800 outline-none" placeholder="Type to search..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)}/></div>
          <div className="max-h-64 overflow-y-auto">{filtered.length ? filtered.map((item) => <button key={item.id} type="button" className="flex w-full justify-between border-b border-slate-100 px-3 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-100" onClick={() => { onChange(item.id); setIsOpen(false); }}><span className="pr-4">{getProductName(item)}</span><span className="shrink-0 font-normal text-slate-400">Def: ${formatMoney(getCatalogPrice(item))}</span></button>) : <div className="p-4 text-center text-xs font-medium text-slate-400">No products found.</div>}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PRICING GROUP MANAGER
// Existing core pricing model is retained and only the UX / save flow is improved.
// ============================================================================
function PricingGroupManager({ sys, groups, setGroups, onClose, notify }) {
  const safeGroups = Array.isArray(groups) ? groups : [];
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];

  const productById = useMemo(() => {
    const map = new Map();
    safeInventory.forEach((product) => map.set(String(product.id), product));
    return map;
  }, [safeInventory]);

  const groupById = useMemo(() => {
    const map = new Map();
    safeGroups.forEach((group) => map.set(String(group.id), group));
    return map;
  }, [safeGroups]);

  const [activeGroupId, setActiveGroupId] = useState(safeGroups[0]?.id || null);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [pricingItem, setPricingItem] = useState('');
  const [pricingUnit, setPricingUnit] = useState('箱');
  const [pricingValue, setPricingValue] = useState('');
  const [activeTab, setActiveTab] = useState('rules');
  const [memberSearch, setMemberSearch] = useState('');
  const [showQuotation, setShowQuotation] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [ruleSearch, setRuleSearch] = useState('');
  const [ruleFilter, setRuleFilter] = useState('All');
  const [ruleSort, setRuleSort] = useState('name_asc');
  const [editingRuleKey, setEditingRuleKey] = useState('');
  const [editingRuleValue, setEditingRuleValue] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [pendingMemberMove, setPendingMemberMove] = useState(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState(null);

  const activeGroup = safeGroups.find((group) => String(group.id) === String(activeGroupId));

  useEffect(() => {
    if (activeGroupId && safeGroups.some((group) => String(group.id) === String(activeGroupId))) return;
    setActiveGroupId(safeGroups[0]?.id || null);
  }, [activeGroupId, safeGroups]);

  useEffect(() => {
    setSelectedMemberIds([]);
    setMemberSearch('');
    setEditingRuleKey('');
    setEditingRuleValue('');
  }, [activeGroupId]);

  const groupMembers = useMemo(
    () => safeCustomers.filter((customer) => String(customer.pricing_group_id || '') === String(activeGroupId || '')),
    [safeCustomers, activeGroupId]
  );

  const availableCustomers = useMemo(() => {
    const query = normaliseText(memberSearch);
    return safeCustomers.filter((customer) => {
      if (String(customer.pricing_group_id || '') === String(activeGroupId || '')) return false;
      if (!query) return true;
      return normaliseText(`${customer.name} ${customer.contactPerson || ''} ${customer.contactNumber || ''} ${customer.region || ''}`).includes(query);
    });
  }, [safeCustomers, activeGroupId, memberSearch]);

  const pricingRules = useMemo(() => {
    if (!activeGroup) return [];

    const rows = Object.entries(activeGroup.prices || {}).map(([ruleKey, price]) => {
      const [itemId, unit] = getRuleParts(ruleKey);
      const product = productById.get(String(itemId));
      const catalogPrice = getCatalogPrice(product);
      const groupPrice = toNumber(price);
      return {
        ruleKey,
        itemId,
        unit,
        product,
        productName: getProductName(product),
        catalogPrice,
        groupPrice,
        discount: getDiscountData(catalogPrice, groupPrice),
      };
    });

    const query = normaliseText(ruleSearch);
    const filtered = rows.filter((row) => {
      if (query && !normaliseText(`${row.productName} ${row.unit} ${row.itemId}`).includes(query)) return false;
      if (ruleFilter === 'Below Catalog') return row.catalogPrice > 0 && row.groupPrice < row.catalogPrice;
      if (ruleFilter === 'Above Catalog') return row.catalogPrice > 0 && row.groupPrice > row.catalogPrice;
      if (ruleFilter === 'No Catalog Match') return !row.product || row.catalogPrice <= 0;
      return true;
    });

    return filtered.sort((left, right) => {
      if (ruleSort === 'name_desc') return right.productName.localeCompare(left.productName);
      if (ruleSort === 'price_asc') return left.groupPrice - right.groupPrice;
      if (ruleSort === 'price_desc') return right.groupPrice - left.groupPrice;
      if (ruleSort === 'discount_desc') return (right.discount.percent ?? -Infinity) - (left.discount.percent ?? -Infinity);
      return left.productName.localeCompare(right.productName);
    });
  }, [activeGroup, productById, ruleSearch, ruleFilter, ruleSort]);

  const groupStats = useMemo(() => {
    if (!activeGroup) return { members: 0, rules: 0, averageDiscount: null };

    const discounts = Object.entries(activeGroup.prices || {}).map(([ruleKey, price]) => {
      const [itemId] = getRuleParts(ruleKey);
      const product = productById.get(String(itemId));
      const catalogPrice = getCatalogPrice(product);
      if (!(catalogPrice > 0)) return null;
      return ((catalogPrice - toNumber(price)) / catalogPrice) * 100;
    }).filter((value) => Number.isFinite(value));

    return {
      members: groupMembers.length,
      rules: Object.keys(activeGroup.prices || {}).length,
      averageDiscount: discounts.length ? discounts.reduce((sum, value) => sum + value, 0) / discounts.length : null,
    };
  }, [activeGroup, productById, groupMembers.length]);

  const saveGroupPrices = async (updatedPrices, successMessage) => {
    if (!activeGroup) return false;

    const { error } = await supabase.from('pricing_groups').update({ prices: updatedPrices }).eq('id', activeGroup.id);
    if (error) throw error;

    setGroups(safeGroups.map((group) => String(group.id) === String(activeGroup.id) ? { ...group, prices: updatedPrices } : group));
    if (successMessage) notify('success', 'Pricing updated', successMessage);
    return true;
  };

  const handleCreateGroup = async () => {
    const cleanName = newGroupName.trim();
    if (!cleanName) return;

    setIsWorking(true);
    try {
      const duplicate = safeGroups.some((group) => normaliseText(group.name) === normaliseText(cleanName));
      if (duplicate) notify('warning', 'Similar group already exists', 'Pricing-group names should be easy for staff to distinguish.');

      const newGroup = { id: `grp-${Date.now()}`, name: cleanName, prices: {} };
      const { error } = await supabase.from('pricing_groups').insert([newGroup]);
      if (error) throw error;

      setGroups([...safeGroups, newGroup]);
      setActiveGroupId(newGroup.id);
      setIsCreating(false);
      setNewGroupName('');
      setActiveTab('members');
      notify('success', 'Pricing group created', `${cleanName} is ready for customer assignments and pricing rules.`);
    } catch (error) {
      notify('error', 'Unable to create pricing group', error.message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleAddGroupPrice = async () => {
    const priceNumber = Number(pricingValue);
    if (!activeGroup || !pricingItem || !pricingUnit || !Number.isFinite(priceNumber) || priceNumber <= 0) {
      notify('warning', 'Check the pricing rule', 'Choose a product, unit and a price greater than zero.');
      return;
    }

    setIsWorking(true);
    try {
      const ruleKey = `${pricingItem}|${pricingUnit}`;
      await saveGroupPrices({ ...(activeGroup.prices || {}), [ruleKey]: priceNumber }, 'The group price has been saved without changing the pricing cascade.');
      setPricingItem('');
      setPricingValue('');
    } catch (error) {
      notify('error', 'Unable to save group price', error.message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleRemoveGroupPrice = async (ruleKey) => {
    if (!activeGroup) return;
    setIsWorking(true);
    try {
      const updatedPrices = { ...(activeGroup.prices || {}) };
      delete updatedPrices[ruleKey];
      await saveGroupPrices(updatedPrices, 'The group-specific rule was removed. Catalog pricing will apply unless an individual override exists.');
    } catch (error) {
      notify('error', 'Unable to remove group price', error.message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleSaveEditedRule = async () => {
    if (!activeGroup || !editingRuleKey) return;
    const priceNumber = Number(editingRuleValue);
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      notify('warning', 'Invalid group price', 'The group price must be greater than zero.');
      return;
    }

    setIsWorking(true);
    try {
      await saveGroupPrices({ ...(activeGroup.prices || {}), [editingRuleKey]: priceNumber }, 'The existing group rule was updated in place.');
      setEditingRuleKey('');
      setEditingRuleValue('');
    } catch (error) {
      notify('error', 'Unable to update group price', error.message);
    } finally {
      setIsWorking(false);
    }
  };

  const applyMemberMove = async (customerIds) => {
    if (!activeGroupId || !customerIds.length) return;
    setIsWorking(true);

    try {
      const { error } = await supabase.from('customers').update({ pricing_group_id: activeGroupId }).in('id', customerIds);
      if (error) throw error;

      sys.setCustomers(safeCustomers.map((customer) => customerIds.some((id) => String(id) === String(customer.id)) ? { ...customer, pricing_group_id: activeGroupId } : customer));
      setSelectedMemberIds([]);
      notify('success', 'Pricing-group membership updated', `${customerIds.length} customer${customerIds.length === 1 ? '' : 's'} assigned to ${activeGroup?.name || 'the selected group'}.`);
    } catch (error) {
      notify('error', 'Unable to update group membership', error.message);
    } finally {
      setIsWorking(false);
      setPendingMemberMove(null);
    }
  };

  const requestMemberMove = (customerIds) => {
    const selected = safeCustomers.filter((customer) => customerIds.some((id) => String(id) === String(customer.id)));
    const moving = selected.filter((customer) => customer.pricing_group_id && String(customer.pricing_group_id) !== String(activeGroupId));

    if (!moving.length) {
      void applyMemberMove(customerIds);
      return;
    }

    const examples = moving.slice(0, 4).map((customer) => `${customer.name} (${groupById.get(String(customer.pricing_group_id))?.name || 'another group'})`).join('\n');
    setPendingMemberMove({
      customerIds,
      message: `${moving.length} selected customer${moving.length === 1 ? ' is' : 's are'} already assigned to another pricing group.\n\n${examples}${moving.length > 4 ? '\n…' : ''}\n\nMoving them here preserves the existing one-group-per-customer pricing model.`,
    });
  };

  const handleRemoveMember = async (customerId) => {
    setIsWorking(true);
    try {
      const { error } = await supabase.from('customers').update({ pricing_group_id: null }).eq('id', customerId);
      if (error) throw error;

      sys.setCustomers(safeCustomers.map((customer) => String(customer.id) === String(customerId) ? { ...customer, pricing_group_id: null } : customer));
      notify('success', 'Customer removed from pricing group', 'The customer now falls back to individual overrides or catalog pricing.');
    } catch (error) {
      notify('error', 'Unable to remove group member', error.message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDeleteGroup = async () => {
    const group = pendingDeleteGroup;
    if (!group) return;

    setIsWorking(true);
    const affectedCustomers = safeCustomers.filter((customer) => String(customer.pricing_group_id || '') === String(group.id));

    try {
      if (affectedCustomers.length) {
        const { error: clearError } = await supabase.from('customers').update({ pricing_group_id: null }).in('id', affectedCustomers.map((customer) => customer.id));
        if (clearError) throw clearError;
      }

      const { error: deleteError } = await supabase.from('pricing_groups').delete().eq('id', group.id);
      if (deleteError) {
        if (affectedCustomers.length) {
          await supabase.from('customers').update({ pricing_group_id: group.id }).in('id', affectedCustomers.map((customer) => customer.id));
        }
        throw deleteError;
      }

      setGroups(safeGroups.filter((entry) => String(entry.id) !== String(group.id)));
      sys.setCustomers(safeCustomers.map((customer) => String(customer.pricing_group_id || '') === String(group.id) ? { ...customer, pricing_group_id: null } : customer));
      setActiveGroupId(null);
      notify('success', 'Pricing group deleted', 'Affected customers now fall back to individual overrides or catalog pricing.');
    } catch (error) {
      notify('error', 'Unable to delete pricing group', error.message);
    } finally {
      setIsWorking(false);
      setPendingDeleteGroup(null);
    }
  };

  const toggleSelectedMember = (customerId) => {
    setSelectedMemberIds((current) => current.some((id) => String(id) === String(customerId)) ? current.filter((id) => String(id) !== String(customerId)) : [...current, customerId]);
  };

  const selectAllVisible = () => {
    const visibleIds = availableCustomers.map((customer) => customer.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedMemberIds.some((selectedId) => String(selectedId) === String(id)));

    if (allSelected) {
      setSelectedMemberIds((current) => current.filter((selectedId) => !visibleIds.some((visibleId) => String(visibleId) === String(selectedId))));
    } else {
      setSelectedMemberIds((current) => {
        const next = [...current];
        visibleIds.forEach((id) => {
          if (!next.some((selectedId) => String(selectedId) === String(id))) next.push(id);
        });
        return next;
      });
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
        <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between bg-slate-900 px-6 py-4 text-white">
            <div><h2 className="flex items-center text-base font-black uppercase tracking-widest"><Layers size={18} className="mr-2 text-blue-400"/>Pricing Group Manager</h2><p className="mt-1 text-xs text-slate-400">Custom group pricing remains product + unit based. Individual customer overrides continue to take priority.</p></div>
            <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-800"><X size={20}/></button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <aside className="flex w-[320px] shrink-0 flex-col border-r border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 p-4">
                {isCreating ? (
                  <div className="space-y-2"><input type="text" autoFocus placeholder="e.g. Wholesale Tier A" className="w-full rounded-lg border border-slate-300 p-2 text-sm font-bold outline-none focus:border-blue-500" value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)}/><div className="flex gap-2"><button type="button" disabled={isWorking || !newGroupName.trim()} onClick={handleCreateGroup} className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{isWorking ? 'Saving…' : 'Save'}</button><button type="button" disabled={isWorking} onClick={() => { setIsCreating(false); setNewGroupName(''); }} className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Cancel</button></div></div>
                ) : (
                  <button type="button" onClick={() => setIsCreating(true)} className="flex w-full items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 py-3 text-sm font-bold text-blue-600 hover:bg-blue-100"><Plus size={16} className="mr-2"/>Create New Group</button>
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {safeGroups.map((group) => {
                  const memberCount = safeCustomers.filter((customer) => String(customer.pricing_group_id || '') === String(group.id)).length;
                  const ruleCount = Object.keys(group.prices || {}).length;
                  const isActive = String(activeGroupId) === String(group.id);
                  return (
                    <div key={group.id} role="button" tabIndex={0} onClick={() => setActiveGroupId(group.id)} onKeyDown={(event) => event.key === 'Enter' && setActiveGroupId(group.id)} className={`group flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 ${isActive ? 'bg-blue-600 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}>
                      <div className="min-w-0"><p className="truncate text-sm font-bold">{group.name}</p><p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>{memberCount} Member{memberCount !== 1 ? 's' : ''} · {ruleCount} Rule{ruleCount !== 1 ? 's' : ''}</p></div>
                      <button type="button" onClick={(event) => { event.stopPropagation(); setPendingDeleteGroup(group); }} className={`rounded-lg p-1.5 ${isActive ? 'text-blue-200 hover:bg-blue-700 hover:text-white' : 'text-slate-300 opacity-0 hover:bg-red-100 hover:text-red-600 group-hover:opacity-100'}`}><Trash2 size={14}/></button>
                    </div>
                  );
                })}
                {!safeGroups.length && !isCreating && <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center"><Layers size={24} className="mx-auto text-slate-300"/><p className="mt-3 text-xs font-black uppercase tracking-widest text-slate-400">No Groups Found</p></div>}
              </div>
            </aside>

            <main className="flex h-full flex-1 flex-col overflow-hidden bg-white">
              {activeGroup ? (
                <>
                  <div className="shrink-0 border-b border-slate-100 px-7 py-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div><h3 className="text-2xl font-black text-slate-900">{activeGroup.name}</h3><p className="mt-1 text-sm font-medium text-slate-500">Manage group pricing and customer membership without changing the existing pricing cascade.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{groupStats.members} Customers</span><span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700">{groupStats.rules} Price Rules</span>{groupStats.averageDiscount !== null && <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${groupStats.averageDiscount >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>Avg {groupStats.averageDiscount >= 0 ? 'Discount' : 'Premium'} {Math.abs(groupStats.averageDiscount).toFixed(1)}%</span>}</div></div>
                      <button type="button" onClick={() => setShowQuotation(true)} className="flex shrink-0 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-emerald-700 shadow-sm hover:bg-emerald-100"><Printer size={16} className="mr-2"/>PDF Quotation</button>
                    </div>
                    <div className="mt-5 flex gap-2"><button type="button" onClick={() => setActiveTab('rules')} className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest ${activeTab === 'rules' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><Tag className="mr-1.5 inline" size={14}/>Pricing Rules ({groupStats.rules})</button><button type="button" onClick={() => setActiveTab('members')} className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest ${activeTab === 'members' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><UsersIcon className="mr-1.5 inline" size={14}/>Group Members ({groupStats.members})</button></div>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                    {activeTab === 'rules' && (
                      <div className="mx-auto max-w-4xl space-y-5">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><ProductSearchSelect value={pricingItem} inventory={safeInventory} onChange={(selectedId) => { setPricingItem(selectedId); const product = productById.get(String(selectedId)); if (product) setPricingUnit(getProductUnit(product)); }}/><select className="w-full shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700 xl:w-24" value={pricingUnit} onChange={(event) => setPricingUnit(event.target.value)}>{UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}{pricingUnit && !UNIT_OPTIONS.find((option) => option.value === pricingUnit) && <option value={pricingUnit}>{pricingUnit}</option>}</select><div className="relative w-full shrink-0 xl:w-32"><span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span><input type="number" step="0.01" min="0" placeholder="0.00" className="w-full rounded-lg border border-slate-200 bg-white p-2 pl-7 text-sm font-bold" value={pricingValue} onChange={(event) => setPricingValue(event.target.value)}/></div><button type="button" disabled={isWorking || !pricingItem || !pricingValue} onClick={handleAddGroupPrice} className="flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"><Plus className="mr-2" size={14}/>Add / Update Rule</button></div></div>

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]"><div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"><Search size={15} className="mr-2 text-slate-400"/><input type="text" value={ruleSearch} onChange={(event) => setRuleSearch(event.target.value)} placeholder="Search product or unit..." className="w-full bg-transparent text-sm font-semibold outline-none"/></div><select value={ruleFilter} onChange={(event) => setRuleFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><option value="All">All Rules</option><option value="Below Catalog">Below Catalog</option><option value="Above Catalog">Above Catalog</option><option value="No Catalog Match">No Catalog Match</option></select><select value={ruleSort} onChange={(event) => setRuleSort(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><option value="name_asc">Product A-Z</option><option value="name_desc">Product Z-A</option><option value="price_asc">Price Low-High</option><option value="price_desc">Price High-Low</option><option value="discount_desc">Largest Discount</option></select></div>

                        <div className="space-y-3">
                          {!pricingRules.length ? <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-10 text-center"><Tag size={24} className="mx-auto text-slate-300"/><p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">No matching pricing rules</p></div> : pricingRules.map((row) => {
                            const isEditing = editingRuleKey === row.ruleKey;
                            return (
                              <div key={row.ruleKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-200">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-slate-800">{row.productName}</p><span className="rounded border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-black text-indigo-600">{row.unit}</span></div><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs"><span className="text-slate-500">Catalog: <b className="text-slate-700">${formatMoney(row.catalogPrice)}</b></span>{row.discount.percent !== null && <span className={row.discount.percent >= 0 ? 'font-bold text-emerald-600' : 'font-bold text-amber-600'}>{row.discount.percent >= 0 ? 'Discount' : 'Premium'} {Math.abs(row.discount.percent).toFixed(1)}%</span>}{!row.product && <span className="font-bold text-amber-600">Product not found in current inventory</span>}</div></div>
                                  <div className="flex shrink-0 items-center gap-3">
                                    {isEditing ? <><div className="relative w-32"><span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">$</span><input autoFocus type="number" min="0" step="0.01" value={editingRuleValue} onChange={(event) => setEditingRuleValue(event.target.value)} className="w-full rounded-lg border border-blue-300 py-2 pl-7 pr-2 text-sm font-black outline-none ring-2 ring-blue-100"/></div><button type="button" disabled={isWorking} onClick={handleSaveEditedRule} className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700"><Check size={16}/></button><button type="button" onClick={() => { setEditingRuleKey(''); setEditingRuleValue(''); }} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"><X size={16}/></button></> : <><div className="text-right"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Group Rate</p><p className="text-lg font-black text-slate-900">${formatMoney(row.groupPrice)}</p></div><button type="button" onClick={() => { setEditingRuleKey(row.ruleKey); setEditingRuleValue(String(row.groupPrice)); }} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Edit size={17}/></button><button type="button" disabled={isWorking} onClick={() => handleRemoveGroupPrice(row.ruleKey)} className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={17}/></button></>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeTab === 'members' && (
                      <div className="grid h-full grid-cols-1 gap-5 xl:grid-cols-2">
                        <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className="flex items-center justify-between bg-slate-900 p-3 text-xs font-bold uppercase tracking-widest text-white"><span>Enrolled Customers</span><span className="rounded bg-slate-700 px-2 py-0.5">{groupMembers.length}</span></div>
                          <div className="flex-1 space-y-1 overflow-y-auto p-2">{groupMembers.length ? groupMembers.map((member) => <div key={member.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{member.name}</p><p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">{member.region || 'No Region'}</p></div><button type="button" disabled={isWorking} onClick={() => handleRemoveMember(member.id)} className="ml-3 flex shrink-0 items-center rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold uppercase text-red-500 hover:bg-red-50"><UserMinus size={12} className="mr-1"/>Remove</button></div>) : <div className="px-4 py-12 text-center"><UsersIcon size={24} className="mx-auto text-slate-300"/><p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">No Members Yet</p></div>}</div>
                        </div>

                        <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className="border-b border-slate-200 bg-slate-100 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-widest text-slate-600">Available Customers</p>{selectedMemberIds.length > 0 && <button type="button" disabled={isWorking} onClick={() => requestMemberMove(selectedMemberIds)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-blue-700">Assign {selectedMemberIds.length}</button>}</div></div>
                          <div className="relative border-b border-slate-100 bg-slate-50 p-3"><Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"/><input type="text" placeholder="Search customer, phone or region..." value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm font-bold outline-none focus:border-blue-500"/></div>
                          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-[10px] font-bold text-slate-500"><button type="button" onClick={selectAllVisible} className="hover:text-blue-600">Select / clear visible</button><span>{availableCustomers.length} available</span></div>
                          <div className="flex-1 space-y-1 overflow-y-auto p-2">{availableCustomers.length ? availableCustomers.map((member) => {
                            const currentGroup = member.pricing_group_id ? groupById.get(String(member.pricing_group_id)) : null;
                            const selected = selectedMemberIds.some((id) => String(id) === String(member.id));
                            return <div key={member.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${selected ? 'border-blue-300 bg-blue-50' : 'border-transparent border-b-slate-100 hover:bg-slate-50'}`}><button type="button" onClick={() => toggleSelectedMember(member.id)} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}><Check size={12}/></button><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{member.name}</p><p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-widest text-slate-400">{currentGroup ? `Currently in: ${currentGroup.name}` : 'No Group Assigned'}</p></div><button type="button" disabled={isWorking} onClick={() => requestMemberMove([member.id])} className="shrink-0 rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase text-blue-600 hover:bg-blue-600 hover:text-white">{currentGroup ? 'Move Here' : 'Add'}</button></div>;
                          }) : <div className="px-4 py-12 text-center"><CheckCircle2 size={24} className="mx-auto text-emerald-300"/><p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">No matching customers</p></div>}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-slate-50 text-slate-400"><Layers size={48} className="mb-4 opacity-20"/><p className="text-sm font-bold uppercase tracking-widest">Select or Create a Pricing Group</p></div>
              )}
            </main>
          </div>
        </div>

        {showQuotation && activeGroup && <QuotationPreviewModal group={activeGroup} sys={sys} onClose={() => setShowQuotation(false)}/>} 
      </div>

      <ConfirmDialog isOpen={Boolean(pendingMemberMove)} title={`Move customer${pendingMemberMove?.customerIds?.length === 1 ? '' : 's'} to ${activeGroup?.name || 'this group'}?`} message={pendingMemberMove?.message || ''} confirmLabel="Move Customer" tone="blue" isWorking={isWorking} onCancel={() => setPendingMemberMove(null)} onConfirm={() => applyMemberMove(pendingMemberMove?.customerIds || [])}/>
      <ConfirmDialog isOpen={Boolean(pendingDeleteGroup)} title={`Delete ${pendingDeleteGroup?.name || 'pricing group'}?`} message={'This removes the pricing group itself. Customers assigned to it will fall back to individual overrides or catalog pricing.\n\nAll other pricing groups and pricing precedence remain unchanged.'} confirmLabel="Delete Group" tone="red" isWorking={isWorking} onCancel={() => setPendingDeleteGroup(null)} onConfirm={handleDeleteGroup}/>
    </>
  );
}

// ============================================================================
// CUSTOMER FORM
// ============================================================================
function CustomerFormModal({ initialValue, onClose, onSave, groups, existingCustomers }) {
  const [form, setForm] = useState({
    ...EMPTY_CUSTOMER,
    ...(initialValue || {}),
    cash_gst_enabled: initialValue?.cash_gst_enabled !== false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  const safeGroups = Array.isArray(groups) ? groups : [];
  const safeCustomers = Array.isArray(existingCustomers) ? existingCustomers : [];

  const duplicateCustomer = useMemo(() => {
    const key = normaliseText(form.name);
    if (!key) return null;
    return safeCustomers.find((customer) => String(customer.id) !== String(form.id || '') && normaliseText(customer.name) === key) || null;
  }, [safeCustomers, form.id, form.name]);

  const detectedPostalCode = useMemo(() => extractSingaporePostalCode(form.address), [form.address]);

  const handleSubmit = async () => {
    const cleanName = String(form.name || '').trim();
    if (!cleanName) {
      setValidationMessage('Company name is required.');
      return;
    }

    setValidationMessage('');
    setIsSaving(true);
    try {
      const success = await onSave({
        ...form,
        name: cleanName,
        contactPerson: String(form.contactPerson || '').trim(),
        contactNumber: String(form.contactNumber || '').trim(),
        address: String(form.address || '').trim(),
      });
      if (success !== false) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EntityModal onClose={onClose} onSave={handleSubmit} title={form.id ? 'Edit Customer' : 'New Customer Account'}>
      <div className="space-y-6">
        <section>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Customer</p>
          <label className="block"><span className="mb-1.5 block text-xs font-black text-slate-600">Company Name *</span><input className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Company Name" value={form.name}/></label>
          {duplicateCustomer && <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"><AlertTriangle size={14} className="mt-0.5 shrink-0"/><span>A customer named <b>{duplicateCustomer.name}</b> already exists. You may still save if this is a separate outlet or entity.</span></div>}
        </section>

        <section>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Contact</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-black text-slate-600">Contact Person</span><input className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))} placeholder="Contact Person" value={form.contactPerson}/></label><label><span className="mb-1.5 block text-xs font-black text-slate-600">Phone Number</span><input className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setForm((current) => ({ ...current, contactNumber: event.target.value }))} placeholder="Phone Number" value={form.contactNumber}/></label></div>
        </section>

        <section>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Delivery</p>
          <label><span className="mb-1.5 block text-xs font-black text-slate-600">Full Address</span><textarea className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Full Address" rows={3} value={form.address}/></label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-semibold text-slate-400">Logistics can extract a six-digit Singapore postal code directly from this address.</p>{detectedPostalCode && <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">Postal {detectedPostalCode}</span>}</div>
          <label className="mt-4 block"><span className="mb-1.5 block text-xs font-black text-slate-600">Region</span><select className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm" onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} value={form.region}>{REGION_OPTIONS.map((region) => <option key={region} value={region}>{region} Sector</option>)}</select></label>
        </section>

        <section>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Commercial Settings</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-black text-slate-600">Payment Terms</span><select className="w-full cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-sm" onChange={(event) => setForm((current) => ({ ...current, payment_terms: event.target.value }))} value={form.payment_terms || '30_days'}><option value="30_days">30 Days Credit</option><option value="cod">C.O.D</option><option value="paynow">PayNow</option></select></label><label><span className="mb-1.5 block text-xs font-black text-slate-600">Pricing Group</span><select className="w-full cursor-pointer rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm font-bold text-indigo-800 outline-none focus:ring-2 focus:ring-indigo-500" onChange={(event) => setForm((current) => ({ ...current, pricing_group_id: event.target.value }))} value={form.pricing_group_id || ''}><option value="">No Pricing Group</option>{safeGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>
        </section>

        <section>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cash Settings</p>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><Percent size={16} className="shrink-0 text-emerald-600"/><p className="text-sm font-black text-slate-800">Cash Invoice GST Default</p></div><p className="mt-1 text-xs font-medium leading-5 text-slate-500">Used automatically when this customer is selected in Cash. It can still be overridden on an individual Cash invoice.</p></div><button type="button" role="switch" aria-checked={form.cash_gst_enabled !== false} onClick={() => setForm((current) => ({ ...current, cash_gst_enabled: current.cash_gst_enabled === false }))} className={`relative h-8 w-14 shrink-0 rounded-full ${form.cash_gst_enabled !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${form.cash_gst_enabled !== false ? 'translate-x-7' : 'translate-x-1'}`}/></button></div><div className="mt-3 flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${form.cash_gst_enabled !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{form.cash_gst_enabled !== false ? 'GST 9% Applied' : 'No GST'}</span><span className="text-[10px] font-semibold text-slate-400">Cash-module default</span></div></div>
        </section>

        {validationMessage && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{validationMessage}</div>}
        {isSaving && <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500"><RefreshCw size={13} className="animate-spin"/>Saving customer…</div>}
      </div>
    </EntityModal>
  );
}

// ============================================================================
// CUSTOMER PRICING TAB - shows Catalog -> Group -> Individual -> Effective
// ============================================================================
function CustomerPricingTab({ selectedCustomer, assignedGroup, safeInventory, onAddPricingRule, onRemovePricingRule, isSavingPrice }) {
  const [pricingItem, setPricingItem] = useState('');
  const [pricingUnit, setPricingUnit] = useState('箱');
  const [pricingValue, setPricingValue] = useState('');
  const [pricingSearch, setPricingSearch] = useState('');
  const [pricingFilter, setPricingFilter] = useState('All');

  const customPrices = selectedCustomer.customer.custom_prices || {};
  const groupPrices = assignedGroup?.prices || {};

  const productById = useMemo(() => {
    const map = new Map();
    safeInventory.forEach((product) => map.set(String(product.id), product));
    return map;
  }, [safeInventory]);

  const pricingRows = useMemo(() => {
    const keys = new Set([...Object.keys(customPrices), ...Object.keys(groupPrices)]);

    if (pricingSearch.trim()) {
      safeInventory.forEach((product) => {
        if (normaliseText(getProductName(product)).includes(normaliseText(pricingSearch))) keys.add(`${product.id}|${getProductUnit(product)}`);
      });
    }

    return [...keys].map((ruleKey) => {
      const [itemId, unit] = getRuleParts(ruleKey);
      const product = productById.get(String(itemId));
      const catalogPrice = getCatalogPrice(product);
      const customPrice = customPrices[ruleKey] !== undefined ? toNumber(customPrices[ruleKey]) : null;
      const groupPrice = groupPrices[ruleKey] !== undefined ? toNumber(groupPrices[ruleKey]) : null;
      const effectivePrice = customPrice !== null ? customPrice : groupPrice !== null ? groupPrice : catalogPrice;
      const source = customPrice !== null ? 'Individual' : groupPrice !== null ? 'Group' : 'Catalog';
      return { ruleKey, itemId, unit, product, productName: getProductName(product), catalogPrice, customPrice, groupPrice, effectivePrice, source, discount: getDiscountData(catalogPrice, effectivePrice) };
    }).filter((row) => {
      const query = normaliseText(pricingSearch);
      if (query && !normaliseText(`${row.productName} ${row.unit} ${row.itemId}`).includes(query)) return false;
      if (pricingFilter === 'Individual') return row.customPrice !== null;
      if (pricingFilter === 'Group') return row.customPrice === null && row.groupPrice !== null;
      if (pricingFilter === 'Catalog') return row.customPrice === null && row.groupPrice === null;
      return true;
    }).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [customPrices, groupPrices, pricingSearch, pricingFilter, safeInventory, productById]);

  const handleSaveOverride = async () => {
    const success = await onAddPricingRule(pricingItem, pricingUnit, pricingValue);
    if (success) {
      setPricingItem('');
      setPricingValue('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="flex items-center text-sm font-black uppercase tracking-widest text-blue-800"><Tag size={17} className="mr-2 text-blue-500"/>Effective Pricing Cascade</h3><p className="mt-2 text-xs leading-5 text-blue-700">Catalog is the base. Pricing Group custom prices apply next. Individual customer overrides remain the highest-priority price.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">Catalog Base</span><span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700">Group: {assignedGroup?.name || 'None'}</span><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">Individual Override Wins</span></div></div></div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Add or Update Individual Override</p><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><ProductSearchSelect value={pricingItem} inventory={safeInventory} onChange={(selectedId) => { setPricingItem(selectedId); const product = productById.get(String(selectedId)); if (product) setPricingUnit(getProductUnit(product)); }}/><select className="w-full shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700 xl:w-24" value={pricingUnit} onChange={(event) => setPricingUnit(event.target.value)}>{UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}{pricingUnit && !UNIT_OPTIONS.find((option) => option.value === pricingUnit) && <option value={pricingUnit}>{pricingUnit}</option>}</select><div className="relative w-full shrink-0 xl:w-32"><span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span><input type="number" step="0.01" min="0" placeholder="0.00" className="w-full rounded-lg border border-slate-200 bg-white p-2 pl-7 text-sm font-bold text-slate-900" value={pricingValue} onChange={(event) => setPricingValue(event.target.value)}/></div><button type="button" disabled={isSavingPrice || !pricingItem || !pricingValue} onClick={handleSaveOverride} className="flex shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"><Save className="mr-2" size={14}/>{isSavingPrice ? 'Saving…' : 'Lock Individual Override'}</button></div></div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]"><div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"><Search size={15} className="mr-2 text-slate-400"/><input type="text" value={pricingSearch} onChange={(event) => setPricingSearch(event.target.value)} placeholder="Search effective customer pricing..." className="w-full bg-transparent text-sm font-semibold outline-none"/></div><select value={pricingFilter} onChange={(event) => setPricingFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><option value="All">All Pricing Layers</option><option value="Individual">Individual Overrides</option><option value="Group">Inherited Group Prices</option><option value="Catalog">Catalog Only</option></select></div>

      {!pricingRows.length ? <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center"><Tag size={24} className="mx-auto text-slate-300"/><p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">No pricing rows match</p><p className="mt-1 text-xs text-slate-400">Search for a catalog product or add a customer override above.</p></div> : <div className="space-y-3">{pricingRows.map((row) => <div key={row.ruleKey} className={`rounded-2xl border bg-white p-4 shadow-sm ${row.source === 'Individual' ? 'border-emerald-200' : row.source === 'Group' ? 'border-indigo-200' : 'border-slate-200'}`}><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-slate-800">{row.productName}</p><span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-black text-slate-600">{row.unit}</span><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${row.source === 'Individual' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : row.source === 'Group' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>Effective: {row.source}</span></div>{!row.product && <p className="mt-2 text-xs font-bold text-amber-600">This pricing rule points to a product that is no longer present in the current inventory list.</p>}</div><div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[560px]"><div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Catalog</p><p className="mt-1 font-mono text-sm font-black text-slate-700">${formatMoney(row.catalogPrice)}</p></div><div className="rounded-xl bg-indigo-50 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-wider text-indigo-400">Group</p><p className="mt-1 font-mono text-sm font-black text-indigo-700">{row.groupPrice === null ? '—' : `$${formatMoney(row.groupPrice)}`}</p></div><div className="rounded-xl bg-emerald-50 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Individual</p><p className="mt-1 font-mono text-sm font-black text-emerald-700">{row.customPrice === null ? '—' : `$${formatMoney(row.customPrice)}`}</p></div><div className="rounded-xl bg-slate-900 px-3 py-2 text-white"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Effective</p><p className="mt-1 font-mono text-sm font-black">${formatMoney(row.effectivePrice)}</p></div></div><div className="flex shrink-0 items-center gap-2">{row.discount.percent !== null && <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${row.discount.percent >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{row.discount.percent >= 0 ? 'Save' : 'Premium'} {Math.abs(row.discount.percent).toFixed(1)}%</span>}{row.customPrice !== null && <button type="button" disabled={isSavingPrice} onClick={() => onRemovePricingRule(row.ruleKey)} className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={17}/></button>}</div></div></div>)}</div>}
    </div>
  );
}

// ============================================================================
// MAIN CUSTOMER MODULE
// ============================================================================
export function CustomerModule({ sys }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(EMPTY_CUSTOMER);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const [gstFilter, setGstFilter] = useState('All');
  const [sortOption, setSortOption] = useState('rank');

  const [pricingGroups, setPricingGroups] = useState([]);
  const [cashInvoices, setCashInvoices] = useState([]);
  const [cashLoading, setCashLoading] = useState(true);
  const [cashError, setCashError] = useState('');

  const [orderTypeFilter, setOrderTypeFilter] = useState('All');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPage, setOrderPage] = useState(1);

  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [pendingDeleteCustomer, setPendingDeleteCustomer] = useState(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);

  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];
  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];

  const notify = (type, title, message = '') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ type, title, message, id: Date.now() });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchGroups = async () => {
      try {
        const { data, error } = await supabase.from('pricing_groups').select('*').order('name', { ascending: true });
        if (error) throw error;
        if (!cancelled) setPricingGroups(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching pricing groups:', error);
          notify('error', 'Pricing groups could not be loaded', error.message);
        }
      }
    };

    void fetchGroups();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchAllCashInvoices = async () => {
      setCashLoading(true);
      setCashError('');

      try {
        const collected = [];
        let from = 0;

        while (true) {
          const to = from + CASH_FETCH_PAGE_SIZE - 1;
          const { data, error } = await supabase.from('cash_invoices').select('*').order('date', { ascending: false }).order('number', { ascending: false }).range(from, to);
          if (error) throw error;

          const batch = Array.isArray(data) ? data : [];
          collected.push(...batch);
          if (batch.length < CASH_FETCH_PAGE_SIZE) break;
          from += CASH_FETCH_PAGE_SIZE;
        }

        if (!cancelled) setCashInvoices(collected);
      } catch (error) {
        console.error('Error fetching Cash customer activity:', error);
        if (!cancelled) {
          setCashInvoices([]);
          setCashError(error.message || 'Unable to load Cash invoices.');
        }
      } finally {
        if (!cancelled) setCashLoading(false);
      }
    };

    void fetchAllCashInvoices();
    return () => { cancelled = true; };
  }, []);

  const productById = useMemo(() => {
    const map = new Map();
    safeInventory.forEach((product) => map.set(String(product.id), product));
    return map;
  }, [safeInventory]);

  const pricingGroupById = useMemo(() => {
    const map = new Map();
    pricingGroups.forEach((group) => map.set(String(group.id), group));
    return map;
  }, [pricingGroups]);

  const normalInvoicesByCustomer = useMemo(
    () => buildCustomerInvoiceMap(safeInvoices, safeCustomers),
    [safeInvoices, safeCustomers]
  );

  const cashInvoicesByCustomer = useMemo(
    () => buildCustomerInvoiceMap(cashInvoices, safeCustomers),
    [cashInvoices, safeCustomers]
  );

  const analytics = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const entries = safeCustomers.map((customer) => {
      const key = String(customer.id);
      const normalInvoices = normalInvoicesByCustomer.get(key) || [];
      const customerCashInvoices = cashInvoicesByCustomer.get(key) || [];
      const normalTransactions = normalInvoices.map((invoice) => buildTransaction(invoice, 'Normal'));
      const cashTransactions = customerCashInvoices.map((invoice) => buildTransaction(invoice, 'Cash'));
      const chronological = [...normalTransactions, ...cashTransactions].sort((a, b) => a.date.localeCompare(b.date));
      const newestFirst = [...chronological].sort((a, b) => b.date.localeCompare(a.date));

      const normalRevenue = normalTransactions.reduce((sum, transaction) => sum + transaction.total, 0);
      const cashRevenue = cashTransactions.reduce((sum, transaction) => sum + transaction.total, 0);
      const totalRevenue = normalRevenue + cashRevenue;
      const orderCount = chronological.length;
      const avgValue = orderCount ? totalRevenue / orderCount : 0;
      const avgFrequency = getAverageFrequency(chronological);

      let status = 'inactive';
      let daysSinceLast = 999;
      let lastOrderDate = '';

      if (chronological.length) {
        lastOrderDate = chronological[chronological.length - 1].date;
        const lastDate = parseInvoiceDate(lastOrderDate);
        if (lastDate) {
          daysSinceLast = Math.max(0, Math.floor((now - lastDate) / (1000 * 60 * 60 * 24)));
          status = 'active';
          if (daysSinceLast > 90) status = 'churned';
          else if (daysSinceLast > 45) status = 'at-risk';
          else if (daysSinceLast > 21 && avgFrequency && daysSinceLast > avgFrequency * 1.5) status = 'cooling';
        }
      }

      const trend = getTrendFromTransactions(chronological, now);
      const topItems = getTopItems(chronological, productById);
      const normalOutstanding = normalTransactions.filter((transaction) => !isInvoicePaid(transaction.invoice)).reduce((sum, transaction) => sum + transaction.total, 0);
      const cashOutstanding = cashTransactions.filter((transaction) => !isInvoicePaid(transaction.invoice)).reduce((sum, transaction) => sum + transaction.total, 0);
      const currentMonthRevenue = chronological.filter((transaction) => transaction.date.startsWith(`${currentMonthKey}-`)).reduce((sum, transaction) => sum + transaction.total, 0);

      return {
        customer,
        normalInvoices,
        cashInvoices: customerCashInvoices,
        normalTransactions,
        cashTransactions,
        transactions: newestFirst,
        normalRevenue,
        cashRevenue,
        totalRevenue,
        currentMonthRevenue,
        orderCount,
        normalOrderCount: normalTransactions.length,
        cashOrderCount: cashTransactions.length,
        avgValue,
        daysSinceLast,
        avgFrequency,
        status,
        trend,
        topItems,
        lastOrderDate,
        normalOutstanding,
        cashOutstanding,
        totalOutstanding: normalOutstanding + cashOutstanding,
      };
    });

    return entries
      .sort((left, right) => right.totalRevenue !== left.totalRevenue ? right.totalRevenue - left.totalRevenue : getCustomerName(left.customer).localeCompare(getCustomerName(right.customer)))
      .map((entry, index) => ({ ...entry, globalRank: index + 1 }));
  }, [safeCustomers, normalInvoicesByCustomer, cashInvoicesByCustomer, productById]);

  const customerSummary = useMemo(() => ({
    total: analytics.length,
    active: analytics.filter((entry) => entry.status === 'active').length,
    needsAttention: analytics.filter((entry) => ['cooling', 'at-risk', 'churned'].includes(entry.status)).length,
    monthSales: analytics.reduce((sum, entry) => sum + entry.currentMonthRevenue, 0),
  }), [analytics]);

  const displayList = useMemo(() => {
    const query = normaliseText(searchTerm);

    const filtered = analytics.filter((entry) => {
      const customer = entry.customer;
      const group = customer.pricing_group_id ? pricingGroupById.get(String(customer.pricing_group_id)) : null;
      const haystack = [customer.id, customer.name, customer.contactPerson, customer.contactNumber, customer.address, customer.region, group?.name].map(normaliseText).join(' ');

      const matchesSearch = !query || haystack.includes(query);
      let matchesStatus = true;
      if (statusFilter === 'Stagnant') matchesStatus = ['at-risk', 'churned', 'cooling'].includes(entry.status);
      else if (statusFilter !== 'All') {
        const map = { Active: 'active', Cooling: 'cooling', 'At Risk': 'at-risk', Churned: 'churned', Inactive: 'inactive' };
        matchesStatus = entry.status === map[statusFilter];
      }

      const matchesRegion = regionFilter === 'All' || customer.region === regionFilter;
      const matchesPayment = paymentFilter === 'All' || customer.payment_terms === paymentFilter;
      const matchesGroup = groupFilter === 'All' ? true : groupFilter === 'None' ? !customer.pricing_group_id : String(customer.pricing_group_id || '') === String(groupFilter);
      const matchesGst = gstFilter === 'All' ? true : gstFilter === 'GST' ? customer.cash_gst_enabled !== false : customer.cash_gst_enabled === false;

      return matchesSearch && matchesStatus && matchesRegion && matchesPayment && matchesGroup && matchesGst;
    });

    return [...filtered].sort((left, right) => {
      if (sortOption === 'revenue_desc') return right.totalRevenue - left.totalRevenue;
      if (sortOption === 'revenue_asc') return left.totalRevenue - right.totalRevenue;
      if (sortOption === 'name_asc') return getCustomerName(left.customer).localeCompare(getCustomerName(right.customer));
      if (sortOption === 'name_desc') return getCustomerName(right.customer).localeCompare(getCustomerName(left.customer));
      if (sortOption === 'recent') return String(right.lastOrderDate || '').localeCompare(String(left.lastOrderDate || ''));
      if (sortOption === 'oldest') return String(left.lastOrderDate || '9999').localeCompare(String(right.lastOrderDate || '9999'));
      return left.globalRank - right.globalRank;
    });
  }, [analytics, searchTerm, statusFilter, regionFilter, paymentFilter, groupFilter, gstFilter, sortOption, pricingGroupById]);

  const selectedCustomer = useMemo(
    () => analytics.find((entry) => String(entry.customer.id) === String(selectedCustomerId)) || null,
    [analytics, selectedCustomerId]
  );

  const assignedGroup = selectedCustomer?.customer?.pricing_group_id
    ? pricingGroupById.get(String(selectedCustomer.customer.pricing_group_id))
    : null;

  const activeFilterCount = [
    statusFilter !== 'All', regionFilter !== 'All', paymentFilter !== 'All',
    groupFilter !== 'All', gstFilter !== 'All', sortOption !== 'rank',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setStatusFilter('All');
    setRegionFilter('All');
    setPaymentFilter('All');
    setGroupFilter('All');
    setGstFilter('All');
    setSortOption('rank');
  };

  const handleSave = async (form) => {
    try {
      const cashGstEnabled = form?.cash_gst_enabled !== false;

      if (form.id) {
        const updatedForm = { ...form, cash_gst_enabled: cashGstEnabled };
        const { error } = await supabase.from('customers').update({
          name: updatedForm.name,
          address: updatedForm.address,
          region: updatedForm.region,
          payment_terms: updatedForm.payment_terms,
          pricing_group_id: updatedForm.pricing_group_id,
          contactPerson: updatedForm.contactPerson,
          contactNumber: updatedForm.contactNumber,
          cash_gst_enabled: updatedForm.cash_gst_enabled,
        }).eq('id', updatedForm.id);
        if (error) throw error;

        sys.setCustomers(safeCustomers.map((customer) => String(customer.id) === String(updatedForm.id) ? { ...customer, ...updatedForm } : customer));
        notify('success', 'Customer updated', `${updatedForm.name} has been saved.`);
      } else {
        const newCustomer = { ...form, id: `c${Date.now()}`, custom_prices: {}, cash_gst_enabled: cashGstEnabled };
        const { error } = await supabase.from('customers').insert([newCustomer]);
        if (error) throw error;
        sys.setCustomers([...safeCustomers, newCustomer]);
        notify('success', 'Customer created', `${newCustomer.name} is now available throughout the ERP.`);
      }

      setIsOpen(false);
      setEditingCustomer(EMPTY_CUSTOMER);
      return true;
    } catch (error) {
      notify('error', 'Unable to save customer', error.message);
      return false;
    }
  };

  const handleAddPricingRule = async (pricingItem, pricingUnit, pricingValue) => {
    if (!selectedCustomer) return false;
    const priceNumber = Number(pricingValue);

    if (!pricingItem || !pricingUnit || !Number.isFinite(priceNumber) || priceNumber <= 0) {
      notify('warning', 'Check the individual price', 'Choose a product, unit and price greater than zero.');
      return false;
    }

    setIsSavingPrice(true);
    try {
      const ruleKey = `${pricingItem}|${pricingUnit}`;
      const updatedCustomPrices = { ...(selectedCustomer.customer.custom_prices || {}), [ruleKey]: priceNumber };
      const { error } = await supabase.from('customers').update({ custom_prices: updatedCustomPrices }).eq('id', selectedCustomer.customer.id);
      if (error) throw error;

      const updatedCustomer = { ...selectedCustomer.customer, custom_prices: updatedCustomPrices };
      sys.setCustomers(safeCustomers.map((customer) => String(customer.id) === String(updatedCustomer.id) ? updatedCustomer : customer));
      notify('success', 'Individual price saved', 'This customer override remains higher priority than the Pricing Group price.');
      return true;
    } catch (error) {
      notify('error', 'Unable to save individual price', error.message);
      return false;
    } finally {
      setIsSavingPrice(false);
    }
  };

  const handleRemovePricingRule = async (ruleKey) => {
    if (!selectedCustomer) return;
    setIsSavingPrice(true);

    try {
      const updatedCustomPrices = { ...(selectedCustomer.customer.custom_prices || {}) };
      delete updatedCustomPrices[ruleKey];
      const { error } = await supabase.from('customers').update({ custom_prices: updatedCustomPrices }).eq('id', selectedCustomer.customer.id);
      if (error) throw error;

      const updatedCustomer = { ...selectedCustomer.customer, custom_prices: updatedCustomPrices };
      sys.setCustomers(safeCustomers.map((customer) => String(customer.id) === String(updatedCustomer.id) ? updatedCustomer : customer));
      notify('success', 'Individual override removed', 'The effective price now falls back to the Pricing Group rate, or catalog price if no group rate exists.');
    } catch (error) {
      notify('error', 'Unable to remove individual price', error.message);
    } finally {
      setIsSavingPrice(false);
    }
  };

  const handleDeleteCustomer = async () => {
    const customer = pendingDeleteCustomer;
    if (!customer) return;

    setIsDeletingCustomer(true);
    try {
      const { error } = await supabase.from('customers').delete().eq('id', customer.id);
      if (error) {
        if (error.code === '23503') throw new Error('Cannot delete this customer because existing invoices are tied to the account. Keeping the customer preserves historical records.');
        throw error;
      }

      sys.setCustomers(safeCustomers.filter((entry) => String(entry.id) !== String(customer.id)));
      if (String(selectedCustomerId) === String(customer.id)) setSelectedCustomerId(null);
      notify('success', 'Customer removed', `${customer.name} was deleted from the customer database.`);
    } catch (error) {
      notify('error', 'Customer delete failed', error.message);
    } finally {
      setIsDeletingCustomer(false);
      setPendingDeleteCustomer(null);
    }
  };

  const copyText = async (value, successLabel) => {
    const text = String(value || '').trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      notify('success', successLabel, text);
    } catch {
      notify('warning', 'Copy not available', 'Your browser did not allow clipboard access.');
    }
  };

  useEffect(() => setOrderPage(1), [orderTypeFilter, orderSearch, selectedCustomerId]);

  const selectedOrders = useMemo(() => {
    if (!selectedCustomer) return { filtered: [], pageRows: [], pageCount: 1, safePage: 1 };

    const query = normaliseText(orderSearch);
    const filtered = selectedCustomer.transactions.filter((transaction) => {
      if (orderTypeFilter !== 'All' && transaction.type !== orderTypeFilter) return false;
      if (!query) return true;
      return normaliseText(`${transaction.number} ${transaction.date} ${transaction.status}`).includes(query);
    });

    const pageCount = Math.max(1, Math.ceil(filtered.length / ORDER_PAGE_SIZE));
    const safePage = Math.min(orderPage, pageCount);
    const start = (safePage - 1) * ORDER_PAGE_SIZE;
    return { filtered, pageRows: filtered.slice(start, start + ORDER_PAGE_SIZE), pageCount, safePage };
  }, [selectedCustomer, orderTypeFilter, orderSearch, orderPage]);

  // --------------------------------------------------------------------------
  // DETAIL VIEW
  // --------------------------------------------------------------------------
  if (selectedCustomer) {
    const statusStyle = STATUS_STYLES[selectedCustomer.status] || STATUS_STYLES.inactive;
    const contactNumber = String(selectedCustomer.customer.contactNumber || '').trim();
    const address = String(selectedCustomer.customer.address || '').trim();
    const navigationUrl = getNavigateUrl(address);

    return (
      <div className="space-y-6 pb-8">
        <Toast toast={toast} onClose={() => setToast(null)}/>

        <button className="flex items-center text-sm font-bold text-gray-500 hover:text-gray-800" onClick={() => { setSelectedCustomerId(null); setDetailTab('overview'); }} type="button"><ArrowRight className="mr-2 rotate-180" size={16}/>Back to Customer Intelligence</button>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-black tracking-tight text-slate-900">{selectedCustomer.customer.name}</h2><StatusBadge status={selectedCustomer.status}/><TrendBadge trend={selectedCustomer.trend}/><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${getPaymentTermsClasses(selectedCustomer.customer.payment_terms)}`}>{getPaymentTermsLabel(selectedCustomer.customer.payment_terms)}</span><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${selectedCustomer.customer.cash_gst_enabled !== false ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}><Percent size={10} className="mr-1 inline"/>{selectedCustomer.customer.cash_gst_enabled !== false ? 'Cash GST' : 'Cash No GST'}</span>{assignedGroup && <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-indigo-700"><Layers size={10} className="mr-1"/>{assignedGroup.name}</span>}</div><p className="mt-2 text-sm text-slate-500">{address || 'No address provided'}{selectedCustomer.customer.region ? ` · ${selectedCustomer.customer.region}` : ''}</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingCustomer({ ...selectedCustomer.customer, cash_gst_enabled: selectedCustomer.customer.cash_gst_enabled !== false }); setIsOpen(true); }} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50"><Edit size={14} className="mr-1.5"/>Edit</button>{contactNumber && <a href={`tel:${contactNumber.replace(/\s+/g, '')}`} className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-100"><Phone size={14} className="mr-1.5"/>Call</a>}{navigationUrl && <a href={navigationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-black text-emerald-700 shadow-sm hover:bg-emerald-100"><MapPin size={14} className="mr-1.5"/>Navigate<ExternalLink size={12} className="ml-1.5"/></a>}</div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">{[['overview','Overview'],['pricing','Pricing'],['orders','Orders'],['activity','Activity']].map(([value,label]) => <button key={value} type="button" onClick={() => setDetailTab(value)} className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider ${detailTab === value ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{label}</button>)}</div>
        </div>

        {detailTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Lifetime Sales" value={`$${formatMoneyWhole(selectedCustomer.totalRevenue)}`} subtext={`Normal $${formatMoneyWhole(selectedCustomer.normalRevenue)} · Cash $${formatMoneyWhole(selectedCustomer.cashRevenue)}`} icon={TrendingUp} tone="blue"/><SummaryCard label="Total Orders" value={selectedCustomer.orderCount} subtext={`Normal ${selectedCustomer.normalOrderCount} · Cash ${selectedCustomer.cashOrderCount}`} icon={FileText} tone="emerald"/><SummaryCard label="Average Order" value={`$${formatMoneyWhole(selectedCustomer.avgValue)}`} subtext="Normal + Cash activity" icon={Activity} tone="violet"/><SummaryCard label="Outstanding" value={`$${formatMoneyWhole(selectedCustomer.totalOutstanding)}`} subtext={`Normal $${formatMoneyWhole(selectedCustomer.normalOutstanding)} · Cash $${formatMoneyWhole(selectedCustomer.cashOutstanding)}`} icon={AlertCircle} tone={selectedCustomer.totalOutstanding > 0 ? 'amber' : 'emerald'}/></div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Account Snapshot</h3>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last Order</p><p className={`mt-2 text-xl font-black ${selectedCustomer.daysSinceLast > 60 ? 'text-red-500' : 'text-slate-800'}`}>{selectedCustomer.daysSinceLast === 999 ? 'Never' : `${selectedCustomer.daysSinceLast} days ago`}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Typical Cycle</p><p className="mt-2 text-xl font-black text-slate-800">{selectedCustomer.avgFrequency ? `${selectedCustomer.avgFrequency} days` : 'Not enough data'}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Month</p><p className="mt-2 font-mono text-xl font-black text-blue-600">${formatMoneyWhole(selectedCustomer.currentMonthRevenue)}</p></div></div>
                <div className={`mt-5 rounded-2xl border p-4 ${statusStyle.border} ${statusStyle.bg}`}><div className="flex items-start gap-3">{selectedCustomer.status === 'churned' ? <AlertTriangle className={statusStyle.text} size={20}/> : selectedCustomer.status === 'at-risk' ? <Activity className={statusStyle.text} size={20}/> : selectedCustomer.status === 'cooling' ? <TrendingDown className={statusStyle.text} size={20}/> : <TrendingUp className={statusStyle.text} size={20}/>}<div><p className={`text-sm font-black ${statusStyle.text}`}>{statusStyle.label} Account</p><p className={`mt-1 text-xs leading-5 ${statusStyle.text}`}>{selectedCustomer.status === 'churned' ? 'No Normal or Cash transaction has been recorded in over 90 days.' : selectedCustomer.status === 'at-risk' ? 'Normal and Cash activity combined has been inactive for more than 45 days.' : selectedCustomer.status === 'cooling' ? `The usual cycle is about ${selectedCustomer.avgFrequency} days, but it has been ${selectedCustomer.daysSinceLast} days since the last transaction.` : selectedCustomer.trend === 'growing' ? 'Recent 30-day activity is stronger than the previous 30-day period.' : 'The customer is currently within the normal activity window.'}</p></div></div></div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact File</h3><div className="space-y-4 text-sm"><div className="flex items-start"><User className="mr-3 mt-0.5 shrink-0 text-gray-400" size={18}/><div><p className="font-bold text-slate-800">{selectedCustomer.customer.contactPerson || 'Not Provided'}</p><p className="mt-0.5 text-xs text-slate-400">Contact Person</p></div></div><div className="flex items-start"><Phone className="mr-3 mt-0.5 shrink-0 text-gray-400" size={18}/><div className="min-w-0 flex-1"><p className="font-bold text-slate-800">{contactNumber || 'Not Provided'}</p>{contactNumber && <button type="button" onClick={() => copyText(contactNumber, 'Phone number copied')} className="mt-1 inline-flex items-center text-[10px] font-black uppercase tracking-wider text-blue-600"><Copy size={11} className="mr-1"/>Copy</button>}</div></div><div className="flex items-start"><MapPin className="mr-3 mt-0.5 shrink-0 text-gray-400" size={18}/><div className="min-w-0 flex-1"><p className="text-sm font-medium leading-5 text-gray-600">{address || 'Not Provided'}</p>{address && <div className="mt-2 flex flex-wrap gap-3"><button type="button" onClick={() => copyText(address, 'Address copied')} className="inline-flex items-center text-[10px] font-black uppercase tracking-wider text-blue-600"><Copy size={11} className="mr-1"/>Copy Address</button>{extractSingaporePostalCode(address) && <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Postal {extractSingaporePostalCode(address)}</span>}</div>}</div></div></div></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Commercial Settings</h3><div className="space-y-3"><div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-xs font-bold text-slate-500">Pricing Group</span><span className="text-xs font-black text-slate-800">{assignedGroup?.name || 'None'}</span></div><div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-xs font-bold text-slate-500">Payment Terms</span><span className="text-xs font-black text-slate-800">{getPaymentTermsLabel(selectedCustomer.customer.payment_terms)}</span></div><div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-xs font-bold text-slate-500">Cash GST Default</span><span className="text-xs font-black text-slate-800">{selectedCustomer.customer.cash_gst_enabled !== false ? 'GST 9%' : 'No GST'}</span></div></div></div>
              </div>
            </div>
          </div>
        )}

        {detailTab === 'pricing' && <CustomerPricingTab selectedCustomer={selectedCustomer} assignedGroup={assignedGroup} safeInventory={safeInventory} onAddPricingRule={handleAddPricingRule} onRemovePricingRule={handleRemovePricingRule} isSavingPrice={isSavingPrice}/>} 

        {detailTab === 'orders' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Order History</h3><p className="mt-1 text-xs text-slate-500">Normal and Cash transactions stay distinct while appearing in one customer history.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><Search size={14} className="mr-2 text-slate-400"/><input type="text" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Invoice number or date..." className="w-56 bg-transparent text-xs font-semibold outline-none"/></div><select value={orderTypeFilter} onChange={(event) => setOrderTypeFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"><option value="All">All Orders</option><option value="Normal">Normal</option><option value="Cash">Cash</option></select></div></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Type</th><th className="px-4 py-3">Number</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Subtotal</th><th className="px-4 py-3 text-right">GST</th><th className="px-4 py-3 text-right">Total</th><th className="px-5 py-3 text-center">Status</th></tr></thead><tbody className="divide-y divide-slate-100 text-xs">{selectedOrders.pageRows.map((transaction) => <tr key={`${transaction.type}-${transaction.number}-${transaction.date}`} className="hover:bg-slate-50"><td className="px-5 py-3.5"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${transaction.type === 'Cash' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{transaction.type}</span></td><td className="px-4 py-3.5 font-mono font-black text-slate-800">{transaction.number}</td><td className="px-4 py-3.5 text-slate-500">{transaction.date}</td><td className="px-4 py-3.5 text-right font-mono font-bold text-slate-700">${formatMoney(getInvoiceSubtotalExGst(transaction.invoice))}</td><td className="px-4 py-3.5 text-right font-mono font-bold text-slate-500">${formatMoney(getInvoiceGst(transaction.invoice))}</td><td className="px-4 py-3.5 text-right font-mono font-black text-slate-900">${formatMoney(transaction.total)}</td><td className="px-5 py-3.5 text-center"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${isInvoicePaid(transaction.invoice) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-orange-200 bg-orange-50 text-orange-700'}`}>{isInvoicePaid(transaction.invoice) ? 'Paid' : 'Unpaid'}</span></td></tr>)}{selectedOrders.filtered.length === 0 && <tr><td colSpan="7" className="px-6 py-12 text-center text-sm font-bold text-slate-400">No orders match the current filter.</td></tr>}</tbody></table></div>
            {selectedOrders.filtered.length > 0 && <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3"><p className="text-xs font-semibold text-slate-400">Showing {(selectedOrders.safePage - 1) * ORDER_PAGE_SIZE + 1}–{Math.min(selectedOrders.safePage * ORDER_PAGE_SIZE, selectedOrders.filtered.length)} of {selectedOrders.filtered.length}</p><div className="flex gap-2"><button type="button" disabled={selectedOrders.safePage <= 1} onClick={() => setOrderPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 disabled:opacity-40">Previous</button><span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{selectedOrders.safePage} / {selectedOrders.pageCount}</span><button type="button" disabled={selectedOrders.safePage >= selectedOrders.pageCount} onClick={() => setOrderPage((current) => Math.min(selectedOrders.pageCount, current + 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 disabled:opacity-40">Next</button></div></div>}
          </div>
        )}

        {detailTab === 'activity' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="mb-5 text-sm font-black uppercase tracking-widest text-slate-700">Behavioral Analysis & Actions</h3><div className="space-y-4">{selectedCustomer.status === 'churned' && <div className="flex rounded-xl border border-red-100 bg-red-50 p-4"><AlertTriangle className="mr-4 shrink-0 text-red-500"/><div><h4 className="text-sm font-bold text-red-800">Customer Churned</h4><p className="mt-1 text-xs leading-5 text-red-600">No Normal or Cash transaction in over 90 days. Recommended action: direct account follow-up and service review.</p></div></div>}{selectedCustomer.status === 'at-risk' && <div className="flex rounded-xl border border-orange-100 bg-orange-50 p-4"><Activity className="mr-4 shrink-0 text-orange-500"/><div><h4 className="text-sm font-bold text-orange-800">High Risk of Churn</h4><p className="mt-1 text-xs leading-5 text-orange-600">Combined Normal and Cash activity has slowed significantly. A customer check-in is recommended.</p></div></div>}{selectedCustomer.status === 'cooling' && <div className="flex rounded-xl border border-amber-100 bg-amber-50 p-4"><TrendingDown className="mr-4 shrink-0 text-amber-500"/><div><h4 className="text-sm font-bold text-amber-800">Cooling Engagement</h4><p className="mt-1 text-xs leading-5 text-amber-600">Typical order cycle is {selectedCustomer.avgFrequency} days, but it has been {selectedCustomer.daysSinceLast} days since the last transaction.</p></div></div>}{selectedCustomer.trend === 'growing' && selectedCustomer.status === 'active' && <div className="flex rounded-xl border border-emerald-100 bg-emerald-50 p-4"><TrendingUp className="mr-4 shrink-0 text-emerald-500"/><div><h4 className="text-sm font-bold text-emerald-800">Growth Account</h4><p className="mt-1 text-xs leading-5 text-emerald-600">Revenue in the latest 30-day window is stronger than the previous 30-day period. Review whether the current pricing tier still fits the account.</p></div></div>}{selectedCustomer.avgFrequency && <div className="flex rounded-xl border border-blue-100 bg-blue-50 p-4"><Clock className="mr-4 shrink-0 text-blue-500"/><div><h4 className="text-sm font-bold text-blue-800">Ordering Cadence</h4><p className="mt-1 text-xs leading-5 text-blue-600">Typically orders every <b>{selectedCustomer.avgFrequency} days</b>. The next expected order is roughly {Math.max(0, selectedCustomer.avgFrequency - selectedCustomer.daysSinceLast)} days from now.</p></div></div>}{!selectedCustomer.avgFrequency && selectedCustomer.orderCount === 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">There is not enough order history to calculate customer cadence yet.</div>}</div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-700">Recent Activity</h3><div className="space-y-2">{selectedCustomer.transactions.slice(0, 8).map((transaction) => <div key={`${transaction.type}-${transaction.number}-${transaction.date}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${transaction.type === 'Cash' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{transaction.type}</span><p className="font-mono text-xs font-black text-slate-800">{transaction.number}</p></div><p className="mt-1 text-[11px] text-slate-400">{transaction.date} · {transaction.status}</p></div><p className="shrink-0 font-mono text-sm font-black text-slate-900">${formatMoney(transaction.total)}</p></div>)}{!selectedCustomer.transactions.length && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">No Normal or Cash activity recorded.</div>}</div></div>
            </div>
            <div className="space-y-5"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Typically Orders</h3>{selectedCustomer.topItems.length ? <ul className="space-y-3">{selectedCustomer.topItems.map((item) => <li className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3" key={item.name}><span className="mr-2 truncate text-sm font-bold text-slate-700">{item.name}</span><span className="shrink-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-black text-blue-600 shadow-sm">{item.qty} units</span></li>)}</ul> : <p className="text-sm font-medium text-gray-400">No item data found.</p>}</div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Data Coverage</h3><div className="space-y-3"><div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-xs font-bold text-slate-500">Normal Orders</span><span className="text-xs font-black text-slate-800">{selectedCustomer.normalOrderCount}</span></div><div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-xs font-bold text-slate-500">Cash Orders</span><span className="text-xs font-black text-slate-800">{cashLoading ? 'Loading…' : selectedCustomer.cashOrderCount}</span></div><div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-xs font-bold text-slate-500">Cash Data</span><span className={`text-xs font-black ${cashError ? 'text-red-600' : 'text-emerald-600'}`}>{cashError ? 'Load issue' : cashLoading ? 'Refreshing' : 'Included'}</span></div></div></div></div>
          </div>
        )}

        {isOpen && <CustomerFormModal initialValue={editingCustomer} groups={pricingGroups} existingCustomers={safeCustomers} onClose={() => { setIsOpen(false); setEditingCustomer(EMPTY_CUSTOMER); }} onSave={handleSave}/>} 
        <ConfirmDialog isOpen={Boolean(pendingDeleteCustomer)} title={`Delete ${pendingDeleteCustomer?.name || 'customer'}?`} message="This permanently removes the customer master record. If historical invoices are linked to this customer, the database will block deletion so historical records stay intact." confirmLabel="Delete Customer" tone="red" isWorking={isDeletingCustomer} onCancel={() => setPendingDeleteCustomer(null)} onConfirm={handleDeleteCustomer}/>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // LIST VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-5 pb-8">
      <Toast toast={toast} onClose={() => setToast(null)}/>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 rounded-t-3xl border-b border-slate-100 bg-slate-50 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div><h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Customer Intelligence</h3><p className="mt-1 text-xs font-medium text-slate-500">Revenue, Normal + Cash activity, customer health and commercial settings.</p></div>
          <div className="flex flex-wrap items-center gap-2">{cashLoading && <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-blue-700"><RefreshCw size={12} className="mr-1.5 animate-spin"/>Loading Cash Activity</span>}{cashError && <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-700" title={cashError}><AlertCircle size={12} className="mr-1.5"/>Cash Load Issue</span>}<button type="button" className="flex items-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-indigo-700 shadow-sm hover:bg-indigo-100" onClick={() => setIsGroupManagerOpen(true)}><Layers className="mr-2" size={14}/>Pricing Groups</button><button type="button" className="flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700" onClick={() => { setEditingCustomer(EMPTY_CUSTOMER); setIsOpen(true); }}><Plus className="mr-2" size={16}/>New Account</button></div>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Customers" value={customerSummary.total} subtext="Customer master records" icon={UsersIcon} tone="blue"/><SummaryCard label="Active" value={customerSummary.active} subtext="Within normal activity window" icon={CheckCircle2} tone="emerald"/><SummaryCard label="Needs Attention" value={customerSummary.needsAttention} subtext="Cooling, At Risk or Churned" icon={AlertTriangle} tone="amber"/><SummaryCard label="Current Month Sales" value={`$${formatMoneyWhole(customerSummary.monthSales)}`} subtext="Normal + Cash, incl. GST" icon={TrendingUp} tone="violet"/></div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 shadow-sm focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 xl:max-w-xl"><Search className="mr-2 shrink-0 text-slate-400" size={18}/><input type="text" placeholder="Search company, contact, phone, address, region or group..." className="w-full bg-transparent text-sm font-semibold outline-none" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)}/>{searchTerm && <button type="button" onClick={() => setSearchTerm('')} className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-white"><X size={14}/></button>}</div>
            <div className="flex flex-wrap items-center gap-2"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600"><option value="All">All Health</option><option value="Active">Active</option><option value="Stagnant">Needs Attention</option><option value="Cooling">Cooling</option><option value="At Risk">At Risk</option><option value="Churned">Churned</option><option value="Inactive">Inactive</option></select><select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600"><option value="All">All Regions</option>{REGION_OPTIONS.map((region) => <option key={region} value={region}>{region}</option>)}</select><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600"><option value="All">All Terms</option><option value="30_days">30 Days</option><option value="cod">C.O.D</option><option value="paynow">PayNow</option></select><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600"><option value="All">All Pricing Groups</option><option value="None">No Pricing Group</option>{pricingGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><select value={gstFilter} onChange={(event) => setGstFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600"><option value="All">All Cash GST</option><option value="GST">GST Default</option><option value="No GST">No GST Default</option></select><select value={sortOption} onChange={(event) => setSortOption(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600"><option value="rank">Revenue Rank</option><option value="revenue_desc">Revenue High-Low</option><option value="revenue_asc">Revenue Low-High</option><option value="recent">Most Recent Order</option><option value="oldest">Longest Since Order</option><option value="name_asc">Customer A-Z</option><option value="name_desc">Customer Z-A</option></select>{activeFilterCount > 0 && <button type="button" onClick={resetFilters} className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-100"><Filter size={13} className="mr-1.5"/>Reset ({activeFilterCount})</button>}</div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span className="font-semibold">Showing {displayList.length} of {analytics.length} customers</span><span>Rank stays as the true overall lifetime-revenue rank while filters are active.</span></div>
        </div>

        <div className="max-h-[720px] overflow-auto">
          <table className="w-full min-w-[1150px] text-left font-medium">
            <thead className="sticky top-0 z-10 border-b bg-white text-[10px] font-black uppercase tracking-wider text-gray-400 shadow-sm"><tr><th className="w-16 p-4 pl-6 text-center">Rank</th><th className="p-4">Customer</th><th className="p-4">Pricing Group</th><th className="p-4 text-center">Health</th><th className="p-4 text-center">Trend</th><th className="p-4 text-right">Lifetime Sales</th><th className="p-4 text-center">Orders</th><th className="p-4 text-center">Last Order</th><th className="p-4 pr-6 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {displayList.map((entry) => {
                const group = entry.customer.pricing_group_id ? pricingGroupById.get(String(entry.customer.pricing_group_id)) : null;
                return (
                  <tr className="cursor-pointer transition-colors hover:bg-blue-50/30" key={entry.customer.id} onClick={() => { setSelectedCustomerId(entry.customer.id); setDetailTab('overview'); }}>
                    <td className="p-4 pl-6 text-center"><span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-black ${entry.globalRank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>#{entry.globalRank}</span></td>
                    <td className="p-4"><div className="font-bold text-slate-900">{entry.customer.name || 'Unknown'}</div><div className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{entry.customer.region || '-'} Sector</span><span className={`rounded border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${getPaymentTermsClasses(entry.customer.payment_terms)}`}>{getPaymentTermsLabel(entry.customer.payment_terms)}</span><span className={`rounded border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${entry.customer.cash_gst_enabled !== false ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{entry.customer.cash_gst_enabled !== false ? 'GST' : 'NO GST'}</span></div>{(entry.customer.contactPerson || entry.customer.contactNumber) && <p className="mt-1.5 text-[11px] text-slate-400">{entry.customer.contactPerson || 'No contact'}{entry.customer.contactNumber ? ` · ${entry.customer.contactNumber}` : ''}</p>}</td>
                    <td className="p-4">{group ? <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-indigo-700"><Layers size={10} className="mr-1"/>{group.name}</span> : <span className="text-xs font-semibold text-slate-400">Catalog / Individual</span>}</td>
                    <td className="p-4 text-center"><StatusBadge status={entry.status}/></td>
                    <td className="p-4 text-center"><TrendBadge trend={entry.trend}/></td>
                    <td className="p-4 text-right"><p className="font-mono text-lg font-black tracking-tighter text-slate-900">${formatMoneyWhole(entry.totalRevenue)}</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">N ${formatMoneyWhole(entry.normalRevenue)} · C ${formatMoneyWhole(entry.cashRevenue)}</p></td>
                    <td className="p-4 text-center"><p className="text-sm font-black text-slate-800">{entry.orderCount}</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{entry.normalOrderCount} N · {entry.cashOrderCount} C</p></td>
                    <td className="p-4 text-center text-xs font-bold text-slate-500">{entry.daysSinceLast === 999 ? 'Never' : `${entry.daysSinceLast}d ago`}</td>
                    <td className="p-4 pr-6 text-right"><div className="flex items-center justify-end gap-2"><span className="inline-flex items-center rounded-lg bg-blue-50 p-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-100">View<ArrowRight className="ml-1" size={12}/></span><button type="button" onClick={(event) => { event.stopPropagation(); setPendingDeleteCustomer(entry.customer); }} className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-600" title="Delete Customer"><Trash2 size={16}/></button></div></td>
                  </tr>
                );
              })}
              {!displayList.length && <tr><td className="p-12 text-center text-sm font-bold text-slate-400" colSpan="9">No customers match your current search and filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && <CustomerFormModal initialValue={editingCustomer} groups={pricingGroups} existingCustomers={safeCustomers} onClose={() => { setIsOpen(false); setEditingCustomer(EMPTY_CUSTOMER); }} onSave={handleSave}/>} 
      {isGroupManagerOpen && <PricingGroupManager sys={sys} groups={pricingGroups} setGroups={setPricingGroups} onClose={() => setIsGroupManagerOpen(false)} notify={notify}/>} 
      <ConfirmDialog isOpen={Boolean(pendingDeleteCustomer)} title={`Delete ${pendingDeleteCustomer?.name || 'customer'}?`} message="This permanently removes the customer master record. If historical invoices are linked to this customer, the database will block deletion so historical records stay intact." confirmLabel="Delete Customer" tone="red" isWorking={isDeletingCustomer} onCancel={() => setPendingDeleteCustomer(null)} onConfirm={handleDeleteCustomer}/>
    </div>
  );
}
