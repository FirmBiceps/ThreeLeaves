import { useMemo, useState } from 'react';
import { FileText, Printer, Search, Calendar, Download, Loader2, DollarSign, TrendingUp, Users, Crown, Receipt, CheckCircle, AlertCircle } from 'lucide-react';
import { formatMoney, formatMoneyWhole } from '../../utils/format';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Re-use the logo and QR code from your invoices folder
import logo from '../invoices/three_leaves_logo.png'; 
import paynowQr from '../invoices/paynow_qr.jpg';

const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

export function BillingModule({ sys }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchTerm, setSearchTerm] = useState('');
  
  const [printTarget, setPrintTarget] = useState(null);
  const [isZipping, setIsZipping] = useState(false);

  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];

  // ==========================================
  // FINANCIAL ANALYTICS & DATA ENGINE
  // ==========================================
  const analytics = useMemo(() => {
    const dataMap = {};
    let totalRevenue = 0;

    safeInvoices.forEach(inv => {
      const isCurrentMonth = String(inv.date).startsWith(selectedMonth);
      const isBeforeMonth = String(inv.date).slice(0, 7) < selectedMonth;
      
      // Ignore future invoices
      if (!isCurrentMonth && !isBeforeMonth) return;

      if (!dataMap[inv.customerId]) {
        const customerObj = safeCustomers.find(c => c.id === inv.customerId);
        dataMap[inv.customerId] = {
          customer: customerObj,
          customerName: String(customerObj?.name || inv.customer || 'Unknown Customer'),
          invoices: [],
          totalBilled: 0,
          previousOutstanding: 0,
          monthStatus: 'Paid' // Defaults to Paid until an unpaid invoice is found
        };
      }

      const invTotal = Number(inv.total) || 0;
      const invStatus = String(inv.status || 'Paid'); 

      // If it's this month, add to the current statement
      if (isCurrentMonth) {
        dataMap[inv.customerId].invoices.push(inv);
        dataMap[inv.customerId].totalBilled += invTotal;
        totalRevenue += invTotal;
        
        if (invStatus === 'Unpaid') {
          dataMap[inv.customerId].monthStatus = 'Unpaid';
        }
      }

      // If it's a previous month AND unpaid, add to outstanding debt
      if (isBeforeMonth && invStatus === 'Unpaid') {
        dataMap[inv.customerId].previousOutstanding += invTotal;
      }
    });

    // Calculate Overall Due
    Object.values(dataMap).forEach(row => {
      row.overallDue = row.totalBilled + row.previousOutstanding;
    });

    // Only display customers who have activity THIS month, OR owe money from previous months
    const relevantCustomers = Object.values(dataMap).filter(row => 
      row.invoices.length > 0 || row.previousOutstanding > 0
    );

    const activeCustomers = relevantCustomers.filter(r => r.invoices.length > 0).length;
    const totalInvoicesCount = safeInvoices.filter(inv => String(inv.date).startsWith(selectedMonth)).length;
    const aov = totalInvoicesCount > 0 ? totalRevenue / totalInvoicesCount : 0;
    
    const sortedByRevenue = [...relevantCustomers].sort((a, b) => b.totalBilled - a.totalBilled);
    const topCustomer = sortedByRevenue[0] || null;

    let displayList = [...relevantCustomers].sort((a, b) => a.customerName.localeCompare(b.customerName));
    if (searchTerm) {
      const lowerSearch = String(searchTerm).toLowerCase();
      displayList = displayList.filter(row => row.customerName.toLowerCase().includes(lowerSearch));
    }

    displayList.forEach(row => {
      row.invoices.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    });

    relevantCustomers.forEach(row => {
      row.invoices.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    });

    return {
      totalRevenue,
      activeCustomers,
      totalInvoicesCount,
      aov,
      topCustomer,
      displayList,
      allCustomerStats: relevantCustomers
    };
  }, [safeInvoices, safeCustomers, selectedMonth, searchTerm]);

  // Handle marking a month as Paid/Unpaid
  const handleToggleMonthStatus = (customerId, currentStatus) => {
    const newStatus = currentStatus === 'Paid' ? 'Unpaid' : 'Paid';
    
    const updatedInvoices = safeInvoices.map(inv => {
      if (inv.customerId === customerId && String(inv.date).startsWith(selectedMonth)) {
        return { ...inv, status: newStatus };
      }
      return inv;
    });

    sys.setInvoices(updatedInvoices);
  };

  const handlePrint = (target) => {
    setPrintTarget(target);
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 300);
  };

  const handleDownloadZip = () => {
    setIsZipping(true);
    setPrintTarget('ZIP_ALL'); 

    setTimeout(async () => {
      try {
        const zip = new JSZip();
        const printContainer = document.getElementById('print-ui');
        const statementNodes = printContainer.children;
        const d = new Date(`${selectedMonth}-01`);
        const monthShort = d.toLocaleString('en-US', { month: 'short' });
        const yearShort = String(d.getFullYear()).slice(-2);

        for (let i = 0; i < analytics.allCustomerStats.length; i++) {
          const data = analytics.allCustomerStats[i];
          const node = statementNodes[i];
          
          if (!node) continue;

          const canvas = await html2canvas(node, { scale: 2, useCORS: true, logging: false });
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          
          const customerNameSafe = data.customerName.replace(/[<>:"/\\|?*]/g, '').trim();
          const fileName = `${customerNameSafe}_${monthShort}_${yearShort}.pdf`;
          
          const pdfBlob = pdf.output('blob');
          zip.file(fileName, pdfBlob);
        }

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
        setPrintTarget(null);
      }
    }, 1000); 
  };

  const statementsToPrint = useMemo(() => {
    if (printTarget === 'ALL' || printTarget === 'ZIP_ALL') return analytics.allCustomerStats;
    if (printTarget) return analytics.allCustomerStats.filter(data => data.customer?.id === printTarget);
    return [];
  }, [printTarget, analytics.allCustomerStats]);

  const displayMonth = useMemo(() => {
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  return (
    <div className="p-8 h-full overflow-y-auto relative bg-slate-50/50">
      
      <div className="absolute opacity-0 w-0 h-0 overflow-hidden pointer-events-none">
        <img src={logo} alt="preload logo" />
        <img src={paynowQr} alt="preload qr" />
      </div>

      <style type="text/css">
        {`
          @media print {
            @page { size: A4; margin: 0 !important; }
            html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page-break { page-break-after: always !important; break-after: page !important; }
            #screen-ui { display: none !important; }
            #print-ui { display: block !important; position: relative !important; left: auto !important; top: auto !important; opacity: 1 !important; z-index: auto !important; }
          }
        `}
      </style>

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
              {isZipping ? <><Loader2 className="mr-2 animate-spin" size={18} /> Zipping Files...</> : <><Download className="mr-2" size={18} /> Download ZIP</>}
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-5 text-blue-600"><TrendingUp size={100} /></div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center z-10"><DollarSign size={12} className="mr-1" /> Total Monthly Revenue</p>
            <p className="text-3xl font-black text-blue-600 tracking-tighter z-10">${formatMoneyWhole(analytics.totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
            <div className="flex justify-between items-end mb-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center"><Receipt size={12} className="mr-1" /> Avg Order Value</p>
              <p className="text-xs font-bold text-slate-400">{analytics.totalInvoicesCount} Invoices</p>
            </div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">${formatMoney(analytics.aov)} <span className="text-sm font-medium text-slate-400">/ order</span></p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center"><Users size={12} className="mr-1" /> Active Accounts</p>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">{analytics.activeCustomers} <span className="text-sm font-medium text-slate-400">entities billed</span></p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-600 mb-1 flex items-center"><Crown size={12} className="mr-1" /> Top Customer</p>
            {analytics.topCustomer ? (
              <>
                <p className="text-sm font-bold text-slate-900 truncate leading-tight">{analytics.topCustomer.customerName}</p>
                <p className="text-lg font-black text-amber-600 tracking-tight mt-0.5">${formatMoneyWhole(analytics.topCustomer.totalBilled)}</p>
              </>
            ) : <p className="text-sm font-medium text-slate-400 mt-1">No data available</p>}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-100 bg-slate-50 p-4 gap-4">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
              <Calendar className="text-slate-400 mr-2" size={18} />
              <input type="month" className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none cursor-pointer" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
            </div>
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm w-full sm:w-72">
              <Search className="text-slate-400 mr-2" size={18} />
              <input type="text" placeholder="Search customer..." className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                <th className="p-5 pl-8">Customer Entity</th>
                <th className="p-5 text-right">This Month</th>
                <th className="p-5 text-right text-red-500">Prev. Unpaid</th>
                <th className="p-5 text-right text-slate-900">Overall Due</th>
                <th className="p-5 text-center">Status</th>
                <th className="p-5 pr-8 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {analytics.displayList.map((row) => (
                <tr className="font-medium hover:bg-blue-50/50 transition-colors" key={row.customer?.id || row.customerName}>
                  <td className="p-5 pl-8 font-bold text-slate-800">
                    {row.customerName}
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">{row.invoices.length} Invoices</div>
                  </td>
                  <td className="p-5 text-right text-slate-600">${formatMoney(row.totalBilled)}</td>
                  <td className="p-5 text-right font-bold text-red-500">{row.previousOutstanding > 0 ? `$${formatMoney(row.previousOutstanding)}` : '-'}</td>
                  <td className="p-5 text-right font-black text-slate-900 text-base">${formatMoney(row.overallDue)}</td>
                  <td className="p-5 text-center">
                    {row.invoices.length > 0 ? (
                      <button
                        onClick={() => handleToggleMonthStatus(row.customer?.id, row.monthStatus)}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          row.monthStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                        }`}
                      >
                        {row.monthStatus === 'Paid' ? <CheckCircle size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />}
                        {row.monthStatus}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium italic">No new invoices</span>
                    )}
                  </td>
                  <td className="p-5 pr-8 text-right">
                    <button onClick={() => handlePrint(row.customer?.id)} className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-colors">
                      <Printer size={12} className="mr-1" /> Print
                    </button>
                  </td>
                </tr>
              ))}
              {analytics.displayList.length === 0 && (
                <tr>
                  <td className="p-12 text-center text-sm font-bold text-slate-400" colSpan="6">
                    No transactions or outstanding balances found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT UI (Kept off-screen so images load, brought to center during ZIP or Print) */}
      {/* ========================================================================= */}
      <div id="print-ui" className={isZipping ? "absolute left-[-9999px] top-0 opacity-100 z-[-100] block" : "hidden"}>
        {statementsToPrint.map((data, index) => (
          <div key={data.customer?.id || index} className="page-break w-[210mm] min-h-[297mm] bg-white p-[15mm] text-black flex flex-col mx-auto box-border" style={{ fontFamily: CJK_FONT }}>
            
            <div className="flex w-full mb-6 justify-between">
              <div className="flex-1 flex flex-col pr-4">
                <div className="flex items-center mb-5">
                  <div className="w-[110px] h-[80px] shrink-0 mr-4 flex items-center justify-center">
                    <img src={logo} alt="Three Leaves Logo" className="w-[110px] h-[80px] object-contain" />
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
                    <span className="flex-1 uppercase border-b border-black pb-0.5 whitespace-nowrap text-[13px] tracking-tight" style={{ fontFamily: CJK_FONT }}>{data.customerName}</span>
                  </div>
                  <div className="flex items-end w-[40%] pl-2">
                    <span className="shrink-0 mr-2 text-black">STMT MONTH:</span>
                    <span className="flex-1 text-center border-b border-black pb-0.5 uppercase">{displayMonth}</span>
                  </div>
                </div>

                <div className="flex items-end w-full text-[14px] font-bold">
                  <span className="shrink-0 mr-2 text-black">ADDRESS:</span>
                  <span className="flex-1 uppercase border-b border-black pb-0.5 whitespace-nowrap text-[12px] tracking-tighter" style={{ fontFamily: CJK_FONT }}>{data.customer?.address || ''}</span>
                </div>
              </div>

              <div className="w-[180px] shrink-0 flex flex-col items-start pl-4 pt-1">
                <h2 className="text-[22px] font-bold tracking-[0.4em] leading-none mb-1" style={{ fontFamily: CJK_FONT }}>结账单</h2>
                <h3 className="text-[15px] font-black tracking-wide uppercase mb-6 text-black">STATEMENT</h3>
              </div>
            </div>

            <table className="w-full text-[15px] border-2 border-black text-center mb-0 leading-tight flex-none" style={{ fontFamily: CJK_FONT }}>
              <thead className="border-b-2 border-black">
                <tr className="font-bold bg-white text-[14px]">
                  <th className="py-2 px-2 border-r border-black text-left w-40">DATE</th>
                  <th className="py-2 px-2 border-r border-black text-left">INVOICE NO.</th>
                  <th className="py-2 px-2 text-right w-48">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => {
                  const billed = Number(inv.total) || 0;
                  return (
                    <tr key={inv.id} className="h-[30px] align-top" style={{ fontFamily: CJK_FONT }}>
                      <td className="p-1 border-r border-black text-left pl-2 font-medium pt-1.5">{inv.date ? new Date(inv.date).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}</td>
                      <td className="p-1 border-r border-black text-left pl-2 font-bold text-blue-600 pt-1.5">#{inv.number || inv.id}</td>
                      <td className="p-1 text-right pr-2 font-bold text-black pt-1.5">${formatMoney(billed)}</td>
                    </tr>
                  );
                })}
                
                {data.invoices.length < 20 && Array.from({ length: 20 - data.invoices.length }).map((_, i) => (
                  <tr key={`blank-${i}`} className="h-[30px]"><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td></tr>
                ))}
              </tbody>
            </table>

            {/* DYNAMIC OUTSTANDING DEBT RENDERER */}
            <div className="flex w-full mt-2 justify-end" style={{ fontFamily: CJK_FONT }}>
              <div className="flex flex-col font-bold shrink-0 w-[20rem]">
                {data.previousOutstanding > 0 ? (
                  <>
                    <div className="flex pt-2 border-t-2 border-black text-[14px]">
                      <div className="w-48 p-1 text-right">THIS MONTH TOTAL</div>
                      <div className="w-40 p-1 text-right">${formatMoney(data.totalBilled)}</div>
                    </div>
                    <div className="flex text-[14px] text-slate-600">
                      <div className="w-48 p-1 text-right">PREV. OUTSTANDING</div>
                      <div className="w-40 p-1 text-right">${formatMoney(data.previousOutstanding)}</div>
                    </div>
                    <div className="flex mt-1 pt-1 border-t border-black text-[16px] font-black text-red-600">
                      <div className="w-48 p-1 text-right">OVERALL TOTAL DUE</div>
                      <div className="w-40 p-1 text-right">${formatMoney(data.overallDue)}</div>
                    </div>
                  </>
                ) : (
                  <div className="flex pt-2 border-t-2 border-black text-[16px]">
                    <div className="w-40 p-1 text-right">TOTAL AMOUNT</div>
                    <div className="w-40 p-1 text-right text-red-600">${formatMoney(data.totalBilled)}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex w-full mt-auto pt-2 items-end shrink-0">
              <div className="w-[70%] text-[12px] font-bold leading-snug pr-4">
                <div style={{ fontFamily: CJK_FONT }}>
                  <p className="text-[12px]">请提前一天提交订单,同日送达的截止时间为下午12点前。每周日休息</p>
                  <p className="text-[10px] whitespace-nowrap text-slate-800">Please submit orders one day in advance. The cut-off time for same-day delivery is before 12 PM. Closed on Sundays.</p>
                  
                  <div className="mt-2 flex items-center">
                    <div className="w-[65px] h-[65px] shrink-0 mr-3 flex items-center justify-center">
                      <img src={paynowQr} alt="PayNow QR Code" className="w-[65px] h-[65px] object-contain" />
                    </div>
                    <div className="flex flex-col justify-center text-[11px]">
                      <p>UEN: 53033969B</p>
                      <p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p>
                      <p>A/C Number: 535-846562-001</p>
                      <p>Bank Name: OCBC</p>
                      <p className="mt-0.5 font-normal text-[10px] text-slate-800">All payments must be made payable to Three Leaves (Singapore) Trading Enterprise.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-[30%] shrink-0 flex flex-col justify-end pb-1 pl-2">
                <div className="h-12"></div> 
                <div className="border-t-2 border-black text-center pt-1.5 text-[12px] font-bold uppercase tracking-widest">Received By</div>
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
