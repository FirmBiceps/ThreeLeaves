import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, Save, X, Truck, CheckCircle, MapPin, User, Phone, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const EMPTY_SUPPLIER = {
  name: '',
  contactPerson: '',
  contactNumber: '',
  address: ''
};

// ==========================================
// COMPONENT: SUPPLIER ADD/EDIT MODAL
// ==========================================
function SupplierFormModal({ initialValue, onClose, onSave }) {
  const [form, setForm] = useState(initialValue || EMPTY_SUPPLIER);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave(form);
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
          <h2 className="text-base font-black tracking-widest uppercase flex items-center">
            <Building2 size={18} className="mr-2 text-blue-400" />
            {form.id ? 'Edit Supplier Details' : 'Register New Supplier'}
          </h2>
          <button type="button" onClick={onClose} className="hover:bg-slate-800 p-1.5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          <div>
            <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              <Building2 size={12} className="mr-1.5" /> Supplier / Company Name
            </label>
            <input 
              required
              type="text" 
              autoFocus
              value={form.name} 
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. CMM Marketing Management Pte Ltd"
              className="w-full border border-slate-200 rounded-xl p-3 text-base font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                <User size={12} className="mr-1.5" /> Contact Person
              </label>
              <input 
                type="text" 
                value={form.contactPerson || ''} 
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="e.g. Mr. Lim"
                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>
            <div>
              <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                <Phone size={12} className="mr-1.5" /> Contact Number
              </label>
              <input 
                type="text" 
                value={form.contactNumber || ''} 
                onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                placeholder="e.g. +65 9123 4567"
                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              <MapPin size={12} className="mr-1.5" /> Business Address
            </label>
            <textarea 
              rows={3}
              value={form.address || ''} 
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. 6 Mandai Link, Singapore 728652"
              className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm resize-none"
            />
          </div>

          <div className="flex justify-end pt-4 mt-2 border-t border-slate-100 gap-3">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black tracking-widest uppercase px-8 py-2.5 rounded-xl text-xs flex items-center shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save size={16} className="mr-2" /> {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// MAIN SUPPLIER MODULE
// ==========================================
export function SupplierModule({ sys }) {
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Direct Supabase Fetch for bulletproof sync
  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      setSuppliers(data || []);
      
      // Keep global sys state synced so the Inventory Module gets the updated list instantly!
      if (sys && sys.setSuppliers) {
        sys.setSuppliers(data || []);
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return suppliers.filter((sup) => {
      const name = String(sup.name || '').toLowerCase();
      const contact = String(sup.contactPerson || '').toLowerCase();
      return name.includes(lowerSearch) || contact.includes(lowerSearch);
    });
  }, [suppliers, searchTerm]);

  const handleSaveSupplier = async (formData) => {
    try {
      const payload = {
        name: formData.name,
        contactPerson: formData.contactPerson,
        contactNumber: formData.contactNumber,
        address: formData.address
      };

      if (formData.id) {
        // UPDATE EXISTING
        const { error } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', formData.id);
          
        if (error) throw error;
      } else {
        // INSERT NEW
        const { error } = await supabase
          .from('suppliers')
          .insert([payload]);
          
        if (error) throw error;
      }

      await fetchSuppliers(); // Re-fetch to guarantee sync
      setIsModalOpen(false);
      setEditingSupplier(null);
    } catch (error) {
      alert(`Error saving supplier: ${error.message}`);
    }
  };

  const handleDeleteSupplier = async (id, name) => {
    if (window.confirm(`Are you sure you want to permanently delete "${name}"?`)) {
      try {
        const { error } = await supabase
          .from('suppliers')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        await fetchSuppliers();
      } catch (error) {
        alert(`Error deleting supplier: ${error.message}`);
      }
    }
  };

  const openAddModal = () => {
    setEditingSupplier(EMPTY_SUPPLIER);
    setIsModalOpen(true);
  };

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 h-full overflow-y-auto relative bg-slate-50/50">
      
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
            <Truck className="mr-3 text-blue-600" size={28} />
            Supplier Directory
          </h1>
          <p className="text-base text-slate-500 mt-1">
            Manage your vendor network, contact details, and warehouse addresses.
          </p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus size={18} className="mr-2" /> Register Supplier
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* SEARCH BAR */}
        <div className="p-5 border-b border-slate-100 flex items-center bg-slate-50 shrink-0">
          <Search className="text-slate-400 mr-3" size={20} />
          <input
            type="text"
            placeholder="Search suppliers by name or contact person..."
            className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold placeholder:font-normal placeholder:text-slate-400 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* DATA TABLE */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-white border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-400 font-black shadow-sm">
                <th className="p-5 pl-8 w-[30%]">Supplier / Vendor Name</th>
                <th className="p-5 w-[20%]">Contact Person</th>
                <th className="p-5 w-[15%]">Contact No.</th>
                <th className="p-5 w-[25%]">Business Address</th>
                <th className="p-5 pr-8 text-center w-[10%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-sm font-bold text-slate-400">Loading suppliers...</td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-sm font-bold text-slate-400">No suppliers found in directory.</td>
                </tr>
              ) : (
                filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="p-5 pl-8 font-bold text-slate-900">
                      {sup.name || 'Unnamed Supplier'}
                    </td>
                    <td className="p-5 font-semibold text-slate-700 flex items-center">
                      <User size={14} className="mr-2 text-slate-300" /> {sup.contactPerson || '-'}
                    </td>
                    <td className="p-5 font-mono text-slate-600 font-bold">
                      {sup.contactNumber || '-'}
                    </td>
                    <td className="p-5 text-xs font-medium text-slate-500 max-w-[200px] truncate">
                      {sup.address || '-'}
                    </td>
                    <td className="p-5 pr-8">
                      <div className="flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(sup)}
                          className="text-slate-400 hover:text-blue-600 bg-white hover:bg-blue-100 p-2 rounded-lg border border-slate-200 hover:border-blue-200 transition-all shadow-sm"
                          title="Edit Supplier"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSupplier(sup.id, sup.name)}
                          className="text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 p-2 rounded-lg border border-slate-200 hover:border-red-200 transition-all shadow-sm"
                          title="Delete Supplier"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <SupplierFormModal 
          initialValue={editingSupplier} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSaveSupplier} 
        />
      )}
    </div>
  );
}
