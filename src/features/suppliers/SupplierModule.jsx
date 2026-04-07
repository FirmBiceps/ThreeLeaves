import { useState } from 'react';
import { ArrowDownToLine, X } from 'lucide-react';

function POModal({ sys, onClose }) {
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ itemId: '', qty: 1 }]);

  const handleSave = () => {
    const nextInventory = [...sys.inventory];
    items.forEach((item) => {
      const index = nextInventory.findIndex((entry) => entry.id === item.itemId);
      if (index > -1) {
        nextInventory[index].stock += Number(item.qty || 0);
      }
    });
    sys.setInventory(nextInventory);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b bg-indigo-50 p-6 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
          <h3 className="text-indigo-900">Receive Shipment</h3>
          <button onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-6 p-8">
          <select
            className="w-full rounded-2xl border border-indigo-100 bg-indigo-50/30 p-3 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={(event) => setSupplierId(event.target.value)}
            value={supplierId}
          >
            <option value="">-- Choose Vendor --</option>
            {sys.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>

          {items.map((item, index) => (
            <div className="flex space-x-2" key={index}>
              <select
                className="flex-1 rounded-xl border p-2 text-sm"
                onChange={(event) => {
                  const nextItems = [...items];
                  nextItems[index].itemId = event.target.value;
                  setItems(nextItems);
                }}
                value={item.itemId}
              >
                <option value="">Product...</option>
                {sys.inventory.map((inventoryItem) => (
                  <option key={inventoryItem.id} value={inventoryItem.id}>
                    {inventoryItem.name}
                  </option>
                ))}
              </select>
              <input
                className="w-20 rounded-xl border p-2 text-center font-black text-indigo-600"
                onChange={(event) => {
                  const nextItems = [...items];
                  nextItems[index].qty = event.target.value;
                  setItems(nextItems);
                }}
                type="number"
                value={item.qty}
              />
            </div>
          ))}

          <button
            className="text-xs font-black uppercase tracking-widest text-indigo-600"
            onClick={() => setItems([...items, { itemId: '', qty: 1 }])}
            type="button"
          >
            + Add Line
          </button>
        </div>
        <div className="flex justify-end border-t bg-gray-50 p-6">
          <button
            className="rounded-2xl bg-indigo-600 px-10 py-3 font-black text-white shadow-lg shadow-indigo-900/30 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!supplierId}
            onClick={handleSave}
            type="button"
          >
            Officially Receive
          </button>
        </div>
      </div>
    </div>
  );
}

export function SupplierModule({ sys }) {
  const [isPOOpen, setIsPOOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between rounded-t-xl border-b border-gray-100 bg-gray-50 p-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Inventory Supply
        </h3>
        {sys.hasPerm('manage_suppliers') && (
          <button
            className="flex items-center rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-md"
            onClick={() => setIsPOOpen(true)}
            type="button"
          >
            <ArrowDownToLine className="mr-2" size={16} /> Stock In (PO)
          </button>
        )}
      </div>
      <table className="w-full text-left">
        <thead className="border-b text-[10px] uppercase text-gray-400">
          <tr>
            <th className="p-4">Supplier</th>
            <th className="p-4 text-right">Region</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm font-bold text-gray-800">
          {sys.suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td className="p-4">{supplier.name}</td>
              <td className="p-4 text-right text-[10px] font-black uppercase text-gray-400">
                {supplier.region || 'West'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isPOOpen && <POModal onClose={() => setIsPOOpen(false)} sys={sys} />}
    </div>
  );
}
