import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
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
  Shield,
  Truck,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

/**
 * Checks whether a logged-in user has a particular permission.
 *
 * Administrators and users with the "*" permission receive access
 * to every module.
 */
export function hasPermission(user, permission) {
  if (!user || user.is_active === false) {
    return false;
  }

  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : [];

  return (
    user.role === 'admin' ||
    permissions.includes('*') ||
    permissions.includes(permission)
  );
}

/**
 * Navigation configuration.
 *
 * Each tab is linked to a specific permission. Change the permission
 * names here only when your Supabase permission values use different
 * names.
 */
const NAVIGATION_ITEMS = [
  {
    id: 'dashboard',
    label: 'Overview',
    icon: LayoutDashboard,
    permission: 'dashboard.read',
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    permission: 'customers.read',
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    icon: Truck,
    permission: 'suppliers.read',
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: FileText,
    permission: 'invoices.read',
  },
  {
    id: 'billing',
    label: 'Statements',
    icon: Receipt,
    permission: 'billing.read',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    permission: 'inventory.read',
  },
  {
    id: 'employees',
    label: 'Employees',
    icon: Contact2,
    permission: 'employees.read',
  },
  {
    id: 'picking',
    label: 'Pick List',
    icon: ClipboardList,
    permission: 'picking.read',
  },
  {
    id: 'logistics',
    label: 'Delivery Map',
    icon: Navigation,
    permission: 'logistics.read',
  },
  {
    id: 'gst',
    label: 'GST Ledger',
    icon: Percent,
    permission: 'gst.read',
  },
];

const ADMIN_NAVIGATION_ITEMS = [
  {
    id: 'team',
    label: 'Team Access',
    icon: Shield,
    permission: 'users.manage',
  },
];

function NavButton({
  id,
  icon: Icon,
  label,
  activeTab,
  onSelect,
}) {
  const active = activeTab === id;

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={active ? 'page' : undefined}
      className={`mb-1 flex w-full items-center space-x-3 rounded-2xl px-4 py-3 text-left transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
          : 'text-gray-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon
        size={18}
        className="shrink-0"
      />

      <span className="truncate text-sm font-bold">
        {label}
      </span>
    </button>
  );
}

function formatRole(role) {
  const value = String(role || 'user')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!value) {
    return 'User';
  }

  return value.replace(/\b\w/g, (character) =>
    character.toUpperCase()
  );
}

export function Sidebar({
  sys,
  activeTab,
  setActiveTab,
}) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const currentUser = sys?.currentUser || null;

  const visibleNavigationItems = useMemo(
    () =>
      NAVIGATION_ITEMS.filter((item) =>
        hasPermission(currentUser, item.permission)
      ),
    [currentUser]
  );

  const visibleAdminItems = useMemo(
    () =>
      ADMIN_NAVIGATION_ITEMS.filter((item) =>
        hasPermission(currentUser, item.permission)
      ),
    [currentUser]
  );

  const allVisibleItems = useMemo(
    () => [
      ...visibleNavigationItems,
      ...visibleAdminItems,
    ],
    [visibleNavigationItems, visibleAdminItems]
  );

  const allowedTabIds = useMemo(
    () => new Set(allVisibleItems.map((item) => item.id)),
    [allVisibleItems]
  );

  /**
   * If a user loses permission for the currently selected tab,
   * move them to the first module they are allowed to access.
   */
  useEffect(() => {
    if (
      typeof setActiveTab !== 'function' ||
      allVisibleItems.length === 0
    ) {
      return;
    }

    if (!allowedTabIds.has(activeTab)) {
      setActiveTab(allVisibleItems[0].id);
    }
  }, [
    activeTab,
    allowedTabIds,
    allVisibleItems,
    setActiveTab,
  ]);

  const handleTabSelection = (tabId) => {
    if (
      typeof setActiveTab !== 'function' ||
      !allowedTabIds.has(tabId)
    ) {
      return;
    }

    setActiveTab(tabId);
  };

  const handleLogout = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setLogoutError('');

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      if (typeof sys?.setCurrentUser === 'function') {
        sys.setCurrentUser(null);
      }
    } catch (error) {
      console.error('Logout failed:', error);

      setLogoutError(
        error?.message ||
          'Unable to sign out. Please try again.'
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 text-white print:hidden md:flex">
      <div className="border-b border-slate-800 px-8 py-7 text-center">
        <p className="text-xl font-black tracking-tighter">
          THREE LEAVES
        </p>

        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          ERP Workspace
        </p>
      </div>

      <nav
        className="mt-4 flex-1 overflow-y-auto p-4"
        aria-label="Main navigation"
      >
        {visibleNavigationItems.length > 0 ? (
          visibleNavigationItems.map((item) => (
            <NavButton
              key={item.id}
              id={item.id}
              icon={item.icon}
              label={item.label}
              activeTab={activeTab}
              onSelect={handleTabSelection}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="text-xs font-black uppercase tracking-wider">
                  No module access
                </p>

                <p className="mt-1 text-xs leading-5 text-amber-200/80">
                  Contact an administrator to assign permissions.
                </p>
              </div>
            </div>
          </div>
        )}

        {visibleAdminItems.length > 0 && (
          <div className="mt-8 border-t border-slate-800 pt-4">
            <p className="mb-3 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
              Administration
            </p>

            {visibleAdminItems.map((item) => (
              <NavButton
                key={item.id}
                id={item.id}
                icon={item.icon}
                label={item.label}
                activeTab={activeTab}
                onSelect={handleTabSelection}
              />
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-slate-800 bg-slate-950 p-4">
        {logoutError && (
          <div
            role="alert"
            className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-300"
          >
            {logoutError}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-blue-400">
              {currentUser?.name ||
                currentUser?.username ||
                'ERP User'}
            </p>

            <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {formatRole(currentUser?.role)}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSigningOut ? (
              <Loader2
                size={18}
                className="animate-spin"
              />
            ) : (
              <LogOut size={18} />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
