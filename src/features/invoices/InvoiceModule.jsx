import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { isToday } from '../../utils/date';
import { formatMoney } from '../../utils/format';
import { InvoiceGenerator } from './InvoiceGenerator';

export function InvoiceModule({ sys }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('All');

  const filteredInvoices = useMemo(
    () =>
      [...sys.invoices]
        .filter((invoice) => filter === 'All' || isToday(invoice.date || ''))
        .reverse(),
    [filter, sys.invoices],
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between rounded-t-xl border-b border-gray-100 bg-gray-50 p-4">
        <div className="flex space-x-2">
          {['All', 'Today'].map((option) => (
            <button
              className={`rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                filter === option ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'
              }`}
              key={option}
              onClick={() => setFilter(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
        {sys.hasPerm('create_invoices') && (
          <button
            className="flex items-center rounded-lg bg-blue-600 px-5 py-1.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700"
            onClick={() => setIsOpen(true)}
            type="button"
          >
            <Plus className="mr-2" size={16} /> New Invoice
          </button>
        )}
      </div>

      <table className="w-full text-left">
        <thead className="border-b text-[10px] font-black uppercase tracking-widest text-gray-400">
          <tr>
            <th className="p-4">Inv No.</th>
            <th className="p-4">Client Entity</th>
            <th className="p-4">Date</th>
            <th className="p-4 text-center">Terms</th>
            <th className="p-4 text-right">Total Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm font-medium">
          {filteredInvoices.map((invoice) => (
            <tr className="font-medium hover:bg-gray-50" key={invoice.id || invoice.number}>
              <td className="p-4 font-mono font-bold text-blue-600">#{invoice.number}</td>
              <td className="p-4">{invoice.customer}</td>
              <td className="p-4 text-xs text-gray-500">{invoice.date}</td>
              <td className="p-4 text-center">
                <span
                  className={`rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                    invoice.paymentTerms === 'cod'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {invoice.paymentTerms === 'cod' ? 'COD' : '30 Days'}
                </span>
              </td>
              <td className="p-4 text-right font-black">${formatMoney(invoice.total)}</td>
            </tr>
          ))}
          {filteredInvoices.length === 0 && (
            <tr>
              <td className="p-12 text-center text-sm font-bold text-gray-400" colSpan="5">
                No invoices found for this filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {isOpen && <InvoiceGenerator onClose={() => setIsOpen(false)} sys={sys} />}
    </div>
  );
}
