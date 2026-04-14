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
  FileText
} from 'lucide-react';
import { formatMoney } from '../../utils/format';

// MOCK DATA: We will eventually pull this from your 'sys' database
const MOCK_EMPLOYEES = [
  {
    id: 'EMP-001',
    name: 'Yeo Min',
    role: 'Warehouse Manager',
    status: 'Active',
    type: 'Citizen', // Citizen, PR, WP, SP, EP
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
    type: 'WP', // Work Permit
    basicSalary: 1800,
    levy: 450, // MOM Levy Fee
    cpfEligible: false,
    leaveEntitlement: 7,
    leavesTaken: 0,
    sickLeavesTaken: 0,
    workPassExpiry: '2026-11-15',
  }
];

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
      <div className="flex space-x-2 mb-6 border-b border-slate-200 pb-2">
        {[
          { id: 'Directory', icon: Users },
          { id: 'Attendance & OT', icon: Clock },
          { id: 'Leave Entitlement', icon: CalendarDays },
          { id: 'Payroll & Payslips', icon: DollarSign }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
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
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          
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
          <table className="w-full text-left border-collapse">
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
      )}

      {/* PLACEHOLDER FOR OTHER TABS */}
      {activeTab !== 'Directory' && (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-slate-200 border-dashed">
          <FileText size={48} className="text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Under Construction</h3>
          <p className="text-sm text-slate-500 mt-1">The {activeTab} module is currently being built.</p>
        </div>
      )}

    </div>
  );
}
