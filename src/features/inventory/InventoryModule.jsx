import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Edit, Package, X, Trash2, Save, CheckCircle } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';

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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
        
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

          <div className="grid grid-cols-4 gap-4">
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
              <label className="block text-sm text-blue-600 mb-1">Price</label>
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
        Supplier: formData.Supplier, // Enforced by strict dropdown
        Unit: formData.Unit,
        Description: formData.Description,
        Packing: formData.Packing,
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

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center bg-slate-50">
          <Search className="text-slate-400 mr-3" size={22} />
          <input
            type="text"
            placeholder="Search by SKU, Name, Supplier, Description, or Packing..."
            className="w-full bg-transparent border-none focus:ring-0 text-base placeholder:text-slate-400 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
              <th className="p-5 pl-8">SKU</th>
              <th className="p-5">Name</th>
              <th className="p-5">Supplier</th>
              <th className="p-5 text-center">Unit</th>
              <th className="p-5">Description</th>
              <th className="p-5">Packing</th>
              <th className="p-5 text-right">Price</th>
              <th className="p-5 text-center">Stock</th>
              <th className="p-5 pr-8 text-center">Action</th>
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
              const price = item?.Price || item?.unitPrice || item?.['Unit Price (SG)'] || 0;
              const stock = item?.stock ?? item?.Stock ?? 0; 

              return (
                <tr key={item.id || `fallback-${idx}`} className="hover:bg-slate-50 transition-colors">
                  <td className="p-5 pl-8 text-sm font-mono text-slate-500 uppercase">{sku}</td>
                  <td className="p-5 text-base text-slate-800 font-medium">{name}</td>
                  <td className="p-5 text-sm font-bold text-indigo-600">{supplier}</td>
                  <td className="p-5 text-center">
                    <span className="text-sm text-slate-600 border border-slate-200 px-3 py-1 rounded-md bg-white">
                      {unit}
                    </span>
                  </td>
                  <td className="p-5 text-sm text-slate-600 max-w-[200px] truncate">{desc}</td>
                  <td className="p-5 text-sm text-slate-600">{packing}</td>
                  <td className="p-5 text-right text-base font-bold text-blue-700">
                    ${formatMoney(price)}
                  </td>
                  <td className="p-5 text-center">
                    <span
                      className={`text-xs px-3 py-1.5 rounded-md font-bold ${
                        stock > 10
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {stock}
                    </span>
                  </td>
                  <td className="p-5 pr-8 text-center">
                    <button 
                      onClick={() => openEditModal(item)}
                      className="text-slate-400 hover:text-blue-600 p-2 transition-colors inline-block bg-white hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 shadow-sm"
                    >
                      <Edit size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
            
            {filteredInventory.length === 0 && (
              <tr>
                <td colSpan="9" className="p-12 text-center text-base text-slate-500">
                  No products match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
