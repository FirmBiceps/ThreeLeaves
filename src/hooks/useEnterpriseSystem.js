import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase using your Netlify Environment Variables
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

  // 1. Fetch all data from your new individual tables on load
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [resUsers, resCust, resSupp, resInv, resInvoices, resGst] = await Promise.all([
          supabase.from('users').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('suppliers').select('*'),
          supabase.from('product_list').select('*'),
          supabase.from('invoices').select('*'),
          supabase.from('gst_records').select('*')
        ]);

        if (resUsers.data) setUsers(resUsers.data);
        if (resCust.data) setCustomers(resCust.data);
        if (resSupp.data) setSuppliers(resSupp.data);
        if (resInv.data) setInventory(resInv.data);
        if (resInvoices.data) setInvoices(resInvoices.data);
        if (resGst.data) setGstRecords(resGst.data);
      } catch (error) {
        console.error("Error fetching data from Supabase:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // 2. Cloud Sync Function (Inserts or Updates data in the correct table)
  const syncToSupabase = async (table, newData) => {
    try {
      const { error } = await supabase.from(table).upsert(newData);
      if (error) console.error(`Error saving to ${table}:`, error);
    } catch (err) {
      console.error("Supabase sync error:", err);
    }
  };

  // 3. Handlers to update the UI instantly AND save to the correct cloud table
  const handleSetUsers = (v) => { setUsers(v); syncToSupabase('users', v); };
  const handleSetCustomers = (v) => { setCustomers(v); syncToSupabase('customers', v); };
  const handleSetSuppliers = (v) => { setSuppliers(v); syncToSupabase('suppliers', v); };
  const handleSetInventory = (v) => { setInventory(v); syncToSupabase('inventory', v); };
  const handleSetInvoices = (v) => { setInvoices(v); syncToSupabase('invoices', v); };
  const handleSetGstRecords = (v) => { setGstRecords(v); syncToSupabase('gst_records', v); };

  const hasPerm = (permId) => currentUser?.role === 'admin' || currentUser?.permissions?.includes(permId);
  
  const getApplicablePrice = (productId, customerId) => {
    const product = inventory.find(i => i.id === productId);
    if (!product) return 0;
    return (customerId && product.customerPrices?.[customerId] !== undefined) 
      ? product.customerPrices[customerId] : product.price;
  };

  return {
    loading, currentUser, setCurrentUser, 
    users, setUsers: handleSetUsers,
    customers, setCustomers: handleSetCustomers, 
    suppliers, setSuppliers: handleSetSuppliers,
    inventory, setInventory: handleSetInventory, 
    invoices, setInvoices: handleSetInvoices,
    gstRecords, setGstRecords: handleSetGstRecords,
    hasPerm, getApplicablePrice
  };
}
