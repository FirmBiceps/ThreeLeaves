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
