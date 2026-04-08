import {
  INITIAL_CUSTOMERS,
  INITIAL_GST,
  INITIAL_INVENTORY,
  INITIAL_SUPPLIERS,
  buildDemoInvoices,
} from './demoData';

export function createDefaultSystemData() {
  return {
    users: [
      {
        id: 'u1',
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        name: 'System Admin',
        permissions: [],
      },
      {
        id: 'u2',
        username: 'staff',
        password: 'staff123',
        role: 'employee',
        name: 'Front Desk',
        permissions: ['create_invoices', 'manage_customers', 'manage_billing'],
      },
    ],
    customers: INITIAL_CUSTOMERS,
    suppliers: INITIAL_SUPPLIERS,
    inventory: INITIAL_INVENTORY,
    invoices: buildDemoInvoices(),
    gstRecords: INITIAL_GST,
  };
}

export function normalizeSystemData(payload = {}) {
  const defaults = createDefaultSystemData();

  return {
    users: Array.isArray(payload.users) ? payload.users : defaults.users,
    customers: Array.isArray(payload.customers) ? payload.customers : defaults.customers,
    suppliers: Array.isArray(payload.suppliers) ? payload.suppliers : defaults.suppliers,
    inventory: Array.isArray(payload.inventory) ? payload.inventory : defaults.inventory,
    invoices: Array.isArray(payload.invoices) ? payload.invoices : defaults.invoices,
    gstRecords: Array.isArray(payload.gstRecords) ? payload.gstRecords : defaults.gstRecords,
  };
}
