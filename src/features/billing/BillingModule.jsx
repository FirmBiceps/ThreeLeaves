import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Printer, Search, Calendar, Download, Loader2, DollarSign, TrendingUp, Users, Crown, Receipt, CheckCircle, AlertCircle, ChevronDown, Filter } from 'lucide-react';
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
  const [termFilter, setTermFilter] = useState('All'); // 'All', 'cod', '30_days'
  
  const [printTarget, setPrintTarget] = useState(null);
  const [isZipping, setIsZipping] = useState(false);

  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];

  // ==========================================
  // FINANCIAL ANALYTICS & DATA ENGINE
  // ==========================================
  const analytics = useMemo(() => {
    const dataMap = {};

    safeInvoices.forEach(inv => {
      const isCurrentMonth = String(inv.date).startsWith(selectedMonth);
      const isBeforeMonth = String(inv.date).slice(0, 7) < selectedMonth;
      
      if (!isCurrentMonth && !isBeforeMonth) return;

      if (!dataMap[inv.customerId]) {
        const customerObj = safeCustomers.find(c => c.id === inv.customerId);
        dataMap[inv.customerId] = {
          customer: customerObj,
          customerName: String(customerObj?.name || inv.customer || 'Unknown Customer'),
          invoices: [],
          totalBilled: 0,
          previousOutstanding: 0,
          monthStatus: 'Paid'
        };
      }

      const invTotal = Number(inv.total) || 0;
      const invStatus = String(inv.status || 'Paid'); 

      if (isCurrentMonth) {
        dataMap[inv.customerId].invoices.push(inv);
        dataMap[inv.customerId].totalBilled += invTotal;
        if (invStatus === 'Unpaid') dataMap[inv.customerId].monthStatus = 'Unpaid';
      }

      if (isBeforeMonth && invStatus === 'Unpaid') {
        dataMap[inv.customerId].previousOutstanding += invTotal;
      }
    });

    Object.values(dataMap).forEach(row => {
      row.overallDue = row.totalBilled + row.previousOutstanding;
    });

    const relevantCustomers = Object.values(dataMap).filter(row => {
      const isActive = row.invoices.length > 0 || row.previousOutstanding > 0;
      if (!isActive) return false;

      if (termFilter !== 'All') {
        const cTerm = row.customer?.payment_terms === 'cod' ? 'cod' : '30_days';
        if (cTerm !== termFilter) return false;
      }
      return true;
    });

    let totalRevenue = 0;
    let totalInvoicesCount = 0;

    relevantCustomers.forEach(row => {
      totalRevenue += row.totalBilled;
      totalInvoicesCount += row.invoices.length;
    });

    const activeCustomers = relevantCustomers.filter(r => r.invoices.length > 0).length;
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

    return {
      totalRevenue,
      activeCustomers,
      totalInvoicesCount,
      aov,
      topCustomer,
      displayList,
      allCustomerStats: relevantCustomers
    };
  }, [safeInvoices, safeCustomers, selectedMonth, searchTerm, termFilter]);

  const handleStatusChange = (customerId, newStatus) => {
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
        // Wait an extra moment to ensure the DOM is fully rendered before capturing
        await new Promise(resolve => setTimeout(resolve, 500));

        const customerWrappers = document.querySelectorAll('.customer-print-wrapper');
        const d = new Date(`${selectedMonth}-01`);
        const monthShort = d.toLocaleString('en-US', { month: 'short' });
        const yearShort = String(d.getFullYear()).slice(-2);
        const typeStr = termFilter === 'All' ? 'All' : termFilter === 'cod' ? 'COD' : '30Days';

        for (let i = 0; i < analytics.allCustomerStats.length; i++) {
          const data = analytics.allCustomerStats[i];
          const wrapper = customerWrappers[i];
          
          if (!wrapper) continue;

          // Intelligently locate all separate A4 pages for this specific customer
          const pages = wrapper.querySelectorAll('.a4-statement-page');
          const pdf = new jsPDF('p', 'mm', 'a4');

          for (let p = 0; p < pages.length; p++) {
            const pageNode = pages[p];
            const canvas = await html2canvas(pageNode, { 
              scale: 2, 
              useCORS: true, 
              logging: false 
            });
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            
            const pdfWidth = 210; // A4 Width in mm
            const pdfHeight = 297; // A4 Height in mm
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            
            // If there is another page for this customer, add a new page to the PDF
            if (p < pages.length - 1) {
              pdf.addPage();
            }
          }
          
          const customerNameSafe = data.customerName.replace(/[<>:"/\\|?*]/g, '').trim();
          const fileName = `${customerNameSafe}_${monthShort}_${yearShort}.pdf`;
          
          const pdfBlob = pdf.output('blob');
          zip.file(fileName, pdfBlob);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${typeStr}_Statements_${monthShort}_${yearShort}.zip`;
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

  const termLabel = termFilter === 'All' ? 'ALL' : termFilter === 'cod' ? 'COD' : '30-DAY';

  // =========================================================================
  // FOOLPROOF PRINT PORTAL (Teleports the UI out of the dashboard layout)
  // =========================================================================
  const printContent = printTarget ? (
    <div id="print-portal-root" className="absolute left-[-9999px] top-0 z-[-100] bg-white text-black" style={{ width: '210mm' }}>
      <style type="text/css">
        {`
          /* BASE A4 DIMENSIONS - Applies both on screen (for ZIP capture) and in print */
          .a4-statement-page { 
            width: 210mm; 
            height: 297mm; 
            padding: 10mm 15mm; 
            box-sizing: border-box; 
            display: flex; 
            flex-direction: column; 
            justify-content: space-between; 
            background: white; 
            margin-bottom: 10px;
          }
          
          table { border-collapse: collapse; width: 100%; }
          
          @media print {
            @page { size: A4; margin: 0 !important; }
            html, body { 
              margin: 0 !important; 
              padding: 0 !important; 
              background: white !important; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
              height: auto !important; 
              min-height: auto !important; 
              overflow: visible !important; 
            }
            
            /* HIDE THE DASHBOARD COMPLETELY TO PREVENT CLIPPING */
            #root { display: none !important; }
            
            /* UNHIDE THE PORTAL AND RESTORE NATURAL FLOW */
            #print-portal-root { 
              display: block !important; 
              position: static !important; 
              width: 100% !important; 
              left: auto !important; 
              top: auto !important; 
              z-index: auto !important; 
              opacity: 1 !important; 
              visibility: visible !important; 
            }
            
            /* FORCE HARD PAGE BREAKS DURING NATIVE PRINT */
            .a4-statement-page { 
              margin-bottom: 0 !important;
              page-break-after: always !important; 
              break-after: always !important; 
            }
            
            tr, td, th { page-break-inside: avoid; break-inside: avoid; }
          }
        `}
      </style>

      <div id="print-pages-container" className="flex flex-col w-full items-center">
        {statementsToPrint.map((data, index) => {
          // CHUNKING: Fixed to 18 items max per page to prevent bottom cutoff
          const ITEMS_PER_PAGE = 18;
          const pages = [];
          for (let i = 0; i < data.invoices.length; i += ITEMS_PER_PAGE) {
            pages.push(data.invoices.slice(i, i + ITEMS_PER_PAGE));
          }
          if (pages.length === 0) pages.push([]);

          return (
            <div key={data.customer?.id || index} className="customer-print-wrapper w-full">
              {pages.map((pageItems, pageIndex) => {
                const isLastPage = pageIndex === pages.length - 1;

                return (
                  <div key={pageIndex} className="a4-statement-page mx-auto" style={{ fontFamily: CJK_FONT }}>
                    
                    {/* --- HEADER --- */}
                    <div className="flex w-full mb-5 justify-between items-start shrink-0 border-b-2 border-black pb-3">
                      <div className="w-[100px] shrink-0">
                        <img src={logo} alt="Three Leaves Logo" className="w-[100px] h-auto object-contain" />
                      </div>

                      <div className="flex-1 text-center px-2 flex flex-col items-center justify-start pt-1">
                        <h1 className="font-black text-[15px] tracking-tight mb-1" style={{ fontFamily: CJK_FONT }}>THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
                        <h2 className="font-bold text-[14px] mb-1" style={{ fontFamily: CJK_FONT }}>三叶（新加坡） 贸易公司</h2>
                        <p className="font-bold text-[9px] mb-0.5 tracking-tight">CO.REG NO.53033969B &nbsp;|&nbsp; GST REG NO. M90355440L</p>
                        <p className="text-[9px] mb-0.5 tracking-tight">280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
                        <p className="text-[9px] tracking-tight">HP: 97578869 (Mr Ye) &nbsp;|&nbsp; HP: 91113505 (Min) &nbsp;|&nbsp; Email: 3leaves.sg@gmail.com</p>
                      </div>

                      <div className="w-[100px] shrink-0 flex flex-col items-end pt-1">
                        <h2 className="text-[20px] font-black tracking-widest leading-none mb-1" style={{ fontFamily: CJK_FONT }}>结账单</h2>
                        <h3 className="text-[12px] font-black uppercase text-black">STATEMENT</h3>
                      </div>
                    </div>

                    {/* --- CUSTOMER INFO --- */}
                    <div className="w-full shrink-0 flex justify-between items-end mb-4 font-bold text-[13px] leading-tight">
                      <div className="w-[70%] pr-4">
                        <div className="flex items-end mb-1.5">
                          <span className="w-12 shrink-0 text-slate-500 font-bold text-[12px]">TO:</span>
                          <span className="flex-1 uppercase border-b border-black pb-0.5 font-black text-[14px]" style={{ fontFamily: CJK_FONT }}>
                            {data.customerName}
                          </span>
                        </div>
                        <div className="flex items-end">
                          <span className="w-20 shrink-0 text-slate-500 font-bold text-[12px]">ADDRESS:</span>
                          <span className="flex-1 uppercase border-b border-black pb-0.5 text-[12px] truncate" style={{ fontFamily: CJK_FONT }}>
                            {data.customer?.address || '-'}
                          </span>
                        </div>
                      </div>
                      <div className="w-[30%] pl-4 flex flex-col items-end justify-end">
                        <div className="flex items-end mb-1.5 w-full justify-end">
                          <span className="shrink-0 text-slate-500 font-bold text-[12px] mr-2">STMT MONTH:</span>
                          <span className="w-24 text-center border-b border-black pb-0.5 font-black text-[13px] uppercase">
                            {displayMonth}
                          </span>
                        </div>
                        <div className="flex items-end w-full justify-end">
                          <span className="shrink-0 text-slate-500 font-bold text-[12px] mr-2">TERMS:</span>
                          <span className="w-24 text-center border-b border-black pb-0.5 font-bold text-[12px] uppercase">
                            {data.customer?.payment_terms === 'cod' ? 'C.O.D' : '30 DAYS'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* --- TABLE CONTENT --- */}
                    <div className="w-full flex-1 flex flex-col justify-start overflow-hidden">
                      <table className="w-full text-[13px] text-center mb-0 border-collapse" style={{ fontFamily: CJK_FONT }}>
                        <thead>
                          <tr className="font-bold text-[13px] border-y-2 border-black">
                            <th className="py-2 px-2 text-center w-12">NO.</th>
                            <th className="py-2 px-2 text-center w-32">DATE</th>
                            <th className="py-2 px-2 text-center">INVOICE NO.</th>
                            <th className="py-2 px-2 text-right w-48 pr-4">AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Invoice Data Rows */}
                          {pageItems.map((inv, idx) => {
                            const billed = Number(inv.total) || 0;
                            const absoluteIndex = pageIndex * ITEMS_PER_PAGE + idx + 1;
                            return (
                              <tr key={inv.id} className="h-[28px] align-middle">
                                <td className="p-1 text-center font-medium">{absoluteIndex}</td>
                                <td className="p-1 text-center font-medium">{inv.date ? new Date(inv.date).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}</td>
                                <td className="p-1 text-center font-bold text-black">#{inv.number || inv.id}</td>
                                <td className="p-1 text-right font-bold text-black pr-4">${formatMoney(billed)}</td>
                              </tr>
                            );
                          })}
                          
                          {/* Empty Padding Rows */}
                          {pageItems.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - pageItems.length }).map((_, i) => (
                            <tr key={`blank-${i}`} className="h-[28px] align-middle">
                              <td></td>
                              <td></td>
                              <td></td>
                              <td></td>
                            </tr>
                          ))}

                          {/* Beautifully Integrated Total Row (Flushed Right, Transparent Background) */}
                          {isLastPage && data.previousOutstanding > 0 ? (
                            <>
                              <tr className="h-[28px] align-middle border-t-2 border-black">
                                <td colSpan="3" className="py-1 px-4 text-right font-bold text-[12px] tracking-wide text-slate-800">THIS MONTH TOTAL:</td>
                                <td className="py-1 text-right font-bold text-[13px] pr-4">${formatMoney(data.totalBilled)}</td>
                              </tr>
                              <tr className="h-[28px] align-middle">
                                <td colSpan="3" className="py-1 px-4 text-right font-bold text-[12px] tracking-wide text-slate-600">PREV. OUTSTANDING:</td>
                                <td className="py-1 text-right font-bold text-[13px] text-slate-600 pr-4">${formatMoney(data.previousOutstanding)}</td>
                              </tr>
                              <tr className="h-[36px] align-middle border-y-2 border-black">
                                <td colSpan="3" className="py-2 px-4 text-right font-black text-[14px] tracking-widest uppercase text-black">OVERALL TOTAL DUE:</td>
                                <td className="py-2 text-right font-black text-[16px] text-black pr-4">${formatMoney(data.overallDue)}</td>
                              </tr>
                            </>
                          ) : isLastPage ? (
                            <tr className="h-[36px] align-middle border-y-2 border-black">
                              <td colSpan="3" className="py-2 px-4 text-right font-black text-[14px] tracking-widest uppercase text-black">TOTAL AMOUNT DUE:</td>
                              <td className="py-2 text-right font-black text-[16px] text-black pr-4">${formatMoney(data.totalBilled)}</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>

                    {/* --- FOOTER --- */}
                    <div className="flex w-full pt-3 items-end shrink-0 relative mt-auto">
                      <div className="w-[75%] text-[12px] font-bold leading-snug pr-4">
                        <div style={{ fontFamily: CJK_FONT }}>
                          <p className="text-[12px]">请提前一天提交订单,同日送达的截止时间为下午12点前。每周日休息</p>
                          <p className="text-[10px] text-slate-800">Please submit orders one day in advance. The cut-off time for same-day delivery is before 12 PM. Closed on Sundays.</p>
                          
                          <div className="mt-2 flex items-center">
                            <div className="w-[60px] h-[60px] shrink-0 mr-3 flex items-center justify-center">
                              <img src={paynowQr} alt="PayNow QR Code" className="w-[60px] h-[60px] object-contain" />
                            </div>
                            <div className="flex flex-col justify-center text-[10px] space-y-0.5">
                              <p>UEN: <span className="font-black text-[11px]">53033969B</span></p>
                              <p>A/C Name: <span className="font-black text-[11px]">Three Leaves (Singapore) Trading Enterprise</span></p>
                              <p>A/C Number: <span className="font-black text-[11px]">535-846562-001</span></p>
                              <p>Bank Name: <span className="font-black text-[11px]">OCBC</span></p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="w-[25%] shrink-0 flex flex-col justify-end pb-1 pl-2">
                        <div className="h-10"></div> 
                        <div className="border-t border-black text-center pt-1 text-[11px] font-bold uppercase tracking-widest">Received By</div>
                      </div>

                      <div className="absolute right-0 top-3 text-[10px] font-black tracking-widest text-slate-400">
                        PAGE {pageIndex + 1} OF {pages.length}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className="p-8 h-full overflow-y-auto relative bg-slate-50/50">
      
      {/* Invisible preloads */}
      <div className="absolute opacity-0 w-0 h-0 overflow-hidden pointer-events-none">
        <img src={logo} alt="preload logo" />
        <img src={paynowQr} alt="preload qr" />
      </div>

      {/* DASHBOARD SCREEN UI */}
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
              {isZipping ? <><Loader2 className="mr-2 animate-spin" size={18} /> Zipping Files...</> : <><Download className="mr-2" size={18} /> {termLabel} ZIP</>}
            </button>

            <button
              className="flex items-center rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
              onClick={() => handlePrint('ALL')}
              disabled={analytics.allCustomerStats.length === 0 || isZipping}
              type="button"
            >
              <Printer className="mr-2" size={18} /> Print {termLabel}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-5 text-blue-600"><TrendingUp size={100} /></div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center z-10">
              <DollarSign size={12} className="mr-1" /> {termFilter === 'All' ? 'Total' : termLabel} Revenue
            </p>
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
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center"><Users size={12} className="mr-1" /> {termFilter === 'All' ? 'Active' : termLabel} Accounts</p>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">{analytics.activeCustomers} <span className="text-sm font-medium text-slate-400">entities billed</span></p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-600 mb-1 flex items-center"><Crown size={12} className="mr-1" /> Top {termFilter !== 'All' ? termLabel : ''} Customer</p>
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
            
            <div className="flex items-center space-x-4 w-full">
              <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm w-44">
                <Calendar className="text-slate-400 mr-2 shrink-0" size={18} />
                <input type="month" className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none cursor-pointer" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
              </div>
              
              <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm w-48">
                <Filter className="text-slate-400 mr-2 shrink-0" size={18} />
                <select 
                  className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none cursor-pointer appearance-none"
                  value={termFilter}
                  onChange={(e) => setTermFilter(e.target.value)}
                >
                  <option value="All">All Payment Terms</option>
                  <option value="30_days">30 Days Credit</option>
                  <option value="cod">C.O.D. Only</option>
                </select>
              </div>

              <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm flex-1">
                <Search className="text-slate-400 mr-2 shrink-0" size={18} />
                <input type="text" placeholder="Search customer entity..." className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
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
                    <div className="flex items-center">
                      {row.customerName}
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${row.customer?.payment_terms === 'cod' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'}`}>
                        {row.customer?.payment_terms === 'cod' ? 'C.O.D' : '30 Days'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">{row.invoices.length} Invoices</div>
                  </td>
                  <td className="p-5 text-right text-slate-600">${formatMoney(row.totalBilled)}</td>
                  <td className="p-5 text-right font-bold text-red-500">{row.previousOutstanding > 0 ? `$${formatMoney(row.previousOutstanding)}` : '-'}</td>
                  <td className="p-5 text-right font-black text-slate-900 text-base">${formatMoney(row.overallDue)}</td>
                  <td className="p-5 text-center">
                    {row.invoices.length > 0 ? (
                      <div className="relative inline-flex items-center">
                        <select
                          value={row.monthStatus}
                          onChange={(e) => handleStatusChange(row.customer?.id, e.target.value)}
                          className={`appearance-none cursor-pointer pl-8 pr-8 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none transition-all ${
                            row.monthStatus === 'Paid' 
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200' 
                              : 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200'
                          }`}
                        >
                          <option value="Paid">PAID</option>
                          <option value="Unpaid">UNPAID</option>
                        </select>
                        <div className="absolute left-2.5 pointer-events-none">
                          {row.monthStatus === 'Paid' ? <CheckCircle size={12} className="text-emerald-600" /> : <AlertCircle size={12} className="text-orange-600" />}
                        </div>
                        <div className="absolute right-2.5 pointer-events-none">
                          <ChevronDown size={12} className={row.monthStatus === 'Paid' ? "text-emerald-600" : "text-orange-600"} />
                        </div>
                      </div>
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

      {/* RENDER THE SECURE PRINT PORTAL OUTSIDE THE REACT ROOT */}
      {printTarget && createPortal(printContent, document.body)}

    </div>
  );
}
