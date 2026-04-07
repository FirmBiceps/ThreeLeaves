import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart2,
  Calendar,
  Printer,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { CompanyHeader } from '../../components/shared/CompanyHeader';
import { formatMonthLabel, shiftMonthString } from '../../utils/date';
import { formatMoney } from '../../utils/format';

function StatementPreview({ previewStatement, selectedMonth, statementType, onBack }) {
  return (
    <div className="fixed inset-0 z-[3000] overflow-y-auto bg-slate-950/90 print:bg-white print:p-0">
      <div className="flex min-h-full justify-center py-24 print:py-0">
        <div className="relative flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-white p-12 shadow-2xl print:w-full print:p-0 print:shadow-none">
          <div className="absolute -top-16 left-0 right-0 flex items-center justify-between px-4 print:hidden">
            <button
              className="flex items-center rounded-xl bg-slate-800 px-6 py-2.5 font-bold text-white transition-all hover:bg-slate-700"
              onClick={onBack}
              type="button"
            >
              <ArrowRight className="mr-2 rotate-180" size={18} /> Back to Billing
            </button>
            <button
              className="flex items-center rounded-xl bg-blue-600 px-8 py-2.5 font-black text-white shadow-xl transition-all hover:bg-blue-700"
              onClick={() => setTimeout(() => window.print(), 100)}
              type="button"
            >
              <Printer className="mr-2" size={18} /> Print Statement
            </button>
          </div>

          <CompanyHeader />

          <div className="mb-8 text-center">
            <h3 className="text-3xl font-black uppercase tracking-widest text-slate-900">
              {statementType === 'cod' ? 'Cash On Delivery Summary' : 'Statement of Account'}
            </h3>
            <p className="mt-2 text-sm font-bold uppercase tracking-widest text-slate-500">
              Billing Period: {formatMonthLabel(selectedMonth)}
            </p>
            <div className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
              Terms: {statementType === 'cod' ? 'COD' : '30 Days'}
            </div>
          </div>

          <div className="mb-10 flex justify-between">
            <div className="w-1/2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Bill To:
              </span>
              <p className="mt-1 text-xl font-black text-slate-900">
                {previewStatement.customer?.name || 'N/A'}
              </p>
              <p className="mt-2 text-xs font-bold uppercase leading-relaxed text-slate-500">
                {previewStatement.customer?.address || ''}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Statement Date
              </span>
              <p className="mt-1 text-lg font-black tracking-tighter">{new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="flex-1">
            <table className="mb-10 w-full text-left">
              <thead className="border-y-2 border-slate-900">
                <tr className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <th className="w-28 p-4">Date</th>
                  <th className="p-4">Invoice Reference</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="w-36 p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {previewStatement.invoices.map((invoice, index) => (
                  <tr className="border-b border-gray-50 font-bold text-slate-800 last:border-0" key={invoice.id || index}>
                    <td className="p-4 text-xs">{invoice.date || '-'}</td>
                    <td className="p-4 font-mono text-blue-600">Invoice #{invoice.number || '-'}</td>
                    <td className="p-4 text-center text-xs uppercase text-slate-400">Issued</td>
                    <td className="p-4 text-right font-mono text-lg font-black tracking-tighter">
                      ${formatMoney(invoice.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end border-t-2 border-slate-900 pt-8">
            <div className="w-80 space-y-3">
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-black uppercase tracking-[0.2em]">Total Balance Due</span>
                <span className="border-b-4 border-double border-slate-900 px-1 font-mono text-4xl font-black tracking-tighter text-slate-900">
                  ${formatMoney(previewStatement.total)}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-4 mt-16 text-center text-[10px] font-bold text-slate-500">
            Please issue crossed cheque payable to:
            <br />
            <span className="uppercase text-slate-900">
              THREE LEAVES (SINGAPORE) TRADING ENTERPRISE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BillingModule({ sys }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statementType, setStatementType] = useState('30_days');
  const [previewStatement, setPreviewStatement] = useState(null);

  const monthlyStatements = useMemo(() => {
    const statements = {};

    sys.invoices.forEach((invoice) => {
      const invoiceTerm = invoice.paymentTerms || '30_days';
      if (!invoice.date?.startsWith(selectedMonth) || invoiceTerm !== statementType) {
        return;
      }

      if (!statements[invoice.customerId]) {
        statements[invoice.customerId] = {
          customer:
            sys.customers.find((customer) => customer.id === invoice.customerId) || {
              name: 'Unknown',
              address: '',
              region: '',
            },
          invoices: [],
          total: 0,
        };
      }

      statements[invoice.customerId].invoices.push(invoice);
      statements[invoice.customerId].total += invoice.total || 0;
    });

    return Object.values(statements).sort((left, right) =>
      (left.customer?.name || '').localeCompare(right.customer?.name || ''),
    );
  }, [selectedMonth, statementType, sys.customers, sys.invoices]);

  const totalMonthlyRevenue = useMemo(
    () => monthlyStatements.reduce((sum, statement) => sum + (statement.total || 0), 0),
    [monthlyStatements],
  );

  const financialAnalytics = useMemo(() => {
    const chartMonths = [];
    let maxRevenue = 0;

    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthKey = shiftMonthString(selectedMonth, offset);
      const monthInvoices = sys.invoices.filter(
        (invoice) =>
          invoice.date.startsWith(monthKey) && (invoice.paymentTerms || '30_days') === statementType,
      );
      const revenue = monthInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
      maxRevenue = Math.max(maxRevenue, revenue);
      chartMonths.push({ key: monthKey, label: formatMonthLabel(monthKey), revenue });
    }

    const previousMonth = shiftMonthString(selectedMonth, 1);
    const currentInvoices = sys.invoices.filter(
      (invoice) =>
        invoice.date.startsWith(selectedMonth) && (invoice.paymentTerms || '30_days') === statementType,
    );
    const previousInvoices = sys.invoices.filter(
      (invoice) =>
        invoice.date.startsWith(previousMonth) && (invoice.paymentTerms || '30_days') === statementType,
    );

    const currentRevenue = currentInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
    const previousRevenue = previousInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
    const diff = currentRevenue - previousRevenue;
    const pctChange =
      previousRevenue === 0 ? (currentRevenue > 0 ? 100 : 0) : (diff / previousRevenue) * 100;

    const currentCustomerRevenue = {};
    const previousCustomerRevenue = {};
    currentInvoices.forEach((invoice) => {
      currentCustomerRevenue[invoice.customerId] =
        (currentCustomerRevenue[invoice.customerId] || 0) + (invoice.total || 0);
    });
    previousInvoices.forEach((invoice) => {
      previousCustomerRevenue[invoice.customerId] =
        (previousCustomerRevenue[invoice.customerId] || 0) + (invoice.total || 0);
    });

    let driverId = null;
    let maxChange = -1;
    sys.customers.forEach((customer) => {
      const customerDiff =
        (currentCustomerRevenue[customer.id] || 0) - (previousCustomerRevenue[customer.id] || 0);
      if (diff >= 0 && customerDiff > maxChange) {
        maxChange = customerDiff;
        driverId = customer.id;
      } else if (diff < 0 && customerDiff < -maxChange) {
        maxChange = Math.abs(customerDiff);
        driverId = customer.id;
      }
    });

    const driverName = sys.customers.find((customer) => customer.id === driverId)?.name || 'multiple accounts';
    let insightTitle = diff >= 0 ? 'Revenue Expansion' : 'Revenue Contraction';
    let insightText = `For ${statementType === 'cod' ? 'COD' : '30 Days Term'}, sales have ${
      diff >= 0 ? 'increased' : 'decreased'
    } by ${Math.abs(pctChange).toFixed(1)}% ($${Math.abs(diff).toFixed(0)}) compared to last month. `;

    if (currentRevenue === 0 && previousRevenue === 0) {
      insightTitle = 'No Activity';
      insightText = 'There has been no recorded sales activity for the selected payment terms in the current and previous month.';
    } else if (maxChange > 0) {
      insightText += `This shift is heavily influenced by ${
        diff >= 0 ? 'increased' : 'decreased'
      } order volume from ${driverName}.`;
    } else {
      insightText += 'This change is due to general market fluctuations across your customer base.';
    }

    return {
      chart: chartMonths.map((month) => ({
        ...month,
        heightPct: maxRevenue === 0 ? 0 : (month.revenue / maxRevenue) * 100,
      })),
      insightTitle,
      insightText,
      diff,
      pctChange,
    };
  }, [selectedMonth, statementType, sys.customers, sys.invoices]);

  if (previewStatement) {
    return (
      <StatementPreview
        onBack={() => setPreviewStatement(null)}
        previewStatement={previewStatement}
        selectedMonth={selectedMonth}
        statementType={statementType}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between rounded-xl bg-gray-50 p-6">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">
              Financial Statements
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Performance analytics and billing reports
            </p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="mr-2 flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
              <button
                className={`rounded-md px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                  statementType === '30_days'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
                onClick={() => setStatementType('30_days')}
                type="button"
              >
                30 Days Terms
              </button>
              <button
                className={`rounded-md px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                  statementType === 'cod'
                    ? 'bg-amber-500 text-white shadow'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
                onClick={() => setStatementType('cod')}
                type="button"
              >
                COD
              </button>
            </div>
            <div className="h-10 border-l border-gray-200" />
            <div className="flex items-center space-x-3 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
              <Calendar className="ml-2 text-gray-400" size={18} />
              <input
                className="cursor-pointer border-none text-sm font-bold text-slate-700 outline-none focus:ring-0"
                onChange={(event) => setSelectedMonth(event.target.value)}
                type="month"
                value={selectedMonth}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-8 shadow-sm lg:col-span-2">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="flex items-center text-xs font-black uppercase tracking-widest text-slate-700">
              <BarChart2 className="mr-2 text-blue-500" size={16} /> 6-Month Revenue Trend
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {statementType === 'cod' ? 'Cash on Delivery' : '30 Days Term'}
            </span>
          </div>
          <div className="mt-2 flex h-48 flex-1 items-end justify-between space-x-4 border-b-2 border-gray-100 pb-2">
            {financialAnalytics.chart.map((month) => (
              <div
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
                key={month.key}
              >
                <div className="absolute -top-6 rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  ${month.revenue.toFixed(0)}
                </div>
                <div
                  className={`w-full max-w-[48px] rounded-t-md transition-all duration-500 ${
                    month.key === selectedMonth
                      ? 'bg-blue-500 shadow-lg shadow-blue-500/30'
                      : 'bg-blue-100 group-hover:bg-blue-200'
                  }`}
                  style={{ height: `${Math.max(month.heightPct, 2)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between space-x-4 px-2">
            {financialAnalytics.chart.map((month) => (
              <div
                className={`flex-1 text-center text-[10px] font-black uppercase tracking-widest ${
                  month.key === selectedMonth ? 'text-blue-600' : 'text-slate-400'
                }`}
                key={`${month.key}-label`}
              >
                {month.label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-8 text-white shadow-xl">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative z-10">
            <div className="mb-6 flex items-center">
              <div
                className={`mr-4 flex h-10 w-10 items-center justify-center rounded-full ${
                  financialAnalytics.diff >= 0
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {financialAnalytics.diff >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              </div>
              <h3 className="text-xs font-black uppercase leading-tight tracking-widest text-slate-200">
                Monthly
                <br />
                Analysis
              </h3>
            </div>

            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              {financialAnalytics.insightTitle}
            </p>
            <div className="mb-4 flex items-end font-mono text-4xl font-black tracking-tighter">
              {financialAnalytics.diff > 0 ? '+' : ''}
              {financialAnalytics.pctChange.toFixed(1)}%
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <p className="text-xs font-medium leading-relaxed text-slate-300">
                {financialAnalytics.insightText}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between rounded-t-xl border-b border-gray-100 bg-gray-50 p-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
            Detailed Statements ({formatMonthLabel(selectedMonth)})
          </h3>
          <div className="text-right">
            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              Total {statementType === 'cod' ? 'COD' : 'Terms'} Revenue
            </div>
            <div className="font-mono text-xl font-black tracking-tighter text-emerald-600">
              ${formatMoney(totalMonthlyRevenue)}
            </div>
          </div>
        </div>
        <table className="w-full text-left">
          <thead className="border-b text-[10px] font-black uppercase tracking-widest text-gray-400">
            <tr>
              <th className="p-5">Customer Account</th>
              <th className="p-5 text-center">Invoices Found</th>
              <th className="p-5 text-right">Total Accrued</th>
              <th className="p-5 text-right">Generate Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm font-medium">
            {monthlyStatements.map((statement, index) => (
              <tr className="transition-colors hover:bg-blue-50/50" key={index}>
                <td className="p-5 font-bold text-slate-900">
                  {statement.customer?.name || 'Unknown Customer'}
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {statement.customer?.region || '-'} Sector
                  </div>
                </td>
                <td className="p-5 text-center">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    {statement.invoices.length} Records
                  </span>
                </td>
                <td className="p-5 text-right font-mono text-lg font-black tracking-tighter text-slate-900">
                  ${formatMoney(statement.total)}
                </td>
                <td className="p-5 text-right">
                  <button
                    className="ml-auto flex w-full max-w-[140px] items-center justify-end rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 transition-all hover:bg-indigo-600 hover:text-white"
                    onClick={() => setPreviewStatement(statement)}
                    type="button"
                  >
                    <Receipt className="mr-2" size={14} /> View SOA
                  </button>
                </td>
              </tr>
            ))}
            {monthlyStatements.length === 0 && (
              <tr>
                <td className="p-16 text-center text-xs font-bold uppercase tracking-widest text-slate-400" colSpan="4">
                  No <span className={statementType === 'cod' ? 'text-amber-500' : 'text-blue-500'}>
                    {statementType === 'cod' ? 'COD' : '30 Days Term'}
                  </span>{' '}
                  sales data found for {formatMonthLabel(selectedMonth)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
