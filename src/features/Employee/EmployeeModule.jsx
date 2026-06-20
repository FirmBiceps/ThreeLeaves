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
  Calculator
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
function EmployeeContractForm() {
  const [employee, setEmployee] = useState({ name: '', role: '', effectiveDate: '2026-01-01' });
  
  // Financials
  const [baseSalary, setBaseSalary] = useState(2500);
  const [allowance, setAllowance] = useState(300);
  
  // Bonus & Tiers
  const [bonusTarget, setBonusTarget] = useState(2500); 
  const [earlyWithdrawalPenalty, setEarlyWithdrawalPenalty] = useState(50); 
  
  // Leave & Entitlements
  const [annualLeave, setAnnualLeave] = useState(14);
  const [medicalLeave, setMedicalLeave] = useState(14);
  const [leaveNoticeDays, setLeaveNoticeDays] = useState(14); 
  
  // Penalty Triggers
  const [lateNoticePenalty, setLateNoticePenalty] = useState(100);

  // Live Calculations
  const monthlyGross = Number(baseSalary) + Number(allowance);
  const standardAnnualTotal = (monthlyGross * 12) + Number(bonusTarget);
  const earlyDepartureBonus = Number(bonusTarget) * (1 - (Number(earlyWithdrawalPenalty) / 100));

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-12 animate-in fade-in duration-300">
      
      {/* LEFT COLUMN: EMPLOYER CONTROL PANEL */}
      <div className="w-full lg:w-1/2 space-y-6">
        
        {/* Section 1: Basic Info */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center">
            <User size={16} className="mr-2" /> Employee Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
              <input type="text" value={employee.name} onChange={e => setEmployee({...employee, name: e.target.value})} placeholder="e.g. John Doe" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Job Role</label>
              <input type="text" value={employee.role} onChange={e => setEmployee({...employee, role: e.target.value})} placeholder="e.g. Warehouse Manager" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Effective Date</label>
              <input type="date" value={employee.effectiveDate} onChange={e => setEmployee({...employee, effectiveDate: e.target.value})} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Section 2: Core Compensation */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center">
            <DollarSign size={16} className="mr-2" /> Monthly Package
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Base Salary ($)</label>
              <input type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Allowances ($)</label>
              <input type="number" value={allowance} onChange={e => setAllowance(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
        </div>

        {/* Section 3: Bonus & Early Withdrawal Logic */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-3xl shadow-sm border border-indigo-100">
          <h2 className="text-sm font-black uppercase tracking-widest text-indigo-800 mb-4 flex items-center">
            <Gift size={16} className="mr-2" /> Tiered Bonus & Withdrawal Rules
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-indigo-900 mb-1">Tier 1: Full 1-Year Bonus Target ($)</label>
              <input type="number" value={bonusTarget} onChange={e => setBonusTarget(e.target.value)} className="w-full border border-indigo-200 rounded-xl p-2.5 text-sm font-bold text-indigo-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-900 mb-1">Early Withdrawal Penalty (%)</label>
              <div className="flex items-center space-x-3">
                <input type="range" min="0" max="100" value={earlyWithdrawalPenalty} onChange={e => setEarlyWithdrawalPenalty(e.target.value)} className="w-full accent-indigo-600" />
                <span className="text-sm font-black text-indigo-900 w-12">{earlyWithdrawalPenalty}%</span>
              </div>
              <p className="text-[10px] text-indigo-600 mt-1 font-medium">If drawn before 1 year, bonus drops from ${bonusTarget} to ${earlyDepartureBonus}.</p>
            </div>
          </div>
        </div>

        {/* Section 4: Leave & Operational Penalties */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center">
            <Calendar size={16} className="mr-2" /> Entitlements & Penalties
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Annual Leave (Days)</label>
              <input type="number" value={annualLeave} onChange={e => setAnnualLeave(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Medical Leave (Days)</label>
              <input type="number" value={medicalLeave} onChange={e => setMedicalLeave(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none" />
            </div>
          </div>
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3">
            <div>
              <label className="block text-xs font-bold text-orange-800 mb-1">Min. Leave Notice Period (Days)</label>
              <input type="number" value={leaveNoticeDays} onChange={e => setLeaveNoticeDays(e.target.value)} className="w-full border border-orange-200 rounded-xl p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-orange-800 mb-1">Last-Minute Notice Penalty ($)</label>
              <input type="number" value={lateNoticePenalty} onChange={e => setLateNoticePenalty(e.target.value)} className="w-full border border-orange-200 rounded-xl p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: LIVE EMPLOYEE PREVIEW */}
      <div className="w-full lg:w-1/2">
        <div className="sticky top-0 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-auto max-h-[80vh]">
          
          {/* Document Header */}
          <div className="bg-slate-900 p-6 text-white text-center shrink-0">
            <h2 className="text-xl font-black uppercase tracking-widest">Compensation Agreement</h2>
            <p className="text-slate-400 mt-1 text-sm">Three Leaves (Singapore) Trading Enterprise</p>
          </div>

          <div className="p-8 overflow-y-auto flex-1 text-slate-800">
            <div className="mb-6 border-b border-slate-200 pb-6">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Prepared For</p>
              <p className="text-2xl font-black">{employee.name || '[Employee Name]'}</p>
              <p className="text-lg text-slate-600">{employee.role || '[Job Position]'} • Effective: {employee.effectiveDate}</p>
            </div>

            {/* Monthly Breakdown */}
            <div className="mb-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center"><DollarSign size={16} className="mr-1"/> Monthly Package</h3>
              <div className="space-y-2 text-sm font-medium">
                <div className="flex justify-between"><span className="text-slate-500">Base Salary</span><span>${formatMoney(baseSalary)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Guaranteed Allowances</span><span>${formatMoney(allowance)}</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-100 text-lg font-black"><span className="text-slate-900">Total Monthly Gross</span><span className="text-emerald-600">${formatMoney(monthlyGross)}</span></div>
              </div>
            </div>

            {/* Annual Package View */}
            <div className="mb-8 p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center"><Calculator size={16} className="mr-1"/> Estimated Annual Value</h3>
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-slate-500">Inclusive of Base, Allowances & Tier 1 Bonus</span>
                <span className="text-3xl font-black tracking-tighter text-slate-900">${formatMoney(standardAnnualTotal)}</span>
              </div>
            </div>

            {/* Strict Terms */}
            <div className="space-y-6">
              
              {/* Bonus Clause */}
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <h4 className="text-xs font-black uppercase tracking-widest text-indigo-800 mb-2 flex items-center"><Gift size={14} className="mr-1"/> Bonus & Early Withdrawal Terms</h4>
                <ul className="text-sm text-indigo-900 space-y-2 list-disc pl-4 marker:text-indigo-300">
                  <li>A Tier 1 performance bonus of <strong>${formatMoney(bonusTarget)}</strong> will be awarded upon completion of 1 full year of service.</li>
                  <li><strong>Early Withdrawal Flexibility:</strong> Employees may request to draw their bonus early or resign before the 1-year mark. In such events, the bonus is subject to a <strong>{earlyWithdrawalPenalty}% penalty</strong>, reducing the payout to <strong>${formatMoney(earlyDepartureBonus)}</strong>.</li>
                </ul>
              </div>

              {/* Operations Clause */}
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                <h4 className="text-xs font-black uppercase tracking-widest text-orange-800 mb-2 flex items-center"><AlertTriangle size={14} className="mr-1"/> Operational & Leave Protocol</h4>
                <ul className="text-sm text-orange-900 space-y-2 list-disc pl-4 marker:text-orange-300">
                  <li>Entitled to <strong>{annualLeave} Days</strong> Annual Leave and <strong>{medicalLeave} Days</strong> Medical Leave per annum.</li>
                  <li>All non-medical leave must be declared exactly <strong>{leaveNoticeDays} days</strong> in advance.</li>
                  <li>Failure to provide the required notice will result in a <strong>${formatMoney(lateNoticePenalty)} penalty deduction</strong> per infraction, which may affect subsequent bonus appraisals.</li>
                </ul>
              </div>

            </div>
          </div>

          {/* Signature Area */}
          <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0">
            <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center">
              <CheckCircle className="mr-2" size={20} /> I Read & Accept These Terms
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-3 font-bold uppercase tracking-widest">Digital Signature Required for Acknowledgment</p>
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
      {activeTab === 'Contracts' && <EmployeeContractForm />}

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
