import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
  MapPin,
  Phone,
  Plus,
  TrendingDown,
  TrendingUp,
  User,
  Tag,
  Trash2,
  Save,
  Edit,
  Search,
  Filter
} from 'lucide-react';
import { EntityModal } from '../../components/shared/EntityModal';
import { formatMoney, formatMoneyWhole } from '../../utils/format';
import { UNIT_OPTIONS } from '../../data/company';

const STATUS_STYLES = {
  active: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' },
  cooling: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Cooling' },
  'at-risk': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'At Risk' },
  churned: { bg: 'bg-red-100', text: 'text-red-700', label: 'Churned' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactive' },
};

const EMPTY_CUSTOMER = {
  name: '',
  contactPerson: '',
  contactNumber: '',
  address: '',
  region: 'North',
  custom_prices: {}, 
};

// ==========================================
// SEARCHABLE PRODUCT DROPDOWN
// ==========================================
function ProductSearchSelect({ value, inventory, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // BULLETPROOF: Ensure inventory is safely treated as an array
  const safeInventory = Array.isArray(inventory) ? inventory : [];

  const selectedProduct = safeInventory.find((entry) => entry.id === value);
  const displayName = selectedProduct ? (selectedProduct.Name || selectedProduct.name || selectedProduct.Items) : '';

  const filteredInventory = safeInventory.filter((item) => {
    const itemName = (item.Name || item.name || item.Items || '').toLowerCase();
    return itemName.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="relative w-full text-left flex-1" ref={dropdownRef}>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setSearchTerm(''); 
          }}
          className={`w-full text-left rounded-lg border border-slate-200 p-2 text-sm font-bold transition-colors focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
            displayName ? 'text-slate-900 bg-white' : 'text-slate-400 bg-white'
          }`}
        >
          {displayName || '-- Search Product --'}
        </button>
      ) : (
        <div className="absolute z-[5000] top-0 left-0 w-full min-w-[300px] bg-white border border-slate-300 rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center p-2 border-b border-slate-200 bg-slate-50">
            <Search size={14} className="text-slate-400 ml-1 mr-2 shrink-0" />
            <input
              autoFocus
              type="text"
              className="w-full bg-transparent border-none text-xs font-bold text-slate-800 p-1 focus:ring-0 placeholder:text-slate-400 outline-none"
              placeholder="Type to search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => {
                const itemName = item.Name || item.name || item.Items || 'Unnamed Product';
                const defaultPrice = formatMoney(item.Price || item.unitPrice || item['Unit Price (SG)'] || 0);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 border-b border-slate-100 last:border-0 transition-colors flex justify-between"
                    onClick={() => {
                      onChange(item.id);
                      setIsOpen(false);
                    }}
                  >
                    <span>{itemName}</span>
                    <span className="text-slate-400 font-normal">Def: ${defaultPrice}</span>
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-400 font-medium">
                No products found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerFormModal({ initialValue, onClose, onSave }) {
  const [form, setForm] = useState(initialValue);

  return (
    <EntityModal onClose={onClose} onSave={() => onSave(form)} title="Customer Modification">
      <div className="space-y-4">
        <input
          className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Company Name"
          value={form.name}
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            className="w-full rounded-xl border border-gray-200 p-3 text-sm"
            onChange={(event) =>
              setForm((current) => ({ ...current, contactPerson: event.target.value }))
            }
            placeholder="Contact Person"
            value={form.contactPerson}
          />
          <input
            className="w-full rounded-xl border border-gray-200 p-3 text-sm"
            onChange={(event) =>
              setForm((current) => ({ ...current, contactNumber: event.target.value }))
            }
            placeholder="Phone Number"
            value={form.contactNumber}
          />
        </div>
        <select
          className="w-full rounded-xl border border-gray-200 p-3 text-sm"
          onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))}
          value={form.region}
        >
          <option value="North">North Sector</option>
          <option value="West">West Sector</option>
          <option value="East">East Sector</option>
          <option value="South">South Sector</option>
          <option value="Central">Central Sector</option>
        </select>
        <textarea
          className="w-full rounded-xl border border-gray-200 p-3 text-sm"
          onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
          placeholder="Full Address"
          rows={3}
          value={form.address}
        />
      </div>
    </EntityModal>
  );
}

export function CustomerModule({ sys }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(EMPTY_CUSTOMER);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All');

  const [pricingItem, setPricingItem] = useState('');
  const [pricingUnit, setPricingUnit] = useState('箱');
  const [pricingValue, setPricingValue] = useState('');

  // BULLETPROOF: Safely extract arrays so the app never crashes on load
  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];
  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];

  const analytics = useMemo(() => {
    const now = new Date();

    return safeCustomers
      .map((customer) => {
        const customerInvoices = safeInvoices
          .filter((invoice) => invoice.customerId === customer.id)
          .sort((left, right) => new Date(left.date || 0) - new Date(right.date || 0));

        if (customerInvoices.length === 0) {
          return {
            customer,
            totalRevenue: 0,
            orderCount: 0,
            avgValue: 0,
            daysSinceLast: 999,
            status: 'inactive',
            trend: 'flat',
            topItems: [],
          };
        }

        const totalRevenue = customerInvoices.reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
        const avgValue = totalRevenue / customerInvoices.length;
        const lastDate = new Date(customerInvoices[customerInvoices.length - 1].date);
        const daysSinceLast = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

        let avgFrequency = null;
        if (customerInvoices.length > 1) {
          const gaps = [];
          for (let index = 1; index < customerInvoices.length; index += 1) {
            gaps.push(
              (new Date(customerInvoices[index].date) - new Date(customerInvoices[index - 1].date)) /
                (1000 * 60 * 60 * 24),
            );
          }
          avgFrequency = Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
        }

        const itemCounts = {};
        customerInvoices.forEach((invoice) => {
          (invoice.items || []).forEach((item) => {
            const product = safeInventory.find((entry) => entry.id === item.itemId);
            const name = product?.Name || product?.name || product?.Items || item.itemId || 'Unknown';
            itemCounts[name] = (itemCounts[name] || 0) + Number(item.qty || item.quantity || 0);
          });
        });

        const topItems = Object.entries(itemCounts)
          .sort((left, right) => right[1] - left[1])
          .slice(0, 3)
          .map(([name, qty]) => ({ name, qty }));

        let status = 'active';
        if (daysSinceLast > 90) {
          status = 'churned';
        } else if (daysSinceLast > 45) {
          status = 'at-risk';
        } else if (daysSinceLast > 21 && avgFrequency && daysSinceLast > avgFrequency * 1.5) {
          status = 'cooling';
        }

        let trend = 'flat';
        if (customerInvoices.length >= 4) {
          const recent = customerInvoices.slice(-2).reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
          const prior = customerInvoices.slice(-4, -2).reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
          if (recent > prior * 1.2) {
            trend = 'growing';
          } else if (recent < prior * 0.8) {
            trend = 'declining';
          }
        }

        return {
          customer,
          totalRevenue,
          orderCount: customerInvoices.length,
          avgValue,
          daysSinceLast,
          avgFrequency,
          status,
          trend,
          topItems,
          lastOrderDate: customerInvoices[customerInvoices.length - 1].date,
        };
      })
      .sort((left, right) => right.totalRevenue - left.totalRevenue);
  }, [safeCustomers, safeInvoices, safeInventory]);

  const displayList = useMemo(() => {
    return analytics.filter((entry) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (entry.customer.name || '').toLowerCase().includes(searchLower) ||
        (entry.customer.contactPerson || '').toLowerCase().includes(searchLower);

      let matchesStatus = true;
      if (statusFilter === 'Stagnant') {
        matchesStatus = ['at-risk', 'churned', 'cooling'].includes(entry.status);
      } else if (statusFilter === 'Active') {
        matchesStatus = entry.status === 'active';
      } else if (statusFilter === 'Cooling') {
        matchesStatus = entry.status === 'cooling';
      } else if (statusFilter === 'At Risk') {
        matchesStatus = entry.status === 'at-risk';
      } else if (statusFilter === 'Churned') {
        matchesStatus = entry.status === 'churned';
      }

      const matchesRegion = regionFilter === 'All' ? true : entry.customer.region === regionFilter;

      return matchesSearch && matchesStatus && matchesRegion;
    });
  }, [analytics, searchTerm, statusFilter, regionFilter]);

  const stagnantCount = analytics.filter((entry) =>
    ['at-risk', 'churned', 'cooling'].includes(entry.status),
  ).length;

  const handleSave = (form) => {
    if (form.id) {
      sys.setCustomers(safeCustomers.map((c) => (c.id === form.id ? { ...c, ...form } : c)));
      if (selectedCustomer && selectedCustomer.customer.id === form.id) {
        setSelectedCustomer({ ...selectedCustomer, customer: { ...selectedCustomer.customer, ...form }});
      }
    } else {
      sys.setCustomers([...safeCustomers, { ...form, id: `c${Date.now()}`, custom_prices: {} }]);
    }
    setIsOpen(false);
  };

  const handleAddPricingRule = () => {
    if (!pricingItem || !pricingValue || !pricingUnit) return;
    
    const updatedCustomer = { ...selectedCustomer.customer };
    if (!updatedCustomer.custom_prices) {
      updatedCustomer.custom_prices = {};
    }
    
    const ruleKey = `${pricingItem}|${pricingUnit}`;
    updatedCustomer.custom_prices[ruleKey] = Number(pricingValue);
    
    sys.setCustomers(safeCustomers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    
    setSelectedCustomer({ ...selectedCustomer, customer: updatedCustomer });
    setPricingItem('');
    setPricingValue('');
  };

  const handleRemovePricingRule = (ruleKey) => {
    const updatedCustomer = { ...selectedCustomer.customer };
    if (updatedCustomer.custom_prices) {
      delete updatedCustomer.custom_prices[ruleKey];
    }
    
    sys.setCustomers(safeCustomers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    setSelectedCustomer({ ...selectedCustomer, customer: updatedCustomer });
  };

  if (selectedCustomer) {
    const statusStyle = STATUS_STYLES[selectedCustomer.status] || STATUS_STYLES.inactive;
    const customPrices = selectedCustomer.customer.custom_prices || {};

    return (
      <div className="space-y-6">
        <button
          className="flex items-center text-sm font-bold text-gray-500 hover:text-gray-800"
          onClick={() => setSelectedCustomer(null)}
          type="button"
        >
          <ArrowRight className="mr-2 rotate-180" size={16} /> Back to Customer Rankings
        </button>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            
            {/* MAIN PROFILE CARD */}
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <div className="flex items-center">
                    <h2 className="text-2xl font-black text-slate-900">{selectedCustomer.customer.name}</h2>
                    {sys.hasPerm('manage_customers') && (
                      <button
                        onClick={() => {
                          setEditingCustomer(selectedCustomer.customer);
                          setIsOpen(true);
                        }}
                        className="ml-4 flex items-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                      >
                        <Edit size={14} className="mr-1" /> Edit Details
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-500">
                    {selectedCustomer.customer.address} ({selectedCustomer.customer.region})
                  </p>
                  <div className="mt-4 flex space-x-3">
                    <span
                      className={`${statusStyle.bg} ${statusStyle.text} rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest`}
                    >
                      {statusStyle.label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                      {selectedCustomer.trend === 'growing'
                        ? 'Growing'
                        : selectedCustomer.trend === 'declining'
                          ? 'Declining'
                          : 'Stable'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Lifetime Revenue
                  </p>
                  <p className="font-mono text-4xl font-black tracking-tighter text-blue-600">
                    ${formatMoneyWhole(selectedCustomer.totalRevenue)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-6">
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Orders
                  </p>
                  <p className="text-xl font-bold">{selectedCustomer.orderCount}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Avg Value
                  </p>
                  <p className="font-mono text-xl font-bold">${formatMoneyWhole(selectedCustomer.avgValue)}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Last Order
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      selectedCustomer.daysSinceLast > 60 ? 'text-red-500' : 'text-slate-800'
                    }`}
                  >
                    {selectedCustomer.daysSinceLast === 999
                      ? 'Never'
                      : `${selectedCustomer.daysSinceLast} days ago`}
                  </p>
                </div>
              </div>
            </div>

            {/* SPECIAL PRICING AGREEMENTS CARD */}
            <div className="rounded-2xl border border-blue-200 bg-white p-8 shadow-sm">
              <h3 className="mb-6 flex items-center text-sm font-black uppercase tracking-widest text-blue-800">
                <Tag className="mr-2 text-blue-500" size={18} /> Special Pricing Agreements
              </h3>
              
              <div className="flex space-x-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 items-center">
                <ProductSearchSelect
                  value={pricingItem}
                  inventory={safeInventory}
                  onChange={(selectedId) => {
                    setPricingItem(selectedId);
                    const product = safeInventory.find((entry) => entry.id === selectedId);
                    if (product) {
                      setPricingUnit(product.Unit || product.unit || '箱');
                    }
                  }}
                />
                
                <select
                  className="w-24 rounded-lg border border-slate-200 p-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shrink-0"
                  value={pricingUnit}
                  onChange={(e) => setPricingUnit(e.target.value)}
                >
                  {UNIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  {pricingUnit && !UNIT_OPTIONS.find(opt => opt.value === pricingUnit) && (
                    <option value={pricingUnit}>{pricingUnit}</option>
                  )}
                </select>

                <div className="relative w-32 shrink-0">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-200 p-2 pl-7 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={pricingValue}
                    onChange={(e) => setPricingValue(e.target.value)}
                  />
                </div>
                
                <button
                  onClick={handleAddPricingRule}
                  disabled={!pricingItem || !pricingValue}
                  className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Save className="mr-2" size={14} /> Lock
                </button>
              </div>

              <div className="space-y-3">
                {Object.keys(customPrices).length === 0 ? (
                  <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active pricing rules</p>
                    <p className="text-xs text-slate-400 mt-1">This customer will be charged standard catalog prices.</p>
                  </div>
                ) : (
                  Object.entries(customPrices).map(([ruleKey, price]) => {
                    const [itemId, unit] = ruleKey.includes('|') ? ruleKey.split('|') : [ruleKey, '箱'];
                    const product = safeInventory.find(i => i.id === itemId);
                    
                    const defaultPrice = product?.Price || product?.unitPrice || product?.['Unit Price (SG)'] || 0;
                    const productName = product?.Name || product?.name || product?.Items || 'Unknown Product';
                    
                    return (
                      <div key={ruleKey} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-200 transition-colors">
                        <div>
                          <p className="text-sm font-bold text-slate-800 flex items-center">
                            {productName} 
                            <span className="ml-3 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-black border border-blue-100">{unit}</span>
                          </p>
                          <p className="text-xs font-medium text-slate-500 mt-1">
                            Catalog Default: <span className="line-through">${formatMoney(defaultPrice)}</span>
                          </p>
                        </div>
                        <div className="flex items-center space-x-6">
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Locked Rate</p>
                            <p className="text-lg font-black text-slate-900">${formatMoney(price)}</p>
                          </div>
                          <button 
                            onClick={() => handleRemovePricingRule(ruleKey)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove Pricing Rule"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* BEHAVIORAL ANALYSIS CARD */}
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-700">
                Behavioral Analysis & Actions
              </h3>
              <div className="space-y-4">
                {selectedCustomer.status === 'churned' && (
                  <div className="flex rounded-xl border border-red-100 bg-red-50 p-4">
                    <AlertTriangle className="mr-4 shrink-0 text-red-500" />
                    <div>
                      <h4 className="text-sm font-bold text-red-800">Customer Churned</h4>
                      <p className="mt-1 text-xs text-red-600">
                        No orders in over 90 days. Recommended action: executive reach-out and a strong
                        win-back offer.
                      </p>
                    </div>
                  </div>
                )}
                {selectedCustomer.status === 'at-risk' && (
                  <div className="flex rounded-xl border border-orange-100 bg-orange-50 p-4">
                    <Activity className="mr-4 shrink-0 text-orange-500" />
                    <div>
                      <h4 className="text-sm font-bold text-orange-800">High Risk of Churn</h4>
                      <p className="mt-1 text-xs text-orange-600">
                        Ordering has slowed significantly. Recommended action: check in immediately and
                        offer service support.
                      </p>
                    </div>
                  </div>
                )}
                {selectedCustomer.status === 'cooling' && (
                  <div className="flex rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <TrendingDown className="mr-4 shrink-0 text-amber-500" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-800">Cooling Engagement</h4>
                      <p className="mt-1 text-xs text-amber-600">
                        Typical order cycle is {selectedCustomer.avgFrequency} days, but it has been{' '}
                        {selectedCustomer.daysSinceLast} days. A follow-up call is recommended.
                      </p>
                    </div>
                  </div>
                )}
                {selectedCustomer.trend === 'growing' && selectedCustomer.status === 'active' && (
                  <div className="flex rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <TrendingUp className="mr-4 shrink-0 text-emerald-500" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-800">Growth Account</h4>
                      <p className="mt-1 text-xs text-emerald-600">
                        Order volume is rising. This account is a good candidate for tiered pricing or
                        contract locking.
                      </p>
                    </div>
                  </div>
                )}
                {selectedCustomer.avgFrequency && (
                  <div className="flex rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <Clock className="mr-4 shrink-0 text-blue-500" />
                    <div>
                      <h4 className="text-sm font-bold text-blue-800">Ordering Cadence</h4>
                      <p className="mt-1 text-xs text-blue-600">
                        Typically orders every <b>{selectedCustomer.avgFrequency} days</b>. Next expected
                        order is roughly{' '}
                        {Math.max(0, selectedCustomer.avgFrequency - selectedCustomer.daysSinceLast)} days
                        from now.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Typically Orders
              </h3>
              {selectedCustomer.topItems.length > 0 ? (
                <ul className="space-y-3">
                  {selectedCustomer.topItems.map((item) => (
                    <li
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"
                      key={item.name}
                    >
                      <span className="mr-2 truncate text-sm font-bold text-slate-700">{item.name}</span>
                      <span className="shrink-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-black text-blue-600 shadow-sm">
                        {item.qty} units
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-medium text-gray-400">No item data found.</p>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Contact File
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex">
                  <User className="mr-3 shrink-0 text-gray-400" size={18} />
                  <span className="font-bold">
                    {selectedCustomer.customer.contactPerson || 'Not Provided'}
                  </span>
                </div>
                <div className="flex">
                  <Phone className="mr-3 shrink-0 text-gray-400" size={18} />
                  <span className="font-bold">
                    {selectedCustomer.customer.contactNumber || 'Not Provided'}
                  </span>
                </div>
                <div className="flex">
                  <MapPin className="mr-3 shrink-0 text-gray-400" size={18} />
                  <span className="font-medium text-gray-600">{selectedCustomer.customer.address}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      
      {/* HEADER */}
      <div className="flex shrink-0 items-center justify-between rounded-t-xl border-b border-gray-100 bg-gray-50 p-5">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">
            Customer Intelligence
          </h3>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Revenue rankings, behavioral analytics, and account management.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {sys.hasPerm('manage_customers') && (
            <button
              className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
              onClick={() => {
                setEditingCustomer(EMPTY_CUSTOMER);
                setIsOpen(true);
              }}
              type="button"
            >
              <Plus className="mr-2" size={16} /> New Account
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 bg-white p-4 gap-4 shadow-sm relative z-20">
        
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 w-full sm:w-96 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all">
          <Search className="text-slate-400 mr-2 shrink-0" size={18} />
          <input
            type="text"
            placeholder="Search by entity or contact..."
            className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold outline-none placeholder:text-slate-400 placeholder:font-normal"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex items-center">
            <Filter size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            <select
              className="w-full sm:w-auto rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm cursor-pointer appearance-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Health Statuses</option>
              <option value="Active">Healthy (Active)</option>
              <option value="Stagnant">Needs Attention (Stagnant)</option>
              <option value="Cooling">↳ Cooling</option>
              <option value="At Risk">↳ At Risk</option>
              <option value="Churned">↳ Churned</option>
            </select>
          </div>

          <div className="relative flex items-center">
            <MapPin size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            <select
              className="w-full sm:w-auto rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm cursor-pointer appearance-none"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              <option value="All">All Regions</option>
              <option value="North">North Sector</option>
              <option value="South">South Sector</option>
              <option value="East">East Sector</option>
              <option value="West">West Sector</option>
              <option value="Central">Central Sector</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative z-10">
        <table className="w-full text-left font-medium">
          <thead className="sticky top-0 z-10 border-b bg-white text-[10px] font-black uppercase text-gray-400 shadow-sm">
            <tr>
              <th className="w-16 p-4 pl-6 text-center">Rank</th>
              <th className="p-4">Entity</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Trend</th>
              <th className="p-4 text-right">Lifetime Rev.</th>
              <th className="p-4 text-center">Last Order</th>
              <th className="p-4 pr-6 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {displayList.map((entry, index) => {
              const statusStyle = STATUS_STYLES[entry.status] || STATUS_STYLES.inactive;
              const TrendIcon =
                entry.trend === 'growing'
                  ? TrendingUp
                  : entry.trend === 'declining'
                    ? TrendingDown
                    : ArrowRight;
              const trendColor =
                entry.trend === 'growing'
                  ? 'text-emerald-500'
                  : entry.trend === 'declining'
                    ? 'text-red-500'
                    : 'text-gray-400';

              return (
                <tr
                  className="cursor-pointer transition-colors hover:bg-blue-50/30"
                  key={entry.customer.id}
                  onClick={() => setSelectedCustomer(entry)}
                >
                  <td className="p-4 pl-6 text-center">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                        index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      #{index + 1}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-900">{entry.customer.name || 'Unknown'}</div>
                    <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {entry.customer.region || '-'} Sector
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`${statusStyle.bg} ${statusStyle.text} rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest`}
                    >
                      {statusStyle.label}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <TrendIcon className={`inline-block ${trendColor}`} size={18} />
                  </td>
                  <td className="p-4 text-right font-mono text-lg font-black tracking-tighter text-slate-900">
                    ${formatMoneyWhole(entry.totalRevenue)}
                  </td>
                  <td className="p-4 text-center text-xs font-bold text-slate-500">
                    {entry.daysSinceLast === 999 ? '-' : `${entry.daysSinceLast}d ago`}
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <span className="inline-flex items-center rounded-lg bg-blue-50 p-2 text-[10px] font-black uppercase tracking-widest text-blue-600 transition-colors hover:bg-blue-100">
                      View <ArrowRight className="ml-1" size={12} />
                    </span>
                  </td>
                </tr>
              );
            })}
            {displayList.length === 0 && (
              <tr>
                <td className="p-12 text-center text-sm font-bold text-slate-400" colSpan="7">
                  No customers match your search and filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <CustomerFormModal
          initialValue={editingCustomer}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
