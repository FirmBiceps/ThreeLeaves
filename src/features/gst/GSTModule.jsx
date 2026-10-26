import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Info,
  PackagePlus,
  Plus,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { supabase } from '../../lib/supabaseClient';

const GST_RATE = 0.09;
const SALES_EXCLUSION_STORAGE_KEY = 'three-leaves-gst-sales-exclusions-v1';

const QUARTERS = [
  { value: 'Q1', label: 'Q1', months: [0, 1, 2] },
  { value: 'Q2', label: 'Q2', months: [3, 4, 5] },
  { value: 'Q3', label: 'Q3', months: [6, 7, 8] },
  { value: 'Q4', label: 'Q4', months: [9, 10, 11] },
];

const PURCHASE_CATEGORIES = [
  'Inventory Purchase',
  'Overheads',
  'Capital Goods',
  'Freight / Delivery',
  'Professional Fees',
  'Utilities',
  'Other Purchase',
];

const EXCLUSION_REASONS = [
  'Cancelled invoice',
  'Duplicate invoice',
  'Not subject to GST',
  'Recorded in another GST period',
  'Credit adjustment required',
  'Other',
];

function getCurrentQuarter() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    quarter: `Q${Math.floor(now.getMonth() / 3) + 1}`,
  };
}

function getQuarterDateRange(year, quarter) {
  const quarterConfig = QUARTERS.find((entry) => entry.value === quarter) || QUARTERS[0];
  const startMonth = quarterConfig.months[0];
  const endMonth = quarterConfig.months[2];

  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

function isDateInRange(dateValue, range) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return date >= range.start && date <= range.end;
}

function toMoneyNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getInvoiceSubtotal(invoice) {
  const explicitSubtotal =
    invoice?.subtotal ??
    invoice?.subTotal ??
    invoice?.amount_before_gst ??
    invoice?.amountBeforeGst;

  if (explicitSubtotal !== undefined && explicitSubtotal !== null && explicitSubtotal !== '') {
    return toMoneyNumber(explicitSubtotal);
