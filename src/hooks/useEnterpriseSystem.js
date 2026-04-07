import { useState } from 'react';
import {
  INITIAL_CUSTOMERS,
  INITIAL_GST,
  INITIAL_INVENTORY,
  INITIAL_SUPPLIERS,
  buildDemoInvoices,
} from '../data/demoData';

export function useEnterpriseSystem() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([
    { id: 'u1', username: 'admin', password: 'admin123', role: 'admin', name: 'System Admin', permissions: [] },
    { id: 'u2', username: 'staff', password: 'staff123', role: 'employee', name: 'Front Desk', permissions: ['create_invoices', 'manage_customers', 'manage_billing'] },
  ]);
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [suppliers, setSuppliers] = useState(INITIAL_SUPPLIERS);
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [invoices, setInvoices] = useState(buildDemoInvoices);
  const [gstRecords, setGstRecords] = useState(INITIAL_GST);

  const hasPerm = (permissionId) =>
    currentUser?.role === 'admin' || currentUser?.permissions.includes(permissionId);

  const getApplicablePrice = (productId, customerId) => {
    const product = inventory.find((item) => item.id === productId);
    if (!product) {
      return 0;
    }

    if (customerId && product.customerPrices?.[customerId] !== undefined) {
      return product.customerPrices[customerId];
    }

    return product.price;
  };

  return {
    currentUser,
    setCurrentUser,
    users,
    setUsers,
    customers,
    setCustomers,
    suppliers,
    setSuppliers,
    inventory,
    setInventory,
    invoices,
    setInvoices,
    gstRecords,
    setGstRecords,
    hasPerm,
    getApplicablePrice,
  };
}
