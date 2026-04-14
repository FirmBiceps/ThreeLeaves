import { useMemo, useState, useEffect } from 'react';
import { FileText, Printer, Search, Calendar } from 'lucide-react';
import { formatMoney } from '../../utils/format';

// Re-use the logo from your invoices folder (adjust path if needed)
import logo from '../invoices/three_leaves_logo.png'; 

export function StatementModule({ sys }) {
  // Default to current month (e.g., "2026-04")
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Controls what gets sent to the printer: 'ALL' or a specific 'customerId'
  const [printTarget, setPrintTarget] = useState(null);

  // 1. Group all invoices by Customer for the selected month
  const statementData = useMemo(() => {
    const data = {};

    // Filter invoices by the selected month (YYYY-MM)
    const monthInvoices = sys.invoices.filter(inv => {
      if (!inv.date) return false;
      return inv.date.startsWith(selectedMonth);
    });

    monthInvoices.forEach(inv => {
      if (!data[inv.customerId]) {
        const customerObj = sys.customers.find(c => c.id === inv.customerId);
        data[inv.customerId] = {
          customer: customerObj,
          customerName: customerObj?.name || inv.customer || 'Unknown Customer',
          invoices: [],
          totalBilled: 0,
          totalPaid: 0,
          totalOutstanding: 0,
        };
      }

      data[inv.customerId].invoices.push(inv);
      data[inv.customerId].totalBilled += (inv.total || 0);

      if (inv.status === 'Paid') {
        data[inv.customerId].totalPaid += (inv.total || 0);
      } else {
        data[inv.customerId].totalOutstanding += (inv.total || 0);
      }
    });

    // Convert object to array and sort alphabetically
    let results = Object.values(data).sort((a, b) => a.customerName.localeCompare(b.customerName));

    // Apply Search Filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      results = results.filter(row => row.customerName.toLowerCase().includes(lowerSearch));
    }

    // Sort the invoices inside each customer by date
    results.forEach(row => {
      row.invoices.sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    return results;
  }, [sys.invoices, sys.customers, selectedMonth, searchTerm]);

  // Handle Print Action
  const handlePrint = (target) => {
    setPrintTarget(target);
    // Give React a tiny fraction of a second to render the hidden print views before triggering browser print
    setTimeout(() => {
      window.print();
      setPrintTarget(null); // Reset after printing
    }, 100);
  };

  // Determine which statements to render in the hidden print area
  const statementsToPrint = useMemo(() => {
    if (printTarget === 'ALL') return statementData;
    if (printTarget) return statementData.filter(data => data.customer?.id === printTarget);
    return [];
  }, [printTarget, statementData]);

  // Format the month nicely for display (e.g., "April 2026")
  const displayMonth = useMemo(() => {
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  return (
    <div className="p-8 h-full overflow-y-auto relative">
      
      {/* HARD-INJECTED PRINT STYLES */}
      <style type="text/css">
        {`
          @media print {
            *, html, body {
              font-family: Arial, "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SimHei", sans-serif !important;
            }
            .page-break {
              page-break-after: always !important;
              break-after: page !important;
            }
            /* Hide the main app UI when printing */
            #screen-ui { display: none !important; }
            /* Show only the print container */
            #print-ui { display: block !important; }
          }
        `}
      </style>

      {/* ========================================================================= */}
      {/* SCREEN UI */}
      {/* ========================================================================= */}
      <div id="screen-ui">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
              <FileText className="mr-3 text-blue-600" size={28} />
              Statements of Account (SOA)
            </h1>
            <p className="text-base text-slate-500 mt-1">
              Generate and batch-print monthly summaries for your customers.
            </p>
          </div>
          <button
            className="flex items-center rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
            onClick={() => handlePrint('ALL')}
            disabled={statementData.length === 0}
            type="button"
          >
            <Printer className="mr-2" size={18} /> Print ALL Statements
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* FILTERS */}
          <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-100 bg-slate-50 p-4 gap-4">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
              <Calendar className="text-slate-400 mr-2" size={18} />
              <input
                type="month"
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm w-full sm:w-72">
              <Search className="text-slate-400 mr-2" size={18} />
              <input
                type="text"
                placeholder="Search customer..."
                className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* SUMMARY TABLE */}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                <th className="p-5 pl-8">Customer Entity</th>
                <th className="p-5 text-center">Invoices</th>
                <th className="p-5 text-right">Total Billed</th>
                <th className="p-5 text-right">Total Paid</th>
                <th className="p-5 text-right text-red-600">Outstanding</th>
                <th className="p-5 pr-8 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {statementData.map((row) => (
                <tr className="font-medium hover:bg-slate-50 transition-colors" key={row.customer?.id || row.customerName}>
                  <td className="p-5 pl-8 font-bold text-slate-800">
                    {row.customerName}
                  </td>
                  <td className="p-5 text-center text-slate-500">{row.invoices.length}</td>
                  <td className="p-5 text-right text-slate-600">${formatMoney(row.totalBilled)}</td>
                  <td className="p-5 text-right text-emerald-600">${formatMoney(row.totalPaid)}</td>
                  <td className="p-5 text-right font-black text-red-600">${formatMoney(row.totalOutstanding)}</td>
                  <td className="p-5 pr-8 text-right">
                    <button
                      onClick={() => handlePrint(row.customer?.id)}
                      className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Printer size={12} className="mr-1" /> Print
                    </button>
                  </td>
                </tr>
              ))}
              {statementData.length === 0 && (
                <tr>
                  <td className="p-12 text-center text-sm font-bold text-slate-400" colSpan="6">
                    No transactions found for {displayMonth}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT UI (HIDDEN ON SCREEN, VISIBLE ON PRINT) */}
      {/* ========================================================================= */}
      <div id="print-ui" className="hidden">
        {statementsToPrint.map((data, index) => (
          <div 
            key={data.customer?.id || index} 
            className="page-break w-[210mm] min-h-[297mm] bg-white p-8 text-black flex flex-col mx-auto"
          >
            {/* EXACT MATCH HEADER */}
            <div className="flex justify-between items-start mb-8">
              <div className="w-[25%]">
                <img src={logo} alt="Three Leaves Logo" className="w-[110px] h-auto object-contain" />
              </div>

              <div className="w-[50%] text-center leading-tight pt-2">
                <h1 className="font-bold text-[14px]">THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
                <h2 className="font-bold text-[13px] mb-1">三叶（新加坡） 贸易公司</h2>
                <p className="font-bold text-[10px] mb-0.5">CO.REG NO.53033969B &nbsp;&nbsp;&nbsp; GST REG NO. M90355440L</p>
                <p className="text-[10px] mb-0.5">280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
                <p className="text-[10px]">HP: 97578869 (Mr Ye) &nbsp; HP: 91113505 (Min) &nbsp; Email: 3leaves.sg@gmail.com</p>
              </div>

              <div className="w-[25%] flex flex-col items-end pt-1">
                <div className="text-center w-full mb-2">
                  <h2 className="text-[18px] font-bold tracking-widest leading-none mb-0.5">结账单</h2>
                  <h3 className="text-[14px] font-bold tracking-widest uppercase">STATEMENT</h3>
                </div>
              </div>
            </div>

            {/* CUSTOMER DETAILS */}
            <div className="mb-6 text-[15px] font-bold flex flex-col w-full">
              <div className="flex justify-between w-full mb-2">
                <div className="flex items-end w-[60%] pr-4">
                  <span className="w-12 shrink-0">TO:</span>
                  <span className="flex-1 uppercase border-b border-black pb-0.5">
                    {data.customerName}
                  </span>
                </div>
                <div className="flex items-end w-[40%] pl-4">
                  <span className="w-32 shrink-0">STMT MONTH:</span>
                  <span className="flex-1 text-center border-b border-black pb-0.5 uppercase">
                    {displayMonth}
                  </span>
                </div>
              </div>
              <div className="flex items-end w-full mt-1">
                <span className="w-24 shrink-0">ADDRESS:</span>
                <span className="flex-1 uppercase leading-tight border-b border-black pb-0.5">
                  {data.customer?.address || ''}
                </span>
              </div>
            </div>

            {/* STATEMENT TABLE */}
            <table className="w-full text-[15px] border-2 border-black text-center mb-0 leading-tight flex-grow">
              <thead className="border-b-2 border-black">
                <tr className="font-bold bg-white text-[14px]">
                  <th className="py-2 px-2 border-r border-black text-left w-28">DATE</th>
                  <th className="py-2 px-2 border-r border-black text-left">INVOICE NO.</th>
                  <th className="py-2 px-2 border-r border-black text-right w-32">BILLED</th>
                  <th className="py-2 px-2 border-r border-black text-right w-32">PAID</th>
                  <th className="py-2 px-2 text-right w-32">BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv, idx) => {
                  const billed = inv.total || 0;
                  const isPaid = inv.status === 'Paid';
                  const paidAmt = isPaid ? billed : 0;
                  const balanceAmt = isPaid ? 0 : billed;

                  return (
                    <tr key={inv.id} className="h-[32px] align-top">
                      <td className="p-1 border-r border-black text-left pl-2 font-medium">
                        {inv.date ? new Date(inv.date).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}
                      </td>
                      <td className="p-1 border-r border-black text-left pl-2 font-bold">#{inv.number}</td>
                      <td className="p-1 border-r border-black text-right pr-2">${formatMoney(billed)}</td>
                      <td className="p-1 border-r border-black text-right pr-2">${formatMoney(paidAmt)}</td>
                      <td className="p-1 text-right pr-2 font-bold text-black">
                        ${formatMoney(balanceAmt)}
                      </td>
                    </tr>
                  );
                })}
                
                {/* Pad empty rows so the totals sit cleanly at the bottom */}
                {data.invoices.length < 15 && Array.from({ length: 15 - data.invoices.length }).map((_, i) => (
                  <tr key={`blank-${i}`} className="h-[32px]">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* STATEMENT TOTALS */}
            <div className="flex w-full mt-2 justify-end">
              <div className="flex flex-col font-bold text-[15px] shrink-0 w-[20rem]">
                <div className="flex">
                  <div className="w-40 p-1 text-right">TOTAL BILLED</div>
                  <div className="w-40 p-1 text-right">${formatMoney(data.totalBilled)}</div>
                </div>
                <div className="flex">
                  <div className="w-40 p-1 text-right">TOTAL PAID</div>
                  <div className="w-40 p-1 text-right">${formatMoney(data.totalPaid)}</div>
                </div>
                <div className="flex mt-2 pt-2 border-t-2 border-black text-[17px]">
                  <div className="w-40 p-1 text-right">AMOUNT DUE</div>
                  <div className="w-40 p-1 text-right">${formatMoney(data.totalOutstanding)}</div>
                </div>
              </div>
            </div>

            {/* FOOTER MESSAGE */}
            <div className="mt-8 pt-4 border-t border-gray-300 text-center text-[12px] font-bold">
              <p>Please make cheques payable to <b>Three Leaves (Singapore) Trading Enterprise</b></p>
              <p className="mt-1">Bank: OCBC &nbsp;&nbsp;|&nbsp;&nbsp; A/C: 535-846562-001 &nbsp;&nbsp;|&nbsp;&nbsp; UEN: 53033969B</p>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
