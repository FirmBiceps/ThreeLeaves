import { useState } from 'react';
import { DollarSign, Edit } from 'lucide-react';
import { EntityModal } from '../../components/shared/EntityModal';
import { formatMoney } from '../../utils/format';

function InventoryEditModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({ ...item });

  return (
    <EntityModal onClose={onClose} onSave={() => onSave(form)} title="Edit Product Detail">
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Name</label>
          <input
            className="mt-1 w-full rounded border p-2 font-bold"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            value={form.name}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Cost ($)
            </label>
            <input
              className="w-full rounded border p-2"
              onChange={(event) =>
                setForm((current) => ({ ...current, price: Number(event.target.value) }))
              }
              step="0.01"
              type="number"
              value={form.price}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-amber-600">
              Stock Count
            </label>
            <input
              className="w-full rounded border bg-amber-50 p-2"
              onChange={(event) =>
                setForm((current) => ({ ...current, stock: Number(event.target.value) }))
              }
              type="number"
              value={form.stock}
            />
          </div>
        </div>
      </div>
    </EntityModal>
  );
}

function PricingModal({ item, onClose, onSave, customers }) {
  const [customerPrices, setCustomerPrices] = useState({ ...item.customerPrices });
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newValue, setNewValue] = useState('');

  return (
    <EntityModal
      onClose={onClose}
      onSave={() => onSave(customerPrices)}
      title={`Negotiated Prices: ${item.name}`}
    >
      <div className="space-y-4">
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {Object.entries(customerPrices).map(([customerId, value]) => (
            <div
              className="flex items-center justify-between rounded border bg-slate-50 p-2 text-[10px] font-bold"
              key={customerId}
            >
              <span className="uppercase">
                {customers.find((customer) => customer.id === customerId)?.name || 'Unknown'}
              </span>
              <span className="text-blue-600">${formatMoney(value)}</span>
            </div>
          ))}
        </div>
        <div className="flex space-x-1 border-t pt-4">
          <select
            className="flex-1 rounded border p-1 text-[10px]"
            onChange={(event) => setNewCustomerId(event.target.value)}
            value={newCustomerId}
          >
            <option value="">Customer...</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <input
            className="w-16 rounded border p-1 text-[10px]"
            onChange={(event) => setNewValue(event.target.value)}
            step="0.01"
            type="number"
            value={newValue}
          />
          <button
            className="rounded bg-blue-600 px-2 text-white"
            onClick={() => {
              if (newCustomerId && newValue) {
                setCustomerPrices({ ...customerPrices, [newCustomerId]: Number(newValue) });
                setNewCustomerId('');
                setNewValue('');
              }
            }}
            type="button"
          >
            +
          </button>
        </div>
      </div>
    </EntityModal>
  );
}

export function InventoryModule({ sys }) {
  const [editItem, setEditItem] = useState(null);
  const [priceItem, setPriceItem] = useState(null);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left font-medium text-gray-800">
        <thead className="border-b bg-gray-50 text-[10px] font-black uppercase text-gray-400">
          <tr>
            <th className="p-4">Item</th>
            <th className="p-4">Base Cost</th>
            <th className="p-4 text-center">Stock</th>
            {sys.hasPerm('manage_inventory') && <th className="p-4 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm">
          {sys.inventory.map((item) => (
            <tr className="hover:bg-gray-50" key={item.id}>
              <td className="p-4 font-bold">
                {item.name}
                <br />
                <small className="text-[9px] uppercase tracking-widest text-gray-400">{item.unit}</small>
              </td>
              <td className="p-4 font-mono text-lg font-black tracking-tighter text-gray-700">
                ${formatMoney(item.price)}
              </td>
              <td
                className={`p-4 text-center text-xl font-black tracking-tighter ${
                  item.stock < 20 ? 'text-red-500' : 'text-emerald-500'
                }`}
              >
                {item.stock}
              </td>
              {sys.hasPerm('manage_inventory') && (
                <td className="p-4 text-right">
                  <button
                    className="mr-3 rounded-xl p-2 text-blue-500 hover:bg-blue-100"
                    onClick={() => setPriceItem(item)}
                    type="button"
                  >
                    <DollarSign size={18} />
                  </button>
                  <button
                    className="rounded-xl p-2 text-gray-400 hover:bg-gray-100"
                    onClick={() => setEditItem(item)}
                    type="button"
                  >
                    <Edit size={18} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {editItem && (
        <InventoryEditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={(form) => {
            sys.setInventory(sys.inventory.map((entry) => (entry.id === form.id ? form : entry)));
            setEditItem(null);
          }}
        />
      )}

      {priceItem && (
        <PricingModal
          customers={sys.customers}
          item={priceItem}
          onClose={() => setPriceItem(null)}
          onSave={(customerPrices) => {
            sys.setInventory(
              sys.inventory.map((entry) =>
                entry.id === priceItem.id ? { ...priceItem, customerPrices } : entry,
              ),
            );
            setPriceItem(null);
          }}
        />
      )}
    </div>
  );
}
