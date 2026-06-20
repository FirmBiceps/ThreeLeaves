import { useState, useRef } from 'react';
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
        setEmployeeName(emp.name); setRole(emp.role); setBaseSalary(emp.basicSalary); setAnnualLeave(emp.leaveEntitlement);
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
export function EmployeeModule() {
  const [activeTab, setActiveTab] = useState('Contracts'); 
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmployees = MOCK_EMPLOYEES.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50">
      <div id="screen-ui">
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
            <div className="p-5 border-b border-slate-100 flex items-center bg-slate-50">
              <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm w-full max-w-md">
                <Search className="text-slate-400 mr-2" size={18} />
                <input type="text" placeholder="Search staff by name or role..." className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
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
                      <td className="p-5 pl-8"><div className="font-bold text-slate-800">{emp.name}</div><div className="text-xs text-slate-500 mt-0.5">{emp.role} • {emp.id}</div></td>
                      <td className="p-5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${emp.type === 'Citizen' || emp.type === 'PR' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{emp.type}</span>
                        {emp.workPassExpiry && <div className="flex items-center text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider"><AlertCircle size={10} className="mr-1" /> Expiry: {emp.workPassExpiry}</div>}
                      </td>
                      <td className="p-5 font-medium text-slate-800">${formatWithCommas(emp.basicSalary)} <span className="text-xs text-slate-400">/mth</span></td>
                      <td className="p-5">
                        {emp.cpfEligible ? <span className="text-emerald-600 font-bold text-xs uppercase tracking-wider">CPF Eligible</span> : <div><span className="text-amber-600 font-bold text-xs uppercase tracking-wider">MOM Levy</span><div className="font-medium text-slate-800">${formatWithCommas(emp.levy)}</div></div>}
                      </td>
                      <td className="p-5 pr-8 text-right"><button className="text-slate-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition-colors"><MoreVertical size={18} /></button></td>
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
    </div>
  );
}
