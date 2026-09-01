import { useState } from 'react';
import { ReceiptText, WalletCards } from 'lucide-react';
import { CashModule as CashInvoiceHistory } from './CashModule';
import { CashBilling } from './CashBilling';

/**
 * CashWorkspace
 *
 * IMPORTANT:
 * - Your existing CashModule.jsx stays exactly where it is.
 * - No renaming and no changes inside CashModule.jsx are required.
 * - This component becomes the Cash page entry point from App.jsx.
 *
 * Both workspaces remain mounted so switching tabs does not reset the current
 * Cash History filters / page / local state unnecessarily.
 */
export function CashWorkspace({ sys }) {
  const [workspace, setWorkspace] = useState('invoices');

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50/50">
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 pt-4 print:hidden sm:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Cash Workspace
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Manage individual Cash invoices or switch to monthly Cash billing.
            </p>
          </div>

          <div className="flex w-full rounded-xl border border-slate-200 bg-slate-100 p-1 lg:w-auto">
            <button
              type="button"
              onClick={() => setWorkspace('invoices')}
              className={`flex flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-xs font-black transition-all lg:min-w-[156px] ${
                workspace === 'invoices'
                  ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
              }`}
              aria-pressed={workspace === 'invoices'}
            >
              <WalletCards size={15} className="mr-2" />
              Cash Invoices
            </button>

            <button
              type="button"
              onClick={() => setWorkspace('billing')}
              className={`flex flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-xs font-black transition-all lg:min-w-[156px] ${
                workspace === 'billing'
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
              }`}
              aria-pressed={workspace === 'billing'}
            >
              <ReceiptText size={15} className="mr-2" />
              Billing
            </button>
          </div>
        </div>

        <div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full w-1/2 transition-transform duration-200 ${
              workspace === 'billing'
                ? 'translate-x-full bg-blue-600'
                : 'translate-x-0 bg-emerald-600'
            }`}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <div
          className={workspace === 'invoices' ? 'h-full' : 'hidden h-full'}
          aria-hidden={workspace !== 'invoices'}
        >
          <CashInvoiceHistory sys={sys} />
        </div>

        <div
          className={workspace === 'billing' ? 'h-full' : 'hidden h-full'}
          aria-hidden={workspace !== 'billing'}
        >
          <CashBilling sys={sys} />
        </div>
      </div>
    </div>
  );
}
