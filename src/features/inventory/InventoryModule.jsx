import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Edit, Package, X, Trash2, Save, CheckCircle, Download, FileText, LoaderCircle } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


// ==========================================
// INVENTORY EXPORT CONFIGURATION
// ==========================================
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

function normaliseInventoryForExport(items) {
  const safeItems = Array.isArray(items) ? items : [];

  return safeItems.map((item) => ({
    SKU: item?.SKU ?? item?.sku ?? '',
    Name: item?.Name ?? item?.name ?? item?.Items ?? '',
    Supplier: item?.Supplier ?? item?.supplier ?? '',
    Unit: item?.Unit ?? item?.unit ?? '',
    Description: item?.Description ?? item?.description ?? '',
    Packing: item?.Packing ?? item?.packaging ?? '',
    'cost_price (SGD)': Number(
      item?.['cost_price (SGD)'] ?? item?.cost_price ?? item?.costPrice ?? 0
    ),
    Price: Number(item?.Price ?? item?.unitPrice ?? item?.['Unit Price (SG)'] ?? 0),
    stock: Number(item?.stock ?? item?.Stock ?? 0),
  }));
}

function exportInventoryToExcel(items) {
  const rows = normaliseInventoryForExport(items);

  if (rows.length === 0) {
    window.alert('There is no inventory data to export.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: INVENTORY_EXPORT_COLUMNS.map((column) => column.key),
  });

  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 32 },
    { wch: 24 },
    { wch: 14 },
    { wch: 40 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
  ];

  worksheet['!autofilter'] = {
    ref: worksheet['!ref'],
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
  XLSX.writeFile(workbook, `inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function loadChinesePdfFont(document) {
  const fontFileName = 'NotoSansSC-Regular.ttf';
  const fontFamily = 'NotoSansSC';
  const baseUrl = String(import.meta.env.BASE_URL || '/');
  const normalisedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  // Try the Vite base path first, then the domain-root path as a fallback.
  const candidateUrls = [
    `${normalisedBaseUrl}fonts/${fontFileName}`,
    `/fonts/${fontFileName}`,
  ].filter((url, index, urls) => urls.indexOf(url) === index);

  let lastError = null;

  for (const fontUrl of candidateUrls) {
    try {
      const response = await fetch(fontUrl, {
        cache: 'no-store',
        headers: { Accept: 'font/ttf,application/octet-stream,*/*' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} while loading ${fontUrl}`);
      }

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const fontBuffer = await response.arrayBuffer();
      const fontBytes = new Uint8Array(fontBuffer);

      if (contentType.includes('text/html')) {
        throw new Error(`${fontUrl} returned an HTML page instead of the font file.`);
      }

      if (fontBytes.byteLength < 1000) {
        const smallFileText = new TextDecoder().decode(fontBytes);
        if (smallFileText.includes('git-lfs.github.com/spec')) {
          throw new Error(
            `${fontUrl} is a Git LFS pointer, not the actual font. Upload the real TTF file to the repository.`
          );
        }
        throw new Error(`${fontUrl} is only ${fontBytes.byteLength} bytes and is not a valid font file.`);
      }

      // jsPDF needs a TrueType font. OpenType/CFF fonts start with "OTTO"
      // and cannot simply be renamed from .otf to .ttf.
      const signature = String.fromCharCode(...fontBytes.slice(0, 4));
      const isTrueType =
        (fontBytes[0] === 0x00 && fontBytes[1] === 0x01 && fontBytes[2] === 0x00 && fontBytes[3] === 0x00) ||
        signature === 'true' ||
        signature === 'ttcf';

      if (!isTrueType) {
        if (signature === 'OTTO') {
          throw new Error(
            `${fontUrl} is an OpenType/CFF font, not a TrueType font. Use a genuine .ttf version.`
          );
        }
        throw new Error(
          `${fontUrl} has an unsupported font signature (${JSON.stringify(signature)}). Use a genuine TrueType .ttf file.`
        );
      }

      let binaryString = '';
      const chunkSize = 0x8000;
      for (let index = 0; index < fontBytes.length; index += chunkSize) {
        binaryString += String.fromCharCode(...fontBytes.subarray(index, index + chunkSize));
      }

      const fontBase64 = window.btoa(binaryString);
      document.addFileToVFS(fontFileName, fontBase64);
      document.addFont(fontFileName, fontFamily, 'normal');

      const registeredFonts = document.getFontList?.() || {};
      if (!registeredFonts[fontFamily]) {
        throw new Error('jsPDF received the font but could not register it. The TTF may be incompatible or corrupted.');
      }

      document.setFont(fontFamily, 'normal');
      return fontFamily;
    } catch (error) {
      lastError = error;
      console.error(`Chinese PDF font load failed for ${fontUrl}:`, error);
    }
  }

  throw lastError || new Error('The Chinese PDF font could not be loaded.');
}

async function exportInventoryToPDF(items, selectedColumnKeys) {
  try {
  const rows = normaliseInventoryForExport(items);
  const selectedColumns = INVENTORY_EXPORT_COLUMNS.filter((column) =>
    selectedColumnKeys.includes(column.key)
  );

  if (rows.length === 0) {
    window.alert('There is no inventory data to export.');
    return false;
  }

  if (selectedColumns.length === 0) {
    window.alert('Select at least one column for the PDF.');
    return false;
  }

  const orientation = selectedColumns.length <= 4 ? 'portrait' : 'landscape';

  // 20% larger than the previous PDF while keeping a responsive size
  // for exports that contain many columns.
  const previousFontSize =
    selectedColumns.length >= 8 ? 6.5 : selectedColumns.length >= 6 ? 7.5 : 9;
  const fontSize = Number((previousFontSize * 1.2).toFixed(1));

  // This creates a true vector PDF. Do not replace this flow with
  // html2canvas or page screenshots, because those become blurry JPEGs.
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
    console.error('Chinese PDF font error:', error);
    window.alert(
      `Chinese PDF font error:
${error?.message || 'Unknown font-loading error.'}`
    );
    return false;
  }

  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const generatedDate = new Date().toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  document.setFillColor(15, 23, 42);
  document.rect(0, 0, pageWidth, 74, 'F');
  document.setTextColor(255, 255, 255);
  document.setFont('helvetica', 'bold');
  document.setFontSize(20);
  document.text('THREE LEAVES', 40, 31);
  document.setFontSize(12);
  document.text('Inventory Catalogue', 40, 53);

  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.text(`Generated: ${generatedDate}`, pageWidth - 40, 31, { align: 'right' });
  document.text(`${rows.length} product${rows.length === 1 ? '' : 's'}`, pageWidth - 40, 50, {
    align: 'right',
  });

  autoTable(document, {
    startY: 92,
    head: [selectedColumns.map((column) => column.label)],
    body: rows.map((row) =>
      selectedColumns.map((column) => {
        const value = row[column.key];
        if (column.key === 'Price' || column.key === 'cost_price (SGD)') {
          return `$${Number(value || 0).toFixed(2)}`;
        }
        return String(value ?? '');
      })
    ),
    theme: 'grid',
    margin: { top: 92, right: 32, bottom: 42, left: 32 },
    styles: {
      font: tableFont,
      fontStyle: 'normal',
      fontSize,
      // Slightly tighter padding offsets the larger type without making
      // the rows feel cramped or causing unnecessary horizontal overflow.
      cellPadding: { top: 4, right: 3.5, bottom: 4, left: 3.5 },
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      textColor: [30, 41, 59],
    },
    headStyles: {
      font: tableFont,
      fontStyle: 'normal',
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    columnStyles: selectedColumns.reduce((styles, column, index) => {
      const nextStyle = {};

      if (column.key === 'Price' || column.key === 'cost_price (SGD)' || column.key === 'stock') {
        nextStyle.halign = 'right';
      }

      // Optimised customer-catalogue proportions for the common
      // Product Name + Unit + Description export.
      if (selectedColumns.length === 3) {
        if (column.key === 'Name') nextStyle.cellWidth = 190;
        if (column.key === 'Unit') nextStyle.cellWidth = 70;
        if (column.key === 'Description') nextStyle.cellWidth = 'auto';
      }

      if (Object.keys(nextStyle).length > 0) {
        styles[index] = nextStyle;
      }

      return styles;
    }, {}),
    didDrawPage: () => {
      const currentPage = document.internal.getCurrentPageInfo().pageNumber;
      document.setDrawColor(226, 232, 240);
      document.line(32, pageHeight - 30, pageWidth - 32, pageHeight - 30);
      document.setFont('helvetica', 'normal');
      document.setFontSize(8);
      document.setTextColor(100, 116, 139);
      document.text('Three Leaves Inventory Catalogue', 32, pageHeight - 15);
      document.text(`Page ${currentPage}`, pageWidth - 32, pageHeight - 15, { align: 'right' });
    },
  });

  document.save(`inventory-catalogue-${new Date().toISOString().slice(0, 10)}.pdf`);
  return true;
  } catch (error) {
    console.error('Inventory PDF export failed:', error);
    window.alert(`Unable to generate the PDF: ${error?.message || 'Unknown error'}`);
    return false;
  }
}

// ==========================================
// COMPONENT: PDF COLUMN SELECTOR
// ==========================================
function InventoryPdfColumnPicker({ onClose, onExport }) {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState(
    INVENTORY_EXPORT_COLUMNS
      .filter((column) => column.defaultVisible)
      .map((column) => column.key)
  );

  const toggleColumn = (columnKey) => {
    setSelectedColumns((current) =>
      current.includes(columnKey)
        ? current.filter((key) => key !== columnKey)
        : [...current, columnKey]
    );
  };

  const handleExport = async () => {
    if (isExporting || selectedColumns.length === 0) return;
    setIsExporting(true);
    try {
      await onExport(selectedColumns);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div>
            <h2 className="text-base font-semibold">Customer PDF Columns</h2>
            <p className="mt-0.5 text-xs text-slate-300">
              Choose the information to include in the customer catalogue.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors hover:bg-slate-800"
            aria-label="Close PDF column selector"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedColumns(INVENTORY_EXPORT_COLUMNS.map((column) => column.key))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => setSelectedColumns([])}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INVENTORY_EXPORT_COLUMNS.map((column) => (
              <label
                key={column.key}
                className={`flex cursor-pointer items-center rounded-xl border p-3 text-sm transition-colors ${
                  selectedColumns.includes(column.key)
                    ? 'border-blue-200 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(column.key)}
                  onChange={() => toggleColumn(column.key)}
                  className="mr-3 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium">{column.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
            <span className="text-xs font-medium text-slate-500">
              {selectedColumns.length} column{selectedColumns.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-5 py-2.5 text-sm text-slate-500 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedColumns.length === 0 || isExporting}
                onClick={handleExport}
                className="flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExporting ? (
                  <><LoaderCircle size={16} className="mr-2 animate-spin" /> Generating PDF...</>
                ) : (
                  <><FileText size={16} className="mr-2" /> Export PDF</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_UNITS = [
  '箱', 
  '包', 
  '个', 
  '袋', 
  '瓶', 
  'per 100g', 
  'per 250g', 
  'per 500g', 
  'per 1kg',
  'per 5kg'
];

// ==========================================
// COMPONENT: STRICT SUPPLIER AUTOCOMPLETE
// ==========================================
function SupplierSearchInput({ value, onChange, suppliers }) {
  const [isOpen, setIsOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(value || '');
  const dropdownRef = useRef(null);

  // Extract a clean list of verified supplier names
  const supplierNames = useMemo(() => {
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
    const names = safeSuppliers.map(s => s?.name || s?.Name || s?.supplier_name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [suppliers]);

  const filtered = supplierNames.filter(s => s.toLowerCase().includes(localSearch.toLowerCase()));

  // Sync local search term if parent value changes
  useEffect(() => {
    setLocalSearch(value || '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        // STRICT MODE: If the typed text isn't a verified supplier, wipe it out.
        if (localSearch && !supplierNames.includes(localSearch)) {
          setLocalSearch('');
          onChange('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [localSearch, supplierNames, onChange]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => {
            const val = e.target.value;
            setLocalSearch(val);
            setIsOpen(true);
            // Only update parent form if it perfectly matches a valid supplier
            if (supplierNames.includes(val)) {
              onChange(val);
            } else {
              onChange(''); 
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search verified suppliers..."
          className="w-full border border-slate-200 rounded-xl py-3 pl-10 pr-3 text-base text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
      {isOpen && (
        <div className="absolute z-[6000] top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map(sup => (
              <button
                key={sup}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-bold text-slate-700 border-b border-slate-100 last:border-0 transition-colors"
                onClick={() => {
                  setLocalSearch(sup);
                  onChange(sup);
                  setIsOpen(false);
                }}
              >
                {sup}
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 font-medium">
              No matching supplier found in registry.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENT: INVENTORY ADD/EDIT MODAL
// ==========================================
function InventoryFormModal({ item, suppliers, onClose, onSave, onDelete }) {
  const [formData, setFormData] = useState({
    id: item?.id || `prod-${Date.now()}`,
    sku: item?.sku || item?.SKU || '',
    Name: item?.Name || item?.name || item?.Items || '',
    Supplier: item?.Supplier || item?.supplier || '', 
    Unit: item?.Unit || item?.unit || '箱',
    Description: item?.Description || item?.description || '',
    Packing: item?.Packing || item?.packaging || '',
    cost_price: item?.['cost_price (SGD)'] ?? item?.cost_price ?? item?.costPrice ?? 0,
    Price: item?.Price || item?.unitPrice || item?.['Unit Price (SG)'] || 0,
    stock: item?.stock ?? item?.Stock ?? 0,
  });

  const safeUnit = String(formData.Unit || '');
  const initialIsCustom = safeUnit && !DEFAULT_UNITS.includes(safeUnit);
  const [isCustomUnit, setIsCustomUnit] = useState(initialIsCustom);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleUnitDropdown = (e) => {
    const val = e.target.value;
    if (val === '__CUSTOM__') {
      setIsCustomUnit(true);
      setFormData({ ...formData, Unit: '' }); 
    } else {
      setFormData({ ...formData, Unit: val });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden">
        
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
          <h2 className="text-base font-semibold flex items-center">
            <Package size={18} className="mr-2 text-blue-400" />
            {item ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button type="button" onClick={onClose} className="hover:bg-slate-800 p-1.5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm text-slate-500 mb-1">SKU</label>
              <input 
                type="text" 
                name="sku" 
                value={formData.sku} 
                onChange={handleChange}
                placeholder="e.g. TL-001"
                className="w-full border border-slate-200 rounded-xl p-3 text-base text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-slate-500 mb-1">Product Name</label>
              <input 
                required
                type="text" 
                name="Name" 
                value={formData.Name} 
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-xl p-3 text-base text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">Supplier</label>
              <SupplierSearchInput 
                value={formData.Supplier}
                onChange={(val) => setFormData({ ...formData, Supplier: val })}
                suppliers={suppliers}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Description</label>
              <input 
                type="text" 
                name="Description" 
                value={formData.Description} 
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-xl p-3 text-base text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">Packing</label>
              <input 
                type="text" 
                name="Packing" 
                value={formData.Packing} 
                onChange={handleChange}
                placeholder="e.g. 24 x 300g"
                className="w-full border border-slate-200 rounded-xl p-3 text-base text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm text-slate-500 mb-1">Unit</label>
              {!isCustomUnit ? (
                <select
                  name="Unit"
                  value={DEFAULT_UNITS.includes(safeUnit) ? safeUnit : ''}
                  onChange={handleUnitDropdown}
                  className="w-full border border-slate-200 rounded-xl p-3 text-base text-center text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  {DEFAULT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  {safeUnit && !DEFAULT_UNITS.includes(safeUnit) && (
                    <option value={safeUnit}>{safeUnit}</option>
                  )}
                  <option value="__CUSTOM__" className="font-bold text-blue-600">+ Add Custom...</option>
                </select>
              ) : (
                <div className="flex items-center border border-blue-300 bg-blue-50 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden">
                  <input
                    type="text"
                    name="Unit"
                    value={formData.Unit}
                    onChange={handleChange}
                    autoFocus
                    placeholder="e.g. per 200g"
                    className="w-full p-3 bg-transparent text-base text-center text-blue-800 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomUnit(false);
                      setFormData({ ...formData, Unit: '箱' });
                    }}
                    className="text-blue-400 hover:text-red-500 p-3 bg-blue-100/50 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-orange-600 mb-1">Cost Price</label>
              <input 
                type="number" 
                step="0.01"
                name="cost_price" 
                value={formData.cost_price} 
                onChange={handleChange}
                className="w-full border border-orange-200 bg-orange-50 rounded-xl p-3 text-base text-right text-orange-700 focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-blue-600 mb-1">Sell Price</label>
              <input 
                required
                type="number" 
                step="0.01"
                name="Price" 
                value={formData.Price} 
                onChange={handleChange}
                className="w-full border border-blue-200 bg-blue-50 rounded-xl p-3 text-base text-right text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-emerald-600 mb-1">Stock</label>
              <input 
                type="number" 
                name="stock" 
                value={formData.stock} 
                onChange={handleChange}
                className="w-full border border-emerald-200 bg-emerald-50 rounded-xl p-3 text-base text-right text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-100">
            {item ? (
              <button 
                type="button"
                onClick={() => onDelete(item)}
                className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg text-sm flex items-center transition-colors"
              >
                <Trash2 size={16} className="mr-2" /> Delete
              </button>
            ) : <div></div>}

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="px-5 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm flex items-center shadow-lg transition-colors"
              >
                <Save size={16} className="mr-2" /> Save Product
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// MAIN INVENTORY MODULE
// ==========================================
export function InventoryModule({ sys }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isPdfColumnPickerOpen, setIsPdfColumnPickerOpen] = useState(false);

  // INDEPENDENT SUPPLIER REGISTRY STATE
  const [verifiedSuppliers, setVerifiedSuppliers] = useState([]);
  
  // Fetch real suppliers directly from database to enforce strict mode
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const { data, error } = await supabase.from('suppliers').select('*');
        if (!error && data) setVerifiedSuppliers(data);
      } catch (err) {
        console.error("Error fetching suppliers:", err);
      }
    };
    fetchSuppliers();
  }, [isModalOpen]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 6000); 
  };

  const safeInventoryArray = Array.isArray(sys?.inventory) ? sys.inventory : [];
  
  const filteredInventory = safeInventoryArray.filter((item) => {
    const sku = String(item?.sku || item?.SKU || '');
    const name = String(item?.Name || item?.name || item?.Items || '');
    const desc = String(item?.Description || item?.description || '');
    const packing = String(item?.Packing || item?.packaging || '');
    const supplier = String(item?.Supplier || item?.supplier || ''); 
    
    const searchLower = String(searchTerm).toLowerCase();
    return (
      sku.toLowerCase().includes(searchLower) ||
      name.toLowerCase().includes(searchLower) ||
      desc.toLowerCase().includes(searchLower) ||
      packing.toLowerCase().includes(searchLower) ||
      supplier.toLowerCase().includes(searchLower)
    );
  });

  const handleSaveProduct = async (formData) => {
    try {
      const isEditing = !!editingItem;
      const oldPrice = isEditing ? (editingItem.Price || editingItem.unitPrice || editingItem['Unit Price (SG)']) : 0;
      const priceChanged = isEditing && Number(oldPrice) !== Number(formData.Price);

      const payload = {
        SKU: formData.sku,
        Name: formData.Name,
        Supplier: formData.Supplier, 
        Unit: formData.Unit,
        Description: formData.Description,
        Packing: formData.Packing,
        "cost_price (SGD)": Number(formData.cost_price) || 0,
        Price: Number(formData.Price) || 0,
        stock: parseInt(formData.stock, 10) || 0
      };

      let savedProduct;

      if (isEditing) {
        const finalId = editingItem.id || formData.id;
        const finalIdStr = String(finalId || '');
        const isUUID = finalIdStr.length === 36 && finalIdStr.includes('-');
        
        if (isUUID) {
          const { data, error } = await supabase
            .from('product_list')
            .update(payload)
            .eq('id', finalIdStr)
            .select()
            .single();
            
          if (error) throw error;
          savedProduct = data;
        } else {
          const legacyName = editingItem.Name || editingItem.name || editingItem.Items;
          const { data, error } = await supabase
            .from('product_list')
            .update(payload)
            .eq('Name', legacyName)
            .select()
            .single();
            
          if (error) throw error;
          savedProduct = data;
        }
      } else {
        const { data, error } = await supabase
          .from('product_list')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        savedProduct = data;
      }

      if (isEditing) {
        const updatedInventory = safeInventoryArray.map(item => {
          const matchById = item.id && item.id === (editingItem.id || formData.id);
          const matchByName = !item.id && (item.Name === editingItem.Name || item.name === editingItem.Name || item.Items === editingItem.Name);
          
          if (matchById || matchByName) {
            return { ...item, ...savedProduct, ...formData }; 
          }
          return item;
        });
        sys.setInventory(updatedInventory);
      } else {
        sys.setInventory([savedProduct, ...safeInventoryArray]);
      }

      if (priceChanged && savedProduct?.id) {
        await supabase.from('price_history').insert({
          product_id: savedProduct.id,
          product_name: formData.Name,
          old_price_sg: oldPrice,
          new_price_sg: payload.Price
        });
      }

      showNotification(isEditing ? 'Product successfully updated!' : 'New product added to catalog!');
      setIsModalOpen(false);
      setEditingItem(null);

    } catch (error) {
      console.error("Save error: ", error);
      showNotification(`DB Error: ${error.message || 'Failed to save product'}`, 'error');
    }
  };

  const handleDeleteProduct = async (itemToRemove) => {
    const itemName = itemToRemove.Name || itemToRemove.name || itemToRemove.Items;
    if (window.confirm(`Are you sure you want to delete ${itemName}?`)) {
      try {
        const updatedInventory = safeInventoryArray.filter(item => {
          if (itemToRemove.id && item.id) return item.id !== itemToRemove.id;
          return (item.Name || item.name || item.Items) !== itemName;
        });
        sys.setInventory(updatedInventory);
        
        const isUUID = itemToRemove.id && String(itemToRemove.id).length === 36;
        if (isUUID) {
          const { error } = await supabase
            .from('product_list')
            .delete()
            .eq('id', itemToRemove.id);
            
          if (error) throw error;
        }
        
        showNotification('Product removed from catalog.', 'error');
        setIsModalOpen(false);
        setEditingItem(null);
        
      } catch (error) {
        console.error("Delete error: ", error);
        showNotification(`Delete Error: ${error.message || 'Failed to delete product'}`, 'error');
      }
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 h-full overflow-y-auto relative bg-slate-50/50">
      
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
            <Package className="mr-3 text-blue-600" size={28} />
            Inventory Catalog
          </h1>
          <p className="text-base text-slate-500 mt-1">
            Manage your products, suppliers, packaging, and pricing details.
          </p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium text-base flex items-center shadow-lg hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus size={20} className="mr-2" /> Add Product
        </button>
      </div>


      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => exportInventoryToExcel(filteredInventory)}
          className="flex items-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 active:scale-95"
        >
          <Download size={17} className="mr-2" /> Download Excel
        </button>
        <button
          type="button"
          onClick={() => setIsPdfColumnPickerOpen(true)}
          className="flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 active:scale-95"
        >
          <FileText size={17} className="mr-2" /> Customer PDF
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center bg-slate-50 shrink-0">
          <Search className="text-slate-400 mr-3" size={22} />
          <input
            type="text"
            placeholder="Search by SKU, Name, Supplier, Description, or Packing..."
            className="w-full bg-transparent border-none focus:ring-0 text-base placeholder:text-slate-400 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="w-full overflow-x-auto">
          {/* UPDATED: Removed min-w-[1200px] and whitespace-nowrap from table wrapper */}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                {/* UPDATED: Applied dynamic percentage widths and tightened padding to maximize layout efficiency */}
                <th className="p-4 pl-8 w-[10%]">SKU</th>
                <th className="p-4 w-[20%]">Name</th>
                <th className="p-4 w-[15%]">Supplier</th>
                <th className="p-4 text-center w-[8%]">Unit</th>
                <th className="p-4 w-[17%]">Description</th>
                <th className="p-4 w-[10%]">Packing</th>
                <th className="p-4 text-right w-[8%] whitespace-nowrap">Cost Price</th>
                <th className="p-4 text-right w-[8%] whitespace-nowrap">Sell Price</th>
                <th className="p-4 text-center w-[6%]">Stock</th>
                <th className="p-4 pr-8 text-center sticky right-0 bg-white shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] w-[6%]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.map((item, idx) => {
                const sku = item?.sku || item?.SKU || '-';
                const name = item?.Name || item?.name || item?.Items || 'Unnamed Product';
                const supplier = item?.Supplier || item?.supplier || '-';
                const unit = item?.Unit || item?.unit || '-';
                const desc = item?.Description || item?.description || '-';
                const packing = item?.Packing || item?.packaging || '-';
                const costPrice = item?.['cost_price (SGD)'] ?? item?.cost_price ?? item?.costPrice ?? 0;
                const price = item?.Price || item?.unitPrice || item?.['Unit Price (SG)'] || 0;
                const stock = item?.stock ?? item?.Stock ?? 0; 

                return (
                  <tr key={item.id || `fallback-${idx}`} className="hover:bg-slate-50 transition-colors">
                    {/* UPDATED: Added target whitespace-nowrap and whitespace-normal rules to format individual cells correctly */}
                    <td className="p-4 pl-8 text-sm font-mono text-slate-500 uppercase whitespace-nowrap">{sku}</td>
                    <td className="p-4 text-sm text-slate-800 font-bold whitespace-normal leading-tight">{name}</td>
                    <td className="p-4 text-sm font-bold text-indigo-600 whitespace-normal leading-tight">{supplier}</td>
                    <td className="p-4 text-center">
                      <span className="text-xs text-slate-600 border border-slate-200 px-2 py-1 rounded-md bg-white whitespace-nowrap">
                        {unit}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-600 whitespace-normal leading-tight">{desc}</td>
                    <td className="p-4 text-sm text-slate-600 whitespace-normal leading-tight">{packing}</td>
                    <td className="p-4 text-right text-sm font-bold text-orange-600 whitespace-nowrap">
                      ${formatMoney(costPrice)}
                    </td>
                    <td className="p-4 text-right text-sm font-bold text-blue-700 whitespace-nowrap">
                      ${formatMoney(price)}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-md font-bold whitespace-nowrap ${
                          stock > 10
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {stock}
                      </span>
                    </td>
                    <td className="p-4 pr-8 text-center sticky right-0 bg-white/95 backdrop-blur-sm group-hover:bg-slate-50 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                      <button 
                        onClick={() => openEditModal(item)}
                        className="text-slate-400 hover:text-blue-600 p-1.5 transition-colors inline-block bg-white hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 shadow-sm"
                      >
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan="10" className="p-12 text-center text-base text-slate-500">
                    No products match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {isPdfColumnPickerOpen && (
        <InventoryPdfColumnPicker
          onClose={() => setIsPdfColumnPickerOpen(false)}
          onExport={async (selectedColumns) => {
            const success = await exportInventoryToPDF(filteredInventory, selectedColumns);
            if (success) setIsPdfColumnPickerOpen(false);
            return success;
          }}
        />
      )}

      {isModalOpen && (
        <InventoryFormModal 
          item={editingItem} 
          suppliers={verifiedSuppliers}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }} 
          onSave={handleSaveProduct}
          onDelete={handleDeleteProduct}
        />
      )}

      {notification && (
        <div 
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl flex items-center z-[6000] text-white font-medium transition-all duration-300 ${
            notification.type === 'error' ? 'bg-slate-800' : 'bg-emerald-600'
          }`}
        >
          {notification.type === 'error' ? (
            <Trash2 size={18} className="mr-3 shrink-0" />
          ) : (
            <CheckCircle size={18} className="mr-3 shrink-0" />
          )}
          {notification.message}
        </div>
      )}

    </div>
  );
}
