import { ArrowDownToLine, ClipboardList, FileText, Map, Package, Receipt, Shield, Users } from 'lucide-react';
import { ShortcutBtn } from '../../components/shared/ShortcutBtn';
import { StatCard } from '../../components/shared/StatCard';
import { getTodayString } from '../../utils/date';

export function DashboardModule({ sys, setActiveTab }) {
  const todayInvoices = sys.invoices.filter((invoice) => invoice.date === getTodayString());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard color="emerald" icon={Users} label="Customers" val={sys.customers.length} />
        <StatCard color="blue" icon={FileText} label="Invoices Today" val={todayInvoices.length} />
        <StatCard color="red" icon={Package} label="Low Stock" val={sys.inventory.filter((item) => item.stock < 20).length} />
        <StatCard color="indigo" icon={Shield} label="Team Members" val={sys.users.length} />
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-700">
          Operation Hub
        </h3>
        <div className="flex flex-wrap gap-4">
          <ShortcutBtn icon={FileText} label="Invoicing" onClick={() => setActiveTab('invoices')} perm="create_invoices" sys={sys} />
          <ShortcutBtn icon={Receipt} label="Billing" onClick={() => setActiveTab('billing')} perm="manage_billing" sys={sys} />
          <ShortcutBtn icon={Map} label="Delivery Map" onClick={() => setActiveTab('logistics')} sys={sys} />
          <ShortcutBtn icon={ArrowDownToLine} label="Stock In" onClick={() => setActiveTab('suppliers')} perm="manage_suppliers" sys={sys} />
          <ShortcutBtn icon={ClipboardList} label="Pick List" onClick={() => setActiveTab('picking')} sys={sys} />
        </div>
      </div>
    </div>
  );
}
