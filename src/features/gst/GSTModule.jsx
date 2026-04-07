import { useMemo, useState } from 'react';
import { Calendar, Info, Plus, Trash2 } from 'lucide-react';
import { EntityModal } from '../../components/shared/EntityModal';
import { formatMoney } from '../../utils/format';

function GstTransactionModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'input',
    desc: '',
    category: 'Purchases',
    amount: '',
    gst: '',
  });

  const calcAutoGst = (amount) => {
    setForm((current) => ({
      ...current,
      amount,
      gst: (Number(amount || 0) * 0.09).toFixed(2),
    }));
  };

  return (
    <EntityModal
      onClose={onClose}
      onSave={() =>
        onSave({
          ...form,
          id: `g${Date.now()}`,
          amount: Number(form.amount || 0),
          gst: Number(form.gst || 0),
        })
      }
      title="Log GST Transaction"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              Date
            </label>
            <input
              className="mt-1 w-full rounded-xl border bg-gray-50 p-3 text-sm font-bold"
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              type="date"
              value={form.date}
            />
          </div>
          <div>
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              Tax Type
            </label>
            <select
              className="mt-1 w-full rounded-xl border bg-gray-50 p-3 text-sm font-bold"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value,
                  category: event.target.value === 'input' ? 'Purchases' : 'Sales',
                }))
              }
              value={form.type}
            >
              <option value="input">Input (Purchases / Expenses)</option>
              <option value="output">Output (Sales / Income)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
            Category
          </label>
          <select
            className="mt-1 w-full rounded-xl border bg-gray-50 p-3 text-sm"
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            value={form.category}
          >
            {form.type === 'input' ? (
              <>
                <option>Purchases</option>
                <option>Overheads</option>
                <option>Capital Goods</option>
              </>
            ) : (
              <>
                <option>Sales</option>
                <option>Other Income</option>
              </>
            )}
          </select>
        </div>

        <div>
          <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
            Description
          </label>
          <input
            className="mt-1 w-full rounded-xl border bg-gray-50 p-3 text-sm"
            onChange={(event) => setForm((current) => ({ ...current, desc: event.target.value }))}
            placeholder="e.g., Office Supplies"
            value={form.desc}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              Amount (ex-GST)
            </label>
            <input
              className="mt-1 w-full rounded-xl border bg-gray-50 p-3 font-mono text-sm"
              onChange={(event) => calcAutoGst(event.target.value)}
              placeholder="0.00"
              step="0.01"
              type="number"
              value={form.amount}
            />
          </div>
          <div>
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-indigo-500">
              GST Amount
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-indigo-200 bg-indigo-50 p-3 font-mono text-sm font-bold text-indigo-700"
              onChange={(event) => setForm((current) => ({ ...current, gst: event.target.value }))}
              placeholder="0.00"
              step="0.01"
              type="number"
              value={form.gst}
            />
          </div>
        </div>
      </div>
    </EntityModal>
  );
}

export function GSTModule({ sys }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  const allGstRecords = useMemo(() => {
    const records = [...sys.gstRecords];

    sys.invoices.forEach((invoice) => {
      const netAmount = (invoice.total || 0) / 1.09;
      const gstAmount = (invoice.total || 0) - netAmount;
      records.push({
        id: `auto_${invoice.id}`,
        date: invoice.date || '',
        type: 'output',
        desc: `Sales Invoice #${invoice.number || 'N/A'} to ${invoice.customer || 'Unknown'}`,
        category: 'Sales',
        amount: netAmount,
        gst: gstAmount,
        isAuto: true,
      });
    });

    return records
      .filter((record) => (record.date || '').startsWith(filterMonth))
      .sort((left, right) => new Date(right.date) - new Date(left.date));
  }, [filterMonth, sys.gstRecords, sys.invoices]);

  const report = useMemo(() => {
    const outputs = allGstRecords.filter((record) => record.type === 'output');
    const inputs = allGstRecords.filter((record) => record.type === 'input');

    const outGst = outputs.reduce((sum, record) => sum + (record.gst || 0), 0);
    const inGst = inputs.reduce((sum, record) => sum + (record.gst || 0), 0);

    return {
      outGst,
      inGst,
      netPayable: outGst - inGst,
    };
  }, [allGstRecords]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800">GST Transaction Ledger</h2>
          <p className="text-sm font-medium text-gray-500">
            Record keeping for input and output tax computation
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-3 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
            <Calendar className="text-blue-600" size={18} />
            <input
              className="cursor-pointer bg-transparent text-sm font-bold text-slate-700 outline-none focus:ring-0"
              onChange={(event) => setFilterMonth(event.target.value)}
              type="month"
              value={filterMonth}
            />
          </div>
          {sys.hasPerm('manage_gst') && (
            <button
              className="flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700"
              onClick={() => setIsOpen(true)}
              type="button"
            >
              <Plus className="mr-2" size={16} /> Log Transaction
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50 p-6 shadow-sm">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-indigo-400">
            Total Output GST (Box 1)
          </p>
          <h4 className="font-mono text-3xl font-black tracking-tighter text-indigo-900">
            ${formatMoney(report.outGst)}
          </h4>
          <p className="mt-2 text-xs font-bold text-indigo-600">Tax collected from sales</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-emerald-400">
            Total Input GST (Box 5)
          </p>
          <h4 className="font-mono text-3xl font-black tracking-tighter text-emerald-900">
            ${formatMoney(report.inGst)}
          </h4>
          <p className="mt-2 text-xs font-bold text-emerald-600">Tax claimable from purchases</p>
        </div>
        <div
          className={`overflow-hidden rounded-2xl border p-6 text-white shadow-sm ${
            report.netPayable >= 0
              ? 'border-red-600 bg-red-500'
              : 'border-emerald-600 bg-emerald-500'
          }`}
        >
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/70">
            Net GST Payable (Box 6)
          </p>
          <h4 className="font-mono text-3xl font-black tracking-tighter">
            ${formatMoney(Math.abs(report.netPayable))}
          </h4>
          <p className="mt-2 text-xs font-bold opacity-90">
            {report.netPayable >= 0 ? 'Amount owed to IRAS' : 'Refund claimable from IRAS'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400">
            <tr>
              <th className="p-4 pl-6">Date</th>
              <th className="p-4">Type</th>
              <th className="p-4">Description</th>
              <th className="p-4">Category</th>
              <th className="p-4 text-right">Value (ex-GST)</th>
              <th className="p-4 text-right">GST Amount</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {allGstRecords.map((record) => (
              <tr className="transition-colors hover:bg-gray-50" key={record.id}>
                <td className="p-4 pl-6 font-bold text-gray-600">{record.date}</td>
                <td className="p-4">
                  <span
                    className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                      record.type === 'output'
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {record.type}
                  </span>
                </td>
                <td className="p-4 font-bold text-slate-800">
                  {record.desc}
                  {record.isAuto && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-black uppercase text-blue-600">
                      Auto
                    </span>
                  )}
                </td>
                <td className="p-4 font-bold text-gray-500">{record.category}</td>
                <td className="p-4 text-right font-mono font-bold text-gray-600">
                  ${formatMoney(record.amount)}
                </td>
                <td
                  className={`p-4 text-right font-mono font-black ${
                    record.type === 'output' ? 'text-indigo-600' : 'text-emerald-600'
                  }`}
                >
                  ${formatMoney(record.gst)}
                </td>
                <td className="p-4 pr-6 text-right">
                  {record.isAuto ? (
                    <Info className="inline-block text-gray-300" size={16} />
                  ) : (
                    <button
                      className="rounded-lg p-1.5 text-red-300 transition-colors hover:text-red-600"
                      onClick={() =>
                        sys.setGstRecords(sys.gstRecords.filter((entry) => entry.id !== record.id))
                      }
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {allGstRecords.length === 0 && (
              <tr>
                <td className="p-12 text-center text-sm font-bold text-gray-400" colSpan="7">
                  No GST transactions logged for this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <GstTransactionModal
          onClose={() => setIsOpen(false)}
          onSave={(record) => {
            sys.setGstRecords([...sys.gstRecords, record]);
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
}
