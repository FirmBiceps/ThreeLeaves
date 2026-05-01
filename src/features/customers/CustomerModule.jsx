import { useState, useMemo } from 'react';
import { Search, Plus, Edit, Users, X, Trash2, Save, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// ==========================================
// COMPONENT 1: CUSTOMER ADD/EDIT MODAL
// ==========================================
function CustomerFormModal({ customer, onClose, onSave, onDelete }) {
  const [formData, setFormData] = useState({
    id: customer?.id || `cust-${Date.now()}`,
    name: customer?.name || '',
    address: customer?.address || '',
    region: customer?.region || '',
    payment_terms: customer?.payment_terms || '30_days', // NEW: Payment Terms Field
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
          <h2 className="text-base font-semibold flex items-center">
            <Users size={18} className="mr-2 text-blue-400" />
            {customer ? 'Edit Entity Profile' : 'Register New Entity'}
          </h2>
          <button type="button" onClick={onClose} className="hover:bg-slate-800 p-1.5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Registered Entity Name</label>
            <input 
              required
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleChange}
              placeholder="e.g. ABC Trading Pte Ltd"
              className="w-full border-2 border-slate-200 rounded-xl p-3 text-base font-bold text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Billing & Delivery Address</label>
            <textarea 
              name="address" 
              value={formData.address} 
              onChange={handleChange}
              rows="3"
              placeholder="Full registered address..."
              className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Delivery Region</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  name="region" 
                  value={formData.region} 
                  onChange={handleChange}
                  placeholder="e.g. North, Central..."
                  className="w-full border-2 border-slate-200 rounded-xl p-3 pl-10 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>
            </div>

            {/* NEW: Payment Terms Selector */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Default Payment Terms</label>
              <select
                name="payment_terms"
                value={formData.payment_terms}
                onChange={handleChange}
                className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer bg-white"
              >
                <option value="30_days">30 Days Credit</option>
                <option value="cod">Cash on Delivery (C.O.D)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center pt-6 mt-2 border-t border-slate-100">
            {customer ? (
              <button 
                type="button"
                onClick={() => onDelete(customer)}
                className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl text-sm font-bold flex items-center transition-colors border border-transparent hover:border-red-100"
              >
                <Trash2 size={16} className="mr-2" /> Delete Entity
              </button>
            ) : <div></div>}

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-2.5 rounded-xl text-sm flex items-center shadow-lg shadow-blue-500/30 transition-all active:scale-95"
              >
                <Save size={16} className="mr-2" /> Save Profile
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// MAIN CUSTOMER MODULE
// ==========================================
export function CustomerModule({ sys }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  
  const safeCustomersArray = Array.isArray(sys?.customers) ? sys.customers : [];

  const filteredCustomers = useMemo(() => {
    let result = [...safeCustomersArray];

    if (searchTerm) {
      const searchLower = String(searchTerm).toLowerCase();
      result = result.filter(c => 
        String(c.name || '').toLowerCase().includes(searchLower) ||
        String(c.address || '').toLowerCase().includes(searchLower) ||
        String(c.region || '').toLowerCase().includes(searchLower)
      );
    }
    
    // Sort alphabetically by name
    return result.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [safeCustomersArray, searchTerm]);

  const handleSaveCustomer = async (formData) => {
    try {
      const isEditing = !!editingCustomer;
      let savedData;

      if (isEditing) {
        // UPDATE EXISTING
        const { data, error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            address: formData.address,
            region: formData.region,
            payment_terms: formData.payment_terms
          })
          .eq('id', editingCustomer.id)
          .select()
          .single();

        if (error) throw error;
        savedData = data;
        
        sys.setCustomers(safeCustomersArray.map(c => c.id === editingCustomer.id ? { ...c, ...savedData } : c));
      } else {
        // INSERT NEW
        const { data, error } = await supabase
          .from('customers')
          .insert([{
            name: formData.name,
            address: formData.address,
            region: formData.region,
            payment_terms: formData.payment_terms,
            custom_prices: {} // Initialize with empty object for new customers
          }])
          .select()
          .single();

        if (error) throw error;
        savedData = data;
        
        sys.setCustomers([savedData, ...safeCustomersArray]);
      }

      setIsModalOpen(false);
      setEditingCustomer(null);

    } catch (error) {
      console.error("Failed to save customer:", error);
      alert(`Error saving customer: ${error.message}`);
    }
  };

  const handleDeleteCustomer = async (customerToRemove) => {
    if (window.confirm(`Are you sure you want to permanently delete ${customerToRemove.name}?`)) {
      try {
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', customerToRemove.id);

        if (error) throw error;

        sys.setCustomers(safeCustomersArray.filter(c => c.id !== customerToRemove.id));
        setIsModalOpen(false);
        setEditingCustomer(null);
      } catch (error) {
        console.error("Failed to delete customer:", error);
        alert(`Error deleting customer: ${error.message}`);
      }
    }
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 h-full overflow-y-auto relative bg-slate-50/50">
      
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
            <Users className="mr-3 text-blue-600" size={28} />
            Entity Directory
          </h1>
          <p className="text-base text-slate-500 mt-1">
            Manage your registered customer addresses, regions, and credit terms.
          </p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium text-base flex items-center shadow-lg hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus size={20} className="mr-2" /> Register Entity
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Search Bar */}
        <div className="p-5 border-b border-slate-100 flex items-center bg-slate-50">
          <Search className="text-slate-400 mr-3" size={22} />
          <input
            type="text"
            placeholder="Search by entity name, address, or region..."
            className="w-full bg-transparent border-none focus:ring-0 text-base font-medium placeholder:text-slate-400 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Directory Table */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
              <th className="p-5 pl-8 w-1/4">Entity Name</th>
              <th className="p-5 w-2/5">Registered Address</th>
              <th className="p-5 w-32">Region</th>
              <th className="p-5 text-center w-32">Terms</th>
              <th className="p-5 pr-8 text-right w-24">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCustomers.map((c) => (
              <tr key={c.id} className="hover:bg-blue-50/50 transition-colors group">
                <td className="p-5 pl-8 align-top pt-5">
                  <p className="font-bold text-slate-900 text-base">{c.name}</p>
                </td>
                <td className="p-5 align-top pt-5">
                  <p className="text-sm font-medium text-slate-600 max-w-md leading-relaxed">{c.address || <span className="text-slate-400 italic">No address provided</span>}</p>
                </td>
                <td className="p-5 align-top pt-5">
                  {c.region ? (
                    <span className="inline-flex items-center text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-md">
                      <MapPin size={10} className="mr-1" /> {c.region}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs font-bold">-</span>
                  )}
                </td>
                
                {/* NEW: Payment Terms Badge */}
                <td className="p-5 text-center align-top pt-5">
                  <span className={`inline-flex px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md border ${
                    c.payment_terms === 'cod' 
                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {c.payment_terms === 'cod' ? 'C.O.D' : '30 Days'}
                  </span>
                </td>

                <td className="p-5 pr-8 text-right align-top pt-4">
                  <button 
                    onClick={() => openEditModal(c)}
                    className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-blue-600 bg-white border border-slate-200 px-4 py-2 rounded-lg hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm transition-all active:scale-95"
                  >
                    <Edit size={12} className="mr-1.5" /> Edit
                  </button>
                </td>
              </tr>
            ))}
            
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan="5" className="p-16 text-center text-base font-bold text-slate-400">
                  No entities found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <CustomerFormModal 
          customer={editingCustomer} 
          onClose={() => {
            setIsModalOpen(false);
            setEditingCustomer(null);
          }} 
          onSave={handleSaveCustomer}
          onDelete={handleDeleteCustomer}
        />
      )}

    </div>
  );
}
