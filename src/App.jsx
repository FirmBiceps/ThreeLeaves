import { useState } from 'react';
import { LoginView } from './components/auth/LoginView';
import { Sidebar } from './components/layout/Sidebar';
import { BillingModule } from './features/billing/BillingModule';
import { CustomerModule } from './features/customers/CustomerModule';
import { DashboardModule } from './features/dashboard/DashboardModule';
import { GSTModule } from './features/gst/GSTModule';
import { InventoryModule } from './features/inventory/InventoryModule';
import { InvoiceModule } from './features/invoices/InvoiceModule';
import { LogisticsModule } from './features/logistics/LogisticsModule';
import { PickingModule } from './features/picking/PickingModule';
import { SupplierModule } from './features/suppliers/SupplierModule';
import { TeamModule } from './features/team/TeamModule';
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
    { value: 'billing', label: 'Statements' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'picking', label: 'Pick List' },
    { value: 'logistics', label: 'Delivery Map' },
    { value: 'gst', label: 'GST Ledger' },
    ...(sys.currentUser?.role === 'admin' ? [{ value: 'team', label: 'Team Access' }] : []),
  ];

  if (!sys.currentUser) {
    return <LoginView loginError={loginError} setLoginError={setLoginError} sys={sys} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} sys={sys} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8 shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <h2 className="hidden text-2xl font-semibold capitalize md:block">
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
          <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-tighter text-blue-600 md:text-sm">
            Three Leaves ERP
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 print:overflow-visible print:p-0">
          {activeTab === 'dashboard' && <DashboardModule setActiveTab={setActiveTab} sys={sys} />}
          {activeTab === 'customers' && <CustomerModule sys={sys} />}
          {activeTab === 'suppliers' && <SupplierModule sys={sys} />}
          {activeTab === 'invoices' && <InvoiceModule sys={sys} />}
          {activeTab === 'billing' && <BillingModule sys={sys} />}
          {activeTab === 'inventory' && <InventoryModule sys={sys} />}
          {activeTab === 'picking' && <PickingModule sys={sys} />}
          {activeTab === 'logistics' && <LogisticsModule sys={sys} />}
          {activeTab === 'gst' && <GSTModule sys={sys} />}
          {activeTab === 'team' && <TeamModule sys={sys} />}
        </div>
      </main>
    </div>
  );
}
