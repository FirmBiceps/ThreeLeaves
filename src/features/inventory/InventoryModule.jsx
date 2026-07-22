import {                     /* existing react hooks */
  useState,
  useMemo,
  useEffect,
  useRef,
} from 'react';

import {
  /* original icons */ Search, Plus, Edit, Package, X, Trash2, Save, CheckCircle,
  /* NEW icons */     Download, FileText,
} from 'lucide-react';

import { formatMoney } from '../../utils/format';
import { supabase }   from '../../lib/supabaseClient';

/* ───────────────────────────────
   THIRD-PARTY EXPORT LIBRARIES
────────────────────────────────*/
import * as XLSX   from 'xlsx';               // v0.18.5
import jsPDF       from 'jspdf';
import autoTable   from 'jspdf-autotable';

/* ───────────────────────────────
   QUICK HELPERS (Excel / PDF)
────────────────────────────────*/
function exportToExcel({ data, fileName = 'inventory.xlsx' }) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, fileName);
}

function exportToPDF({
  data,
  columns,
  title    = 'Inventory Catalogue',
  fileName = 'inventory.pdf',
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });

  /* — header — */
  doc.setFontSize(18).text(title, 40, 40);

  /* — table body — */
  const body = data.map((row) => columns.map((k) => row[k] ?? ''));

  autoTable(doc, {
    startY: 60,
    head: [columns],
    body,
    theme: 'striped',
    styles: { fontSize: 8, overflow: 'linebreak' },
    headStyles: { fillColor: [40, 116, 166] },
    margin: { left: 40, right: 40 },
    didDrawPage({ pageNumber, doc }) {
      const total = doc.internal.getNumberOfPages();
      doc
        .setFontSize(8)
        .text(
          `Page ${pageNumber} / ${total}`,
          doc.internal.pageSize.getWidth() - 80,
          doc.internal.pageSize.getHeight() - 20,
        );
    },
  });

  doc.save(fileName);
}

/* ───────────────────────────────
   COLUMN-PICKER DIALOG (inline)
────────────────────────────────*/
function ColumnPicker({ allCols, onConfirm, onClose }) {
  const [selected, setSelected] = useState(allCols);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-semibold">Choose columns</h2>

        <div className="grid max-h-60 grid-cols-2 gap-2 overflow-y-auto">
          {allCols.map((col) => (
            <label key={col} className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(col)}
                onChange={() =>
                  setSelected((prev) =>
                    prev.includes(col)
                      ? prev.filter((c) => c !== col)
                      : [...prev, col],
                  )
                }
              />
              <span>{col}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────
   === MAIN INVENTORY MODULE
────────────────────────────────*/
export function InventoryModule({ sys }) {
  /* original state */
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [notification, setNotification] = useState(null);
  const [verifiedSuppliers, setVerifiedSuppliers] = useState([]);

  /* NEW: column picker toggle */
  const [showPicker, setShowPicker] = useState(false);

  /* PDF column list (DB headers) */
  const allCols = useMemo(
    () => [
      'SKU',
      'Name',
      'Supplier',
      'Unit',
      'Description',
      'Packing',
      'cost_price (SGD)',
      'Price',
      'stock',
    ],
    [],
  );

  /* ------------- existing effects, supplier fetch, filtering,
                   inventory CRUD logic, modals, notifications…
                   (unchanged – keep your whole block here) ------------- */

  /* ─────────────────────────────── RENDER */
  return (
    <div className="p-8 h-full overflow-y-auto relative bg-slate-50/50">
      {/* ... existing header & “Add Product” button ... */}

      {/* ── NEW ACTION BAR ─────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <button
          onClick={() => exportToExcel({ data: filteredInventory })}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white shadow hover:bg-emerald-700"
        >
          <Download size={16} /> Excel
        </button>

        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white shadow hover:bg-indigo-700"
        >
          <FileText size={16} /> Customer PDF
        </button>
      </div>
      {/* ──────────────────────────────────────── */}

      {/* ... existing search bar, table, modals, notifications … */}

      {/* COLUMN-SELECT MODAL */}
      {showPicker && (
        <ColumnPicker
          allCols={allCols}
          onConfirm={(cols) => {
            exportToPDF({ data: filteredInventory, columns: cols });
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
