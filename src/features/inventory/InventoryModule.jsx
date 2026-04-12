import { useState } from 'react';
import { Search, Plus, Edit, Package } from 'lucide-react';
import { formatMoney } from '../../utils/format';

export function InventoryModule({ sys }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Bulletproof search that checks both raw database headers and mapped react names
  const filteredInventory = sys.inventory.filter((item) => {
    const itemName = item.name || item.Items || '';
    const itemDesc = item.description || item.Description || '';
    const itemCompany = item.company || item.Company || '';
    
    const searchLower = searchTerm.toLowerCase();
    return (
      itemName.toLowerCase().includes(searchLower) ||
      itemDesc.toLowerCase().includes(searchLower) ||
      itemCompany.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-8 h-full overflow-y-auto">
      
      {/* HEADER & ADD BUTTON */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center">
            <Package className="mr-3 text-blue-600" size={28} />
            Inventory Catalog
          </h1>
          <p className="text-sm font-bold text-slate-400 mt-1">
            Manage your products, suppliers, and pricing tiers.
          </p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center shadow-lg hover:bg-blue-700 transition-all active:scale-95">
          <Plus size={18} className="mr-2" /> Add Product
        </button>
      </div>

      {/* SEARCH & TABLE SECTION */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center bg-slate-50">
          <Search className="text-slate-400 mr-3" size={20} />
          <input
            type="text"
            placeholder="Search by product name, description, or supplier..."
            className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Data Table */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <th className="p-4 pl-6">Product / Packaging</th>
              <th className="p-4">Supplier / Brand</th>
              <th className="p-4 text-center">Unit</th>
              <th className="p-4 text-right">Cost (RMB)</th>
              <th className="p-4 text-right">Price (SG)</th>
              <th className="p-4 text-center">Stock</th>
              <th className="p-4 pr-6 text-right">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredInventory.map((item, idx) => {
              // Extract the right values whether they use the old or new keys
              const name = item.name || item.Items || 'Unknown Product';
              const description = item.description || item.Description || item.Packaging || '';
              const company = item.company || item.Company || '-';
              const unit = item.unit || item.Unit || '-';
              const priceRMB = item.costPrice || item['Unit Price (RMB)'];
              const priceSG = item.unitPrice || item['Unit Price (SG)'] || 0;
              const stock = item.stock ?? 999; // Default to 999 if not tracked yet

              return (
                <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                  
                  {/* Product Name & Description */}
                  <td className="p-4 pl-6">
                    <p className="font-black text-slate-900 text-sm">{name}</p>
                    {description && (
                      <p className="text-xs font-bold text-slate-400 mt-0.5 max-w-[250px] truncate">
                        {description}
                      </p>
                    )}
                  </td>
                  
                  {/* Supplier/Company */}
                  <td className="p-4">
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {company}
                    </span>
                  </td>
                  
                  {/* Unit */}
                  <td className="p-4 text-center">
                    <span className="text-xs font-bold text-slate-500 border border-slate-200 px-2 py-1 rounded-md">
                      {unit}
                    </span>
                  </td>
                  
                  {/* Cost Price RMB */}
                  <td className="p-4 text-right font-mono font-bold text-slate-500 text-xs">
                    {priceRMB ? `¥${Number(priceRMB).toFixed(2)}` : '-'}
                  </td>
                  
                  {/* Selling Price SG */}
                  <td className="p-4 text-right font-mono font-black text-blue-600 text-sm">
                    ${formatMoney(priceSG)}
                  </td>
                  
                  {/* Stock Status Badge */}
                  <td className="p-4 text-center">
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-md ${
                        stock > 10
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {stock} {unit}
                    </span>
                  </td>
                  
                  {/* Actions */}
                  <td className="p-4 pr-6 text-right">
                    <button className="text-slate-400 hover:text-blue-600 p-1.5 transition-colors inline-block">
                      <Edit size={16} />
                    </button>
                  </td>
                  
                </tr>
              );
            })}
            
            {filteredInventory.length === 0 && (
              <tr>
                <td colSpan="7" className="p-12 text-center text-slate-400 font-bold">
                  No products match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
