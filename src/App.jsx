import { useState } from 'react';
import { LoginView } from './components/auth/LoginView';
import { Sidebar } from './components/layout/Sidebar';
import { BillingModule } from './features/billing/BillingModule';
import { CustomerModule } from './features/customers/CustomerModule';
import { DashboardModule } from './features/dashboard/DashboardModule';
import { GSTModule } from './features/gst/GSTModule';
import { InventoryModule } from './features/inventory/InventoryModule';
import { InvoiceModule } from './features/invoices/InvoiceModule';
import { CashWorkspace as CashModule } from './features/cash/CashWorkspace';
import { LogisticsModule } from './features/logistics/LogisticsModule';
import { PickingModule } from './features/picking/PickingModule';
import { SupplierModule } from './features/suppliers/SupplierModule';
import { TeamModule } from './features/team/TeamModule';
import { EmployeeModule } from './features/Employee/EmployeeModule';
import { useEnterpriseSystem } from './hooks/useEnterpriseSystem';

export default function App() {
  const sys = useEnterpriseSystem();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginError, setLoginError] = useState('');

  const tabOptions = [
    { value: 'dashboard', label: 'Overview' },
    { value: 'customers', label: 'Customers' },
    { value: 'suppliers', label: 'Suppliers' },
    { value: 'invoices', label: 'Invoices' },
    { value: 'cash', label: 'Cash' },
    { value: 'billing', label: 'Statements' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'employees', label: 'Employees' },
    { value: 'picking', label: 'Pick List' },
    { value: 'logistics', label: 'Delivery Map' },
    { value: 'gst', label: 'GST Ledger' },
    ...(sys.currentUser?.role === 'admin'
      ? [{ value: 'team', label: 'Team Access' }]
      : []),
  ];

  const activeLabel = tabOptions.find((tab) => tab.value === activeTab)?.label || activeTab.replace('-', ' ');

  if (sys.isHydrating) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f6f8] p-6 text-[#17202a]">
        <div className="w-full max-w-md border border-[#e4e7ec] bg-white px-8 py-7 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Loading
          </p>
          <h1 className="mt-3 text-xl font-bold tracking-tight">
            Syncing ERP Data
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Pulling your latest records from{' '}
            {sys.storageMode === 'supabase' ? 'Supabase' : 'local demo data'}.
          </p>
        </div>
      </div>
    );
  }

  if (!sys.currentUser) {
    return (
      <LoginView
        loginError={loginError}
        setLoginError={setLoginError}
        sys={sys}
      />
    );
  }

  return (
    <div className="tl-app-shell flex h-screen font-sans text-gray-800">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sys={sys}
      />

      <main className="tl-app-main flex flex-1 flex-col overflow-hidden">
        <header className="tl-topbar z-10 flex shrink-0 items-center justify-between px-5 md:px-8 print:hidden">
          <div className="flex min-w-0 items-center gap-4">
            <div className="hidden h-8 w-px bg-slate-200 md:block" />
            <div className="min-w-0">
              <p className="hidden text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 md:block">Workspace</p>
              <h2 className="tl-page-heading truncate">
                {activeLabel}
              </h2>
            </div>

            <select
              className="tl-control min-w-0 max-w-[190px] px-3 py-2 text-sm font-semibold md:hidden"
              onChange={(event) => setActiveTab(event.target.value)}
              value={activeTab}
            >
              {tabOptions.map((tab) => (
                <option key={tab.value} value={tab.value}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {sys.lastSyncError && (
              <div className="hidden border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-red-700 lg:block">
                Sync issue
              </div>
            )}

            <div className="tl-topbar-meta hidden md:inline-flex">
              {sys.storageMode === 'supabase'
                ? <><span className="tl-status-dot" /> Connected</>
                : <><span className="tl-status-dot is-error" /> Demo mode</>}
            </div>

            <div className="hidden border-l border-slate-200 pl-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 lg:block">Three Leaves ERP</div>
          </div>
        </header>

        <div className="tl-content flex-1 overflow-y-auto print:overflow-visible print:p-0">
          <div className="tl-module-ui min-h-full">
            {activeTab === 'dashboard' && (
              <DashboardModule setActiveTab={setActiveTab} sys={sys} />
            )}

            {activeTab === 'customers' && <CustomerModule sys={sys} />}
            {activeTab === 'suppliers' && <SupplierModule sys={sys} />}
            {activeTab === 'invoices' && <InvoiceModule sys={sys} />}

            {/* Separate Cash ledger stored in Supabase cash_invoices */}
            {activeTab === 'cash' && <CashModule sys={sys} />}

            {activeTab === 'billing' && <BillingModule sys={sys} />}
            {activeTab === 'inventory' && <InventoryModule sys={sys} />}
            {activeTab === 'employees' && <EmployeeModule sys={sys} />}
            {activeTab === 'picking' && <PickingModule sys={sys} />}
            {activeTab === 'logistics' && <LogisticsModule sys={sys} />}
            {activeTab === 'gst' && <GSTModule sys={sys} />}
            {activeTab === 'team' && <TeamModule sys={sys} />}
          </div>
        </div>
      </main>
    </div>
  );
}
