import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowUpDown, Boxes, CheckCircle, ChevronDown,
  ChevronLeft, ChevronRight, CircleDollarSign, Download, Edit, FileText,
  History, LoaderCircle, Package, Plus, RotateCcw, Save, Search, Trash2,
  TrendingUp, Users, X,
} from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const LOW_STOCK_THRESHOLD = 20;
const PAGE_SIZE = 50;
const SEARCH_DELAY = 160;

const INVENTORY_EXPORT_COLUMNS = [
  { key: 'SKU', label: 'SKU', defaultVisible: true },
  { key: 'Name', label: 'Product Name', defaultVisible: true },
  { key: 'Supplier', label: 'Supplier', defaultVisible: true },
  { key: 'Unit', label: 'Unit', defaultVisible: true },
  { key: 'Description', label: 'Description', defaultVisible: true },
  { key: 'Packing', label: 'Packing', defaultVisible: true },
  { key: 'cost_price (SGD)', label: 'Cost Price (SGD)', defaultVisible: false },
  { key: 'Price', label: 'Sell Price (SGD)', defaultVisible: true },
  { key: 'stock', label: 'Stock', defaultVisible: true },
];

const CUSTOMER_HISTORY_EXPORT_COLUMNS = [
  ...INVENTORY_EXPORT_COLUMNS.map((column) =>
    column.key === 'Price'
      ? { ...column, label: 'Customer Price (SGD)', defaultVisible: true }
      : column.key === 'stock'
        ? { ...column, defaultVisible: false }
        : column
  ),
  { key: 'Last Ordered', label: 'Last Ordered', defaultVisible: true },
  { key: 'Orders', label: 'Order Count', defaultVisible: false },
  { key: 'Total Qty', label: 'Total Qty', defaultVisible: false },
  { key: 'Last Invoice', label: 'Last Invoice', defaultVisible: false },
];

const DEFAULT_UNITS = [
  '箱', '包', '个', '袋', '瓶',
  'per 100g', 'per 250g', 'per 500g', 'per 1kg', 'per 5kg',
];

let cachedChinesePdfFontBase64 = null;

const normalise = (value) =>
  String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const getInventoryId = (item) => item?.id ?? item?.itemId ?? item?.product_id ?? null;
const getInventorySku = (item) => String(item?.SKU ?? item?.sku ?? '');
const getInventoryName = (item) => String(item?.Name ?? item?.name ?? item?.Items ?? '');
const getInventorySupplier = (item) => String(item?.Supplier ?? item?.supplier ?? '');
const getInventoryUnit = (item) => String(item?.Unit ?? item?.unit ?? '');
const getInventoryDescription = (item) => String(item?.Description ?? item?.description ?? '');
const getInventoryPacking = (item) => String(item?.Packing ?? item?.packaging ?? '');

function getInventoryCost(item) {
  const raw = item?.['cost_price (SGD)'] ?? item?.cost_price ?? item?.costPrice ?? null;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getInventoryPrice(item) {
  const value = Number(item?.Price ?? item?.unitPrice ?? item?.['Unit Price (SG)'] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getInventoryStock(item) {
  const value = Number(item?.stock ?? item?.Stock ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getMargin(item) {
  const cost = getInventoryCost(item);
  const sell = getInventoryPrice(item);
  if (cost === null || sell <= 0) return null;
  return ((sell - cost) / sell) * 100;
}

function getStockStatus(stock) {
  if (stock <= 0) return 'out';
  if (stock <= LOW_STOCK_THRESHOLD) return 'low';
  return 'healthy';
}

function getCustomerName(customer) {
  return String(
    customer?.name ?? customer?.Name ?? customer?.companyName ??
    customer?.company_name ?? customer?.customerName ??
    customer?.customer_name ?? 'Unnamed customer'
  );
}

function getCustomerAddress(customer) {
  return String(
    customer?.address ?? customer?.deliveryAddress ?? customer?.delivery_address ??
    customer?.billingAddress ?? customer?.billing_address ?? ''
  );
}

function getInvoiceCustomerId(invoice) {
  return invoice?.customerId ?? invoice?.customer_id ?? invoice?.customer?.id ?? null;
}

function getInvoiceCustomerName(invoice) {
  if (invoice?.customerName != null) return String(invoice.customerName);
  if (invoice?.customer_name != null) return String(invoice.customer_name);
  if (typeof invoice?.customer === 'string' && invoice.customer.trim()) {
    return invoice.customer;
  }
  return String(invoice?.customer?.name ?? invoice?.customer?.Name ?? '');
}

function invoiceBelongsToCustomer(invoice, customer) {
  if (!invoice || !customer) return false;
  const invoiceId = getInvoiceCustomerId(invoice);
  const customerId = customer?.id ?? customer?.customerId ?? customer?.customer_id ?? null;
  if (invoiceId != null && customerId != null) return String(invoiceId) === String(customerId);
  return normalise(getInvoiceCustomerName(invoice)) === normalise(getCustomerName(customer));
}

const getInvoiceItems = (invoice) =>
  Array.isArray(invoice?.items) ? invoice.items :
    Array.isArray(invoice?.lineItems) ? invoice.lineItems :
      Array.isArray(invoice?.line_items) ? invoice.line_items : [];

const getInvoiceItemProductId = (item) =>
  item?.itemId ?? item?.item_id ?? item?.productId ?? item?.product_id ??
  item?.inventoryId ?? item?.inventory_id ?? null;

const getInvoiceItemName = (item) =>
  String(
    item?.Name ?? item?.name ?? item?.Items ?? item?.itemName ??
    item?.item_name ?? item?.productName ?? item?.product_name ??
    item?.description ?? ''
  );

const getInvoiceItemUnit = (item) => String(item?.unit ?? item?.Unit ?? item?.uom ?? '');

function getInvoiceItemPrice(item) {
  const raw = item?.unitPrice ?? item?.unit_price ?? item?.Price ??
    item?.price ?? item?.['Unit Price (SG)'];
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function getInvoiceItemQty(item) {
  const value = Number(item?.qty ?? item?.quantity ?? item?.Quantity ?? 0);
  return Number.isFinite(value) ? value : 0;
}

const getInvoiceNumber = (invoice) =>
  String(invoice?.number ?? invoice?.invoiceNumber ?? invoice?.invoice_number ??
    invoice?.invoiceNo ?? invoice?.invoice_no ?? invoice?.id ?? '');

const getInvoiceDate = (invoice) =>
  String(invoice?.date ?? invoice?.invoiceDate ?? invoice?.invoice_date ??
    invoice?.created_at ?? '');

function isCancelled(invoice) {
  const status = String(invoice?.status ?? invoice?.paymentStatus ?? '').toLowerCase();
  return ['cancelled', 'canceled', 'void'].includes(status);
}

function formatHistoryDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-SG', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function buildInventoryLookup(inventory) {
  const byId = new Map();
  const byName = new Map();
  (Array.isArray(inventory) ? inventory : []).forEach((item) => {
    const id = getInventoryId(item);
    const name = normalise(getInventoryName(item));
    if (id != null) byId.set(String(id), item);
    if (name && !byName.has(name)) byName.set(name, item);
  });
  return { byId, byName };
}

function findInventoryItem(invoiceItem, lookup) {
  const id = getInvoiceItemProductId(invoiceItem);
  if (id != null && lookup.byId.has(String(id))) return lookup.byId.get(String(id));
  return lookup.byName.get(normalise(getInvoiceItemName(invoiceItem))) || null;
}

function buildCustomerOrderHistory(customer, invoices, inventory) {
  if (!customer) return { rows: [], invoiceCount: 0, latestOrderDate: '' };
  const lookup = buildInventoryLookup(inventory);
  const customerInvoices = (Array.isArray(invoices) ? invoices : [])
    .filter((invoice) => invoiceBelongsToCustomer(invoice, customer) && !isCancelled(invoice))
    .sort((a, b) => new Date(getInvoiceDate(b)).getTime() - new Date(getInvoiceDate(a)).getTime());

  const history = new Map();

  customerInvoices.forEach((invoice) => {
    const invoiceDate = getInvoiceDate(invoice);
    const invoiceNumber = getInvoiceNumber(invoice);
    const invoiceIdentity = String(invoice?.id ?? invoiceNumber ?? invoiceDate);

    getInvoiceItems(invoice).forEach((line) => {
      const product = findInventoryItem(line, lookup);
      const productId = getInvoiceItemProductId(line) ?? getInventoryId(product);
      const name = getInventoryName(product) || getInvoiceItemName(line) || 'Unnamed Product';
      const unit = getInvoiceItemUnit(line) || getInventoryUnit(product);
      const key = productId
        ? `id:${String(productId)}|unit:${unit}`
        : `name:${normalise(name)}|unit:${unit}`;

      if (!history.has(key)) {
        history.set(key, {
          SKU: getInventorySku(product) || String(line?.SKU ?? line?.sku ?? ''),
          Name: name,
          Supplier: getInventorySupplier(product),
          Unit: unit,
          Description: getInventoryDescription(product) ||
            String(line?.Description ?? line?.description ?? ''),
          Packing: getInventoryPacking(product),
          'cost_price (SGD)': Number(
            product?.['cost_price (SGD)'] ?? product?.cost_price ?? product?.costPrice ?? 0
          ),
          Price: getInvoiceItemPrice(line) ?? getInventoryPrice(product),
          stock: getInventoryStock(product),
          'Last Ordered': formatHistoryDate(invoiceDate),
          Orders: 0,
          'Total Qty': 0,
          'Last Invoice': invoiceNumber,
          _invoiceKeys: new Set(),
        });
      }

      const record = history.get(key);
      record['Total Qty'] += getInvoiceItemQty(line);
      if (!record._invoiceKeys.has(invoiceIdentity)) {
        record._invoiceKeys.add(invoiceIdentity);
        record.Orders += 1;
      }
    });
  });

  return {
    rows: Array.from(history.values())
      .map(({ _invoiceKeys, ...record }) => record)
      .sort((a, b) => String(a.Name).localeCompare(String(b.Name), undefined, { sensitivity: 'base' })),
    invoiceCount: customerInvoices.length,
    latestOrderDate: customerInvoices.length ? formatHistoryDate(getInvoiceDate(customerInvoices[0])) : '',
  };
}

function normaliseInventoryForExport(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    SKU: getInventorySku(item),
    Name: getInventoryName(item),
    Supplier: getInventorySupplier(item),
    Unit: getInventoryUnit(item),
    Description: getInventoryDescription(item),
    Packing: getInventoryPacking(item),
    'cost_price (SGD)': Number(item?.['cost_price (SGD)'] ?? item?.cost_price ?? item?.costPrice ?? 0),
    Price: getInventoryPrice(item),
    stock: getInventoryStock(item),
    'Last Ordered': item?.['Last Ordered'] ?? '',
    Orders: Number(item?.Orders ?? 0),
    'Total Qty': Number(item?.['Total Qty'] ?? 0),
    'Last Invoice': item?.['Last Invoice'] ?? '',
  }));
}

function exportInventoryToExcel(items) {
  const rows = normaliseInventoryForExport(items);
  if (!rows.length) return window.alert('There is no inventory data to export.');
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: INVENTORY_EXPORT_COLUMNS.map((column) => column.key),
  });
  worksheet['!cols'] = [
    { wch: 16 }, { wch: 32 }, { wch: 24 }, { wch: 14 }, { wch: 40 },
    { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
  ];
  worksheet['!autofilter'] = { ref: worksheet['!ref'] };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
  XLSX.writeFile(workbook, `inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function loadChinesePdfFont(document) {
  const fileName = 'NotoSansSC-Regular.ttf';
  const family = 'NotoSansSC';

  if (!cachedChinesePdfFontBase64) {
    const base = String(import.meta.env.BASE_URL || '/');
    const root = base.endsWith('/') ? base : `${base}/`;
    const candidates = [`${root}fonts/${fileName}`, `/fonts/${fileName}`]
      .filter((value, index, list) => list.indexOf(value) === index);

    let lastError = null;

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          cache: 'force-cache',
          headers: { Accept: 'font/ttf,application/octet-stream,*/*' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${url}`);

        const type = String(response.headers.get('content-type') || '').toLowerCase();
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (type.includes('text/html')) throw new Error(`${url} returned HTML instead of the TTF.`);
        if (bytes.byteLength < 1000) throw new Error(`${url} is too small to be a valid TTF.`);

        const signature = String.fromCharCode(...bytes.slice(0, 4));
        const trueType =
          (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) ||
          signature === 'true' || signature === 'ttcf';
        if (!trueType) throw new Error(`${url} is not a supported TrueType TTF.`);

        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        cachedChinesePdfFontBase64 = window.btoa(binary);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!cachedChinesePdfFontBase64) throw lastError || new Error('Chinese PDF font could not be loaded.');
  }

  document.addFileToVFS(fileName, cachedChinesePdfFontBase64);
  document.addFont(fileName, family, 'normal');
  document.setFont(family, 'normal');
  return family;
}

function sanitiseFilePart(value) {
  return String(value || '').trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

async function exportInventoryToPDF(items, selectedKeys, options = {}) {
  try {
    const rows = normaliseInventoryForExport(items);
    const definitions = Array.isArray(options.columnDefinitions)
      ? options.columnDefinitions : INVENTORY_EXPORT_COLUMNS;
    const columns = definitions.filter((column) => selectedKeys.includes(column.key));

    if (!rows.length) return window.alert('There is no inventory data to export.'), false;
    if (!columns.length) return window.alert('Select at least one column for the PDF.'), false;

    const document = new jsPDF({
      orientation: columns.length <= 4 ? 'portrait' : 'landscape',
      unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true, precision: 2,
    });

    let tableFont;
    try {
      tableFont = await loadChinesePdfFont(document);
    } catch (error) {
      window.alert(`Chinese PDF font error:\n${error?.message || 'Unknown font error.'}`);
      return false;
    }

    const pageWidth = document.internal.pageSize.getWidth();
    const pageHeight = document.internal.pageSize.getHeight();
    const customerCatalogue = Boolean(options.customerName);
    const startY = customerCatalogue ? 112 : 92;

    document.setFillColor(15, 23, 42);
    document.rect(0, 0, pageWidth, customerCatalogue ? 96 : 74, 'F');
    document.setTextColor(255, 255, 255);
    document.setFont('helvetica', 'bold');
    document.setFontSize(20);
    document.text('THREE LEAVES', 40, 31);
    document.setFontSize(12);
    document.text(options.catalogueTitle || 'Inventory Catalogue', 40, 53);

    if (customerCatalogue) {
      document.setFont(tableFont, 'normal');
      document.setFontSize(10);
      document.text(String(options.customerName), 40, 73);
      if (options.customerAddress) {
        document.setFontSize(8);
        document.text(String(options.customerAddress), 40, 87, { maxWidth: pageWidth - 220 });
      }
    }

    document.setFont('helvetica', 'normal');
    document.setFontSize(9);
    document.text(
      `Generated: ${new Date().toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      pageWidth - 40, 31, { align: 'right' }
    );
    document.text(`${rows.length} product${rows.length === 1 ? '' : 's'}`, pageWidth - 40, 50, { align: 'right' });

    const baseFont = columns.length >= 8 ? 7.8 : columns.length >= 6 ? 9 : 10.8;

    autoTable(document, {
      startY,
      head: [columns.map((column) => column.label)],
      body: rows.map((row) =>
        columns.map((column) =>
          ['Price', 'cost_price (SGD)'].includes(column.key)
            ? `$${Number(row[column.key] || 0).toFixed(2)}`
            : String(row[column.key] ?? '')
        )
      ),
      theme: 'grid',
      margin: { top: startY, right: 32, bottom: 42, left: 32 },
      styles: {
        font: tableFont, fontStyle: 'normal', fontSize: baseFont,
        cellPadding: 4, overflow: 'linebreak', valign: 'middle',
        lineColor: [226, 232, 240], lineWidth: 0.5, textColor: [30, 41, 59],
      },
      headStyles: {
        font: tableFont, fontStyle: 'normal',
        fillColor: [30, 64, 175], textColor: [255, 255, 255],
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      rowPageBreak: 'avoid',
      didDrawPage: () => {
        const page = document.internal.getCurrentPageInfo().pageNumber;
        document.setDrawColor(226, 232, 240);
        document.line(32, pageHeight - 30, pageWidth - 32, pageHeight - 30);
        document.setFont('helvetica', 'normal');
        document.setFontSize(8);
        document.setTextColor(100, 116, 139);
        document.text(options.footerLabel || 'Three Leaves Inventory Catalogue', 32, pageHeight - 15);
        document.text(`Page ${page}`, pageWidth - 32, pageHeight - 15, { align: 'right' });
      },
    });

    const prefix = sanitiseFilePart(options.filenamePrefix || 'inventory-catalogue') || 'inventory-catalogue';
    document.save(`${prefix}-${new Date().toISOString().slice(0, 10)}.pdf`);
    return true;
  } catch (error) {
    console.error('Inventory PDF export failed:', error);
    window.alert(`Unable to generate the PDF: ${error?.message || 'Unknown error'}`);
    return false;
  }
}

function Toast({ notification, onClose }) {
  if (!notification) return null;
  const tone = notification.type === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : notification.type === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div className="fixed right-5 top-5 z-[9000] w-[min(420px,calc(100vw-40px))]">
      <div className={`rounded-2xl border px-4 py-3 shadow-2xl ${tone}`}>
        <div className="flex items-start gap-3">
          {notification.type === 'error'
            ? <AlertCircle size={18} className="mt-0.5 shrink-0" />
            : notification.type === 'warning'
              ? <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              : <CheckCircle size={18} className="mt-0.5 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">{notification.title}</p>
            {notification.message && <p className="mt-1 text-xs leading-5 opacity-80">{notification.message}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 opacity-60 hover:bg-white/50 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ open, title, message, confirmLabel, tone = 'red', working, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            tone === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
          }`}>
            <AlertTriangle size={21} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">{title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-500">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" disabled={working} onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={working} onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50 ${
              tone === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
            }`}>
            {working ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subtext, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{subtext}</p>
        </div>
        <div className={`rounded-xl p-3 ${tones[tone] || tones.blue}`}><Icon size={20} /></div>
      </div>
    </div>
  );
}

function SupplierSearchInput({ value, onChange, suppliers }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value || '');
  const ref = useRef(null);

  const names = useMemo(() => Array.from(new Set(
    (Array.isArray(suppliers) ? suppliers : [])
      .map((supplier) => supplier?.name || supplier?.Name || supplier?.supplier_name)
      .filter(Boolean)
      .map((name) => String(name).trim())
  )).sort(), [suppliers]);

  const canonical = useMemo(() => {
    const map = new Map(names.map((name) => [normalise(name), name]));
    return map;
  }, [names]);

  const selected = canonical.get(normalise(text)) || '';
  const filtered = names.filter((name) => normalise(name).includes(normalise(text))).slice(0, 100);

  useEffect(() => setText(value || ''), [value]);

  useEffect(() => {
    const listener = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
        const match = canonical.get(normalise(text));
        if (match) {
          setText(match);
          onChange(match);
        } else if (text) {
          setText('');
          onChange('');
        }
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [canonical, onChange, text]);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            setOpen(true);
            onChange(canonical.get(normalise(next)) || '');
          }}
          placeholder="Search verified suppliers..."
          className={`w-full rounded-xl border py-3 pl-10 pr-24 text-sm outline-none ${
            selected ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'
          }`}
        />
        <span className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[9px] font-black uppercase ${
          selected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
        }`}>
          {selected ? 'Verified' : 'Select'}
        </span>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-[6000] mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {filtered.length ? filtered.map((name) => (
            <button key={name} type="button" onClick={() => {
              setText(name); onChange(name); setOpen(false);
            }} className="w-full border-b border-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
              {name}
            </button>
          )) : <div className="p-4 text-center text-sm text-slate-500">No matching supplier found.</div>}
        </div>
      )}
    </div>
  );
}

function InventoryFormModal({ item, suppliers, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    id: item?.id || `prod-${Date.now()}`,
    sku: item?.sku || item?.SKU || '',
    Name: item?.Name || item?.name || item?.Items || '',
    Supplier: item?.Supplier || item?.supplier || '',
    Unit: item?.Unit || item?.unit || '箱',
    Description: item?.Description || item?.description || '',
    Packing: item?.Packing || item?.packaging || '',
    cost_price: item?.['cost_price (SGD)'] ?? item?.cost_price ?? item?.costPrice ?? '',
    Price: item?.Price ?? item?.unitPrice ?? item?.['Unit Price (SG)'] ?? '',
    stock: item?.stock ?? item?.Stock ?? 0,
  });
  const [customUnit, setCustomUnit] = useState(Boolean(form.Unit && !DEFAULT_UNITS.includes(String(form.Unit))));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const sell = Number(form.Price);
    const stock = Number(form.stock);
    const cost = form.cost_price === '' ? null : Number(form.cost_price);

    if (!String(form.Name || '').trim()) return setError('Product Name is required.');
    if (!String(form.Unit || '').trim()) return setError('Unit is required.');
    if (!Number.isFinite(sell) || sell < 0) return setError('Sell Price must be zero or greater.');
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return setError('Cost Price must be blank, zero or greater.');
    if (!Number.isFinite(stock) || stock < 0) return setError('Stock cannot be negative.');

    setError('');
    setSaving(true);
    try {
      await onSave({
        ...form,
        Name: String(form.Name).trim(),
        Unit: String(form.Unit).trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center">
            <Package size={18} className="mr-3 text-blue-400" />
            <div>
              <h2 className="text-base font-semibold">{item ? 'Edit Product' : 'Add New Product'}</h2>
              <p className="mt-0.5 text-xs text-slate-400">Product, supplier, commercial details and current stock.</p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-800 disabled:opacity-40"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
            <section>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Product</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-500">SKU</span>
                  <input value={form.sku} onChange={(e) => update('sku', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm uppercase outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="md:col-span-2">
                  <span className="mb-1.5 block text-xs font-bold text-slate-500">Product Name *</span>
                  <input required value={form.Name} onChange={(e) => update('Name', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
              </div>
            </section>

            <section>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sourcing</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-500">Supplier</span>
                  <SupplierSearchInput value={form.Supplier} suppliers={suppliers} onChange={(value) => update('Supplier', value)} />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-500">Packing</span>
                  <input value={form.Packing} onChange={(e) => update('Packing', e.target.value)}
                    placeholder="e.g. 24 x 300g"
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
              </div>
            </section>

            <section>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Description</p>
              <textarea rows={3} value={form.Description} onChange={(e) => update('Description', e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
            </section>

            <section>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Commercial & Stock</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-500">Unit *</span>
                  {!customUnit ? (
                    <select value={DEFAULT_UNITS.includes(String(form.Unit)) ? form.Unit : ''}
                      onChange={(e) => {
                        if (e.target.value === '__CUSTOM__') {
                          setCustomUnit(true); update('Unit', '');
                        } else update('Unit', e.target.value);
                      }}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none">
                      {DEFAULT_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      <option value="__CUSTOM__">+ Add Custom...</option>
                    </select>
                  ) : (
                    <div className="flex overflow-hidden rounded-xl border border-blue-300 bg-blue-50">
                      <input autoFocus value={form.Unit} onChange={(e) => update('Unit', e.target.value)}
                        className="w-full bg-transparent p-3 text-center text-sm outline-none" />
                      <button type="button" onClick={() => { setCustomUnit(false); update('Unit', '箱'); }}
                        className="bg-blue-100/50 p-3 text-blue-400"><X size={16} /></button>
                    </div>
                  )}
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-orange-600">Cost Price</span>
                  <input type="number" min="0" step="0.01" value={form.cost_price}
                    onChange={(e) => update('cost_price', e.target.value)}
                    className="w-full rounded-xl border border-orange-200 bg-orange-50 p-3 text-right text-sm font-bold text-orange-700 outline-none" />
                  <span className="mt-1 block text-[10px] text-slate-400">Blank/zero is treated as missing cost.</span>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-blue-600">Sell Price *</span>
                  <input required type="number" min="0" step="0.01" value={form.Price}
                    onChange={(e) => update('Price', e.target.value)}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50 p-3 text-right text-sm font-bold text-blue-700 outline-none" />
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-emerald-600">Stock</span>
                  <input type="number" min="0" step="1" value={form.stock}
                    onChange={(e) => update('stock', e.target.value)}
                    className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-right text-sm font-bold text-emerald-700 outline-none" />
                </label>
              </div>
            </section>

            {item && Number(item?.['cost_price (SGD)'] ?? item?.cost_price ?? item?.costPrice ?? 0) !== Number(form.cost_price || 0) && (
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                Cost price changed. Locked historical invoice costs remain unchanged; unresolved/current-cost estimates may use the new cost.
              </div>
            )}

            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>}
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {item ? (
              <button type="button" disabled={saving} onClick={() => onDelete(item)}
                className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 disabled:opacity-40">
                <Trash2 size={16} className="mr-2" /> Delete
              </button>
            ) : <span className="text-[10px] text-slate-400">New products save to product_list.</span>}

            <div className="flex justify-end gap-3">
              <button type="button" disabled={saving} onClick={onClose}
                className="rounded-xl px-5 py-2.5 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="inline-flex min-w-[140px] items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60">
                {saving ? <><LoaderCircle size={16} className="mr-2 animate-spin" /> Saving…</>
                  : <><Save size={16} className="mr-2" /> Save Product</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function InventoryPdfColumnPicker({
  onClose, onExport, fullInventoryRows, customers, invoices, inventory,
}) {
  const [mode, setMode] = useState('full-inventory');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [columns, setColumns] = useState(
    INVENTORY_EXPORT_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key)
  );

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const selectedCustomer = safeCustomers.find((customer) =>
    String(customer?.id ?? customer?.customerId ?? customer?.customer_id) === selectedCustomerId
  ) || null;

  const history = useMemo(
    () => buildCustomerOrderHistory(selectedCustomer, invoices, inventory),
    [selectedCustomer, invoices, inventory]
  );

  const matchingCustomers = useMemo(() => {
    const query = normalise(customerSearch);
    return [...safeCustomers]
      .sort((a, b) => getCustomerName(a).localeCompare(getCustomerName(b)))
      .filter((customer) =>
        !query ||
        normalise(getCustomerName(customer)).includes(query) ||
        normalise(getCustomerAddress(customer)).includes(query)
      )
      .slice(0, 12);
  }, [safeCustomers, customerSearch]);

  const activeColumns = mode === 'customer-history'
    ? CUSTOMER_HISTORY_EXPORT_COLUMNS : INVENTORY_EXPORT_COLUMNS;
  const rows = mode === 'customer-history' ? history.rows : fullInventoryRows;

  const switchMode = (next) => {
    setMode(next);
    const defs = next === 'customer-history'
      ? CUSTOMER_HISTORY_EXPORT_COLUMNS : INVENTORY_EXPORT_COLUMNS;
    setColumns(defs.filter((column) => column.defaultVisible).map((column) => column.key));
  };

  const exportNow = async () => {
    if (!rows.length || !columns.length || (mode === 'customer-history' && !selectedCustomer)) return;
    setExporting(true);
    try {
      await onExport({
        rows, selectedColumns: columns, columnDefinitions: activeColumns,
        mode, selectedCustomer,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div>
            <h2 className="text-base font-semibold">Inventory PDF Catalogue</h2>
            <p className="mt-0.5 text-xs text-slate-300">Full inventory or previously ordered products for one customer.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-800"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              ['full-inventory', Package, 'Current inventory view', 'Uses the products matching the current Inventory search and filters.'],
              ['customer-history', History, 'Previously ordered by customer', 'Uses the latest actual normal-invoice price for each ordered product.'],
            ].map(([value, Icon, title, desc]) => (
              <button key={value} type="button" onClick={() => switchMode(value)}
                className={`rounded-2xl border p-4 text-left ${
                  mode === value ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                <div className="flex gap-3">
                  <div className="rounded-xl bg-blue-100 p-2 text-blue-700"><Icon size={18} /></div>
                  <div><p className="text-sm font-black text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p></div>
                </div>
              </button>
            ))}
          </div>

          {mode === 'customer-history' && (
            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="relative">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Customer name or address..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none" />
              </div>
              <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {matchingCustomers.map((customer, index) => {
                  const id = String(customer?.id ?? customer?.customerId ?? customer?.customer_id ?? index);
                  const selected = id === selectedCustomerId;
                  return (
                    <button key={id} type="button" onClick={() => setSelectedCustomerId(id)}
                      className={`flex w-full items-start justify-between border-b border-slate-100 px-4 py-3 text-left ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <div><p className="text-sm font-bold text-slate-800">{getCustomerName(customer)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{getCustomerAddress(customer)}</p></div>
                      {selected && <CheckCircle size={18} className="text-blue-600" />}
                    </button>
                  );
                })}
              </div>

              {selectedCustomer && (
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                  <div><p className="text-lg font-black">{history.invoiceCount}</p><p className="text-[10px] uppercase text-slate-400">Invoices</p></div>
                  <div><p className="text-lg font-black">{history.rows.length}</p><p className="text-[10px] uppercase text-slate-400">Products</p></div>
                  <div><p className="text-xs font-black">{history.latestOrderDate || '—'}</p><p className="text-[10px] uppercase text-slate-400">Last Order</p></div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6">
            <div className="mb-3 flex justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">PDF Columns</p>
                <p className="mt-1 text-xs text-slate-500">Cost price remains off by default.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setColumns(activeColumns.map((column) => column.key))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold">Select All</button>
                <button type="button" onClick={() => setColumns([])}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold">Clear All</button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeColumns.map((column) => (
                <label key={column.key}
                  className={`flex items-center rounded-xl border p-3 text-sm ${
                    columns.includes(column.key) ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200'
                  }`}>
                  <input type="checkbox" checked={columns.includes(column.key)}
                    onChange={() => setColumns((current) =>
                      current.includes(column.key)
                        ? current.filter((key) => key !== column.key)
                        : [...current, column.key]
                    )}
                    className="mr-3" />
                  {column.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm text-slate-500">Cancel</button>
            <button type="button" disabled={exporting || !rows.length || !columns.length || (mode === 'customer-history' && !selectedCustomer)}
              onClick={exportNow} className="inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {exporting ? <><LoaderCircle size={16} className="mr-2 animate-spin" /> Generating…</>
                : <><FileText size={16} className="mr-2" /> Export PDF</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InventoryModule({ sys }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [unitFilter, setUnitFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [costFilter, setCostFilter] = useState('All');
  const [sortOption, setSortOption] = useState('name_asc');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [pricingGroups, setPricingGroups] = useState([]);

  const [notification, setNotification] = useState(null);
  const timerRef = useRef(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingMigration, setPendingMigration] = useState(null);
  const [migrating, setMigrating] = useState(false);

  const inventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const customers = Array.isArray(sys?.customers) ? sys.customers : [];
  const invoices = Array.isArray(sys?.invoices) ? sys.invoices : [];

  const notify = (title, type = 'success', message = '') => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setNotification({ title, type, message });
    timerRef.current = window.setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [supplierResult, groupResult] = await Promise.all([
        supabase.from('suppliers').select('id,name'),
        supabase.from('pricing_groups').select('id,name,prices').order('name', { ascending: true }),
      ]);
      if (cancelled) return;

      if (supplierResult.error || groupResult.error) {
        notify(
          'Reference data could not be fully loaded',
          'warning',
          supplierResult.error?.message || groupResult.error?.message || ''
        );
      }

      setSuppliers(Array.isArray(supplierResult.data) ? supplierResult.data : []);
      setPricingGroups(Array.isArray(groupResult.data) ? groupResult.data : []);
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), SEARCH_DELAY);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => setPage(1), [
    debouncedSearch, supplierFilter, unitFilter, stockFilter, costFilter, sortOption,
  ]);

  const supplierOptions = useMemo(() =>
    Array.from(new Set(inventory.map(getInventorySupplier).filter(Boolean))).sort(),
  [inventory]);

  const unitOptions = useMemo(() =>
    Array.from(new Set(inventory.map(getInventoryUnit).filter(Boolean))).sort(),
  [inventory]);

  const summary = useMemo(() => {
    let low = 0, out = 0, missingCost = 0, costValue = 0, retailValue = 0, noSupplier = 0;
    inventory.forEach((item) => {
      const stock = getInventoryStock(item);
      const cost = getInventoryCost(item);
      if (stock <= 0) out += 1;
      else if (stock <= LOW_STOCK_THRESHOLD) low += 1;
      if (cost === null) missingCost += 1;
      else costValue += stock * cost;
      retailValue += stock * getInventoryPrice(item);
      if (!getInventorySupplier(item)) noSupplier += 1;
    });
    return { low, out, missingCost, costValue, retailValue, noSupplier };
  }, [inventory]);

  const filtered = useMemo(() => {
    const query = normalise(debouncedSearch);
    const rows = inventory.filter((item) => {
      const stock = getInventoryStock(item);
      const cost = getInventoryCost(item);
      const searchable = [
        getInventorySku(item), getInventoryName(item), getInventorySupplier(item),
        getInventoryDescription(item), getInventoryPacking(item), getInventoryUnit(item),
      ].map(normalise).join(' ');

      if (query && !searchable.includes(query)) return false;
      if (supplierFilter !== 'All' && getInventorySupplier(item) !== supplierFilter) return false;
      if (unitFilter !== 'All' && getInventoryUnit(item) !== unitFilter) return false;
      if (stockFilter === 'Healthy' && getStockStatus(stock) !== 'healthy') return false;
      if (stockFilter === 'Low Stock' && getStockStatus(stock) !== 'low') return false;
      if (stockFilter === 'Out of Stock' && getStockStatus(stock) !== 'out') return false;
      if (costFilter === 'Has Cost' && cost === null) return false;
      if (costFilter === 'Missing Cost' && cost !== null) return false;
      return true;
    });

    return [...rows].sort((a, b) => {
      if (sortOption === 'name_desc') return getInventoryName(b).localeCompare(getInventoryName(a));
      if (sortOption === 'sku_asc') return getInventorySku(a).localeCompare(getInventorySku(b), undefined, { numeric: true });
      if (sortOption === 'stock_asc') return getInventoryStock(a) - getInventoryStock(b);
      if (sortOption === 'stock_desc') return getInventoryStock(b) - getInventoryStock(a);
      if (sortOption === 'cost_desc') return (getInventoryCost(b) ?? -Infinity) - (getInventoryCost(a) ?? -Infinity);
      if (sortOption === 'sell_desc') return getInventoryPrice(b) - getInventoryPrice(a);
      if (sortOption === 'margin_desc') return (getMargin(b) ?? -Infinity) - (getMargin(a) ?? -Infinity);
      if (sortOption === 'supplier_asc') return getInventorySupplier(a).localeCompare(getInventorySupplier(b));
      return getInventoryName(a).localeCompare(getInventoryName(b));
    });
  }, [inventory, debouncedSearch, supplierFilter, unitFilter, stockFilter, costFilter, sortOption]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage((current) => Math.min(Math.max(1, current), totalPages)), [totalPages]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetFilters = () => {
    setSearchTerm(''); setDebouncedSearch('');
    setSupplierFilter('All'); setUnitFilter('All');
    setStockFilter('All'); setCostFilter('All'); setSortOption('name_asc'); setPage(1);
  };

  const pricingImpact = (productId, oldUnit, newUnit) => {
    const oldKey = `${productId}|${oldUnit}`;
    const newKey = `${productId}|${newUnit}`;
    const groupRefs = pricingGroups.filter((group) =>
      group?.prices && Object.prototype.hasOwnProperty.call(group.prices, oldKey)
    );
    const customerRefs = customers.filter((customer) =>
      customer?.custom_prices && Object.prototype.hasOwnProperty.call(customer.custom_prices, oldKey)
    );
    const collisions = [
      ...groupRefs.map((group) => group?.prices),
      ...customerRefs.map((customer) => customer?.custom_prices),
    ].filter((prices) =>
      oldKey !== newKey && Object.prototype.hasOwnProperty.call(prices || {}, newKey)
    ).length;
    return { oldKey, newKey, groupRefs, customerRefs, collisions };
  };

  const migratePricing = async (impact) => {
    const changedGroups = [];
    const changedCustomers = [];

    try {
      for (const group of impact.groupRefs) {
        const original = { ...(group.prices || {}) };
        const next = { ...original, [impact.newKey]: original[impact.oldKey] };
        delete next[impact.oldKey];
        const { error } = await supabase.from('pricing_groups').update({ prices: next }).eq('id', group.id);
        if (error) throw error;
        changedGroups.push({ id: group.id, original, next });
      }

      for (const customer of impact.customerRefs) {
        const original = { ...(customer.custom_prices || {}) };
        const next = { ...original, [impact.newKey]: original[impact.oldKey] };
        delete next[impact.oldKey];
        const { error } = await supabase.from('customers').update({ custom_prices: next }).eq('id', customer.id);
        if (error) throw error;
        changedCustomers.push({ id: customer.id, original, next });
      }

      return { changedGroups, changedCustomers };
    } catch (error) {
      for (const row of changedGroups) {
        await supabase.from('pricing_groups').update({ prices: row.original }).eq('id', row.id);
      }
      for (const row of changedCustomers) {
        await supabase.from('customers').update({ custom_prices: row.original }).eq('id', row.id);
      }
      throw error;
    }
  };

  const saveProductDatabase = async (form) => {
    const editing = Boolean(editingItem);
    const oldPrice = editing ? getInventoryPrice(editingItem) : 0;
    const oldCost = editing ? (getInventoryCost(editingItem) ?? 0) : 0;

    const payload = {
      SKU: String(form.sku || '').trim(),
      Name: String(form.Name || '').trim(),
      Supplier: String(form.Supplier || '').trim(),
      Unit: String(form.Unit || '').trim(),
      Description: String(form.Description || '').trim(),
      Packing: String(form.Packing || '').trim(),
      'cost_price (SGD)': form.cost_price === '' ? 0 : Number(form.cost_price) || 0,
      Price: Number(form.Price) || 0,
      stock: Number.parseInt(form.stock, 10) || 0,
    };

    let saved;

    if (editing) {
      const originalId = getInventoryId(editingItem);
      const requestedId = originalId ?? form.id;

      const updateByExactLegacyName = async () => {
        const name = getInventoryName(editingItem);
        const lookup = await supabase.from('product_list').select('id,Name').eq('Name', name);
        if (lookup.error) throw lookup.error;
        if (!Array.isArray(lookup.data) || lookup.data.length !== 1) {
          throw new Error(`Cannot safely update legacy product "${name}" because it matches ${lookup.data?.length || 0} database rows.`);
        }
        const result = await supabase.from('product_list').update(payload).eq('id', lookup.data[0].id).select();
        if (result.error) throw result.error;
        if (!Array.isArray(result.data) || result.data.length !== 1) {
          throw new Error(`The legacy product "${name}" could not be updated safely.`);
        }
        return result.data[0];
      };

      if (requestedId != null && requestedId !== '') {
        const result = await supabase.from('product_list').update(payload).eq('id', requestedId).select();
        if (result.error) throw result.error;
        if (Array.isArray(result.data) && result.data.length === 1) {
          saved = result.data[0];
        } else {
          saved = await updateByExactLegacyName();
        }
      } else {
        saved = await updateByExactLegacyName();
      }
    } else {
      const result = await supabase.from('product_list').insert([payload]).select().single();
      if (result.error) throw result.error;
      saved = result.data;
    }

    if (editing) {
      const originalId = getInventoryId(editingItem);
      const originalName = getInventoryName(editingItem);
      sys.setInventory(inventory.map((item) => {
        const itemId = getInventoryId(item);
        if (originalId != null && itemId != null) {
          return String(itemId) === String(originalId) ? saved : item;
        }
        if (originalId == null) {
          return item === editingItem || getInventoryName(item) === originalName ? saved : item;
        }
        return item;
      }));
    } else {
      sys.setInventory([saved, ...inventory]);
    }

    if (editing && oldPrice !== payload.Price && saved?.id) {
      const history = await supabase.from('price_history').insert({
        product_id: saved.id,
        product_name: payload.Name,
        old_price_sg: oldPrice,
        new_price_sg: payload.Price,
      });
      if (history.error) {
        notify('Product saved, but price history needs attention', 'warning', history.error.message);
      }
    }

    if (editing && oldCost !== payload['cost_price (SGD)']) {
      notify(
        'Product updated',
        'warning',
        'Cost price changed. Locked historical invoice costs remain unchanged; unresolved/current-cost estimates may use the new cost.'
      );
    } else {
      notify(editing ? 'Product updated' : 'Product added', 'success', `${payload.Name} saved successfully.`);
    }

    setModalOpen(false);
    setEditingItem(null);
    return saved;
  };

  const saveProduct = async (form, options = {}) => {
    try {
      const editing = Boolean(editingItem);
      const id = editing ? getInventoryId(editingItem) : null;
      const oldUnit = editing ? getInventoryUnit(editingItem) : '';
      const newUnit = String(form.Unit || '');

      if (editing && id != null && oldUnit !== newUnit && !options.migratePricing) {
        const impact = pricingImpact(id, oldUnit, newUnit);
        if (impact.collisions > 0) {
          notify(
            'Unit change blocked to protect custom pricing',
            'error',
            `${impact.collisions} pricing rule(s) already exist for the new unit. Resolve those duplicate rules first.`
          );
          return false;
        }
        if (impact.groupRefs.length + impact.customerRefs.length > 0) {
          setPendingMigration({ form, impact, oldUnit, newUnit });
          return false;
        }
      }

      let migration = null;
      if (options.migratePricing) migration = await migratePricing(options.impact);

      try {
        await saveProductDatabase(form);
      } catch (error) {
        if (migration) {
          for (const row of migration.changedGroups) {
            await supabase.from('pricing_groups').update({ prices: row.original }).eq('id', row.id);
          }
          for (const row of migration.changedCustomers) {
            await supabase.from('customers').update({ custom_prices: row.original }).eq('id', row.id);
          }
        }
        throw error;
      }

      if (migration) {
        const groupMap = new Map(migration.changedGroups.map((row) => [String(row.id), row.next]));
        setPricingGroups((current) => current.map((group) =>
          groupMap.has(String(group.id)) ? { ...group, prices: groupMap.get(String(group.id)) } : group
        ));

        if (typeof sys?.setCustomers === 'function') {
          const customerMap = new Map(migration.changedCustomers.map((row) => [String(row.id), row.next]));
          sys.setCustomers(customers.map((customer) =>
            customerMap.has(String(customer.id))
              ? { ...customer, custom_prices: customerMap.get(String(customer.id)) }
              : customer
          ));
        }

        notify(
          'Unit and custom pricing migrated',
          'success',
          `${migration.changedGroups.length} Pricing Group rule(s) and ${migration.changedCustomers.length} individual override(s) moved to the new unit key.`
        );
      }

      return true;
    } catch (error) {
      console.error('Inventory save failed:', error);
      notify('Product save failed', 'error', error?.message || 'Unknown error');
      return false;
    }
  };

  const pricingReferenceCount = (item) => {
    const id = getInventoryId(item);
    if (id == null) return 0;
    const prefix = `${id}|`;
    return pricingGroups.reduce((count, group) =>
      count + Object.keys(group?.prices || {}).filter((key) => key.startsWith(prefix)).length, 0
    ) + customers.reduce((count, customer) =>
      count + Object.keys(customer?.custom_prices || {}).filter((key) => key.startsWith(prefix)).length, 0
    );
  };

  const usedByNormalInvoice = (item) => {
    const id = getInventoryId(item);
    if (id == null) return false;
    return invoices.some((invoice) =>
      getInvoiceItems(invoice).some((line) => String(getInvoiceItemProductId(line)) === String(id))
    );
  };

  const requestDelete = (item) => {
    const refs = pricingReferenceCount(item);
    if (refs > 0) {
      return notify(
        'Delete blocked to protect custom pricing',
        'error',
        `This product is referenced by ${refs} Pricing Group/customer pricing rule(s). Remove or migrate those rules first.`
      );
    }
    if (usedByNormalInvoice(item)) {
      return notify(
        'Delete blocked to protect invoice history',
        'error',
        'This product is used by historical normal invoices. Keep it so historical product matching and profit review remain reliable.'
      );
    }
    setPendingDelete(item);
  };

  const deleteProduct = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const name = getInventoryName(pendingDelete);
    const originalId = getInventoryId(pendingDelete);

    try {
      const deleteByExactLegacyName = async () => {
        const lookup = await supabase.from('product_list').select('id,Name').eq('Name', name);
        if (lookup.error) throw lookup.error;
        if (!Array.isArray(lookup.data) || lookup.data.length !== 1) {
          throw new Error(`Cannot safely delete legacy product "${name}" because it matches ${lookup.data?.length || 0} database rows.`);
        }
        const result = await supabase.from('product_list').delete().eq('id', lookup.data[0].id).select('id');
        if (result.error) throw result.error;
        if (!Array.isArray(result.data) || result.data.length !== 1) {
          throw new Error(`The legacy product "${name}" was not deleted.`);
        }
        return lookup.data[0].id;
      };

      let deletedId = originalId;

      if (originalId != null && originalId !== '') {
        const result = await supabase.from('product_list').delete().eq('id', originalId).select('id');
        if (result.error) throw result.error;
        if (!Array.isArray(result.data) || result.data.length !== 1) {
          deletedId = await deleteByExactLegacyName();
        }
      } else {
        deletedId = await deleteByExactLegacyName();
      }

      sys.setInventory(inventory.filter((item) => {
        if (originalId != null) {
          return String(getInventoryId(item)) !== String(originalId);
        }
        return item !== pendingDelete;
      }));

      setModalOpen(false);
      setEditingItem(null);
      notify('Product removed', 'success', `${name} was deleted from product_list.`);
    } catch (error) {
      notify('Product delete failed', 'error', error?.message || 'Unknown error');
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="relative h-full overflow-y-auto bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      <Toast notification={notification} onClose={() => setNotification(null)} />

      <div className="mx-auto w-full max-w-[1700px] space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-center">
            <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 ring-1 ring-blue-100">
              <Package className="text-blue-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Inventory Catalog</h1>
              <p className="mt-1 text-sm text-slate-500">Products, supplier assignments, stock, pricing and customer catalogues.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => exportInventoryToExcel(filtered)}
              title="Includes internal cost-price data"
              className="inline-flex items-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-emerald-700 shadow-sm hover:bg-emerald-50">
              <Download size={16} className="mr-2" /> Internal Excel
            </button>
            <button type="button" onClick={() => setPdfOpen(true)}
              className="inline-flex items-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-indigo-700 shadow-sm hover:bg-indigo-100">
              <FileText size={16} className="mr-2" /> PDF Catalogue
            </button>
            <button type="button" onClick={() => { setEditingItem(null); setModalOpen(true); }}
              className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-blue-700">
              <Plus size={18} className="mr-2" /> Add Product
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Products" value={inventory.length}
            subtext={`${summary.out} out of stock · ${summary.noSupplier} without supplier`}
            icon={Boxes} tone="blue" />
          <SummaryCard label="Low Stock" value={summary.low + summary.out}
            subtext={`${summary.out} out of stock · threshold ≤ ${LOW_STOCK_THRESHOLD}`}
            icon={AlertTriangle} tone="amber" />
          <SummaryCard label="Inventory Cost Value" value={`$${formatMoney(summary.costValue)}`}
            subtext={summary.missingCost ? `${summary.missingCost} product(s) excluded — missing/zero cost` : 'All products have valid cost'}
            icon={CircleDollarSign} tone="emerald" />
          <SummaryCard label="Retail Stock Value" value={`$${formatMoney(summary.retailValue)}`}
            subtext="Current stock × catalogue selling price"
            icon={TrendingUp} tone="violet" />
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/80 p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
              <div className="md:col-span-2 xl:col-span-4">
                <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3.5 shadow-sm">
                  <Search size={16} className="mr-2 text-slate-400" />
                  <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="SKU, product, supplier, description or packing..."
                    className="min-w-0 w-full bg-transparent text-sm outline-none" />
                  {searchTerm && <button type="button" onClick={() => setSearchTerm('')} className="p-1 text-slate-400"><X size={14} /></button>}
                </div>
              </div>

              {[
                ['supplier', supplierFilter, setSupplierFilter, ['All', ...supplierOptions]],
                ['unit', unitFilter, setUnitFilter, ['All', ...unitOptions]],
                ['stock', stockFilter, setStockFilter, ['All', 'Healthy', 'Low Stock', 'Out of Stock']],
                ['cost', costFilter, setCostFilter, ['All', 'Has Cost', 'Missing Cost']],
              ].map(([key, value, setter, options]) => (
                <div key={key} className={key === 'supplier' || key === 'stock' ? 'xl:col-span-2' : 'xl:col-span-1'}>
                  <div className="relative flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
                    <select value={value} onChange={(e) => setter(e.target.value)}
                      className="min-w-0 w-full appearance-none bg-transparent pr-5 text-xs font-bold text-slate-700 outline-none">
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option === 'All'
                            ? key === 'supplier' ? 'All Suppliers'
                              : key === 'unit' ? 'All Units'
                                : key === 'stock' ? 'All Stock'
                                  : 'All Cost'
                            : option}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 text-slate-400" />
                  </div>
                </div>
              ))}

              <div className="xl:col-span-2">
                <div className="relative flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
                  <ArrowUpDown size={15} className="mr-2 text-slate-400" />
                  <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}
                    className="w-full appearance-none bg-transparent pr-5 text-xs font-bold text-slate-700 outline-none">
                    <option value="name_asc">Product A-Z</option>
                    <option value="name_desc">Product Z-A</option>
                    <option value="sku_asc">SKU</option>
                    <option value="stock_asc">Stock Low-High</option>
                    <option value="stock_desc">Stock High-Low</option>
                    <option value="cost_desc">Cost High-Low</option>
                    <option value="sell_desc">Sell Price High-Low</option>
                    <option value="margin_desc">Margin High-Low</option>
                    <option value="supplier_asc">Supplier A-Z</option>
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-400">Showing {filtered.length} of {inventory.length} products</span>
              {(searchTerm || supplierFilter !== 'All' || unitFilter !== 'All' || stockFilter !== 'All' || costFilter !== 'All' || sortOption !== 'name_asc') && (
                <button type="button" onClick={resetFilters}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
                  <RotateCcw size={13} className="mr-1.5" /> Reset filters
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <th className="p-4 pl-6">SKU</th>
                  <th className="p-4">Product</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4 text-center">Unit</th>
                  <th className="p-4">Packing</th>
                  <th className="p-4 text-right">Cost</th>
                  <th className="p-4 text-right">Sell</th>
                  <th className="p-4 text-right">Margin</th>
                  <th className="p-4 text-center">Stock</th>
                  <th className="sticky right-0 bg-white p-4 pr-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((item, index) => {
                  const cost = getInventoryCost(item);
                  const sell = getInventoryPrice(item);
                  const margin = getMargin(item);
                  const stock = getInventoryStock(item);
                  const status = getStockStatus(stock);
                  return (
                    <tr key={getInventoryId(item) || index} className="group hover:bg-slate-50">
                      <td className="whitespace-nowrap p-4 pl-6 font-mono text-sm uppercase text-slate-500">{getInventorySku(item) || '-'}</td>
                      <td className="max-w-[340px] p-4">
                        <p className="font-bold text-slate-800">{getInventoryName(item) || 'Unnamed Product'}</p>
                        {getInventoryDescription(item) && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{getInventoryDescription(item)}</p>}
                      </td>
                      <td className="max-w-[220px] p-4 text-sm font-bold text-indigo-600">{getInventorySupplier(item) || '-'}</td>
                      <td className="p-4 text-center"><span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">{getInventoryUnit(item) || '-'}</span></td>
                      <td className="p-4 text-sm text-slate-600">{getInventoryPacking(item) || '-'}</td>
                      <td className="p-4 text-right text-sm font-bold">
                        {cost === null ? <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">Missing</span>
                          : <span className="text-orange-600">${formatMoney(cost)}</span>}
                      </td>
                      <td className="p-4 text-right text-sm font-bold text-blue-700">${formatMoney(sell)}</td>
                      <td className="p-4 text-right text-sm font-black">
                        {margin === null ? <span className="text-slate-300">—</span>
                          : <span className={margin < 0 ? 'text-red-600' : 'text-emerald-600'}>{margin.toFixed(1)}%</span>}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`rounded-md border px-2.5 py-1 text-xs font-black ${
                          status === 'out' ? 'border-red-200 bg-red-50 text-red-700'
                            : status === 'low' ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}>{stock}</span>
                        <p className="mt-1 text-[9px] font-black uppercase text-slate-400">{status === 'out' ? 'Out' : status === 'low' ? 'Low' : 'Healthy'}</p>
                      </td>
                      <td className="sticky right-0 bg-white/95 p-4 pr-6 text-center backdrop-blur-sm group-hover:bg-slate-50">
                        <button type="button" onClick={() => { setEditingItem(item); setModalOpen(true); }}
                          className="rounded-lg bg-white p-2 text-slate-400 shadow-sm hover:bg-blue-50 hover:text-blue-600">
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!pageRows.length && (
                  <tr><td colSpan="10" className="p-14 text-center text-sm font-bold text-slate-400">No products match the current search and filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">
                    <ChevronLeft size={14} className="mr-1" /> Prev
                  </button>
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black">{page} / {totalPages}</span>
                  <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">
                    Next <ChevronRight size={14} className="ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {pdfOpen && (
        <InventoryPdfColumnPicker
          fullInventoryRows={filtered}
          customers={customers}
          invoices={invoices}
          inventory={inventory}
          onClose={() => setPdfOpen(false)}
          onExport={async ({ rows, selectedColumns, columnDefinitions, mode, selectedCustomer }) => {
            const customerName = selectedCustomer ? getCustomerName(selectedCustomer) : '';
            const success = await exportInventoryToPDF(rows, selectedColumns, {
              columnDefinitions,
              catalogueTitle: mode === 'customer-history' ? 'Customer Order Catalogue' : 'Inventory Catalogue',
              customerName,
              customerAddress: selectedCustomer ? getCustomerAddress(selectedCustomer) : '',
              filenamePrefix: mode === 'customer-history' && customerName
                ? `customer-catalogue-${customerName}` : 'inventory-catalogue',
              footerLabel: mode === 'customer-history' && customerName
                ? `${customerName} · Previously Ordered Products`
                : 'Three Leaves Inventory Catalogue',
            });
            if (success) setPdfOpen(false);
            return success;
          }}
        />
      )}

      {modalOpen && (
        <InventoryFormModal
          item={editingItem}
          suppliers={suppliers}
          onClose={() => { setModalOpen(false); setEditingItem(null); }}
          onSave={saveProduct}
          onDelete={requestDelete}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${getInventoryName(pendingDelete) || 'product'}?`}
        message="The Supabase row is deleted first. Local Inventory state is only updated after the database confirms success. Products referenced by customized pricing or normal invoice history are blocked from deletion."
        confirmLabel="Delete Product"
        working={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={deleteProduct}
      />

      <ConfirmDialog
        open={Boolean(pendingMigration)}
        title="Change unit and migrate customized pricing?"
        message={pendingMigration
          ? `This product is changing from "${pendingMigration.oldUnit}" to "${pendingMigration.newUnit}".\n\n${pendingMigration.impact.groupRefs.length} Pricing Group rule(s) and ${pendingMigration.impact.customerRefs.length} individual customer override(s) currently use the old product|unit key.\n\nContinuing moves those prices to the new unit key so your existing customized-pricing behavior is preserved.`
          : ''}
        confirmLabel="Change + Migrate Pricing"
        tone="blue"
        working={migrating}
        onCancel={() => setPendingMigration(null)}
        onConfirm={async () => {
          if (!pendingMigration) return;
          setMigrating(true);
          try {
            await saveProduct(pendingMigration.form, {
              migratePricing: true,
              impact: pendingMigration.impact,
            });
          } finally {
            setMigrating(false);
            setPendingMigration(null);
          }
        }}
      />
    </div>
  );
}
