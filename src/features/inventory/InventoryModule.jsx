import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowUpDown, Boxes, CheckCircle, ChevronDown, ClipboardCheck,
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
  ...INVENTORY_EXPORT_COLUMNS.map((column) => {
    if (column.key === 'Price') {
      return {
        ...column,
        label: 'Customer Price (SGD)',
        defaultVisible: true,
      };
    }

    if (
      ['Supplier', 'Description', 'cost_price (SGD)', 'stock'].includes(
        column.key
      )
    ) {
      return {
        ...column,
        defaultVisible: false,
      };
    }

    return column;
  }),
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

const DATA_QUALITY_RULES = [
  { key: 'missing_cost', label: 'Missing Cost', shortLabel: 'Cost' },
  { key: 'missing_supplier', label: 'Missing Supplier', shortLabel: 'Supplier' },
  { key: 'missing_sku', label: 'Missing SKU', shortLabel: 'SKU' },
  { key: 'missing_packing', label: 'Missing Packing', shortLabel: 'Packing' },
  { key: 'missing_description', label: 'Missing Description', shortLabel: 'Description' },
  { key: 'missing_unit', label: 'Missing Unit', shortLabel: 'Unit' },
  { key: 'missing_sell_price', label: 'Missing Sell Price', shortLabel: 'Sell Price' },
];

function getProductCompletenessIssues(item) {
  const issues = [];

  if (!String(getInventorySku(item) || '').trim()) {
    issues.push('missing_sku');
  }

  if (!String(getInventorySupplier(item) || '').trim()) {
    issues.push('missing_supplier');
  }

  if (!String(getInventoryUnit(item) || '').trim()) {
    issues.push('missing_unit');
  }

  if (!String(getInventoryPacking(item) || '').trim()) {
    issues.push('missing_packing');
  }

  if (!String(getInventoryDescription(item) || '').trim()) {
    issues.push('missing_description');
  }

  if (getInventoryCost(item) === null) {
    issues.push('missing_cost');
  }

  const rawSellPrice =
    item?.Price ??
    item?.unitPrice ??
    item?.['Unit Price (SG)'] ??
    null;

  if (
    rawSellPrice === null ||
    rawSellPrice === undefined ||
    rawSellPrice === '' ||
    !Number.isFinite(Number(rawSellPrice))
  ) {
    issues.push('missing_sell_price');
  }

  return issues;
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
      ? options.columnDefinitions
      : INVENTORY_EXPORT_COLUMNS;

    const columns = definitions.filter((column) =>
      selectedKeys.includes(column.key)
    );

    if (!rows.length) {
      window.alert('There is no inventory data to export.');
      return false;
    }

    if (!columns.length) {
      window.alert('Select at least one column for the PDF.');
      return false;
    }

    const customerCatalogue = Boolean(options.customerName);

    // Customer catalogues are kept landscape for a consistent B2B catalogue
    // appearance. Generic Inventory exports may use portrait for short tables.
    const orientation =
      customerCatalogue || columns.length > 4
        ? 'landscape'
        : 'portrait';

    const document = new jsPDF({
      orientation,
      unit: 'pt',
      format: 'a4',
      compress: true,
      putOnlyUsedFonts: true,
      precision: 2,
    });

    let tableFont;

    try {
      tableFont = await loadChinesePdfFont(document);
    } catch (error) {
      window.alert(
        `Chinese PDF font error:\n${
          error?.message || 'Unknown font error.'
        }`
      );
      return false;
    }

    const pageWidth = document.internal.pageSize.getWidth();
    const pageHeight = document.internal.pageSize.getHeight();

    const marginX = orientation === 'landscape' ? 34 : 38;
    const continuationTopMargin = 62;
    const bottomMargin = 44;

    const palette = {
      navy: [15, 23, 42],
      blue: [29, 78, 216],
      blueSoft: [239, 246, 255],
      ink: [30, 41, 59],
      slate: [71, 85, 105],
      muted: [100, 116, 139],
      border: [226, 232, 240],
      rowAlt: [248, 250, 252],
      panel: [248, 250, 252],
      white: [255, 255, 255],
    };

    const catalogueTitle =
      options.catalogueTitle || 'Inventory Catalogue';

    const customerName = String(options.customerName || '');
    const customerAddress = String(options.customerAddress || '');
    const invoiceCount = Number(options.invoiceCount || 0);
    const latestOrderDate = String(options.latestOrderDate || '');

    const generatedDate = new Date().toLocaleDateString('en-SG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    document.setProperties({
      title: customerCatalogue
        ? `${customerName} - ${catalogueTitle}`
        : catalogueTitle,
      subject: customerCatalogue
        ? 'Customer product order catalogue'
        : 'Inventory product catalogue',
      author: 'Three Leaves',
      creator: 'Three Leaves ERP',
    });

    const columnWeights = {
      SKU: 0.8,
      Name: 2.85,
      Supplier: 1.9,
      Unit: 0.7,
      Description: 2.45,
      Packing: 1.15,
      'cost_price (SGD)': 1.0,
      Price: 1.05,
      stock: 0.75,
      'Last Ordered': 1.15,
      Orders: 0.8,
      'Total Qty': 0.85,
      'Last Invoice': 1.2,
    };

    const availableTableWidth = pageWidth - marginX * 2;

    const totalWeight = columns.reduce(
      (total, column) =>
        total + (columnWeights[column.key] || 1),
      0
    );

    const columnStyles = columns.reduce(
      (styles, column, index) => {
        styles[index] = {
          cellWidth:
            availableTableWidth *
            ((columnWeights[column.key] || 1) / totalWeight),
        };

        if (
          ['Price', 'cost_price (SGD)', 'stock', 'Orders', 'Total Qty'].includes(
            column.key
          )
        ) {
          styles[index].halign = 'right';
        } else if (column.key === 'Unit') {
          styles[index].halign = 'center';
        }

        return styles;
      },
      {}
    );

    function formatCellValue(row, column) {
      const value = row[column.key];

      if (['Price', 'cost_price (SGD)'].includes(column.key)) {
        const number = Number(value);
        return Number.isFinite(number)
          ? `$${number.toFixed(2)}`
          : '';
      }

      if (column.key === 'Total Qty') {
        const number = Number(value);

        if (!Number.isFinite(number)) return '';

        return Number.isInteger(number)
          ? String(number)
          : number.toFixed(2).replace(/\.?0+$/, '');
      }

      return String(value ?? '');
    }

    function drawTopRule() {
      document.setFillColor(...palette.navy);
      document.rect(0, 0, pageWidth, 6, 'F');
    }

    function drawFirstPageHeader() {
      drawTopRule();

      document.setTextColor(...palette.navy);
      document.setFont('helvetica', 'bold');
      document.setFontSize(18);
      document.text('THREE LEAVES', marginX, 31);

      document.setFont('helvetica', 'bold');
      document.setFontSize(9);
      document.setTextColor(...palette.blue);
      document.text(
        String(catalogueTitle).toUpperCase(),
        marginX,
        48
      );

      document.setFont('helvetica', 'normal');
      document.setFontSize(8);
      document.setTextColor(...palette.muted);
      document.text(
        `Generated ${generatedDate}`,
        pageWidth - marginX,
        30,
        { align: 'right' }
      );

      document.setFontSize(8);
      document.text(
        `${rows.length} product${rows.length === 1 ? '' : 's'}`,
        pageWidth - marginX,
        45,
        { align: 'right' }
      );

      document.setDrawColor(...palette.border);
      document.setLineWidth(0.8);
      document.line(marginX, 60, pageWidth - marginX, 60);

      if (!customerCatalogue) {
        const panelY = 76;
        const panelHeight = 45;

        document.setFillColor(...palette.panel);
        document.roundedRect(
          marginX,
          panelY,
          pageWidth - marginX * 2,
          panelHeight,
          5,
          5,
          'F'
        );

        document.setFillColor(...palette.blue);
        document.roundedRect(
          marginX,
          panelY,
          4,
          panelHeight,
          2,
          2,
          'F'
        );

        document.setTextColor(...palette.muted);
        document.setFont('helvetica', 'bold');
        document.setFontSize(7.5);
        document.text('CATALOGUE SUMMARY', marginX + 16, panelY + 16);

        document.setTextColor(...palette.ink);
        document.setFont('helvetica', 'normal');
        document.setFontSize(9.5);
        document.text(
          `${rows.length} products included in this catalogue`,
          marginX + 16,
          panelY + 33
        );

        return panelY + panelHeight + 16;
      }

      const panelY = 76;
      const metricsWidth = 222;
      const contentWidth =
        pageWidth - marginX * 2 - metricsWidth - 30;

      document.setFont(tableFont, 'normal');
      document.setFontSize(8.2);

      const addressLines = customerAddress
        ? document.splitTextToSize(
            customerAddress,
            Math.max(190, contentWidth)
          )
        : [];

      const panelHeight = Math.max(
        70,
        48 + addressLines.length * 10
      );

      document.setFillColor(...palette.panel);
      document.roundedRect(
        marginX,
        panelY,
        pageWidth - marginX * 2,
        panelHeight,
        5,
        5,
        'F'
      );

      document.setFillColor(...palette.blue);
      document.roundedRect(
        marginX,
        panelY,
        4,
        panelHeight,
        2,
        2,
        'F'
      );

      document.setFont('helvetica', 'bold');
      document.setFontSize(7.3);
      document.setTextColor(...palette.muted);
      document.text('PREPARED FOR', marginX + 16, panelY + 17);

      document.setFont(tableFont, 'normal');
      document.setFontSize(12.2);
      document.setTextColor(...palette.navy);

      const customerNameLines = document.splitTextToSize(
        customerName || 'Customer',
        Math.max(190, contentWidth)
      );

      document.text(
        customerNameLines,
        marginX + 16,
        panelY + 35
      );

      const customerNameHeight =
        Math.max(1, customerNameLines.length) * 12;

      if (addressLines.length > 0) {
        document.setFont(tableFont, 'normal');
        document.setFontSize(8.2);
        document.setTextColor(...palette.slate);
        document.text(
          addressLines,
          marginX + 16,
          panelY + 42 + customerNameHeight
        );
      }

      const metricsStartX = pageWidth - marginX - metricsWidth;

      document.setDrawColor(...palette.border);
      document.setLineWidth(0.7);
      document.line(
        metricsStartX - 15,
        panelY + 12,
        metricsStartX - 15,
        panelY + panelHeight - 12
      );

      const metricColumns = [
        {
          label: 'PRODUCTS',
          value: String(rows.length),
        },
        {
          label: 'INVOICES',
          value: invoiceCount > 0 ? String(invoiceCount) : '-',
        },
        {
          label: 'LAST ORDER',
          value: latestOrderDate || '-',
        },
      ];

      const metricWidth = metricsWidth / metricColumns.length;

      metricColumns.forEach((metric, index) => {
        const x = metricsStartX + metricWidth * index;

        document.setFont('helvetica', 'bold');
        document.setFontSize(6.7);
        document.setTextColor(...palette.muted);
        document.text(metric.label, x, panelY + 21);

        if (index === 2 && latestOrderDate) {
          document.setFont('helvetica', 'bold');
          document.setFontSize(8);
        } else {
          document.setFont('helvetica', 'bold');
          document.setFontSize(12);
        }

        document.setTextColor(...palette.ink);
        document.text(
          metric.value,
          x,
          panelY + 41,
          {
            maxWidth: metricWidth - 8,
          }
        );
      });

      return panelY + panelHeight + 16;
    }

    function drawContinuationHeader(pageNumber) {
      drawTopRule();

      document.setFont('helvetica', 'bold');
      document.setFontSize(11.5);
      document.setTextColor(...palette.navy);
      document.text('THREE LEAVES', marginX, 25);

      document.setFont('helvetica', 'normal');
      document.setFontSize(7.5);
      document.setTextColor(...palette.muted);
      document.text(catalogueTitle, marginX, 40);

      if (customerCatalogue && customerName) {
        document.setFont(tableFont, 'normal');
        document.setFontSize(8);
        document.setTextColor(...palette.slate);

        const customerHeader = document.splitTextToSize(
          customerName,
          pageWidth * 0.38
        );

        document.text(
          customerHeader.slice(0, 1),
          pageWidth - marginX,
          26,
          { align: 'right' }
        );
      }

      document.setFont('helvetica', 'normal');
      document.setFontSize(7);
      document.setTextColor(...palette.muted);
      document.text(
        `Continuation ${pageNumber}`,
        pageWidth - marginX,
        41,
        { align: 'right' }
      );

      document.setDrawColor(...palette.border);
      document.setLineWidth(0.7);
      document.line(marginX, 50, pageWidth - marginX, 50);
    }

    const firstTableY = drawFirstPageHeader();

    const baseFont =
      columns.length >= 9
        ? 7.2
        : columns.length >= 7
          ? 7.8
          : columns.length >= 5
            ? 8.5
            : 9.2;

    autoTable(document, {
      startY: firstTableY,
      head: [columns.map((column) => column.label)],
      body: rows.map((row) =>
        columns.map((column) =>
          formatCellValue(row, column)
        )
      ),
      theme: 'plain',
      showHead: 'everyPage',
      margin: {
        top: continuationTopMargin,
        right: marginX,
        bottom: bottomMargin,
        left: marginX,
      },
      tableWidth: availableTableWidth,
      styles: {
        font: tableFont,
        fontStyle: 'normal',
        fontSize: baseFont,
        textColor: palette.ink,
        cellPadding: {
          top: 4.2,
          right: 4,
          bottom: 4.2,
          left: 4,
        },
        minCellHeight: 19,
        overflow: 'linebreak',
        valign: 'middle',
        lineWidth: 0,
      },
      headStyles: {
        font: 'helvetica',
        fontStyle: 'bold',
        fontSize: Math.max(7.3, baseFont - 0.2),
        fillColor: palette.navy,
        textColor: palette.white,
        cellPadding: {
          top: 5.5,
          right: 4,
          bottom: 5.5,
          left: 4,
        },
        minCellHeight: 23,
      },
      bodyStyles: {
        fillColor: palette.white,
      },
      alternateRowStyles: {
        fillColor: palette.rowAlt,
      },
      columnStyles,
      rowPageBreak: 'avoid',
      pageBreak: 'auto',
      didParseCell: (data) => {
        const columnKey =
          columns[data.column.index]?.key || '';

        if (data.section === 'head') {
          if (
            ['Price', 'cost_price (SGD)', 'stock', 'Orders', 'Total Qty'].includes(
              columnKey
            )
          ) {
            data.cell.styles.halign = 'right';
          } else if (columnKey === 'Unit') {
            data.cell.styles.halign = 'center';
          }

          return;
        }

        if (data.section !== 'body') return;

        if (columnKey === 'Name') {
          data.cell.styles.textColor = palette.navy;
          data.cell.styles.fontSize = baseFont + 0.35;
        }

        if (
          ['Supplier', 'Description', 'Last Ordered'].includes(columnKey)
        ) {
          data.cell.styles.textColor = palette.slate;
        }

        if (columnKey === 'Description') {
          data.cell.styles.fontSize = Math.max(6.8, baseFont - 0.35);
        }

        if (columnKey === 'SKU') {
          data.cell.styles.textColor = [51, 65, 85];
        }

        if (
          ['Price', 'cost_price (SGD)'].includes(columnKey)
        ) {
          data.cell.styles.font = 'helvetica';
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor =
            columnKey === 'Price'
              ? palette.blue
              : palette.slate;
          data.cell.styles.halign = 'right';
        }

        if (
          ['stock', 'Orders', 'Total Qty'].includes(columnKey)
        ) {
          data.cell.styles.font = 'helvetica';
          data.cell.styles.halign = 'right';
        }

        if (columnKey === 'Last Ordered') {
          data.cell.styles.font = 'helvetica';
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body') return;

        document.setDrawColor(...palette.border);
        document.setLineWidth(0.35);

        document.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      },
      didDrawPage: (data) => {
        const pageNumber =
          document.internal.getCurrentPageInfo().pageNumber;

        if (pageNumber > 1) {
          drawContinuationHeader(pageNumber);
        }
      },
    });

    // A subtle closing summary makes a short final page feel intentional
    // instead of visually unfinished.
    const lastPage = document.getNumberOfPages();
    const finalY = Number(document.lastAutoTable?.finalY || 0);

    if (
      finalY > 0 &&
      pageHeight - finalY > 100
    ) {
      document.setPage(lastPage);

      const summaryY = finalY + 18;
      const summaryHeight = 42;

      document.setFillColor(...palette.panel);
      document.roundedRect(
        marginX,
        summaryY,
        pageWidth - marginX * 2,
        summaryHeight,
        4,
        4,
        'F'
      );

      document.setFont('helvetica', 'bold');
      document.setFontSize(7);
      document.setTextColor(...palette.muted);
      document.text(
        customerCatalogue
          ? 'CATALOGUE SUMMARY'
          : 'EXPORT SUMMARY',
        marginX + 13,
        summaryY + 15
      );

      document.setFont(tableFont, 'normal');
      document.setFontSize(8.2);
      document.setTextColor(...palette.slate);

      const summaryText = customerCatalogue
        ? `${rows.length} products | ${
            invoiceCount > 0
              ? `${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}`
              : 'customer order history'
          }${
            latestOrderDate
              ? ` | Latest order ${latestOrderDate}`
              : ''
          }`
        : `${rows.length} products included | Generated ${generatedDate}`;

      document.text(
        summaryText,
        marginX + 13,
        summaryY + 30,
        {
          maxWidth: pageWidth - marginX * 2 - 26,
        }
      );
    }

    // Add consistent footer after the table so total page count is known.
    const totalPages = document.getNumberOfPages();

    for (
      let pageNumber = 1;
      pageNumber <= totalPages;
      pageNumber += 1
    ) {
      document.setPage(pageNumber);

      document.setDrawColor(...palette.border);
      document.setLineWidth(0.6);
      document.line(
        marginX,
        pageHeight - 29,
        pageWidth - marginX,
        pageHeight - 29
      );

      document.setFont(tableFont, 'normal');
      document.setFontSize(7.1);
      document.setTextColor(...palette.muted);

      const footerLeft = customerCatalogue
        ? `Three Leaves | ${customerName || 'Customer Order Catalogue'}`
        : 'Three Leaves | Inventory Catalogue';

      const footerLines = document.splitTextToSize(
        footerLeft,
        pageWidth * 0.62
      );

      document.text(
        footerLines.slice(0, 1),
        marginX,
        pageHeight - 14
      );

      document.setFont('helvetica', 'normal');
      document.setFontSize(7.1);
      document.text(
        `Page ${pageNumber} of ${totalPages}`,
        pageWidth - marginX,
        pageHeight - 14,
        { align: 'right' }
      );
    }

    const prefix =
      sanitiseFilePart(
        options.filenamePrefix ||
          'inventory-catalogue'
      ) || 'inventory-catalogue';

    document.save(
      `${prefix}-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );

    return true;
  } catch (error) {
    console.error(
      'Inventory PDF export failed:',
      error
    );

    window.alert(
      `Unable to generate the PDF: ${
        error?.message || 'Unknown error'
      }`
    );

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
        rows,
        selectedColumns: columns,
        columnDefinitions: activeColumns,
        mode,
        selectedCustomer,
        invoiceCount:
          mode === 'customer-history'
            ? history.invoiceCount
            : 0,
        latestOrderDate:
          mode === 'customer-history'
            ? history.latestOrderDate
            : '',
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
                <p className="mt-1 text-xs text-slate-500">
                  {mode === 'customer-history'
                    ? 'Customer catalogues default to the essential columns for a cleaner external-facing layout. Supplier, Description and other fields remain optional.'
                    : 'Choose the fields to include. Cost price remains off by default.'}
                </p>
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


function InventoryStocktakePanel({ inventory, onNotify }) {
  const [view, setView] = useState('stocktake');
  const [stocktakes, setStocktakes] = useState([]);
  const [movements, setMovements] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [movementSearch, setMovementSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [stocktakeResult, movementResult] = await Promise.all([
        supabase
          .from('inventory_stock_counts')
          .select('id,stocktake_reference,stocktake_date,status,notes,created_at,completed_at')
          .order('stocktake_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('inventory_movement_ledger')
          .select('*')
          .order('movement_date', { ascending: false })
          .limit(250),
      ]);

      if (stocktakeResult.error) throw stocktakeResult.error;
      if (movementResult.error) throw movementResult.error;

      setStocktakes(Array.isArray(stocktakeResult.data) ? stocktakeResult.data : []);
      setMovements(Array.isArray(movementResult.data) ? movementResult.data : []);
    } catch (error) {
      onNotify('Inventory records could not be loaded', 'error', error?.message || 'Check that the inventory ledger migration has been applied.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const createStocktake = async () => {
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const reference = `ST-${today.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
      const header = await supabase.from('inventory_stock_counts').insert({
        stocktake_reference: reference,
        stocktake_date: today,
        status: 'in_progress',
      }).select().single();
      if (header.error) throw header.error;

      const countable = inventory.filter((item) => getInventoryId(item) != null);
      const rows = countable.map((item) => ({
        stock_count_id: header.data.id,
        product_id: getInventoryId(item),
        system_quantity: getInventoryStock(item),
        physical_quantity: null,
        count_status: 'pending',
        unit_of_measure: getInventoryUnit(item),
      }));

      if (rows.length) {
        const lineResult = await supabase.from('inventory_stock_count_lines').insert(rows);
        if (lineResult.error) {
          await supabase.from('inventory_stock_counts').delete().eq('id', header.data.id);
          throw lineResult.error;
        }
      }

      await loadData();
      setSelectedId(header.data.id);
      await loadLines(header.data.id);
      onNotify('Stocktake created', 'success', `${reference} is ready for physical counting.`);
    } catch (error) {
      onNotify('Could not create stocktake', 'error', error?.message || 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const loadLines = async (id) => {
    if (!id) return setLines([]);
    const result = await supabase
      .from('inventory_stock_count_lines')
      .select('id,stock_count_id,product_id,system_quantity,physical_quantity,variance_quantity,count_status,unit_of_measure,notes,counted_by,counted_at,product_list:product_id(id,Name,SKU,Unit,Packing)')
      .eq('stock_count_id', id)
      .order('created_at', { ascending: true });
    if (result.error) {
      onNotify('Stocktake lines could not be loaded', 'error', result.error.message);
      return;
    }
    setLines(Array.isArray(result.data) ? result.data : []);
  };

  useEffect(() => {
    if (selectedId) loadLines(selectedId);
  }, [selectedId]);

  const selectedStocktake = stocktakes.find((row) => String(row.id) === String(selectedId));

  const updateLine = async (lineId, patch) => {
    const derivedCountState = patch.physical_quantity !== undefined && patch.count_status === undefined
      ? {
          count_status: patch.physical_quantity === null ? 'pending' : 'counted',
          counted_at: patch.physical_quantity === null ? null : new Date().toISOString(),
        }
      : {};
    const result = await supabase.from('inventory_stock_count_lines').update({
      ...patch,
      ...derivedCountState,
    }).eq('id', lineId);
    if (result.error) throw result.error;
    setLines((current) => current.map((line) => String(line.id) === String(lineId)
      ? { ...line, ...patch, ...derivedCountState }
      : line));
  };

  const markNotCountable = async (line) => {
    try {
      await updateLine(line.id, { physical_quantity: null, count_status: 'not_countable', counted_at: null });
    } catch (error) {
      onNotify('Could not update line', 'error', error?.message || 'Unknown error');
    }
  };

  const saveCount = async (line, raw) => {
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) return;
    try {
      await updateLine(line.id, { physical_quantity: value });
    } catch (error) {
      onNotify('Could not save count', 'error', error?.message || 'Unknown error');
    }
  };

  const completeStocktake = async () => {
    if (!selectedStocktake || selectedStocktake.status !== 'in_progress') return;
    const pending = lines.filter((line) => line.count_status === 'pending');
    if (pending.length) {
      onNotify('Stocktake is not ready', 'warning', `${pending.length} line(s) are still pending. Count them or mark them Not Countable.`);
      return;
    }

    setSaving(true);
    try {
      const result = await supabase.rpc('finalize_inventory_stocktake', {
        p_stock_count_id: selectedStocktake.id,
      });
      if (result.error) throw result.error;

      await loadData();
      await loadLines(selectedStocktake.id);
      onNotify('Stocktake completed and posted', 'success', 'Counted variances were posted atomically to product stock and the movement ledger.');
    } catch (error) {
      onNotify('Could not complete stocktake', 'error', error?.message || 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const filteredLines = useMemo(() => {
    const q = normalise(search);
    return lines.filter((line) => {
      const product = line.product_list || {};
      return !q || [product.Name, product.SKU, product.Packing, line.unit_of_measure].map(normalise).join(' ').includes(q);
    });
  }, [lines, search]);

  const stocktakeStats = useMemo(() => {
    const counted = lines.filter((line) => line.count_status === 'counted');
    const excluded = lines.filter((line) => ['not_countable', 'excluded'].includes(line.count_status));
    const variance = counted.reduce((sum, line) => sum + Number(line.variance_quantity || 0), 0);
    return { counted: counted.length, excluded: excluded.length, pending: lines.length - counted.length - excluded.length, variance };
  }, [lines]);

  const filteredMovements = useMemo(() => {
    const q = normalise(movementSearch);
    return movements.filter((row) => !q || [row.product_name, row.sku, row.movement_type, row.reference_id, row.notes].map(normalise).join(' ').includes(q));
  }, [movements, movementSearch]);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-900 px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/15 p-2.5 text-blue-300"><ClipboardCheck size={20} /></div>
          <div>
            <h2 className="text-sm font-black">Stock Control</h2>
            <p className="mt-0.5 text-xs text-slate-400">Physical stocktakes and the inventory movement audit trail.</p>
          </div>
        </div>
        <div className="flex rounded-xl bg-white/10 p-1">
          {[
            ['stocktake', 'Stocktake'],
            ['ledger', 'Movement Ledger'],
          ].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setView(value)} className={`rounded-lg px-3 py-2 text-xs font-black ${view === value ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-white/10'}`}>{label}</button>
          ))}
        </div>
      </div>

      {view === 'stocktake' ? (
        <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[280px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
            <button type="button" disabled={saving} onClick={createStocktake} className="mb-4 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              <ClipboardCheck size={15} className="mr-2" /> New Stocktake
            </button>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Recent stocktakes</p>
            <div className="space-y-2">
              {stocktakes.map((row) => (
                <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className={`w-full rounded-xl border p-3 text-left ${String(row.id) === String(selectedId) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-slate-800">{row.stocktake_reference}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${row.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{row.status.replace('_', ' ')}</span></div>
                  <p className="mt-1 text-[11px] text-slate-500">{row.stocktake_date}</p>
                </button>
              ))}
              {!stocktakes.length && !loading && <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400">No stocktakes yet.</div>}
            </div>
          </aside>

          <section className="min-w-0 p-4 sm:p-5">
            {!selectedStocktake ? (
              <div className="flex min-h-[440px] items-center justify-center text-center"><div><ClipboardCheck size={42} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-black text-slate-700">Start a stocktake</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">Create a session to capture a frozen system quantity and record the physical count without changing your existing inventory numbers.</p></div></div>
            ) : (
              <>
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">{selectedStocktake.stocktake_reference}</p><h3 className="mt-1 text-lg font-black text-slate-900">Physical Count — {selectedStocktake.stocktake_date}</h3></div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Counted {stocktakeStats.counted}/{lines.length}</span>
                    <span className={`rounded-xl px-3 py-2 text-xs font-bold ${stocktakeStats.variance === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>Variance {stocktakeStats.variance > 0 ? '+' : ''}{stocktakeStats.variance}</span>
                    {selectedStocktake.status === 'in_progress' && <button type="button" disabled={saving} onClick={completeStocktake} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50">Complete Stocktake</button>}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU or product..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none" /></div>
                  <span className="hidden rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-500 sm:block">Pending {stocktakeStats.pending}</span>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="max-h-[470px] overflow-auto">
                    <table className="w-full min-w-[760px] text-left">
                      <thead className="sticky top-0 z-10 bg-slate-900 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                        <tr><th className="px-3 py-3">Product</th><th className="px-3 py-3 text-right">System</th><th className="px-3 py-3 text-right">Physical</th><th className="px-3 py-3 text-right">Variance</th><th className="px-3 py-3 text-center">Status</th><th className="px-3 py-3 text-center">Action</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredLines.map((line) => {
                          const product = line.product_list || {};
                          const variance = Number(line.variance_quantity || 0);
                          return <tr key={line.id} className="hover:bg-slate-50">
                            <td className="px-3 py-3"><p className="text-xs font-black text-slate-800">{product.Name || 'Unnamed product'}</p><p className="mt-1 text-[10px] font-mono text-slate-400">{product.SKU || '—'} · {line.unit_of_measure || product.Unit || '—'}</p></td>
                            <td className="px-3 py-3 text-right text-xs font-bold text-slate-600">{line.system_quantity}</td>
                            <td className="px-3 py-3 text-right"><input disabled={selectedStocktake.status !== 'in_progress' || line.count_status === 'not_countable'} type="number" min="0" step="0.01" value={line.physical_quantity ?? ''} onChange={(e) => setLines((current) => current.map((row) => row.id === line.id ? { ...row, physical_quantity: e.target.value === '' ? null : Number(e.target.value), variance_quantity: e.target.value === '' ? null : Number(e.target.value) - Number(row.system_quantity || 0) } : row))} onBlur={(e) => saveCount(line, e.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-right text-sm font-black outline-none focus:border-blue-400 disabled:bg-slate-100" /></td>
                            <td className={`px-3 py-3 text-right text-xs font-black ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{line.variance_quantity == null ? '—' : `${variance > 0 ? '+' : ''}${variance}`}</td>
                            <td className="px-3 py-3 text-center"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${line.count_status === 'counted' ? 'bg-emerald-100 text-emerald-700' : line.count_status === 'not_countable' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>{line.count_status.replace('_', ' ')}</span></td>
                            <td className="px-3 py-3 text-center">{selectedStocktake.status === 'in_progress' && <button type="button" onClick={() => markNotCountable(line)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[9px] font-black text-slate-500 hover:bg-slate-50">Not Countable</button>}</td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-base font-black text-slate-900">Inventory Movement Ledger</h3><p className="mt-1 text-xs text-slate-500">Historical movement records, references and audit context.</p></div><div className="relative w-full sm:w-80"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={movementSearch} onChange={(e) => setMovementSearch(e.target.value)} placeholder="Search product, SKU or reference..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none" /></div></div>
          <div className="mt-4 overflow-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-900 text-[10px] font-black uppercase tracking-[0.12em] text-white"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Product</th><th className="px-3 py-3">Movement</th><th className="px-3 py-3 text-right">Change</th><th className="px-3 py-3">Reference</th><th className="px-3 py-3">Notes</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredMovements.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{formatHistoryDate(row.movement_date)}</td><td className="px-3 py-3"><p className="text-xs font-black text-slate-800">{row.product_name || '—'}</p><p className="text-[10px] font-mono text-slate-400">{row.sku || '—'}</p></td><td className="px-3 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black uppercase text-blue-700">{String(row.movement_type || '').replace(/_/g, ' ')}</span></td><td className={`px-3 py-3 text-right text-xs font-black ${Number(row.quantity_change) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{Number(row.quantity_change) > 0 ? '+' : ''}{row.quantity_change}</td><td className="px-3 py-3 text-xs text-slate-500">{row.reference_type || '—'}{row.reference_id ? ` · ${row.reference_id}` : ''}</td><td className="px-3 py-3 text-xs text-slate-500">{row.notes || '—'}</td></tr>)}{!filteredMovements.length && <tr><td colSpan="6" className="p-10 text-center text-xs font-bold text-slate-400">No movement records found.</td></tr>}</tbody></table></div>
        </div>
      )}
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
  const [qualityFilter, setQualityFilter] = useState('All');
  const [sortOption, setSortOption] = useState('name_asc');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [stockControlOpen, setStockControlOpen] = useState(false);
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
    debouncedSearch, supplierFilter, unitFilter, stockFilter, costFilter, qualityFilter, sortOption,
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

  const qualitySummary = useMemo(() => {
    const counts = Object.fromEntries(
      DATA_QUALITY_RULES.map((rule) => [rule.key, 0])
    );

    let incompleteProducts = 0;
    let completeProducts = 0;
    let totalIssues = 0;

    inventory.forEach((item) => {
      const issues = getProductCompletenessIssues(item);

      if (issues.length === 0) {
        completeProducts += 1;
      } else {
        incompleteProducts += 1;
        totalIssues += issues.length;

        issues.forEach((issue) => {
          counts[issue] = (counts[issue] || 0) + 1;
        });
      }
    });

    const completenessPct =
      inventory.length === 0
        ? 100
        : (completeProducts / inventory.length) * 100;

    return {
      counts,
      incompleteProducts,
      completeProducts,
      totalIssues,
      completenessPct,
    };
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

      const completenessIssues = getProductCompletenessIssues(item);

      if (qualityFilter === 'Incomplete' && completenessIssues.length === 0) {
        return false;
      }

      if (
        qualityFilter !== 'All' &&
        qualityFilter !== 'Incomplete' &&
        !completenessIssues.includes(qualityFilter)
      ) {
        return false;
      }

      return true;
    });

    return [...rows].sort((a, b) => {
      if (qualityFilter !== 'All') {
        const issueDifference =
          getProductCompletenessIssues(b).length -
          getProductCompletenessIssues(a).length;

        if (issueDifference !== 0) return issueDifference;
      }
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
  }, [inventory, debouncedSearch, supplierFilter, unitFilter, stockFilter, costFilter, qualityFilter, sortOption]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage((current) => Math.min(Math.max(1, current), totalPages)), [totalPages]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetFilters = () => {
    setSearchTerm(''); setDebouncedSearch('');
    setSupplierFilter('All'); setUnitFilter('All');
    setStockFilter('All'); setCostFilter('All'); setQualityFilter('All');
    setSortOption('name_asc'); setPage(1);
  };

  const openQualityView = (nextQualityFilter) => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSupplierFilter('All');
    setUnitFilter('All');
    setStockFilter('All');
    setCostFilter('All');
    setQualityFilter(nextQualityFilter);
    setSortOption('name_asc');
    setPage(1);
  };

  const activeQualityRule = DATA_QUALITY_RULES.find(
    (rule) => rule.key === qualityFilter
  );

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
            <button type="button" onClick={() => setStockControlOpen((value) => !value)}
              className={`inline-flex items-center rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-sm ${stockControlOpen ? 'border-blue-300 bg-blue-600 text-white' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
              <ClipboardCheck size={16} className="mr-2" /> Stock Control
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

        {stockControlOpen && (
          <InventoryStocktakePanel
            inventory={inventory}
            onNotify={notify}
          />
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-amber-50/80 via-white to-white p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                qualitySummary.incompleteProducts > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {qualitySummary.incompleteProducts > 0
                  ? <AlertTriangle size={22} />
                  : <CheckCircle size={22} />}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-black text-slate-900">
                    Product Data Health
                  </h2>

                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                    qualitySummary.incompleteProducts > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {qualitySummary.completenessPct.toFixed(0)}% complete
                  </span>
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {qualitySummary.incompleteProducts > 0
                    ? `${qualitySummary.incompleteProducts} product${qualitySummary.incompleteProducts === 1 ? '' : 's'} have ${qualitySummary.totalIssues} incomplete field${qualitySummary.totalIssues === 1 ? '' : 's'} in total. Use the shortcuts below to review them immediately.`
                    : 'All products currently have the key inventory information completed.'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {qualityFilter !== 'All' && (
                <button
                  type="button"
                  onClick={() => openQualityView('All')}
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <X size={14} className="mr-1.5" />
                  Exit Review
                </button>
              )}

              <button
                type="button"
                disabled={qualitySummary.incompleteProducts === 0}
                onClick={() => openQualityView('Incomplete')}
                className="inline-flex items-center rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <AlertTriangle size={14} className="mr-2" />
                Review All Incomplete ({qualitySummary.incompleteProducts})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4 xl:grid-cols-7">
            {DATA_QUALITY_RULES.map((rule) => {
              const count = qualitySummary.counts[rule.key] || 0;
              const isActive = qualityFilter === rule.key;

              return (
                <button
                  key={rule.key}
                  type="button"
                  disabled={count === 0}
                  onClick={() => openQualityView(rule.key)}
                  className={`group min-h-[86px] bg-white px-4 py-3 text-left transition ${
                    isActive
                      ? 'relative z-10 bg-amber-50 ring-2 ring-inset ring-amber-300'
                      : 'hover:bg-slate-50'
                  } disabled:cursor-default disabled:bg-slate-50/80`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-[10px] font-black uppercase tracking-[0.12em] ${
                      count > 0 ? 'text-slate-500' : 'text-slate-300'
                    }`}>
                      {rule.shortLabel}
                    </p>

                    {isActive && (
                      <span className="rounded-full bg-amber-600 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                        Viewing
                      </span>
                    )}
                  </div>

                  <p className={`mt-2 text-xl font-black ${
                    count > 0 ? 'text-amber-700' : 'text-slate-300'
                  }`}>
                    {count}
                  </p>

                  <p className={`mt-0.5 text-[10px] font-semibold ${
                    count > 0 ? 'text-slate-400' : 'text-slate-300'
                  }`}>
                    {count === 1 ? 'product' : 'products'}
                  </p>
                </button>
              );
            })}
          </div>

          {qualityFilter !== 'All' && (
            <div className="flex flex-col gap-2 border-t border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  Quick review active:
                  {' '}
                  {qualityFilter === 'Incomplete'
                    ? 'All products with incomplete information'
                    : activeQualityRule?.label || 'Incomplete information'}
                </span>
              </div>

              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                {filtered.length} product{filtered.length === 1 ? '' : 's'} ready to review
              </span>
            </div>
          )}
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
              {(searchTerm || supplierFilter !== 'All' || unitFilter !== 'All' || stockFilter !== 'All' || costFilter !== 'All' || qualityFilter !== 'All' || sortOption !== 'name_asc') && (
                <button type="button" onClick={resetFilters}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
                  <RotateCcw size={13} className="mr-1.5" /> Reset filters
                </button>
              )}
            </div>
          </div>

          <div className="w-full overflow-x-hidden">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[27%]" />
                <col className="w-[13%]" />
                <col className="w-[7%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
                <col className="w-[6%]" />
                <col className="w-[4%]" />
              </colgroup>

              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr className="border-b border-slate-200 text-[clamp(8px,0.62vw,10px)] font-black uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-2.5 py-3 pl-4">SKU</th>
                  <th className="px-2.5 py-3">Product</th>
                  <th className="px-2.5 py-3">Supplier</th>
                  <th className="px-2 py-3 text-center">Unit</th>
                  <th className="px-2.5 py-3">Packing</th>
                  <th className="px-2 py-3 text-right">Cost</th>
                  <th className="px-2 py-3 text-right">Sell</th>
                  <th className="px-2 py-3 text-right">Margin</th>
                  <th className="px-2 py-3 text-center">Stock</th>
                  <th className="px-1.5 py-3 text-center">Edit</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {pageRows.map((item, index) => {
                  const cost = getInventoryCost(item);
                  const sell = getInventoryPrice(item);
                  const margin = getMargin(item);
                  const stock = getInventoryStock(item);
                  const status = getStockStatus(stock);
                  const dataIssues = getProductCompletenessIssues(item);

                  return (
                    <tr key={getInventoryId(item) || index} className="group hover:bg-slate-50">
                      <td className="truncate whitespace-nowrap px-2.5 py-3 pl-4 font-mono text-[clamp(10px,0.76vw,12px)] uppercase text-slate-500">
                        {getInventorySku(item) || '-'}
                      </td>

                      <td className="px-2.5 py-3 align-top">
                        <p className="line-clamp-2 break-words text-[clamp(11px,0.92vw,14px)] font-bold leading-[1.28] text-slate-800">
                          {getInventoryName(item) || 'Unnamed Product'}
                        </p>

                        {getInventoryDescription(item) && (
                          <p className="mt-1 line-clamp-2 break-words text-[clamp(9px,0.72vw,11px)] leading-[1.35] text-slate-500">
                            {getInventoryDescription(item)}
                          </p>
                        )}

                        {dataIssues.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {dataIssues
                              .slice(0, 3)
                              .map((issue) => {
                                const rule = DATA_QUALITY_RULES.find(
                                  (entry) => entry.key === issue
                                );

                                return (
                                  <span
                                    key={issue}
                                    className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-amber-700"
                                  >
                                    {rule?.shortLabel || issue}
                                  </span>
                                );
                              })}

                            {dataIssues.length > 3 && (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-black text-slate-500">
                                +{dataIssues.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-2.5 py-3 align-top">
                        <p className="line-clamp-2 break-words text-[clamp(10px,0.76vw,12px)] font-bold leading-[1.3] text-indigo-600">
                          {getInventorySupplier(item) || '-'}
                        </p>
                      </td>

                      <td className="px-2 py-3 text-center align-top">
                        <span className="inline-block max-w-full truncate rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[clamp(9px,0.7vw,11px)] text-slate-600">
                          {getInventoryUnit(item) || '-'}
                        </span>
                      </td>

                      <td className="px-2.5 py-3 align-top">
                        <p className="line-clamp-2 break-words text-[clamp(9px,0.72vw,11px)] leading-[1.35] text-slate-600">
                          {getInventoryPacking(item) || '-'}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-2 py-3 text-right align-top text-[clamp(9px,0.72vw,11px)] font-bold">
                        {cost === null ? (
                          <span className="rounded-md bg-amber-50 px-1.5 py-1 text-[clamp(8px,0.62vw,10px)] text-amber-700">
                            Missing
                          </span>
                        ) : (
                          <span className="text-orange-600">
                            ${formatMoney(cost)}
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-2 py-3 text-right align-top text-[clamp(9px,0.72vw,11px)] font-bold text-blue-700">
                        ${formatMoney(sell)}
                      </td>

                      <td className="whitespace-nowrap px-2 py-3 text-right align-top text-[clamp(9px,0.72vw,11px)] font-black">
                        {margin === null ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <span className={margin < 0 ? 'text-red-600' : 'text-emerald-600'}>
                            {margin.toFixed(1)}%
                          </span>
                        )}
                      </td>

                      <td className="px-2 py-3 text-center align-top">
                        <span
                          className={`inline-block rounded-md border px-1.5 py-1 text-[clamp(9px,0.68vw,10px)] font-black ${
                            status === 'out'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : status === 'low'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {stock}
                        </span>

                        <p className="mt-1 text-[clamp(7px,0.55vw,9px)] font-black uppercase leading-none text-slate-400">
                          {status === 'out' ? 'Out' : status === 'low' ? 'Low' : 'Healthy'}
                        </p>
                      </td>

                      <td className="px-1.5 py-3 text-center align-top">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setModalOpen(true);
                          }}
                          className="inline-flex rounded-lg bg-white p-1.5 text-slate-400 shadow-sm transition hover:bg-blue-50 hover:text-blue-600"
                          aria-label={`Edit ${getInventoryName(item) || 'product'}`}
                        >
                          <Edit size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!pageRows.length && (
                  <tr>
                    <td colSpan="10" className="p-14 text-center text-sm font-bold text-slate-400">
                      No products match the current search and filters.
                    </td>
                  </tr>
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
          onExport={async ({
            rows,
            selectedColumns,
            columnDefinitions,
            mode,
            selectedCustomer,
            invoiceCount,
            latestOrderDate,
          }) => {
            const customerName = selectedCustomer
              ? getCustomerName(selectedCustomer)
              : '';

            const success = await exportInventoryToPDF(
              rows,
              selectedColumns,
              {
                columnDefinitions,
                catalogueTitle:
                  mode === 'customer-history'
                    ? 'Customer Order Catalogue'
                    : 'Inventory Catalogue',
                customerName,
                customerAddress: selectedCustomer
                  ? getCustomerAddress(selectedCustomer)
                  : '',
                invoiceCount,
                latestOrderDate,
                filenamePrefix:
                  mode === 'customer-history' && customerName
                    ? `customer-catalogue-${customerName}`
                    : 'inventory-catalogue',
                footerLabel:
                  mode === 'customer-history' && customerName
                    ? `${customerName} | Previously Ordered Products`
                    : 'Three Leaves Inventory Catalogue',
              }
            );
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
