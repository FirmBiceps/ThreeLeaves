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
  RotateCcw
} from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';

// ==========================================
// MOCK DATA
// ==========================================
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
  const [baseSalary, setBaseSalary] = useState(2000);
  
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
      setRole('Logistics cum Transport Operator'); setBaseSalary(2000);
    } else if (id) {
      const emp = employees.find(emp => emp.id === id);
      if (emp) {
        setEmployeeName(emp.name || '');
        setNric(emp.nricFin || '');
        setPhone(emp.phone || '');
        setRole(emp.role || '');
        setBaseSalary(emp.basicSalary || 0);
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
      <p className="mb-2">3.1 The Employer agrees to pay the Employee a gross monthly salary of <strong>S${formatWithCommas(baseSalary)}</strong> whilst on probation, which includes the base salary for the agreed working hours.</p>
      {allowances.length > 0 && (
        <p className="mb-2">Additionally, the Employee is entitled to the following monthly allowances: {allowances.map(a => `${a.type || 'Allowance'} (S$${formatWithCommas(a.amount)})`).join(', ')}.</p>
      )}
      <p className="mb-2">3.2 Salary will be paid on the 15th of each month by Bank Transfer/Paylah to the Employee's nominated account.</p>
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
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Base Salary ($)</label>
                <input type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-lg font-black text-blue-700 bg-blue-50/50 outline-none" />
              </div>
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
// MAIN COMPONENT
// ==========================================
// ==========================================
// EMPLOYEE DATA HELPERS
// ==========================================
const EMPLOYEE_TABS = [
  { id: 'Overview', icon: Users },
  { id: 'Directory', icon: Users },
  { id: 'Contracts', icon: FileText },
  { id: 'Attendance & OT', icon: Clock },
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
  return {
    employee_no: String(employee.employeeNo || '').trim(),
    name: String(employee.name || '').trim(),
    role: String(employee.role || '').trim(),
    status: employee.status || 'Active',
    employment_type: employee.employmentType || 'Full-Time',
    citizenship_type: employee.citizenshipType || 'Citizen',
    nric_fin: String(employee.nricFin || '').trim() || null,
    phone: String(employee.phone || '').trim() || null,
    commencement_date: employee.commencementDate || null,
    probation_months: Number(employee.probationMonths || 0) || 0,
    pay_basis: employee.payBasis || 'monthly_salary',
    basic_salary: employee.payBasis === 'monthly_salary' ? Number(employee.basicSalary || 0) || 0 : 0,
    hourly_rate: employee.payBasis === 'hourly' ? Number(employee.hourlyRate || 0) || 0 : 0,
    payment_interval: employee.paymentInterval || 'monthly',
    cpf_eligible: Boolean(employee.cpfEligible),
    levy: Number(employee.levy || 0) || 0,
    leave_entitlement: Number(employee.leaveEntitlement || 0) || 0,
    sick_leave_entitlement: Number(employee.sickLeaveEntitlement || 0) || 0,
    hospitalisation_leave_entitlement: Number(employee.hospitalisationLeaveEntitlement || 0) || 0,
    work_pass_expiry: employee.workPassExpiry || null,
    payment_method: employee.paymentMethod || 'Bank Transfer',
    bank_name: String(employee.bankName || '').trim() || null,
    bank_account_name: String(employee.bankAccountName || '').trim() || null,
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
  return employee.payBasis === 'hourly'
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

function inclusiveDays(startValue, endValue) {
  if (!startValue || !endValue) return 0;
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function employeeIssues(employee) {
  const issues = [];
  if (!employee.role) issues.push('Role');
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
    : lower === 'ready' || lower === 'allocated'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : lower === 'pending' || lower === 'draft'
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

function EmployeeEditor({ employee, employees, onClose, onSave }) {
  const [form, setForm] = useState(employee ? { ...EMPTY_EMPLOYEE, ...employee } : {
    ...EMPTY_EMPLOYEE,
    employeeNo: nextEmployeeNo(employees),
    commencementDate: localDateString(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!String(form.employeeNo || '').trim()) return setError('Employee ID is required.');
    if (!String(form.name || '').trim()) return setError('Employee name is required.');
    if (!String(form.role || '').trim()) return setError('Role is required.');
    if (form.payBasis === 'hourly' && !(Number(form.hourlyRate) > 0)) return setError('Hourly employees require a valid hourly rate.');
    if (form.payBasis === 'monthly_salary' && !(Number(form.basicSalary) > 0)) return setError('Monthly employees require a valid basic salary.');
    setError('');
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  const Field = ({ label, children, span = '' }) => (
    <label className={span}>
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      {children}
    </label>
  );

  const inputClass = 'w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

  return (
    <ModalShell title={employee ? 'Edit Employee' : 'Add Employee'} eyebrow="Employee Record" onClose={onClose} maxWidth="max-w-5xl">
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-5 sm:p-6">
          <section>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Identity & Employment</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Employee ID *"><input value={form.employeeNo} onChange={(e) => update('employeeNo', e.target.value.toUpperCase())} className={inputClass} /></Field>
              <Field label="Full Name *" span="xl:col-span-2"><input value={form.name} onChange={(e) => update('name', e.target.value)} className={inputClass} /></Field>
              <Field label="Status"><select value={form.status} onChange={(e) => update('status', e.target.value)} className={inputClass}><option>Active</option><option>On Leave</option><option>Resigned</option><option>Terminated</option></select></Field>
              <Field label="Role *" span="md:col-span-2"><input value={form.role} onChange={(e) => update('role', e.target.value)} className={inputClass} /></Field>
              <Field label="Employment Type"><select value={form.employmentType} onChange={(e) => update('employmentType', e.target.value)} className={inputClass}><option>Full-Time</option><option>Part-Time</option></select></Field>
              <Field label="Citizenship / Pass"><select value={form.citizenshipType} onChange={(e) => update('citizenshipType', e.target.value)} className={inputClass}><option>Citizen</option><option>PR</option><option value="WP">Work Permit</option><option value="SP">S Pass</option><option value="EP">Employment Pass</option></select></Field>
              <Field label="NRIC / FIN"><input value={form.nricFin} onChange={(e) => update('nricFin', e.target.value.toUpperCase())} className={inputClass} /></Field>
              <Field label="Phone"><input value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} /></Field>
              <Field label="Commencement"><input type="date" value={form.commencementDate || ''} onChange={(e) => update('commencementDate', e.target.value)} className={inputClass} /></Field>
              <Field label="Probation (Months)"><input type="number" min="0" value={form.probationMonths} onChange={(e) => update('probationMonths', e.target.value)} className={inputClass} /></Field>
              {['WP', 'SP', 'EP'].includes(form.citizenshipType) && <Field label="Work Pass Expiry"><input type="date" value={form.workPassExpiry || ''} onChange={(e) => update('workPassExpiry', e.target.value)} className={inputClass} /></Field>}
            </div>
          </section>

          <section>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Compensation & Payment</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Pay Basis"><select value={form.payBasis} onChange={(e) => update('payBasis', e.target.value)} className={inputClass}><option value="monthly_salary">Monthly Salary</option><option value="hourly">Hourly</option></select></Field>
              <Field label="Payment Interval"><select value={form.paymentInterval} onChange={(e) => update('paymentInterval', e.target.value)} className={inputClass}><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select></Field>
              {form.payBasis === 'hourly'
                ? <Field label="Hourly Rate ($)"><input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => update('hourlyRate', e.target.value)} className={`${inputClass} bg-blue-50 text-right font-black text-blue-700`} /></Field>
                : <Field label="Basic Salary ($)"><input type="number" min="0" step="0.01" value={form.basicSalary} onChange={(e) => update('basicSalary', e.target.value)} className={`${inputClass} bg-blue-50 text-right font-black text-blue-700`} /></Field>}
              <Field label="Payment Method"><select value={form.paymentMethod} onChange={(e) => update('paymentMethod', e.target.value)} className={inputClass}><option>Bank Transfer</option><option>PayNow</option><option>Cash</option><option>Cheque</option></select></Field>
              <Field label="Bank"><input value={form.bankName} onChange={(e) => update('bankName', e.target.value)} className={inputClass} /></Field>
              <Field label="Account Name"><input value={form.bankAccountName} onChange={(e) => update('bankAccountName', e.target.value)} className={inputClass} /></Field>
              <Field label="Account / PayNow Reference" span="md:col-span-2"><input value={form.bankAccountNo} onChange={(e) => update('bankAccountNo', e.target.value)} className={inputClass} /></Field>
            </div>
          </section>

          <section>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">CPF, Levy & Leave</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><span className="text-xs font-bold text-slate-600">CPF Eligible</span><input type="checkbox" checked={Boolean(form.cpfEligible)} onChange={(e) => update('cpfEligible', e.target.checked)} /></label>
              <Field label="MOM Levy ($)"><input type="number" min="0" step="0.01" value={form.levy} onChange={(e) => update('levy', e.target.value)} className={inputClass} /></Field>
              <Field label="Annual Leave"><input type="number" min="0" step="0.5" value={form.leaveEntitlement} onChange={(e) => update('leaveEntitlement', e.target.value)} className={inputClass} /></Field>
              <Field label="Sick Leave"><input type="number" min="0" step="0.5" value={form.sickLeaveEntitlement} onChange={(e) => update('sickLeaveEntitlement', e.target.value)} className={inputClass} /></Field>
              <Field label="Hospitalisation"><input type="number" min="0" step="0.5" value={form.hospitalisationLeaveEntitlement} onChange={(e) => update('hospitalisationLeaveEntitlement', e.target.value)} className={inputClass} /></Field>
            </div>
          </section>

          <Field label="Internal Notes"><textarea rows="3" value={form.notes} onChange={(e) => update('notes', e.target.value)} className={inputClass} /></Field>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex min-w-[145px] items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-50"><Save size={15} className="mr-2" />{saving ? 'Saving…' : 'Save Employee'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function AttendanceEditor({ employees, record, onClose, onSave }) {
  const active = employees.filter((employee) => employee.status === 'Active');
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
    try { await onSave({ ...form, regularHours: regular }); } finally { setSaving(false); }
  };

  return (
    <ModalShell title={record ? 'Edit Daily Entry' : 'Add Daily Entry'} eyebrow="Attendance & OT" onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-5 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="md:col-span-2"><span className="mb-1.5 block text-xs font-bold text-slate-600">Employee</span><select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className={cls}>{active.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}</select></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Work Date</span><input required type="date" value={form.workDate} onChange={(e) => setForm({ ...form, workDate: e.target.value })} className={cls} /></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={cls}><option>Present</option><option>Absent</option><option>Off</option></select></label>
          {form.status === 'Present' && <>
            <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Clock In</span><input type="time" value={form.clockIn} onChange={(e) => setForm({ ...form, clockIn: e.target.value })} className={cls} /></label>
            <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Clock Out</span><input type="time" value={form.clockOut} onChange={(e) => setForm({ ...form, clockOut: e.target.value })} className={cls} /></label>
            <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Break Minutes</span><input type="number" min="0" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} className={cls} /></label>
            <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Overtime Hours</span><input type="number" min="0" max={total} step="0.25" value={form.overtimeHours} onChange={(e) => setForm({ ...form, overtimeHours: e.target.value })} className={cls} /></label>
          </>}
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-blue-50 p-4"><div><p className="text-[9px] font-black uppercase text-blue-500">Regular Hours</p><p className="mt-1 text-xl font-black text-blue-900">{regular.toFixed(2)}</p></div><div><p className="text-[9px] font-black uppercase text-blue-500">Total Clocked</p><p className="mt-1 text-xl font-black text-blue-900">{total.toFixed(2)}</p></div></div>
        <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Notes</span><textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={cls} /></label>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500">Cancel</button><button type="submit" disabled={saving || !form.employeeId} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save Attendance'}</button></div>
      </form>
    </ModalShell>
  );
}

function SimpleRecordModal({ kind, employees, onClose, onSave }) {
  const active = employees.filter((employee) => employee.status === 'Active');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(kind === 'advance' ? {
    employeeId: active[0]?.id || '', date: localDateString(), amount: '', reason: '', notes: '',
  } : {
    employeeId: active[0]?.id || '', leaveType: 'Annual', startDate: localDateString(), endDate: localDateString(), status: 'Approved', notes: '',
  });
  const days = kind === 'leave' ? inclusiveDays(form.startDate, form.endDate) : 0;
  const cls = 'w-full rounded-xl border border-slate-200 p-3 text-sm outline-none';

  const submit = async (event) => {
    event.preventDefault();
    if (kind === 'advance' && !(Number(form.amount) > 0)) return;
    if (kind === 'leave' && days <= 0) return;
    setSaving(true);
    try { await onSave(kind === 'leave' ? { ...form, days } : form); } finally { setSaving(false); }
  };

  return (
    <ModalShell title={kind === 'advance' ? 'Record Salary Advance' : 'Add Leave Record'} eyebrow={kind === 'advance' ? 'Salary Advance' : 'Leave'} onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4 overflow-y-auto p-6">
        <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Employee</span><select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className={cls}>{active.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        {kind === 'advance' ? <>
          <div className="grid grid-cols-2 gap-4"><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Date</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Amount ($)</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${cls} bg-amber-50 text-right font-black text-amber-700`} /></label></div>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Reason</span><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={cls} /></label>
        </> : <>
          <div className="grid grid-cols-2 gap-4"><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Leave Type</span><select value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })} className={cls}><option>Annual</option><option>Sick</option><option>Hospitalisation</option><option>Unpaid</option><option>Other</option></select></label><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={cls}><option>Approved</option><option>Pending</option><option>Rejected</option></select></label></div>
          <div className="grid grid-cols-2 gap-4"><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Start</span><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold text-slate-600">End</span><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={cls} /></label></div>
          <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm font-black text-violet-800">{days} day{days === 1 ? '' : 's'}</div>
        </>}
        <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Notes</span><textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={cls} /></label>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500">Cancel</button><button type="submit" disabled={saving || !form.employeeId} className={`rounded-xl px-6 py-2.5 text-sm font-black text-white disabled:opacity-50 ${kind === 'advance' ? 'bg-amber-600' : 'bg-violet-600'}`}>{saving ? 'Saving…' : 'Save'}</button></div>
      </form>
    </ModalShell>
  );
}

function PayrollEditor({ employees, attendance, advances, onClose, onGenerate }) {
  const active = employees.filter((employee) => employee.status === 'Active');
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

  const rows = attendance.filter((row) => row.employee_id === employeeId && inRange(row.work_date, periodStart, periodEnd));
  const regularHours = rows.reduce((sum, row) => sum + Number(row.regular_hours || 0), 0);
  const overtimeHours = rows.reduce((sum, row) => sum + Number(row.overtime_hours || 0), 0);
  const pendingAdvances = advances.filter((row) => row.employee_id === employeeId && row.status === 'pending' && String(row.advance_date || '') <= periodEnd);
  const advanceDeductions = pendingAdvances.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const basicPay = employee?.payBasis === 'monthly_salary' ? Number(employee.basicSalary || 0) : 0;
  const hourlyPay = employee?.payBasis === 'hourly' ? regularHours * Number(employee.hourlyRate || 0) : 0;
  const overtimePay = overtimeHours * Number(overtimeRate || 0);
  const grossPay = basicPay + hourlyPay + overtimePay + Number(allowances || 0);
  const netPay = Math.max(0, grossPay - advanceDeductions - Number(otherDeductions || 0));

  const submit = async (event) => {
    event.preventDefault();
    if (!employee) return;
    setSaving(true);
    try {
      await onGenerate({ employee, periodStart, periodEnd, regularHours, overtimeHours, overtimeRate: Number(overtimeRate || 0), basicPay, hourlyPay, overtimePay, allowances: Number(allowances || 0), grossPay, advanceDeductions, otherDeductions: Number(otherDeductions || 0), netPay, pendingAdvances, notes });
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Generate Payroll Period" eyebrow="Payroll" onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={submit} className="space-y-5 overflow-y-auto p-6">
        <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Employee</span><select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={cls}>{active.map((item) => <option key={item.id} value={item.id}>{item.name} · {employeePayLabel(item)} · {item.paymentInterval}</option>)}</select></label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Period Start</span><input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Period End</span><input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Allowance / Bonus ($)</span><input type="number" min="0" step="0.01" value={allowances} onChange={(e) => setAllowances(e.target.value)} className={cls} /></label><label><span className="mb-1.5 block text-xs font-bold text-slate-600">Other Deductions ($)</span><input type="number" min="0" step="0.01" value={otherDeductions} onChange={(e) => setOtherDeductions(e.target.value)} className={cls} /></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold text-slate-600">Overtime Rate ($ / hr)</span><input type="number" min="0" step="0.01" value={overtimeRate} onChange={(e) => setOvertimeRate(e.target.value)} className={cls} /><span className="mt-1 block text-[10px] text-slate-400">Confirm the applicable OT rate before finalising payroll; this field is not a legal entitlement calculator.</span></label></div>
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-4"><div><p className="text-[9px] font-black uppercase text-slate-400">Regular Hours</p><p className="mt-1 text-lg font-black">{regularHours.toFixed(2)}</p></div><div><p className="text-[9px] font-black uppercase text-slate-400">OT Hours</p><p className="mt-1 text-lg font-black">{overtimeHours.toFixed(2)}</p></div><div><p className="text-[9px] font-black uppercase text-slate-400">Advances</p><p className="mt-1 text-lg font-black text-amber-700">${formatMoney(advanceDeductions)}</p></div><div><p className="text-[9px] font-black uppercase text-slate-400">Attendance Days</p><p className="mt-1 text-lg font-black">{rows.length}</p></div></div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">{[['Basic / Hourly Pay', basicPay + hourlyPay], ['Overtime Pay', overtimePay], ['Allowance / Bonus', Number(allowances || 0)], ['Gross Pay', grossPay], ['Salary Advances', -advanceDeductions], ['Other Deductions', -Number(otherDeductions || 0)], ['Net Pay', netPay]].map(([label, amount], index) => <div key={label} className={`flex items-center justify-between px-4 py-3 text-sm ${index === 6 ? 'bg-emerald-50 font-black text-emerald-800' : 'border-b border-slate-100 text-slate-700'}`}><span>{label}</span><span>${formatMoney(amount)}</span></div>)}</div>
        <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Notes</span><textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} className={cls} /></label>
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
      <div className="mt-6 grid grid-cols-2 gap-4 text-xs text-slate-500"><div><p className="font-bold uppercase">Status</p><p className="mt-1 text-sm font-black text-slate-800">{String(payroll.status || '').toUpperCase()}</p></div><div><p className="font-bold uppercase">Payment</p><p className="mt-1 text-sm font-black text-slate-800">{payroll.paid_at || '—'} · {payroll.payment_method || employee.paymentMethod || '—'}</p>{payroll.payment_reference && <p className="mt-1">Ref: {payroll.payment_reference}</p>}</div></div>
    </div>
  );

  return <>
    {createPortal(<div className="fixed inset-0 z-[8200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm print:hidden"><div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Payslip Preview</p><h2 className="mt-1 text-lg font-black text-slate-900">{employee.name}</h2></div><div className="flex gap-2">{payroll.status !== 'paid' && <button type="button" onClick={onMarkPaid} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">Mark Paid</button>}<button type="button" onClick={() => window.print()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">Print</button><button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div></div><div className="overflow-y-auto bg-slate-100 p-6"><div className="mx-auto max-w-[210mm] rounded-xl bg-white p-[15mm] shadow-lg">{content}</div></div></div></div>, document.body)}
    {createPortal(<div id="employee-payslip-print" className="hidden"><style>{`@media print { @page { size:A4 portrait; margin:15mm; } body > *:not(#employee-payslip-print) { display:none !important; } #employee-payslip-print { display:block !important; } }`}</style>{content}</div>, document.body)}
  </>;
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
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [employeeEditor, setEmployeeEditor] = useState(null);
  const [attendanceEditor, setAttendanceEditor] = useState(null);
  const [recordModal, setRecordModal] = useState(null);
  const [payrollEditor, setPayrollEditor] = useState(false);
  const [payslip, setPayslip] = useState(null);
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
        supabase.from('employee_leave').select('*').order('start_date', { ascending: false }),
      ]);
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      setEmployees((results[0].data || []).map(normaliseEmployee));
      setAttendance(results[1].data || []);
      setAdvances(results[2].data || []);
      setPayroll(results[3].data || []);
      setLeaveRecords(results[4].data || []);
    } catch (error) {
      console.error('Employee module load failed:', error);
      setLoadError(error?.message || 'Unable to load employee data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [String(employee.id), employee])), [employees]);
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
    const clockedIds = new Set(todayRows.filter((row) => row.clock_in).map((row) => String(row.employee_id)));
    const missingClockOut = todayRows.filter((row) => row.clock_in && !row.clock_out);
    const notClocked = active.filter((employee) => !clockedIds.has(String(employee.id)) && !leaveIds.has(String(employee.id)));
    const profileIssues = active.map((employee) => ({ employee, issues: employeeIssues(employee) })).filter((entry) => entry.issues.length);
    const passExpiring = active.filter((employee) => {
      if (!employee.workPassExpiry) return false;
      const expiry = new Date(`${employee.workPassExpiry}T00:00:00`);
      const now = new Date(`${today}T00:00:00`);
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 60);
      return expiry >= now && expiry <= cutoff;
    });
    return {
      active,
      fullTime: active.filter((employee) => employee.employmentType === 'Full-Time').length,
      partTime: active.filter((employee) => employee.employmentType === 'Part-Time').length,
      weeklyHours: weekRows.reduce((sum, row) => sum + attendanceHours(row), 0),
      weeklyOt: weekRows.reduce((sum, row) => sum + Number(row.overtime_hours || 0), 0),
      payrollDue: unpaid.reduce((sum, row) => sum + Number(row.net_pay || 0), 0),
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
    };
  }, [employees, attendance, advances, payroll, leaveRecords, today, week.start, week.end, employeeById]);

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
      setEmployees((current) => form.id
        ? current.map((item) => item.id === employee.id ? employee : item)
        : [...current, employee].sort((a, b) => a.name.localeCompare(b.name)));
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
        : await supabase.from('employee_attendance').upsert(payload, { onConflict: 'employee_id,work_date' }).select().single();
      if (result.error) throw result.error;
      setAttendance((current) => [result.data, ...current.filter((row) => row.id !== result.data.id)].sort((a, b) => String(b.work_date).localeCompare(String(a.work_date))));
      setAttendanceEditor(null);
      notify('Attendance saved');
    } catch (error) { notify('Attendance save failed', 'error', error?.message || 'Unknown error'); throw error; }
  };

  const saveAdvance = async (form) => {
    try {
      const result = await supabase.from('employee_advances').insert([{ employee_id: form.employeeId, advance_date: form.date, amount: Number(form.amount), reason: String(form.reason || '').trim() || null, notes: String(form.notes || '').trim() || null, status: 'pending' }]).select().single();
      if (result.error) throw result.error;
      setAdvances((current) => [result.data, ...current]);
      setRecordModal(null);
      notify('Salary advance recorded');
    } catch (error) { notify('Advance save failed', 'error', error?.message || 'Unknown error'); throw error; }
  };

  const saveLeave = async (form) => {
    try {
      const result = await supabase.from('employee_leave').insert([{ employee_id: form.employeeId, leave_type: form.leaveType, start_date: form.startDate, end_date: form.endDate, days: Number(form.days), status: form.status, notes: String(form.notes || '').trim() || null }]).select().single();
      if (result.error) throw result.error;
      setLeaveRecords((current) => [result.data, ...current]);
      setRecordModal(null);
      notify('Leave record saved');
    } catch (error) { notify('Leave save failed', 'error', error?.message || 'Unknown error'); throw error; }
  };

  const generatePayroll = async (calc) => {
    try {
      const result = await supabase.from('employee_payroll').insert([{
        employee_id: calc.employee.id,
        period_start: calc.periodStart,
        period_end: calc.periodEnd,
        pay_interval: calc.employee.paymentInterval,
        pay_basis: calc.employee.payBasis,
        rate_snapshot: calc.employee.payBasis === 'hourly' ? calc.employee.hourlyRate : calc.employee.basicSalary,
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
      }]).select().single();
      if (result.error) throw result.error;

      if (calc.pendingAdvances.length) {
        const ids = calc.pendingAdvances.map((row) => row.id);
        const update = await supabase.from('employee_advances').update({ status: 'allocated', payroll_id: result.data.id }).in('id', ids);
        if (update.error) {
          await supabase.from('employee_payroll').delete().eq('id', result.data.id);
          throw update.error;
        }
        const idSet = new Set(ids.map(String));
        setAdvances((current) => current.map((row) => idSet.has(String(row.id)) ? { ...row, status: 'allocated', payroll_id: result.data.id } : row));
      }

      setPayroll((current) => [result.data, ...current]);
      setPayrollEditor(false);
      notify('Payroll generated', 'success', `${calc.employee.name}: $${formatMoney(calc.netPay)} net pay`);
    } catch (error) { notify('Payroll generation failed', 'error', error?.message || 'Unknown error'); throw error; }
  };

  const markPayrollPaid = async (row) => {
    const employee = employeeById.get(String(row.employee_id));
    const reference = window.prompt('Payment reference (optional):', '') ?? '';
    const method = employee?.paymentMethod || 'Bank Transfer';
    try {
      const result = await supabase.from('employee_payroll').update({ status: 'paid', paid_at: today, payment_method: method, payment_reference: reference.trim() || null }).eq('id', row.id).select().single();
      if (result.error) throw result.error;
      const advanceUpdate = await supabase.from('employee_advances').update({ status: 'deducted' }).eq('payroll_id', row.id).eq('status', 'allocated');
      if (advanceUpdate.error) throw advanceUpdate.error;
      setPayroll((current) => current.map((item) => item.id === row.id ? result.data : item));
      setAdvances((current) => current.map((item) => item.payroll_id === row.id && item.status === 'allocated' ? { ...item, status: 'deducted' } : item));
      setPayslip(result.data);
      notify('Payroll marked paid');
    } catch (error) { notify('Payment update failed', 'error', error?.message || 'Unknown error'); }
  };

  const currentHours = (employee) => {
    const bounds = employee.paymentInterval === 'weekly' ? week : month;
    return attendance.filter((row) => String(row.employee_id) === String(employee.id) && inRange(row.work_date, bounds.start, bounds.end)).reduce((sum, row) => sum + attendanceHours(row), 0);
  };

  const currentPayrollStatus = (employee) => {
    const bounds = employee.paymentInterval === 'weekly' ? week : month;
    return payroll.find((row) => String(row.employee_id) === String(employee.id) && row.period_start === bounds.start && row.period_end === bounds.end)?.status || 'Not Generated';
  };

  const Overview = () => {
    const alerts = [
      overview.missingClockOut.length && [`${overview.missingClockOut.length} missing clock-out${overview.missingClockOut.length === 1 ? '' : 's'}`, 'Review attendance before payroll.', 'Attendance & OT'],
      overview.unpaid.length && [`${overview.unpaid.length} payroll period${overview.unpaid.length === 1 ? '' : 's'} unpaid`, `$${formatMoney(overview.payrollDue)} remains outstanding.`, 'Payroll & Payslips'],
      overview.outstandingAdvances.length && [`$${formatMoney(overview.advanceAmount)} salary advances outstanding`, `${overview.outstandingAdvances.length} pending or allocated advance record(s).`, 'Payroll & Payslips'],
      overview.passExpiring.length && [`${overview.passExpiring.length} work pass${overview.passExpiring.length === 1 ? '' : 'es'} expiring within 60 days`, 'Review employee pass information.', 'Directory'],
      overview.profileIssues.length && [`${overview.profileIssues.length} employee profile${overview.profileIssues.length === 1 ? '' : 's'} incomplete`, 'Complete missing payroll/identity information.', 'Directory'],
    ].filter(Boolean);

    return <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Active Employees" value={overview.active.length} detail={`${overview.fullTime} full-time · ${overview.partTime} part-time`} icon={Users} tone="blue" onClick={() => setActiveTab('Directory')} />
        <SummaryCard label="Hours This Week" value={`${overview.weeklyHours.toFixed(1)} hrs`} detail={`${overview.weeklyOt.toFixed(1)} overtime hours`} icon={Clock} tone="violet" onClick={() => setActiveTab('Attendance & OT')} />
        <SummaryCard label="Payroll Due" value={`$${formatMoney(overview.payrollDue)}`} detail={`${overview.unpaid.length} unpaid payroll period(s)`} icon={DollarSign} tone="emerald" onClick={() => setActiveTab('Payroll & Payslips')} />
        <SummaryCard label="Outstanding Advances" value={`$${formatMoney(overview.advanceAmount)}`} detail={`${overview.outstandingAdvances.length} pending / allocated record(s)`} icon={Gift} tone="amber" onClick={() => setActiveTab('Payroll & Payslips')} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Today’s Workforce</p><h2 className="mt-1 text-lg font-black text-slate-900">{today}</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">{[['Clocked In', overview.todayRows.filter((row) => row.clock_in).length, 'bg-emerald-50 text-emerald-700'], ['On Leave', overview.onLeaveToday.length, 'bg-violet-50 text-violet-700'], ['Not Clocked In', overview.notClocked.length, 'bg-amber-50 text-amber-700'], ['Missing Clock-Out', overview.missingClockOut.length, 'bg-red-50 text-red-700']].map(([label, value, classes]) => <button key={label} type="button" onClick={() => setActiveTab(label === 'On Leave' ? 'Leave Entitlement' : 'Attendance & OT')} className={`rounded-xl p-4 text-left ${classes}`}><p className="text-[9px] font-black uppercase opacity-60">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></button>)}</div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-7"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Action Centre</p><h2 className="mt-1 text-lg font-black text-slate-900">Needs Attention</h2></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">{alerts.length} open</span></div><div className="divide-y divide-slate-100 px-5">{alerts.length ? alerts.map(([title, detail, tab]) => <div key={title} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-600" /><div><p className="text-sm font-black text-slate-800">{title}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div></div><button type="button" onClick={() => setActiveTab(tab)} className="text-xs font-black text-blue-600">Review</button></div>) : <div className="flex gap-3 py-7"><AlertCircle size={18} className="text-emerald-600" /><div><p className="text-sm font-black text-slate-800">No urgent employee exceptions</p><p className="mt-1 text-xs text-slate-500">Attendance, payroll and employee records are currently clear.</p></div></div>}</div></div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Staff Snapshot</p><h2 className="mt-1 text-lg font-black text-slate-900">Current Employee Position</h2></div><button type="button" onClick={() => setActiveTab('Directory')} className="text-xs font-black text-blue-600">Full Directory</button></div><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Employee</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Pay</th><th className="px-4 py-3 text-right">Current Hours</th><th className="px-5 py-3 text-center">Payroll</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{overview.active.slice(0, 8).map((employee) => <tr key={employee.id}><td className="px-5 py-3"><p className="font-black text-slate-800">{employee.name}</p><p className="text-[10px] text-slate-400">{employee.employeeNo}</p></td><td className="px-4 py-3 text-slate-600">{employee.role}</td><td className="px-4 py-3 text-slate-600">{employee.employmentType}</td><td className="px-4 py-3 font-black">{employeePayLabel(employee)}</td><td className="px-4 py-3 text-right font-mono font-black">{currentHours(employee).toFixed(1)}h</td><td className="px-5 py-3 text-center"><StatusBadge status={currentPayrollStatus(employee)} /></td></tr>)}</tbody></table></div></div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Workforce Insights</p><div className="mt-4 grid grid-cols-2 gap-3">{[['Payroll Paid MTD', `$${formatMoney(overview.paidThisMonth)}`], ['Part-Time Hours', `${overview.partTimeHours.toFixed(1)} hrs`], ['Overtime This Week', `${overview.weeklyOt.toFixed(1)} hrs`], ['Incomplete Profiles', overview.profileIssues.length]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="mt-2 text-lg font-black text-slate-900">{value}</p></div>)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Quick Actions</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{[['Add Employee', Users, () => setEmployeeEditor({})], ['Attendance', Clock, () => setAttendanceEditor({})], ['Salary Advance', Gift, () => setRecordModal('advance')], ['Leave Record', CalendarDays, () => setRecordModal('leave')], ['Generate Payroll', DollarSign, () => setPayrollEditor(true)], ['New Contract', FileText, () => setActiveTab('Contracts')]].map(([label, Icon, action]) => <button key={label} type="button" onClick={action} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-blue-50"><Icon size={17} className="text-blue-600" /><p className="mt-3 text-xs font-black text-slate-700">{label}</p></button>)}</div></div></div>
    </div>;
  };

  const Directory = () => <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex w-full max-w-xl items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5"><Search size={17} className="mr-2 text-slate-400" /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search employee, role, ID..." className="w-full bg-transparent text-sm outline-none" /></div><button type="button" onClick={() => setEmployeeEditor({})} className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white"><Plus size={16} className="mr-2" />Add Employee</button></div><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left"><thead className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400"><tr><th className="p-4 pl-6">Employee</th><th className="p-4">Role</th><th className="p-4">Employment</th><th className="p-4">Pay Setup</th><th className="p-4">CPF / Levy</th><th className="p-4">Data Health</th><th className="p-4 text-center">Status</th><th className="p-4 pr-6 text-right">Edit</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{filteredEmployees.map((employee) => { const issues = employeeIssues(employee); return <tr key={employee.id} className="hover:bg-blue-50/40"><td className="p-4 pl-6"><p className="font-black text-slate-800">{employee.name}</p><p className="text-[10px] text-slate-400">{employee.employeeNo}</p></td><td className="p-4 text-slate-700">{employee.role}</td><td className="p-4"><p className="font-bold">{employee.employmentType}</p><p className="text-xs text-slate-400">{employee.citizenshipType}</p></td><td className="p-4"><p className="font-black">{employeePayLabel(employee)}</p><p className="text-xs capitalize text-slate-400">{employee.paymentInterval}</p></td><td className="p-4">{employee.cpfEligible ? <span className="text-xs font-black text-emerald-600">CPF Eligible</span> : <><span className="text-xs font-black text-amber-600">MOM Levy</span><p>${formatMoney(employee.levy)}</p></>}</td><td className="p-4">{issues.length ? <><span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">{issues.length} missing</span><p className="mt-1 max-w-[220px] text-[10px] text-slate-400">{issues.slice(0, 3).join(', ')}{issues.length > 3 ? ` +${issues.length - 3}` : ''}</p></> : <span className="text-xs font-black text-emerald-600">Complete</span>}</td><td className="p-4 text-center"><StatusBadge status={employee.status} /></td><td className="p-4 pr-6 text-right"><button type="button" onClick={() => setEmployeeEditor(employee)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-100 hover:text-blue-600"><Edit3 size={17} /></button></td></tr>; })}{!filteredEmployees.length && <tr><td colSpan="8" className="p-12 text-center text-sm text-slate-400">No employees match your search.</td></tr>}</tbody></table></div></div>;

  const Attendance = () => {
    const weekRows = attendance.filter((row) => inRange(row.work_date, week.start, week.end));
    const regular = weekRows.reduce((sum, row) => sum + Number(row.regular_hours || 0), 0);
    const ot = weekRows.reduce((sum, row) => sum + Number(row.overtime_hours || 0), 0);
    return <div className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><SummaryCard label="Regular Hours" value={`${regular.toFixed(1)} hrs`} detail={`${week.start} to ${week.end}`} icon={Clock} /><SummaryCard label="Overtime" value={`${ot.toFixed(1)} hrs`} detail="Recorded OT this week" icon={Clock} tone="violet" /><SummaryCard label="Entries" value={weekRows.length} detail="Attendance records this week" icon={CalendarDays} tone="emerald" /></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><p className="text-[10px] font-black uppercase text-slate-400">Attendance & OT</p><h2 className="mt-1 text-lg font-black">Daily Clock Records</h2></div><button type="button" onClick={() => setAttendanceEditor({})} className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white"><Plus size={16} className="mr-2" />Attendance Entry</button></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-5 py-3">Date</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Clock In</th><th className="px-4 py-3">Clock Out</th><th className="px-4 py-3 text-right">Regular</th><th className="px-4 py-3 text-right">OT</th><th className="px-4 py-3 text-right">Total</th><th className="px-5 py-3 text-center">Edit</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{attendance.slice(0, 100).map((row) => { const employee = employeeById.get(String(row.employee_id)); return <tr key={row.id}><td className="px-5 py-3 font-mono">{row.work_date}</td><td className="px-4 py-3"><p className="font-black">{employee?.name || 'Unknown'}</p><p className="text-[10px] text-slate-400">{employee?.role || ''}</p></td><td className="px-4 py-3">{row.clock_in ? String(row.clock_in).slice(0, 5) : '—'}</td><td className="px-4 py-3">{row.clock_in && !row.clock_out ? <span className="font-black text-red-600">Missing</span> : row.clock_out ? String(row.clock_out).slice(0, 5) : '—'}</td><td className="px-4 py-3 text-right font-mono">{Number(row.regular_hours || 0).toFixed(2)}</td><td className="px-4 py-3 text-right font-mono text-violet-700">{Number(row.overtime_hours || 0).toFixed(2)}</td><td className="px-4 py-3 text-right font-mono font-black">{attendanceHours(row).toFixed(2)}</td><td className="px-5 py-3 text-center"><button type="button" onClick={() => setAttendanceEditor(row)} className="p-2 text-slate-400 hover:text-blue-600"><Edit3 size={15} /></button></td></tr>; })}{!attendance.length && <tr><td colSpan="8" className="p-12 text-center text-sm text-slate-400">No attendance records yet.</td></tr>}</tbody></table></div></div></div>;
  };

  const Leave = () => <div className="space-y-5"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><p className="text-[10px] font-black uppercase text-slate-400">Leave Entitlement</p><h2 className="mt-1 text-lg font-black">Employee Leave Position</h2></div><button type="button" onClick={() => setRecordModal('leave')} className="inline-flex items-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white"><Plus size={16} className="mr-2" />Leave Record</button></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-5 py-3">Employee</th><th className="px-4 py-3 text-right">Annual Entitlement</th><th className="px-4 py-3 text-right">Annual Taken</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-right">Sick Taken</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{employees.filter((employee) => employee.status === 'Active').map((employee) => { const rows = leaveRecords.filter((row) => String(row.employee_id) === String(employee.id) && String(row.start_date || '').startsWith(String(new Date().getFullYear())) && String(row.status).toLowerCase() === 'approved'); const annual = rows.filter((row) => row.leave_type === 'Annual').reduce((sum, row) => sum + Number(row.days || 0), 0); const sick = rows.filter((row) => row.leave_type === 'Sick').reduce((sum, row) => sum + Number(row.days || 0), 0); return <tr key={employee.id}><td className="px-5 py-3"><p className="font-black">{employee.name}</p><p className="text-[10px] text-slate-400">{employee.role}</p></td><td className="px-4 py-3 text-right font-black">{employee.leaveEntitlement}</td><td className="px-4 py-3 text-right">{annual}</td><td className="px-4 py-3 text-right font-black text-emerald-700">{Math.max(0, employee.leaveEntitlement - annual)}</td><td className="px-4 py-3 text-right">{sick}</td></tr>; })}</tbody></table></div></div><div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-4 text-[10px] font-black uppercase text-slate-400">Recent Leave Records</div><div className="divide-y divide-slate-100">{leaveRecords.slice(0, 12).map((row) => <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-black">{employeeById.get(String(row.employee_id))?.name || 'Unknown'}</p><p className="mt-1 text-xs text-slate-500">{row.leave_type} · {row.start_date} to {row.end_date} · {row.days} day(s)</p></div><StatusBadge status={row.status} /></div>)}{!leaveRecords.length && <div className="p-10 text-center text-sm text-slate-400">No leave records yet.</div>}</div></div></div>;

  const Payroll = () => <div className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><SummaryCard label="Unpaid Payroll" value={`$${formatMoney(overview.payrollDue)}`} detail={`${overview.unpaid.length} payroll period(s)`} icon={DollarSign} tone="emerald" /><SummaryCard label="Advances Outstanding" value={`$${formatMoney(overview.advanceAmount)}`} detail="Pending + allocated" icon={Gift} tone="amber" /><SummaryCard label="Paid This Month" value={`$${formatMoney(overview.paidThisMonth)}`} detail="Net payroll payments" icon={DollarSign} /></div><div className="grid grid-cols-1 gap-5 xl:grid-cols-12"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-8"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><p className="text-[10px] font-black uppercase text-slate-400">Payroll History</p><h2 className="mt-1 text-lg font-black">Payroll Periods</h2></div><button type="button" onClick={() => setPayrollEditor(true)} className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white"><Plus size={16} className="mr-2" />Generate Payroll</button></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-5 py-3">Employee</th><th className="px-4 py-3">Period</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Advances</th><th className="px-4 py-3 text-right">Net</th><th className="px-4 py-3 text-center">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{payroll.map((row) => { const employee = employeeById.get(String(row.employee_id)); return <tr key={row.id}><td className="px-5 py-3"><p className="font-black">{employee?.name || 'Unknown'}</p><p className="text-[10px] text-slate-400">{employee?.employeeNo || ''}</p></td><td className="px-4 py-3 font-mono text-xs">{row.period_start} → {row.period_end}</td><td className="px-4 py-3 text-right font-mono">${formatMoney(row.gross_pay || 0)}</td><td className="px-4 py-3 text-right font-mono text-amber-700">-${formatMoney(row.advance_deductions || 0)}</td><td className="px-4 py-3 text-right font-mono font-black">${formatMoney(row.net_pay || 0)}</td><td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td><td className="px-5 py-3 text-right"><div className="inline-flex gap-2"><button type="button" onClick={() => setPayslip(row)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-black">Payslip</button>{row.status !== 'paid' && <button type="button" onClick={() => markPayrollPaid(row)} className="rounded-lg bg-emerald-600 px-2.5 py-2 text-[10px] font-black text-white">Mark Paid</button>}</div></td></tr>; })}{!payroll.length && <tr><td colSpan="7" className="p-12 text-center text-sm text-slate-400">No payroll periods generated yet.</td></tr>}</tbody></table></div></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-4"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><p className="text-[10px] font-black uppercase text-slate-400">Salary Advances</p><h2 className="mt-1 text-lg font-black">Advance Ledger</h2></div><button type="button" onClick={() => setRecordModal('advance')} className="rounded-lg bg-amber-600 p-2 text-white"><Plus size={16} /></button></div><div className="max-h-[600px] divide-y divide-slate-100 overflow-y-auto">{advances.map((row) => <div key={row.id} className="px-4 py-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-black">{employeeById.get(String(row.employee_id))?.name || 'Unknown'}</p><p className="mt-1 text-xs text-slate-500">{row.advance_date} · {row.reason || 'Salary advance'}</p></div><p className="font-mono font-black text-amber-700">${formatMoney(row.amount || 0)}</p></div><div className="mt-2"><StatusBadge status={row.status} /></div></div>)}{!advances.length && <div className="p-10 text-center text-sm text-slate-400">No salary advances recorded.</div>}</div></div></div></div>;

  if (loading) return <div className="flex h-full items-center justify-center bg-slate-50 p-8"><p className="text-sm font-bold text-slate-500">Loading employee records…</p></div>;
  if (loadError) return <div className="h-full overflow-y-auto bg-slate-50 p-8"><div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-6 shadow-sm"><AlertCircle size={30} className="text-red-600" /><h2 className="mt-4 text-xl font-black">Employee database setup required</h2><p className="mt-2 text-sm leading-6 text-slate-500">Run the provided Supabase setup SQL once, then retry.</p><pre className="mt-4 overflow-x-auto rounded-xl bg-red-50 p-4 text-xs text-red-700">{loadError}</pre><button type="button" onClick={() => void reload()} className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">Retry</button></div></div>;

  const payslipEmployee = payslip ? employeeById.get(String(payslip.employee_id)) : null;

  return <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8"><div className="mx-auto w-full max-w-[1700px]">
    {notification && <div className="fixed right-5 top-5 z-[9000] w-[min(420px,calc(100vw-40px))]"><div className={`rounded-2xl border px-4 py-3 shadow-2xl ${notification.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><div className="flex items-start gap-3"><AlertCircle size={17} className="mt-0.5 shrink-0" /><div className="flex-1"><p className="text-sm font-black">{notification.title}</p>{notification.message && <p className="mt-1 text-xs">{notification.message}</p>}</div><button type="button" onClick={() => setNotification(null)}><X size={14} /></button></div></div></div>}

    <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div className="flex items-center"><div className="mr-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50"><Users className="text-blue-600" size={24} /></div><div><h1 className="text-2xl font-semibold text-slate-900">Employee Management</h1><p className="mt-1 text-sm text-slate-500">Workforce information, attendance, leave, salary advances, payroll and employment contracts.</p></div></div><div className="flex gap-2"><button type="button" onClick={() => void reload()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600">Refresh</button><button type="button" onClick={() => setEmployeeEditor({})} className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white"><Plus size={17} className="mr-2" />Add Employee</button></div></div>

    <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">{EMPLOYEE_TABS.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex items-center whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold ${activeTab === tab.id ? 'border border-slate-200 bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}><tab.icon size={15} className="mr-2" />{tab.id}</button>)}</div>

    {activeTab === 'Overview' && <Overview />}
    {activeTab === 'Directory' && <Directory />}
    {activeTab === 'Contracts' && <EmployeeContractForm employees={employees} />}
    {activeTab === 'Attendance & OT' && <Attendance />}
    {activeTab === 'Leave Entitlement' && <Leave />}
    {activeTab === 'Payroll & Payslips' && <Payroll />}
  </div>

  {employeeEditor !== null && <EmployeeEditor employee={employeeEditor?.id ? employeeEditor : null} employees={employees} onClose={() => setEmployeeEditor(null)} onSave={saveEmployee} />}
  {attendanceEditor !== null && <AttendanceEditor employees={employees} record={attendanceEditor?.id ? attendanceEditor : null} onClose={() => setAttendanceEditor(null)} onSave={saveAttendance} />}
  {recordModal === 'advance' && <SimpleRecordModal kind="advance" employees={employees} onClose={() => setRecordModal(null)} onSave={saveAdvance} />}
  {recordModal === 'leave' && <SimpleRecordModal kind="leave" employees={employees} onClose={() => setRecordModal(null)} onSave={saveLeave} />}
  {payrollEditor && <PayrollEditor employees={employees} attendance={attendance} advances={advances} onClose={() => setPayrollEditor(false)} onGenerate={generatePayroll} />}
  {payslip && payslipEmployee && <PayslipPreview payroll={payslip} employee={payslipEmployee} onClose={() => setPayslip(null)} onMarkPaid={() => markPayrollPaid(payslip)} />}
  </div>;
}
