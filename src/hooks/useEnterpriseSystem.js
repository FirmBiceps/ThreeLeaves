import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase using Netlify / Cloudflare environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export function useEnterpriseSystem() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [gstRecords, setGstRecords] = useState([]);

  // Keep the database table names in one place.
  const TABLES = {
    users: 'users',
    customers: 'customers',
    suppliers: 'suppliers',

    // IMPORTANT:
    // The ERP reads inventory from product_list, so it must
    // also write inventory back to product_list.
    inventory: 'product_list',

    invoices: 'invoices',
    gstRecords: 'gst_records',
  };

  // =========================================================
  // 1. LOAD DATA FROM SUPABASE
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    const fetchAllData = async () => {
      setLoading(true);

      try {
        const results = await Promise.all([
          supabase.from(TABLES.users).select('*'),
          supabase.from(TABLES.customers).select('*'),
          supabase.from(TABLES.suppliers).select('*'),
          supabase.from(TABLES.inventory).select('*'),
          supabase.from(TABLES.invoices).select('*'),
          supabase.from(TABLES.gstRecords).select('*'),
        ]);

        const names = [
          'users',
          'customers',
          'suppliers',
          'product_list',
          'invoices',
          'gst_records',
        ];

        const setters = [
          setUsers,
          setCustomers,
          setSuppliers,
          setInventory,
          setInvoices,
          setGstRecords,
        ];

        results.forEach((result, index) => {
          if (result.error) {
            console.error(
              `Failed to load ${names[index]}:`,
              result.error.message
            );
            return;
          }

          if (!cancelled) {
            setters[index](
              Array.isArray(result.data)
                ? result.data
                : []
            );
          }
        });
      } catch (error) {
        console.error(
          'Error fetching ERP data from Supabase:',
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchAllData();

    return () => {
      cancelled = true;
    };
  }, []);

  // =========================================================
  // 2. GENERIC SUPABASE UPSERT
  // =========================================================

  const syncToSupabase = async (table, newData) => {
    try {
      if (!Array.isArray(newData)) {
        console.error(
          `Refusing to sync ${table}: expected an array.`
        );

        return false;
      }

      if (newData.length === 0) {
        return true;
      }

      const { error } = await supabase
        .from(table)
        .upsert(newData, {
          onConflict: 'id',
        });

      if (error) {
        console.error(
          `Error saving to ${table}:`,
          error.message
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error(
        `Supabase sync error (${table}):`,
        error
      );

      return false;
    }
  };

  // =========================================================
  // 3. DELETE RECORD
  // =========================================================

  const deleteRecord = async (table, id) => {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) {
        console.error(
          `Error deleting from ${table}:`,
          error.message
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error(
        'Supabase delete error:',
        error
      );

      return false;
    }
  };

  // =========================================================
  // 4. USERS
  // =========================================================

  const handleSetUsers = (value) => {
    setUsers(value);

    return syncToSupabase(
      TABLES.users,
      value
    );
  };

  // =========================================================
  // 5. CUSTOMERS
  // =========================================================

  const handleSetCustomers = (value) => {
    setCustomers(value);

    return syncToSupabase(
      TABLES.customers,
      value
    );
  };

  // =========================================================
  // 6. SUPPLIERS
  // =========================================================

  const handleSetSuppliers = (value) => {
    setSuppliers(value);

    return syncToSupabase(
      TABLES.suppliers,
      value
    );
  };

  // =========================================================
  // 7. INVENTORY
  // =========================================================
  //
  // IMPORTANT FIX:
  //
  // Previously the application READ from:
  //
  //     product_list
  //
  // but SAVED to:
  //
  //     inventory
  //
  // That means the application could display one table
  // while writing changes somewhere else.
  //
  // Both operations now consistently use product_list.
  // =========================================================

  const handleSetInventory = (value) => {
    setInventory(value);

    return syncToSupabase(
      TABLES.inventory,
      value
    );
  };

  // =========================================================
  // 8. INVOICES
  // =========================================================

  const handleSetInvoices = (value) => {
    setInvoices(value);

    return syncToSupabase(
      TABLES.invoices,
      value
    );
  };

  // =========================================================
  // 9. GST RECORDS
  // =========================================================

  const handleSetGstRecords = (value) => {
    setGstRecords(value);

    return syncToSupabase(
      TABLES.gstRecords,
      value
    );
  };

  // =========================================================
  // 10. PERMISSIONS
  // =========================================================

  const hasPerm = (permId) =>
    currentUser?.role === 'admin' ||
    currentUser?.permissions?.includes(permId);

  // =========================================================
  // 11. CUSTOMER-SPECIFIC PRODUCT PRICE
  // =========================================================

  const getApplicablePrice = (
    productId,
    customerId
  ) => {
    const product = inventory.find(
      (item) => item.id === productId
    );

    if (!product) {
      return 0;
    }

    return (
      customerId &&
      product.customerPrices?.[customerId] !== undefined
    )
      ? product.customerPrices[customerId]
      : product.price;
  };

  // =========================================================
  // RETURN ERP SYSTEM
  // =========================================================

  return {
    loading,

    currentUser,
    setCurrentUser,

    users,
    setUsers: handleSetUsers,

    customers,
    setCustomers: handleSetCustomers,

    suppliers,
    setSuppliers: handleSetSuppliers,

    inventory,
    setInventory: handleSetInventory,

    invoices,
    setInvoices: handleSetInvoices,

    gstRecords,
    setGstRecords: handleSetGstRecords,

    hasPerm,
    getApplicablePrice,

    deleteRecord,
  };
}
