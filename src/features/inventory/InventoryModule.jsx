import { useState } from 'react';
import { Search, Plus, Edit, Package, X, Trash2, Save } from 'lucide-react';
import { formatMoney } from '../../utils/format';

// ==========================================
// NEW COMPONENT: INVENTORY ADD/EDIT MODAL
// ==========================================
function InventoryFormModal({ item, onClose, onSave, onDelete }) {
  // Normalize data whether it comes from the old React state or the raw Supabase CSV headers
  const [formData, setFormData] = useState({
    id: item?.id || '',
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
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
          <h2 className="text-base font-semibold flex items-center">
            <Package size={18} className="mr-2 text-blue-400" />
            {item ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={onClose} className="hover:bg-slate-800 p-1.5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
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

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-100">
            {item ? (
              <button 
                type="button"
                onClick={() => onDelete(item.id)}
                className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg text-sm flex items-center transition-colors"
              >
                <Trash2 size={16} className="mr-2" /> Delete Item
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

  // Search logic
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

  // Handle Add or Edit Save
  const handleSaveProduct = (formData) => {
    let updatedInventory;
    
    if (editingItem) {
      // Update existing item in the local array
      updatedInventory = sys.inventory.map(item => 
        item.id === formData.id ? { ...item, ...formData } : item
      );
    } else {
      // Add new item to the local array (Give it a temporary ID)
      const newItem = { ...formData, id: `prod-${Date.now()}` };
      updatedInventory = [newItem, ...sys.inventory];
    }
    
    sys.setInventory(updatedInventory);
    
    // NOTE: To save these changes permanently to Cloudflare/Supabase, 
    // you will need to add a supabase.from('product_list').upsert() call here!
    
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // Handle Delete
  const handleDeleteProduct = (idToRemove) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      const updatedInventory = sys.inventory.filter(item => item.id !== idToRemove);
      sys.setInventory(updatedInventory);
      
      // NOTE: Add supabase.from('product_list').delete().eq('id', idToRemove) here for permanent deletion
      
      setIsModalOpen(false);
      setEditingItem(null);
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
    <div className="p-8 h-full overflow-y-auto">
      
      {/* HEADER & ADD BUTTON */}
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

      {/* SEARCH & TABLE SECTION */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Search Bar */}
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

        {/* Data Table */}
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
                <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                  
                  {/* Product Name & Description */}
                  <td className="p-5 pl-8">
                    <p className="text-base text-slate-800">{name}</p>
                    {description && (
                      <p className="text-sm text-slate-500 mt-1 max-w-[280px] truncate">
                        {description}
                      </p>
                    )}
                  </td>
                  
                  {/* Supplier/Company */}
                  <td className="p-5">
                    <span className="text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                      {company}
                    </span>
                  </td>
                  
                  {/* Unit */}
                  <td className="p-5 text-center">
                    <span className="text-sm text-slate-600 border border-slate-200 px-3 py-1 rounded-md">
                      {unit}
                    </span>
                  </td>
                  
                  {/* Cost Price RMB */}
                  <td className="p-5 text-right text-sm text-slate-500">
                    {priceRMB ? `¥${Number(priceRMB).toFixed(2)}` : '-'}
                  </td>
                  
                  {/* Selling Price SG */}
                  <td className="p-5 text-right text-base text-blue-700">
                    ${formatMoney(priceSG)}
                  </td>
                  
                  {/* Stock Status Badge */}
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
                  
                  {/* Edit Action */}
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

      {/* Render the Modal if it is open */}
      {isModalOpen && (
        <InventoryFormModal 
          item={editingItem} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSaveProduct}
          onDelete={handleDeleteProduct}
        />
      )}
    </div>
  );
}
