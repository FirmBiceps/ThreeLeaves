import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Clock, MapPin, Phone, Plus, TrendingDown,
  TrendingUp, User, Tag, Trash2, Save, Edit, Search, Filter, Layers, X, Sparkles, UserPlus, UserMinus, Users as UsersIcon,
  Printer, FileText
} from 'lucide-react';
import { EntityModal } from '../../components/shared/EntityModal';
import { formatMoney, formatMoneyWhole } from '../../utils/format';
import { UNIT_OPTIONS } from '../../data/company';
import { supabase } from '../../lib/supabaseClient';

const STATUS_STYLES = {
  active: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' },
  cooling: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Cooling' },
  'at-risk': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'At Risk' },
  churned: { bg: 'bg-red-100', text: 'text-red-700', label: 'Churned' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactive' },
};

const EMPTY_CUSTOMER = {
  name: '', contactPerson: '', contactNumber: '', address: '', region: 'North',
  payment_terms: '30_days', pricing_group_id: '', custom_prices: {}, 
};

const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

// ==========================================
// COMPONENT: QUOTATION PDF GENERATOR
// ==========================================
function QuotationPreviewModal({ group, sys, onClose }) {
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  
  // Extract, map, and alphabetically sort the group's pricing rules
  const pricesList = Object.entries(group.prices || {}).map(([ruleKey, price]) => {
    const [itemId, unit] = ruleKey.includes('|') ? ruleKey.split('|') : [ruleKey, '箱'];
    const product = safeInventory.find(i => i.id === itemId);
    const productName = product?.Name || product?.name || product?.Items || 'Unknown Product';
    return { name: productName, unit, price };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

  return (
    <div className="fixed inset-0 z-[7000] overflow-y-auto bg-slate-950/90 print:static print:block print:bg-white print:p-0 print:backdrop-filter-none">
      <style type="text/css">
        {`
          @media print {
            @page { size: A4; margin: 0 !important; }
            html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body * { visibility: hidden !important; }
            #printable-quotation-wrapper, #printable-quotation-wrapper * { visibility: visible !important; }
            #printable-quotation-wrapper { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; min-height: 297mm !important; padding: 15mm 15mm !important; margin: 0 !important; background: white !important; backdrop-filter: none !important; box-sizing: border-box !important; display: flex !important; flex-direction: column !important;}
            *, html, body, div, p, span, h1, h2, h3, table, th, td { font-family: ${CJK_FONT} !important; }
            tr, td, th { page-break-inside: avoid; break-inside: avoid; }
          }
        `}
      </style>
      <div className="flex min-h-full flex-col items-center py-12 print:block print:py-0 print:m-0">
        
        <div className="w-full max-w-[210mm] shrink-0 bg-slate-900 px-8 py-4 flex justify-between items-center text-white rounded-t-2xl shadow-2xl print:hidden border-b-4 border-emerald-500">
          <div className="flex items-center">
            <FileText size={24} className="mr-3 text-emerald-400" />
            <div>
              <h2 className="text-sm font-black tracking-widest uppercase text-slate-200">Quotation Layout Check</h2>
              <p className="text-lg font-bold text-white leading-none mt-0.5">{group.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => window.print()} className="flex items-center text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl transition-colors shadow-lg"><Printer size={18} className="mr-2" /> Print PDF</button>
            <button onClick={onClose} className="hover:bg-slate-700 text-white p-2.5 rounded-full transition-colors ml-2 bg-slate-800"><X size={20} /></button>
          </div>
        </div>
        
        <div id="printable-quotation-wrapper" lang="zh" className="flex w-full max-w-[210mm] min-h-[297mm] flex-col bg-white py-[15mm] px-[15mm] text-black shadow-2xl rounded-b-2xl print:w-[210mm] print:h-[297mm] print:max-w-none print:rounded-none print:shadow-none box-border" style={{ fontFamily: CJK_FONT }}>
          
          <div className="flex flex-col w-full shrink-0 border-b-2 border-black pb-6 mb-6">
            <h1 className="font-black text-[22px] tracking-tight text-center mb-1" style={{ fontFamily: CJK_FONT }}>THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
            <h2 className="font-bold text-[18px] text-center mb-2" style={{ fontFamily: CJK_FONT }}>三叶（新加坡） 贸易公司</h2>
            <div className="text-center text-slate-600 font-bold text-[11px] leading-relaxed tracking-tight">
              <p>CO.REG NO.53033969B &nbsp;|&nbsp; GST REG NO. M90355440L</p>
              <p>280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
              <p>HP: 97578869 (Mr Ye) &nbsp;|&nbsp; HP: 91113505 (Min) &nbsp;|&nbsp; 3leaves.sg@gmail.com</p>
            </div>
          </div>

          <div className="flex justify-between items-end mb-6 shrink-0">
            <div>
              <h2 className="text-[28px] font-black tracking-[0.2em] leading-none mb-2">QUOTATION</h2>
              <h3 className="text-[14px] font-bold text-slate-600 uppercase tracking-widest">Group Pricing: {group.name}</h3>
            </div>
            <div className="text-right text-[14px] font-bold">
              <p className="text-slate-500 mb-1">DATE:</p>
              <p className="border-b border-black pb-0.5 min-w-[120px] inline-block text-center">{today}</p>
            </div>
          </div>

          <table className="w-full flex-grow border-2 border-black text-center text-[14px] mb-8" style={{ fontFamily: CJK_FONT }}>
            <thead className="border-b-2 border-black bg-slate-50">
              <tr className="font-bold text-slate-800">
                <th className="py-3 px-2 w-16 border-r border-black">NO.</th>
                <th className="py-3 px-4 text-left border-r border-black">DESCRIPTION (产品名称)</th>
                <th className="py-3 px-2 w-28 border-r border-black">UNIT (单位)</th>
                <th className="py-3 px-2 w-32">UNIT PRICE (单价)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {pricesList.map((item, idx) => (
                <tr key={idx} className="align-middle text-slate-900">
                  <td className="py-2.5 px-2 border-r border-black">{idx + 1}</td>
                  <td className="py-2.5 px-4 text-left border-r border-black font-bold">{item.name}</td>
                  <td className="py-2.5 px-2 border-r border-black">{item.unit}</td>
                  <td className="py-2.5 px-2 font-black">${formatMoney(item.price)}</td>
                </tr>
              ))}
              {pricesList.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-400 font-bold">No pricing rules defined for this group.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-auto pt-6 text-[12px] font-bold text-slate-600 shrink-0">
            <p className="mb-1 text-slate-800">Terms & Conditions:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>All prices quoted are in Singapore Dollars (SGD) and are subject to 9% GST.</li>
              <li>This quotation is valid for 30 days from the date of issue.</li>
              <li>Prices are strictly confidential and applicable only to assigned group members.</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENT: SEARCHABLE PRODUCT DROPDOWN
// ==========================================
function ProductSearchSelect({ value, inventory, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        <button type="button" onClick={() => { setIsOpen(true); setSearchTerm(''); }} className={`w-full text-left rounded-lg border border-slate-200 p-2 text-sm font-bold transition-colors focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${displayName ? 'text-slate-900 bg-white' : 'text-slate-400 bg-white'}`}>
          {displayName || '-- Search Product --'}
        </button>
      ) : (
        <div className="absolute z-[5000] top-0 left-0 w-full min-w-[300px] bg-white border border-slate-300 rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center p-2 border-b border-slate-200 bg-slate-50">
            <Search size={14} className="text-slate-400 ml-1 mr-2 shrink-0" />
            <input autoFocus type="text" className="w-full bg-transparent border-none text-xs font-bold text-slate-800 p-1 focus:ring-0 placeholder:text-slate-400 outline-none" placeholder="Type to search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => {
                const itemName = item.Name || item.name || item.Items || 'Unnamed Product';
                const defaultPrice = formatMoney(item.Price || item.unitPrice || item['Unit Price (SG)'] || 0);
                return (
                  <button key={item.id} type="button" className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 border-b border-slate-100 last:border-0 transition-colors flex justify-between" onClick={() => { onChange(item.id); setIsOpen(false); }}>
                    <span>{itemName}</span>
                    <span className="text-slate-400 font-normal">Def: ${defaultPrice}</span>
                  </button>
                );
              })
            ) : (<div className="p-3 text-center text-xs text-slate-400 font-medium">No products found.</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENT: PRICING GROUP MANAGER
// ==========================================
function PricingGroupManager({ sys, groups, setGroups, onClose }) {
  const safeGroups = Array.isArray(groups) ? groups : [];
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];
  
  const [activeGroupId, setActiveGroupId] = useState(safeGroups[0]?.id || null);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  const [pricingItem, setPricingItem] = useState('');
  const [pricingUnit, setPricingUnit] = useState('箱');
  const [pricingValue, setPricingValue] = useState('');

  const [activeTab, setActiveTab] = useState('rules'); 
  const [memberSearch, setMemberSearch] = useState('');
  const [showQuotation, setShowQuotation] = useState(false);

  const activeGroup = safeGroups.find(g => g.id === activeGroupId);

  const groupMembers = safeCustomers.filter(c => c.pricing_group_id === activeGroupId);
  const unassignedCustomers = safeCustomers.filter(c => c.pricing_group_id !== activeGroupId);

  const filteredUnassigned = unassignedCustomers.filter(c => 
    String(c.name || '').toLowerCase().includes(memberSearch.toLowerCase())
  );

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const newGroup = { id: `grp-${Date.now()}`, name: newGroupName.trim(), prices: {} };
      const { error } = await supabase.from('pricing_groups').insert([newGroup]);
      if (error) throw error;
      
      setGroups([...safeGroups, newGroup]);
      setActiveGroupId(newGroup.id);
      setIsCreating(false);
      setNewGroupName('');
      setActiveTab('members'); 
    } catch (err) { alert(`Error creating group: ${err.message}`); }
  };

  const handleAddGroupPrice = async () => {
    if (!activeGroup || !pricingItem || !pricingValue) return;
    try {
      const ruleKey = `${pricingItem}|${pricingUnit}`;
      const updatedPrices = { ...(activeGroup.prices || {}), [ruleKey]: Number(pricingValue) };
      
      const { error } = await supabase.from('pricing_groups').update({ prices: updatedPrices }).eq('id', activeGroup.id);
      if (error) throw error;

      const updatedGroup = { ...activeGroup, prices: updatedPrices };
      setGroups(safeGroups.map(g => g.id === activeGroup.id ? updatedGroup : g));
      
      setPricingItem(''); setPricingValue('');
    } catch (err) { alert(`Error saving price: ${err.message}`); }
  };

  const handleRemoveGroupPrice = async (ruleKey) => {
    if (!activeGroup) return;
    try {
      const updatedPrices = { ...activeGroup.prices };
      delete updatedPrices[ruleKey];
      
      const { error } = await supabase.from('pricing_groups').update({ prices: updatedPrices }).eq('id', activeGroup.id);
      if (error) throw error;

      const updatedGroup = { ...activeGroup, prices: updatedPrices };
      setGroups(safeGroups.map(g => g.id === activeGroup.id ? updatedGroup : g));
    } catch (err) { alert(`Error removing price: ${err.message}`); }
  };

  const handleDeleteGroup = async (groupId) => {
    if(!window.confirm("Delete this pricing group entirely? Customers assigned to it will revert to catalog prices.")) return;
    try {
      const { error } = await supabase.from('pricing_groups').delete().eq('id', groupId);
      if (error) throw error;
      
      const affectedCustomers = safeCustomers.filter(c => c.pricing_group_id === groupId);
      for (const cust of affectedCustomers) {
        await supabase.from('customers').update({ pricing_group_id: null }).eq('id', cust.id);
      }

      setGroups(safeGroups.filter(g => g.id !== groupId));
      sys.setCustomers(safeCustomers.map(c => c.pricing_group_id === groupId ? { ...c, pricing_group_id: null } : c));
      
      if (activeGroupId === groupId) setActiveGroupId(null);
    } catch (err) { alert(`Error deleting group: ${err.message}`); }
  };

  const handleAddMember = async (customerId) => {
    try {
      const { error } = await supabase.from('customers').update({ pricing_group_id: activeGroupId }).eq('id', customerId);
      if (error) throw error;
      sys.setCustomers(safeCustomers.map(c => c.id === customerId ? { ...c, pricing_group_id: activeGroupId } : c));
    } catch (err) { alert(`Failed to add member: ${err.message}`); }
  };

  const handleRemoveMember = async (customerId) => {
    try {
      const { error } = await supabase.from('customers').update({ pricing_group_id: null }).eq('id', customerId);
      if (error) throw error;
      sys.setCustomers(safeCustomers.map(c => c.id === customerId ? { ...c, pricing_group_id: null } : c));
    } catch (err) { alert(`Failed to remove member: ${err.message}`); }
  };

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
          <h2 className="text-base font-black tracking-widest uppercase flex items-center">
            <Layers size={18} className="mr-2 text-blue-400" /> Pricing Group Manager
          </h2>
          <button type="button" onClick={onClose} className="hover:bg-slate-800 p-1.5 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/3 bg-slate-50 border-r border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200">
              {isCreating ? (
                <div className="flex flex-col space-y-2">
                  <input type="text" autoFocus placeholder="e.g. Wholesale Tier A" className="w-full text-sm font-bold p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500" value={newGroupName} onChange={(e)=>setNewGroupName(e.target.value)} />
                  <div className="flex space-x-2">
                    <button onClick={handleCreateGroup} className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-700">Save</button>
                    <button onClick={()=>setIsCreating(false)} className="flex-1 bg-white border border-slate-300 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-100">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={()=>setIsCreating(true)} className="w-full flex items-center justify-center border-2 border-dashed border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100 font-bold text-sm py-3 rounded-xl transition-colors">
                  <Plus size={16} className="mr-2" /> Create New Group
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {safeGroups.map(group => {
                const memberCount = safeCustomers.filter(c => c.pricing_group_id === group.id).length;
                return (
                  <div key={group.id} onClick={() => setActiveGroupId(group.id)} className={`w-full text-left px-4 py-3 rounded-xl cursor-pointer transition-colors flex justify-between items-center group/btn ${activeGroupId === group.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}>
                    <div>
                      <p className="font-bold text-sm">{group.name}</p>
                      <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${activeGroupId === group.id ? 'text-blue-200' : 'text-slate-400'}`}>
                        {memberCount} Member{memberCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }} className={`p-1.5 rounded-lg transition-colors ${activeGroupId === group.id ? 'hover:bg-blue-700 text-blue-200 hover:text-white' : 'opacity-0 group-hover/btn:opacity-100 hover:bg-red-100 text-slate-400 hover:text-red-600'}`}><Trash2 size={14}/></button>
                  </div>
                )
              })}
              {safeGroups.length === 0 && !isCreating && <p className="text-center text-xs font-bold text-slate-400 mt-4 uppercase tracking-widest">No Groups Found</p>}
            </div>
          </div>

          <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
            {activeGroup ? (
              <>
                <div className="p-8 border-b border-slate-100 shrink-0">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 mb-1">{activeGroup.name}</h3>
                      <p className="text-sm text-slate-500 font-medium">Manage pricing rules and assign customers to this tier.</p>
                    </div>
                    <button 
                      onClick={() => setShowQuotation(true)}
                      className="flex items-center px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm"
                    >
                      <Printer size={16} className="mr-2" /> PDF Quotation
                    </button>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button onClick={() => setActiveTab('rules')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'rules' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      <Tag className="inline mr-1.5" size={14}/> Pricing Rules ({Object.keys(activeGroup.prices || {}).length})
                    </button>
                    <button onClick={() => setActiveTab('members')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'members' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      <UsersIcon className="inline mr-1.5" size={14}/> Group Members ({groupMembers.length})
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                  {activeTab === 'rules' && (
                    <div className="max-w-2xl mx-auto">
                      <div className="flex space-x-3 mb-8 bg-white p-4 rounded-xl border border-slate-200 items-center shadow-sm">
                        <ProductSearchSelect value={pricingItem} inventory={safeInventory} onChange={(selectedId) => { setPricingItem(selectedId); const product = safeInventory.find((entry) => entry.id === selectedId); if (product) setPricingUnit(product.Unit || product.unit || '箱'); }} />
                        <select className="w-24 rounded-lg border border-slate-200 p-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shrink-0 bg-white" value={pricingUnit} onChange={(e) => setPricingUnit(e.target.value)}>
                          {UNIT_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                          {pricingUnit && !UNIT_OPTIONS.find(opt => opt.value === pricingUnit) && (<option value={pricingUnit}>{pricingUnit}</option>)}
                        </select>
                        <div className="relative w-32 shrink-0">
                          <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                          <input type="number" step="0.01" placeholder="0.00" className="w-full rounded-lg border border-slate-200 p-2 pl-7 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white" value={pricingValue} onChange={(e) => setPricingValue(e.target.value)} />
                        </div>
                        <button onClick={handleAddGroupPrice} disabled={!pricingItem || !pricingValue} className="flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0">
                          <Plus className="mr-2" size={14} /> Add Rule
                        </button>
                      </div>

                      <div className="space-y-3">
                        {Object.keys(activeGroup.prices || {}).length === 0 ? (
                          <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-white">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No group pricing rules active</p>
                          </div>
                        ) : (
                          Object.entries(activeGroup.prices).map(([ruleKey, price]) => {
                            const [itemId, unit] = ruleKey.includes('|') ? ruleKey.split('|') : [ruleKey, '箱'];
                            const product = safeInventory.find(i => i.id === itemId);
                            const defaultPrice = product?.Price || product?.unitPrice || product?.['Unit Price (SG)'] || 0;
                            const productName = product?.Name || product?.name || product?.Items || 'Unknown Product';
                            
                            return (
                              <div key={ruleKey} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                                <div>
                                  <p className="text-sm font-bold text-slate-800 flex items-center">
                                    {productName} <span className="ml-3 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-black border border-indigo-100">{unit}</span>
                                  </p>
                                  <p className="text-xs font-medium text-slate-500 mt-1">Catalog Default: <span className="line-through">${formatMoney(defaultPrice)}</span></p>
                                </div>
                                <div className="flex items-center space-x-6">
                                  <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Group Rate</p>
                                    <p className="text-lg font-black text-slate-900">${formatMoney(price)}</p>
                                  </div>
                                  <button onClick={() => handleRemoveGroupPrice(ruleKey)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'members' && (
                    <div className="grid grid-cols-2 gap-8 h-full">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="bg-slate-900 text-white p-3 font-bold text-xs uppercase tracking-widest flex justify-between items-center shrink-0">
                          <span>Enrolled Entities</span>
                          <span className="bg-slate-700 px-2 py-0.5 rounded">{groupMembers.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                          {groupMembers.length === 0 ? (
                            <p className="text-center text-xs font-bold text-slate-400 mt-8 uppercase tracking-widest">No Members Yet</p>
                          ) : (
                            groupMembers.map(member => (
                              <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg group/mem hover:border-slate-300 transition-colors">
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{member.name}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{member.region || 'No Region'}</p>
                                </div>
                                <button 
                                  onClick={() => handleRemoveMember(member.id)} 
                                  className="text-red-400 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 px-2 py-1.5 rounded flex items-center text-[10px] font-bold uppercase transition-colors shadow-sm"
                                >
                                  <UserMinus size={12} className="mr-1" /> Remove
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="bg-slate-100 border-b border-slate-200 p-3 font-bold text-xs uppercase tracking-widest text-slate-600 shrink-0">
                          Add Customers
                        </div>
                        <div className="p-3 border-b border-slate-100 bg-slate-50 shrink-0 relative">
                          <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input type="text" placeholder="Search available customers..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="w-full text-sm font-bold border border-slate-200 rounded-lg py-2 pl-8 outline-none focus:border-blue-500 shadow-sm" />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                          {filteredUnassigned.length === 0 ? (
                            <p className="text-center text-xs font-bold text-slate-400 mt-8 uppercase tracking-widest">All matched customers assigned</p>
                          ) : (
                            filteredUnassigned.map(member => (
                              <div key={member.id} className="flex items-center justify-between p-3 hover:bg-slate-50 border border-transparent border-b-slate-100 transition-colors">
                                <div className="truncate pr-2">
                                  <p className="text-sm font-bold text-slate-800 truncate">{member.name}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5 truncate">
                                    {member.pricing_group_id ? `Currently in: ${safeGroups.find(g => g.id === member.pricing_group_id)?.name || 'Unknown'}` : 'No Group Assigned'}
                                  </p>
                                </div>
                                <button onClick={() => handleAddMember(member.id)} className="shrink-0 text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 px-3 py-1.5 rounded flex items-center text-[10px] font-bold uppercase transition-all shadow-sm">
                                  <Plus size={12} className="mr-1" /> Add
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                <Layers size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">Select or Create a Pricing Group</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showQuotation && (
        <QuotationPreviewModal 
          group={activeGroup} 
          sys={sys} 
          onClose={() => setShowQuotation(false)} 
        />
      )}
    </div>
  );
}

// ==========================================
// COMPONENT: CUSTOMER EDIT FORM
// ==========================================
function CustomerFormModal({ initialValue, onClose, onSave, groups }) {
  const [form, setForm] = useState(initialValue);
  const safeGroups = Array.isArray(groups) ? groups : [];

  return (
    <EntityModal onClose={onClose} onSave={() => onSave(form)} title="Customer Modification">
      <div className="space-y-4">
        <input className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Company Name" value={form.name} />
        
        <div className="grid grid-cols-2 gap-4">
          <input className="w-full rounded-xl border border-gray-200 p-3 text-sm" onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))} placeholder="Contact Person" value={form.contactPerson} />
          <input className="w-full rounded-xl border border-gray-200 p-3 text-sm" onChange={(event) => setForm((current) => ({ ...current, contactNumber: event.target.value }))} placeholder="Phone Number" value={form.contactNumber} />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <select className="w-full rounded-xl border border-gray-200 p-3 text-sm bg-white" onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} value={form.region}>
            <option value="North">North Sector</option><option value="West">West Sector</option><option value="East">East Sector</option><option value="South">South Sector</option><option value="Central">Central Sector</option>
          </select>
          <select className="w-full rounded-xl border border-gray-200 p-3 text-sm bg-white cursor-pointer" onChange={(event) => setForm((current) => ({ ...current, payment_terms: event.target.value }))} value={form.payment_terms || '30_days'}>
            <option value="30_days">30 Days Credit</option><option value="cod">C.O.D</option>
          </select>
          <select className="w-full rounded-xl border border-indigo-200 text-indigo-800 bg-indigo-50 p-3 text-sm font-bold cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500" onChange={(event) => setForm((current) => ({ ...current, pricing_group_id: event.target.value }))} value={form.pricing_group_id || ''}>
            <option value="">No Pricing Group</option>
            {safeGroups.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
          </select>
        </div>

        <textarea className="w-full rounded-xl border border-gray-200 p-3 text-sm" onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Full Address" rows={3} value={form.address} />
      </div>
    </EntityModal>
  );
}

// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================
export function CustomerModule({ sys }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(EMPTY_CUSTOMER);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All');

  const [pricingItem, setPricingItem] = useState('');
  const [pricingUnit, setPricingUnit] = useState('箱');
  const [pricingValue, setPricingValue] = useState('');

  // INDEPENDENT PRICING GROUPS STATE
  const [pricingGroups, setPricingGroups] = useState([]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const { data, error } = await supabase.from('pricing_groups').select('*');
        if (!error && data) setPricingGroups(data);
      } catch (err) { console.error("Error fetching pricing groups:", err); }
    };
    fetchGroups();
  }, []);

  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];
  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];

  const analytics = useMemo(() => {
    const now = new Date();
    return safeCustomers.map((customer) => {
      const customerInvoices = safeInvoices.filter((invoice) => invoice.customerId === customer.id).sort((left, right) => new Date(left.date || 0) - new Date(right.date || 0));

      if (customerInvoices.length === 0) {
        return { customer, totalRevenue: 0, orderCount: 0, avgValue: 0, daysSinceLast: 999, status: 'inactive', trend: 'flat', topItems: [] };
      }

      const totalRevenue = customerInvoices.reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
      const avgValue = totalRevenue / customerInvoices.length;
      const lastDate = new Date(customerInvoices[customerInvoices.length - 1].date);
      const daysSinceLast = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

      let avgFrequency = null;
      if (customerInvoices.length > 1) {
        const gaps = [];
        for (let index = 1; index < customerInvoices.length; index += 1) {
          gaps.push((new Date(customerInvoices[index].date) - new Date(customerInvoices[index - 1].date)) / (1000 * 60 * 60 * 24));
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

      const topItems = Object.entries(itemCounts).sort((left, right) => right[1] - left[1]).slice(0, 3).map(([name, qty]) => ({ name, qty }));

      let status = 'active';
      if (daysSinceLast > 90) status = 'churned';
      else if (daysSinceLast > 45) status = 'at-risk';
      else if (daysSinceLast > 21 && avgFrequency && daysSinceLast > avgFrequency * 1.5) status = 'cooling';

      let trend = 'flat';
      if (customerInvoices.length >= 4) {
        const recent = customerInvoices.slice(-2).reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
        const prior = customerInvoices.slice(-4, -2).reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
        if (recent > prior * 1.2) trend = 'growing';
        else if (recent < prior * 0.8) trend = 'declining';
      }

      return { customer, totalRevenue, orderCount: customerInvoices.length, avgValue, daysSinceLast, avgFrequency, status, trend, topItems, lastOrderDate: customerInvoices[customerInvoices.length - 1].date };
    }).sort((left, right) => right.totalRevenue - left.totalRevenue);
  }, [safeCustomers, safeInvoices, safeInventory]);

  const displayList = useMemo(() => {
    return analytics.filter((entry) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (entry.customer.name || '').toLowerCase().includes(searchLower) || (entry.customer.contactPerson || '').toLowerCase().includes(searchLower);

      let matchesStatus = true;
      if (statusFilter === 'Stagnant') matchesStatus = ['at-risk', 'churned', 'cooling'].includes(entry.status);
      else if (statusFilter === 'Active') matchesStatus = entry.status === 'active';
      else if (statusFilter === 'Cooling') matchesStatus = entry.status === 'cooling';
      else if (statusFilter === 'At Risk') matchesStatus = entry.status === 'at-risk';
      else if (statusFilter === 'Churned') matchesStatus = entry.status === 'churned';

      const matchesRegion = regionFilter === 'All' ? true : entry.customer.region === regionFilter;
      return matchesSearch && matchesStatus && matchesRegion;
    });
  }, [analytics, searchTerm, statusFilter, regionFilter]);

  const handleSave = async (form) => {
    try {
      if (form.id) {
        const { error } = await supabase.from('customers').update({ name: form.name, address: form.address, region: form.region, payment_terms: form.payment_terms, pricing_group_id: form.pricing_group_id, contactPerson: form.contactPerson, contactNumber: form.contactNumber }).eq('id', form.id);
        if (error) throw error;
        
        sys.setCustomers(safeCustomers.map((c) => (c.id === form.id ? { ...c, ...form } : c)));
        if (selectedCustomer && selectedCustomer.customer.id === form.id) {
          setSelectedCustomer({ ...selectedCustomer, customer: { ...selectedCustomer.customer, ...form }});
        }
      } else {
        const newId = `c${Date.now()}`;
        const newCust = { ...form, id: newId, custom_prices: {} };
        const { error } = await supabase.from('customers').insert([newCust]);
        if (error) throw error;
        sys.setCustomers([...safeCustomers, newCust]);
      }
      setIsOpen(false);
    } catch(err) { alert(`Error saving: ${err.message}`); }
  };

  const handleAddPricingRule = async () => {
    if (!pricingItem || !pricingValue || !pricingUnit) return;
    try {
      const updatedCustomer = { ...selectedCustomer.customer };
      if (!updatedCustomer.custom_prices) updatedCustomer.custom_prices = {};
      const ruleKey = `${pricingItem}|${pricingUnit}`;
      updatedCustomer.custom_prices[ruleKey] = Number(pricingValue);
      
      const { error } = await supabase.from('customers').update({ custom_prices: updatedCustomer.custom_prices }).eq('id', updatedCustomer.id);
      if (error) throw error;

      sys.setCustomers(safeCustomers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
      setSelectedCustomer({ ...selectedCustomer, customer: updatedCustomer });
      setPricingItem(''); setPricingValue('');
    } catch(err) { alert(`Error saving custom price: ${err.message}`); }
  };

  const handleRemovePricingRule = async (ruleKey) => {
    try {
      const updatedCustomer = { ...selectedCustomer.customer };
      if (updatedCustomer.custom_prices) delete updatedCustomer.custom_prices[ruleKey];
      
      const { error } = await supabase.from('customers').update({ custom_prices: updatedCustomer.custom_prices }).eq('id', updatedCustomer.id);
      if (error) throw error;

      sys.setCustomers(safeCustomers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
      setSelectedCustomer({ ...selectedCustomer, customer: updatedCustomer });
    } catch(err) { alert(`Error removing custom price: ${err.message}`); }
  };

  const handleDeleteCustomer = async (e, customerId, customerName) => {
    e.stopPropagation(); 
    
    const isConfirmed = window.confirm(`WARNING: Are you absolutely sure you want to permanently delete "${customerName}"?\n\nThis action cannot be undone.`);
    
    if (isConfirmed) {
      try {
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', customerId);
          
        if (error) {
          if (error.code === '23503') {
            throw new Error("Cannot delete this customer because they have existing invoices tied to them. Please reassign or delete their invoices first.");
          }
          throw error;
        }
        
        const updatedCustomers = safeCustomers.filter(c => c?.id !== customerId);
        sys.setCustomers(updatedCustomers);
        
        if (selectedCustomer?.customer?.id === customerId) {
          setSelectedCustomer(null);
        }
        
        alert(`Success: "${customerName}" has been removed from the database.`);
        
      } catch (err) {
        alert(`Delete Failed:\n${err.message}`);
      }
    }
  };

  if (selectedCustomer) {
    const statusStyle = STATUS_STYLES[selectedCustomer.status] || STATUS_STYLES.inactive;
    const customPrices = selectedCustomer.customer.custom_prices || {};
    const assignedGroup = pricingGroups.find(g => g.id === selectedCustomer.customer.pricing_group_id);
    const groupPrices = assignedGroup?.prices || {};

    return (
      <div className="space-y-6">
        <button className="flex items-center text-sm font-bold text-gray-500 hover:text-gray-800" onClick={() => setSelectedCustomer(null)} type="button">
          <ArrowRight className="mr-2 rotate-180" size={16} /> Back to Customer Rankings
        </button>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <div className="flex items-center">
                    <h2 className="text-2xl font-black text-slate-900">{selectedCustomer.customer.name}</h2>
                    {sys.hasPerm('manage_customers') && (
                      <button onClick={() => { setEditingCustomer(selectedCustomer.customer); setIsOpen(true); }} className="ml-4 flex items-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                        <Edit size={14} className="mr-1" /> Edit Details
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-500">
                    {selectedCustomer.customer.address} ({selectedCustomer.customer.region})
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 items-center">
                    <span className={`${statusStyle.bg} ${statusStyle.text} rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest`}>{statusStyle.label}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">{selectedCustomer.trend === 'growing' ? 'Growing' : selectedCustomer.trend === 'declining' ? 'Declining' : 'Stable'}</span>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${selectedCustomer.customer.payment_terms === 'cod' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {selectedCustomer.customer.payment_terms === 'cod' ? 'C.O.D' : '30 Days'}
                    </span>
                    {assignedGroup && (
                      <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-indigo-200 bg-indigo-50 text-indigo-700 flex items-center">
                        <Layers size={10} className="mr-1.5" /> Group: {assignedGroup.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Lifetime Revenue</p>
                  <p className="font-mono text-4xl font-black tracking-tighter text-blue-600">${formatMoneyWhole(selectedCustomer.totalRevenue)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-6">
                <div><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Orders</p><p className="text-xl font-bold">{selectedCustomer.orderCount}</p></div>
                <div><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Avg Value</p><p className="font-mono text-xl font-bold">${formatMoneyWhole(selectedCustomer.avgValue)}</p></div>
                <div><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Last Order</p><p className={`text-xl font-bold ${selectedCustomer.daysSinceLast > 60 ? 'text-red-500' : 'text-slate-800'}`}>{selectedCustomer.daysSinceLast === 999 ? 'Never' : `${selectedCustomer.daysSinceLast} days ago`}</p></div>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-white p-8 shadow-sm">
              <h3 className="mb-6 flex items-center text-sm font-black uppercase tracking-widest text-blue-800">
                <Tag className="mr-2 text-blue-500" size={18} /> Pricing Agreements (Cascade)
              </h3>
              
              <div className="flex space-x-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 items-center">
                <ProductSearchSelect value={pricingItem} inventory={safeInventory} onChange={(selectedId) => { setPricingItem(selectedId); const product = safeInventory.find((entry) => entry.id === selectedId); if (product) setPricingUnit(product.Unit || product.unit || '箱'); }} />
                <select className="w-24 rounded-lg border border-slate-200 p-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shrink-0 bg-white" value={pricingUnit} onChange={(e) => setPricingUnit(e.target.value)}>
                  {UNIT_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                  {pricingUnit && !UNIT_OPTIONS.find(opt => opt.value === pricingUnit) && (<option value={pricingUnit}>{pricingUnit}</option>)}
                </select>
                <div className="relative w-32 shrink-0">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                  <input type="number" step="0.01" placeholder="0.00" className="w-full rounded-lg border border-slate-200 p-2 pl-7 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white" value={pricingValue} onChange={(e) => setPricingValue(e.target.value)} />
                </div>
                <button onClick={handleAddPricingRule} disabled={!pricingItem || !pricingValue} className="flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-colors shrink-0">
                  <Save className="mr-2" size={14} /> Lock Individual Override
                </button>
              </div>

              <div className="space-y-3">
                {Object.keys(customPrices).length === 0 && Object.keys(groupPrices).length === 0 ? (
                  <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active pricing rules</p>
                    <p className="text-xs text-slate-400 mt-1">This customer will be charged standard catalog prices.</p>
                  </div>
                ) : (
                  <>
                    {Object.entries(customPrices).map(([ruleKey, price]) => {
                      const [itemId, unit] = ruleKey.includes('|') ? ruleKey.split('|') : [ruleKey, '箱'];
                      const product = safeInventory.find(i => i.id === itemId);
                      const defaultPrice = product?.Price || product?.unitPrice || product?.['Unit Price (SG)'] || 0;
                      const productName = product?.Name || product?.name || product?.Items || 'Unknown Product';
                      
                      return (
                        <div key={`ind-${ruleKey}`} className="flex items-center justify-between p-4 bg-emerald-50/30 border border-emerald-200 rounded-xl shadow-sm hover:border-emerald-300 transition-colors relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                          <div className="pl-2">
                            <p className="text-sm font-bold text-slate-800 flex items-center">
                              {productName} <span className="ml-3 px-2 py-0.5 bg-white text-slate-600 rounded text-xs font-black border border-slate-200">{unit}</span>
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-1.5 flex items-center"><User size={10} className="mr-1"/> Individual Customer Override</p>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Locked Rate</p>
                              <p className="text-lg font-black text-emerald-600">${formatMoney(price)}</p>
                            </div>
                            <button onClick={() => handleRemovePricingRule(ruleKey)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                          </div>
                        </div>
                      );
                    })}

                    {Object.entries(groupPrices).map(([ruleKey, price]) => {
                      if (customPrices[ruleKey] !== undefined) return null;

                      const [itemId, unit] = ruleKey.includes('|') ? ruleKey.split('|') : [ruleKey, '箱'];
                      const product = safeInventory.find(i => i.id === itemId);
                      const defaultPrice = product?.Price || product?.unitPrice || product?.['Unit Price (SG)'] || 0;
                      const productName = product?.Name || product?.name || product?.Items || 'Unknown Product';
                      
                      return (
                        <div key={`grp-${ruleKey}`} className="flex items-center justify-between p-4 bg-indigo-50/30 border border-indigo-200 rounded-xl shadow-sm hover:border-indigo-300 transition-colors relative overflow-hidden opacity-80 hover:opacity-100">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400"></div>
                          <div className="pl-2">
                            <p className="text-sm font-bold text-slate-800 flex items-center">
                              {productName} <span className="ml-3 px-2 py-0.5 bg-white text-slate-600 rounded text-xs font-black border border-slate-200">{unit}</span>
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mt-1.5 flex items-center"><Layers size={10} className="mr-1"/> Inherited from {assignedGroup.name}</p>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Group Rate</p>
                              <p className="text-lg font-black text-indigo-600">${formatMoney(price)}</p>
                            </div>
                            <div className="w-[34px]"></div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-700">Behavioral Analysis & Actions</h3>
              <div className="space-y-4">
                {selectedCustomer.status === 'churned' && (<div className="flex rounded-xl border border-red-100 bg-red-50 p-4"><AlertTriangle className="mr-4 shrink-0 text-red-500" /><div><h4 className="text-sm font-bold text-red-800">Customer Churned</h4><p className="mt-1 text-xs text-red-600">No orders in over 90 days. Recommended action: executive reach-out and a strong win-back offer.</p></div></div>)}
                {selectedCustomer.status === 'at-risk' && (<div className="flex rounded-xl border border-orange-100 bg-orange-50 p-4"><Activity className="mr-4 shrink-0 text-orange-500" /><div><h4 className="text-sm font-bold text-orange-800">High Risk of Churn</h4><p className="mt-1 text-xs text-orange-600">Ordering has slowed significantly. Recommended action: check in immediately and offer service support.</p></div></div>)}
                {selectedCustomer.status === 'cooling' && (<div className="flex rounded-xl border border-amber-100 bg-amber-50 p-4"><TrendingDown className="mr-4 shrink-0 text-amber-500" /><div><h4 className="text-sm font-bold text-amber-800">Cooling Engagement</h4><p className="mt-1 text-xs text-amber-600">Typical order cycle is {selectedCustomer.avgFrequency} days, but it has been {selectedCustomer.daysSinceLast} days. A follow-up call is recommended.</p></div></div>)}
                {selectedCustomer.trend === 'growing' && selectedCustomer.status === 'active' && (<div className="flex rounded-xl border border-emerald-100 bg-emerald-50 p-4"><TrendingUp className="mr-4 shrink-0 text-emerald-500" /><div><h4 className="text-sm font-bold text-emerald-800">Growth Account</h4><p className="mt-1 text-xs text-emerald-600">Order volume is rising. This account is a good candidate for tiered pricing or contract locking.</p></div></div>)}
                {selectedCustomer.avgFrequency && (<div className="flex rounded-xl border border-blue-100 bg-blue-50 p-4"><Clock className="mr-4 shrink-0 text-blue-500" /><div><h4 className="text-sm font-bold text-blue-800">Ordering Cadence</h4><p className="mt-1 text-xs text-blue-600">Typically orders every <b>{selectedCustomer.avgFrequency} days</b>. Next expected order is roughly {Math.max(0, selectedCustomer.avgFrequency - selectedCustomer.daysSinceLast)} days from now.</p></div></div>)}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Typically Orders</h3>
              {selectedCustomer.topItems.length > 0 ? (
                <ul className="space-y-3">
                  {selectedCustomer.topItems.map((item) => (
                    <li className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3" key={item.name}>
                      <span className="mr-2 truncate text-sm font-bold text-slate-700">{item.name}</span>
                      <span className="shrink-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-black text-blue-600 shadow-sm">{item.qty} units</span>
                    </li>
                  ))}
                </ul>
              ) : (<p className="text-sm font-medium text-gray-400">No item data found.</p>)}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact File</h3>
              <div className="space-y-3 text-sm">
                <div className="flex"><User className="mr-3 shrink-0 text-gray-400" size={18} /><span className="font-bold">{selectedCustomer.customer.contactPerson || 'Not Provided'}</span></div>
                <div className="flex"><Phone className="mr-3 shrink-0 text-gray-400" size={18} /><span className="font-bold">{selectedCustomer.customer.contactNumber || 'Not Provided'}</span></div>
                <div className="flex"><MapPin className="mr-3 shrink-0 text-gray-400" size={18} /><span className="font-medium text-gray-600">{selectedCustomer.customer.address}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      
      <div className="flex shrink-0 items-center justify-between rounded-t-xl border-b border-gray-100 bg-gray-50 p-5">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Customer Intelligence</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">Revenue rankings, behavioral analytics, and account management.</p>
        </div>
        <div className="flex items-center space-x-3">
          {sys.hasPerm('manage_customers') && (
            <>
              <button className="flex items-center rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-700 shadow-sm hover:bg-indigo-100 transition-colors" onClick={() => setIsGroupManagerOpen(true)} type="button">
                <Layers className="mr-2" size={14} /> Pricing Groups
              </button>
              <button className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors" onClick={() => { setEditingCustomer(EMPTY_CUSTOMER); setIsOpen(true); }} type="button">
                <Plus className="mr-2" size={16} /> New Account
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 bg-white p-4 gap-4 shadow-sm relative z-20">
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 w-full sm:w-96 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all">
          <Search className="text-slate-400 mr-2 shrink-0" size={18} />
          <input type="text" placeholder="Search by entity or contact..." className="w-full bg-transparent border-none focus:ring-0 text-sm font-semibold outline-none placeholder:text-slate-400 placeholder:font-normal" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex items-center">
            <Filter size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            <select className="w-full sm:w-auto rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm cursor-pointer appearance-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Health Statuses</option><option value="Active">Healthy (Active)</option><option value="Stagnant">Needs Attention (Stagnant)</option><option value="Cooling">↳ Cooling</option><option value="At Risk">↳ At Risk</option><option value="Churned">↳ Churned</option>
            </select>
          </div>

          <div className="relative flex items-center">
            <MapPin size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            <select className="w-full sm:w-auto rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm cursor-pointer appearance-none" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="All">All Regions</option><option value="North">North Sector</option><option value="South">South Sector</option><option value="East">East Sector</option><option value="West">West Sector</option><option value="Central">Central Sector</option>
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
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {displayList.map((entry, index) => {
              const statusStyle = STATUS_STYLES[entry.status] || STATUS_STYLES.inactive;
              const TrendIcon = entry.trend === 'growing' ? TrendingUp : entry.trend === 'declining' ? TrendingDown : ArrowRight;
              const trendColor = entry.trend === 'growing' ? 'text-emerald-500' : entry.trend === 'declining' ? 'text-red-500' : 'text-gray-400';

              return (
                <tr className="cursor-pointer transition-colors hover:bg-blue-50/30" key={entry.customer.id} onClick={() => setSelectedCustomer(entry)}>
                  <td className="p-4 pl-6 text-center">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>#{index + 1}</span>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-900">{entry.customer.name || 'Unknown'}</div>
                    <div className="mt-1 flex items-center space-x-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{entry.customer.region || '-'} Sector</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${entry.customer.payment_terms === 'cod' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-indigo-50 text-indigo-500 border border-indigo-200'}`}>
                        {entry.customer.payment_terms === 'cod' ? 'C.O.D' : '30 Days'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-center"><span className={`${statusStyle.bg} ${statusStyle.text} rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest`}>{statusStyle.label}</span></td>
                  <td className="p-4 text-center"><TrendIcon className={`inline-block ${trendColor}`} size={18} /></td>
                  <td className="p-4 text-right font-mono text-lg font-black tracking-tighter text-slate-900">${formatMoneyWhole(entry.totalRevenue)}</td>
                  <td className="p-4 text-center text-xs font-bold text-slate-500">{entry.daysSinceLast === 999 ? '-' : `${entry.daysSinceLast}d ago`}</td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex justify-end items-center space-x-2">
                      <span className="inline-flex items-center rounded-lg bg-blue-50 p-2 text-[10px] font-black uppercase tracking-widest text-blue-600 transition-colors hover:bg-blue-100">View <ArrowRight className="ml-1" size={12} /></span>
                      <button 
                        onClick={(e) => handleDeleteCustomer(e, entry.customer.id, entry.customer.name)} 
                        className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                        title="Delete Customer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {displayList.length === 0 && (
              <tr><td className="p-12 text-center text-sm font-bold text-slate-400" colSpan="7">No customers match your search and filter criteria.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && <CustomerFormModal initialValue={editingCustomer} groups={pricingGroups} onClose={() => setIsOpen(false)} onSave={handleSave} sys={sys} />}
      {isGroupManagerOpen && <PricingGroupManager sys={sys} groups={pricingGroups} setGroups={setPricingGroups} onClose={() => setIsGroupManagerOpen(false)} />}
    </div>
  );
}
