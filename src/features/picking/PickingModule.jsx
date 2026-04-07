import { useState } from 'react';
import { CheckCircle, ClipboardList, Printer, RefreshCw } from 'lucide-react';
import { getTodayString } from '../../utils/date';

export function PickingModule({ sys }) {
  const [activeList, setActiveList] = useState(null);
  const todayString = getTodayString();
  const todayInvoices = sys.invoices.filter((invoice) => invoice.date === todayString);

  const generate = () => {
    const aggregate = {};
    todayInvoices.forEach((invoice) => {
      invoice.items?.forEach((item) => {
        const key = `${item.itemId}-${item.unit}`;
        if (!aggregate[key]) {
          aggregate[key] = { name: item.name, unit: item.unit, qty: 0 };
        }
        aggregate[key].qty += Number(item.qty || 0);
      });
    });
    setActiveList(Object.values(aggregate));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:hidden">
      <div className="rounded-[32px] border border-gray-100 bg-white p-8 text-center shadow-sm">
        {!activeList ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
              <ClipboardList size={32} />
            </div>
            <h3 className="mb-2 text-xl font-bold">EOD Pick Summary</h3>
            <p className="mb-6 text-sm text-gray-500">Aggregate all items for today&apos;s data entries.</p>
            <button
              className="mx-auto flex items-center rounded-2xl bg-indigo-600 px-8 py-3 font-black text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700"
              onClick={generate}
              type="button"
            >
              <RefreshCw className="mr-2" size={18} /> Generate Collation
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <span className="flex items-center text-[10px] font-black uppercase tracking-widest text-green-600">
              <CheckCircle className="mr-2" size={20} /> Collation Ready
            </span>
            <button
              className="text-xs font-black uppercase text-gray-400 transition-all hover:text-indigo-600"
              onClick={() => setActiveList(null)}
              type="button"
            >
              <RefreshCw className="mr-1 inline-block" size={14} /> Restart
            </button>
          </div>
        )}
      </div>

      {activeList && (
        <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-md">
          <div className="flex items-center justify-between bg-slate-900 p-6 text-white">
            <div>
              <h3 className="text-lg font-bold uppercase tracking-widest">Master Pick List</h3>
              <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">DATE: {todayString}</p>
            </div>
            <Printer className="opacity-20" size={28} />
          </div>
          <ul className="divide-y divide-gray-100">
            {activeList.map((item, index) => (
              <li
                className="flex items-center justify-between p-6 transition-colors hover:bg-gray-50"
                key={`${item.name}-${index}`}
              >
                <div className="flex items-center space-x-4">
                  <div className="h-6 w-6 cursor-pointer rounded-lg border-2 border-gray-300 transition-colors hover:bg-green-100" />
                  <span className="text-lg font-bold uppercase tracking-tight text-gray-800">
                    {item.name}
                  </span>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-6 py-2 text-3xl font-black tracking-tighter text-indigo-700">
                  {item.qty}{' '}
                  <small className="text-[10px] uppercase text-indigo-400">{item.unit}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
