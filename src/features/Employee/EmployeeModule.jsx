import { useState } from 'react';
import { 
  Users, 
  Clock, 
  DollarSign, 
  CalendarDays, 
  Search, 
  Plus, 
  MoreVertical, 
  AlertCircle,
  FileText,
  User,
  Gift,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Calculator,
  Trash2,
  Briefcase
} from 'lucide-react';
import { formatMoney } from '../../utils/format';

// ==========================================
// MOCK DATA
// ==========================================
const MOCK_EMPLOYEES = [
  {
    id: 'EMP-001',
    name: 'Yeo Min',
    role: 'Warehouse Manager',
    status: 'Active',
    type: 'Citizen', 
    basicSalary: 3500,
    levy: 0,
    cpfEligible: true,
    leaveEntitlement: 14,
    leavesTaken: 2,
    sickLeavesTaken: 1,
    workPassExpiry: null,
  },
  {
    id: 'EMP-002',
    name: 'Kyaw Zin',
    role: 'Delivery Driver',
    status: 'Active',
    type: 'WP', 
    basicSalary: 1800,
    levy: 450, 
    cpfEligible: false,
    leaveEntitlement: 7,
    leavesTaken: 0,
    sickLeavesTaken: 0,
    workPassExpiry: '2026-11-15',
  }
];

// ==========================================
// COMPONENT: CONTRACT GENERATOR (SUB-VIEW)
// ==========================================
function EmployeeContractForm({ employees }) {
  // Employee Target
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [role, setRole] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Financials
  const [baseSalary, setBaseSalary] = useState(2500);
  
  // Dynamic Arrays
  const [allowances, setAllowances] = useState([{ id: Date.now(), type: 'Transport', amount: 300 }]);
  const [bonuses, setBonuses] = useState([{ id: Date.now() + 1, requirement: 'Completion of 1 full year of service', amount: 2500 }]);
  
  // Leave & Entitlements
  const [annualLeave, setAnnualLeave] = useState(14);
  const [mcAllowance, setMcAllowance] = useState(14);

  // --- Handlers ---
  const handleEmployeeSelect = (e) => {
    const id = e.target.value;
    setSelectedEmpId(id);
    if (id === 'NEW') {
      setEmployeeName('');
      setRole('');
      setBaseSalary(0);
    } else if (id) {
      const emp = employees.find(emp => emp.id === id);
      if (emp) {
        setEmployeeName(emp.name);
        setRole(emp.role);
        setBaseSalary(emp.basicSalary);
        setAnnualLeave(emp.leaveEntitlement);
      }
    }
  };

  const addAllowance = () => setAllowances([...allowances, { id: Date.now(), type: '', amount: 0 }]);
  const removeAllowance = (id) => setAllowances(allowances.filter(a => a.id !== id));
  const updateAllowance = (id, field, value) => setAllowances(allowances.map(a => a.id === id ? { ...a, [field]: value } : a));

  const addBonus = () => setBonuses([...bonuses, { id: Date.now(), requirement: '', amount: 0 }]);
  const removeBonus = (id) => setBonuses(bonuses.filter(b => b.id !== id));
  const updateBonus = (id, field, value) => setBonuses(bonuses.map(b => b.id === id ? { ...b, [field]: value } : b));

  // --- Calculations ---
  const totalAllowances = allowances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const monthlyGross = Number(baseSalary) + totalAllowances;
  const totalBonuses = bonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const standardAnnualTotal = (monthlyGross * 12) + totalBonuses;

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-12 animate-in fade-in duration-300">
      
      {/* ========================================== */}
      {/* LEFT COLUMN: EMPLOYER CONTROL PANEL */}
      {/* ========================================== */}
      <div className="w-full lg:w-1/2 space-y-6">
        
        {/* Section 1: Employee Link */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center">
              <User size={16} className="mr-2" /> Assign Contract To
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <select value={selectedEmpId} onChange={handleEmployeeSelect} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none">
                <option value="">-- Select Employee in System --</option>
                <option value="NEW">+ Create for New/External Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                ))}
              </select>
            </div>
            
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
              <input type="text" value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="e.g. John Doe" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-slate-600 mb-1">Effective Date</label>
              <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Section 2: Role & Base Salary */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center">
            <Briefcase size={16} className="mr-2" /> Job Role & Base Pay
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Job Role (Free Text)</label>
              <input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Senior Logistics Coordinator" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Base Salary ($)</label>
              <input type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-lg font-black text-blue-700 bg-blue-50/50 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Section 3: Dynamic Allowances */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center">
              <DollarSign size={16} className="mr-2" /> Monthly Allowances
            </h2>
            <span className="text-xs font-bold text-slate-500">Total: ${formatMoney(totalAllowances)}</span>
          </div>
          
          <div className="space-y-3 mb-4">
            {allowances.map((al, index) => (
              <div key={al.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <div className="flex-1">
                  <input type="text" value={al.type} onChange={e => updateAllowance(al.id, 'type', e.target.value)} placeholder="Type (e.g. Transport)" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-emerald-500" />
                </div>
                <div className="w-32 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input type="number" value={al.amount} onChange={e => updateAllowance(al.id, 'amount', e.target.value)} placeholder="0" className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-7 pr-2 text-sm font-bold text-emerald-700 outline-none focus:border-emerald-500" />
                </div>
                <button onClick={() => removeAllowance(al.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
              </div>
            ))}
            {allowances.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">No allowances added.</p>}
          </div>
          <button onClick={addAllowance} className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg transition-colors w-full">+ Add Allowance</button>
        </div>

        {/* Section 4: Dynamic Bonuses */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-3xl shadow-sm border border-indigo-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-indigo-800 flex items-center">
              <Gift size={16} className="mr-2" /> Bonuses & Requirements
            </h2>
          </div>
          
          <div className="space-y-3 mb-4">
            {bonuses.map((b, index) => (
              <div key={b.id} className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase">Requirement / Condition</label>
                    <input type="text" value={b.requirement} onChange={e => updateBonus(b.id, 'requirement', e.target.value)} placeholder="e.g. No MCs taken in 6 months" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 mt-1" />
                  </div>
                  <div className="w-36">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase">Amount ($)</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                      <input type="number" value={b.amount} onChange={e => updateBonus(b.id, 'amount', e.target.value)} placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-7 pr-2 text-sm font-bold text-indigo-700 outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                  <button onClick={() => removeBonus(b.id)} className="mt-5 p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
            {bonuses.length === 0 && <p className="text-xs text-indigo-400 italic text-center py-2">No bonuses added.</p>}
          </div>
          <button onClick={addBonus} className="text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg transition-colors w-full shadow-md">+ Add Bonus Tier</button>
        </div>

        {/* Section 5: Leave Entitlements */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center">
            <CalendarDays size={16} className="mr-2" /> Leave & MC Allowances
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Annual Leave (Days)</label>
              <input type="number" value={annualLeave} onChange={e => setAnnualLeave(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">MC Allowance (Days)</label>
              <input type="number" value={mcAllowance} onChange={e => setMcAllowance(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

      </div>

      {/* ========================================== */}
      {/* RIGHT COLUMN: LIVE EMPLOYEE PREVIEW */}
      {/* ========================================== */}
      <div className="w-full lg:w-1/2">
        <div className="sticky top-0 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-auto max-h-[85vh]">
          
          {/* Document Header */}
          <div className="bg-slate-900 p-6 text-white text-center shrink-0">
            <h2 className="text-xl font-black uppercase tracking-widest">Compensation Agreement</h2>
            <p className="text-slate-400 mt-1 text-sm">Three Leaves (Singapore) Trading Enterprise</p>
          </div>

          <div className="p-8 overflow-y-auto flex-1 text-slate-800">
            
            {/* Employee Profile Header */}
            <div className="mb-6 border-b border-slate-200 pb-6">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Prepared For</p>
              <p className="text-2xl font-black">{employeeName || '[Employee Name]'}</p>
              <p className="text-lg text-slate-600 font-medium mt-1">{role || '[Job Position]'}</p>
              <p className="text-sm text-slate-400 mt-1">Effective Date: {effectiveDate}</p>
            </div>

            {/* Monthly Breakdown */}
            <div className="mb-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center"><DollarSign size={16} className="mr-1"/> Monthly Package</h3>
              <div className="space-y-2 text-sm font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center"><span className="text-slate-600 font-bold">Base Salary</span><span className="font-mono text-base">${formatMoney(baseSalary)}</span></div>
                
                {allowances.map(al => (
                  <div key={al.id} className="flex justify-between items-center pl-4 border-l-2 border-emerald-200">
                    <span className="text-slate-500">Allowance: {al.type || 'Unnamed'}</span>
                    <span className="font-mono text-slate-600">+ ${formatMoney(al.amount)}</span>
                  </div>
                ))}
                
                <div className="flex justify-between pt-3 mt-2 border-t border-slate-200 text-lg font-black">
                  <span className="text-slate-900">Total Monthly Gross</span>
                  <span className="text-emerald-600 font-mono">${formatMoney(monthlyGross)}</span>
                </div>
              </div>
            </div>

            {/* Bonuses */}
            {bonuses.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-3 flex items-center"><Gift size={16} className="mr-1"/> Variable Bonuses</h3>
                <div className="space-y-3">
                  {bonuses.map((b, idx) => (
                    <div key={b.id} className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block mb-1">Bonus Tier {idx + 1}</span>
                        <p className="text-sm text-indigo-900 font-medium leading-snug">{b.requirement || '[Requirement not specified]'}</p>
                      </div>
                      <span className="text-lg font-black text-indigo-600 shrink-0 font-mono">${formatMoney(b.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leave & Operational Clause */}
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-800 mb-2 flex items-center"><CalendarDays size={14} className="mr-1"/> Leaves & Entitlements</h4>
                <ul className="text-sm text-amber-900 space-y-2 list-disc pl-4 marker:text-amber-400">
                  <li>You are entitled to <strong>{annualLeave} days</strong> of paid Annual Leave per calendar year.</li>
                  <li>You are provided a Medical (MC) Allowance of up to <strong>{mcAllowance} days</strong> per calendar year. Appropriate medical certificates must be produced.</li>
                </ul>
              </div>
            </div>

            {/* Annual Package View */}
            <div className="mt-8 p-5 bg-slate-900 rounded-2xl text-white">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center"><Calculator size={14} className="mr-1"/> Total Estimated Annual Value</h3>
              <div className="flex justify-between items-end">
                <span className="text-xs text-slate-300 max-w-[60%]">Assuming 12 months of service and all bonus targets are met.</span>
                <span className="text-3xl font-black tracking-tighter text-emerald-400 font-mono">${formatMoney(standardAnnualTotal)}</span>
              </div>
            </div>

          </div>

          {/* Signature Area */}
          <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0 flex gap-3">
            <button className="flex-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl transition-all">
              Save as Draft
            </button>
            <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow-lg transition-all flex items-center justify-center">
              <CheckCircle className="mr-2" size={18} /> Finalize Contract
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================
export function EmployeeModule() {
  const [activeTab, setActiveTab] = useState('Directory');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmployees = MOCK_EMPLOYEES.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
            <Users className="mr-3 text-blue-600" size={28} />
            Employee Management
          </h1>
          <p className="text-base text-slate-500 mt-1">
            Track attendance, payroll, MOM levies, and leave entitlements.
          </p>
        </div>
        <button className="flex items-center rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95">
          <Plus className="mr-2" size={18} /> Add Employee
        </button>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex space-x-2 mb-6 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'Directory', icon: Users },
          { id: 'Contracts', icon: FileText },
          { id: 'Attendance & OT', icon: Clock },
          { id: 'Leave Entitlement', icon: CalendarDays },
          { id: 'Payroll & Payslips', icon: DollarSign }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200' 
                : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'
            }`}
          >
            <tab.icon size={16} className="mr-2" />
            {tab.id}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: DIRECTORY */}
      {activeTab === 'Directory' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
          
          {/* Search Bar */}
          <div className="p-5 border-b border-slate-100 flex items-center bg-slate-50">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm w-full max-w-md">
              <Search className="text-slate-400 mr-2" size={18} />
              <input
                type="text"
                placeholder="Search staff by name or role..."
                className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Employee Table */}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                  <th className="p-5 pl-8">Employee</th>
                  <th className="p-5">Employment Type</th>
                  <th className="p-5">Basic Salary</th>
                  <th className="p-5">Levy / CPF</th>
                  <th className="p-5 text-right pr-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-blue-50 transition-colors group">
                    <td className="p-5 pl-8">
                      <div className="font-bold text-slate-800">{emp.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{emp.role} • {emp.id}</div>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                        emp.type === 'Citizen' || emp.type === 'PR' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {emp.type}
                      </span>
                      {emp.workPassExpiry && (
                        <div className="flex items-center text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">
                          <AlertCircle size={10} className="mr-1" /> Expiry: {emp.workPassExpiry}
                        </div>
                      )}
                    </td>
                    <td className="p-5 font-medium text-slate-800">
                      ${formatMoney(emp.basicSalary)} <span className="text-xs text-slate-400">/mth</span>
                    </td>
                    <td className="p-5">
                      {emp.cpfEligible ? (
                        <span className="text-emerald-600 font-bold text-xs uppercase tracking-wider">CPF Eligible</span>
                      ) : (
                        <div>
                          <span className="text-amber-600 font-bold text-xs uppercase tracking-wider">MOM Levy</span>
                          <div className="font-medium text-slate-800">${formatMoney(emp.levy)}</div>
                        </div>
                      )}
                    </td>
                    <td className="p-5 pr-8 text-right">
                      <button className="text-slate-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CONTRACTS */}
      {activeTab === 'Contracts' && <EmployeeContractForm employees={MOCK_EMPLOYEES} />}

      {/* PLACEHOLDER FOR OTHER TABS */}
      {activeTab !== 'Directory' && activeTab !== 'Contracts' && (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-slate-200 border-dashed animate-in fade-in duration-300">
          <FileText size={48} className="text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Under Construction</h3>
          <p className="text-sm text-slate-500 mt-1">The {activeTab} module is currently being built.</p>
        </div>
      )}

    </div>
  );
}
