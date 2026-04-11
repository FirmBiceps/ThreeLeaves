import { useEffect, useMemo, useState } from 'react';
import { createDefaultSystemData, normalizeSystemData } from '../data/defaultState';
import { loadAppState, saveAppState } from '../lib/appStateRepository';
import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export function useEnterpriseSystem() {
  const [currentUser, setCurrentUser] = useState(null);
  const [systemData, setSystemData] = useState(createDefaultSystemData);
  const [isHydrating, setIsHydrating] = useState(isSupabaseConfigured);
  const [storageMode, setStorageMode] = useState(isSupabaseConfigured ? 'supabase' : 'demo');
  const [lastSyncError, setLastSyncError] = useState('');

  useEffect(() => {
    let isCancelled = false;

    async function hydrate() {
      if (!isSupabaseConfigured) {
        setIsHydrating(false);
        return;
      }

      const { data, error } = await loadAppState();
      if (isCancelled) {
        return;
      }

      if (error) {
        setLastSyncError(error.message);
        setStorageMode('demo');
      } else if (data) {
        setSystemData(normalizeSystemData(data));
        setStorageMode('supabase');
      } else {
        setStorageMode('supabase');
      }

      setIsHydrating(false);
    }

    hydrate();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || isHydrating) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      const { error } = await saveAppState(systemData);
      if (error) {
        setLastSyncError(error.message);
      } else {
        setLastSyncError('');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [isHydrating, systemData]);

  const users = useMemo(() => systemData.users, [systemData.users]);
  const customers = useMemo(() => systemData.customers, [systemData.customers]);
  const suppliers = useMemo(() => systemData.suppliers, [systemData.suppliers]);
  const inventory = useMemo(() => systemData.inventory, [systemData.inventory]);
  const invoices = useMemo(() => systemData.invoices, [systemData.invoices]);
  const gstRecords = useMemo(() => systemData.gstRecords, [systemData.gstRecords]);

  const setUsers = (value) =>
    setSystemData((current) => ({
      ...current,
      users: typeof value === 'function' ? value(current.users) : value,
    }));
  const setCustomers = (value) =>
    setSystemData((current) => ({
      ...current,
      customers: typeof value === 'function' ? value(current.customers) : value,
    }));
  const setSuppliers = (value) =>
    setSystemData((current) => ({
      ...current,
      suppliers: typeof value === 'function' ? value(current.suppliers) : value,
    }));
  const setInventory = (value) =>
    setSystemData((current) => ({
      ...current,
      inventory: typeof value === 'function' ? value(current.inventory) : value,
    }));
  const setInvoices = (value) =>
    setSystemData((current) => ({
      ...current,
      invoices: typeof value === 'function' ? value(current.invoices) : value,
    }));
  const setGstRecords = (value) =>
    setSystemData((current) => ({
      ...current,
      gstRecords: typeof value === 'function' ? value(current.gstRecords) : value,
    }));

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
    isHydrating,
    storageMode,
    lastSyncError,
    hasPerm,
    getApplicablePrice,
  };
}
