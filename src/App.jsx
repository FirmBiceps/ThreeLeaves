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

  if (sys.isHydrating) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 px-8 py-6 text-center shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-500">
            Loading
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-tighter">
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
        <header className="tl-topbar z-10 flex shrink-0 items-center justify-between px-6 md:px-8 print:hidden">
          <div className="flex items-center gap-4">
            <h2 className="tl-page-heading hidden md:block">
              {activeTab.replace('-', ' ')}
            </h2>

            <select
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 md:hidden"
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

          <div className="flex items-center gap-3">
            {sys.lastSyncError && (
              <div className="hidden rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-red-600 lg:block">
                Sync issue
              </div>
            )}

            <div className="tl-topbar-meta hidden md:inline-flex">
              {sys.storageMode === 'supabase'
                ? <> <span className="tl-status-dot" /> Connected </>
                : <> <span className="tl-status-dot is-error" /> Demo mode </>}
            </div>

            <div className="text-xs font-bold tracking-[0.12em] text-slate-500">THREE LEAVES ERP</div>
          </div>
        </header>

        <div className="tl-content flex-1 overflow-y-auto print:overflow-visible print:p-0">
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
      </main>
    </div>
  );
}
