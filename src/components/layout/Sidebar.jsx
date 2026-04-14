import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Navigation,
  Package,
  Percent,
  Receipt,
  Shield,
  Truck,
  Users,
  Contact2, // Added for a distinct Employee icon
} from 'lucide-react';

function NavButton({ id, icon: Icon, label, activeTab, setActiveTab }) {
  const active = activeTab === id;

  return (
    <button
      className={`mb-1 flex w-full items-center space-x-3 rounded-2xl px-4 py-3 transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
          : 'text-gray-400 hover:bg-slate-800'
      }`}
      onClick={() => setActiveTab(id)}
      type="button"
    >
      <Icon size={18} />
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

export function Sidebar({ sys, activeTab, setActiveTab }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 text-white print:hidden md:flex">
      <div className="border-b border-slate-800 p-8 text-center text-xl font-black tracking-tighter">
        THREE LEAVES
      </div>
      <nav className="mt-4 flex-1 overflow-y-auto p-4">
        <NavButton activeTab={activeTab} icon={LayoutDashboard} id="dashboard" label="Overview" setActiveTab={setActiveTab} />
        <NavButton activeTab={activeTab} icon={Users} id="customers" label="Customers" setActiveTab={setActiveTab} />
        <NavButton activeTab={activeTab} icon={Truck} id="suppliers" label="Suppliers" setActiveTab={setActiveTab} />
        <NavButton activeTab={activeTab} icon={FileText} id="invoices" label="Invoices" setActiveTab={setActiveTab} />
        <NavButton activeTab={activeTab} icon={Receipt} id="billing" label="Statements" setActiveTab={setActiveTab} />
        <NavButton activeTab={activeTab} icon={Package} id="inventory" label="Inventory" setActiveTab={setActiveTab} />
        
        {/* NEW EMPLOYEE MODULE BUTTON */}
        <NavButton activeTab={activeTab} icon={Contact2} id="employees" label="Employees" setActiveTab={setActiveTab} />
        
        <NavButton activeTab={activeTab} icon={ClipboardList} id="picking" label="Pick List" setActiveTab={setActiveTab} />
        <NavButton activeTab={activeTab} icon={Navigation} id="logistics" label="Delivery Map" setActiveTab={setActiveTab} />
        <NavButton activeTab={activeTab} icon={Percent} id="gst" label="GST Ledger" setActiveTab={setActiveTab} />
        
        {sys.currentUser?.role === 'admin' && (
          <div className="mt-8 border-t border-slate-800 pt-4">
            <NavButton activeTab={activeTab} icon={Shield} id="team" label="Team Access" setActiveTab={setActiveTab} />
          </div>
        )}
      </nav>
      <div className="flex items-center justify-between rounded-t-3xl border-t border-slate-800 bg-slate-950 p-4">
        <span className="truncate text-xs font-bold text-blue-400">{sys.currentUser?.name}</span>
        <button
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
          onClick={() => sys.setCurrentUser(null)}
          type="button"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
