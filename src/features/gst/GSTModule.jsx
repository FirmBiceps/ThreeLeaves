import React, { useEffect, useMemo, useState } from 'react';
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

// The report uses the browser's native print engine so users can print
// directly or choose "Save as PDF" without adding another PDF dependency.

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

function roundMoney(value) {
  return Math.round((toMoneyNumber(value) + Number.EPSILON) * 100) / 100;
}

function getInvoiceDisplayNumber(invoiceOrRow) {
  const invoice = invoiceOrRow?.invoice || invoiceOrRow;
  return String(invoice?.number || invoice?.invoiceNumber || invoice?.invoice_no || invoice?.id || '').trim();
}

function compareInvoiceNumbers(left, right) {
  const leftNumber = getInvoiceDisplayNumber(left);
  const rightNumber = getInvoiceDisplayNumber(right);

  const byNumber = leftNumber.localeCompare(rightNumber, undefined, {
    numeric: true,
    sensitivity: 'base',
  });

  if (byNumber !== 0) return byNumber;

  const leftDate = new Date(left?.invoice?.date || left?.date || 0).getTime();
  const rightDate = new Date(right?.invoice?.date || right?.date || 0).getTime();
  return leftDate - rightDate;
}

function parseInvoiceSequence(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const match = raw.match(/^(.*?)(\d+)$/);
  if (!match) return null;

  const prefix = match[1].replace(/[\s#._-]+$/, '').toUpperCase();
  const number = Number(match[2]);
  if (!Number.isSafeInteger(number)) return null;

  return {
    raw,
    prefix,
    number,
    width: match[2].length,
  };
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

function getSupplierGstRegistrationNumber(supplier) {
  return String(
    supplier?.gst_registration_number ||
    supplier?.gstRegistrationNumber ||
    supplier?.gst_reg_no ||
    supplier?.gstRegNo ||
    supplier?.gst_number ||
    supplier?.gstNumber ||
    supplier?.GSTRegistrationNumber ||
    supplier?.GST ||
    ''
  );
}

function getInvoiceDescription(invoice) {
  const explicit = invoice?.description || invoice?.Description || invoice?.remarks || invoice?.notes;
  if (explicit) return String(explicit);

  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  if (items.length > 0) {
    return items
      .map((item) => {
        const name = item?.description || item?.name || item?.Name || item?.productName || item?.product || item?.Items || 'Item';
        const qty = item?.qty ?? item?.quantity;
        return qty !== undefined && qty !== null && qty !== '' ? `${name} x ${qty}` : String(name);
      })
      .join(', ');
  }

  return 'Sales invoice';
}

function getInvoiceDestination(invoice) {
  return String(
    invoice?.destinationOfGoods ||
    invoice?.destination ||
    invoice?.shippingAddress ||
    invoice?.deliveryAddress ||
    invoice?.delivery_address ||
    ''
  );
}

function getPurchaseInvoiceNumber(record) {
  if (record?.supplierInvoiceNumber || record?.invoiceNumber || record?.invoice_no) {
    return String(record?.supplierInvoiceNumber || record?.invoiceNumber || record?.invoice_no);
  }

  const description = String(record?.desc || '');
  const match = description.match(/\bInvoice\s+(.+?)(?:\s+•|$)/i);
  return match?.[1] || '';
}

function getPurchaseSupplierName(record) {
  if (record?.supplierName || record?.supplier || record?.supplier_name) {
    return String(record?.supplierName || record?.supplier || record?.supplier_name);
  }

  const description = String(record?.desc || '');
  const separatorIndex = description.indexOf(' • Invoice');
  return separatorIndex > -1 ? description.slice(0, separatorIndex).trim() : 'Supplier purchase';
}

function getPurchaseSupplierGstRegistrationNumber(record) {
  return String(
    record?.supplierGstRegistrationNumber ||
    record?.supplier_gst_registration_number ||
    record?.supplierGstNo ||
    record?.supplier_gst_no ||
    record?.gstRegistrationNumber ||
    ''
  );
}

function getPurchaseDescription(record) {
  if (record?.description) return String(record.description);

  const description = String(record?.desc || '');
  const match = description.match(/\bInvoice\s+.+?\s+•\s+(.+)$/i);
  return match?.[1] || description || 'Supplier purchase';
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

function GstQuarterReport({ report, monthlyReport, salesRows, purchaseRows, creditNotes = [], onPrint }) {
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(true);
  const [showPurchaseDetail, setShowPurchaseDetail] = useState(true);

  const includedSales = salesRows.filter((row) => !row.isExcluded);
  const excludedSales = salesRows.filter((row) => row.isExcluded);

  const monthLookup = useMemo(() => {
    const map = new Map();
    monthlyReport.forEach((month) => map.set(month.key, month));
    return map;
  }, [monthlyReport]);

  const getRowMonthKey = (row, type = 'sales') => {
    const value = type === 'purchase'
      ? (row.purchase_date || row.invoice_date || row.date || row.created_at)
      : (row.invoice?.date || row.date || row.created_at);
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const groupedSales = useMemo(() => {
    const groups = new Map();
    includedSales.forEach((row) => {
      const key = getRowMonthKey(row, 'sales');
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: monthLookup.get(key)?.label || key || 'Unassigned Month',
          rows: [],
          subtotal: 0,
          gst: 0,
          total: 0,
        });
      }
      const group = groups.get(key);
      group.rows.push(row);
      group.subtotal += Number(row.subtotal || 0);
      group.gst += Number(row.gstAmount || 0);
      group.total += Number(row.total || 0);
    });
    groups.forEach((group) => {
      group.rows.sort(compareInvoiceNumbers);
    });

    return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [includedSales, monthLookup]);

  const groupedPurchases = useMemo(() => {
    const groups = new Map();
    purchaseRows.forEach((row) => {
      const key = getRowMonthKey(row, 'purchase');
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: monthLookup.get(key)?.label || key || 'Unassigned Month',
          rows: [],
          subtotal: 0,
          gst: 0,
          total: 0,
        });
      }
      const group = groups.get(key);
      group.rows.push(row);
      group.subtotal += Number(row.amount || 0);
      group.gst += Number(row.gst || 0);
      group.total += Number(row.amount || 0) + Number(row.gst || 0);
    });
    return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [purchaseRows, monthLookup]);

  const money = (value) => `$${formatMoney(value)}`;

  return (
    <div className="space-y-6 text-black">
      <div className="no-print flex flex-col gap-3 border-b border-black pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-bold">Quarterly GST Report</h3>
          <p className="mt-1 text-xs text-slate-600">A transaction-backed quarterly schedule for sales GST and purchase GST.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showInvoiceDetail} onChange={(event) => setShowInvoiceDetail(event.target.checked)} />
            Sales detail
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showPurchaseDetail} onChange={(event) => setShowPurchaseDetail(event.target.checked)} />
            Purchase detail
          </label>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center border border-black bg-black px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            <Printer size={14} className="mr-2" /> Print / Save PDF
          </button>
        </div>
      </div>

      <div id="gst-quarter-report" className="bg-white text-black print:p-0">
        <header className="border-b-2 border-black pb-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">Three Leaves</p>
          <h1 className="mt-1 text-xl font-bold">GST Quarterly Report</h1>
          <p className="mt-1 text-sm font-semibold">{report.quarterLabel}</p>
          <p className="mt-1 text-[11px] text-slate-600">Sales GST and Purchase GST Supporting Schedule</p>
        </header>

        <section className="mt-5">
          <div className="border-y-2 border-black py-2">
            <h2 className="text-sm font-bold">Quarter Summary</h2>
          </div>

          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-black">
                <th className="px-2 py-2 text-left font-bold">GST Account</th>
                {monthlyReport.map((month) => (
                  <th key={month.key} className="px-2 py-2 text-right font-bold">{month.label}</th>
                ))}
                <th className="px-2 py-2 text-right font-bold">Quarter Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="px-2 py-2 font-semibold">Sales invoices</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">{month.salesCount}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono font-bold">{report.includedSalesCount}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="px-2 py-2 font-semibold">Gross sales value ex-GST</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">{money(month.salesSubtotal)}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono font-bold">{money(report.grossTaxableSales)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="px-2 py-2 font-semibold">Less: sales returns / credit notes ex-GST</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">-{money(month.creditNoteSubtotal)}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono font-bold">-{money(report.creditNoteSubtotal)}</td>
              </tr>
              <tr className="border-b border-slate-300 font-bold">
                <td className="px-2 py-2">Adjusted sales value ex-GST</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">{money(month.adjustedSalesSubtotal)}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono">{money(report.taxableSales)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="px-2 py-2 font-semibold">Gross Output GST — Sales</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">{money(month.salesGst)}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono font-bold">{money(report.grossOutputGst)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="px-2 py-2 font-semibold">Less: GST reversed on sales returns</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">-{money(month.creditNoteGst)}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono font-bold">-{money(report.creditNoteGst)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="px-2 py-2 font-semibold">Adjusted Output GST — Sales</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">{money(month.salesGst - month.creditNoteGst)}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono font-bold">{money(report.outputGst)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="px-2 py-2 font-semibold">Purchase records</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">{month.purchaseCount}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono font-bold">{report.purchaseCount}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="px-2 py-2 font-semibold">Input GST — Purchases</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">{money(month.purchaseGst)}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono font-bold">{money(report.inputGst)}</td>
              </tr>
              <tr className="border-t-2 border-black font-bold">
                <td className="px-2 py-2">Net GST {report.netPayable >= 0 ? 'Payable' : 'Claimable'}</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">{money(month.salesGst - month.creditNoteGst - month.purchaseGst)}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono">{money(Math.abs(report.netPayable))}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {showInvoiceDetail && (
          <section className="mt-7 print-page-break">
            <div className="border-y-2 border-black py-2">
              <h2 className="text-sm font-bold">Sales GST Listing</h2>
              <p className="mt-1 text-[10px] text-slate-600">Invoice-level figures only; ordered-item details are intentionally omitted.</p>
            </div>

            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-black">
                  <th className="px-2 py-2 text-left font-bold">Type</th>
                  <th className="px-2 py-2 text-left font-bold">Date</th>
                  <th className="px-2 py-2 text-left font-bold">Invoice No.</th>
                  <th className="px-2 py-2 text-left font-bold">Customer</th>
                  <th className="px-2 py-2 text-right font-bold">Value ex-GST</th>
                  <th className="px-2 py-2 text-right font-bold">GST</th>
                  <th className="px-2 py-2 text-right font-bold">Invoice Total</th>
                </tr>
              </thead>
              <tbody>
                {groupedSales.map((group) => (
                  <React.Fragment key={`sales-group-${group.key}`}>
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan="7" className="border-y border-slate-300 px-2 py-2">{group.label}</td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={`report-sales-${row.invoiceId}`} className="border-b border-slate-200">
                        <td className="px-2 py-1.5">Invoice</td>
                        <td className="px-2 py-1.5">{row.invoice?.date || '-'}</td>
                        <td className="px-2 py-1.5 font-mono">#{row.invoice?.number || row.invoice?.id || '-'}</td>
                        <td className="px-2 py-1.5">{row.invoice?.customer || 'Unknown customer'}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{money(row.subtotal)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{money(row.gstAmount)}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold">{money(row.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-black bg-slate-50 font-semibold">
                      <td colSpan="4" className="px-2 py-1.5">Total {group.label}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{money(group.subtotal)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{money(group.gst)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{money(group.total)}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan="4" className="px-2 py-2">Total Sales</td>
                  <td className="px-2 py-2 text-right font-mono">{money(report.taxableSales)}</td>
                  <td className="px-2 py-2 text-right font-mono">{money(report.outputGst)}</td>
                  <td className="px-2 py-2 text-right font-mono">{money(report.taxableSales + report.outputGst)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        {creditNotes.length > 0 && (
          <section className="mt-7 print-page-break">
            <div className="border-y-2 border-black py-2">
              <h2 className="text-sm font-bold">Sales Returns / Credit Notes</h2>
              <p className="mt-1 text-[10px] text-slate-600">Credit note GST is deducted from output GST in the period the credit note is issued.</p>
            </div>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead><tr className="border-b border-black">
                <th className="px-2 py-2 text-left font-bold">Date</th>
                <th className="px-2 py-2 text-left font-bold">Credit Note</th>
                <th className="px-2 py-2 text-left font-bold">Invoice No.</th>
                <th className="px-2 py-2 text-left font-bold">Customer</th>
                <th className="px-2 py-2 text-right font-bold">Value ex-GST</th>
                <th className="px-2 py-2 text-right font-bold">GST Reversed</th>
                <th className="px-2 py-2 text-right font-bold">Credit Total</th>
              </tr></thead>
              <tbody>
                {[...creditNotes].sort((a,b) => String(a.credit_note_number || '').localeCompare(String(b.credit_note_number || ''), undefined, { numeric: true, sensitivity: 'base' })).map((note) => (
                  <tr key={note.id} className="border-b border-slate-200">
                    <td className="px-2 py-1.5">{note.credit_note_date || '-'}</td>
                    <td className="px-2 py-1.5 font-mono">{note.credit_note_number}</td>
                    <td className="px-2 py-1.5 font-mono">#{note.invoice_number}</td>
                    <td className="px-2 py-1.5">{note.customer_name || '-'}</td>
                    <td className="px-2 py-1.5 text-right font-mono">-{money(note.subtotal_ex_gst)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">-{money(note.gst_amount)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">-{money(note.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-black font-bold">
                <td colSpan="4" className="px-2 py-2">Total Credit Notes</td>
                <td className="px-2 py-2 text-right font-mono">-{money(report.creditNoteSubtotal)}</td>
                <td className="px-2 py-2 text-right font-mono">-{money(report.creditNoteGst)}</td>
                <td className="px-2 py-2 text-right font-mono">-{money(report.creditNoteSubtotal + report.creditNoteGst)}</td>
              </tr></tfoot>
            </table>
          </section>
        )}

        {showPurchaseDetail && (
          <section className="mt-7 print-page-break">
            <div className="border-y-2 border-black py-2">
              <h2 className="text-sm font-bold">Purchase GST Listing</h2>
              <p className="mt-1 text-[10px] text-slate-600">Invoice-level purchase figures supporting input GST.</p>
            </div>

            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-black">
                  <th className="px-2 py-2 text-left font-bold">Type</th>
                  <th className="px-2 py-2 text-left font-bold">Date</th>
                  <th className="px-2 py-2 text-left font-bold">Supplier Invoice</th>
                  <th className="px-2 py-2 text-left font-bold">Supplier</th>
                  <th className="px-2 py-2 text-left font-bold">GST Reg. No.</th>
                  <th className="px-2 py-2 text-right font-bold">Value ex-GST</th>
                  <th className="px-2 py-2 text-right font-bold">GST</th>
                </tr>
              </thead>
              <tbody>
                {groupedPurchases.map((group) => (
                  <React.Fragment key={`purchase-group-${group.key}`}>
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan="7" className="border-y border-slate-300 px-2 py-2">{group.label}</td>
                    </tr>
                    {group.rows.map((row, index) => (
                      <tr key={`report-purchase-${row.id || index}`} className="border-b border-slate-200">
                        <td className="px-2 py-1.5">Purchase</td>
                        <td className="px-2 py-1.5">{row.date || row.purchase_date || row.invoice_date || '-'}</td>
                        <td className="px-2 py-1.5 font-mono">{getPurchaseInvoiceNumber(row)}</td>
                        <td className="px-2 py-1.5">{getPurchaseSupplierName(row)}</td>
                        <td className="px-2 py-1.5">{getPurchaseSupplierGstRegistrationNumber(row)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{money(row.amount)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{money(row.gst)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-black bg-slate-50 font-semibold">
                      <td colSpan="5" className="px-2 py-1.5">Total {group.label}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{money(group.subtotal)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{money(group.gst)}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan="5" className="px-2 py-2">Total Purchases</td>
                  <td className="px-2 py-2 text-right font-mono">{money(purchaseRows.reduce((sum, row) => sum + Number(row.amount || 0), 0))}</td>
                  <td className="px-2 py-2 text-right font-mono">{money(report.inputGst)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        {excludedSales.length > 0 && (
          <section className="mt-7 print-page-break">
            <div className="border-y-2 border-black py-2">
              <h2 className="text-sm font-bold">Excluded Sales Audit Trail</h2>
            </div>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-black">
                  <th className="px-2 py-2 text-left font-bold">Date</th>
                  <th className="px-2 py-2 text-left font-bold">Invoice No.</th>
                  <th className="px-2 py-2 text-left font-bold">Customer</th>
                  <th className="px-2 py-2 text-left font-bold">Reason</th>
                  <th className="px-2 py-2 text-right font-bold">GST</th>
                </tr>
              </thead>
              <tbody>
                {excludedSales.map((row) => (
                  <tr key={`excluded-${row.invoiceId}`} className="border-b border-slate-200">
                    <td className="px-2 py-1.5">{row.invoice?.date || '-'}</td>
                    <td className="px-2 py-1.5 font-mono">#{row.invoice?.number || row.invoice?.id || '-'}</td>
                    <td className="px-2 py-1.5">{row.invoice?.customer || '-'}</td>
                    <td className="px-2 py-1.5">{row.exclusionReason || 'Excluded'}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{money(row.gstAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-8 border-t border-black pt-3 text-[10px] text-slate-600">
          <div className="flex justify-between gap-4">
            <span>Generated from Three Leaves ERP transaction records.</span>
            <span>Supporting GST schedule — retain with source invoices and purchase documents.</span>
          </div>
        </footer>
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
  const [creditNotes, setCreditNotes] = useState([]);
  const [creditNotesLoading, setCreditNotesLoading] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    const loadCreditNotes = async () => {
      setCreditNotesLoading(true);
      try {
        const { data, error } = await supabase
          .from('credit_notes')
          .select('id, credit_note_number, invoice_id, invoice_number, customer_name, credit_note_date, subtotal_ex_gst, gst_amount, total_amount, status, reason')
          .gte('credit_note_date', quarterRange.start.toISOString().slice(0, 10))
          .lte('credit_note_date', quarterRange.end.toISOString().slice(0, 10))
          .eq('status', 'issued')
          .order('credit_note_date', { ascending: true });

        if (error) throw error;
        if (!cancelled) setCreditNotes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.warn('GST credit-note adjustments unavailable:', error);
        if (!cancelled) setCreditNotes([]);
      } finally {
        if (!cancelled) setCreditNotesLoading(false);
      }
    };

    loadCreditNotes();
    return () => { cancelled = true; };
  }, [quarterRange]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    window.setTimeout(() => setNotification(null), 5000);
  };

  const salesRows = useMemo(() => {
    return safeInvoices
      .filter((invoice) => isDateInRange(invoice?.date, quarterRange))
      .map((invoice) => {
        const invoiceId = String(invoice?.id || invoice?.number || '');
        const subtotal = roundMoney(getInvoiceSubtotal(invoice));
        const gstResult = getInvoiceGst(invoice);
        const savedTotal = toMoneyNumber(invoice?.total);
        const total = roundMoney(savedTotal || (subtotal + gstResult.amount));
        const gstAmount = roundMoney(
          savedTotal > 0 && subtotal > 0 && gstResult.source !== 'saved'
            ? total - subtotal
            : gstResult.amount
        );
        const exclusion = salesExclusions[invoiceId] || null;

        return {
          invoice,
          invoiceId,
          subtotal,
          gstAmount,
          gstSource: gstResult.source,
          total,
          exclusion,
          isExcluded: Boolean(exclusion),
        };
      })
      .sort(compareInvoiceNumbers);
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

    const grossTaxableSales = includedSales.reduce((sum, row) => sum + row.subtotal, 0);
    const grossOutputGst = includedSales.reduce((sum, row) => sum + row.gstAmount, 0);
    const creditNoteSubtotal = creditNotes.reduce((sum, note) => sum + roundMoney(note?.subtotal_ex_gst), 0);
    const creditNoteGst = creditNotes.reduce((sum, note) => sum + roundMoney(note?.gst_amount), 0);
    const taxableSales = Math.max(0, roundMoney(grossTaxableSales - creditNoteSubtotal));
    const outputGst = Math.max(0, roundMoney(grossOutputGst - creditNoteGst));
    const taxablePurchases = purchaseRows.reduce((sum, record) => sum + roundMoney(record?.amount), 0);
    const inputGst = purchaseRows.reduce((sum, record) => sum + roundMoney(record?.gst), 0);
    const reviewCount = salesRows.filter((row) => row.gstSource !== 'saved').length;

    return {
      taxableSales,
      grossTaxableSales,
      outputGst,
      grossOutputGst,
      creditNoteSubtotal,
      creditNoteGst,
      creditNoteCount: creditNotes.length,
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
  }, [salesRows, purchaseRows, creditNotes, selectedYear, selectedQuarter]);


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
        adjustedSalesSubtotal: 0,
        adjustedSalesGst: 0,
        creditNoteCount: creditNotes.filter((note) => {
          const date = new Date(note?.credit_note_date || '');
          return date.getFullYear() === Number(selectedYear) && date.getMonth() === monthIndex;
        }).length,
        creditNoteSubtotal: creditNotes.filter((note) => {
          const date = new Date(note?.credit_note_date || '');
          return date.getFullYear() === Number(selectedYear) && date.getMonth() === monthIndex;
        }).reduce((sum, note) => sum + roundMoney(note?.subtotal_ex_gst), 0),
        creditNoteGst: creditNotes.filter((note) => {
          const date = new Date(note?.credit_note_date || '');
          return date.getFullYear() === Number(selectedYear) && date.getMonth() === monthIndex;
        }).reduce((sum, note) => sum + roundMoney(note?.gst_amount), 0),
        purchaseCount: monthPurchases.length,
        purchaseSubtotal: monthPurchases.reduce((sum, row) => sum + roundMoney(row?.amount), 0),
        purchaseGst: monthPurchases.reduce((sum, row) => sum + roundMoney(row?.gst), 0),
      };
      month.adjustedSalesSubtotal = Math.max(0, roundMoney(month.salesSubtotal - month.creditNoteSubtotal));
      month.adjustedSalesGst = Math.max(0, roundMoney(month.salesGst - month.creditNoteGst));
      return month;
    });
  }, [selectedYear, selectedQuarter, salesRows, purchaseRows, creditNotes]);

  const reviewIssues = useMemo(() => {
    const issues = [];

    const allInvoiceNumbers = salesRows
      .map((row) => getInvoiceDisplayNumber(row))
      .filter(Boolean);

    const duplicateMap = new Map();
    allInvoiceNumbers.forEach((number) => {
      const key = number.toUpperCase();
      duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1);
    });

    const duplicateNumbers = Array.from(duplicateMap.entries())
      .filter(([, count]) => count > 1)
      .map(([number, count]) => ({ number, count }));

    if (duplicateNumbers.length > 0) {
      issues.push({
        id: 'duplicate-invoices',
        severity: 'high',
        title: 'Duplicate invoice numbers detected',
        detail: `${duplicateNumbers.length} invoice number${duplicateNumbers.length === 1 ? '' : 's'} appear more than once in this quarter.`,
        action: 'sales',
      });
    }

    const sequences = new Map();
    salesRows.forEach((row) => {
      const parsed = parseInvoiceSequence(getInvoiceDisplayNumber(row));
      if (!parsed) return;
      const key = parsed.prefix;
      if (!sequences.has(key)) sequences.set(key, []);
      sequences.get(key).push(parsed);
    });

    const gapGroups = [];
    sequences.forEach((entries, prefix) => {
      const uniqueNumbers = Array.from(new Set(entries.map((entry) => entry.number))).sort((a, b) => a - b);
      if (uniqueNumbers.length < 3) return;

      const min = uniqueNumbers[0];
      const max = uniqueNumbers[uniqueNumbers.length - 1];
      if (max - min > 500) return;

      const present = new Set(uniqueNumbers);
      const missing = [];
      for (let number = min + 1; number < max && missing.length < 12; number += 1) {
        if (!present.has(number)) missing.push(number);
      }

      if (missing.length > 0) {
        gapGroups.push({ prefix, missing, totalGapCount: Math.max(0, max - min + 1 - uniqueNumbers.length) });
      }
    });

    if (gapGroups.length > 0) {
      const examples = gapGroups
        .flatMap((group) => group.missing.map((number) => `${group.prefix}${String(number).padStart(3, '0')}`))
        .slice(0, 6);
      const totalGaps = gapGroups.reduce((sum, group) => sum + group.totalGapCount, 0);

      issues.push({
        id: 'invoice-gaps',
        severity: 'medium',
        title: 'Potential missing invoice numbers',
        detail: `${totalGaps} possible gap${totalGaps === 1 ? '' : 's'} detected in the invoice sequence${examples.length ? ` (e.g. ${examples.join(', ')})` : ''}. Check whether these were cancelled, voided, or omitted.`,
        action: 'sales',
      });
    }

    const fallbackCount = salesRows.filter((row) => !row.isExcluded && row.gstSource !== 'saved').length;
    if (fallbackCount > 0) {
      issues.push({
        id: 'gst-fallback',
        severity: 'medium',
        title: 'Some sales GST values were derived',
        detail: `${fallbackCount} included invoice${fallbackCount === 1 ? '' : 's'} do not have a saved GST amount and are using a fallback calculation.`,
        action: 'sales',
      });
    }

    const missingCustomerCount = salesRows.filter((row) => !row.isExcluded && !String(row.invoice?.customer || '').trim()).length;
    if (missingCustomerCount > 0) {
      issues.push({
        id: 'missing-customer',
        severity: 'medium',
        title: 'Sales invoices missing customer information',
        detail: `${missingCustomerCount} included invoice${missingCustomerCount === 1 ? '' : 's'} do not have a customer name recorded.`,
        action: 'sales',
      });
    }

    const excludedCount = salesRows.filter((row) => row.isExcluded).length;
    if (excludedCount > 0) {
      issues.push({
        id: 'excluded-sales',
        severity: 'low',
        title: 'Excluded invoices require confirmation',
        detail: `${excludedCount} invoice${excludedCount === 1 ? '' : 's'} are excluded from the GST calculation. Confirm each exclusion is supported before filing.`,
        action: 'sales',
      });
    }

    const missingPurchaseInvoiceCount = purchaseRows.filter((row) => !getPurchaseInvoiceNumber(row)).length;
    if (missingPurchaseInvoiceCount > 0) {
      issues.push({
        id: 'missing-purchase-invoice',
        severity: 'medium',
        title: 'Purchase records missing supplier invoice numbers',
        detail: `${missingPurchaseInvoiceCount} purchase record${missingPurchaseInvoiceCount === 1 ? '' : 's'} do not have a supplier invoice number recorded.`,
        action: 'purchases',
      });
    }

    const missingSupplierGstCount = purchaseRows.filter((row) => !getPurchaseSupplierGstRegistrationNumber(row)).length;
    if (missingSupplierGstCount > 0) {
      issues.push({
        id: 'missing-supplier-gst',
        severity: 'low',
        title: 'Supplier GST registration numbers missing',
        detail: `${missingSupplierGstCount} purchase record${missingSupplierGstCount === 1 ? '' : 's'} do not have a supplier GST registration number recorded.`,
        action: 'purchases',
      });
    }

    return issues;
  }, [salesRows, purchaseRows]);

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
      supplierName,
      supplierInvoiceNumber: purchase.supplierInvoiceNumber,
      supplierGstRegistrationNumber: getSupplierGstRegistrationNumber(supplier),
      description: purchasedItemNames.join(', '),
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

  const handlePrintGSTReport = () => {
    const previousTitle = document.title;
    document.title = `Three Leaves GST ${selectedQuarter} ${selectedYear}`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 1000);
  };

  const netTone = report.netPayable >= 0 ? 'red' : 'emerald';

  return (
    <>
      <style>{`
        @page {
          size: A4 landscape;
          margin: 12mm;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          #gst-quarter-report,
          #gst-quarter-report * {
            visibility: visible !important;
          }

          #gst-quarter-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          #gst-quarter-report table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          #gst-quarter-report th,
          #gst-quarter-report td {
            color: #000 !important;
            background: #fff !important;
          }

          #gst-quarter-report thead {
            display: table-header-group !important;
          }

          #gst-quarter-report tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .print-page-break {
            break-before: page !important;
            page-break-before: always !important;
          }
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
          value={String(reviewIssues.length)}
          helper={`${reviewIssues.length} data check${reviewIssues.length === 1 ? '' : 's'} • ${report.reviewCount} GST fallback • ${report.excludedSalesCount} excluded`}
          tone="amber"
        />
      </div>

      {reviewIssues.length > 0 && (
        <div className="no-print rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-amber-100 bg-amber-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-700"><AlertCircle size={17} /></div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Review before finalising GST</h3>
                <p className="mt-1 text-xs font-medium text-slate-600">Potential data issues were detected. These prompts are for dashboard review only and will not appear in the printed report.</p>
              </div>
            </div>
            <span className="text-xs font-black text-amber-800">{reviewIssues.length} item{reviewIssues.length === 1 ? '' : 's'} to review</span>
          </div>

          <div className="divide-y divide-slate-100">
            {reviewIssues.map((issue) => {
              const severityClass = issue.severity === 'high'
                ? 'bg-red-50 text-red-700 border-red-100'
                : issue.severity === 'medium'
                  ? 'bg-amber-50 text-amber-700 border-amber-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200';

              return (
                <div key={issue.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${severityClass}`}>
                        {issue.severity === 'high' ? 'Important' : issue.severity === 'medium' ? 'Check' : 'Review'}
                      </span>
                      <p className="text-sm font-black text-slate-800">{issue.title}</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{issue.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab(issue.action)}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
                  >
                    Review {issue.action === 'sales' ? 'Sales' : 'Purchases'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                  {report.creditNoteCount > 0 && <p className="mt-1 text-[10px] font-bold text-slate-600">{report.creditNoteCount} credit note{report.creditNoteCount === 1 ? '' : 's'} · GST reversed ${formatMoney(report.creditNoteGst)}</p>}
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
              creditNotes={creditNotes}
              onPrint={handlePrintGSTReport}
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
