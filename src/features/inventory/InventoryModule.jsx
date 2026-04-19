import { useState } from 'react';
import { Search, Plus, Edit, Package, X, Trash2, Save, CheckCircle } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';

// ==========================================
// COMPONENT 1: INVENTORY ADD/EDIT MODAL
// ==========================================
function InventoryFormModal({ item, onClose, onSave, onDelete }) {
  const [formData, setFormData] = useState({
    id: item?.id || `prod-${Date.now()}`,
    sku: item?.sku || item?.SKU || '',
    Name: item?.Name || item?.name || item?.Items || '',
    Unit: item?.Unit || item?.unit || '箱',
    Description: item?.Description || item?.description || '',
    Packing: item?.Packing || item?.packaging || '',
    Price: item?.Price || item?.unitPrice || item?.['Unit Price (SG)'] || 0,
    stock: item?.stock ?? item?.Stock ?? 0,
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
              <input 
                type="text" 
                name="Unit" 
                value={formData.Unit} 
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-xl p-3 text-base text-center text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
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

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    // Extended timeout so you have time to read the error message
    setTimeout(() => {
      setNotification(null);
    }, 6000); 
  };

  const filteredInventory = sys.inventory.filter((item) => {
    const sku = item.sku || item.SKU || '';
    const name = item.Name || item.name || item.Items || '';
    const desc = item.Description || item.description || '';
    const packing = item.Packing || '';
    
    const searchLower = searchTerm.toLowerCase();
    return (
      sku.toLowerCase().includes(searchLower) ||
      name.toLowerCase().includes(searchLower) ||
      desc.toLowerCase().includes(searchLower) ||
      packing.toLowerCase().includes(searchLower)
    );
  });

  const handleSaveProduct = async (formData) => {
    try {
      const isEditing = !!editingItem;
      const oldPrice = isEditing ? (editingItem.Price || editingItem.unitPrice || editingItem['Unit Price (SG)']) : 0;
      const priceChanged = isEditing && Number(oldPrice) !== Number(formData.Price);

      let finalId = formData.id;

      // FIX: Changed "sku" to "SKU" to match your Database strictly!
      const payload = {
        SKU: formData.sku,      // <--- This was the fix!
        Name: formData.Name,
        Unit: formData.Unit,
        Description: formData.Description,
        Packing: formData.Packing,
        Price: Number(formData.Price) || 0,
        stock: parseInt(formData.stock, 10) || 0
      };

      let savedProduct;

      // EXPLICIT DATABASE LOGIC
      if (isEditing) {
        finalId = editingItem.id || formData.id;
        const isUUID = finalId && finalId.length === 36 && finalId.includes('-');
        
        if (isUUID) {
          const { data, error } = await supabase
            .from('product_list')
            .update(payload)
            .eq('id', finalId)
            .select()
            .single();
            
          if (error) throw error;
          savedProduct = data;
        } else {
          // Fallback if the database doesn't use UUIDs (finds by Name instead)
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
        // NEW PRODUCT - Just insert the raw payload without forcing an ID
        const { data, error } = await supabase
          .from('product_list')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        savedProduct = data;
      }

      // ONLY update the local table IF the database sync was successful
      if (isEditing) {
        const updatedInventory = sys.inventory.map(item => {
          const matchById = item.id && item.id === (editingItem.id || formData.id);
          const matchByName = !item.id && (item.Name === editingItem.Name || item.name === editingItem.Name || item.Items === editingItem.Name);
          
          if (matchById || matchByName) {
            return { ...item, ...savedProduct, ...formData }; 
          }
          return item;
        });
        sys.setInventory(updatedInventory);
      } else {
        sys.setInventory([savedProduct, ...sys.inventory]);
      }

      // Log Price History
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
      // DISPLAYS THE EXACT SUPABASE ERROR MESSAGE ON SCREEN
      showNotification(`DB Error: ${error.message || 'Failed to save product'}`, 'error');
    }
  };

  const handleDeleteProduct = async (itemToRemove) => {
    const itemName = itemToRemove.Name || itemToRemove.name || itemToRemove.Items;
    if (window.confirm(`Are you sure you want to delete ${itemName}?`)) {
      try {
        const updatedInventory = sys.inventory.filter(item => {
          if (itemToRemove.id && item.id) return item.id !== itemToRemove.id;
          return (item.Name || item.name || item.Items) !== itemName;
        });
        sys.setInventory(updatedInventory);
        
        const isUUID = itemToRemove.id && itemToRemove.id.length === 36;
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
    <div className="p-8 h-full overflow-y-auto relative">
      
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
            <Package className="mr-3 text-blue-600" size={28} />
            Inventory Catalog
          </h1>
          <p className="text-base text-slate-500 mt-1">
            Manage your products, packaging, and pricing details.
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
            placeholder="Search by SKU, Name, Description, or Packing..."
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
              const sku = item.sku || item.SKU || '-';
              const name = item.Name || item.name || item.Items || 'Unnamed Product';
              const unit = item.Unit || item.unit || '-';
              const desc = item.Description || item.description || '-';
              const packing = item.Packing || item.packaging || '-';
              const price = item.Price || item.unitPrice || item['Unit Price (SG)'] || 0;
              const stock = item.stock ?? item.Stock ?? 0; 

              return (
                <tr key={item.id || `fallback-${idx}`} className="hover:bg-slate-50 transition-colors">
                  <td className="p-5 pl-8 text-sm font-mono text-slate-500 uppercase">{sku}</td>
                  <td className="p-5 text-base text-slate-800 font-medium">{name}</td>
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
                <td colSpan="8" className="p-12 text-center text-base text-slate-500">
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
