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
  BrainCircuit,
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit
} from 'lucide-react';
import { CompanyHeader } from '../../components/shared/CompanyHeader';
import { UNIT_OPTIONS } from '../../data/company';
import { formatMoney } from '../../utils/format';

// 1. IMPORT YOUR LOGO DIRECTLY HERE
import logo from './three_leaves_logo.png';

// The ultimate font stack variable to force the browser's hand
const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "SimHei", "黑体", Arial, sans-serif';

// ==========================================
// 1. SEARCHABLE PRODUCT DROPDOWN
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

  const safeInventory = inventory || [];
  const selectedProduct = safeInventory.find((entry) => entry.id === value);
  const displayName = selectedProduct ? (selectedProduct.name || selectedProduct.Items) : '';

  const filteredInventory = safeInventory.filter((item) => {
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
        <div className="absolute z-[5000] top-0 left-0 w-72 bg-white border border-slate-300 rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center p-2 border-b border-slate-200 bg-slate-50">
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
                const itemName = item
