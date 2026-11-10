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
    <div className="tl-module-page flex h-full min-h-0 flex-col bg-transparent">
      <div className="tl-screen-section shrink-0 border-b border-slate-200 bg-white px-5 pt-4 print:hidden sm:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Cash Workspace
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Manage individual Cash invoices or switch to monthly Cash billing.
            </p>
          </div>

          <div className="tl-segmented w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setWorkspace('invoices')}
              className={`tl-segmented__item flex-1 lg:min-w-[156px] ${
                workspace === 'invoices'
                  ? 'is-active'
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
              className={`tl-segmented__item flex-1 lg:min-w-[156px] ${
                workspace === 'billing'
                  ? 'is-active'
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
                ? 'translate-x-full bg-slate-700'
                : 'translate-x-0 bg-slate-700'
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
