import React, { useMemo } from 'react';
import {
  ArrowDownToLine,
  ClipboardList,
  FileText,
  Map,
  Package,
  Receipt,
  Shield,
  Users,
} from 'lucide-react';
import { ShortcutBtn } from '../../components/shared/ShortcutBtn';
import { StatCard } from '../../components/shared/StatCard';
import { getTodayString } from '../../utils/date';

/**
 * @typedef {{
 *   customers: any[];
 *   invoices: { date: string }[];
 *   inventory: { stock: number }[];
 *   users: any[];
 * }} Sys
 *
 * @param {{
 *   sys: Sys;
 *   setActiveTab: (tab: string) => void;
 *   /** number of units that count as “low stock” – defaults to 20 *\/
 *   lowStockThreshold?: number;
 * }} props
 */
export function DashboardModule({
  sys,
  setActiveTab,
  lowStockThreshold = 20,
}) {
  /* ----- Bail out if data not ready ----- */
  if (!sys?.customers || !sys?.invoices || !sys?.inventory || !sys?.users) {
    return (
      <div className="p-8 text-sm text-slate-500">Loading dashboard…</div>
    );
  }

  const today = getTodayString();

  /* ----- Derived metrics (memoised) ----- */
  const { todayCount, lowStockCount } = useMemo(() => {
    const todayInvoices = sys.invoices.filter((inv) => inv.date === today);
    const lowStockItems = sys.inventory.filter(
      (item) => item.stock < lowStockThreshold,
    );
    return { todayCount: todayInvoices.length, lowStockCount: lowStockItems.length };
  }, [sys.invoices, sys.inventory, today, lowStockThreshold]);

  /* ---------- RENDER ---------- */
  return (
    <div className="space-y-6">
      {/* ====== STAT CARDS ====== */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard color="emerald" icon={Users} label="Customers" val={sys.customers.length} />
        <StatCard color="blue" icon={FileText} label="Invoices Today" val={todayCount} />
        <StatCard color="red" icon={Package} label="Low Stock" val={lowStockCount} />
        <StatCard color="indigo" icon={Shield} label="Team Members" val={sys.users.length} />
      </div>

      {/* ====== SHORTCUT HUB ====== */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-700">
          Operation Hub
        </h3>

        <div className="flex flex-wrap gap-4">
          <ShortcutBtn
            icon={FileText}
            label="Invoicing"
            onClick={() => setActiveTab('invoices')}
            perm="create_invoices"
            sys={sys}
          />
          <ShortcutBtn
            icon={Receipt}
            label="Billing"
            onClick={() => setActiveTab('billing')}
            perm="manage_billing"
            sys={sys}
          />
          <ShortcutBtn
            icon={Map}
            label="Delivery Map"
            onClick={() => setActiveTab('logistics')}
            sys={sys}
          />
          <ShortcutBtn
            icon={ArrowDownToLine}
            label="Stock In"
            onClick={() => setActiveTab('suppliers')}
            perm="manage_suppliers"
            sys={sys}
          />
          <ShortcutBtn
            icon={ClipboardList}
            label="Pick List"
            onClick={() => setActiveTab('picking')}
            sys={sys}
          />
        </div>
      </div>
    </div>
  );
}
