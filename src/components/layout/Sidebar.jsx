import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Contact2,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Navigation,
  Package,
  Percent,
  Receipt,
  Search,
  Shield,
  Truck,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const SIDEBAR_COLLAPSED_KEY = 'three-leaves-erp-sidebar-collapsed';

export function hasPermission(user, permission) {
  if (!user || user.is_active === false) return false;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return user.role === 'admin' || permissions.includes('*') || permissions.includes(permission);
}

const NAVIGATION_GROUPS = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Overview', description: 'Business summary and activity', icon: LayoutDashboard, permission: 'dashboard.read' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales & Finance',
    items: [
      { id: 'customers', label: 'Customers', description: 'Customer accounts and pricing', icon: Users, permission: 'customers.read' },
      { id: 'invoices', label: 'Invoices', description: 'Create and manage invoices', icon: FileText, permission: 'invoices.read' },
      { id: 'cash', label: 'Cash', description: 'Create and manage cash invoices', icon: WalletCards, permission: 'invoices.read' },
      { id: 'billing', label: 'Statements', description: 'Billing and account statements', icon: Receipt, permission: 'billing.read' },
      { id: 'gst', label: 'GST Ledger', description: 'GST records and reporting', icon: Percent, permission: 'gst.read' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'inventory', label: 'Inventory', description: 'Stock levels and product records', icon: Package, permission: 'inventory.read' },
      { id: 'suppliers', label: 'Suppliers', description: 'Supplier records and sourcing', icon: Truck, permission: 'suppliers.read' },
      { id: 'picking', label: 'Pick List', description: 'Warehouse picking workflow', icon: ClipboardList, permission: 'picking.read' },
      { id: 'logistics', label: 'Delivery Map', description: 'Routes and delivery tracking', icon: Navigation, permission: 'logistics.read' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { id: 'employees', label: 'Employees', description: 'Employee records and assignments', icon: Contact2, permission: 'employees.read' },
    ],
  },
];

const ADMIN_NAVIGATION_ITEMS = [
  { id: 'team', label: 'Team Access', description: 'Roles, permissions and account access', icon: Shield, permission: 'users.manage' },
];

function getInitials(user) {
  const source = String(user?.name || user?.username || 'ERP User').trim();
  if (!source) return 'ER';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
}

function formatRole(role) {
  const value = String(role || 'user').replace(/[_-]+/g, ' ').trim();
  if (!value) return 'User';
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function NavButton({ id, icon: Icon, label, description, activeTab, onSelect, collapsed }) {
  const active = activeTab === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={collapsed ? `${label} — ${description}` : undefined}
      className={`group relative mb-1 flex w-full items-center text-left transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-white/20 ${
        collapsed ? 'h-10 justify-center px-2' : 'min-h-10 gap-3 px-3 py-2'
      } ${active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.055] hover:text-white'}`}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-white" />}
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
        <Icon size={17} strokeWidth={1.9} />
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{label}</span>
          <span className={`mt-0.5 block truncate text-[10px] leading-4 ${active ? 'text-slate-300' : 'text-slate-500 group-hover:text-slate-400'}`}>
            {description}
          </span>
        </span>
      )}
      {!collapsed && active && <ChevronRight size={14} className="shrink-0 text-slate-400" />}
    </button>
  );
}

function SidebarContent({ currentUser, activeTab, visibleGroups, visibleAdminItems, allVisibleItems, allowedTabIds, collapsed, setCollapsed, searchTerm, setSearchTerm, isSigningOut, logoutError, onTabSelection, onLogout }) {
  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return visibleGroups;
    return visibleGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query)),
    })).filter((group) => group.items.length > 0);
  }, [searchTerm, visibleGroups]);

  const filteredAdminItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return visibleAdminItems;
    return visibleAdminItems.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query));
  }, [searchTerm, visibleAdminItems]);

  const noSearchResults = searchTerm.trim() !== '' && filteredGroups.length === 0 && filteredAdminItems.length === 0;

  return (
    <>
      <div className={`flex shrink-0 items-center border-b border-white/10 ${collapsed ? 'justify-center px-3 py-5' : 'justify-between px-5 py-5'}`}>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[14px] font-bold tracking-[0.12em] text-white">THREE LEAVES</p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500">Enterprise Resource Planning</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {!collapsed && (
        <div className="shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-center border border-white/10 bg-white/[0.035] px-3 py-2 transition focus-within:border-white/20">
            <Search size={14} className="mr-2 shrink-0 text-slate-500" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Find a module..."
              className="w-full bg-transparent text-[12px] font-medium text-slate-200 outline-none placeholder:text-slate-600"
              aria-label="Search modules"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} className="ml-2 text-slate-500 hover:text-white" aria-label="Clear module search">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      <nav className={`min-h-0 flex-1 overflow-y-auto pb-4 ${collapsed ? 'px-2 pt-3' : 'px-3 pt-2'}`} aria-label="Main navigation">
        {allVisibleItems.length === 0 ? (
          <div className="border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200" title={collapsed ? 'No module access' : undefined}>
            {collapsed ? <AlertCircle size={18} /> : <div className="flex items-start gap-3"><AlertCircle size={18} className="mt-0.5 shrink-0" /><div><p className="text-[11px] font-bold uppercase tracking-wider">No module access</p><p className="mt-1 text-[11px] leading-5 text-amber-200/75">Contact an administrator to assign permissions.</p></div></div>}
          </div>
        ) : noSearchResults ? (
          <div className="border border-white/10 bg-white/[0.03] p-4 text-center"><Search size={17} className="mx-auto text-slate-600" /><p className="mt-2 text-[11px] font-semibold text-slate-400">No modules found</p><button type="button" onClick={() => setSearchTerm('')} className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white">Clear search</button></div>
        ) : (
          <>
            {filteredGroups.map((group, groupIndex) => (
              <div key={group.id} className={groupIndex > 0 ? 'mt-5' : undefined}>
                {!collapsed && <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">{group.label}</p>}
                {group.items.map((item) => <NavButton key={item.id} {...item} activeTab={activeTab} onSelect={onTabSelection} collapsed={collapsed} />)}
              </div>
            ))}
            {filteredAdminItems.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4">
                {!collapsed && <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">Administration</p>}
                {filteredAdminItems.map((item) => <NavButton key={item.id} {...item} activeTab={activeTab} onSelect={onTabSelection} collapsed={collapsed} />)}
              </div>
            )}
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-white/10 bg-black/10 p-3">
        {logoutError && !collapsed && <div role="alert" className="mb-3 border border-red-400/20 bg-red-400/10 px-3 py-2 text-[11px] font-semibold text-red-300">{logoutError}</div>}
        <div className={`flex items-center border border-white/10 bg-white/[0.035] ${collapsed ? 'justify-center p-2' : 'gap-3 p-3'}`}>
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center bg-white/10 text-[11px] font-bold text-white">
            {getInitials(currentUser)}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 border-2 border-[#1f252d] bg-emerald-400" />
          </div>
          {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-slate-100">{currentUser?.name || currentUser?.username || 'ERP User'}</p><div className="mt-1 flex items-center gap-2"><span className="truncate text-[9px] font-bold uppercase tracking-wider text-slate-400">{formatRole(currentUser?.role)}</span><span className="h-1 w-1 bg-slate-700" /><span className="text-[9px] font-semibold text-emerald-400">Online</span></div></div>}
          {!collapsed && <button type="button" onClick={onLogout} disabled={isSigningOut} aria-label="Sign out" title="Sign out" className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-500 transition hover:bg-red-400/10 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50">{isSigningOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}</button>}
        </div>
        {collapsed && <button type="button" onClick={onLogout} disabled={isSigningOut} aria-label="Sign out" title="Sign out" className="mt-2 flex h-9 w-full items-center justify-center text-slate-500 transition hover:bg-red-400/10 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50">{isSigningOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}</button>}
      </div>
    </>
  );
}

export function Sidebar({ sys, activeTab, setActiveTab }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; } catch { return false; }
  });
  const currentUser = sys?.currentUser || null;

  const visibleGroups = useMemo(() => NAVIGATION_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => hasPermission(currentUser, item.permission)) })).filter((group) => group.items.length > 0), [currentUser]);
  const visibleAdminItems = useMemo(() => ADMIN_NAVIGATION_ITEMS.filter((item) => hasPermission(currentUser, item.permission)), [currentUser]);
  const allVisibleItems = useMemo(() => [...visibleGroups.flatMap((group) => group.items), ...visibleAdminItems], [visibleGroups, visibleAdminItems]);
  const allowedTabIds = useMemo(() => new Set(allVisibleItems.map((item) => item.id)), [allVisibleItems]);

  useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? 'true' : 'false'); } catch {}
  }, [collapsed]);

  useEffect(() => {
    const handleKeyboardShortcut = (event) => {
      if (event.altKey && event.key === '\\') { event.preventDefault(); setCollapsed((value) => !value); }
    };
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, []);

  useEffect(() => {
    if (typeof setActiveTab !== 'function' || allVisibleItems.length === 0) return;
    if (!allowedTabIds.has(activeTab)) setActiveTab(allVisibleItems[0].id);
  }, [activeTab, allowedTabIds, allVisibleItems, setActiveTab]);

  const handleTabSelection = (tabId) => {
    if (typeof setActiveTab !== 'function' || !allowedTabIds.has(tabId)) return;
    setActiveTab(tabId);
  };

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setLogoutError('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if (typeof sys?.setCurrentUser === 'function') sys.setCurrentUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      setLogoutError(error?.message || 'Unable to sign out. Please try again.');
    } finally { setIsSigningOut(false); }
  };

  return (
    <aside className={`hidden h-screen shrink-0 flex-col bg-[#1f252d] text-white transition-[width] duration-200 print:hidden md:flex ${collapsed ? 'w-[68px]' : 'w-[252px]'}`}>
      <SidebarContent
        currentUser={currentUser}
        activeTab={activeTab}
        visibleGroups={visibleGroups}
        visibleAdminItems={visibleAdminItems}
        allVisibleItems={allVisibleItems}
        allowedTabIds={allowedTabIds}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        isSigningOut={isSigningOut}
        logoutError={logoutError}
        onTabSelection={handleTabSelection}
        onLogout={handleLogout}
      />
    </aside>
  );
}
