import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Trash2,
  Briefcase,
  Printer,
  Edit3,
  X,
  Save,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Lock,
  Table2,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';

// ==========================================
// MOCK DATA
// ==========================================
const DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE = 5;

const MOCK_EMPLOYEES = [
  { id: 'EMP-001', name: 'Yeo Min', role: 'Warehouse Manager', status: 'Active', type: 'Citizen', basicSalary: 3500, levy: 0, cpfEligible: true, leaveEntitlement: 14, leavesTaken: 2, sickLeavesTaken: 1, workPassExpiry: null },
  { id: 'EMP-002', name: 'Kyaw Zin', role: 'Delivery Driver', status: 'Active', type: 'WP', basicSalary: 1800, levy: 450, cpfEligible: false, leaveEntitlement: 7, leavesTaken: 0, sickLeavesTaken: 0, workPassExpiry: '2026-11-15' }
];

const TIME_OPTIONS = [
  "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM", "08:00 AM", "08:30 AM",
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM",
  "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM",
];

// Helper to add commas to numbers (e.g., 2500 -> 2,500)
const formatWithCommas = (num) => {
  if (!num) return '0';
  return Number(num).toLocaleString('en-SG');
};

// ==========================================
// COMPONENT: CONTRACT GENERATOR
// ==========================================
function EmployeeContractForm({ employees }) {
  // Employee Target
  const [selectedEmpId, setSelectedEmpId] = useState('DRAFT');
  const [employeeName, setEmployeeName] = useState('');
  const [nric, setNric] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Logistics cum Transport Operator');
  
  // Dates & Probation
  const [commencementDate, setCommencementDate] = useState('2025-10-01');
  const [probationMonths, setProbationMonths] = useState(3);
  
  // Financials
  const [payBasis, setPayBasis] = useState('monthly_salary');
  const [baseSalary, setBaseSalary] = useState(2000);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [paymentInterval, setPaymentInterval] = useState('monthly');
  
  // Dynamic Arrays
  const [allowances, setAllowances] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  
  // Work Hours & Entitlements
  const [startTime, setStartTime] = useState('11:00 AM');
  const [endTime, setEndTime] = useState('08:00 PM');
  const [workDays, setWorkDays] = useState(6);
  const [annualLeave, setAnnualLeave] = useState(7);
  const [mcAllowance, setMcAllowance] = useState(14);
  const [hospLeave, setHospLeave] = useState(30);

  // Custom Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [customContractHTML, setCustomContractHTML] = useState(null);
  const editorRef = useRef(null);

  // --- Handlers ---
  const handleEmployeeSelect = (e) => {
    const id = e.target.value;
    setSelectedEmpId(id);
    if (id === 'DRAFT' || id === 'NEW') {
      setEmployeeName(''); setNric(''); setPhone('');
      setRole('Logistics cum Transport Operator'); setPayBasis('monthly_salary'); setBaseSalary(2000); setHourlyRate(0); setPaymentInterval('monthly');
    } else if (id) {
      const emp = employees.find(emp => emp.id === id);
      if (emp) {
        setEmployeeName(emp.name || '');
        setNric(emp.nricFin || '');
        setPhone(emp.phone || '');
        setRole(emp.role || '');
        setPayBasis(emp.payBasis || 'monthly_salary');
        setBaseSalary(emp.basicSalary || 0);
        setHourlyRate(emp.hourlyRate || 0);
        setPaymentInterval(emp.paymentInterval || 'monthly');
        setAnnualLeave(emp.leaveEntitlement || 0);
        if (emp.commencementDate) setCommencementDate(emp.commencementDate);
        if (emp.probationMonths) setProbationMonths(emp.probationMonths);
      }
    }
  };

  const addAllowance = () => setAllowances([...allowances, { id: Date.now(), type: '', amount: 0 }]);
  const removeAllowance = (id) => setAllowances(allowances.filter(a => a.id !== id));
  const updateAllowance = (id, field, value) => setAllowances(allowances.map(a => a.id === id ? { ...a, [field]: value } : a));

  const addBonus = () => setBonuses([...bonuses, { id: Date.now(), requirement: '', amount: 0 }]);
  const removeBonus = (id) => setBonuses(bonuses.filter(b => b.id !== id));
  const updateBonus = (id, field, value) => setBonuses(bonuses.map(b => b.id === id ? { ...b, [field]: value } : b));
  
  const handlePrint = () => window.print();

  // --- Editor Handlers ---
  const openEditor = () => {
    setIsEditorOpen(true);
  };

  const saveCustomEdits = () => {
    if (editorRef.current) {
      setCustomContractHTML(editorRef.current.innerHTML);
    }
    setIsEditorOpen(false);
  };

  const resetToDefault = () => {
    if (window.confirm("Are you sure you want to reset all custom text edits? This will rebuild the contract using the default template.")) {
      setCustomContractHTML(null);
      setIsEditorOpen(false);
    }
  };

  // --- Calculations ---
  const probationEndObj = new Date(commencementDate);
  probationEndObj.setMonth(probationEndObj.getMonth() + Number(probationMonths));
  const probationEndDate = isNaN(probationEndObj) ? '-' : probationEndObj.toLocaleDateString('en-GB');
  const formattedCommencement = isNaN(new Date(commencementDate)) ? '-' : new Date(commencementDate).toLocaleDateString('en-GB');

  // ==========================================
  // PURE CONTRACT TEMPLATE
  // ==========================================
  const BaseContractContent = () => (
    <div className="text-black font-serif text-[11pt] leading-relaxed pb-12">
      <div className="text-center mb-6">
        <h1 className="text-[16pt] font-black m-0">THREE LEAVES PTE. LTD.</h1>
        <h2 className="text-[14pt] font-bold underline m-0 mt-1">EMPLOYMENT CONTRACT AGREEMENT</h2>
      </div>

      <p className="mb-4">We are pleased to offer you a full-time position with us. The attached terms and conditions of our offer are outlined below:</p>
      
      <table className="w-full mb-6 border-collapse">
        <tbody>
          <tr><td className="w-1/4 font-bold">Employer:</td><td>THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</td></tr>
          <tr><td className="font-bold">Address:</td><td>280 Woodlands Industrial Park E5 #06-35 Harvest @ Singapore 757322</td></tr>
          <tr><td className="font-bold">Registration No:</td><td>53033969B</td></tr>
        </tbody>
      </table>

      <div className="border border-black p-3 mb-6">
        <strong>Employee Details</strong><br/>
        <table className="w-full mt-2">
          <tbody>
            <tr>
              <td className="w-1/2">Name: {employeeName || '___________________________'}</td>
              <td>NRIC/FIN: {nric || '___________________'}</td>
            </tr>
            <tr>
              <td className="w-1/2 mt-2 inline-block">Phone No: {phone || '___________________'}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="font-bold uppercase mt-6 mb-2">1. DESIGNATION & JOB SCOPE</div>
      <p className="mb-2">1.1 The Employee shall be employed as a <strong>{role || '___________________'}</strong> and shall be primarily responsible for the duties as part of the Employer's operations. The Employee’s core duties include, but are not limited to, the following:</p>
      <ul className="list-disc pl-6 mb-2 space-y-1">
        <li><strong>Delivery of Goods:</strong> The Employee will be responsible for the safe and efficient transportation of goods from the Employer's premises to designated locations.</li>
        <li><strong>Loading and Unloading:</strong> The Employee may be required to assist in the loading and unloading of goods and materials.</li>
        <li><strong>Warehouse-Related Functions:</strong> The Employee may be asked to perform general warehouse duties, including picking goods and organizing stock.</li>
        <li><strong>Vehicle Maintenance and Safety:</strong> The Employee is responsible for performing basic maintenance checks on the vehicle used.</li>
      </ul>
      <p className="mb-2">1.2 The Employer may require the Employee to perform tasks and duties not explicitly stated above, but which are reasonably within the scope of the role.</p>

      <div className="font-bold uppercase mt-6 mb-2">2. COMMENCEMENT & DURATION OF EMPLOYMENT</div>
      <p className="mb-2">2.1 This Contract shall commence on <strong>{formattedCommencement}</strong> and shall continue in effect until terminated by either party.</p>
      <p className="mb-2">2.2 The Employee shall serve a mandatory <strong>{probationMonths} months</strong> probation period. The slated date for the end of probation is on <strong>{probationEndDate}</strong>.</p>
      <p className="mb-2"><strong>Medical Leave:</strong> Any medical leave taken during the probationary period will be considered unpaid. Should the employee incur prolonged medical leave, the Employer reserves the right to review the employee's suitability for the role.</p>
      <p className="mb-2"><strong>Unpaid Leave:</strong> During the probationary period, the Employee shall not be entitled to paid leave, except in cases of compassionate grounds.</p>

      <div className="font-bold uppercase mt-6 mb-2">3. SALARY & COMPENSATION</div>
      {payBasis === 'hourly' ? (
        <p className="mb-2">3.1 The Employer agrees to pay the Employee an hourly rate of <strong>S${formatWithCommas(hourlyRate)}</strong> for approved working hours recorded by the Employer.</p>
      ) : (
        <p className="mb-2">3.1 The Employer agrees to pay the Employee a gross monthly salary of <strong>S${formatWithCommas(baseSalary)}</strong> whilst on probation, which includes the base salary for the agreed working hours.</p>
      )}
      {allowances.length > 0 && (
        <p className="mb-2">Additionally, the Employee is entitled to the following allowances: {allowances.map(a => `${a.type || 'Allowance'} (S$${formatWithCommas(a.amount)})`).join(', ')}.</p>
      )}
      <p className="mb-2">3.2 Salary will be paid on a <strong>{paymentInterval === 'weekly' ? 'weekly' : 'monthly'}</strong> basis by the Employee's nominated payment method.</p>
      {bonuses.length > 0 && (
        <p className="mb-2">3.3 <strong>Variable Bonuses:</strong> {bonuses.map(b => `S$${formatWithCommas(b.amount)} subject to: ${b.requirement}`).join('; ')}.</p>
      )}

      <div className="font-bold uppercase mt-6 mb-2">4. WORK HOURS</div>
      <p className="mb-2">4.1 The Employee’s regular working hours shall be from <strong>{startTime} to {endTime}</strong>, <strong>{workDays} days</strong> per week.</p>
      <p className="mb-2">4.2 It is a condition of employment that you may need to work outside these regular hours from time to time.</p>

      <div className="font-bold uppercase mt-6 mb-2">5. LEAVE ENTITLEMENT</div>
      <p className="mb-2">5.1 The Employee is entitled to <strong>{annualLeave} days</strong> Annual Leave per year and Public Holidays in accordance with Singapore laws.</p>
      <p className="mb-2">5.2 The Employee’s leave entitlement will only take effect after they serve the probationary period.</p>
      <p className="mb-2">5.3 Approval of leave is at the sole discretion of the Employer.</p>
      <p className="mb-2">5.4 Off-in-Lieu: If required to work on a public holiday, time off in lieu may be granted.</p>

      <div className="font-bold uppercase mt-6 mb-2">6. MEDICAL BENEFIT</div>
      <p className="mb-2">6.1 You are entitled to <strong>{mcAllowance} days</strong> paid sick leave, requiring a medical certificate within Singapore.</p>
      <p className="mb-2">6.2 You are entitled to <strong>{hospLeave} days</strong> paid hospitalization leave.</p>
      <p className="mb-2">6.3 Sick and hospitalization leave entitlement will commence after your probation period.</p>

      <div className="font-bold uppercase mt-6 mb-2">7. CONFIDENTIALITY & NON-DISCLOSURE</div>
      <p className="mb-2">7.1 The Employee agrees not to disclose or use any confidential information or trade secrets of the Employer.</p>
      <p className="mb-2">7.2 This obligation survives the termination of employment.</p>

      <div className="font-bold uppercase mt-6 mb-2">8. NON-COMPETE AND CONFLICT OF INTEREST</div>
      <p className="mb-2">8.1 The Employee agrees that for a period of 1 Year following termination, they shall not engage in or consult for any business that competes with the Employer.</p>
      <p className="mb-2">8.2 The Employee acknowledges these restrictions are reasonable to protect the Employer's business interests.</p>

      <div className="font-bold uppercase mt-6 mb-2">9. TERMINATION</div>
      <p className="mb-2">9.1 The Employee may terminate this Contract by providing 1 month written notice.</p>
      <p className="mb-2">9.2 The Employer may terminate employment with or without notice for Misconduct, Poor Performance, or Incapacity.</p>

      <div className="font-bold uppercase mt-6 mb-2">10. EMPLOYEE’S OBLIGATION</div>
      <p className="mb-2">10.1 Comply with all workplace policies. 10.2 Maintain proper conduct. 10.3 Comply with traffic laws when operating vehicles. 10.6 The Employee may be held responsible for costs due to misconduct.</p>

      <div className="font-bold uppercase mt-6 mb-2">11. COMPANY VEHICLE USAGE</div>
      <p className="mb-2">11.1 The vehicle is solely for commuting. Unauthorized private use is strictly prohibited. The Employee is liable for private use incidents.</p>

      <div className="font-bold uppercase mt-6 mb-2">12. AMENDMENTS OF TERMS</div>
      <p className="mb-2">12.1 The Employer reserves the right to amend the terms provided they comply with Singapore’s Employment Act.</p>

      <div className="font-bold uppercase mt-6 mb-2">13. GOVERNING LAW</div>
      <p className="mb-2">13.1 This Contract shall be governed by the laws of the Republic of Singapore.</p>

      <div className="font-bold uppercase mt-6 mb-2">14. ACKNOWLEDGEMENT AND ACCEPTANCE</div>
      <p className="mb-2">By signing this Employment Contract, the Employee acknowledges that they have read, understood, and agree to the terms.</p>

      <div className="mt-12 pt-8">
        <p className="mb-8">I, <strong>{employeeName || '___________________________'}</strong>, I/C No. <strong>{nric || '___________________'}</strong> confirm that I have read, understood and accept the terms and conditions of employment set out in this Contract.</p>
        <table className="w-full mt-8">
          <tbody>
            <tr>
              <td className="w-1/2">Signature: _______________________________</td>
              <td>Date: __________________________________</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      {/* HIDDEN BASE TEMPLATE (Used to grab initial HTML for the editor) */}
      <div id="hidden-base-template" className="hidden">
        <BaseContractContent />
      </div>

      {/* ========================================== */}
      {/* EDITOR MODAL (POPUP) */}
      {/* ========================================== */}
      {isEditorOpen && createPortal(
        <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-6 animate-in fade-in">
          <div className="bg-slate-100 rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-800 flex items-center">
                  <Edit3 size={20} className="mr-2 text-blue-600" />
                  Live Document Editor
                </h2>
                <p className="text-xs text-slate-500 mt-1">Click anywhere inside the document below to type, delete, or rewrite the content freely.</p>
              </div>
              <button onClick={() => setIsEditorOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* WYSIWYG Editor Container */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-200 flex justify-center">
              <div 
                ref={editorRef}
                contentEditable={true}
                suppressContentEditableWarning={true}
                className="bg-white p-[15mm] shadow-lg w-full max-w-[210mm] min-h-[297mm] outline-none border border-slate-300 focus:ring-4 focus:ring-blue-500/20 transition-shadow"
                dangerouslySetInnerHTML={{ 
                  __html: customContractHTML || document.getElementById('hidden-base-template').innerHTML 
                }}
              />
            </div>

            <div className="bg-white px-6 py-4 border-t border-slate-200 flex justify-between items-center shrink-0">
              <button onClick={resetToDefault} className="flex items-center text-sm font-bold text-red-500 hover:text-red-700 px-4 py-2 hover:bg-red-50 rounded-xl transition-colors">
                <RotateCcw size={16} className="mr-2" /> Reset to Default
              </button>
              <div className="flex gap-3">
                <button onClick={() => setIsEditorOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={saveCustomEdits} className="flex items-center px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all">
                  <Save size={16} className="mr-2" /> Save Modifications
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ========================================== */}
      {/* SCREEN UI */}
      {/* ========================================== */}
      <div id="screen-ui" className="flex flex-col lg:flex-row gap-8 pb-12 animate-in fade-in duration-300">
        
        {/* LEFT COLUMN: EMPLOYER CONTROL PANEL */}
        <div className="w-full lg:w-[45%] space-y-6">
          
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center"><User size={16} className="mr-2" /> Target Employee</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <select value={selectedEmpId} onChange={handleEmployeeSelect} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none">
                  <option value="DRAFT">📝 Template / Interview Draft Mode</option>
                  <option disabled>──────────────────────────</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>Assign to: {emp.name} ({emp.role})</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
                <input type="text" value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Leave blank for signature line..." className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">NRIC / FIN</label>
                <input type="text" value={nric} onChange={e => setNric(e.target.value)} placeholder="S1234567A" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none uppercase" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Phone No.</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="8123 4567" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center"><Briefcase size={16} className="mr-2" /> Role, Dates & Base Pay</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Job Role</label>
                <input type="text" value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-slate-800 bg-slate-50 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Commencement Date</label>
                <input type="date" value={commencementDate} onChange={e => setCommencementDate(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Probation (Months)</label>
                <input type="number" value={probationMonths} onChange={e => setProbationMonths(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Pay Basis</label>
                <select value={payBasis} onChange={e => setPayBasis(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none">
                  <option value="monthly_salary">Monthly Salary</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Payment Interval</label>
                <select value={paymentInterval} onChange={e => setPaymentInterval(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none">
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              {payBasis === 'hourly' ? (
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Hourly Rate ($)</label>
                  <input type="number" min="0" step="0.01" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-lg font-black text-blue-700 bg-blue-50/50 outline-none" />
                </div>
              ) : (
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Base Salary ($)</label>
                  <input type="number" min="0" step="0.01" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-lg font-black text-blue-700 bg-blue-50/50 outline-none" />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center"><DollarSign size={16} className="mr-2" /> Allowances</h2>
            <div className="space-y-3 mb-4">
              {allowances.map((al) => (
                <div key={al.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <div className="flex-1"><input type="text" value={al.type} onChange={e => updateAllowance(al.id, 'type', e.target.value)} placeholder="Type" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none" /></div>
                  <div className="w-28 relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span><input type="number" value={al.amount} onChange={e => updateAllowance(al.id, 'amount', e.target.value)} placeholder="0" className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-7 pr-2 text-sm font-bold text-emerald-700 outline-none" /></div>
                  <button onClick={() => removeAllowance(al.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
            <button onClick={addAllowance} className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg transition-colors w-full">+ Add Allowance</button>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center"><CalendarDays size={16} className="mr-2" /> Schedule & Leaves</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex gap-4">
                 <div className="flex-1 flex gap-2">
                   <div className="w-1/2">
                     <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Start Time</label>
                     <select value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none cursor-pointer">{TIME_OPTIONS.map(t => <option key={`start-${t}`} value={t}>{t}</option>)}</select>
                   </div>
                   <div className="w-1/2">
                     <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">End Time</label>
                     <select value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none cursor-pointer">{TIME_OPTIONS.map(t => <option key={`end-${t}`} value={t}>{t}</option>)}</select>
                   </div>
                 </div>
                 <div className="w-24">
                   <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Days/Wk</label>
                   <input type="number" value={workDays} onChange={e => setWorkDays(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none" />
                 </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Annual Leave</label>
                <input type="number" value={annualLeave} onChange={e => setAnnualLeave(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">MC (Sick Leave)</label>
                <input type="number" value={mcAllowance} onChange={e => setMcAllowance(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 outline-none" />
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: DOCUMENT PREVIEW */}
        <div className="w-full lg:w-[55%] flex flex-col h-[85vh]">
          
          {/* Preview Controls */}
          <div className="bg-slate-900 rounded-t-3xl p-5 flex justify-between items-center shrink-0 shadow-lg z-10">
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-widest flex items-center">
                <FileText size={18} className="mr-2 text-blue-400" /> Print Preview
              </h2>
              {customContractHTML && (
                <span className="inline-block mt-1 bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-amber-500/50">
                  Custom Edits Applied
                </span>
              )}
            </div>
            
            <button onClick={openEditor} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors shadow-md">
              <Edit3 size={16} className="mr-2" /> Edit Layout & Content
            </button>
          </div>

          {/* Visual Document Frame */}
          <div className="flex-1 overflow-y-auto bg-slate-200 p-8 border-x border-slate-300 shadow-inner flex justify-center">
            <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[15mm] shadow-xl pointer-events-none">
              {customContractHTML ? (
                <div dangerouslySetInnerHTML={{ __html: customContractHTML }} />
              ) : (
                <BaseContractContent />
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="bg-white p-5 rounded-b-3xl border border-slate-300 shrink-0 shadow-lg z-10 flex gap-3">
            <button onClick={handlePrint} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center text-lg">
              <Printer className="mr-3" size={24} /> Print Final Contract
            </button>
          </div>

        </div>
      </div>

      {/* ========================================== */}
      {/* EXCLUSIVE PRINT UI TELEPORTATION */}
      {/* ========================================== */}
      {createPortal(
        <div id="print-contract-ui" className="hidden">
          <style type="text/css">
            {`
              @media print {
                @page { size: A4 portrait; margin: 15mm; }
                html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                #root { display: none !important; }
                #print-contract-ui { 
                  display: block !important; 
                  position: static !important; 
                  width: 100% !important; 
                  color: black !important;
                }
              }
            `}
          </style>
          {customContractHTML ? (
            <div dangerouslySetInnerHTML={{ __html: customContractHTML }} />
          ) : (
            <BaseContractContent />
          )}
        </div>, 
        document.body
      )}
    </>
  );
}

// ==========================================
// EMPLOYEE DATA HELPERS
// ==========================================
const EMPLOYEE_TABS = [
  { id: 'Overview', icon: TrendingUp },
  { id: 'Directory', icon: Users },
  { id: 'Contracts', icon: FileText },
  { id: 'Attendance & OT', icon: Clock },
  { id: 'Part-Time Hours', icon: Table2 },
  { id: 'Leave Entitlement', icon: CalendarDays },
  { id: 'Payroll & Payslips', icon: DollarSign },
];

const EMPTY_EMPLOYEE = {
  id: null,
  employeeNo: '',
  name: '',
  role: '',
  status: 'Active',
  employmentType: 'Full-Time',
  citizenshipType: 'Citizen',
  nricFin: '',
  phone: '',
  commencementDate: '',
  probationMonths: 3,
  payBasis: 'monthly_salary',
  basicSalary: '',
  hourlyRate: '',
  dailyTransportAllowance: DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE,
  paymentInterval: 'monthly',
  cpfEligible: true,
  levy: '',
  leaveEntitlement: 14,
  sickLeaveEntitlement: 14,
  hospitalisationLeaveEntitlement: 60,
  workPassExpiry: '',
  paymentMethod: 'Bank Transfer',
  bankName: '',
  bankAccountName: '',
  bankAccountNo: '',
  notes: '',
};

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromIso(value) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function weekBounds(reference = new Date()) {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: localDateString(start), end: localDateString(end) };
}

function monthBounds(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { start: localDateString(start), end: localDateString(end) };
}

function intervalBounds(interval, dateValue) {
  const date = dateValue instanceof Date ? dateValue : dateFromIso(dateValue);
  return interval === 'monthly' ? monthBounds(date) : weekBounds(date);
}

function shiftInterval(dateValue, interval, direction) {
  const date = dateFromIso(dateValue);
  if (interval === 'monthly') date.setMonth(date.getMonth() + direction, 1);
  else date.setDate(date.getDate() + direction * 7);
  return localDateString(date);
}

function dateRange(startIso, endIso) {
  const result = [];
  const cursor = dateFromIso(startIso);
  const end = dateFromIso(endIso);
  while (cursor <= end) {
    result.push(localDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function shortDayLabel(value) {
  return dateFromIso(value).toLocaleDateString('en-SG', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function intervalLabel(startIso, endIso, interval) {
  const start = dateFromIso(startIso);
  const end = dateFromIso(endIso);
  if (interval === 'monthly') {
    return start.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })}`;
  }
  return `${start.toLocaleDateString('en-SG', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

function inRange(value, start, end) {
  const date = String(value || '').slice(0, 10);
  return date >= start && date <= end;
}

function normaliseEmployee(row) {
  return {
    id: row?.id,
    employeeNo: String(row?.employee_no ?? ''),
    name: String(row?.name ?? ''),
    role: String(row?.role ?? ''),
    status: String(row?.status ?? 'Active'),
    employmentType: String(row?.employment_type ?? 'Full-Time'),
    citizenshipType: String(row?.citizenship_type ?? 'Citizen'),
    nricFin: String(row?.nric_fin ?? ''),
    phone: String(row?.phone ?? ''),
    commencementDate: String(row?.commencement_date ?? ''),
    probationMonths: Number(row?.probation_months ?? 3) || 3,
    payBasis: String(row?.pay_basis ?? 'monthly_salary'),
    basicSalary: Number(row?.basic_salary ?? 0) || 0,
    hourlyRate: Number(row?.hourly_rate ?? 0) || 0,
    dailyTransportAllowance: Number(row?.transport_allowance_per_day ?? DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE) || DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE,
    paymentInterval: String(row?.payment_interval ?? 'monthly'),
    cpfEligible: row?.cpf_eligible !== false,
    levy: Number(row?.levy ?? 0) || 0,
    leaveEntitlement: Number(row?.leave_entitlement ?? 0) || 0,
    sickLeaveEntitlement: Number(row?.sick_leave_entitlement ?? 0) || 0,
    hospitalisationLeaveEntitlement: Number(row?.hospitalisation_leave_entitlement ?? 0) || 0,
    workPassExpiry: row?.work_pass_expiry ?? null,
    paymentMethod: String(row?.payment_method ?? 'Bank Transfer'),
    bankName: String(row?.bank_name ?? ''),
    bankAccountName: String(row?.bank_account_name ?? ''),
    bankAccountNo: String(row?.bank_account_no ?? ''),
    notes: String(row?.notes ?? ''),
  };
}

function employeePayload(employee) {
  const isPartTime = employee.employmentType === 'Part-Time';
  return {
    employee_no: String(employee.employeeNo || '').trim(),
    name: String(employee.name || '').trim(),
    role: String(employee.role || '').trim(),
    status: employee.status || 'Active',
    employment_type: employee.employmentType || 'Full-Time',
    citizenship_type: isPartTime ? 'Citizen' : (employee.citizenshipType || 'Citizen'),
    nric_fin: isPartTime ? null : (String(employee.nricFin || '').trim() || null),
    phone: String(employee.phone || '').trim() || null,
    commencement_date: employee.commencementDate || null,
    probation_months: isPartTime ? 0 : (Number(employee.probationMonths || 0) || 0),
    pay_basis: isPartTime ? 'hourly' : (employee.payBasis || 'monthly_salary'),
    basic_salary: isPartTime ? 0 : (employee.payBasis === 'monthly_salary' ? Number(employee.basicSalary || 0) || 0 : 0),
    hourly_rate: isPartTime ? Number(employee.hourlyRate || 0) || 0 : (employee.payBasis === 'hourly' ? Number(employee.hourlyRate || 0) || 0 : 0),
    transport_allowance_per_day: isPartTime ? DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE : 0,
    payment_interval: employee.paymentInterval || (isPartTime ? 'weekly' : 'monthly'),
    cpf_eligible: isPartTime ? false : Boolean(employee.cpfEligible),
    levy: isPartTime ? 0 : (Number(employee.levy || 0) || 0),
    leave_entitlement: isPartTime ? 0 : (Number(employee.leaveEntitlement || 0) || 0),
    sick_leave_entitlement: isPartTime ? 0 : (Number(employee.sickLeaveEntitlement || 0) || 0),
    hospitalisation_leave_entitlement: isPartTime ? 0 : (Number(employee.hospitalisationLeaveEntitlement || 0) || 0),
    work_pass_expiry: isPartTime ? null : (employee.workPassExpiry || null),
    payment_method: employee.paymentMethod || 'Bank Transfer',
    bank_name: isPartTime ? null : (String(employee.bankName || '').trim() || null),
    bank_account_name: isPartTime ? null : (String(employee.bankAccountName || '').trim() || null),
    bank_account_no: String(employee.bankAccountNo || '').trim() || null,
    notes: String(employee.notes || '').trim() || null,
  };
}

function nextEmployeeNo(employees) {
  const max = employees.reduce((current, employee) => {
    const match = String(employee.employeeNo || '').match(/(\d+)$/);
    return Math.max(current, match ? Number(match[1]) || 0 : 0);
  }, 0);
  return `EMP-${String(max + 1).padStart(3, '0')}`;
}

function employeePayLabel(employee) {
  return employee.payBasis === 'hourly' || employee.employmentType === 'Part-Time'
    ? `$${formatMoney(employee.hourlyRate)}/hr`
    : `$${formatMoney(employee.basicSalary)}/mth`;
}

function timeMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function clockedHours(clockIn, clockOut, breakMinutes = 0) {
  const start = timeMinutes(clockIn);
  let end = timeMinutes(clockOut);
  if (start === null || end === null) return 0;
  if (end < start) end += 1440;
  return Math.max(0, (end - start - Number(breakMinutes || 0)) / 60);
}

function attendanceHours(row) {
  return Number(row?.regular_hours || 0) + Number(row?.overtime_hours || 0);
}

function durationLabel(hours) {
  const safe = Math.max(0, Number(hours || 0));
  const totalMinutes = Math.round(safe * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!wholeHours && !minutes) return '—';
  if (!minutes) return `${wholeHours}h 00m`;
  return `${wholeHours}h ${String(minutes).padStart(2, '0')}m`;
}

function signedMoney(value) {
  const amount = Number(value || 0);
  const absolute = `$${formatMoney(Math.abs(amount))}`;
  return amount < 0 ? `-${absolute}` : absolute;
}

function inclusiveDays(startValue, endValue) {
  if (!startValue || !endValue) return 0;
  const start = dateFromIso(startValue);
  const end = dateFromIso(endValue);
  if (end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function employeeIssues(employee) {
  const issues = [];
  if (!employee.role) issues.push('Role');
  if (employee.employmentType === 'Part-Time') {
    if (!(employee.hourlyRate > 0)) issues.push('Hourly Rate');
    if (!employee.paymentInterval) issues.push('Pay Cycle');
    return issues;
  }
  if (!employee.phone) issues.push('Phone');
  if (!employee.nricFin) issues.push('NRIC / FIN');
  if (employee.payBasis === 'hourly' && !(employee.hourlyRate > 0)) issues.push('Hourly Rate');
  if (employee.payBasis === 'monthly_salary' && !(employee.basicSalary > 0)) issues.push('Basic Salary');
  if (!employee.paymentInterval) issues.push('Pay Cycle');
  if (String(employee.paymentMethod).toLowerCase().includes('bank') && !employee.bankAccountNo) issues.push('Bank Details');
  if (['WP', 'SP', 'EP'].includes(employee.citizenshipType) && !employee.workPassExpiry) issues.push('Work Pass Expiry');
  return issues;
}

function SummaryCard({ label, value, detail, icon: Icon, tone = 'blue', onClick }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  }[tone] || 'bg-blue-50 text-blue-600';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}><Icon size={18} /></div>
      </div>
    </Tag>
  );
}

function StatusBadge({ status }) {
  const value = String(status || '—');
  const lower = value.toLowerCase();
  const classes = lower === 'paid' || lower === 'active' || lower === 'approved'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : lower === 'ready' || lower === 'allocated' || lower === 'recorded'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : lower === 'pending' || lower === 'draft' || lower === 'due' || lower === 'carry forward'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-slate-50 text-slate-600';
  return <span className={`inline-flex rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${classes}`}>{value}</span>;
}

function ModalShell({ title, eyebrow, children, onClose, maxWidth = 'max-w-4xl' }) {
  return createPortal(
    <div className="fixed inset-0 z-[8000] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-4">
      <div className={`flex max-h-[94vh] w-full ${maxWidth} flex-col overflow-hidden rounded-3xl bg-white shadow-2xl`}>
        <div className="flex shrink-0 items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">{eyebrow}</p>
            <h2 className="mt-1 text-lg font-black">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-300 hover:bg-slate-800"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}


function EmployeeFormField({ label, children, className = '', hint, required = false }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-600">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[10px] leading-4 text-slate-400">{hint}</span>}
    </label>
  );
}

function EmployeeFormSection({ eyebrow, title, description, badge, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
          {title && <h3 className="mt-1 text-sm font-black text-slate-900">{title}</h3>}
          {description && <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{description}</p>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function EmployeeEditor({ employee, employees, onClose, onSave }) {
  const [form, setForm] = useState(
    employee
      ? { ...EMPTY_EMPLOYEE, ...employee }
      : {
          ...EMPTY_EMPLOYEE,
          employeeNo: nextEmployeeNo(employees),
          commencementDate: localDateString(),
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isPartTime = form.employmentType === 'Part-Time';
  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateEmploymentType = (value) => {
    setForm((current) => ({
      ...current,
      employmentType: value,
      payBasis: value === 'Part-Time' ? 'hourly' : 'monthly_salary',
      paymentInterval:
        value === 'Part-Time'
          ? current.id && current.paymentInterval
            ? current.paymentInterval
            : 'weekly'
          : current.id && current.paymentInterval
            ? current.paymentInterval
            : 'monthly',
      dailyTransportAllowance:
        value === 'Part-Time'
          ? DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE
          : current.dailyTransportAllowance,
      cpfEligible: value === 'Part-Time' ? false : current.cpfEligible,
      levy: value === 'Part-Time' ? 0 : current.levy,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!String(form.employeeNo || '').trim()) {
      setError('Employee ID is required.');
      return;
    }
    if (!String(form.name || '').trim()) {
      setError('Employee name is required.');
      return;
    }
    if (!String(form.role || '').trim()) {
      setError('Role is required.');
      return;
    }
    if (isPartTime && !(Number(form.hourlyRate) > 0)) {
      setError('Part-time employees require a valid hourly rate.');
      return;
    }
    if (!isPartTime && form.payBasis === 'hourly' && !(Number(form.hourlyRate) > 0)) {
      setError('Hourly employees require a valid hourly rate.');
      return;
    }
    if (!isPartTime && form.payBasis === 'monthly_salary' && !(Number(form.basicSalary) > 0)) {
      setError('Monthly employees require a valid basic salary.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await onSave({
        ...form,
        payBasis: isPartTime ? 'hourly' : form.payBasis,
        dailyTransportAllowance: isPartTime
          ? DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE
          : form.dailyTransportAllowance,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={employee ? 'Edit Employee' : 'Add Employee'}
      eyebrow="Employee Record"
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col bg-slate-50/70">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <EmployeeFormSection
            eyebrow="Profile"
            title="Employee details"
            description={
              isPartTime
                ? 'Keep the part-time profile simple. Daily timing, rate adjustments, transport allowance and advances are handled from the Part-Time Hours workspace.'
                : 'Core employment information used throughout contracts, attendance and payroll.'
            }
            badge={
              isPartTime ? (
                <span className="inline-flex w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-blue-700">
                  Hourly employee
                </span>
              ) : null
            }
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2 lg:grid-cols-6">
              <EmployeeFormField label="Employee ID" required className="lg:col-span-2">
                <input value={form.employeeNo} onChange={(e) => update('employeeNo', e.target.value.toUpperCase())} className={`${inputClass} font-semibold`} autoComplete="off" />
              </EmployeeFormField>

              <EmployeeFormField label="Full Name" required className="lg:col-span-4">
                <input value={form.name} onChange={(e) => update('name', e.target.value)} className={inputClass} autoComplete="name" autoFocus={!employee} />
              </EmployeeFormField>

              <EmployeeFormField label="Role" required className="lg:col-span-3">
                <input value={form.role} onChange={(e) => update('role', e.target.value)} placeholder="e.g. Warehouse Assistant" className={inputClass} autoComplete="organization-title" />
              </EmployeeFormField>

              <EmployeeFormField label="Employment Type" className="lg:col-span-2">
                <select value={form.employmentType} onChange={(e) => updateEmploymentType(e.target.value)} className={inputClass}>
                  <option>Full-Time</option>
                  <option>Part-Time</option>
                </select>
              </EmployeeFormField>

              <EmployeeFormField label="Status" className="lg:col-span-1">
                <select value={form.status} onChange={(e) => update('status', e.target.value)} className={inputClass}>
                  <option>Active</option>
                  <option>On Leave</option>
                  <option>Resigned</option>
                  <option>Terminated</option>
                </select>
              </EmployeeFormField>

              <EmployeeFormField label="Phone" className="lg:col-span-3">
                <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Optional" className={inputClass} autoComplete="tel" />
              </EmployeeFormField>

              <EmployeeFormField label="Commencement Date" className="lg:col-span-3">
                <input type="date" value={form.commencementDate || ''} onChange={(e) => update('commencementDate', e.target.value)} className={inputClass} />
              </EmployeeFormField>

              {!isPartTime && (
                <>
                  <EmployeeFormField label="Citizenship / Pass" className="lg:col-span-2">
                    <select value={form.citizenshipType} onChange={(e) => update('citizenshipType', e.target.value)} className={inputClass}>
                      <option>Citizen</option>
                      <option>PR</option>
                      <option value="WP">Work Permit</option>
                      <option value="SP">S Pass</option>
                      <option value="EP">Employment Pass</option>
                    </select>
                  </EmployeeFormField>

                  <EmployeeFormField label="NRIC / FIN" className="lg:col-span-2">
                    <input value={form.nricFin} onChange={(e) => update('nricFin', e.target.value.toUpperCase())} className={inputClass} autoComplete="off" />
                  </EmployeeFormField>

                  <EmployeeFormField label="Probation (Months)" className="lg:col-span-2">
                    <input type="number" min="0" value={form.probationMonths} onChange={(e) => update('probationMonths', e.target.value)} className={inputClass} />
                  </EmployeeFormField>

                  {['WP', 'SP', 'EP'].includes(form.citizenshipType) && (
                    <EmployeeFormField label="Work Pass Expiry" className="lg:col-span-3">
                      <input type="date" value={form.workPassExpiry || ''} onChange={(e) => update('workPassExpiry', e.target.value)} className={inputClass} />
                    </EmployeeFormField>
                  )}
                </>
              )}
            </div>
          </EmployeeFormSection>

          {isPartTime ? (
            <EmployeeFormSection
              eyebrow="Compensation"
              title="Part-time pay setup"
              description="Only recurring defaults belong here. Work-day timing, rate changes, transport and advances are entered in the timesheet and saved only when you leave the edited field."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <EmployeeFormField label="Default Hourly Rate" required hint="Starting rate for new work-day entries. Each day can still be adjusted independently.">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">$</span>
                    <input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => update('hourlyRate', e.target.value)} className={`${inputClass} pl-8 pr-14 font-mono font-black text-blue-700`} />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">/ hr</span>
                  </div>
                </EmployeeFormField>

                <EmployeeFormField label="Payment Interval" hint="Controls how the timesheet groups earnings and rolling balances.">
                  <select value={form.paymentInterval} onChange={(e) => update('paymentInterval', e.target.value)} className={inputClass}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </EmployeeFormField>

                <EmployeeFormField label="Payment Method">
                  <select value={form.paymentMethod} onChange={(e) => update('paymentMethod', e.target.value)} className={inputClass}>
                    <option>Bank Transfer</option>
                    <option>PayNow</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                  </select>
                </EmployeeFormField>

                <EmployeeFormField label="Payment Reference / Account" hint="Optional. You can also enter the payment reference only when settling a pay interval.">
                  <input value={form.bankAccountNo} onChange={(e) => update('bankAccountNo', e.target.value)} placeholder="Optional" className={inputClass} autoComplete="off" />
                </EmployeeFormField>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Transport Allowance</p>
                  <p className="mt-1 text-sm font-black text-slate-900">$5.00 per worked day</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Applied automatically. Override only on an individual work-day when necessary.</p>
                </div>
                <span className="inline-flex w-fit rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Daily override available</span>
              </div>
            </EmployeeFormSection>
          ) : (
            <>
              <EmployeeFormSection eyebrow="Compensation" title="Salary & payment setup" description="Recurring compensation settings used by contracts and payroll.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <EmployeeFormField label="Pay Basis">
                    <select value={form.payBasis} onChange={(e) => update('payBasis', e.target.value)} className={inputClass}>
                      <option value="monthly_salary">Monthly Salary</option>
                      <option value="hourly">Hourly</option>
                    </select>
                  </EmployeeFormField>
                  <EmployeeFormField label="Payment Interval">
                    <select value={form.paymentInterval} onChange={(e) => update('paymentInterval', e.target.value)} className={inputClass}>
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </EmployeeFormField>
                  {form.payBasis === 'hourly' ? (
                    <EmployeeFormField label="Hourly Rate">
                      <input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => update('hourlyRate', e.target.value)} className={`${inputClass} text-right font-mono font-black text-blue-700`} />
                    </EmployeeFormField>
                  ) : (
                    <EmployeeFormField label="Basic Salary">
                      <input type="number" min="0" step="0.01" value={form.basicSalary} onChange={(e) => update('basicSalary', e.target.value)} className={`${inputClass} text-right font-mono font-black text-blue-700`} />
                    </EmployeeFormField>
                  )}
                  <EmployeeFormField label="Payment Method">
                    <select value={form.paymentMethod} onChange={(e) => update('paymentMethod', e.target.value)} className={inputClass}>
                      <option>Bank Transfer</option>
                      <option>PayNow</option>
                      <option>Cash</option>
                      <option>Cheque</option>
                    </select>
                  </EmployeeFormField>
                  <EmployeeFormField label="Bank"><input value={form.bankName} onChange={(e) => update('bankName', e.target.value)} className={inputClass} /></EmployeeFormField>
                  <EmployeeFormField label="Account Name"><input value={form.bankAccountName} onChange={(e) => update('bankAccountName', e.target.value)} className={inputClass} /></EmployeeFormField>
                  <EmployeeFormField label="Account / PayNow Reference" className="lg:col-span-2"><input value={form.bankAccountNo} onChange={(e) => update('bankAccountNo', e.target.value)} className={inputClass} /></EmployeeFormField>
                </div>
              </EmployeeFormSection>

              <EmployeeFormSection eyebrow="Employment Admin" title="CPF, levy & leave">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <label className="flex min-h-[68px] items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                    <div><p className="text-[11px] font-bold text-slate-600">CPF Eligible</p><p className="mt-1 text-[10px] text-slate-400">Include in CPF workflow</p></div>
                    <input type="checkbox" checked={Boolean(form.cpfEligible)} onChange={(e) => update('cpfEligible', e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  </label>
                  <EmployeeFormField label="MOM Levy ($)"><input type="number" min="0" step="0.01" value={form.levy} onChange={(e) => update('levy', e.target.value)} className={inputClass} /></EmployeeFormField>
                  <EmployeeFormField label="Annual Leave"><input type="number" min="0" step="0.5" value={form.leaveEntitlement} onChange={(e) => update('leaveEntitlement', e.target.value)} className={inputClass} /></EmployeeFormField>
                  <EmployeeFormField label="Sick Leave"><input type="number" min="0" step="0.5" value={form.sickLeaveEntitlement} onChange={(e) => update('sickLeaveEntitlement', e.target.value)} className={inputClass} /></EmployeeFormField>
                  <EmployeeFormField label="Hospitalisation"><input type="number" min="0" step="0.5" value={form.hospitalisationLeaveEntitlement} onChange={(e) => update('hospitalisationLeaveEntitlement', e.target.value)} className={inputClass} /></EmployeeFormField>
                </div>
              </EmployeeFormSection>
            </>
          )}

          <EmployeeFormSection eyebrow="Internal" title="Notes">
            <textarea rows="3" value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Optional internal notes…" className={`${inputClass} min-h-[92px] resize-y leading-5`} />
          </EmployeeFormSection>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          <p className="hidden text-[10px] leading-4 text-slate-400 sm:block">Required fields are marked with <span className="text-red-500">*</span>.</p>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex min-w-[150px] items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
              {saving ? <RefreshCw size={15} className="mr-2 animate-spin" /> : <Save size={15} className="mr-2" />}
              {saving ? 'Saving…' : 'Save Employee'}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function AttendanceEditor({ employees, record, onClose, onSave }) {
  const active = employees.filter((employee) => employee.status === 'Active' && employee.employmentType !== 'Part-Time');
  const [form, setForm] = useState({
    id: record?.id || null,
    employeeId: record?.employee_id || active[0]?.id || '',
    workDate: record?.work_date || localDateString(),
    clockIn: record?.clock_in ? String(record.clock_in).slice(0, 5) : '09:00',
    clockOut: record?.clock_out ? String(record.clock_out).slice(0, 5) : '18:00',
    breakMinutes: Number(record?.break_minutes || 60),
    overtimeHours: Number(record?.overtime_hours || 0),
    status: record?.status || 'Present',
    notes: record?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const total = form.status === 'Present' ? clockedHours(form.clockIn, form.clockOut, form.breakMinutes) : 0;
  const regular = Math.max(0, total - Number(form.overtimeHours || 0));
  const cls = 'w-full rounded-xl border border-slate-200 p-3 text-sm outline-none';
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try { await onSave({ ...form, regularHours: regular }); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title={record ? 'Edit Daily Entry' : 'Add Daily Entry'} eyebrow="Attendance & OT" onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-5 overflow-y-auto p-6">
        {!active.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">There are no active full-time employees. Part-time staff use the Part-Time Hours spreadsheet.</div> : <>
          <label><span className="mb-1.5 block text-xs font-bold">Employee</span><select value={form.employeeId} onChange={(e) => setForm((current) => ({ ...current, employeeId: e.target.value }))} className={cls}>{active.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}</select></label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label><span className="mb-1.5 block text-xs font-bold">Work Date</span><input type="date" value={form.workDate} onChange={(e) => setForm((current) => ({ ...current, workDate: e.target.value }))} className={cls} /></label>
            <label><span className="mb-1.5 block text-xs font-bold">Status</span><select value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))} className={cls}><option>Present</option><option>Absent</option><option>Off</option></select></label>
            {form.status === 'Present' && <><label><span className="mb-1.5 block text-xs font-bold">Clock In</span><input type="time" value={form.clockIn} onChange={(e) => setForm((current) => ({ ...current, clockIn: e.target.value }))} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold">Clock Out</span><input type="time" value={form.clockOut} onChange={(e) => setForm((current) => ({ ...current, clockOut: e.target.value }))} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold">Break Minutes</span><input type="number" min="0" value={form.breakMinutes} onChange={(e) => setForm((current) => ({ ...current, breakMinutes: e.target.value }))} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold">Overtime Hours</span><input type="number" min="0" step="0.25" max={total} value={form.overtimeHours} onChange={(e) => setForm((current) => ({ ...current, overtimeHours: e.target.value }))} className={cls} /></label></>}
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-blue-50 p-4"><div><p className="text-[9px] font-black uppercase text-blue-500">Regular</p><p className="mt-1 text-xl font-black">{regular.toFixed(2)}</p></div><div><p className="text-[9px] font-black uppercase text-blue-500">Total</p><p className="mt-1 text-xl font-black">{total.toFixed(2)}</p></div></div>
          <label><span className="mb-1.5 block text-xs font-bold">Notes</span><textarea rows="2" value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} className={cls} /></label>
        </>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500">Cancel</button><button type="submit" disabled={saving || !active.length || !form.employeeId} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save Attendance'}</button></div>
      </form>
    </ModalShell>
  );
}

function SimpleRecordModal({ kind, employees, onClose, onSave }) {
  const active = employees.filter((employee) => employee.status === 'Active');
  const isAdvance = kind === 'advance';
  const [form, setForm] = useState(isAdvance ? { employeeId: active[0]?.id || '', date: localDateString(), amount: '', reason: '', notes: '' } : { employeeId: active[0]?.id || '', type: 'Annual', start: localDateString(), end: localDateString(), status: 'Approved', notes: '' });
  const [saving, setSaving] = useState(false);
  const cls = 'w-full rounded-xl border border-slate-200 p-3 text-sm outline-none';
  const days = isAdvance ? 0 : inclusiveDays(form.start, form.end);
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { await onSave(isAdvance ? form : { ...form, days }); } finally { setSaving(false); } };
  return (
    <ModalShell title={isAdvance ? 'Record Salary Advance' : 'Add Leave Record'} eyebrow={isAdvance ? 'Salary Advance' : 'Leave'} onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4 overflow-y-auto p-6">
        <label><span className="mb-1.5 block text-xs font-bold">Employee</span><select value={form.employeeId} onChange={(e) => setForm((current) => ({ ...current, employeeId: e.target.value }))} className={cls}>{active.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        {isAdvance ? <><div className="grid grid-cols-2 gap-4"><label><span className="mb-1.5 block text-xs font-bold">Date</span><input type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold">Amount ($)</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} className={`${cls} text-right font-black text-amber-700`} /></label></div><label><span className="mb-1.5 block text-xs font-bold">Reason</span><input value={form.reason} onChange={(e) => setForm((current) => ({ ...current, reason: e.target.value }))} className={cls} /></label></> : <><div className="grid grid-cols-2 gap-4"><label><span className="mb-1.5 block text-xs font-bold">Leave Type</span><select value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))} className={cls}><option>Annual</option><option>Sick</option><option>Hospitalisation</option><option>Unpaid</option><option>Other</option></select></label><label><span className="mb-1.5 block text-xs font-bold">Status</span><select value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))} className={cls}><option>Approved</option><option>Pending</option><option>Rejected</option></select></label><label><span className="mb-1.5 block text-xs font-bold">Start</span><input type="date" value={form.start} onChange={(e) => setForm((current) => ({ ...current, start: e.target.value }))} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold">End</span><input type="date" value={form.end} onChange={(e) => setForm((current) => ({ ...current, end: e.target.value }))} className={cls} /></label></div><div className="rounded-xl bg-violet-50 px-4 py-3 text-sm font-black text-violet-800">{days} day{days === 1 ? '' : 's'}</div></>}
        <label><span className="mb-1.5 block text-xs font-bold">Notes</span><textarea rows="2" value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} className={cls} /></label>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500">Cancel</button><button type="submit" disabled={saving || !form.employeeId || (isAdvance && !(Number(form.amount) > 0)) || (!isAdvance && days <= 0)} className={`rounded-xl px-6 py-2.5 text-sm font-black text-white disabled:opacity-50 ${isAdvance ? 'bg-amber-600' : 'bg-violet-600'}`}>{saving ? 'Saving…' : 'Save'}</button></div>
      </form>
    </ModalShell>
  );
}

function PartTimeSettlementModal({ settlement, onClose, onConfirm }) {
  const [paidAt, setPaidAt] = useState(localDateString());
  const [method, setMethod] = useState(settlement.employee.paymentMethod || 'Bank Transfer');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { await onConfirm({ paidAt, method, reference }); } finally { setSaving(false); } };
  return (
    <ModalShell title={`Settle ${settlement.employee.name}`} eyebrow="Part-Time Payment Settlement" onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-5 overflow-y-auto p-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Rolling Balance Through {settlement.bounds.end}</p><p className="mt-2 text-3xl font-black text-emerald-900">{signedMoney(settlement.totalDue)}</p><p className="mt-2 text-xs text-emerald-700">{settlement.rows.length} unsettled interval{settlement.rows.length === 1 ? '' : 's'} will be closed together.</p></div>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><div><p className="text-[9px] font-black uppercase text-slate-400">Brought Forward</p><p className="mt-1 text-lg font-black">{signedMoney(settlement.broughtForward)}</p></div><div><p className="text-[9px] font-black uppercase text-slate-400">Current Interval</p><p className="mt-1 text-lg font-black">{signedMoney(settlement.currentDue)}</p></div></div>
        <label><span className="mb-1.5 block text-xs font-bold">Payment Date</span><input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /></label>
        <label><span className="mb-1.5 block text-xs font-bold">Payment Method</span><select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 text-sm"><option>Bank Transfer</option><option>PayNow</option><option>Cash</option><option>Cheque</option></select></label>
        <label><span className="mb-1.5 block text-xs font-bold">Payment Reference</span><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" className="w-full rounded-xl border border-slate-200 p-3 text-sm" /></label>
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">This closes all unsettled part-time intervals up to the selected period end. Positive balances are pay due to the employee; negative balances are advances still owed back to the company. Future intervals are untouched.</div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-50"><CreditCard size={15} className="mr-2" />{saving ? 'Settling…' : 'Settle Through Interval'}</button></div>
      </form>
    </ModalShell>
  );
}

function PayrollEditor({ employees, attendance, advances, onClose, onGenerate }) {
  const active = employees.filter((employee) => employee.status === 'Active' && employee.employmentType !== 'Part-Time');
  const [employeeId, setEmployeeId] = useState(active[0]?.id || '');
  const employee = active.find((item) => item.id === employeeId) || null;
  const initial = employee?.paymentInterval === 'weekly' ? weekBounds() : monthBounds();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [allowances, setAllowances] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);
  const [overtimeRate, setOvertimeRate] = useState(employee?.payBasis === 'hourly' ? Number(employee.hourlyRate || 0) * 1.5 : 0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const cls = 'w-full rounded-xl border border-slate-200 p-3 text-sm outline-none';

  useEffect(() => {
    if (!employee) return;
    const bounds = employee.paymentInterval === 'weekly' ? weekBounds() : monthBounds();
    setPeriodStart(bounds.start);
    setPeriodEnd(bounds.end);
    setOvertimeRate(employee.payBasis === 'hourly' ? Number(employee.hourlyRate || 0) * 1.5 : 0);
  }, [employee?.id]);

  const rows = attendance.filter((row) => String(row.employee_id) === String(employeeId) && inRange(row.work_date, periodStart, periodEnd));
  const regularHours = rows.reduce((sum, row) => sum + Number(row.regular_hours || 0), 0);
  const overtimeHours = rows.reduce((sum, row) => sum + Number(row.overtime_hours || 0), 0);
  const pendingAdvances = advances.filter((row) => String(row.employee_id) === String(employeeId) && row.status === 'pending' && String(row.advance_date || '') <= periodEnd);
  const advanceDeductions = pendingAdvances.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const basicPay = employee?.payBasis === 'monthly_salary' ? Number(employee.basicSalary || 0) : 0;
  const hourlyPay = employee?.payBasis === 'hourly' ? regularHours * Number(employee.hourlyRate || 0) : 0;
  const overtimePay = overtimeHours * Number(overtimeRate || 0);
  const grossPay = basicPay + hourlyPay + overtimePay + Number(allowances || 0);
  const netPay = Math.max(0, grossPay - advanceDeductions - Number(otherDeductions || 0));
  const submit = async (event) => { event.preventDefault(); if (!employee) return; setSaving(true); try { await onGenerate({ employee, periodStart, periodEnd, regularHours, overtimeHours, overtimeRate: Number(overtimeRate || 0), basicPay, hourlyPay, overtimePay, allowances: Number(allowances || 0), grossPay, advanceDeductions, otherDeductions: Number(otherDeductions || 0), netPay, pendingAdvances, notes }); } finally { setSaving(false); } };

  return (
    <ModalShell title="Generate Payroll Period" eyebrow="Full-Time Payroll" onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={submit} className="space-y-5 overflow-y-auto p-6">
        {!active.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">There are no active full-time employees. Part-time pay is managed from the Part-Time Hours spreadsheet.</div> : <>
          <label><span className="mb-1.5 block text-xs font-bold">Employee</span><select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={cls}>{active.map((item) => <option key={item.id} value={item.id}>{item.name} · {employeePayLabel(item)} · {item.paymentInterval}</option>)}</select></label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-bold">Period Start</span><input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold">Period End</span><input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold">Allowance / Bonus ($)</span><input type="number" min="0" step="0.01" value={allowances} onChange={(e) => setAllowances(e.target.value)} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold">Other Deductions ($)</span><input type="number" min="0" step="0.01" value={otherDeductions} onChange={(e) => setOtherDeductions(e.target.value)} className={cls} /></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold">Overtime Rate ($ / hr)</span><input type="number" min="0" step="0.01" value={overtimeRate} onChange={(e) => setOvertimeRate(e.target.value)} className={cls} /><span className="mt-1 block text-[10px] text-slate-400">Confirm the applicable OT rate before finalising payroll.</span></label></div>
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-4"><div><p className="text-[9px] font-black uppercase text-slate-400">Regular Hours</p><p className="mt-1 text-lg font-black">{regularHours.toFixed(2)}</p></div><div><p className="text-[9px] font-black uppercase text-slate-400">OT Hours</p><p className="mt-1 text-lg font-black">{overtimeHours.toFixed(2)}</p></div><div><p className="text-[9px] font-black uppercase text-slate-400">Advances</p><p className="mt-1 text-lg font-black text-amber-700">${formatMoney(advanceDeductions)}</p></div><div><p className="text-[9px] font-black uppercase text-slate-400">Attendance Days</p><p className="mt-1 text-lg font-black">{rows.length}</p></div></div>
          <div className="overflow-hidden rounded-2xl border border-slate-200">{[['Basic / Hourly Pay', basicPay + hourlyPay], ['Overtime Pay', overtimePay], ['Allowance / Bonus', Number(allowances || 0)], ['Gross Pay', grossPay], ['Salary Advances', -advanceDeductions], ['Other Deductions', -Number(otherDeductions || 0)], ['Net Pay', netPay]].map(([label, amount], index) => <div key={label} className={`flex items-center justify-between px-4 py-3 text-sm ${index === 6 ? 'bg-emerald-50 font-black text-emerald-800' : 'border-b border-slate-100 text-slate-700'}`}><span>{label}</span><span>${formatMoney(amount)}</span></div>)}</div>
          <label><span className="mb-1.5 block text-xs font-bold">Notes</span><textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} className={cls} /></label>
        </>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500">Cancel</button><button type="submit" disabled={saving || !employee || periodEnd < periodStart} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? 'Generating…' : 'Generate Payroll'}</button></div>
      </form>
    </ModalShell>
  );
}

function PayslipPreview({ payroll, employee, onClose, onMarkPaid }) {
  const content = (
    <div className="bg-white text-slate-900">
      <div className="border-b-4 border-slate-900 pb-4"><p className="text-2xl font-black">THREE LEAVES</p><p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Employee Payslip</p></div>
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><span className="text-slate-500">Employee</span><p className="font-black">{employee.name}</p></div><div><span className="text-slate-500">Employee ID</span><p className="font-black">{employee.employeeNo}</p></div><div><span className="text-slate-500">Role</span><p className="font-black">{employee.role}</p></div><div><span className="text-slate-500">Pay Period</span><p className="font-black">{payroll.period_start} to {payroll.period_end}</p></div></div>
      <div className="mt-7 overflow-hidden rounded-xl border border-slate-200">{[['Regular Hours', Number(payroll.regular_hours || 0).toFixed(2)], ['Overtime Hours', Number(payroll.overtime_hours || 0).toFixed(2)], ['Basic Pay', `$${formatMoney(payroll.basic_pay || 0)}`], ['Hourly Pay', `$${formatMoney(payroll.hourly_pay || 0)}`], ['Overtime Pay', `$${formatMoney(payroll.overtime_pay || 0)}`], ['Allowances / Bonus', `$${formatMoney(payroll.allowances || 0)}`], ['Gross Pay', `$${formatMoney(payroll.gross_pay || 0)}`], ['Salary Advances', `-$${formatMoney(payroll.advance_deductions || 0)}`], ['Other Deductions', `-$${formatMoney(payroll.other_deductions || 0)}`]].map(([label, value]) => <div key={label} className="flex justify-between border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"><span className="text-slate-600">{label}</span><span className="font-bold">{value}</span></div>)}</div>
      <div className="mt-5 flex justify-between rounded-xl bg-slate-900 px-5 py-4 text-white"><span className="font-black uppercase">Net Pay</span><span className="text-2xl font-black">${formatMoney(payroll.net_pay || 0)}</span></div>
      {employee.employmentType === 'Part-Time' && (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex justify-between border-b border-slate-100 px-4 py-3 text-sm"><span className="text-slate-600">Brought Forward / Previous Balance</span><span className="font-bold">{signedMoney(payroll.part_time_brought_forward || 0)}</span></div>
          <div className="flex justify-between border-b border-slate-100 px-4 py-3 text-sm"><span className="text-slate-600">Salary Issued</span><span className="font-bold">-${formatMoney(payroll.salary_issued || 0)}</span></div>
          <div className="flex justify-between px-4 py-3 text-sm"><span className="font-black text-slate-800">Remaining Rolling Balance</span><span className="font-black">{signedMoney(payroll.part_time_rolling_balance || Number(payroll.net_pay || 0) - Number(payroll.salary_issued || 0))}</span></div>
        </div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-4 text-xs text-slate-500"><div><p className="font-bold uppercase">Status</p><p className="mt-1 text-sm font-black text-slate-800">{String(payroll.status || '').toUpperCase()}</p></div><div><p className="font-bold uppercase">Payment</p><p className="mt-1 text-sm font-black text-slate-800">{payroll.paid_at || '—'} · {payroll.payment_method || employee.paymentMethod || '—'}</p>{payroll.payment_reference && <p className="mt-1">Ref: {payroll.payment_reference}</p>}</div></div>
    </div>
  );
  return <>
    {createPortal(<div className="fixed inset-0 z-[8200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm print:hidden"><div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Payslip Preview</p><h2 className="mt-1 text-lg font-black text-slate-900">{employee.name}</h2></div><div className="flex gap-2">{payroll.status !== 'paid' && onMarkPaid && <button type="button" onClick={onMarkPaid} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">Mark Paid</button>}<button type="button" onClick={() => window.print()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">Print</button><button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div></div><div className="overflow-y-auto bg-slate-100 p-6"><div className="mx-auto max-w-[210mm] rounded-xl bg-white p-[15mm] shadow-lg">{content}</div></div></div></div>, document.body)}
    {createPortal(<div id="employee-payslip-print" className="hidden"><style>{`@media print { @page { size:A4 portrait; margin:15mm; } body > *:not(#employee-payslip-print) { display:none !important; } #employee-payslip-print { display:block !important; } }`}</style>{content}</div>, document.body)}
  </>;
}

function PartTimeDayRow({
  date,
  employee,
  attendanceRow,
  timesheetAdvance,
  otherAdvanceAmount,
  locked,
  saving,
  onSave,
  onDelete,
}) {
  const legacyHours = attendanceHours(attendanceRow);
  const hasStoredTiming = Boolean(attendanceRow?.clock_in && attendanceRow?.clock_out);

  const initialAllowance = attendanceRow && hasStoredTiming
    ? Number(attendanceRow.transport_allowance || 0)
    : DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE;

  const [clockIn, setClockIn] = useState(
    attendanceRow?.clock_in ? String(attendanceRow.clock_in).slice(0, 5) : ''
  );
  const [clockOut, setClockOut] = useState(
    attendanceRow?.clock_out ? String(attendanceRow.clock_out).slice(0, 5) : ''
  );
  const [breakMinutes, setBreakMinutes] = useState(Number(attendanceRow?.break_minutes || 0));
  const [hourlyRate, setHourlyRate] = useState(
    Number(attendanceRow?.hourly_rate_snapshot || 0) > 0
      ? Number(attendanceRow.hourly_rate_snapshot)
      : Number(employee.hourlyRate || 0)
  );
  const [allowance, setAllowance] = useState(initialAllowance);
  const [allowanceEditing, setAllowanceEditing] = useState(false);
  const [advance, setAdvance] = useState(Number(timesheetAdvance?.amount || 0));
  const [saveState, setSaveState] = useState(
    attendanceRow || timesheetAdvance ? 'saved' : 'idle'
  );
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Saving is intentionally blur-driven.
  // Typing never writes to Supabase. A database write is queued only when the
  // user physically leaves the field (onBlur), or chooses an explicit action
  // such as Reset Transport / Delete.
  //
  // The queue preserves save order when a user moves quickly across fields,
  // while local input state remains editable during an in-flight database save.
  const lastSavedSignatureRef = useRef(null);
  const latestSignatureRef = useRef('');
  const saveQueueRef = useRef(Promise.resolve());
  const pendingSaveCountRef = useRef(0);

  const hasTiming = Boolean(clockIn && clockOut);
  const partialTiming = Boolean(clockIn) !== Boolean(clockOut);
  const computedHours = hasTiming
    ? clockedHours(clockIn, clockOut, breakMinutes)
    : !clockIn && !clockOut
      ? legacyHours
      : 0;

  const hourlyPay = computedHours * Number(hourlyRate || 0);
  const dayAllowance = computedHours > 0 ? Number(allowance || 0) : 0;
  const gross = hourlyPay + dayAllowance;
  const totalAdvance = Number(advance || 0) + Number(otherAdvanceAmount || 0);
  const dayBalance = gross - totalAdvance;
  const hasStoredEntry = Boolean(attendanceRow || timesheetAdvance);

  const buildDraft = () => ({
    date,
    clockIn,
    clockOut,
    breakMinutes: Number(breakMinutes || 0),
    hourlyRate: Number(hourlyRate || 0),
    allowance: Number(allowance || 0),
    advance: Number(advance || 0),
    legacyHours,
    hadStoredTiming: hasStoredTiming,
  });

  const signature = JSON.stringify({
    clockIn,
    clockOut,
    breakMinutes: Number(breakMinutes || 0),
    hourlyRate: Number(hourlyRate || 0),
    allowance: Number(allowance || 0),
    advance: Number(advance || 0),
  });

  if (lastSavedSignatureRef.current === null) {
    lastSavedSignatureRef.current = signature;
  }

  latestSignatureRef.current = signature;

  const signatureForDraft = (draft) =>
    JSON.stringify({
      clockIn: draft.clockIn || '',
      clockOut: draft.clockOut || '',
      breakMinutes: Number(draft.breakMinutes || 0),
      hourlyRate: Number(draft.hourlyRate || 0),
      allowance: Number(draft.allowance || 0),
      advance: Number(draft.advance || 0),
    });

  const markDirty = () => {
    if (locked) return;

    // Do not interrupt a visible "Saving" state while an earlier blur-save is
    // still in flight. When that save finishes it will recognise that newer
    // unsaved input exists and switch the row back to "Unsaved".
    if (pendingSaveCountRef.current === 0) {
      setSaveState('dirty');
    }
  };

  const queueBlurSave = (draft = buildDraft()) => {
    if (locked) return;

    const draftSignature = signatureForDraft(draft);

    if (draftSignature === lastSavedSignatureRef.current) {
      if (pendingSaveCountRef.current === 0) {
        setSaveState(hasStoredEntry ? 'saved' : 'idle');
      }
      return;
    }

    const draftHasStart = Boolean(draft.clockIn);
    const draftHasEnd = Boolean(draft.clockOut);
    const draftPartialTiming = draftHasStart !== draftHasEnd;

    if (draftPartialTiming) {
      setSaveState('incomplete');
      return;
    }

    const draftHasTiming = draftHasStart && draftHasEnd;
    const draftHasMeaningfulEntry =
      draftHasTiming ||
      Number(draft.legacyHours || 0) > 0 ||
      Number(draft.advance || 0) > 0 ||
      hasStoredEntry;

    if (!draftHasMeaningfulEntry) {
      setSaveState('idle');
      return;
    }

    pendingSaveCountRef.current += 1;
    setSaveState('saving');

    const executeSave = async () => {
      let ok = false;

      try {
        ok = await onSave(draft);
      } catch (error) {
        console.error('Part-time blur save failed:', error);
        ok = false;
      } finally {
        pendingSaveCountRef.current = Math.max(
          0,
          pendingSaveCountRef.current - 1
        );
      }

      if (ok) {
        lastSavedSignatureRef.current = draftSignature;

        if (pendingSaveCountRef.current > 0) {
          setSaveState('saving');
        } else if (latestSignatureRef.current === draftSignature) {
          setSaveState('saved');
        } else {
          // A later field has been changed but not blurred yet.
          setSaveState('dirty');
        }
      } else if (pendingSaveCountRef.current > 0) {
        setSaveState('saving');
      } else {
        setSaveState('error');
      }

      return ok;
    };

    // Always preserve write order. This prevents a slower earlier save from
    // overwriting a newer blur-save when the user tabs through fields quickly.
    saveQueueRef.current = saveQueueRef.current
      .catch(() => false)
      .then(executeSave);
  };

  const commitCurrentField = () => {
    queueBlurSave(buildDraft());
  };

  const resetTransport = () => {
    const nextAllowance = DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE;

    setAllowance(nextAllowance);
    setAllowanceEditing(false);

    queueBlurSave({
      ...buildDraft(),
      allowance: nextAllowance,
    });
  };

  const requestDelete = async () => {
    if (!hasStoredEntry || locked || deleteBusy) return;

    const confirmed = window.confirm(
      `Delete the ${shortDayLabel(date)} part-time entry? This removes the saved shift and the timesheet advance for this date.`
    );

    if (!confirmed) return;

    setDeleteBusy(true);
    setSaveState('saving');

    try {
      const ok = await onDelete(date);
      if (!ok) {
        setSaveState('error');
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  const saveBadge = (() => {
    if (locked) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
          <Lock size={10} /> Locked
        </span>
      );
    }

    if (saving || saveState === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600">
          <RefreshCw size={11} className="animate-spin" /> Saving
        </span>
      );
    }

    if (saveState === 'saved') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
          <CheckCircle2 size={12} /> Saved
        </span>
      );
    }

    if (saveState === 'incomplete') {
      return <span className="text-[10px] font-bold text-amber-600">Complete shift</span>;
    }

    if (saveState === 'error') {
      return <span className="text-[10px] font-bold text-red-600">Save failed</span>;
    }

    if (saveState === 'dirty') {
      return <span className="text-[10px] font-bold text-slate-500">Unsaved</span>;
    }

    return <span className="text-[10px] font-bold text-slate-300">Not entered</span>;
  })();

  const controlBase =
    'rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';

  return (
    <tr className="group border-b border-slate-100 align-middle transition hover:bg-slate-50/60">
      <td className="sticky left-0 z-10 bg-white px-4 py-3 shadow-[1px_0_0_0_#e2e8f0] group-hover:bg-slate-50">
        <p className="whitespace-nowrap text-xs font-black text-slate-800">
          {dateFromIso(date).toLocaleDateString('en-SG', { weekday: 'short' })}
        </p>
        <p className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-slate-400">
          {dateFromIso(date).toLocaleDateString('en-SG', { day: '2-digit', month: 'short' })}
        </p>
      </td>

      <td className="min-w-[260px] px-3 py-2.5">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2">
          <div className="flex items-center gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[8px] font-black uppercase tracking-wider text-slate-400">Start</span>
              <input
                type="time"
                value={clockIn}
                disabled={locked}
                onChange={(event) => {
                  setClockIn(event.target.value);
                  markDirty();
                }}
                onBlur={commitCurrentField}
                className={`${controlBase} w-full px-2 py-2`}
              />
            </label>

            <span className="mt-4 text-slate-300">→</span>

            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[8px] font-black uppercase tracking-wider text-slate-400">End</span>
              <input
                type="time"
                value={clockOut}
                disabled={locked}
                onChange={(event) => {
                  setClockOut(event.target.value);
                  markDirty();
                }}
                onBlur={commitCurrentField}
                className={`${controlBase} w-full px-2 py-2`}
              />
            </label>

            <label className="w-[70px]">
              <span className="mb-1 block text-[8px] font-black uppercase tracking-wider text-slate-400">Break</span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={breakMinutes}
                  disabled={locked}
                  onChange={(event) => {
                    setBreakMinutes(event.target.value);
                    markDirty();
                  }}
                  onBlur={commitCurrentField}
                  className={`${controlBase} w-full px-2 py-2 pr-6 text-right`}
                />
                <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">m</span>
              </div>
            </label>
          </div>

          {!hasStoredTiming && legacyHours > 0 && !hasTiming && (
            <div className="mt-2 inline-flex rounded-md bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">
              Legacy entry · {legacyHours.toFixed(2)}h
            </div>
          )}
        </div>
      </td>

      <td className="min-w-[105px] px-3 py-3 text-right">
        <p className="font-mono text-xs font-black text-slate-800">{durationLabel(computedHours)}</p>
        <p className="mt-0.5 font-mono text-[9px] text-slate-400">{computedHours.toFixed(2)} hrs</p>
      </td>

      <td className="min-w-[155px] px-3 py-2.5">
        <div className="ml-auto w-[130px] rounded-xl border border-blue-100 bg-blue-50/40 p-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-blue-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              disabled={locked}
              onChange={(event) => {
                setHourlyRate(event.target.value);
                markDirty();
              }}
              onBlur={commitCurrentField}
              className="w-full bg-transparent text-right font-mono text-xs font-black text-blue-800 outline-none"
            />
            <span className="text-[9px] font-bold text-blue-400">/hr</span>
          </div>
          <div className="mt-1.5 border-t border-blue-100 pt-1.5 text-right">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Pay </span>
            <span className="font-mono text-xs font-black text-slate-800">${formatMoney(hourlyPay)}</span>
          </div>
        </div>
      </td>

      <td className="min-w-[130px] px-3 py-2.5">
        <div className="ml-auto w-[110px] text-right">
          {allowanceEditing && !locked ? (
            <div className="rounded-xl border border-slate-200 bg-white p-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">$</span>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  step="0.01"
                  value={allowance}
                  disabled={locked}
                  onChange={(event) => {
                    setAllowance(event.target.value);
                    markDirty();
                  }}
                  onBlur={() => {
                    setAllowanceEditing(false);
                    commitCurrentField();
                  }}
                  className="w-full bg-transparent text-right font-mono text-xs font-black text-slate-800 outline-none"
                />
              </div>
              {Number(allowance) !== DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={resetTransport}
                  className="mt-1 text-[8px] font-black uppercase tracking-wider text-blue-600"
                >
                  Reset $5
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={locked}
              onClick={() => setAllowanceEditing(true)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-right transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              title="Click to edit this day's transport allowance"
            >
              <span className="block font-mono text-xs font-black text-slate-800">
                ${formatMoney(computedHours > 0 ? dayAllowance : DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE)}
              </span>
              <span className={`mt-0.5 block text-[8px] font-black uppercase tracking-wider ${Number(allowance) === DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE ? 'text-slate-400' : 'text-blue-600'}`}>
                {Number(allowance) === DEFAULT_PART_TIME_TRANSPORT_ALLOWANCE ? 'Standard · Edit' : 'Custom · Edit'}
              </span>
            </button>
          )}
        </div>
      </td>

      <td className="min-w-[115px] bg-emerald-50/30 px-3 py-3 text-right">
        <p className="font-mono text-xs font-black text-emerald-800">${formatMoney(gross)}</p>
        <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-600/60">Gross</p>
      </td>

      <td className="min-w-[130px] px-3 py-2.5">
        <div className="relative ml-auto w-[108px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-500">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={advance}
            disabled={locked}
            onChange={(event) => {
              setAdvance(event.target.value);
              markDirty();
            }}
            onBlur={commitCurrentField}
            className="w-full rounded-xl border border-amber-100 bg-amber-50/60 py-2.5 pl-6 pr-2 text-right font-mono text-xs font-black text-amber-800 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>
        {otherAdvanceAmount > 0 && (
          <p className="mt-1 text-right text-[8px] font-bold text-amber-600">
            +${formatMoney(otherAdvanceAmount)} ledger
          </p>
        )}
      </td>

      <td className="min-w-[118px] px-3 py-3 text-right">
        <p className={`font-mono text-xs font-black ${dayBalance < 0 ? 'text-red-700' : 'text-blue-700'}`}>
          {signedMoney(dayBalance)}
        </p>
        <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-slate-400">Net day</p>
      </td>

      <td className="min-w-[130px] px-3 py-3">
        <div className="flex items-center justify-end gap-2">
          <div className="min-w-[66px] text-right">{saveBadge}</div>

          <button
            type="button"
            disabled={!hasStoredEntry || locked || deleteBusy}
            onClick={requestDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-25"
            title={locked ? 'Settled rows cannot be deleted' : 'Delete this date entry'}
          >
            {deleteBusy ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

function PartTimeSalaryIssuedCell({
  value,
  locked,
  saving,
  onSave,
}) {
  const [draft, setDraft] = useState(value > 0 ? Number(value).toFixed(2) : '');
  const lastExternalValueRef = useRef(value);
  const lastSavedRef = useRef(value > 0 ? Number(value).toFixed(2) : '');
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    const next = Number(value || 0) > 0 ? Number(value).toFixed(2) : '';
    if (Number(lastExternalValueRef.current || 0) !== Number(value || 0)) {
      setDraft(next);
      lastSavedRef.current = next;
      lastExternalValueRef.current = value;
    }
  }, [value]);

  const commit = () => {
    if (locked) return;

    const cleaned = String(draft || '').trim();
    const numeric = cleaned === '' ? 0 : Number(cleaned);

    if (!Number.isFinite(numeric) || numeric < 0) {
      setDraft(lastSavedRef.current);
      return;
    }

    const normalised = numeric > 0 ? numeric.toFixed(2) : '';
    if (normalised === lastSavedRef.current) return;

    lastSavedRef.current = normalised;
    saveQueueRef.current = saveQueueRef.current
      .catch(() => false)
      .then(() => onSave(numeric));
  };

  return (
    <div className="min-w-[150px]">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
          $
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft}
          disabled={locked}
          placeholder="0.00"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-7 pr-2 text-right font-mono text-xs font-black text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
        />
      </div>
      <p className="mt-1 text-right text-[8px] font-black uppercase tracking-wider text-slate-400">
        {saving ? 'Saving…' : locked ? 'Locked' : 'Save on exit'}
      </p>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================
export function EmployeeModule() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [employeeEditor, setEmployeeEditor] = useState(null);
  const [attendanceEditor, setAttendanceEditor] = useState(null);
  const [recordModal, setRecordModal] = useState(null);
  const [payrollEditor, setPayrollEditor] = useState(false);
  const [payslip, setPayslip] = useState(null);
  const [partTimeCycle, setPartTimeCycle] = useState('weekly');
  const [partTimeEmployeeId, setPartTimeEmployeeId] = useState('');
  const [partTimeAnchor, setPartTimeAnchor] = useState(localDateString());
  const [partTimeSavingKey, setPartTimeSavingKey] = useState('');
  const [partTimeSettlement, setPartTimeSettlement] = useState(null);
  const [partTimeSettlementLoading, setPartTimeSettlementLoading] = useState('');
  const [notification, setNotification] = useState(null);
  const noticeTimer = useRef(null);

  const notify = (title, type = 'success', message = '') => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotification({ title, type, message });
    noticeTimer.current = window.setTimeout(() => setNotification(null), 4500);
  };

  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);

  const reload = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const results = await Promise.all([
        supabase.from('employees').select('*').order('name', { ascending: true }),
        supabase.from('employee_attendance').select('*').order('work_date', { ascending: false }),
        supabase.from('employee_advances').select('*').order('advance_date', { ascending: false }),
        supabase.from('employee_payroll').select('*').order('period_end', { ascending: false }),
        supabase.from('employee_salary_payments').select('*').order('payment_date', { ascending: false }),
        supabase.from('employee_leave').select('*').order('start_date', { ascending: false }),
      ]);
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      setEmployees((results[0].data || []).map(normaliseEmployee));
      setAttendance(results[1].data || []);
      setAdvances(results[2].data || []);
      setPayroll(results[3].data || []);
      setSalaryPayments(results[4].data || []);
      setLeaveRecords(results[5].data || []);
    } catch (error) {
      console.error('Employee module load failed:', error);
      setLoadError(error?.message || 'Unable to load employee data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [String(employee.id), employee])), [employees]);
  useEffect(() => {
    const eligible = employees.filter(
      (employee) =>
        employee.status === 'Active' &&
        employee.employmentType === 'Part-Time' &&
        employee.paymentInterval === partTimeCycle
    );

    if (!eligible.some((employee) => String(employee.id) === String(partTimeEmployeeId))) {
      setPartTimeEmployeeId(eligible[0]?.id || '');
    }
  }, [employees, partTimeCycle, partTimeEmployeeId]);
  const today = localDateString();
  const week = weekBounds();
  const month = monthBounds();

  const overview = useMemo(() => {
    const active = employees.filter((employee) => employee.status === 'Active');
    const weekRows = attendance.filter((row) => inRange(row.work_date, week.start, week.end));
    const unpaid = payroll.filter((row) => row.status !== 'paid');
    const outstandingAdvances = advances.filter((row) => ['pending', 'allocated'].includes(row.status));
    const todayRows = attendance.filter((row) => row.work_date === today);
    const onLeaveToday = leaveRecords.filter((row) => String(row.status).toLowerCase() === 'approved' && inRange(today, row.start_date, row.end_date));
    const leaveIds = new Set(onLeaveToday.map((row) => String(row.employee_id)));
    const clockedIds = new Set(todayRows.filter((row) => row.clock_in || attendanceHours(row) > 0).map((row) => String(row.employee_id)));
    const missingClockOut = todayRows.filter((row) => row.clock_in && !row.clock_out);
    const notClocked = active.filter((employee) => !clockedIds.has(String(employee.id)) && !leaveIds.has(String(employee.id)));
    const profileIssues = active.map((employee) => ({ employee, issues: employeeIssues(employee) })).filter((entry) => entry.issues.length);
    const passExpiring = active.filter((employee) => {
      if (!employee.workPassExpiry || employee.employmentType === 'Part-Time') return false;
      const expiry = dateFromIso(employee.workPassExpiry);
      const now = dateFromIso(today);
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 60);
      return expiry >= now && expiry <= cutoff;
    });
    const partTimeUnpaid = unpaid.filter((row) => employeeById.get(String(row.employee_id))?.employmentType === 'Part-Time');
    const partTimeOutstanding = partTimeUnpaid.reduce((sum, row) => {
      const issued = salaryPayments
        .filter(
          (payment) =>
            String(payment.employee_id) === String(row.employee_id) &&
            payment.period_start === row.period_start &&
            payment.period_end === row.period_end
        )
        .reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0);
      return sum + Number(row.net_pay || 0) - issued;
    }, 0);
    return {
      active,
      fullTime: active.filter((employee) => employee.employmentType === 'Full-Time').length,
      partTime: active.filter((employee) => employee.employmentType === 'Part-Time').length,
      weeklyHours: weekRows.reduce((sum, row) => sum + attendanceHours(row), 0),
      weeklyOt: weekRows.reduce((sum, row) => sum + Number(row.overtime_hours || 0), 0),
      payrollDue: unpaid.reduce((sum, row) => sum + Math.max(0, Number(row.net_pay || 0)), 0),
      unpaid,
      outstandingAdvances,
      advanceAmount: outstandingAdvances.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      todayRows,
      onLeaveToday,
      missingClockOut,
      notClocked,
      profileIssues,
      passExpiring,
      paidThisMonth: payroll.filter((row) => row.status === 'paid' && String(row.paid_at || '').slice(0, 7) === today.slice(0, 7)).reduce((sum, row) => sum + Number(row.net_pay || 0), 0),
      partTimeHours: weekRows.reduce((sum, row) => employeeById.get(String(row.employee_id))?.employmentType === 'Part-Time' ? sum + attendanceHours(row) : sum, 0),
      partTimeUnpaid,
      partTimeOutstanding,
    };
  }, [employees, attendance, advances, payroll, salaryPayments, leaveRecords, today, week.start, week.end, employeeById]);

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return employees.filter((employee) => !query || [employee.name, employee.employeeNo, employee.role, employee.employmentType, employee.citizenshipType].join(' ').toLowerCase().includes(query));
  }, [employees, searchTerm]);

  const saveEmployee = async (form) => {
    const payload = employeePayload(form);
    try {
      const result = form.id
        ? await supabase.from('employees').update(payload).eq('id', form.id).select().single()
        : await supabase.from('employees').insert([payload]).select().single();
      if (result.error) throw result.error;
      const employee = normaliseEmployee(result.data);
      setEmployees((current) => form.id ? current.map((item) => item.id === employee.id ? employee : item) : [...current, employee].sort((a, b) => a.name.localeCompare(b.name)));
      setEmployeeEditor(null);
      notify(form.id ? 'Employee updated' : 'Employee added', 'success', employee.name);
    } catch (error) { notify('Employee save failed', 'error', error?.message || 'Unknown error'); throw error; }
  };

  const saveAttendance = async (form) => {
    const payload = {
      employee_id: form.employeeId,
      work_date: form.workDate,
      clock_in: form.status === 'Present' ? form.clockIn : null,
      clock_out: form.status === 'Present' ? form.clockOut : null,
      break_minutes: form.status === 'Present' ? Number(form.breakMinutes || 0) : 0,
      regular_hours: Number(form.regularHours || 0),
      overtime_hours: form.status === 'Present' ? Number(form.overtimeHours || 0) : 0,
      status: form.status,
      notes: String(form.notes || '').trim() || null,
    };
    try {
      const result = form.id
        ? await supabase.from('employee_attendance').update(payload).eq('id', form.id).select().single()
        : await supabase.from('employee_attendance').upsert([payload], { onConflict: 'employee_id,work_date' }).select().single();
      if (result.error) throw result.error;
      setAttendance((current) => [result.data, ...current.filter((row) => row.id !== result.data.id)].sort((a, b) => String(b.work_date).localeCompare(String(a.work_date))));
      setAttendanceEditor(null);
      notify('Attendance saved');
    } catch (error) { notify('Attendance save failed', 'error', error?.message || 'Unknown error'); throw error; }
  };

  const saveAdvance = async (form) => {
    try {
      const result = await supabase.from('employee_advances').insert([{ employee_id: form.employeeId, advance_date: form.date, amount: Number(form.amount || 0), reason: String(form.reason || '').trim() || null, status: 'pending', notes: String(form.notes || '').trim() || null }]).select().single();
      if (result.error) throw result.error;
      setAdvances((current) => [result.data, ...current]);
      setRecordModal(null);
      notify('Salary advance recorded');
    } catch (error) { notify('Advance save failed', 'error', error?.message || 'Unknown error'); throw error; }
  };

  const saveLeave = async (form) => {
    try {
      const result = await supabase.from('employee_leave').insert([{ employee_id: form.employeeId, leave_type: form.type, start_date: form.start, end_date: form.end, days: Number(form.days || 0), status: form.status, notes: String(form.notes || '').trim() || null }]).select().single();
      if (result.error) throw result.error;
      setLeaveRecords((current) => [result.data, ...current]);
      setRecordModal(null);
      notify('Leave record saved');
    } catch (error) { notify('Leave save failed', 'error', error?.message || 'Unknown error'); throw error; }
  };

  const generatePayroll = async (calc) => {
    try {
      const result = await supabase.from('employee_payroll').upsert([{
        employee_id: calc.employee.id,
        period_start: calc.periodStart,
        period_end: calc.periodEnd,
        pay_interval: calc.employee.paymentInterval,
        pay_basis: calc.employee.payBasis,
        rate_snapshot: calc.employee.payBasis === 'hourly' ? Number(calc.employee.hourlyRate || 0) : Number(calc.employee.basicSalary || 0),
        regular_hours: calc.regularHours,
        overtime_hours: calc.overtimeHours,
        overtime_rate: calc.overtimeRate,
        basic_pay: calc.basicPay,
        hourly_pay: calc.hourlyPay,
        overtime_pay: calc.overtimePay,
        allowances: calc.allowances,
        gross_pay: calc.grossPay,
        advance_deductions: calc.advanceDeductions,
        other_deductions: calc.otherDeductions,
        net_pay: calc.netPay,
        status: 'ready',
        notes: String(calc.notes || '').trim() || null,
      }], { onConflict: 'employee_id,period_start,period_end' }).select().single();
      if (result.error) throw result.error;
      if (calc.pendingAdvances.length) {
        const update = await supabase.from('employee_advances').update({ status: 'allocated', payroll_id: result.data.id }).in('id', calc.pendingAdvances.map((row) => row.id));
        if (update.error) throw update.error;
      }
      setPayroll((current) => [result.data, ...current.filter((row) => row.id !== result.data.id)]);
      if (calc.pendingAdvances.length) {
        const ids = new Set(calc.pendingAdvances.map((row) => String(row.id)));
        setAdvances((current) => current.map((row) => ids.has(String(row.id)) ? { ...row, status: 'allocated', payroll_id: result.data.id } : row));
      }
      setPayrollEditor(false);
      notify('Payroll generated', 'success', `${calc.employee.name}: $${formatMoney(result.data.net_pay)}`);
    } catch (error) { notify('Payroll generation failed', 'error', error?.message || 'Unknown error'); throw error; }
  };

  const markPayrollPaid = async (row) => {
    const employee = employeeById.get(String(row.employee_id));
    if (employee?.employmentType === 'Part-Time') {
      setActiveTab('Part-Time Hours');
      setPartTimeCycle(employee.paymentInterval || 'weekly');
      setPartTimeAnchor(row.period_end);
      notify('Use Part-Time settlement', 'warning', 'Part-time carry-forward payments are settled from the Part-Time Hours spreadsheet.');
      return;
    }
    const paidAt = window.prompt('Payment date (YYYY-MM-DD)', localDateString());
    if (!paidAt) return;
    try {
      const result = await supabase.from('employee_payroll').update({ status: 'paid', paid_at: paidAt, payment_method: employee?.paymentMethod || 'Bank Transfer' }).eq('id', row.id).select().single();
      if (result.error) throw result.error;
      const advanceUpdate = await supabase.from('employee_advances').update({ status: 'deducted' }).eq('payroll_id', row.id).eq('status', 'allocated');
      if (advanceUpdate.error) throw advanceUpdate.error;
      setPayroll((current) => current.map((item) => item.id === result.data.id ? result.data : item));
      setAdvances((current) => current.map((item) => item.payroll_id === row.id && item.status === 'allocated' ? { ...item, status: 'deducted' } : item));
      notify('Payroll marked paid');
    } catch (error) { notify('Payment update failed', 'error', error?.message || 'Unknown error'); }
  };

  const syncPartTimeInterval = async (employee, dateValue) => {
    const bounds = intervalBounds(employee.paymentInterval, dateValue);

    const existingResult = await supabase
      .from('employee_payroll')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('period_start', bounds.start)
      .eq('period_end', bounds.end)
      .maybeSingle();

    if (existingResult.error) throw existingResult.error;

    const existing = existingResult.data || null;

    if (existing?.status === 'paid') {
      throw new Error('This payment interval has already been settled and is locked.');
    }

    const [attendanceResult, advancesResult] = await Promise.all([
      supabase
        .from('employee_attendance')
        .select('id,employee_id,work_date,clock_in,clock_out,break_minutes,regular_hours,overtime_hours,hourly_rate_snapshot,transport_allowance,status,notes,updated_at')
        .eq('employee_id', employee.id)
        .gte('work_date', bounds.start)
        .lte('work_date', bounds.end),
      supabase
        .from('employee_advances')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('advance_date', bounds.start)
        .lte('advance_date', bounds.end)
        .neq('status', 'deducted'),
    ]);

    if (attendanceResult.error) throw attendanceResult.error;
    if (advancesResult.error) throw advancesResult.error;

    const attendanceRows = attendanceResult.data || [];
    const advanceRows = advancesResult.data || [];

    if (!attendanceRows.length && !advanceRows.length && !existing) {
      return null;
    }

    const totalHours = attendanceRows.reduce(
      (sum, row) => sum + attendanceHours(row),
      0
    );

    const transportAllowance = attendanceRows.reduce(
      (sum, row) => sum + Number(row.transport_allowance || 0),
      0
    );

    const hourlyPay = attendanceRows.reduce((sum, row) => {
      const rowHours = attendanceHours(row);
      const rowRate =
        Number(row.hourly_rate_snapshot || 0) > 0
          ? Number(row.hourly_rate_snapshot)
          : Number(employee.hourlyRate || 0);

      return sum + rowHours * rowRate;
    }, 0);

    // employee_payroll.rate_snapshot stays as an interval reference.
    // With mixed daily rates it stores the weighted-average hourly rate.
    // Historical earnings are sourced from the daily hourly_rate_snapshot rows.
    const rateSnapshot =
      totalHours > 0
        ? hourlyPay / totalHours
        : Number(existing?.rate_snapshot || employee.hourlyRate || 0);

    const advanceDeductions = advanceRows.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );

    const otherDeductions = Number(existing?.other_deductions || 0);
    const grossPay = hourlyPay + transportAllowance;
    const netPay = grossPay - advanceDeductions - otherDeductions;

    const payload = {
      employee_id: employee.id,
      period_start: bounds.start,
      period_end: bounds.end,
      pay_interval: employee.paymentInterval,
      pay_basis: 'hourly',
      rate_snapshot: rateSnapshot,
      regular_hours: totalHours,
      overtime_hours: 0,
      overtime_rate: 0,
      basic_pay: 0,
      hourly_pay: hourlyPay,
      overtime_pay: 0,
      allowances: transportAllowance,
      gross_pay: grossPay,
      advance_deductions: advanceDeductions,
      other_deductions: otherDeductions,
      net_pay: netPay,
      status: existing?.status === 'ready' ? 'ready' : 'draft',
      notes: existing?.notes || 'Auto-calculated from Part-Time Timesheet using daily hourly-rate snapshots',
    };

    const result = await supabase
      .from('employee_payroll')
      .upsert([payload], {
        onConflict: 'employee_id,period_start,period_end',
      })
      .select()
      .single();

    if (result.error) throw result.error;

    if (advanceRows.length > 0) {
      const allocate = await supabase
        .from('employee_advances')
        .update({
          status: 'allocated',
          payroll_id: result.data.id,
        })
        .in('id', advanceRows.map((row) => row.id))
        .neq('status', 'deducted');

      if (allocate.error) throw allocate.error;
    }

    setPayroll((current) => [
      result.data,
      ...current.filter((row) => row.id !== result.data.id),
    ].sort((a, b) => String(b.period_end).localeCompare(String(a.period_end))));

    if (advanceRows.length > 0) {
      const ids = new Set(advanceRows.map((row) => String(row.id)));
      setAdvances((current) => current.map((row) =>
        ids.has(String(row.id))
          ? { ...row, status: 'allocated', payroll_id: result.data.id }
          : row
      ));
    }

    return result.data;
  };

  const salaryPaymentSourceKey = (employeeId, periodStart, periodEnd) =>
    `pt-salary:${employeeId}:${periodStart}:${periodEnd}`;

  const getPartTimeSalaryPayment = (employeeId, periodStart, periodEnd) =>
    salaryPayments.find(
      (row) =>
        String(row.employee_id) === String(employeeId) &&
        row.period_start === periodStart &&
        row.period_end === periodEnd
    ) || null;

  const savePartTimeSalaryIssued = async (employee, bounds, amountValue) => {
    const amount = Number(amountValue || 0);
    const sourceKey = salaryPaymentSourceKey(employee.id, bounds.start, bounds.end);
    const existingPayment = salaryPayments.find((row) => row.source_key === sourceKey) ||
      getPartTimeSalaryPayment(employee.id, bounds.start, bounds.end);

    if (amount < 0) {
      notify('Invalid salary issued amount', 'error', 'The amount paid cannot be negative.');
      return false;
    }

    const existingPayroll = payroll.find(
      (row) =>
        String(row.employee_id) === String(employee.id) &&
        row.period_start === bounds.start &&
        row.period_end === bounds.end
    );

    if (existingPayroll?.status === 'paid') {
      notify('Paid interval is locked', 'error', 'Salary issued cannot be changed after the interval is locked.');
      return false;
    }

    const savingKey = `${employee.id}|salary|${bounds.start}|${bounds.end}`;
    setPartTimeSavingKey(savingKey);

    try {
      // A zero value means "remove the interval payment" rather than storing
      // an unnecessary zero-dollar payment record.
      if (amount === 0) {
        if (!existingPayment) {
          return true;
        }

        const deletion = await supabase
          .from('employee_salary_payments')
          .delete()
          .eq('id', existingPayment.id);

        if (deletion.error) throw deletion.error;

        setSalaryPayments((current) =>
          current.filter((row) => row.id !== existingPayment.id)
        );
        return true;
      }

      // Make sure the interval payroll row exists and is synchronised before
      // linking the payment to it. This keeps the payment record tied to the
      // exact payroll interval used by the rolling calculation.
      let payrollRow = existingPayroll || null;
      if (!payrollRow) {
        payrollRow = await syncPartTimeInterval(employee, bounds.end);
      }

      if (!payrollRow) {
        notify(
          'Enter the salary calculation first',
          'warning',
          'Record at least one work shift or advance for this interval before entering salary issued.'
        );
        return false;
      }

      const paymentPayload = {
        employee_id: employee.id,
        payroll_id: payrollRow.id,
        period_start: bounds.start,
        period_end: bounds.end,
        amount,
        payment_date: existingPayment?.payment_date || localDateString(),
        payment_method: existingPayment?.payment_method || employee.paymentMethod || 'Bank Transfer',
        payment_reference: existingPayment?.payment_reference || null,
        source_key: sourceKey,
        notes: existingPayment?.notes || 'Part-Time salary issued for payment interval',
      };

      const result = await supabase
        .from('employee_salary_payments')
        .upsert([paymentPayload], { onConflict: 'source_key' })
        .select()
        .single();

      if (result.error) throw result.error;

      setSalaryPayments((current) => [
        result.data,
        ...current.filter((row) => row.id !== result.data.id),
      ].sort((a, b) => String(b.payment_date || '').localeCompare(String(a.payment_date || ''))));

      notify('Salary issued updated', 'success', `${employee.name}: $${formatMoney(amount)}`);
      return true;
    } catch (error) {
      console.error('Part-time salary issued save failed:', error);
      notify('Salary issued could not be saved', 'error', error?.message || 'Unknown error');
      return false;
    } finally {
      setPartTimeSavingKey((current) => current === savingKey ? '' : current);
    }
  };

  const savePartTimeDay = async (employee, draft) => {
    const key = `${employee.id}|${draft.date}`;
    const bounds = intervalBounds(employee.paymentInterval, draft.date);

    const paidResult = await supabase
      .from('employee_payroll')
      .select('id,status')
      .eq('employee_id', employee.id)
      .eq('period_start', bounds.start)
      .eq('period_end', bounds.end)
      .eq('status', 'paid')
      .maybeSingle();

    if (paidResult.error) {
      notify('Unable to verify settlement lock', 'error', paidResult.error.message);
      return false;
    }

    if (paidResult.data) {
      notify('Settled interval is locked', 'error', 'Historical paid hours cannot be edited.');
      return false;
    }

    const hasStart = Boolean(draft.clockIn);
    const hasEnd = Boolean(draft.clockOut);

    if (hasStart !== hasEnd) {
      notify('Complete the timing', 'warning', 'Enter both start and end time before saving the day.');
      return false;
    }

    const computedHours = hasStart && hasEnd
      ? clockedHours(draft.clockIn, draft.clockOut, draft.breakMinutes)
      : Number(draft.legacyHours || 0);

    if (computedHours > 24) {
      notify('Invalid shift', 'error', 'The calculated shift cannot exceed 24 hours.');
      return false;
    }

    if (
      Number(draft.hourlyRate || 0) < 0 ||
      Number(draft.allowance || 0) < 0 ||
      Number(draft.advance || 0) < 0
    ) {
      notify('Invalid amount', 'error', 'Hourly rate, allowance and advance values cannot be negative.');
      return false;
    }

    if (computedHours > 0 && !(Number(draft.hourlyRate || 0) > 0)) {
      notify('Hourly rate required', 'warning', 'Enter the hourly rate that applies to this work date.');
      return false;
    }

    setPartTimeSavingKey(key);

    try {
      const existingAttendance = attendance.find(
        (row) =>
          String(row.employee_id) === String(employee.id) &&
          row.work_date === draft.date
      );

      const shouldKeepAttendance =
        computedHours > 0 ||
        (hasStart && hasEnd);

      if (shouldKeepAttendance) {
        const attendancePayload = {
          employee_id: employee.id,
          work_date: draft.date,
          clock_in: hasStart ? draft.clockIn : null,
          clock_out: hasEnd ? draft.clockOut : null,
          break_minutes: Number(draft.breakMinutes || 0),
          regular_hours: computedHours,
          overtime_hours: 0,
          hourly_rate_snapshot: computedHours > 0 ? Number(draft.hourlyRate || 0) : 0,
          transport_allowance: computedHours > 0 ? Number(draft.allowance || 0) : 0,
          status: computedHours > 0 ? 'Present' : 'Off',
          notes: hasStart && hasEnd
            ? 'Part-Time Timesheet entry'
            : 'Legacy part-time hours retained',
        };

        const attendanceSave = await supabase
          .from('employee_attendance')
          .upsert([attendancePayload], {
            onConflict: 'employee_id,work_date',
          })
          .select()
          .single();

        if (attendanceSave.error) throw attendanceSave.error;

        setAttendance((current) => [
          attendanceSave.data,
          ...current.filter((row) => row.id !== attendanceSave.data.id),
        ].sort((a, b) => String(b.work_date).localeCompare(String(a.work_date))));
      } else if (existingAttendance) {
        const removeAttendance = await supabase
          .from('employee_attendance')
          .delete()
          .eq('id', existingAttendance.id);

        if (removeAttendance.error) throw removeAttendance.error;

        setAttendance((current) =>
          current.filter((row) => row.id !== existingAttendance.id)
        );
      }

      const sourceKey = `pt-timesheet:${employee.id}:${draft.date}`;
      const existingAdvance = advances.find((row) => row.source_key === sourceKey);
      const advanceAmount = Number(draft.advance || 0);

      if (advanceAmount > 0) {
        const advancePayload = {
          employee_id: employee.id,
          advance_date: draft.date,
          amount: advanceAmount,
          reason: 'Part-Time Timesheet Advance',
          status: 'pending',
          payroll_id: null,
          source_key: sourceKey,
          notes: 'Entered from Part-Time Timesheet',
        };

        const advanceSave = await supabase
          .from('employee_advances')
          .upsert([advancePayload], { onConflict: 'source_key' })
          .select()
          .single();

        if (advanceSave.error) throw advanceSave.error;

        setAdvances((current) => [
          advanceSave.data,
          ...current.filter((row) => row.id !== advanceSave.data.id),
        ].sort((a, b) => String(b.advance_date).localeCompare(String(a.advance_date))));
      } else if (existingAdvance) {
        const removeAdvance = await supabase
          .from('employee_advances')
          .delete()
          .eq('id', existingAdvance.id);

        if (removeAdvance.error) throw removeAdvance.error;

        setAdvances((current) =>
          current.filter((row) => row.id !== existingAdvance.id)
        );
      }

      await syncPartTimeInterval(employee, draft.date);
      return true;
    } catch (error) {
      console.error('Part-time day save failed:', error);
      notify('Timesheet could not be saved', 'error', error?.message || 'Unknown error');
      return false;
    } finally {
      setPartTimeSavingKey('');
    }
  };

  const deletePartTimeDay = async (employee, dateValue) => {
    const key = `${employee.id}|${dateValue}`;
    const bounds = intervalBounds(employee.paymentInterval, dateValue);

    const paidRow = payroll.find(
      (row) =>
        String(row.employee_id) === String(employee.id) &&
        row.period_start === bounds.start &&
        row.period_end === bounds.end &&
        row.status === 'paid'
    );

    if (paidRow) {
      notify('Settled interval is locked', 'error', 'Paid timesheet entries cannot be deleted.');
      return false;
    }

    setPartTimeSavingKey(key);

    try {
      const attendanceRow = attendance.find(
        (row) =>
          String(row.employee_id) === String(employee.id) &&
          row.work_date === dateValue
      );

      const sourceKey = `pt-timesheet:${employee.id}:${dateValue}`;
      const timesheetAdvance = advances.find((row) => row.source_key === sourceKey);

      if (attendanceRow) {
        const attendanceDelete = await supabase
          .from('employee_attendance')
          .delete()
          .eq('id', attendanceRow.id);

        if (attendanceDelete.error) throw attendanceDelete.error;
      }

      if (timesheetAdvance) {
        const advanceDelete = await supabase
          .from('employee_advances')
          .delete()
          .eq('id', timesheetAdvance.id);

        if (advanceDelete.error) throw advanceDelete.error;
      }

      if (attendanceRow) {
        setAttendance((current) =>
          current.filter((row) => row.id !== attendanceRow.id)
        );
      }

      if (timesheetAdvance) {
        setAdvances((current) =>
          current.filter((row) => row.id !== timesheetAdvance.id)
        );
      }

      await syncPartTimeInterval(employee, dateValue);
      notify('Timesheet entry deleted', 'success', `${employee.name} · ${dateValue}`);
      return true;
    } catch (error) {
      console.error('Part-time day delete failed:', error);
      notify('Entry could not be deleted', 'error', error?.message || 'Unknown error');
      return false;
    } finally {
      setPartTimeSavingKey('');
    }
  };

  const preparePartTimeSettlement = async (employee, bounds) => {
    const loadingKey = `${employee.id}|${bounds.end}`;
    setPartTimeSettlementLoading(loadingKey);

    try {
      await syncPartTimeInterval(employee, bounds.end);

      const dueResult = await supabase
        .from('employee_payroll')
        .select('*')
        .eq('employee_id', employee.id)
        .lte('period_end', bounds.end)
        .neq('status', 'paid')
        .order('period_end', { ascending: true });

      if (dueResult.error) throw dueResult.error;

      const rows = dueResult.data || [];

      if (!rows.length) {
        notify('Nothing to settle', 'warning', 'There is no outstanding balance through this interval.');
        return;
      }

      const broughtForwardRows = rows.filter((row) => row.period_end < bounds.start);
      const currentRows = rows.filter(
        (row) => row.period_start === bounds.start && row.period_end === bounds.end
      );

      const broughtForward = broughtForwardRows.reduce(
        (sum, row) => sum + Number(row.net_pay || 0),
        0
      );

      const currentDue = currentRows.reduce(
        (sum, row) => sum + Number(row.net_pay || 0),
        0
      );

      setPartTimeSettlement({
        employee,
        bounds,
        rows,
        broughtForward,
        currentDue,
        totalDue: broughtForward + currentDue,
      });
    } catch (error) {
      console.error('Part-time settlement preparation failed:', error);
      notify('Settlement could not be prepared', 'error', error?.message || 'Unknown error');
    } finally {
      setPartTimeSettlementLoading('');
    }
  };

  const settlePartTimeOutstanding = async (payment) => {
    if (!partTimeSettlement) return;
    const ids = partTimeSettlement.rows.map((row) => row.id);

    try {
      const result = await supabase
        .from('employee_payroll')
        .update({
          status: 'paid',
          paid_at: payment.paidAt,
          payment_method: payment.method,
          payment_reference: String(payment.reference || '').trim() || null,
        })
        .in('id', ids)
        .select();

      if (result.error) throw result.error;

      const advanceUpdate = await supabase
        .from('employee_advances')
        .update({ status: 'deducted' })
        .in('payroll_id', ids)
        .eq('status', 'allocated');

      if (advanceUpdate.error) throw advanceUpdate.error;

      const paidMap = new Map((result.data || []).map((row) => [String(row.id), row]));
      setPayroll((current) => current.map((row) => paidMap.get(String(row.id)) || row));
      setAdvances((current) => current.map((row) =>
        ids.includes(row.payroll_id) && row.status === 'allocated'
          ? { ...row, status: 'deducted' }
          : row
      ));

      notify(
        'Part-time balance settled',
        'success',
        `${partTimeSettlement.employee.name}: ${signedMoney(partTimeSettlement.totalDue)} closed through ${partTimeSettlement.bounds.end}.`
      );
      setPartTimeSettlement(null);
    } catch (error) {
      console.error('Part-time settlement failed:', error);
      notify('Settlement failed', 'error', error?.message || 'Unknown error');
      throw error;
    }
  };

  const currentHours = (employee) => {
    const bounds = employee.paymentInterval === 'weekly' ? week : month;
    return attendance.filter((row) => String(row.employee_id) === String(employee.id) && inRange(row.work_date, bounds.start, bounds.end)).reduce((sum, row) => sum + attendanceHours(row), 0);
  };

  const currentPayrollStatus = (employee) => {
    const bounds = employee.paymentInterval === 'weekly' ? week : month;
    const row = payroll.find((item) => String(item.employee_id) === String(employee.id) && item.period_start === bounds.start && item.period_end === bounds.end);
    if (employee.employmentType === 'Part-Time') {
      const bf = payroll.filter((item) => String(item.employee_id) === String(employee.id) && item.status !== 'paid' && item.period_end < bounds.start).reduce((sum, item) => sum + Number(item.net_pay || 0), 0);
      if (bf > 0) return 'Carry Forward';
    }
    return row?.status || 'Not Generated';
  };

  const Overview = () => {
    const alerts = [
      overview.missingClockOut.length && [`${overview.missingClockOut.length} missing clock-out${overview.missingClockOut.length === 1 ? '' : 's'}`, 'Review full-time attendance before payroll.', 'Attendance & OT'],
      overview.partTimeUnpaid.length && [`${signedMoney(overview.partTimeOutstanding)} part-time rolling balance`, `${overview.partTimeUnpaid.length} unsettled interval${overview.partTimeUnpaid.length === 1 ? '' : 's'} will carry forward until closed.`, 'Part-Time Hours'],
      overview.unpaid.length && [`${overview.unpaid.length} payroll period${overview.unpaid.length === 1 ? '' : 's'} unpaid`, `$${formatMoney(overview.payrollDue)} remains outstanding.`, 'Payroll & Payslips'],
      overview.outstandingAdvances.length && [`$${formatMoney(overview.advanceAmount)} salary advances outstanding`, `${overview.outstandingAdvances.length} record(s) pending or allocated.`, 'Payroll & Payslips'],
      overview.passExpiring.length && [`${overview.passExpiring.length} work pass${overview.passExpiring.length === 1 ? '' : 'es'} expiring within 60 days`, 'Review affected full-time employee records.', 'Directory'],
      overview.profileIssues.length && [`${overview.profileIssues.length} employee profile${overview.profileIssues.length === 1 ? '' : 's'} incomplete`, 'Complete essential payroll details before processing.', 'Directory'],
    ].filter(Boolean);

    return <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Active Employees" value={overview.active.length} detail={`${overview.fullTime} full-time · ${overview.partTime} part-time`} icon={Users} onClick={() => setActiveTab('Directory')} /><SummaryCard label="Hours This Week" value={`${overview.weeklyHours.toFixed(1)} hrs`} detail={`${overview.partTimeHours.toFixed(1)} part-time · ${overview.weeklyOt.toFixed(1)} OT`} icon={Clock} tone="violet" onClick={() => setActiveTab('Part-Time Hours')} /><SummaryCard label="Payroll Due" value={`$${formatMoney(overview.payrollDue)}`} detail={`${overview.unpaid.length} unpaid period(s)`} icon={DollarSign} tone="emerald" onClick={() => setActiveTab('Payroll & Payslips')} /><SummaryCard label="Outstanding Advances" value={`$${formatMoney(overview.advanceAmount)}`} detail={`${overview.outstandingAdvances.length} pending / allocated`} icon={Gift} tone="amber" onClick={() => setActiveTab('Payroll & Payslips')} /></div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase text-slate-400">Today’s Workforce</p><h2 className="mt-1 text-lg font-black">{today}</h2></div><Clock size={20} className="text-blue-500" /></div><div className="mt-5 grid grid-cols-2 gap-3">{[['Recorded / Clocked', overview.todayRows.filter((row) => row.clock_in || attendanceHours(row) > 0).length, 'bg-emerald-50 text-emerald-700', 'Attendance & OT'], ['On Leave', overview.onLeaveToday.length, 'bg-violet-50 text-violet-700', 'Leave Entitlement'], ['Not Recorded', overview.notClocked.length, 'bg-amber-50 text-amber-700', 'Part-Time Hours'], ['Missing Clock-Out', overview.missingClockOut.length, 'bg-red-50 text-red-700', 'Attendance & OT']].map(([label, value, cls, tab]) => <button key={label} type="button" onClick={() => setActiveTab(tab)} className={`rounded-xl p-4 text-left ${cls}`}><p className="text-[9px] font-black uppercase opacity-60">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></button>)}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-7"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-[10px] font-black uppercase text-slate-400">Action Centre</p><h2 className="mt-1 text-lg font-black">Needs Attention</h2></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">{alerts.length} open</span></div><div className="divide-y divide-slate-100 px-5">{alerts.length ? alerts.map(([title, detail, tab]) => <div key={title} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-600" /><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div></div><button type="button" onClick={() => setActiveTab(tab)} className="inline-flex items-center text-xs font-black text-blue-600">Review <ChevronRight size={14} /></button></div>) : <div className="flex items-center gap-3 py-7"><CheckCircle2 size={20} className="text-emerald-600" /><p className="text-sm font-black">No urgent employee exceptions</p></div>}</div></div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-[10px] font-black uppercase text-slate-400">Staff Snapshot</p><h2 className="mt-1 text-lg font-black">Current Employee Position</h2></div><button type="button" onClick={() => setActiveTab('Directory')} className="text-xs font-black text-blue-600">Full Directory</button></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-5 py-3">Employee</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Pay</th><th className="px-4 py-3 text-right">Current Hours</th><th className="px-5 py-3 text-center">Payroll</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{overview.active.slice(0, 8).map((employee) => <tr key={employee.id}><td className="px-5 py-3"><p className="font-black">{employee.name}</p><p className="text-[10px] text-slate-400">{employee.employeeNo}</p></td><td className="px-4 py-3">{employee.role}</td><td className="px-4 py-3">{employee.employmentType}</td><td className="px-4 py-3 font-black">{employeePayLabel(employee)}</td><td className="px-4 py-3 text-right font-mono font-black">{currentHours(employee).toFixed(1)}h</td><td className="px-5 py-3 text-center"><StatusBadge status={currentPayrollStatus(employee)} /></td></tr>)}</tbody></table></div></div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">Quick Actions</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{[['Add Employee', Users, () => setEmployeeEditor({})], ['Part-Time Hours', Table2, () => setActiveTab('Part-Time Hours')], ['Attendance', Clock, () => setAttendanceEditor({})], ['Salary Advance', Gift, () => setRecordModal('advance')], ['Leave Record', CalendarDays, () => setRecordModal('leave')], ['New Contract', FileText, () => setActiveTab('Contracts')]].map(([label, Icon, action]) => <button key={label} type="button" onClick={action} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-blue-200 hover:bg-blue-50"><Icon size={17} className="text-blue-600" /><p className="mt-3 text-xs font-black">{label}</p></button>)}</div></div>
    </div>;
  };

  const Directory = () => <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex w-full max-w-xl items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5"><Search size={17} className="mr-2 text-slate-400" /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search employee, role, ID..." className="w-full bg-transparent text-sm outline-none" /></div><button type="button" onClick={() => setEmployeeEditor({})} className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white"><Plus size={16} className="mr-2" />Add Employee</button></div><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left"><thead className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400"><tr><th className="p-4 pl-6">Employee</th><th className="p-4">Role</th><th className="p-4">Employment</th><th className="p-4">Pay Setup</th><th className="p-4">Admin Setup</th><th className="p-4">Data Health</th><th className="p-4 text-center">Status</th><th className="p-4 pr-6 text-right">Edit</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{filteredEmployees.map((employee) => { const issues = employeeIssues(employee); return <tr key={employee.id} className="hover:bg-blue-50/40"><td className="p-4 pl-6"><p className="font-black text-slate-800">{employee.name}</p><p className="text-[10px] text-slate-400">{employee.employeeNo}</p></td><td className="p-4 text-slate-700">{employee.role}</td><td className="p-4"><p className="font-bold">{employee.employmentType}</p><p className="text-xs text-slate-400">{employee.employmentType === 'Part-Time' ? 'Hourly worker' : employee.citizenshipType}</p></td><td className="p-4"><p className="font-black">{employeePayLabel(employee)}</p><p className="text-xs capitalize text-slate-400">{employee.paymentInterval}</p></td><td className="p-4">{employee.employmentType === 'Part-Time' ? <><span className="text-xs font-black text-blue-600">Hourly Only</span><p className="text-[10px] text-slate-400">Simplified setup</p></> : employee.cpfEligible ? <span className="text-xs font-black text-emerald-600">CPF Eligible</span> : <><span className="text-xs font-black text-amber-600">MOM Levy</span><p>${formatMoney(employee.levy)}</p></>}</td><td className="p-4">{issues.length ? <><span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">{issues.length} missing</span><p className="mt-1 max-w-[220px] text-[10px] text-slate-400">{issues.slice(0, 3).join(', ')}{issues.length > 3 ? ` +${issues.length - 3}` : ''}</p></> : <span className="text-xs font-black text-emerald-600">Complete</span>}</td><td className="p-4 text-center"><StatusBadge status={employee.status} /></td><td className="p-4 pr-6 text-right"><button type="button" onClick={() => setEmployeeEditor(employee)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-100 hover:text-blue-600"><Edit3 size={17} /></button></td></tr>; })}{!filteredEmployees.length && <tr><td colSpan="8" className="p-12 text-center text-sm text-slate-400">No employees match your search.</td></tr>}</tbody></table></div></div>;

  const Attendance = () => {
    const rows = attendance.filter((row) => employeeById.get(String(row.employee_id))?.employmentType !== 'Part-Time');
    const weekRows = rows.filter((row) => inRange(row.work_date, week.start, week.end));
    return <div className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><SummaryCard label="Regular Hours" value={`${weekRows.reduce((sum, row) => sum + Number(row.regular_hours || 0), 0).toFixed(1)} hrs`} detail={`${week.start} to ${week.end}`} icon={Clock} /><SummaryCard label="Overtime" value={`${weekRows.reduce((sum, row) => sum + Number(row.overtime_hours || 0), 0).toFixed(1)} hrs`} detail="Full-time OT this week" icon={TrendingUp} tone="violet" /><SummaryCard label="Entries" value={weekRows.length} detail="Full-time attendance records" icon={CalendarDays} tone="emerald" /></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><p className="text-[10px] font-black uppercase text-slate-400">Attendance & OT</p><h2 className="mt-1 text-lg font-black">Full-Time Daily Clock Records</h2></div><button type="button" onClick={() => setAttendanceEditor({})} className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white"><Plus size={16} className="mr-2" />Attendance Entry</button></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-5 py-3">Date</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Clock In</th><th className="px-4 py-3">Clock Out</th><th className="px-4 py-3 text-right">Regular</th><th className="px-4 py-3 text-right">OT</th><th className="px-5 py-3 text-center">Edit</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{rows.slice(0, 100).map((row) => <tr key={row.id}><td className="px-5 py-3 font-mono">{row.work_date}</td><td className="px-4 py-3 font-black">{employeeById.get(String(row.employee_id))?.name || 'Unknown'}</td><td className="px-4 py-3">{row.clock_in ? String(row.clock_in).slice(0, 5) : '—'}</td><td className="px-4 py-3">{row.clock_in && !row.clock_out ? <span className="font-black text-red-600">Missing</span> : row.clock_out ? String(row.clock_out).slice(0, 5) : '—'}</td><td className="px-4 py-3 text-right font-mono">{Number(row.regular_hours || 0).toFixed(2)}</td><td className="px-4 py-3 text-right font-mono text-violet-700">{Number(row.overtime_hours || 0).toFixed(2)}</td><td className="px-5 py-3 text-center"><button type="button" onClick={() => setAttendanceEditor(row)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Edit3 size={15} /></button></td></tr>)}{!rows.length && <tr><td colSpan="7" className="p-12 text-center text-sm text-slate-400">No full-time attendance records yet.</td></tr>}</tbody></table></div></div></div>;
  };

  const PartTimeHours = () => {
    const partTimers = employees
      .filter(
        (employee) =>
          employee.status === 'Active' &&
          employee.employmentType === 'Part-Time'
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const cycleWorkers = partTimers.filter(
      (employee) => employee.paymentInterval === partTimeCycle
    );

    const selectedEmployee = cycleWorkers.find(
      (employee) => String(employee.id) === String(partTimeEmployeeId)
    ) || cycleWorkers[0] || null;

    const bounds = intervalBounds(partTimeCycle, partTimeAnchor);
    const dates = dateRange(bounds.start, bounds.end);

    const employeeAttendance = selectedEmployee
      ? attendance.filter(
          (row) =>
            String(row.employee_id) === String(selectedEmployee.id) &&
            inRange(row.work_date, bounds.start, bounds.end)
        )
      : [];

    const allEmployeeAdvances = selectedEmployee
      ? advances.filter(
          (row) =>
            String(row.employee_id) === String(selectedEmployee.id) &&
            inRange(row.advance_date, bounds.start, bounds.end)
        )
      : [];

    const currentPayroll = selectedEmployee
      ? payroll.find(
          (row) =>
            String(row.employee_id) === String(selectedEmployee.id) &&
            row.period_start === bounds.start &&
            row.period_end === bounds.end
        )
      : null;

    const intervalLocked = currentPayroll?.status === 'paid';

    const employeeAdvances = allEmployeeAdvances.filter(
      (row) => intervalLocked || row.status !== 'deducted'
    );

    const totalHours = employeeAttendance.reduce(
      (sum, row) => sum + attendanceHours(row),
      0
    );

    const hourlyPay = employeeAttendance.reduce((sum, row) => {
      const rowRate =
        Number(row.hourly_rate_snapshot || 0) > 0
          ? Number(row.hourly_rate_snapshot)
          : Number(selectedEmployee?.hourlyRate || 0);

      return sum + attendanceHours(row) * rowRate;
    }, 0);

    const usedRates = Array.from(
      new Set(
        employeeAttendance
          .filter((row) => attendanceHours(row) > 0)
          .map((row) =>
            Number(row.hourly_rate_snapshot || 0) > 0
              ? Number(row.hourly_rate_snapshot)
              : Number(selectedEmployee?.hourlyRate || 0)
          )
          .filter((value) => value > 0)
          .map((value) => value.toFixed(2))
      )
    );

    const rateLabel =
      usedRates.length === 0
        ? `Default $${formatMoney(selectedEmployee?.hourlyRate || 0)}/hr`
        : usedRates.length === 1
          ? `$${formatMoney(Number(usedRates[0]))}/hr`
          : `${usedRates.length} daily rates`;
    const transportTotal = employeeAttendance.reduce(
      (sum, row) => sum + Number(row.transport_allowance || 0),
      0
    );

    const grossEarnings = hourlyPay + transportTotal;
    const advancesThisInterval = employeeAdvances.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );

    const currentBalance = currentPayroll
      ? Number(currentPayroll.net_pay || 0)
      : grossEarnings - advancesThisInterval;

    const currentSalaryPayment = selectedEmployee
      ? getPartTimeSalaryPayment(selectedEmployee.id, bounds.start, bounds.end)
      : null;

    const salaryIssuedThisInterval = Number(currentSalaryPayment?.amount || 0);

    const broughtForwardRows = selectedEmployee
      ? payroll.filter(
          (row) =>
            String(row.employee_id) === String(selectedEmployee.id) &&
            row.status !== 'paid' &&
            row.period_end < bounds.start
        )
      : [];

    const broughtForward = broughtForwardRows.reduce(
      (sum, row) => {
        const rowPayment = salaryPayments
          .filter(
            (payment) =>
              String(payment.employee_id) === String(selectedEmployee?.id) &&
              payment.period_start === row.period_start &&
              payment.period_end === row.period_end
          )
          .reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0);
        return sum + Number(row.net_pay || 0) - rowPayment;
      },
      0
    );

    const rollingBeforeCurrentPayment =
      broughtForward + (intervalLocked ? 0 : currentBalance);

    const rollingBalance =
      rollingBeforeCurrentPayment - (intervalLocked ? 0 : salaryIssuedThisInterval);

    const totalOutstandingIntervals =
      broughtForwardRows.filter((row) => {
        const rowPayment = salaryPayments
          .filter(
            (payment) =>
              String(payment.employee_id) === String(selectedEmployee?.id) &&
              payment.period_start === row.period_start &&
              payment.period_end === row.period_end
          )
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        return Math.abs(Number(row.net_pay || 0) - rowPayment) > 0.005;
      }).length +
      (currentPayroll && !intervalLocked && Math.abs(currentBalance - salaryIssuedThisInterval) > 0.005 ? 1 : 0);

    const switchCycle = (cycle) => {
      setPartTimeCycle(cycle);
      setPartTimeAnchor(localDateString());
      const first = partTimers.find((employee) => employee.paymentInterval === cycle);
      setPartTimeEmployeeId(first?.id || '');
    };

    const chooseEmployee = (employeeId) => {
      const chosen = partTimers.find((employee) => String(employee.id) === String(employeeId));
      if (!chosen) return;
      setPartTimeEmployeeId(chosen.id);
      setPartTimeCycle(chosen.paymentInterval || 'weekly');
      setPartTimeAnchor(localDateString());
    };

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Part-Time Timesheet & Salary Payment
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                Part-Time Pay Workspace
              </h2>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
                Enter the shift timing, rate and any advance directly in the ledger. Nothing is saved while you are typing; the completed value is written to Supabase only when you click, tap or tab away from that field. Transport defaults to $5 per worked day, and unsettled balances continue rolling into the next payment interval. Enter the amount actually paid in the Salary Issued column; the remaining balance rolls forward automatically.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[240px]">
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Part-Time Employee
                </span>
                <select
                  value={selectedEmployee?.id || ''}
                  onChange={(event) => chooseEmployee(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-700 outline-none focus:border-blue-300"
                >
                  {partTimers.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} · ${formatMoney(employee.hourlyRate)}/hr · {employee.paymentInterval}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Payment Interval
                </span>
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {[
                    ['weekly', 'Weekly'],
                    ['monthly', 'Monthly'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => switchCycle(value)}
                      className={`rounded-lg px-3 py-2 text-xs font-black ${
                        partTimeCycle === value
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPartTimeAnchor(localDateString())}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600"
              >
                Current
              </button>
            </div>
          </div>
        </div>

        {!selectedEmployee ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <Table2 size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-black text-slate-700">
              No {partTimeCycle} part-time employee configured
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Add or edit a Part-Time employee and set the matching payment interval.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <SummaryCard
                label="Hours"
                value={`${totalHours.toFixed(2)} hrs`}
                detail={intervalLabel(bounds.start, bounds.end, partTimeCycle)}
                icon={Clock}
                tone="violet"
              />
              <SummaryCard
                label="Gross Earnings"
                value={`$${formatMoney(grossEarnings)}`}
                detail={`Daily-rate pay $${formatMoney(hourlyPay)} + transport $${formatMoney(transportTotal)}`}
                icon={DollarSign}
                tone="emerald"
              />
              <SummaryCard
                label="Advances This Interval"
                value={`$${formatMoney(advancesThisInterval)}`}
                detail="Advances entered against this payment interval"
                icon={Gift}
                tone="amber"
              />
              <SummaryCard
                label="Brought Forward"
                value={signedMoney(broughtForward)}
                detail={`${broughtForwardRows.length} unsettled earlier interval${broughtForwardRows.length === 1 ? '' : 's'}`}
                icon={TrendingUp}
                tone={broughtForward < 0 ? 'amber' : 'blue'}
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPartTimeAnchor((current) => shiftInterval(current, partTimeCycle, -1))}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-900"
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <div className="min-w-[240px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-center">
                    <p className="text-sm font-black text-slate-900">
                      {intervalLabel(bounds.start, bounds.end, partTimeCycle)}
                    </p>
                    <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      {selectedEmployee.name} · {rateLabel}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPartTimeAnchor((current) => shiftInterval(current, partTimeCycle, 1))}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-900"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    <CheckCircle2 size={12} className="mr-1.5" /> Save On Exit
                  </span>
                  <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    $5 Transport Default
                  </span>
                  {intervalLocked ? (
                    <span className="inline-flex items-center rounded-lg bg-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600">
                      <Lock size={12} className="mr-1.5" /> Settled & Locked
                    </span>
                  ) : (
                    <span className="rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-blue-700">
                      Editable Interval
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1480px] border-collapse text-left">
                  <thead className="bg-white">
                    <tr className="border-b border-slate-200 text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                      <th className="sticky left-0 z-20 min-w-[105px] bg-white px-4 py-3 shadow-[1px_0_0_0_#e2e8f0]">Date</th>
                      <th className="min-w-[260px] px-3 py-3">Work Shift</th>
                      <th className="min-w-[105px] px-3 py-3 text-right">Duration</th>
                      <th className="min-w-[155px] px-3 py-3 text-right">Rate / Hourly Pay</th>
                      <th className="min-w-[130px] px-3 py-3 text-right">Transport</th>
                      <th className="min-w-[115px] bg-emerald-50/30 px-3 py-3 text-right">Gross</th>
                      <th className="min-w-[130px] px-3 py-3 text-right">Advance</th>
                      <th className="min-w-[150px] px-3 py-3 text-right">Salary Issued<br /><span className="normal-case font-semibold tracking-normal text-slate-300">interval total</span></th>
                      <th className="min-w-[118px] px-3 py-3 text-right">Daily Balance</th>
                      <th className="min-w-[130px] px-3 py-3 text-right">Database</th>
                    </tr>
                  </thead>

                  <tbody>
                    {dates.map((date) => {
                      const attendanceRow = employeeAttendance.find((row) => row.work_date === date) || null;
                      const dateAdvances = employeeAdvances.filter((row) => row.advance_date === date);
                      const sourceKey = `pt-timesheet:${selectedEmployee.id}:${date}`;
                      const timesheetAdvance = dateAdvances.find((row) => row.source_key === sourceKey) || null;
                      const otherAdvanceAmount = dateAdvances
                        .filter((row) => row.source_key !== sourceKey)
                        .reduce((sum, row) => sum + Number(row.amount || 0), 0);

                      return (
                        <PartTimeDayRow
                          key={`${selectedEmployee.id}-${date}`}
                          date={date}
                          employee={selectedEmployee}
                          attendanceRow={attendanceRow}
                          timesheetAdvance={timesheetAdvance}
                          otherAdvanceAmount={otherAdvanceAmount}
                          locked={intervalLocked}
                          saving={partTimeSavingKey === `${selectedEmployee.id}|${date}`}
                          onSave={(draft) => savePartTimeDay(selectedEmployee, draft)}
                          onDelete={(dateValue) => deletePartTimeDay(selectedEmployee, dateValue)}
                        />
                      );
                    })}
                  </tbody>

                  <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                    <tr className="text-xs font-black text-slate-800">
                      <td className="sticky left-0 z-10 bg-slate-50 px-4 py-4 shadow-[1px_0_0_0_#cbd5e1]">INTERVAL TOTAL</td>
                      <td className="px-3 py-4 text-slate-400">{usedRates.length <= 1 ? rateLabel : `${usedRates.length} rates used`}</td>
                      <td className="px-3 py-4 text-right font-mono">{durationLabel(totalHours)}</td>
                      <td className="px-3 py-4 text-right">
                        <p className="font-mono text-slate-800">${formatMoney(hourlyPay)}</p>
                        <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-slate-400">Hourly pay</p>
                      </td>
                      <td className="px-3 py-4 text-right font-mono">${formatMoney(transportTotal)}</td>
                      <td className="bg-emerald-50 px-3 py-4 text-right font-mono text-emerald-800">${formatMoney(grossEarnings)}</td>
                      <td className="px-3 py-4 text-right font-mono text-amber-800">${formatMoney(advancesThisInterval)}</td>
                      <td className="px-3 py-4 text-right">
                        <PartTimeSalaryIssuedCell
                          value={salaryIssuedThisInterval}
                          locked={intervalLocked}
                          saving={partTimeSavingKey === `${selectedEmployee.id}|salary|${bounds.start}|${bounds.end}`}
                          onSave={(amount) => savePartTimeSalaryIssued(selectedEmployee, bounds, amount)}
                        />
                      </td>
                      <td className={`px-3 py-4 text-right font-mono ${currentBalance < 0 ? 'text-red-700' : 'text-blue-700'}`}>
                        <p>{signedMoney(currentBalance)}</p>
                        <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-slate-400">Before payment</p>
                      </td>
                      <td className="px-3 py-4 text-right text-[9px] font-black uppercase tracking-wider text-slate-400">Salary issued saved on exit</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-7">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Interval Calculation
                </p>
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  {[
                    ['Hourly Earnings', hourlyPay],
                    ['Transport Allowance', transportTotal],
                    ['Gross Earnings', grossEarnings],
                    ['Advance Taken', -advancesThisInterval],
                    ['Salary Issued', -salaryIssuedThisInterval],
                    ['Current Interval Balance', currentBalance],
                    ['Brought Forward', broughtForward],
                  ].map(([label, amount], index) => (
                    <div
                      key={label}
                      className={`flex items-center justify-between px-4 py-3 text-sm ${index < 5 ? 'border-b border-slate-100' : ''}`}
                    >
                      <span className="text-slate-600">{label}</span>
                      <span className={`font-mono font-black ${Number(amount) < 0 ? 'text-red-700' : 'text-slate-900'}`}>
                        {signedMoney(amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-2xl border p-5 shadow-sm xl:col-span-5 ${rollingBalance < 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${rollingBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  Rolling Balance Through {bounds.end}
                </p>
                <p className={`mt-2 text-4xl font-black tracking-tight ${rollingBalance < 0 ? 'text-red-900' : 'text-emerald-900'}`}>
                  {signedMoney(rollingBalance)}
                </p>
                <p className={`mt-2 text-xs leading-5 ${rollingBalance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {rollingBalance < 0
                    ? `Advances exceed earned pay by $${formatMoney(Math.abs(rollingBalance))}. This negative balance carries forward until recovered or settled.`
                    : rollingBalance > 0
                      ? `Amount payable to ${selectedEmployee.name}, including any brought-forward balance.`
                      : 'The account is fully balanced through this interval.'}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Salary Issued This Interval</p>
                    <p className="mt-1 font-mono text-lg font-black text-slate-900">${formatMoney(salaryIssuedThisInterval)}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {totalOutstandingIntervals} open interval{totalOutstandingIntervals === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] leading-5 text-slate-500">
              <strong>Save-on-exit & rolling balance:</strong> typing never triggers a database write. A completed timing/rate/advance edit is saved only when you leave that field by clicking, tapping or tabbing elsewhere. Transport defaults to $5 for every worked day and can be overridden per date. Delete removes only that date’s timesheet entry and its timesheet-linked advance. Salary issued is saved only when you leave the amount field. The remaining balance carries forward automatically; payment history is stored separately from payroll calculations, and historical paid payroll remains protected.
            </div>
          </>
        )}
      </div>
    );
  };

  const Leave = () => <div className="space-y-5"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><p className="text-[10px] font-black uppercase text-slate-400">Leave Entitlement</p><h2 className="mt-1 text-lg font-black">Employee Leave Position</h2></div><button type="button" onClick={() => setRecordModal('leave')} className="inline-flex items-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white"><Plus size={16} className="mr-2" />Leave Record</button></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-5 py-3">Employee</th><th className="px-4 py-3 text-right">Annual Entitlement</th><th className="px-4 py-3 text-right">Annual Taken</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-right">Sick Taken</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{employees.filter((employee) => employee.status === 'Active' && employee.employmentType !== 'Part-Time').map((employee) => { const rows = leaveRecords.filter((row) => String(row.employee_id) === String(employee.id) && String(row.start_date || '').startsWith(String(new Date().getFullYear())) && String(row.status).toLowerCase() === 'approved'); const annual = rows.filter((row) => row.leave_type === 'Annual').reduce((sum, row) => sum + Number(row.days || 0), 0); const sick = rows.filter((row) => row.leave_type === 'Sick').reduce((sum, row) => sum + Number(row.days || 0), 0); return <tr key={employee.id}><td className="px-5 py-3"><p className="font-black">{employee.name}</p><p className="text-[10px] text-slate-400">{employee.role}</p></td><td className="px-4 py-3 text-right font-black">{employee.leaveEntitlement}</td><td className="px-4 py-3 text-right">{annual}</td><td className="px-4 py-3 text-right font-black text-emerald-700">{Math.max(0, employee.leaveEntitlement - annual)}</td><td className="px-4 py-3 text-right">{sick}</td></tr>; })}</tbody></table></div></div><div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-4 text-[10px] font-black uppercase text-slate-400">Recent Leave Records</div><div className="divide-y divide-slate-100">{leaveRecords.slice(0, 12).map((row) => <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-black">{employeeById.get(String(row.employee_id))?.name || 'Unknown'}</p><p className="mt-1 text-xs text-slate-500">{row.leave_type} · {row.start_date} to {row.end_date} · {row.days} day(s)</p></div><StatusBadge status={row.status} /></div>)}{!leaveRecords.length && <div className="p-10 text-center text-sm text-slate-400">No leave records yet.</div>}</div></div></div>;

  const Payroll = () => <div className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><SummaryCard label="Unpaid Payroll" value={`$${formatMoney(overview.payrollDue)}`} detail={`${overview.unpaid.length} payroll period(s)`} icon={DollarSign} tone="emerald" /><SummaryCard label="Part-Time B/F" value={signedMoney(overview.partTimeOutstanding)} detail={`${overview.partTimeUnpaid.length} unsettled part-time interval(s)`} icon={Table2} tone="amber" onClick={() => setActiveTab('Part-Time Hours')} /><SummaryCard label="Paid This Month" value={`$${formatMoney(overview.paidThisMonth)}`} detail="Net payroll payments" icon={CheckCircle2} /></div><div className="grid grid-cols-1 gap-5 xl:grid-cols-12"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-8"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><p className="text-[10px] font-black uppercase text-slate-400">Payroll History</p><h2 className="mt-1 text-lg font-black">Payroll Periods</h2></div><button type="button" onClick={() => setPayrollEditor(true)} className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white"><Plus size={16} className="mr-2" />Full-Time Payroll</button></div><div className="overflow-x-auto"><table className="w-full min-w-[930px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-5 py-3">Employee</th><th className="px-4 py-3">Period</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Net</th><th className="px-4 py-3 text-center">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{payroll.map((row) => { const employee = employeeById.get(String(row.employee_id)); const isPT = employee?.employmentType === 'Part-Time'; return <tr key={row.id}><td className="px-5 py-3"><p className="font-black">{employee?.name || 'Unknown'}</p><p className="text-[10px] text-slate-400">{employee?.employeeNo || ''}</p></td><td className="px-4 py-3 font-mono text-xs">{row.period_start} → {row.period_end}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[9px] font-black ${isPT ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{isPT ? 'PART-TIME' : 'FULL-TIME'}</span></td><td className="px-4 py-3 text-right font-mono">${formatMoney(row.gross_pay || 0)}</td><td className="px-4 py-3 text-right font-mono font-black">${formatMoney(row.net_pay || 0)}</td><td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td><td className="px-5 py-3 text-right"><div className="inline-flex gap-2"><button type="button" onClick={() => {
                        const employeeForSlip = employeeById.get(String(row.employee_id));
                        const issued = employeeForSlip?.employmentType === 'Part-Time'
                          ? salaryPayments
                              .filter((payment) => String(payment.employee_id) === String(row.employee_id) && payment.period_start === row.period_start && payment.period_end === row.period_end)
                              .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
                          : 0;
                        const broughtForward = employeeForSlip?.employmentType === 'Part-Time'
                          ? payroll
                              .filter((prior) => String(prior.employee_id) === String(row.employee_id) && prior.status !== 'paid' && prior.period_end < row.period_start)
                              .reduce((sum, prior) => {
                                const priorIssued = salaryPayments
                                  .filter((payment) => String(payment.employee_id) === String(row.employee_id) && payment.period_start === prior.period_start && payment.period_end === prior.period_end)
                                  .reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0);
                                return sum + Number(prior.net_pay || 0) - priorIssued;
                              }, 0)
                          : 0;
                        setPayslip({
                          ...row,
                          salary_issued: issued,
                          part_time_brought_forward: broughtForward,
                          part_time_rolling_balance: broughtForward + Number(row.net_pay || 0) - issued,
                        });
                      }} className="rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-black">Payslip</button>{row.status !== 'paid' && (isPT ? <button type="button" onClick={() => { setPartTimeCycle(employee.paymentInterval || 'weekly'); setPartTimeAnchor(row.period_end); setActiveTab('Part-Time Hours'); }} className="rounded-lg bg-blue-600 px-2.5 py-2 text-[10px] font-black text-white">Manage Hours</button> : <button type="button" onClick={() => markPayrollPaid(row)} className="rounded-lg bg-emerald-600 px-2.5 py-2 text-[10px] font-black text-white">Mark Paid</button>)}</div></td></tr>; })}{!payroll.length && <tr><td colSpan="7" className="p-12 text-center text-sm text-slate-400">No payroll periods generated yet.</td></tr>}</tbody></table></div></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-4"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><p className="text-[10px] font-black uppercase text-slate-400">Salary Advances</p><h2 className="mt-1 text-lg font-black">Advance Ledger</h2></div><button type="button" onClick={() => setRecordModal('advance')} className="rounded-lg bg-amber-600 p-2 text-white"><Plus size={16} /></button></div><div className="max-h-[600px] divide-y divide-slate-100 overflow-y-auto">{advances.map((row) => <div key={row.id} className="px-4 py-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-black">{employeeById.get(String(row.employee_id))?.name || 'Unknown'}</p><p className="mt-1 text-xs text-slate-500">{row.advance_date} · {row.reason || 'Salary advance'}</p></div><p className="font-mono font-black text-amber-700">${formatMoney(row.amount || 0)}</p></div><div className="mt-2"><StatusBadge status={row.status} /></div></div>)}{!advances.length && <div className="p-10 text-center text-sm text-slate-400">No salary advances recorded.</div>}</div></div></div></div>;

  if (loading) return <div className="flex h-full items-center justify-center bg-slate-50 p-8"><div className="text-center"><RefreshCw size={24} className="mx-auto animate-spin text-blue-600" /><p className="mt-3 text-sm font-bold text-slate-500">Loading employee records…</p></div></div>;
  if (loadError) return <div className="h-full overflow-y-auto bg-slate-50 p-8"><div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-6 shadow-sm"><AlertCircle size={30} className="text-red-600" /><h2 className="mt-4 text-xl font-black">Employee database setup required</h2><p className="mt-2 text-sm leading-6 text-slate-500">Run the Employee Supabase setup SQL once, then retry.</p><pre className="mt-4 overflow-x-auto rounded-xl bg-red-50 p-4 text-xs text-red-700">{loadError}</pre><button type="button" onClick={() => void reload()} className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">Retry</button></div></div>;

  const payslipEmployee = payslip ? employeeById.get(String(payslip.employee_id)) : null;

  return <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8"><div className="mx-auto w-full max-w-[1700px]">
    {notification && <div className="fixed right-5 top-5 z-[9000] w-[min(420px,calc(100vw-40px))]"><div className={`rounded-2xl border px-4 py-3 shadow-2xl ${notification.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : notification.type === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><div className="flex items-start gap-3"><AlertCircle size={17} className="mt-0.5 shrink-0" /><div className="flex-1"><p className="text-sm font-black">{notification.title}</p>{notification.message && <p className="mt-1 text-xs">{notification.message}</p>}</div><button type="button" onClick={() => setNotification(null)}><X size={14} /></button></div></div></div>}

    <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div className="flex items-center"><div className="mr-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50"><Users className="text-blue-600" size={24} /></div><div><h1 className="text-2xl font-semibold text-slate-900">Employee Management</h1><p className="mt-1 text-sm text-slate-500">Workforce information, part-time timesheets, attendance, leave, salary advances, payroll and employment contracts.</p></div></div><div className="flex gap-2"><button type="button" onClick={() => void reload()} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600"><RefreshCw size={14} className="mr-2" />Refresh</button><button type="button" onClick={() => setEmployeeEditor({})} className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white"><Plus size={17} className="mr-2" />Add Employee</button></div></div>

    <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">{EMPLOYEE_TABS.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex items-center whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold ${activeTab === tab.id ? 'border border-slate-200 bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}><tab.icon size={15} className="mr-2" />{tab.id}</button>)}</div>

    {activeTab === 'Overview' && <Overview />}
    {activeTab === 'Directory' && <Directory />}
    {activeTab === 'Contracts' && <EmployeeContractForm employees={employees} />}
    {activeTab === 'Attendance & OT' && <Attendance />}
    {activeTab === 'Part-Time Hours' && <PartTimeHours />}
    {activeTab === 'Leave Entitlement' && <Leave />}
    {activeTab === 'Payroll & Payslips' && <Payroll />}
  </div>

  {employeeEditor !== null && <EmployeeEditor employee={employeeEditor?.id ? employeeEditor : null} employees={employees} onClose={() => setEmployeeEditor(null)} onSave={saveEmployee} />}
  {attendanceEditor !== null && <AttendanceEditor employees={employees} record={attendanceEditor?.id ? attendanceEditor : null} onClose={() => setAttendanceEditor(null)} onSave={saveAttendance} />}
  {recordModal === 'advance' && <SimpleRecordModal kind="advance" employees={employees} onClose={() => setRecordModal(null)} onSave={saveAdvance} />}
  {recordModal === 'leave' && <SimpleRecordModal kind="leave" employees={employees} onClose={() => setRecordModal(null)} onSave={saveLeave} />}
  {payrollEditor && <PayrollEditor employees={employees} attendance={attendance} advances={advances} onClose={() => setPayrollEditor(false)} onGenerate={generatePayroll} />}
    {payslip && payslipEmployee && <PayslipPreview payroll={payslip} employee={payslipEmployee} onClose={() => setPayslip(null)} onMarkPaid={payslipEmployee.employmentType === 'Part-Time' ? null : () => markPayrollPaid(payslip)} />}
  </div>;
}
