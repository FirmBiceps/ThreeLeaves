import { useMemo, useState } from 'react';
import { FileText, Printer, Search, Calendar, Download, Loader2, DollarSign, TrendingUp, Users, Crown, Receipt } from 'lucide-react';
import { formatMoney, formatMoneyWhole } from '../../utils/format';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Re-use the logo and QR code from your invoices folder (adjust path if needed)
import logo from '../invoices/three_leaves_logo.png'; 
import paynowQr from '../invoices/paynow_qr.jpg';

const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

export function BillingModule({ sys }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Controls what gets sent to the printer/zipper: 'ALL', 'ZIP_ALL', or a specific 'customerId'
  const [printTarget, setPrintTarget] = useState(null);
  const [isZipping, setIsZipping] = useState(false);

  // BULLETPROOF: Safely extract arrays
  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];

  // ==========================================
  // FINANCIAL ANALYTICS & DATA ENGINE
  // ==========================================
  const analytics = useMemo(() => {
    // 1. Filter invoices strictly by the selected YYYY-MM
    const monthInvoices = safeInvoices.filter(inv => {
      if (!inv.date) return false;
      return String(inv.date).startsWith(selectedMonth);
    });

    const dataMap = {};
    let totalRevenue = 0;

    // 2. Group by Customer and aggregate totals
    monthInvoices.forEach(inv => {
      if (!dataMap[inv.customerId]) {
        const customerObj = safeCustomers.find(c => c.id === inv.customerId);
        dataMap[inv.customerId] = {
          customer: customerObj,
          customerName: String(customerObj?.name || inv.customer || 'Unknown Customer'),
          invoices: [],
          totalBilled: 0,
        };
      }
      dataMap[inv.customerId].invoices.push(inv);
      const invTotal = Number(inv.total) || 0;
      dataMap[inv.customerId].totalBilled += invTotal;
      totalRevenue += invTotal;
    });

    const allCustomerStats = Object.values(dataMap);
    const activeCustomers = allCustomerStats.length;
    const totalInvoicesCount = monthInvoices.length;
    const aov = totalInvoicesCount > 0 ? totalRevenue / totalInvoicesCount : 0;
    
    // Sort to find the highest grossing customer for the month
    const sortedByRevenue = [...allCustomerStats].sort((a, b) => b.totalBilled - a.totalBilled);
    const topCustomer = sortedByRevenue[0] || null;

    // 3. Apply Search Filter for the Table Display
    let displayList = [...allCustomerStats].sort((a, b) => a.customerName.localeCompare(b.customerName));
    if (searchTerm) {
      const lowerSearch = String(searchTerm).toLowerCase();
      displayList = displayList.filter(row => row.customerName.toLowerCase().includes(lowerSearch));
    }

    // Sort the individual invoices inside each row by date
    displayList.forEach(row => {
      row.invoices.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    });

    // Sort the hidden zip/print array as well
    allCustomerStats.forEach(row => {
      row.invoices.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    });

    return {
      totalRevenue,
      activeCustomers,
      totalInvoicesCount,
      aov,
      topCustomer,
      displayList,
      allCustomerStats
    };
  }, [safeInvoices, safeCustomers, selectedMonth, searchTerm]);


  // Handle Standard Print Action
  const handlePrint = (target) => {
    setPrintTarget(target);
    // Give React a tiny fraction of a second to render the hidden print views before triggering browser print
    setTimeout(() => {
      window.print();
      setPrintTarget(null); // Reset after printing
    }, 100);
  };

  // Handle Download ZIP Action
  const handleDownloadZip = () => {
    setIsZipping(true);
    setPrintTarget('ZIP_ALL'); // Force React to render ALL statements into the DOM temporarily

    setTimeout(async () => {
      try {
        const zip = new JSZip();
        
        // Temporarily reveal the print container off-screen so html2canvas can read it
        const printContainer = document.getElementById('print-ui');
        printContainer.style.display = 'block';
        printContainer.style.position = 'absolute';
        printContainer.style.left = '-9999px';
        printContainer.style.top = '0';

        const statementNodes = printContainer.children;
        const d = new Date(`${selectedMonth}-01`);
        const monthShort = d.toLocaleString('en-US', { month: 'short' });
        const yearShort = String(d.getFullYear()).slice(-2);

        // Generate a PDF for each customer statement
        for (let i = 0; i < analytics.allCustomerStats.length; i++) {
          const data = analytics.allCustomerStats[i];
          const node = statementNodes[i];
          
          if (!node) continue;

          // Capture the HTML element as an image
          const canvas = await html2canvas(node, { scale: 2, useCORS: true });
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          
          // A4 dimensions
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          
          // Format FileName: CustomerName_Month_Year (Removes illegal windows characters)
          const customerNameSafe = data.customerName.replace(/[<>:"/\\|?*]/g, '').trim();
          const fileName = `${customerNameSafe}_${monthShort}_${yearShort}.pdf`;
          
          // Add PDF to the Zip File
          const pdfBlob = pdf.output('blob');
          zip.file(fileName, pdfBlob);
        }

        // Hide the print container again
        printContainer.style.display = '';
        printContainer.style.position = '';
        printContainer.style.left = '';
        printContainer.style.top = '';

        // Generate and download the final ZIP
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `All_Statements_${monthShort}_${yearShort}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

      } catch (error) {
        console.error('Error generating ZIP:', error);
        alert('Failed to generate ZIP folder. Please check the console for details.');
      } finally {
        setIsZipping(false);
        setPrintTarget(null); // Reset the render target
      }
    }, 500); // 500ms delay ensures React finishes rendering the elements before we snapshot them
  };

  // Determine which statements to render in the hidden print area
  const statementsToPrint = useMemo(() => {
    if (printTarget === 'ALL' || printTarget === 'ZIP_ALL') return analytics.allCustomerStats;
    if (printTarget) return analytics.allCustomerStats.filter(data => data.customer?.id === printTarget);
    return [];
  }, [printTarget, analytics.allCustomerStats]);

  // Format the month nicely for display (e.g., "April 2026")
  const displayMonth = useMemo(() => {
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  return (
    <div className="p-8 h-full overflow-y-auto relative bg-slate-50/50">
      
      {/* HARD-INJECTED PRINT STYLES */}
      <style type="text/css">
        {`
          @media print {
            @page { size: A4; margin: 0 !important; }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
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
              Generate, print, or download batch summaries for your customers.
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              className="flex items-center rounded-xl bg-indigo-600 px-6 py-2.5 font-medium text-white shadow-lg transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
              onClick={handleDownloadZip}
              disabled={analytics.allCustomerStats.length === 0 || isZipping}
              type="button"
            >
              {isZipping ? (
                <><Loader2 className="mr-2 animate-spin" size={18} /> Zipping Files...</>
              ) : (
                <><Download className="mr-2" size={18} /> Download ZIP</>
              )}
            </button>

            <button
              className="flex items-center rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
              onClick={() => handlePrint('ALL')}
              disabled={analytics.allCustomerStats.length === 0 || isZipping}
              type="button"
            >
              <Printer className="mr-2" size={18} /> Print ALL
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* FINANCIAL ANALYTICS DASHBOARD */}
        {/* ========================================== */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Revenue Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-5 text-blue-600">
              <TrendingUp size={100} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center z-10">
              <DollarSign size={12} className="mr-1" /> Total Monthly Revenue
            </p>
            <p className="text-3xl font-black text-blue-600 tracking-tighter z-10">
              ${formatMoneyWhole(analytics.totalRevenue)}
            </p>
          </div>

          {/* Average Order Value (AOV) Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
            <div className="flex justify-between items-end mb-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center">
                <Receipt size={12} className="mr-1" /> Avg Order Value
              </p>
              <p className="text-xs font-bold text-slate-400">{analytics.totalInvoicesCount} Invoices</p>
            </div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              ${formatMoney(analytics.aov)} <span className="text-sm font-medium text-slate-400">/ order</span>
            </p>
          </div>

          {/* Active Customers Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center">
              <Users size={12} className="mr-1" /> Active Accounts
            </p>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              {analytics.activeCustomers} <span className="text-sm font-medium text-slate-400">entities billed</span>
            </p>
          </div>

          {/* Top Performer Card */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-600 mb-1 flex items-center">
              <Crown size={12} className="mr-1" /> Top Customer
            </p>
            {analytics.topCustomer ? (
              <>
                <p className="text-sm font-bold text-slate-900 truncate leading-tight">
                  {analytics.topCustomer.customerName}
                </p>
                <p className="text-lg font-black text-amber-600 tracking-tight mt-0.5">
                  ${formatMoneyWhole(analytics.topCustomer.totalBilled)}
                </p>
              </>
            ) : (
              <p className="text-sm font-medium text-slate-400 mt-1">No data available</p>
            )}
          </div>
        </div>


        {/* ========================================== */}
        {/* STATEMENT TABLE AREA */}
        {/* ========================================== */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          
          <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-100 bg-slate-50 p-4 gap-4">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
              <Calendar className="text-slate-400 mr-2" size={18} />
              <input
                type="month"
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none cursor-pointer"
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

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                <th className="p-5 pl-8">Customer Entity</th>
                <th className="p-5 text-center">Invoices</th>
                <th className="p-5 text-right text-red-600">Total Amount</th>
                <th className="p-5 pr-8 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {analytics.displayList.map((row) => (
                <tr className="font-medium hover:bg-blue-50/50 transition-colors" key={row.customer?.id || row.customerName}>
                  <td className="p-5 pl-8 font-bold text-slate-800">
                    {row.customerName}
                  </td>
                  <td className="p-5 text-center text-slate-500">{row.invoices.length}</td>
                  <td className="p-5 text-right font-black text-red-600">${formatMoney(row.totalBilled)}</td>
                  <td className="p-5 pr-8 text-right">
                    <button
                      onClick={() => handlePrint(row.customer?.id)}
                      className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      <Printer size={12} className="mr-1" /> Print
                    </button>
                  </td>
                </tr>
              ))}
              {analytics.displayList.length === 0 && (
                <tr>
                  <td className="p-12 text-center text-sm font-bold text-slate-400" colSpan="4">
                    No transactions found for {displayMonth}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT UI (HIDDEN ON SCREEN, VISIBLE ON PRINT OR WHILE ZIPPING) */}
      {/* ========================================================================= */}
      <div id="print-ui" className="hidden">
        {statementsToPrint.map((data, index) => (
          <div 
            key={data.customer?.id || index} 
            className="page-break w-[210mm] min-h-[297mm] bg-white p-[15mm] text-black flex flex-col mx-auto box-border"
            style={{ fontFamily: CJK_FONT }}
          >
            {/* EXACT MATCH HEADER LAYOUT */}
            <div className="flex w-full mb-6 justify-between">
              
              {/* LEFT COLUMN */}
              <div className="flex-1 flex flex-col pr-4">
                <div className="flex items-center mb-5">
                  <div className="w-[110px] shrink-0 mr-4">
                    <img src={logo} alt="Three Leaves Logo" className="w-full h-auto object-contain" />
                  </div>
                  <div className="flex-1 text-left leading-snug pt-2 whitespace-nowrap overflow-visible">
                    <h1 className="font-black text-[17px]" style={{ fontFamily: CJK_FONT }}>THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
                    <h2 className="font-bold text-[16px] mb-1" style={{ fontFamily: CJK_FONT }}>三叶（新加坡） 贸易公司</h2>
                    
                    <div className="text-[#d55e2d] font-bold text-[10px] leading-tight tracking-tighter">
                      <p>CO.REG NO.53033969B &nbsp;&nbsp; GST REG NO. M90355440L</p>
                      <p>280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
                      <p>HP: 97578869 (Mr Ye) &nbsp;&nbsp; HP: 91113505 (Min) &nbsp;&nbsp; Email: 3leaves.sg@gmail.com</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-end w-full mb-2 text-[14px] font-bold">
                  <div className="flex items-end flex-1 pr-4">
                    <span className="shrink-0 mr-2 text-black">TO:</span>
                    <span className="flex-1 uppercase border-b border-black pb-0.5 whitespace-nowrap text-[13px] tracking-tight" style={{ fontFamily: CJK_FONT }}>
                      {data.customerName}
                    </span>
                  </div>
                  <div className="flex items-end w-[40%] pl-2">
                    <span className="shrink-0 mr-2 text-black">STMT MONTH:</span>
                    <span className="flex-1 text-center border-b border-black pb-0.5 uppercase">
                      {displayMonth}
                    </span>
                  </div>
                </div>

                <div className="flex items-end w-full text-[14px] font-bold">
                  <span className="shrink-0 mr-2 text-black">ADDRESS:</span>
                  <span className="flex-1 uppercase border-b border-black pb-0.5 whitespace-nowrap text-[12px] tracking-tighter" style={{ fontFamily: CJK_FONT }}>
                    {data.customer?.address || ''}
                  </span>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="w-[180px] shrink-0 flex flex-col items-start pl-4 pt-1">
                <h2 className="text-[22px] font-bold tracking-[0.4em] leading-none mb-1" style={{ fontFamily: CJK_FONT }}>结账单</h2>
                <h3 className="text-[15px] font-black tracking-wide uppercase mb-6 text-black">STATEMENT</h3>
              </div>
            </div>

            {/* STATEMENT TABLE */}
            <table className="w-full text-[15px] border-2 border-black text-center mb-0 leading-tight flex-grow" style={{ fontFamily: CJK_FONT }}>
              <thead className="border-b-2 border-black">
                <tr className="font-bold bg-white text-[14px]">
                  <th className="py-2 px-2 border-r border-black text-left w-40">DATE</th>
                  <th className="py-2 px-2 border-r border-black text-left">INVOICE NO.</th>
                  <th className="py-2 px-2 text-right w-48">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv, idx) => {
                  const billed = Number(inv.total) || 0;

                  return (
                    <tr key={inv.id} className="h-[32px] align-top" style={{ fontFamily: CJK_FONT }}>
                      <td className="p-1 border-r border-black text-left pl-2 font-medium">
                        {inv.date ? new Date(inv.date).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}
                      </td>
                      <td className="p-1 border-r border-black text-left pl-2 font-bold text-blue-600">#{inv.number || inv.id}</td>
                      <td className="p-1 text-right pr-2 font-bold text-black">
                        ${formatMoney(billed)}
                      </td>
                    </tr>
                  );
                })}
                
                {/* Pad empty rows so the totals sit cleanly at the bottom */}
                {data.invoices.length < 15 && Array.from({ length: 15 - data.invoices.length }).map((_, i) => (
                  <tr key={`blank-${i}`} className="h-[32px]">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* STATEMENT TOTALS */}
            <div className="flex w-full mt-2 justify-end" style={{ fontFamily: CJK_FONT }}>
              <div className="flex flex-col font-bold text-[15px] shrink-0 w-[20rem]">
                <div className="flex mt-2 pt-2 border-t-2 border-black text-[17px]">
                  <div className="w-40 p-1 text-right">TOTAL AMOUNT</div>
                  <div className="w-40 p-1 text-right text-red-600">${formatMoney(data.totalBilled)}</div>
                </div>
              </div>
            </div>

            {/* FOOTER MESSAGE WITH QR CODE & BANK DETAILS */}
            <div className="mt-8 pt-4 border-t border-black flex" style={{ fontFamily: CJK_FONT }}>
              <div className="flex items-center">
                <div className="w-[80px] h-[80px] shrink-0 mr-5">
                  <img src={paynowQr} alt="PayNow QR Code" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col text-[12px] font-bold leading-snug">
                  <p>UEN: 53033969B</p>
                  <p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p>
                  <p>A/C Number: 535 - 846562 - 001</p>
                  <p>Bank Name: OCBC</p>
                  <p className="mt-1 font-normal">All payments must be made payable to Three Leaves (Singapore) Trading Enterprise.</p>
                </div>
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
