import { useState } from 'react';
import { Search, Plus, Edit, Package, X, Trash2, Save, CheckCircle } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../utils/supabase';

// ==========================================
// COMPONENT 1: INVENTORY ADD/EDIT MODAL
// ==========================================
function InventoryFormModal({ item, onClose, onSave, onDelete }) {
  const [formData, setFormData] = useState({
    id: item?.id || `prod-${Date.now()}`,
    name: item?.name || item?.Items || '',
    description: item?.description || item?.Description || item?.Packaging || '',
    company: item?.company || item?.Company || '',
    unit: item?.unit || item?.Unit || '箱',
    costPrice: item?.costPrice || item?.['Unit Price (RMB)'] || 0,
    unitPrice: item?.unitPrice || item?.['Unit Price (SG)'] || 0,
    stock: item?.stock ?? 999,
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        
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
          <div>
            <label className="block text-sm text-slate-500 mb-1">Product Name</label>
            <input 
              required
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl p-3 text-base text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">Supplier / Brand</label>
              <input 
                type="text" 
                name="company" 
                value={formData.company} 
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-xl p-3 text-base text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Packaging Info</label>
              <input 
                type="text" 
                name="description" 
                value={formData.description} 
                onChange={handleChange}
                placeholder="e.g. 400g x 30"
                className="w-full border border-slate-200 rounded-xl p-3 text-base text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">Unit</label>
              <input 
                type="text" 
                name="unit" 
                value={formData.unit} 
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-xl p-3 text-base text-center text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Cost (RMB)</label>
              <input 
                type="number" 
                step="0.01"
                name="costPrice" 
                value={formData.costPrice} 
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-xl p-3 text-base text-right text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-blue-600 mb-1">Selling Price (SG)</label>
              <input 
                required
                type="number" 
                step="0.01"
                name="unitPrice" 
                value={formData.unitPrice} 
                onChange={handleChange}
                className="w-full border border-blue-200 bg-blue-50 rounded-xl p-3 text-base text-right text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-500 mb-1">Current Stock Level</label>
            <input 
              type="number" 
              name="stock" 
              value={formData.stock} 
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl p-3 text-base text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
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
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const filteredInventory = sys.inventory.filter((item) => {
    const itemName = item.name || item.Items || '';
    const itemDesc = item.description || item.Description || item.Packaging || '';
    const itemCompany = item.company || item.Company || '';
    
    const searchLower = searchTerm.toLowerCase();
    return (
      itemName.toLowerCase().includes(searchLower) ||
      itemDesc.toLowerCase().includes(searchLower) ||
      itemCompany.toLowerCase().includes(searchLower)
    );
  });

  const handleSaveProduct = async (formData) => {
    try {
      const isEditing = !!editingItem;
      
      const oldCostRMB = isEditing ? (editingItem.costPrice || editingItem['Unit Price (RMB)']) : 0;
      const oldPriceSG = isEditing ? (editingItem.unitPrice || editingItem['Unit Price (SG)']) : 0;
      
      const costChanged = isEditing && Number(oldCostRMB) !== Number(formData.costPrice);
      const priceChanged = isEditing && Number(oldPriceSG) !== Number(formData.unitPrice);

      let updatedInventory;
      let finalId = formData.id;

      if (isEditing) {
        updatedInventory = sys.inventory.map(item => {
          const matchById = item.id && item.id === formData.id;
          const matchByName = !item.id && (item.name === formData.name || item.Items === formData.name);
          if (matchById || matchByName) {
            finalId = item.id || formData.id; 
            return { ...item, ...formData, id: finalId };
          }
          return item;
        });
      } else {
        updatedInventory = [{ ...formData }, ...sys.inventory];
      }
      sys.setInventory(updatedInventory);

      // --- PERMANENT SUPABASE SYNC ---
      // We check if finalId is a real UUID. If not (like "prod-123"), we let Supabase generate one.
      const isUUID = finalId && finalId.length === 36 && finalId.includes('-');
      
      const payload = {
        Items: formData.name,
        Description: formData.description,
        Company: formData.company,
        Unit: formData.unit,
        'Unit Price (RMB)': formData.costPrice,
        'Unit Price (SG)': formData.unitPrice,
        stock: formData.stock
      };

      if (isEditing && isUUID) {
        payload.id = finalId;
      }

      const { data: savedProduct, error: saveError } = await supabase
        .from('product_list')
        .upsert(payload)
        .select()
        .single();

      if (saveError) throw saveError;

      // Log the Price History Ledger if margins changed
      if (costChanged || priceChanged) {
        await supabase.from('price_history').insert({
          product_id: savedProduct.id,
          product_name: formData.name,
          old_cost_rmb: oldCostRMB,
          new_cost_rmb: formData.costPrice,
          old_price_sg: oldPriceSG,
          new_price_sg: formData.unitPrice
        });
      }

      showNotification(isEditing ? 'Product successfully updated!' : 'New product added to catalog!');
      setIsModalOpen(false);
      setEditingItem(null);

    } catch (error) {
      console.error("Save error: ", error);
      showNotification('Error saving product to database.', 'error');
    }
  };

  const handleDeleteProduct = async (itemToRemove) => {
    if (window.confirm(`Are you sure you want to delete ${itemToRemove.name || itemToRemove.Items}?`)) {
      try {
        const updatedInventory = sys.inventory.filter(item => {
          if (itemToRemove.id && item.id) return item.id !== itemToRemove.id;
          return (item.name || item.Items) !== (itemToRemove.name || itemToRemove.Items);
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
        showNotification('Error deleting product.', 'error');
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
            Manage your products, suppliers, and pricing tiers.
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
            placeholder="Search by product name, description, or supplier..."
            className="w-full bg-transparent border-none focus:ring-0 text-base placeholder:text-slate-400 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
              <th className="p-5 pl-8">Product / Packaging</th>
              <th className="p-5">Supplier / Brand</th>
              <th className="p-5 text-center">Unit</th>
              <th className="p-5 text-right">Cost (RMB)</th>
              <th className="p-5 text-right">Price (SG)</th>
              <th className="p-5 text-center">Stock</th>
              <th className="p-5 pr-8 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredInventory.map((item, idx) => {
              const name = item.name || item.Items || 'Unknown Product';
              const description = item.description || item.Description || item.Packaging || '';
              const company = item.company || item.Company || '-';
              const unit = item.unit || item.Unit || '-';
              const priceRMB = item.costPrice || item['Unit Price (RMB)'];
              const priceSG = item.unitPrice || item['Unit Price (SG)'] || 0;
              const stock = item.stock ?? 999;

              return (
                <tr key={item.id || `fallback-${idx}`} className="hover:bg-slate-50 transition-colors">
                  <td className="p-5 pl-8">
                    <p className="text-base text-slate-800">{name}</p>
                    {description && (
                      <p className="text-sm text-slate-500 mt-1 max-w-[280px] truncate">
                        {description}
                      </p>
                    )}
                  </td>
                  <td className="p-5">
                    <span className="text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                      {company}
                    </span>
                  </td>
                  <td className="p-5 text-center">
                    <span className="text-sm text-slate-600 border border-slate-200 px-3 py-1 rounded-md">
                      {unit}
                    </span>
                  </td>
                  <td className="p-5 text-right text-sm text-slate-500">
                    {priceRMB ? `¥${Number(priceRMB).toFixed(2)}` : '-'}
                  </td>
                  <td className="p-5 text-right text-base text-blue-700">
                    ${formatMoney(priceSG)}
                  </td>
                  <td className="p-5 text-center">
                    <span
                      className={`text-xs px-3 py-1.5 rounded-md ${
                        stock > 10
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {stock} {unit}
                    </span>
                  </td>
                  <td className="p-5 pr-8 text-right">
                    <button 
                      onClick={() => openEditModal(item)}
                      className="text-slate-400 hover:text-blue-600 p-2 transition-colors inline-block bg-white hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100"
                    >
                      <Edit size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
            
            {filteredInventory.length === 0 && (
              <tr>
                <td colSpan="7" className="p-12 text-center text-base text-slate-500">
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
            <Trash2 size={18} className="mr-3" />
          ) : (
            <CheckCircle size={18} className="mr-3" />
          )}
          {notification.message}
        </div>
      )}

    </div>
  );
}
