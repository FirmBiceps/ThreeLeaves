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
const PURCHASE_CATEGORY_STORAGE_KEY = 'three-leaves-gst-purchase-categories-v1';

function loadLocalPurchaseCategories() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PURCHASE_CATEGORY_STORAGE_KEY) || 'null');
    if (Array.isArray(stored) && stored.length) return stored.filter(Boolean);
  } catch (error) {
    console.warn('Unable to load local purchase categories:', error);
  }
  return PURCHASE_CATEGORIES;
}

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
  const stored =
    record?.supplierGstRegistrationNumber ||
    record?.supplier_gst_registration_number ||
    record?.supplierGstNo ||
    record?.supplier_gst_no ||
    record?.gstRegistrationNumber;
  if (stored) return String(stored);
  const match = String(record?.desc || '').match(/GST\s*Reg(?:istration)?\.?\s*(?:No\.?\s*)?[:#]?\s*([^•]+)/i);
  return match?.[1]?.trim() || '';
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
    blue: 'tl-metric-card',
    emerald: 'tl-metric-card',
    amber: 'tl-metric-card',
    red: 'tl-metric-card',
    slate: 'tl-metric-card',
    indigo: 'tl-metric-card',
  };

  return (
    <div className={toneMap[tone] || toneMap.slate}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="tl-metric-card__label">{label}</p>
          <p className="tl-metric-card__value font-mono">{value}</p>
          <p className="tl-metric-card__helper">{helper}</p>
        </div>
        <div className="tl-metric-card__icon">
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

function createEmptyPurchaseDraft() {
  return {
    date: new Date().toISOString().slice(0, 10),
    supplierId: '',
    supplierName: '',
    supplierInvoiceNumber: '',
    category: 'Inventory Purchase',
    grossAmount: '',
    gstTreatment: 'standard',
    gstAmount: '',
    notes: '',
    status: 'draft',
    error: '',
  };
}

function getSupplierSearchScore(supplier, query) {
  const name = getSupplierName(supplier).toLowerCase();
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return 0;
  if (name === normalized) return 0;
  if (name.startsWith(normalized)) return 1;
  const words = name.split(/\s+/);
  if (words.some((word) => word.startsWith(normalized))) return 2;
  if (name.includes(normalized)) return 3;
  return 99;
}

function SupplierTypeahead({ value, selectedSupplierId, suppliers, disabled, onChange, onSelect, onAddNew }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const inputRef = React.useRef(null);
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const query = String(value || '');

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return safeSuppliers.slice(0, 8);

    return safeSuppliers
      .map((supplier) => ({ supplier, score: getSupplierSearchScore(supplier, normalized) }))
      .filter(({ score }) => score < 99)
      .sort((a, b) => a.score - b.score || getSupplierName(a.supplier).localeCompare(getSupplierName(b.supplier)))
      .slice(0, 8)
      .map(({ supplier }) => supplier);
  }, [query, safeSuppliers]);

  const updateMenuPosition = React.useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const viewportPadding = 10;
    const menuWidth = Math.max(rect.width, 260);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding)
    );
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(150, Math.min(280, openUp ? spaceAbove - 8 : spaceBelow - 8));

    setMenuStyle({
      position: 'fixed',
      left,
      width: Math.min(menuWidth, window.innerWidth - viewportPadding * 2),
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      maxHeight,
      zIndex: 10000,
    });
  }, []);

  React.useEffect(() => {
    if (!isOpen || disabled) return undefined;

    updateMenuPosition();

    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, disabled, updateMenuPosition, query]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        disabled={disabled}
        autoComplete="off"
        placeholder="Search supplier..."
        onFocus={() => {
          setIsOpen(true);
          window.requestAnimationFrame(updateMenuPosition);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          window.requestAnimationFrame(updateMenuPosition);
        }}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 180)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
      />

      {isOpen && !disabled && menuStyle && (
        <div
          style={menuStyle}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/5"
        >
          <div className="overflow-y-auto p-1" style={{ maxHeight: Math.max(110, menuStyle.maxHeight - 44) }}>
            {suggestions.map((supplier) => {
              const supplierId = String(supplier?.id || getSupplierName(supplier));
              const isSelected = String(selectedSupplierId || '') === supplierId;
              return (
                <button
                  key={supplierId}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(supplier);
                    setIsOpen(false);
                  }}
                  className={`block w-full rounded-lg px-3 py-2.5 text-left text-xs font-bold transition ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block truncate">{getSupplierName(supplier)}</span>
                </button>
              );
            })}

            {query.trim() && suggestions.length === 0 && (
              <div className="px-3 py-3 text-[11px] font-semibold text-slate-400">
                No matching supplier found.
              </div>
            )}
          </div>

          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={async () => {
              const created = await onAddNew?.(query.trim());
              if (created) onSelect(created);
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-emerald-700 transition hover:bg-emerald-50"
          >
            <Plus size={14} />
            Add new supplier{query.trim() ? ` “${query.trim()}”` : ''}
          </button>
        </div>
      )}
    </div>
  );
}

function getPurchaseAmounts(row) {
  const grossAmount = roundMoney(row?.grossAmount);
  const treatment = row?.gstTreatment || 'standard';

  const autoGst = treatment === 'standard'
    ? roundMoney(grossAmount * GST_RATE / (1 + GST_RATE))
    : 0;

  const gstAmount = row?.gstAmount === '' || row?.gstAmount === undefined || row?.gstAmount === null
    ? autoGst
    : roundMoney(row.gstAmount);

  return {
    grossAmount,
    gstAmount: Math.min(Math.max(gstAmount, 0), grossAmount),
    exGstAmount: roundMoney(grossAmount - Math.min(Math.max(gstAmount, 0), grossAmount)),
    autoGst,
  };
}


function NewSupplierModal({ initialName = '', onClose, onCreated }) {
  const [form, setForm] = useState({ name: initialName, contactPerson: '', contactNumber: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (event) => {
    event.preventDefault();
    const name = String(form.name || '').trim();
    if (!name) {
      setError('Enter the supplier name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data, error: insertError } = await supabase
        .from('suppliers')
        .insert([{
          // The existing suppliers table requires an explicit non-null id.
          // Generate it client-side so creation from the GST search bar works
          // even when the database column has no DEFAULT/identity value.
          id: (globalThis.crypto?.randomUUID?.() || `supplier_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`),
          name,
          contactPerson: String(form.contactPerson || '').trim() || null,
          contactNumber: String(form.contactNumber || '').trim() || null,
          address: String(form.address || '').trim() || null,
        }])
        .select('*')
        .single();
      if (insertError) throw insertError;
      await onCreated(data);
      onClose();
    } catch (err) {
      setError(err?.message || 'Unable to create supplier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <form onSubmit={save} className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">Add New Supplier</h3>
            <p className="mt-1 text-xs text-slate-500">Create the supplier here without leaving GST entry.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Supplier name *</label>
            <input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Contact person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            <input placeholder="Contact number" value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
          </div>
          <textarea rows={2} placeholder="Business address (optional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50">{saving ? 'Saving...' : 'Create Supplier'}</button>
        </div>
      </form>
    </div>
  );
}

function PurchaseCategoryManager({ categories, onClose, onAdd, onRename, onRemove }) {
  const [newCategory, setNewCategory] = useState('');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div><h3 className="text-sm font-black text-slate-900">Purchase Categories</h3><p className="mt-1 text-xs text-slate-500">Add, rename or remove options shown in the purchase entry dropdown.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto p-5">
          {categories.map((category) => (
            <div key={category} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              {editing === category ? (
                <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm font-semibold outline-none focus:border-emerald-400" />
              ) : <span className="min-w-0 flex-1 text-sm font-bold text-slate-700">{category}</span>}
              {editing === category ? (
                <>
                  <button type="button" onClick={async () => { await onRename(category, draft); setEditing(null); }} className="rounded-md px-2 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-50">Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="rounded-md px-2 py-1.5 text-xs font-bold text-slate-400">Cancel</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { setEditing(category); setDraft(category); }} className="rounded-md px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100">Edit</button>
                  <button type="button" onClick={() => onRemove(category)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 bg-slate-50 p-5">
          <div className="flex gap-2">
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-400" />
            <button type="button" onClick={async () => { if (newCategory.trim()) { await onAdd(newCategory.trim()); setNewCategory(''); } }} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white">Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PurchaseEntryTable({ suppliers, categories, onPost, onAddSupplier, onAddCategory }) {
  const [rows, setRows] = useState(() => [createEmptyPurchaseDraft()]);
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const safeCategories = Array.isArray(categories) && categories.length
    ? categories
    : PURCHASE_CATEGORIES;

  const updateRow = (index, patch) => {
    setRows((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...patch, error: '' } : row
    )));
  };

  const selectSupplier = (index, supplier) => {
    updateRow(index, {
      supplierId: String(supplier?.id || getSupplierName(supplier)),
      supplierName: getSupplierName(supplier),
    });
  };

  const resolveSupplier = (row) => {
    const exact = safeSuppliers.find((supplier) => (
      String(supplier?.id || getSupplierName(supplier)) === String(row.supplierId || '') ||
      getSupplierName(supplier).toLowerCase() === String(row.supplierName || '').trim().toLowerCase()
    ));
    if (exact) return exact;

    const query = String(row.supplierName || '').trim().toLowerCase();
    if (!query) return null;

    return safeSuppliers
      .map((supplier) => ({ supplier, score: getSupplierSearchScore(supplier, query) }))
      .filter(({ score }) => score < 99)
      .sort((a, b) => a.score - b.score || getSupplierName(a.supplier).localeCompare(getSupplierName(b.supplier)))[0]?.supplier || null;
  };

  const addRow = () => setRows((current) => [...current, createEmptyPurchaseDraft()]);

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

  const updateTreatment = (index, treatment) => {
    const row = rows[index];
    const grossAmount = roundMoney(row.grossAmount);
    const gstAmount = treatment === 'standard'
      ? roundMoney(grossAmount * GST_RATE / (1 + GST_RATE))
      : 0;
    updateRow(index, { gstTreatment: treatment, gstAmount: gstAmount === 0 ? '' : gstAmount });
  };

  const postRow = async (index) => {
    const row = rows[index];
    const supplier = resolveSupplier(row);

    if (!supplier) {
      updateRow(index, { error: 'Type and select a valid supplier.' });
      return;
    }
    if (!String(row.supplierInvoiceNumber || '').trim()) {
      updateRow(index, { error: 'Enter supplier invoice no.' });
      return;
    }

    const amounts = getPurchaseAmounts(row);
    if (amounts.grossAmount <= 0) {
      updateRow(index, { error: 'Enter the total purchase amount including GST.' });
      return;
    }
    if (amounts.gstAmount < 0 || amounts.gstAmount > amounts.grossAmount) {
      updateRow(index, { error: 'Check the GST amount.' });
      return;
    }

    updateRow(index, {
      supplierId: String(supplier?.id || getSupplierName(supplier)),
      supplierName: getSupplierName(supplier),
      status: 'saving',
    });

    try {
      await onPost({
        supplierId: String(supplier?.id || getSupplierName(supplier)),
        supplierName: getSupplierName(supplier),
        supplierInvoiceNumber: String(row.supplierInvoiceNumber).trim(),
        invoiceDate: row.date,
        category: row.category,
        notes: String(row.notes || '').trim(),
        gstTreatment: row.gstTreatment || 'standard',
        grossAmount: amounts.grossAmount,
        subtotal: amounts.exGstAmount,
        gstAmount: amounts.gstAmount,
        total: amounts.grossAmount,
      });

      updateRow(index, { status: 'posted', error: '' });
    } catch (error) {
      updateRow(index, { status: 'draft', error: error?.message || 'Unable to post purchase.' });
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><ReceiptText size={15} /></span><h3 className="text-sm font-black text-slate-800">Purchase GST Entry</h3></div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Enter the supplier invoice details once. GST and the pre-GST value are calculated automatically from the tax invoice total.
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
        <table className="w-full min-w-[1250px] text-left">
          <thead className="border-b border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-400">
            <tr>
              <th className="w-[120px] p-3 pl-5">Date</th>
              <th className="w-[230px] p-3">Supplier</th>
              <th className="w-[155px] p-3">Invoice No.</th>
              <th className="w-[170px] p-3">Category</th>
              <th className="w-[145px] p-3 text-right">Total incl. GST</th>
              <th className="w-[155px] p-3">GST Treatment</th>
              <th className="w-[125px] p-3 text-right">Input GST</th>
              <th className="w-[145px] p-3 text-right">Value ex-GST</th>
              <th className="w-[110px] p-3 text-center">Action</th>
              <th className="w-[70px] p-3 pr-5 text-center">More</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-sm">
            {rows.map((row, index) => {
              const amounts = getPurchaseAmounts(row);
              const disabled = row.status === 'saving' || row.status === 'posted';

              return (
                <tr key={`purchase-entry-${index}`} className={row.status === 'posted' ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}>
                  <td className="p-2 pl-5 align-top">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(event) => updateRow(index, { date: event.target.value })}
                      disabled={disabled}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                    {row.error && <p className="mt-1 text-[9px] font-bold text-red-600">{row.error}</p>}
                  </td>

                  <td className="p-2 align-top">
                    <SupplierTypeahead
                      value={row.supplierName}
                      selectedSupplierId={row.supplierId}
                      suppliers={safeSuppliers}
                      disabled={disabled}
                      onChange={(value) => updateRow(index, { supplierName: value, supplierId: '' })}
                      onSelect={(supplier) => selectSupplier(index, supplier)}
                      onAddNew={(name) => onAddSupplier?.(name, index)}
                    />
                  </td>

                  <td className="p-2 align-top">
                    <input
                      value={row.supplierInvoiceNumber}
                      onChange={(event) => updateRow(index, { supplierInvoiceNumber: event.target.value })}
                      disabled={disabled}
                      placeholder="INV-0001"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                  </td>

                  <td className="p-2 align-top">
                    <div className="flex items-center gap-1">
                      <select
                        value={row.category}
                        onChange={(event) => updateRow(index, { category: event.target.value })}
                        disabled={disabled}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                      >
                        {safeCategories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onAddCategory?.()}
                        disabled={disabled}
                        title="Manage purchase categories"
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40"
                      >
                        <SlidersHorizontal size={14} />
                      </button>
                    </div>
                  </td>

                  <td className="p-2 align-top">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.grossAmount}
                      onChange={(event) => {
                        const grossAmount = event.target.value;
                        const autoGst = row.gstTreatment === 'standard'
                          ? roundMoney(toMoneyNumber(grossAmount) * GST_RATE / (1 + GST_RATE))
                          : 0;
                        updateRow(index, { grossAmount, gstAmount: autoGst === 0 ? '' : autoGst });
                      }}
                      disabled={disabled}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-xs font-black text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                  </td>

                  <td className="p-2 align-top">
                    <select
                      value={row.gstTreatment}
                      onChange={(event) => updateTreatment(index, event.target.value)}
                      disabled={disabled}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    >
                      <option value="standard">Standard 9%</option>
                      <option value="zero_rated">Zero-rated</option>
                      <option value="exempt">Exempt / Out of scope</option>
                      <option value="no_gst">No GST charged</option>
                    </select>
                  </td>

                  <td className="p-2 align-top">
                    <input
                      type="number"
                      min="0"
                      max={amounts.grossAmount || undefined}
                      step="0.01"
                      value={row.gstAmount}
                      onChange={(event) => updateRow(index, { gstAmount: event.target.value })}
                      disabled={disabled || row.gstTreatment !== 'standard'}
                      placeholder="0.00"
                      title="Defaults to 9/109 of the tax-included amount. You can adjust it to match the supplier tax invoice exactly."
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-right text-xs font-black text-emerald-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                  </td>

                  <td className="p-2 text-right align-top font-mono text-xs font-bold text-slate-600">
                    ${formatMoney(amounts.exGstAmount)}
                  </td>

                  <td className="p-2 text-center align-top">
                    <button
                      type="button"
                      onClick={() => postRow(index)}
                      disabled={disabled}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {row.status === 'saving' ? 'Saving' : row.status === 'posted' ? 'Posted' : 'Post'}
                    </button>
                  </td>

                  <td className="p-2 pr-5 text-center align-top">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => duplicateRow(index)}
                        disabled={disabled}
                        title="Duplicate row"
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                      >
                        <Plus size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        disabled={disabled}
                        title="Remove row"
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
    </div>
  );
}

function GstQuarterReport({ report, monthlyReport, salesRows, purchaseRows, onPrint }) {
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
                <td className="px-2 py-2 font-semibold">Sales value ex-GST</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">{money(month.salesSubtotal)}</td>
                ))}
                <td className="px-2 py-2 text-right font-mono font-bold">{money(report.taxableSales)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="px-2 py-2 font-semibold">Output GST — Sales</td>
                {monthlyReport.map((month) => (
                  <td key={month.key} className="px-2 py-2 text-right font-mono">{money(month.salesGst)}</td>
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
                  <td key={month.key} className="px-2 py-2 text-right font-mono">{money(month.salesGst - month.purchaseGst)}</td>
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
  const [purchaseSuppliers, setPurchaseSuppliers] = useState(() => (Array.isArray(sys?.suppliers) ? sys.suppliers : []));
  const [purchaseCategories, setPurchaseCategories] = useState(() => loadLocalPurchaseCategories());
  const [supplierModal, setSupplierModal] = useState(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeGstRecords = Array.isArray(sys?.gstRecords) ? sys.gstRecords : [];
  const safeSuppliers = Array.isArray(sys?.suppliers) ? sys.suppliers : [];

  useEffect(() => {
    setPurchaseSuppliers(safeSuppliers);
  }, [sys?.suppliers]);

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

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from('gst_purchase_categories')
        .select('name, sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (!cancelled && !error && Array.isArray(data) && data.length) {
        setPurchaseCategories(data.map((row) => row.name).filter(Boolean));
      }
    };
    void loadCategories();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(PURCHASE_CATEGORY_STORAGE_KEY, JSON.stringify(purchaseCategories)); } catch (error) { /* ignore storage errors */ }
  }, [purchaseCategories]);

  const createSupplierFromPurchase = (name) => new Promise((resolve) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) { resolve(null); return; }
    const existing = purchaseSuppliers.find((supplier) => getSupplierName(supplier).toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      showNotification(`Supplier already exists: ${getSupplierName(existing)}`, 'warning');
      resolve(existing);
      return;
    }
    setSupplierModal({ initialName: cleanName, resolve });
  });

  const handleSupplierCreated = async (supplier) => {
    const next = [...purchaseSuppliers.filter((item) => String(item.id) !== String(supplier.id)), supplier]
      .sort((a, b) => getSupplierName(a).localeCompare(getSupplierName(b)));
    setPurchaseSuppliers(next);
    if (sys?.setSuppliers) sys.setSuppliers(next);
    showNotification(`Supplier added: ${getSupplierName(supplier)}`);
    return supplier;
  };

  const savePurchaseCategory = async (name) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) return;
    if (purchaseCategories.some((item) => item.toLowerCase() === cleanName.toLowerCase())) return;
    const nextSort = purchaseCategories.length;
    const { data, error } = await supabase
      .from('gst_purchase_categories')
      .insert([{ name: cleanName, sort_order: nextSort, active: true }])
      .select('name')
      .single();
    if (error) {
      showNotification(`Unable to add category: ${error.message}`, 'error');
      return;
    }
    setPurchaseCategories((current) => [...current, data.name]);
  };

  const renamePurchaseCategory = async (oldName, newName) => {
    const cleanName = String(newName || '').trim();
    if (!cleanName || cleanName.toLowerCase() === oldName.toLowerCase()) return;
    const { error } = await supabase.from('gst_purchase_categories').update({ name: cleanName }).eq('name', oldName);
    if (error) {
      showNotification(`Unable to rename category: ${error.message}`, 'error');
      return;
    }
    setPurchaseCategories((current) => current.map((item) => item === oldName ? cleanName : item));
  };

  const removePurchaseCategory = async (name) => {
    if (purchaseCategories.length <= 1) {
      showNotification('Keep at least one purchase category.', 'error');
      return;
    }
    if (!window.confirm(`Remove “${name}” from the purchase category list? Existing records are not changed.`)) return;
    const { error } = await supabase.from('gst_purchase_categories').update({ active: false }).eq('name', name);
    if (error) {
      showNotification(`Unable to remove category: ${error.message}`, 'error');
      return;
    }
    setPurchaseCategories((current) => current.filter((item) => item !== name));
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

    const taxableSales = includedSales.reduce((sum, row) => sum + row.subtotal, 0);
    const outputGst = includedSales.reduce((sum, row) => sum + row.gstAmount, 0);
    const taxablePurchases = purchaseRows.reduce((sum, record) => sum + roundMoney(record?.amount), 0);
    const inputGst = purchaseRows.reduce((sum, record) => sum + roundMoney(record?.gst), 0);
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
        purchaseSubtotal: monthPurchases.reduce((sum, row) => sum + roundMoney(row?.amount), 0),
        purchaseGst: monthPurchases.reduce((sum, row) => sum + roundMoney(row?.gst), 0),
      };
    });
  }, [selectedYear, selectedQuarter, salesRows, purchaseRows]);

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

    const purchaseInvoiceMap = new Map();
    purchaseRows.forEach((row) => {
      const invoiceNumber = getPurchaseInvoiceNumber(row).trim().toUpperCase();
      if (!invoiceNumber) return;
      const key = `${String(getPurchaseSupplierName(row)).trim().toUpperCase()}::${invoiceNumber}`;
      purchaseInvoiceMap.set(key, (purchaseInvoiceMap.get(key) || 0) + 1);
    });
    const duplicatePurchaseInvoices = Array.from(purchaseInvoiceMap.values()).filter((count) => count > 1).length;
    if (duplicatePurchaseInvoices > 0) {
      issues.push({
        id: 'duplicate-purchase-invoices',
        severity: 'high',
        title: 'Potential duplicate purchase invoices',
        detail: `${duplicatePurchaseInvoices} supplier invoice${duplicatePurchaseInvoices === 1 ? '' : 's'} appear more than once in this quarter. Check before claiming input GST twice.`,
        action: 'purchases',
      });
    }

    const manuallyAdjustedGstCount = purchaseRows.filter((row) => {
      if (String(row?.gst || '') === '') return false;
      const gross = roundMoney(toMoneyNumber(row?.amount) + toMoneyNumber(row?.gst));
      const treatment = String(row?.desc || '').toLowerCase();
      if (!treatment.includes('standard-rated 9%')) return false;
      const expected = roundMoney(gross * GST_RATE / (1 + GST_RATE));
      return Math.abs(roundMoney(row?.gst) - expected) > 0.01;
    }).length;
    if (manuallyAdjustedGstCount > 0) {
      issues.push({
        id: 'purchase-gst-adjusted',
        severity: 'low',
        title: 'Purchase GST values were manually adjusted',
        detail: `${manuallyAdjustedGstCount} standard-rated purchase${manuallyAdjustedGstCount === 1 ? '' : 's'} use a GST amount different from the automatic 9/109 calculation. Verify it against the supplier tax invoice.`,
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
    const supplier = purchaseSuppliers.find((entry) => (
      String(entry?.id || getSupplierName(entry)) === String(purchase.supplierId) ||
      getSupplierName(entry).toLowerCase() === String(purchase.supplierName || '').trim().toLowerCase()
    )) || {
      id: purchase.supplierId,
      name: purchase.supplierName,
    };

    const supplierName = getSupplierName(supplier);
    const purchaseRecordId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const amount = roundMoney(purchase.subtotal);
    const gst = roundMoney(purchase.gstAmount);
    const treatmentLabels = {
      standard: 'Standard-rated 9%',
      zero_rated: 'Zero-rated',
      exempt: 'Exempt / Out of scope',
      no_gst: 'No GST charged',
    };
    const supplierGstNo = getSupplierGstRegistrationNumber(supplier);
    const descriptionParts = [
      treatmentLabels[purchase.gstTreatment] || 'GST purchase',
      supplierGstNo ? `GST Reg. No. ${supplierGstNo}` : '',
      String(purchase.notes || '').trim(),
    ].filter(Boolean);

    // Match the existing public.gst_records schema exactly:
    // id, date, type, desc, amount, gst, category.
    // amount stores value excluding GST; gst stores the tax amount.
    // Supplier/invoice metadata is retained in desc for backward compatibility.
    const gstRecord = {
      id: purchaseRecordId,
      date: purchase.invoiceDate,
      type: 'input',
      desc: `${supplierName} • Invoice ${purchase.supplierInvoiceNumber} • ${descriptionParts.join(' • ')}`,
      amount,
      gst,
      category: purchase.category || 'Inventory Purchase',
    };

    // The central hook updates local state and upserts the existing records.
    // Avoid inserting once directly and then upserting the same row a second time.
    if (typeof sys?.setGstRecords === 'function') {
      const saved = await sys.setGstRecords([...safeGstRecords, gstRecord]);
      if (saved === false) throw new Error('Supabase did not save the purchase GST record. Check the browser console and gst_records RLS policies.');
    } else {
      const { error } = await supabase.from('gst_records').insert([gstRecord]);
      if (error) throw error;
    }

    showNotification('Purchase GST recorded. No inventory update was made.');
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
    <div className="tl-module-page min-h-full space-y-6 bg-transparent p-8">
      <div className="tl-screen-section">
        <div className="tl-page-header">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center border border-slate-200 bg-white text-slate-700">
              <ReceiptText size={24} />
            </div>
            <div>
              <h1 className="tl-page-header__title">Quarterly GST Centre</h1>
              <p className="tl-page-header__subtitle">
                Automated sales GST, manual supplier purchases, and quarterly tax overview.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            <CalendarRange size={17} className="ml-2 text-slate-500" />
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

      <div className="tl-metric-grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="tl-metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="tl-metric-card__label">Taxable Sales</p>
              <p className="mt-2 font-mono text-2xl font-black text-slate-900">${formatMoney(report.taxableSales)}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600"><BarChart3 size={22} /></div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="tl-metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="tl-metric-card__label">Taxable Purchases</p>
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
              onPrint={handlePrintGSTReport}
            />
          </div>
        )}

        {activeTab === 'purchases' && (
          <div className="space-y-5 p-5">
            <PurchaseEntryTable
              suppliers={purchaseSuppliers}
              categories={purchaseCategories}
              onPost={handleSavePurchase}
              onAddSupplier={createSupplierFromPurchase}
              onAddCategory={() => setCategoryManagerOpen(true)}
            />

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
                      <th className="p-4 text-right">Total incl. GST</th>
                      <th className="p-4 text-right">Input GST</th>
                      <th className="p-4 text-right">Value ex-GST</th>
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
                          <td className="p-4 text-right font-mono font-black text-slate-900">${formatMoney(amount + gst)}</td>
                          <td className="p-4 text-right font-mono font-black text-emerald-600">${formatMoney(gst)}</td>
                          <td className="p-4 text-right font-mono font-bold text-slate-600">${formatMoney(amount)}</td>
                          <td className="p-4 pr-6 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePurchaseRecord(record)}
                              className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-600"
                              title="Delete purchase GST record"
                            >
                              <Trash2 size={17} />
                            </button>
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
            <p className="mt-1 text-xs font-semibold leading-5 text-blue-700">
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

      {supplierModal && (
        <NewSupplierModal
          initialName={supplierModal.initialName}
          onClose={() => { supplierModal.resolve?.(null); setSupplierModal(null); }}
          onCreated={async (supplier) => {
            const created = await handleSupplierCreated(supplier);
            supplierModal.resolve?.(created);
          }}
        />
      )}

      {categoryManagerOpen && (
        <PurchaseCategoryManager
          categories={purchaseCategories}
          onClose={() => setCategoryManagerOpen(false)}
          onAdd={savePurchaseCategory}
          onRename={renamePurchaseCategory}
          onRemove={removePurchaseCategory}
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
