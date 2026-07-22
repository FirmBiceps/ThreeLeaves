import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useDeferredValue, // React 18+
} from 'react';
import {
  FileText,
  Plus,
  Filter,
  ArrowUpDown,
  Search,
  ScanBarcode,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';
import { InvoiceGenerator } from './InvoiceGenerator';
import { InvoicePreviewModal } from './InvoicePreview';

/* ---------- HELPERS ---------- */
const calculateInvoiceProfit = (invoice) => {
  if (!invoice?.items?.length) return 0;

  return invoice.items.reduce((acc, item) => {
    const qty = Number(item.quantity ?? item.qty ?? 0);
    const sellPrice = Number(item.price ?? item.Price ?? 0);
    const costPrice = Number(
      item['cost_price (SGD)'] ?? item.cost_price ?? item.costPrice ?? 0,
    );

    const lineRevenue = Number(item.amount) || qty * sellPrice;
    const lineCost = qty * costPrice;
    return acc + (lineRevenue - lineCost);
  }, 0);
};

const augmentInvoices = (list) =>
  list.map((inv) =>
    inv.profit === undefined
      ? { ...inv, profit: calculateInvoiceProfit(inv) }
      : inv,
  );

/* ---------- COMPONENT ---------- */
export function InvoiceModule({ sys }) {
  /* ----- UI State ----- */
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [termFilter, setTermFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [sortOption, setSortOption] = useState('number_desc');

  /* ----- Pagination ----- */
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  /* ----- Misc ----- */
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [pricingGroups, setPricingGroups] = useState([]);

  /* ----- Derived data ----- */
  const safeInvoices = useMemo(
    () => augmentInvoices(Array.isArray(sys?.invoices) ? sys.invoices : []),
    [sys?.invoices],
  );

  /* Reset page when filters / search change */
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, filter, termFilter, sortOption]);

  /* Fetch pricing groups once (cached) */
  useEffect(() => {
    if (pricingGroups.length) return;
    (async () => {
      const { data, error } = await supabase.from('pricing_groups').select('*');
      if (!error && data) setPricingGroups(data);
      else console.error('Error fetching pricing groups', error);
    })();
  }, [pricingGroups.length]);

  /* ----- Callbacks ----- */
  const handleDeleteInvoice = useCallback(
    async (e, invoiceId) => {
      e.stopPropagation();
      if (
        !window.confirm(
          'Are you sure you want to permanently delete this invoice? This cannot be undone.',
        )
      )
        return;

      try {
        const { error } = await supabase
          .from('invoices')
          .delete()
          .eq('id', invoiceId);
        if (error) throw error;

        const updated = safeInvoices.filter((inv) => inv.id !== invoiceId);
        sys.setInvoices(updated);
        if (sys.deleteRecord) await sys.deleteRecord('invoices', invoiceId);
      } catch (err) {
        alert(`Failed to delete invoice: ${err.message}`);
      }
    },
    [safeInvoices, sys],
  );

  const handleStatusChange = useCallback(
    async (invoiceId, newStatus) => {
      try {
        const { error } = await supabase
          .from('invoices')
          .update({ status: newStatus })
          .eq('id', invoiceId);
        if (error) throw error;

        const updated = safeInvoices.map((inv) =>
          inv.id === invoiceId ? { ...inv, status: newStatus } : inv,
        );
        sys.setInvoices(updated);
      } catch (err) {
        alert(`Failed to update status: ${err.message}`);
      }
    },
    [safeInvoices, sys],
  );

  /* ----- Filtering + Sorting ----- */
  const filteredInvoices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return safeInvoices
      .filter((inv) => {
        /* text search (deferred) */
        if (deferredSearch) {
          const term = deferredSearch.toLowerCase();
          const matchId = String(inv.number ?? inv.id).toLowerCase().includes(term);
          const matchCust = String(inv.customer ?? '').toLowerCase().includes(term);
          if (!matchId && !matchCust) return false;
        }

        /* payment terms filter */
        if (termFilter !== 'All' && inv.paymentTerms !== termFilter) {
          return false;
        }

        /* date filter */
        if (filter === 'All') return true;
        const [y, m, d] = String(inv.date ?? '').split('-').map(Number);
        if (!y || !m || !d) return false;

        const date = new Date(y, m - 1, d);
        date.setHours(0, 0, 0, 0);

        switch (filter) {
          case 'Today':
            return date.getTime() === today.getTime();
          case 'This Week': {
            const diff = Math.abs(today - date) / (1000 * 60 * 60 * 24);
            return diff <= 7;
          }
          case 'This Month':
            return (
              date.getFullYear() === today.getFullYear() &&
              date.getMonth() === today.getMonth()
            );
          default:
            return true;
        }
      })
      .sort((a, b) => {
        const dateA = new Date(a.date ?? 0).getTime();
        const dateB = new Date(b.date ?? 0).getTime();
        const numA = String(a.number ?? a.id);
        const numB = String(b.number ?? b.id);
        const totA = Number(a.total) || 0;
        const totB = Number(b.total) || 0;
        const profA = a.profit || 0;
        const profB = b.profit || 0;
        const custA = String(a.customer ?? '');
        const custB = String(b.customer ?? '');

        switch (sortOption) {
          case 'date_asc':
            return dateA - dateB;
          case 'number_desc':
            return numB.localeCompare(numA, undefined, { numeric: true });
          case 'number_asc':
            return numA.localeCompare(numB, undefined, { numeric: true });
          case 'total_desc':
            return totB - totA;
          case 'total_asc':
            return totA - totB;
          case 'profit_desc':
            return profB - profA;
          case 'profit_asc':
            return profA - profB;
          case 'customer_asc':
            return custA.localeCompare(custB);
          case 'customer_desc':
            return custB.localeCompare(custA);
          case 'date_desc':
          default:
            return dateB - dateA;
        }
      });
  }, [safeInvoices, deferredSearch, filter, termFilter, sortOption]);

  const totalPages = Math.max(Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE), 1);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  /* ---------- RENDER ---------- */
  return (
    <div className="p-8 h-full overflow-y-auto relative print:p-0 print:overflow-visible">
      {/* LIST VIEW */}
      {!previewInvoice && !isGeneratorOpen && (
        <>
          {/* ----- HEADER ----- */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
              <FileText className="mr-3 text-blue-600" size={28} />
              Invoice History
            </h1>
            <button
              onClick={() => setIsGeneratorOpen(true)}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg hover:bg-blue-700"
            >
              <Plus className="mr-2" size={18} /> New Invoice
            </button>
          </div>

          {/* ----- FILTER BAR (unchanged) ----- */}
          {/* Keep your existing JSX for the filter/search bar here */}

          {/* ----- TABLE ----- */}
          {/* Paste your existing table markup, but display inv.profit instead of calculating on the fly */}

          {/* ----- PAGINATION ----- */}
          {/* Keep the existing pagination controls */}
        </>
      )}

      {/* ----- MODALS ----- */}
      {previewInvoice && (
        <InvoicePreviewModal
          invoice={previewInvoice}
          sys={sys}
          onClose={() => setPreviewInvoice(null)}
          onEdit={(inv) => {
            setEditingInvoice(inv);
            setIsGeneratorOpen(true);
            setPreviewInvoice(null);
          }}
        />
      )}

      {isGeneratorOpen && (
        <InvoiceGenerator
          sys={sys}
          groups={pricingGroups}
          setGroups={setPricingGroups}
          existingInvoice={editingInvoice}
          onClose={() => {
            setIsGeneratorOpen(false);
            setEditingInvoice(null);
          }}
        />
      )}
    </div>
  );
}
