import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Printer,
  Search,
  Calendar,
  Download,
  Loader2,
  Database,
  RefreshCw,
  Clock3,
  TrendingUp,
  Users,
  Receipt,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { formatMoney } from '../../utils/format';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Re-use the logo and QR code from your invoices folder
import logo from '../invoices/three_leaves_logo.png';
import paynowQr from '../invoices/paynow_qr.jpg';

const CJK_FONT =
  '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

const DASHBOARD_NUMBER_FORMAT = new Intl.NumberFormat('en-SG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DASHBOARD_INTEGER_FORMAT = new Intl.NumberFormat('en-SG', {
  maximumFractionDigits: 0,
});

const formatDashboardMoney = (value) =>
  `S$ ${DASHBOARD_NUMBER_FORMAT.format(Number(value) || 0)}`;

const formatDashboardInteger = (value) =>
  DASHBOARD_INTEGER_FORMAT.format(Number(value) || 0);

const getInvoiceDataSignature = (invoices) => {
  let hash = 2166136261;

  for (const inv of invoices) {
    const value = [
      inv?.id,
      inv?.number,
      inv?.date,
      inv?.customerId,
      inv?.total,
      inv?.status,
    ].join('|');

    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }

  return `${invoices.length}:${hash >>> 0}`;
};

export function BillingModule({ sys }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [termFilter, setTermFilter] = useState('All');

  const [printTarget, setPrintTarget] = useState(null);
  const [isZipping, setIsZipping] = useState(false);
  const [dataSettled, setDataSettled] = useState(false);
  const [dataSettledAt, setDataSettledAt] = useState(null);

  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];

  // Statement totals are derived from sys.invoices. The BillingModule itself
  // does not fetch invoices, so displaying a KPI while the ERP data layer is
  // still hydrating can produce a misleading early total.
  //
  // We wait until the global ERP hydration has finished and the invoice
  // collection has remained unchanged for a short settling window.
  // When invoices legitimately change later, the dashboard briefly shows
  // Updating and then settles on the new total.
