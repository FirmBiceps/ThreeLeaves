import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Info,
  PackagePlus,
  Plus,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';

const GST_RATE = 0.09;
const SALES_EXCLUSION_STORAGE_KEY = 'three-leaves-gst-sales-exclusions-v1';

const QUARTERS = [
  { value: 'Q1', label: 'Q1', months: [0, 1, 2] },
  { value: 'Q2', label: 'Q2', months: [3, 4, 5] },
  { value: 'Q3', label: 'Q3', months: [6, 7, 8] },
  { value: 'Q4', label: 'Q4', months: [9, 10, 11] },
];

const PURCHASE_CATEGORIES = [
  'Inventory Purchase',
  'Overheads',
  'Capital Goods',
  'Freight / Delivery',
  'Professional Fees',
  'Utilities',
  'Other Purchase',
];

const EXCLUSION_REASONS = [
  'Cancelled invoice',
  'Duplicate invoice',
  'Not subject to GST',
  'Recorded in another GST period',
  'Credit adjustment required',
  'Other',
];

function getCurrentQuarter() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    quarter: `Q${Math.floor(now.getMonth() / 3) + 1}`,
  };
}

function getQuarterDateRange(year, quarter) {
  const quarterConfig = QUARTERS.find((entry) => entry.value === quarter) || QUARTERS[0];
  const startMonth = quarterConfig.months[0];
  const endMonth = quarterConfig.months[2];

  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

function isDateInRange(dateValue, range) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return date >= range.start && date <= range.end;
}

function toMoneyNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getInvoiceSubtotal(invoice) {
  const explicitSubtotal =
    invoice?.subtotal ??
    invoice?.subTotal ??
    invoice?.amount_before_gst ??
    invoice?.amountBeforeGst;

  if (explicitSubtotal !== undefined && explicitSubtotal !== null && explicitSubtotal !== '') {
    return toMoneyNumber(explicitSubtotal);
  }

  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  if (items.length > 0) {
    return items.reduce((sum, item) => {
      const quantity = toMoneyNumber(item?.qty ?? item?.quantity);
      const price = toMoneyNumber(item?.unitPrice ?? item?.price ?? item?.Price);
      return sum + quantity * price;
    }, 0);
  }

  const total = toMoneyNumber(invoice?.total);
  return total > 0 ? total / (1 + GST_RATE) : 0;
}

function getInvoiceGst(invoice) {
  const explicitGst =
    invoice?.gstAmount ??
    invoice?.gst_amount ??
    invoice?.gst ??
    invoice?.taxAmount ??
    invoice?.tax_amount;

  if (explicitGst !== undefined && explicitGst !== null && explicitGst !== '') {
    return {
      amount: toMoneyNumber(explicitGst),
      source: 'saved',
    };
  }

  const subtotal = getInvoiceSubtotal(invoice);
  const total = toMoneyNumber(invoice?.total);

  if (subtotal > 0 && total > subtotal) {
    return {
      amount: total - subtotal,
      source: 'derived',
    };
  }

  return {
    amount: subtotal * GST_RATE,
    source: 'calculated',
  };
}

function getInventoryIdentity(item) {
  return item?.id || item?.SKU || item?.sku || item?.Name || item?.name || item?.Items || '';
}

function getInventoryName(item) {
  return String(item?.Name || item?.name || item?.Items || 'Unnamed Product');
}

function getInventorySku(item) {
  return String(item?.SKU || item?.sku || '');
}

function getSupplierName(supplier) {
  return String(supplier?.name || supplier?.Name || supplier?.supplier_name || 'Unnamed Supplier');
}

function loadStoredSalesExclusions() {
  try {
    const raw = window.localStorage.getItem(SALES_EXCLUSION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Unable to load GST sales exclusions:', error);
    return {};
  }
}

function saveStoredSalesExclusions(exclusions) {
  try {
    window.localStorage.setItem(SALES_EXCLUSION_STORAGE_KEY, JSON.stringify(exclusions));
  } catch (error) {
    console.error('Unable to save GST sales exclusions:', error);
  }
}

function DashboardCard({ icon: Icon, label, value, helper, tone = 'slate' }) {
  const toneMap = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    red: 'border-red-100 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-white text-slate-700',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneMap[tone] || toneMap.slate}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</p>
          <p className="mt-2 font-mono text-2xl font-black tracking-tight">{value}</p>
          <p className="mt-2 text-xs font-semibold opacity-80">{helper}</p>
        </div>
        <div className="rounded-xl bg-white/70 p-2.5 shadow-sm">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
        <ReceiptText size={28} />
      </div>
      <h3 className="mt-4 text-sm font-black text-slate-700">{title}</h3>
      <p className="mt-1 max-w-md text-xs font-medium text-slate-400">{description}</p>
    </div>
  );
}

function SalesExclusionModal({ invoice, existing, onClose, onSave }) {
  const [reason, setReason] = useState(existing?.reason || EXCLUSION_REASONS[0]);
  const [notes, setNotes] = useState(existing?.notes || '');

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest">Exclude Sales Invoice</h2>
            <p className="mt-1 text-xs text-slate-300">
              Invoice #{invoice?.number || invoice?.id || 'N/A'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Exclusion reason
            </label>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EXCLUSION_REASONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Add a short audit note..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
            This temporary version stores exclusions in this browser only. The later Supabase migration will make exclusions shared and auditable across users.
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave({ reason, notes })}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-black text-white shadow-lg hover:bg-amber-700"
            >
              Exclude invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PurchaseEntryModal({ suppliers, inventory, onClose, onSave }) {
  const [form, setForm] = useState({
    supplierId: '',
    supplierInvoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    category: 'Inventory Purchase',
    notes: '',
    gstRate: GST_RATE,
  });
  const [items, setItems] = useState([
    { productId: '', quantity: 1, unitCost: 0, gstRate: GST_RATE },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const safeInventory = Array.isArray(inventory) ? inventory : [];

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + toMoneyNumber(item.quantity) * toMoneyNumber(item.unitCost), 0),
    [items]
  );

  const gstAmount = useMemo(
    () => items.reduce((sum, item) => {
      const lineSubtotal = toMoneyNumber(item.quantity) * toMoneyNumber(item.unitCost);
      return sum + lineSubtotal * toMoneyNumber(item.gstRate);
    }, 0),
    [items]
  );

  const total = subtotal + gstAmount;

  const updateItem = (index, patch) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  };

  const removeItem = (index) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async () => {
    setErrorMessage('');

    const cleanItems = items
      .map((item) => ({
        ...item,
        quantity: toMoneyNumber(item.quantity),
        unitCost: toMoneyNumber(item.unitCost),
        gstRate: toMoneyNumber(item.gstRate),
      }))
      .filter((item) => item.productId && item.quantity > 0);

    if (!form.supplierId) {
      setErrorMessage('Select a supplier.');
      return;
    }

    if (!form.supplierInvoiceNumber.trim()) {
      setErrorMessage('Enter the supplier invoice number.');
      return;
    }

    if (cleanItems.length === 0) {
      setErrorMessage('Add at least one valid purchase item.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        ...form,
        supplierInvoiceNumber: form.supplierInvoiceNumber.trim(),
        notes: form.notes.trim(),
        items: cleanItems,
        subtotal,
        gstAmount,
        total,
      });
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to save purchase entry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div>
            <h2 className="flex items-center text-sm font-black uppercase tracking-widest">
              <ShoppingCart className="mr-2 text-emerald-400" size={18} />
              Register Supplier Purchase
            </h2>
            <p className="mt-1 text-xs text-slate-300">Capture input GST and stock-in purchased items.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-800">
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50 p-6">
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Supplier</label>
              <select
                value={form.supplierId}
                onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select supplier...</option>
                {safeSuppliers.map((supplier) => (
                  <option key={supplier.id || getSupplierName(supplier)} value={supplier.id || getSupplierName(supplier)}>
                    {getSupplierName(supplier)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Supplier Invoice No.</label>
              <input
                value={form.supplierInvoiceNumber}
                onChange={(event) => setForm((current) => ({ ...current, supplierInvoiceNumber: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. SUP-2026-001"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice Date</label>
              <input
                type="date"
                value={form.invoiceDate}
                onChange={(event) => setForm((current) => ({ ...current, invoiceDate: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Category</label>
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PURCHASE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</label>
              <input
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional internal notes"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-black text-slate-800">Purchased Items</h3>
                <p className="mt-1 text-xs font-medium text-slate-400">Each item will be added to stock when this purchase is saved.</p>
              </div>
              <button
                type="button"
                onClick={() => setItems((current) => [...current, { productId: '', quantity: 1, unitCost: 0, gstRate: GST_RATE }])}
                className="flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
              >
                <Plus size={14} className="mr-1.5" /> Add item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left">
                <thead className="border-b bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="p-4 pl-5">Product</th>
                    <th className="p-4 text-center">Qty</th>
                    <th className="p-4 text-right">Unit Cost</th>
                    <th className="p-4 text-center">GST Rate</th>
                    <th className="p-4 text-right">GST</th>
                    <th className="p-4 text-right">Line Total</th>
                    <th className="p-4 pr-5 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {items.map((item, index) => {
                    const lineSubtotal = toMoneyNumber(item.quantity) * toMoneyNumber(item.unitCost);
                    const lineGst = lineSubtotal * toMoneyNumber(item.gstRate);
                    return (
                      <tr key={`purchase-line-${index}`}>
                        <td className="p-4 pl-5">
                          <select
                            value={item.productId}
                            onChange={(event) => {
                              const product = safeInventory.find((entry) => String(getInventoryIdentity(entry)) === String(event.target.value));
                              updateItem(index, {
                                productId: event.target.value,
                                unitCost: product
                                  ? toMoneyNumber(product?.['cost_price (SGD)'] ?? product?.cost_price ?? product?.costPrice)
                                  : item.unitCost,
                              });
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select product...</option>
                            {safeInventory.map((product) => {
                              const identity = getInventoryIdentity(product);
                              return (
                                <option key={identity} value={identity}>
                                  {getInventorySku(product) ? `[${getInventorySku(product)}] ` : ''}{getInventoryName(product)}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td className="p-4 text-center">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantity}
                            onChange={(event) => updateItem(index, { quantity: event.target.value })}
                            className="w-24 rounded-lg border border-slate-200 p-2.5 text-center font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-4 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(event) => updateItem(index, { unitCost: event.target.value })}
                            className="w-28 rounded-lg border border-slate-200 p-2.5 text-right font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-4 text-center">
                          <select
                            value={item.gstRate}
                            onChange={(event) => updateItem(index, { gstRate: Number(event.target.value) })}
                            className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value={GST_RATE}>9%</option>
                            <option value={0}>0%</option>
                          </select>
                        </td>
                        <td className="p-4 text-right font-mono font-black text-emerald-600">${formatMoney(lineGst)}</td>
                        <td className="p-4 text-right font-mono font-black text-slate-900">${formatMoney(lineSubtotal + lineGst)}</td>
                        <td className="p-4 pr-5 text-center">
                          <button
                            type="button"
                            disabled={items.length === 1}
                            onClick={() => removeItem(index)}
                            className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Purchase subtotal</p>
              <p className="mt-2 font-mono text-2xl font-black text-slate-900">${formatMoney(subtotal)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Input GST</p>
              <p className="mt-2 font-mono text-2xl font-black text-emerald-800">${formatMoney(gstAmount)}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Invoice total</p>
              <p className="mt-2 font-mono text-2xl font-black text-blue-900">${formatMoney(total)}</p>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              <AlertCircle size={18} className="mr-2 mt-0.5 shrink-0" />
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
          <p className="max-w-2xl text-xs font-medium text-slate-400">
            Temporary workflow: the GST record and inventory stock update are saved now. A later database migration will add formal purchase invoice and stock movement tables.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex items-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-black text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSaving ? <RefreshCcw size={16} className="mr-2 animate-spin" /> : <CheckCircle2 size={16} className="mr-2" />}
              {isSaving ? 'Saving...' : 'Post Purchase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function createEmptyPurchaseDraft() {
  return {
    date: new Date().toISOString().slice(0, 10),
    supplierId: '',
    supplierInvoiceNumber: '',
    category: 'Inventory Purchase',
    productId: '',
    quantity: 1,
    unitCost: '',
    gstRate: GST_RATE,
    notes: '',
    status: 'draft',
    error: '',
  };
}

function PurchaseEntryTable({ suppliers, inventory, onPost }) {
  const [rows, setRows] = useState(() => [createEmptyPurchaseDraft()]);

  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const safeInventory = Array.isArray(inventory) ? inventory : [];

  const updateRow = (index, patch) => {
    setRows((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...patch, error: '' } : row
    )));
  };

  const addRow = () => {
    setRows((current) => [...current, createEmptyPurchaseDraft()]);
  };

  const duplicateRow = (index) => {
    setRows((current) => {
      const source = current[index];
      return [
        ...current.slice(0, index + 1),
        { ...source, status: 'draft', error: '' },
        ...current.slice(index + 1),
      ];
    });
  };

  const removeRow = (index) => {
    setRows((current) => {
      if (current.length === 1) return [createEmptyPurchaseDraft()];
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const postRow = async (index) => {
    const row = rows[index];
    if (!row.supplierId) {
      updateRow(index, { error: 'Select supplier.' });
      return;
    }
    if (!row.supplierInvoiceNumber.trim()) {
      updateRow(index, { error: 'Enter invoice no.' });
      return;
    }
    if (!row.productId) {
      updateRow(index, { error: 'Select product.' });
      return;
    }

    const quantity = toMoneyNumber(row.quantity);
    const unitCost = toMoneyNumber(row.unitCost);
    if (quantity <= 0 || unitCost < 0) {
      updateRow(index, { error: 'Check quantity and unit cost.' });
      return;
    }

    updateRow(index, { status: 'saving' });

    try {
      await onPost({
        supplierId: row.supplierId,
        supplierInvoiceNumber: row.supplierInvoiceNumber.trim(),
        invoiceDate: row.date,
        category: row.category,
        notes: row.notes.trim(),
        items: [{
          productId: row.productId,
          quantity,
          unitCost,
          gstRate: toMoneyNumber(row.gstRate),
        }],
        subtotal: quantity * unitCost,
        gstAmount: quantity * unitCost * toMoneyNumber(row.gstRate),
        total: quantity * unitCost * (1 + toMoneyNumber(row.gstRate)),
      });

      updateRow(index, { status: 'posted', error: '' });
    } catch (error) {
      updateRow(index, { status: 'draft', error: error?.message || 'Unable to post purchase.' });
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-800">Purchase GST Entry</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Enter supplier purchases directly into the spreadsheet. No pop-up form is required.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-50"
        >
          <Plus size={15} className="mr-2" /> Add row
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1500px] w-full text-left">
          <thead className="border-b border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-400">
            <tr>
              <th className="w-[120px] p-3 pl-5">Date</th>
              <th className="w-[210px] p-3">Supplier</th>
              <th className="w-[150px] p-3">Invoice No.</th>
              <th className="w-[170px] p-3">Product</th>
              <th className="w-[110px] p-3 text-right">Qty</th>
              <th className="w-[125px] p-3 text-right">Unit Cost</th>
              <th className="w-[105px] p-3 text-center">GST</th>
              <th className="w-[130px] p-3 text-right">Ex-GST</th>
              <th className="w-[125px] p-3 text-right">Input GST</th>
              <th className="w-[130px] p-3 text-right">Total</th>
              <th className="w-[170px] p-3">Category</th>
              <th className="w-[130px] p-3 text-center">Action</th>
              <th className="w-[70px] p-3 pr-5 text-center">More</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-sm">
            {rows.map((row, index) => {
              const quantity = toMoneyNumber(row.quantity);
              const unitCost = toMoneyNumber(row.unitCost);
              const rate = toMoneyNumber(row.gstRate);
              const subtotal = quantity * unitCost;
              const gst = subtotal * rate;
              const total = subtotal + gst;

              return (
                <tr key={`purchase-entry-${index}`} className={row.status === 'posted' ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}>
                  <td className="p-2 pl-5 align-top">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(event) => updateRow(index, { date: event.target.value })}
                      disabled={row.status === 'saving' || row.status === 'posted'}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                    {row.error && <p className="mt-1 text-[9px] font-bold text-red-600">{row.error}</p>}
                  </td>

                  <td className="p-2 align-top">
                    <select
                      value={row.supplierId}
                      onChange={(event) => updateRow(index, { supplierId: event.target.value })}
                      disabled={row.status === 'saving' || row.status === 'posted'}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    >
                      <option value="">Select supplier...</option>
                      {safeSuppliers.map((supplier) => (
                        <option key={supplier.id || getSupplierName(supplier)} value={supplier.id || getSupplierName(supplier)}>
                          {getSupplierName(supplier)}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-2 align-top">
                    <input
                      value={row.supplierInvoiceNumber}
                      onChange={(event) => updateRow(index, { supplierInvoiceNumber: event.target.value })}
                      disabled={row.status === 'saving' || row.status === 'posted'}
                      placeholder="INV-0001"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                  </td>

                  <td className="p-2 align-top">
                    <select
                      value={row.productId}
                      onChange={(event) => {
                        const product = safeInventory.find(
                          (entry) => String(getInventoryIdentity(entry)) === String(event.target.value)
                        );
                        updateRow(index, {
                          productId: event.target.value,
                          unitCost: product
                            ? toMoneyNumber(product?.['cost_price (SGD)'] ?? product?.cost_price ?? product?.costPrice)
                            : row.unitCost,
                        });
                      }}
                      disabled={row.status === 'saving' || row.status === 'posted'}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    >
                      <option value="">Select product...</option>
                      {safeInventory.map((product) => {
                        const identity = getInventoryIdentity(product);
                        return (
                          <option key={identity} value={identity}>
                            {getInventorySku(product) ? `[${getInventorySku(product)}] ` : ''}{getInventoryName(product)}
                          </option>
                        );
                      })}
                    </select>
                  </td>

                  <td className="p-2 align-top">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.quantity}
                      onChange={(event) => updateRow(index, { quantity: event.target.value })}
                      disabled={row.status === 'saving' || row.status === 'posted'}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right font-mono text-xs font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                  </td>

                  <td className="p-2 align-top">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unitCost}
                      onChange={(event) => updateRow(index, { unitCost: event.target.value })}
                      disabled={row.status === 'saving' || row.status === 'posted'}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right font-mono text-xs font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                  </td>

                  <td className="p-2 align-top">
                    <select
                      value={row.gstRate}
                      onChange={(event) => updateRow(index, { gstRate: Number(event.target.value) })}
                      disabled={row.status === 'saving' || row.status === 'posted'}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-xs font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    >
                      <option value={GST_RATE}>9%</option>
                      <option value={0}>0%</option>
                    </select>
                  </td>

                  <td className="p-3 text-right font-mono text-xs font-bold text-slate-600">${formatMoney(subtotal)}</td>
                  <td className="p-3 text-right font-mono text-xs font-black text-emerald-700">${formatMoney(gst)}</td>
                  <td className="p-3 text-right font-mono text-xs font-black text-slate-900">${formatMoney(total)}</td>

                  <td className="p-2 align-top">
                    <select
                      value={row.category}
                      onChange={(event) => updateRow(index, { category: event.target.value })}
                      disabled={row.status === 'saving' || row.status === 'posted'}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    >
                      {PURCHASE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </td>

                  <td className="p-2 align-top text-center">
                    {row.status === 'posted' ? (
                      <span className="inline-flex items-center rounded-lg bg-emerald-100 px-2.5 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        Posted
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => postRow(index)}
                        disabled={row.status === 'saving'}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {row.status === 'saving' ? 'Saving...' : 'Post'}
                      </button>
                    )}
                  </td>

                  <td className="p-2 pr-5 text-center align-top">
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        title="Duplicate row"
                        onClick={() => duplicateRow(index)}
                        disabled={row.status === 'saving'}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                      >
                        <Plus size={15} />
                      </button>
                      <button
                        type="button"
                        title="Remove row"
                        onClick={() => removeRow(index)}
                        disabled={row.status === 'saving'}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
        <span>Enter purchases row-by-row. Calculated GST and totals update immediately.</span>
        <span className="font-semibold">Post only when the row has been checked.</span>
      </div>
    </div>
  );
}

function GstQuarterReport({ report, monthlyReport, salesRows, purchaseRows }) {
  const [showSalesSummary, setShowSalesSummary] = useState(true);
  const [showPurchaseSummary, setShowPurchaseSummary] = useState(true);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);
  const [showPurchaseDetail, setShowPurchaseDetail] = useState(false);
  const [showTaxableValues, setShowTaxableValues] = useState(true);

  const toggle = (setter) => (event) => setter(event.target.checked);

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={17} className="text-slate-500" />
            <h3 className="text-sm font-black text-slate-800">Report Builder</h3>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Choose the level of detail before printing or reviewing the quarter.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-bold text-slate-600">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showSalesSummary} onChange={toggle(setShowSalesSummary)} />
            Sales monthly summary
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showPurchaseSummary} onChange={toggle(setShowPurchaseSummary)} />
            Purchase monthly summary
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showTaxableValues} onChange={toggle(setShowTaxableValues)} />
            Taxable values
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showInvoiceDetail} onChange={toggle(setShowInvoiceDetail)} />
            Sales invoice detail
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showPurchaseDetail} onChange={toggle(setShowPurchaseDetail)} />
            Purchase detail
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800"
          >
            <Printer size={15} className="mr-2" /> Print report
          </button>
        </div>
      </div>

      <div id="gst-quarter-report" className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">GST Quarterly Report</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">{report.quarterLabel}</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">Sales GST versus Purchase GST • {report.year}</p>
          </div>
          <div className="grid grid-cols-3 gap-5 text-right">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sales GST</p>
              <p className="mt-1 font-mono text-lg font-black text-indigo-700">${formatMoney(report.outputGst)}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Purchase GST</p>
              <p className="mt-1 font-mono text-lg font-black text-emerald-700">${formatMoney(report.inputGst)}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Net GST</p>
              <p className="mt-1 font-mono text-lg font-black text-slate-900">${formatMoney(Math.abs(report.netPayable))}</p>
            </div>
          </div>
        </div>

        {(showSalesSummary || showPurchaseSummary) && (
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800">Monthly GST Summary</h3>
                <p className="mt-1 text-xs text-slate-500">Every month reconciled into one quarter.</p>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{report.includedSalesCount} sales • {report.purchaseCount} purchases</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="p-3 text-left">Month</th>
                    {showSalesSummary && <th className="p-3 text-right">Sales Invoices</th>}
                    {showTaxableValues && showSalesSummary && <th className="p-3 text-right">Sales ex-GST</th>}
                    {showSalesSummary && <th className="p-3 text-right">Sales GST</th>}
                    {showPurchaseSummary && <th className="p-3 text-right">Purchase Records</th>}
                    {showTaxableValues && showPurchaseSummary && <th className="p-3 text-right">Purchases ex-GST</th>}
                    {showPurchaseSummary && <th className="p-3 text-right">Purchase GST</th>}
                    {(showSalesSummary || showPurchaseSummary) && <th className="p-3 text-right">Net GST</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyReport.map((month) => (
                    <tr key={month.key} className="hover:bg-slate-50">
                      <td className="p-3 font-black text-slate-800">{month.label}</td>
                      {showSalesSummary && <td className="p-3 text-right font-mono font-bold text-slate-600">{month.salesCount}</td>}
                      {showTaxableValues && showSalesSummary && <td className="p-3 text-right font-mono text-slate-600">${formatMoney(month.salesSubtotal)}</td>}
                      {showSalesSummary && <td className="p-3 text-right font-mono font-black text-indigo-700">${formatMoney(month.salesGst)}</td>}
                      {showPurchaseSummary && <td className="p-3 text-right font-mono font-bold text-slate-600">{month.purchaseCount}</td>}
                      {showTaxableValues && showPurchaseSummary && <td className="p-3 text-right font-mono text-slate-600">${formatMoney(month.purchaseSubtotal)}</td>}
                      {showPurchaseSummary && <td className="p-3 text-right font-mono font-black text-emerald-700">${formatMoney(month.purchaseGst)}</td>}
                      {(showSalesSummary || showPurchaseSummary) && <td className="p-3 text-right font-mono font-black text-slate-900">${formatMoney(month.salesGst - month.purchaseGst)}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-black">
                  <tr>
                    <td className="p-3">Quarter Total</td>
                    {showSalesSummary && <td className="p-3 text-right">{report.includedSalesCount}</td>}
                    {showTaxableValues && showSalesSummary && <td className="p-3 text-right font-mono">${formatMoney(report.taxableSales)}</td>}
                    {showSalesSummary && <td className="p-3 text-right font-mono text-indigo-700">${formatMoney(report.outputGst)}</td>}
                    {showPurchaseSummary && <td className="p-3 text-right">{report.purchaseCount}</td>}
                    {showTaxableValues && showPurchaseSummary && <td className="p-3 text-right font-mono">${formatMoney(report.taxablePurchases)}</td>}
                    {showPurchaseSummary && <td className="p-3 text-right font-mono text-emerald-700">${formatMoney(report.inputGst)}</td>}
                    {(showSalesSummary || showPurchaseSummary) && <td className="p-3 text-right font-mono">${formatMoney(report.netPayable)}</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {showInvoiceDetail && (
          <section className="border-t border-slate-200 pt-6">
            <h3 className="mb-3 text-sm font-black text-slate-800">Sales Invoice GST Detail</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Invoice</th>
                    <th className="p-3 text-left">Customer</th>
                    {showTaxableValues && <th className="p-3 text-right">Sales ex-GST</th>}
                    <th className="p-3 text-right">Sales GST</th>
                    <th className="p-3 text-right">Invoice Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesRows.filter((row) => !row.isExcluded).map((row) => (
                    <tr key={`report-sales-${row.invoiceId}`}>
                      <td className="p-3 text-slate-500">{row.invoice?.date || '-'}</td>
                      <td className="p-3 font-mono font-black text-slate-800">#{row.invoice?.number || row.invoice?.id || '-'}</td>
                      <td className="p-3 font-semibold text-slate-700">{row.invoice?.customer || 'Unknown customer'}</td>
                      {showTaxableValues && <td className="p-3 text-right font-mono">${formatMoney(row.subtotal)}</td>}
                      <td className="p-3 text-right font-mono font-black text-indigo-700">${formatMoney(row.gstAmount)}</td>
                      <td className="p-3 text-right font-mono font-black">${formatMoney(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {showPurchaseDetail && (
          <section className="border-t border-slate-200 pt-6">
            <h3 className="mb-3 text-sm font-black text-slate-800">Purchase GST Detail</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Purchase</th>
                    <th className="p-3 text-left">Category</th>
                    {showTaxableValues && <th className="p-3 text-right">Purchase ex-GST</th>}
                    <th className="p-3 text-right">Purchase GST</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseRows.map((record) => {
                    const amount = toMoneyNumber(record?.amount);
                    const gst = toMoneyNumber(record?.gst);
                    return (
                      <tr key={`report-purchase-${record.id}`}>
                        <td className="p-3 text-slate-500">{record.date || '-'}</td>
                        <td className="p-3 font-semibold text-slate-700">{record.desc || 'Supplier purchase'}</td>
                        <td className="p-3 text-slate-500">{record.category || 'Purchase'}</td>
                        {showTaxableValues && <td className="p-3 text-right font-mono">${formatMoney(amount)}</td>}
                        <td className="p-3 text-right font-mono font-black text-emerald-700">${formatMoney(gst)}</td>
                        <td className="p-3 text-right font-mono font-black">${formatMoney(amount + gst)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export function GSTModule({ sys }) {
  const current = getCurrentQuarter();
  const [selectedYear, setSelectedYear] = useState(current.year);
  const [selectedQuarter, setSelectedQuarter] = useState(current.quarter);
  const [activeTab, setActiveTab] = useState('overview');
  const [salesSearch, setSalesSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [showExcludedSales, setShowExcludedSales] = useState(true);
  const [salesExclusions, setSalesExclusions] = useState(() => loadStoredSalesExclusions());
  const [exclusionInvoice, setExclusionInvoice] = useState(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeGstRecords = Array.isArray(sys?.gstRecords) ? sys.gstRecords : [];
  const safeSuppliers = Array.isArray(sys?.suppliers) ? sys.suppliers : [];
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];

  const quarterRange = useMemo(
    () => getQuarterDateRange(Number(selectedYear), selectedQuarter),
    [selectedYear, selectedQuarter]
  );

  useEffect(() => {
    saveStoredSalesExclusions(salesExclusions);
  }, [salesExclusions]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    window.setTimeout(() => setNotification(null), 5000);
  };

  const salesRows = useMemo(() => {
    return safeInvoices
      .filter((invoice) => isDateInRange(invoice?.date, quarterRange))
      .map((invoice) => {
        const invoiceId = String(invoice?.id || invoice?.number || '');
        const subtotal = getInvoiceSubtotal(invoice);
        const gstResult = getInvoiceGst(invoice);
        const total = toMoneyNumber(invoice?.total) || subtotal + gstResult.amount;
        const exclusion = salesExclusions[invoiceId] || null;

        return {
          invoice,
          invoiceId,
          subtotal,
          gstAmount: gstResult.amount,
          gstSource: gstResult.source,
          total,
          exclusion,
          isExcluded: Boolean(exclusion),
        };
      })
      .sort((left, right) => new Date(right.invoice?.date || 0) - new Date(left.invoice?.date || 0));
  }, [safeInvoices, quarterRange, salesExclusions]);

  const filteredSalesRows = useMemo(() => {
    const search = salesSearch.trim().toLowerCase();
    return salesRows.filter((row) => {
      if (!showExcludedSales && row.isExcluded) return false;
      if (!search) return true;
      const invoice = row.invoice;
      return (
        String(invoice?.number || invoice?.id || '').toLowerCase().includes(search) ||
        String(invoice?.customer || '').toLowerCase().includes(search) ||
        String(invoice?.date || '').toLowerCase().includes(search)
      );
    });
  }, [salesRows, salesSearch, showExcludedSales]);

  const purchaseRows = useMemo(() => {
    return safeGstRecords
      .filter((record) => record?.type === 'input' && isDateInRange(record?.date, quarterRange))
      .sort((left, right) => new Date(right?.date || 0) - new Date(left?.date || 0));
  }, [safeGstRecords, quarterRange]);

  const filteredPurchaseRows = useMemo(() => {
    const search = purchaseSearch.trim().toLowerCase();
    if (!search) return purchaseRows;
    return purchaseRows.filter((record) => (
      String(record?.desc || '').toLowerCase().includes(search) ||
      String(record?.category || '').toLowerCase().includes(search) ||
      String(record?.date || '').toLowerCase().includes(search)
    ));
  }, [purchaseRows, purchaseSearch]);

  const report = useMemo(() => {
    const includedSales = salesRows.filter((row) => !row.isExcluded);
    const excludedSales = salesRows.filter((row) => row.isExcluded);

    const taxableSales = includedSales.reduce((sum, row) => sum + row.subtotal, 0);
    const outputGst = includedSales.reduce((sum, row) => sum + row.gstAmount, 0);
    const taxablePurchases = purchaseRows.reduce((sum, record) => sum + toMoneyNumber(record?.amount), 0);
    const inputGst = purchaseRows.reduce((sum, record) => sum + toMoneyNumber(record?.gst), 0);
    const reviewCount = salesRows.filter((row) => row.gstSource !== 'saved').length;

    return {
      taxableSales,
      outputGst,
      taxablePurchases,
      inputGst,
      netPayable: outputGst - inputGst,
      includedSalesCount: includedSales.length,
      excludedSalesCount: excludedSales.length,
      purchaseCount: purchaseRows.length,
      reviewCount,
      year: Number(selectedYear),
      quarterLabel: `${selectedQuarter} ${selectedYear}`,
    };
  }, [salesRows, purchaseRows]);


  const monthlyReport = useMemo(() => {
    const quarterConfig = QUARTERS.find((entry) => entry.value === selectedQuarter) || QUARTERS[0];

    return quarterConfig.months.map((monthIndex) => {
      const monthKey = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
      const monthSales = salesRows.filter((row) => {
        if (row.isExcluded) return false;
        const date = new Date(row.invoice?.date || '');
        return date.getFullYear() === Number(selectedYear) && date.getMonth() === monthIndex;
      });
      const monthPurchases = purchaseRows.filter((record) => {
        const date = new Date(record?.date || '');
        return date.getFullYear() === Number(selectedYear) && date.getMonth() === monthIndex;
      });

      return {
        key: monthKey,
        label: new Date(Number(selectedYear), monthIndex, 1).toLocaleDateString('en-SG', { month: 'long' }),
        salesCount: monthSales.length,
        salesSubtotal: monthSales.reduce((sum, row) => sum + row.subtotal, 0),
        salesGst: monthSales.reduce((sum, row) => sum + row.gstAmount, 0),
        purchaseCount: monthPurchases.length,
        purchaseSubtotal: monthPurchases.reduce((sum, row) => sum + toMoneyNumber(row?.amount), 0),
        purchaseGst: monthPurchases.reduce((sum, row) => sum + toMoneyNumber(row?.gst), 0),
      };
    });
  }, [selectedYear, selectedQuarter, salesRows, purchaseRows]);

  const availableYears = useMemo(() => {
    const years = new Set([current.year]);
    safeInvoices.forEach((invoice) => {
      const year = new Date(invoice?.date || '').getFullYear();
      if (Number.isFinite(year)) years.add(year);
    });
    safeGstRecords.forEach((record) => {
      const year = new Date(record?.date || '').getFullYear();
      if (Number.isFinite(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [safeInvoices, safeGstRecords, current.year]);

  const handleExcludeInvoice = (invoice, details) => {
    const invoiceId = String(invoice?.id || invoice?.number || '');
    if (!invoiceId) return;

    setSalesExclusions((currentExclusions) => ({
      ...currentExclusions,
      [invoiceId]: {
        ...details,
        excludedAt: new Date().toISOString(),
      },
    }));
    setExclusionInvoice(null);
    showNotification(`Invoice #${invoice?.number || invoice?.id || ''} excluded from GST calculation.`, 'warning');
  };

  const handleRestoreInvoice = (invoice) => {
    const invoiceId = String(invoice?.id || invoice?.number || '');
    setSalesExclusions((currentExclusions) => {
      const next = { ...currentExclusions };
      delete next[invoiceId];
      return next;
    });
    showNotification(`Invoice #${invoice?.number || invoice?.id || ''} restored to GST calculation.`);
  };

  const handleDeletePurchaseRecord = async (record) => {
    const confirmed = window.confirm('Delete this manual purchase GST record? This does not reverse any stock previously added.');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('gst_records').delete().eq('id', record.id);
      if (error) throw error;

      const nextRecords = safeGstRecords.filter((entry) => entry?.id !== record.id);
      if (sys?.setGstRecords) {
        sys.setGstRecords(nextRecords);
      }
      showNotification('Purchase GST record deleted.', 'warning');
    } catch (error) {
      console.error('Unable to delete GST record:', error);
      showNotification(error?.message || 'Unable to delete GST record.', 'error');
    }
  };

  const handleSavePurchase = async (purchase) => {
    const supplier = safeSuppliers.find((entry) => String(entry?.id || getSupplierName(entry)) === String(purchase.supplierId));
    const supplierName = getSupplierName(supplier);
    const purchaseRecordId = `purchase_${Date.now()}`;

    const purchasedItemNames = purchase.items.map((line) => {
      const product = safeInventory.find((entry) => String(getInventoryIdentity(entry)) === String(line.productId));
      return `${getInventoryName(product)} x ${line.quantity}`;
    });

    const gstRecord = {
      id: purchaseRecordId,
      date: purchase.invoiceDate,
      type: 'input',
      desc: `${supplierName} • Invoice ${purchase.supplierInvoiceNumber} • ${purchasedItemNames.join(', ')}`,
      category: purchase.category,
      amount: Number(purchase.subtotal.toFixed(2)),
      gst: Number(purchase.gstAmount.toFixed(2)),
    };

    const { error: gstError } = await supabase.from('gst_records').insert([gstRecord]);
    if (gstError) throw gstError;

    const updatedInventory = [...safeInventory];

    for (const line of purchase.items) {
      const productIndex = updatedInventory.findIndex((entry) => String(getInventoryIdentity(entry)) === String(line.productId));
      if (productIndex === -1) continue;

      const product = updatedInventory[productIndex];
      const currentStock = toMoneyNumber(product?.stock ?? product?.Stock);
      const nextStock = currentStock + toMoneyNumber(line.quantity);
      const costPrice = toMoneyNumber(line.unitCost);

      const payload = {
        stock: nextStock,
        'cost_price (SGD)': costPrice,
      };

      let updateQuery = supabase.from('product_list').update(payload);
      if (product?.id) {
        updateQuery = updateQuery.eq('id', product.id);
      } else if (product?.Name || product?.name || product?.Items) {
        updateQuery = updateQuery.eq('Name', getInventoryName(product));
      } else {
        continue;
      }

      const { data, error } = await updateQuery.select().single();
      if (error) throw error;

      updatedInventory[productIndex] = {
        ...product,
        ...(data || {}),
        stock: nextStock,
        'cost_price (SGD)': costPrice,
      };
    }

    if (sys?.setGstRecords) {
      sys.setGstRecords([...safeGstRecords, gstRecord]);
    }
    if (sys?.setInventory) {
      sys.setInventory(updatedInventory);
    }

    setIsPurchaseModalOpen(false);
    showNotification('Purchase posted, input GST recorded, and inventory stock increased.');
  };

  const netTone = report.netPayable >= 0 ? 'red' : 'emerald';

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          #gst-quarter-report { width: 100% !important; }
        }
      `}</style>
    <div className="min-h-full space-y-6 bg-slate-50/60 p-8">
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-600 p-3 text-white shadow-lg shadow-indigo-500/20">
              <ReceiptText size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Quarterly GST Centre</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Automated sales GST, manual supplier purchases, and quarterly tax overview.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            <CalendarRange size={17} className="ml-2 text-indigo-600" />
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="rounded-lg border-none bg-transparent px-2 py-2 text-sm font-black text-slate-700 outline-none"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={selectedQuarter}
              onChange={(event) => setSelectedQuarter(event.target.value)}
              className="rounded-lg border-none bg-slate-100 px-3 py-2 text-sm font-black text-slate-700 outline-none"
            >
              {QUARTERS.map((quarter) => (
                <option key={quarter.value} value={quarter.value}>{quarter.label}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          icon={TrendingUp}
          label="Output GST"
          value={`$${formatMoney(report.outputGst)}`}
          helper={`${report.includedSalesCount} included sales invoice${report.includedSalesCount === 1 ? '' : 's'}`}
          tone="indigo"
        />
        <DashboardCard
          icon={TrendingDown}
          label="Input GST"
          value={`$${formatMoney(report.inputGst)}`}
          helper={`${report.purchaseCount} supplier purchase record${report.purchaseCount === 1 ? '' : 's'}`}
          tone="emerald"
        />
        <DashboardCard
          icon={CircleDollarSign}
          label={report.netPayable >= 0 ? 'Net GST Payable' : 'GST Refund Claimable'}
          value={`$${formatMoney(Math.abs(report.netPayable))}`}
          helper={report.netPayable >= 0 ? 'Estimated amount owed to IRAS' : 'Estimated amount claimable from IRAS'}
          tone={netTone}
        />
        <DashboardCard
          icon={AlertCircle}
          label="Review Required"
          value={String(report.reviewCount + report.excludedSalesCount)}
          helper={`${report.reviewCount} GST fallback • ${report.excludedSalesCount} excluded`}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Taxable Sales</p>
              <p className="mt-2 font-mono text-2xl font-black text-slate-900">${formatMoney(report.taxableSales)}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600"><BarChart3 size={22} /></div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Taxable Purchases</p>
              <p className="mt-2 font-mono text-2xl font-black text-slate-900">${formatMoney(report.taxablePurchases)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><ShoppingCart size={22} /></div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.min(100, report.taxableSales > 0 ? (report.taxablePurchases / report.taxableSales) * 100 : 0)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'overview', label: 'Overview', icon: BarChart3 },
              { value: 'sales', label: 'Sales GST', icon: FileText },
              { value: 'purchases', label: 'Purchase GST', icon: ShoppingCart },
              { value: 'report', label: 'GST Report', icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex items-center rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
                    activeTab === tab.value
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-500 hover:bg-white hover:text-slate-800'
                  }`}
                >
                  <Icon size={14} className="mr-2" /> {tab.label}
                </button>
              );
            })}
          </div>
          <div className="text-xs font-bold text-slate-400">
            {quarterRange.start.toLocaleDateString('en-SG')} – {quarterRange.end.toLocaleDateString('en-SG')}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Sales GST Snapshot</h3>
                  <p className="mt-1 text-xs font-medium text-slate-400">Latest automated sales invoices in this quarter.</p>
                </div>
                <button type="button" onClick={() => setActiveTab('sales')} className="text-xs font-black text-indigo-600 hover:text-indigo-800">View all</button>
              </div>
              <div className="divide-y divide-slate-100">
                {salesRows.slice(0, 5).map((row) => (
                  <div key={row.invoiceId} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="text-sm font-black text-slate-800">#{row.invoice?.number || row.invoice?.id}</p>
                      <p className="mt-1 text-xs font-medium text-slate-400">{row.invoice?.customer || 'Unknown customer'} • {row.invoice?.date || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-sm font-black ${row.isExcluded ? 'text-slate-400 line-through' : 'text-indigo-600'}`}>${formatMoney(row.gstAmount)}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{row.isExcluded ? 'Excluded' : row.gstSource}</p>
                    </div>
                  </div>
                ))}
                {salesRows.length === 0 && <EmptyState title="No sales invoices" description="No sales invoices fall inside this quarter." />}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Purchase GST Snapshot</h3>
                  <p className="mt-1 text-xs font-medium text-slate-400">Latest manually entered supplier purchase records.</p>
                </div>
                <button type="button" onClick={() => setActiveTab('purchases')} className="text-xs font-black text-emerald-600 hover:text-emerald-800">View all</button>
              </div>
              <div className="divide-y divide-slate-100">
                {purchaseRows.slice(0, 5).map((record) => (
                  <div key={record.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-800">{record.desc || 'Supplier purchase'}</p>
                      <p className="mt-1 text-xs font-medium text-slate-400">{record.category || 'Purchase'} • {record.date || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-black text-emerald-600">${formatMoney(record.gst)}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Input GST</p>
                    </div>
                  </div>
                ))}
                {purchaseRows.length === 0 && <EmptyState title="No purchase GST records" description="Register a supplier purchase to record input GST and stock-in items." />}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div>
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center">
              <div className="flex w-full max-w-lg items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-100">
                <Search size={16} className="mr-2 text-slate-400" />
                <input
                  value={salesSearch}
                  onChange={(event) => setSalesSearch(event.target.value)}
                  placeholder="Search invoice number, customer, or date..."
                  className="w-full bg-transparent text-sm font-medium outline-none"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-black text-slate-500">
                <input
                  type="checkbox"
                  checked={showExcludedSales}
                  onChange={(event) => setShowExcludedSales(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Show excluded invoices
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left">
                <thead className="border-b bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="p-4 pl-6">Invoice</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4 text-right">Subtotal</th>
                    <th className="p-4 text-right">GST</th>
                    <th className="p-4 text-right">Total</th>
                    <th className="p-4 text-center">GST Source</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 pr-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredSalesRows.map((row) => (
                    <tr key={row.invoiceId} className={`transition-colors ${row.isExcluded ? 'bg-slate-50 opacity-70' : 'hover:bg-indigo-50/40'}`}>
                      <td className="p-4 pl-6 font-mono font-black text-indigo-600">#{row.invoice?.number || row.invoice?.id || '-'}</td>
                      <td className="p-4 font-semibold text-slate-500">{row.invoice?.date || '-'}</td>
                      <td className="p-4 font-black text-slate-800">{row.invoice?.customer || 'Unknown customer'}</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-600">${formatMoney(row.subtotal)}</td>
                      <td className="p-4 text-right font-mono font-black text-indigo-600">${formatMoney(row.gstAmount)}</td>
                      <td className="p-4 text-right font-mono font-black text-slate-900">${formatMoney(row.total)}</td>
                      <td className="p-4 text-center">
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
                          row.gstSource === 'saved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {row.gstSource === 'saved' ? 'Saved GST' : 'Fallback'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {row.isExcluded ? (
                          <div>
                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-600">Excluded</span>
                            <p className="mt-1 text-[10px] font-semibold text-slate-400">{row.exclusion?.reason}</p>
                          </div>
                        ) : (
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-700">Included</span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-center">
                        {row.isExcluded ? (
                          <button
                            type="button"
                            onClick={() => handleRestoreInvoice(row.invoice)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExclusionInvoice(row.invoice)}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 hover:bg-amber-100"
                          >
                            Exclude
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredSalesRows.length === 0 && (
                    <tr><td colSpan="9"><EmptyState title="No matching sales invoices" description="Adjust the quarter or search term to view automated sales GST records." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="p-5">
            <GstQuarterReport
              report={report}
              monthlyReport={monthlyReport}
              salesRows={salesRows}
              purchaseRows={purchaseRows}
            />
          </div>
        )}

        {activeTab === 'purchases' && (
          <div className="space-y-5 p-5">
            {sys?.hasPerm?.('manage_gst') && (
              <PurchaseEntryTable
                suppliers={safeSuppliers}
                inventory={safeInventory}
                onPost={handleSavePurchase}
              />
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Posted Purchase GST</h3>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    Saved supplier purchases for the selected quarter.
                  </p>
                </div>
                <div className="flex w-full max-w-lg items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-emerald-100">
                  <Search size={16} className="mr-2 text-slate-400" />
                  <input
                    value={purchaseSearch}
                    onChange={(event) => setPurchaseSearch(event.target.value)}
                    placeholder="Search supplier, category, invoice, or date..."
                    className="w-full bg-transparent text-sm font-medium outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-left">
                  <thead className="border-b bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="p-4 pl-6">Date</th>
                      <th className="p-4">Supplier / Purchase Details</th>
                      <th className="p-4">Category</th>
                      <th className="p-4 text-right">Value ex-GST</th>
                      <th className="p-4 text-right">Input GST</th>
                      <th className="p-4 text-right">Total</th>
                      <th className="p-4 pr-6 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredPurchaseRows.map((record) => {
                      const amount = toMoneyNumber(record?.amount);
                      const gst = toMoneyNumber(record?.gst);
                      return (
                        <tr key={record.id} className="hover:bg-emerald-50/40">
                          <td className="p-4 pl-6 font-bold text-slate-500">{record.date || '-'}</td>
                          <td className="p-4 font-black text-slate-800">{record.desc || 'Supplier purchase'}</td>
                          <td className="p-4 font-bold text-slate-500">{record.category || 'Purchase'}</td>
                          <td className="p-4 text-right font-mono font-bold text-slate-600">${formatMoney(amount)}</td>
                          <td className="p-4 text-right font-mono font-black text-emerald-600">${formatMoney(gst)}</td>
                          <td className="p-4 text-right font-mono font-black text-slate-900">${formatMoney(amount + gst)}</td>
                          <td className="p-4 pr-6 text-center">
                            {sys?.hasPerm?.('manage_gst') ? (
                              <button
                                type="button"
                                onClick={() => handleDeletePurchaseRecord(record)}
                                className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={17} />
                              </button>
                            ) : (
                              <Info size={16} className="inline text-slate-300" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredPurchaseRows.length === 0 && (
                      <tr>
                        <td colSpan="7">
                          <EmptyState title="No purchase GST records" description="Enter a purchase in the spreadsheet above to capture input GST." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-800">
        <div className="flex items-start gap-3">
          <Info size={19} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <p className="font-black">Temporary database compatibility mode</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-blue-700">
              Purchase GST is stored in your existing <code>gst_records</code> table and stock is updated in <code>product_list</code>. Sales exclusions are browser-local until the Supabase adjustment table is added. Formal purchase invoices, line items, stock movements, and shared exclusions should be added in the next database migration.
            </p>
          </div>
        </div>
      </div>

      {exclusionInvoice && (
        <SalesExclusionModal
          invoice={exclusionInvoice}
          existing={salesExclusions[String(exclusionInvoice?.id || exclusionInvoice?.number || '')]}
          onClose={() => setExclusionInvoice(null)}
          onSave={(details) => handleExcludeInvoice(exclusionInvoice, details)}
        />
      )}

      {notification && (
        <div className={`fixed bottom-8 left-1/2 z-[8000] flex -translate-x-1/2 items-center rounded-xl px-6 py-3 text-sm font-bold text-white shadow-2xl ${
          notification.type === 'error'
            ? 'bg-red-600'
            : notification.type === 'warning'
              ? 'bg-amber-600'
              : 'bg-emerald-600'
        }`}>
          {notification.type === 'error' ? <AlertCircle size={18} className="mr-2" /> : <CheckCircle2 size={18} className="mr-2" />}
          {notification.message}
        </div>
      )}
    </div>
    </>
  );
}
