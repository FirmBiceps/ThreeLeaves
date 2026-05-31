import { useMemo, useState } from 'react';
import { FileText, Printer, Search, Calendar, Download, Loader2, DollarSign, TrendingUp, Users, Crown, Receipt, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { formatMoney, formatMoneyWhole } from '../../utils/format';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Re-use the logo and QR code from your invoices folder
import logo from '../invoices/three_leaves_logo.png'; 
import paynowQr from '../invoices/paynow_qr.jpg';

const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

// ============================================================================
// COMPONENT: STATEMENT PDF GENERATOR (STRICT A4 MULTI-PAGE CHUNKING)
// ============================================================================
function StatementPreviewModal({ customer, monthStr, invoices, onClose }) {
  const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  
  // Calculate Grand Total
  const totalAmount = invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

  // STRICT CHUNKING ENGINE: Divide invoices into exact arrays of 22 items each
  const ITEMS_PER_PAGE = 22;
  const pages = [];
  for (let i = 0; i < invoices.length; i += ITEMS_PER_PAGE) {
    pages.push(invoices.slice(i, i + ITEMS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <div className="quotation-modal-wrapper fixed inset-0 z-[7000] overflow-y-auto bg-slate-950/90 print:bg-white print:p-0">
      
      <style type="text/css">
        {`
          @media print {
            @page { margin: 0 !important; size: A4; }
            html, body { 
              margin: 0 !important; padding: 0 !important; background: white !important; 
              -webkit-print-color-adjust: exact; print-color-adjust: exact; 
              height: auto !important; overflow: visible !important; 
            }
            
            /* Untrap ancestor wrappers */
            html, body, #root, html :has(#printable-statement-spooler) {
              position: static !important; display: block !important; width: auto !important; 
              height: auto !important; max-height: none !important; overflow: visible !important; 
              padding: 0 !important; margin: 0 !important; background: white !important;
            }

            /* Hide everything else visually */
            body * { visibility: hidden; }

            /* Collapse invisible siblings */
            body *:not(:has(#printable-statement-spooler)):not(#printable-statement-spooler *) {
              position: absolute !important; height: 0 !important; width: 0 !important; 
              margin: 0 !important; padding: 0 !important; overflow: hidden !important; border: none !important;
            }

            /* Display Spooler */
            #printable-statement-spooler, #printable-statement-spooler * { visibility: visible; }
            #printable-statement-spooler {
              position: static !important; width: 210mm !important; height: auto !important; 
              max-height: none !important; padding: 0 !important; margin: 0 !important; 
              background: white !important; box-sizing: border-box !important; display: block !important;
            }

            /* Strict A4 Container per page */
            .a4-statement-page {
              page-break-after: always !important; break-after: always !important;
              width: 210mm !important; height: 297mm !important; padding: 15mm !important; 
              box-sizing: border-box !important; display: flex !important; flex-direction: column !important; 
              justify-content: space-between !important; overflow: hidden !important; 
              margin: 0 !important; background: white !important; float: none !important;
            }

            #printable-statement-spooler, #printable-statement-spooler * { font-family: ${CJK_FONT} !important; }
            tr, td, th { page-break-inside: avoid; break-inside: avoid; }
          }
        `}
      </style>

      <div className="flex min-h-full flex-col items-center py-12 print:py-0 print:block">
        
        {/* ACTION BAR */}
        <div className="w-full max-w-[210mm] shrink-0 bg-slate-900 px-8 py-4 flex justify-between items-center text-white rounded-t-2xl shadow-2xl print:hidden border-b-4 border-indigo-500 mb-4">
          <div className="flex items-center">
            <FileText size={24} className="mr-3 text-indigo-400" />
            <div>
              <h2 className="text-sm font-black tracking-widest uppercase text-slate-200">Statement Print Preview</h2>
              <p className="text-lg font-bold text-white leading-none mt-0.5">{customer?.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => window.print()} className="flex items-center text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl transition-colors shadow-lg">
              <Printer size={18} className="mr-2" /> Print Statement ({pages.length} Page{pages.length > 1 ? 's' : ''})
            </button>
            <button onClick={onClose} className="hover:bg-slate-700 text-white p-2.5 rounded-full transition-colors ml-2 bg-slate-800">
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* MAPPED SPOOLER */}
        <div id="printable-statement-spooler" className="flex flex-col items-center gap-8 print:gap-0 print:block w-full shrink-0" style={{ fontFamily: CJK_FONT }}>
          {pages.map((pageItems, pageIndex) => {
            const isLastPage = pageIndex === pages.length - 1;
            
            return (
              <div key={pageIndex} className="a4-statement-page w-[210mm] h-[297mm] bg-white p-[15mm] text-black shadow-2xl rounded-2xl print:rounded-none print:shadow-none box-border flex flex-col justify-between shrink-0" style={{ fontFamily: CJK_FONT }}>
                
                {/* HEADER */}
                <div className="w-full shrink-0">
                  <div className="flex justify-between items-start mb-4 border-b-2 border-black pb-4">
                    <div className="w-[20%]">
                      <img src={logo} className="w-[90px] h-auto object-contain" alt="Logo" />
                    </div>

                    <div className="w-[60%] text-center leading-tight pt-1">
                      <h1 className="font-black text-[16px] tracking-tight mb-1" style={{ fontFamily: CJK_FONT }}>THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
                      <h2 className="font-bold text-[14px] mb-1" style={{ fontFamily: CJK_FONT }}>三叶（新加坡） 贸易公司</h2>
                      <p className="font-bold text-[10px] mb-0.5 tracking-tight">CO.REG NO.53033969B &nbsp;&nbsp;&nbsp; GST REG NO. M90355440L</p>
                      <p className="text-[10px] mb-0.5 tracking-tight">280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
                      <p className="text-[10px] tracking-tight">HP: 97578869 (Mr Ye) &nbsp; HP: 91113505 (Min) &nbsp; Email: 3leaves.sg@gmail.com</p>
                    </div>

                    <div className="w-[20%] flex flex-col items-end pt-1">
                      <div className="text-center w-full mb-1">
                        <h2 className="text-[20px] font-black tracking-[0.2em] leading-none mb-1" style={{ fontFamily: CJK_FONT }}>结账单</h2>
                        <h3 className="text-[13px] font-bold tracking-widest uppercase">STATEMENT</h3>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-end mb-3 font-bold text-[13px] leading-tight">
                    <div className="w-[70%] pr-4">
                      <div className="flex items-end mb-1.5">
                        <span className="w-10 shrink-0 text-slate-500 font-bold text-[12px]">TO:</span>
                        <span className="flex-1 uppercase border-b border-black pb-0.5 font-black text-[15px]" style={{ fontFamily: CJK_FONT }}>
                          {customer?.name}
                        </span>
                      </div>
                      <div className="flex items-end">
                        <span className="w-20 shrink-0 text-slate-500 font-bold text-[12px]">ADDRESS:</span>
                        <span className="flex-1 uppercase border-b border-black pb-0.5 text-[12px] truncate" style={{ fontFamily: CJK_FONT }}>
                          {customer?.address || '-'}
                        </span>
                      </div>
                    </div>
                    <div className="w-[30%] pl-4 flex flex-col items-end justify-end">
                      <div className="flex items-end mb-1.5 w-full justify-end">
                        <span className="shrink-0 text-slate-500 font-bold text-[12px] mr-2">STMT MONTH:</span>
                        <span className="w-28 text-center border-b border-black pb-0.5 font-black text-[14px]">
                          {monthStr}
                        </span>
                      </div>
                      <div className="flex items-end w-full justify-end">
                        <span className="shrink-0 text-slate-500 font-bold text-[12px] mr-2">TERMS:</span>
                        <span className="w-28 text-center border-b border-black pb-0.5 font-bold text-[13px] uppercase">
                          {customer?.payment_terms === 'cod' ? 'C.O.D' : '30 DAYS'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BODY / TABLE */}
                <div className="w-full flex-1 flex flex-col justify-start overflow-hidden my-2">
                  <table className="w-full text-[14px] border-collapse" style={{ fontFamily: CJK_FONT }}>
                    <thead className="border-b-2 border-black bg-slate-50 shrink-0">
                      <tr className="font-black text-slate-900 h-[32px] border-y-2 border-black">
                        <th className="py-1 px-3 w-40 text-center">DATE</th>
                        <th className="py-1 px-3 text-center">INVOICE NO.</th>
                        <th className="py-1 px-6 w-48 text-left">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody style={{ fontFamily: CJK_FONT }}>
                      {pageItems.map((inv, idx) => (
                        <tr key={idx} className="h-[28px] align-middle text-black overflow-hidden" style={{ fontFamily: CJK_FONT }}>
                          <td className="py-0 px-3 text-center font-bold text-[14px]">{inv.date ? new Date(inv.date).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}</td>
                          <td className="py-0 px-3 text-center font-bold text-[14px] text-black">#{inv.number}</td>
                          <td className="py-0 px-6 text-left font-black text-[15px]">${formatMoney(inv.total)}</td>
                        </tr>
                      ))}

                      {/* Padding rows */}
                      {pageItems.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - pageItems.length }).map((_, i) => (
                        <tr key={`blank-${i}`} className="h-[28px] align-middle">
                          <td></td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Grand Total Row (Only on the last page) */}
                      {isLastPage && (
                        <tr className="h-[36px] align-middle bg-slate-100 border-t-2 border-b-2 border-black">
                          <td colSpan="2" className="py-0 px-4 text-right font-black text-[15px] tracking-widest uppercase">
                            TOTAL AMOUNT DUE:
                          </td>
                          <td className="py-0 px-6 text-left font-black text-[18px] text-black">
                            ${formatMoney(totalAmount)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* FOOTER */}
                <div className="w-full pt-3 border-t-2 border-black text-[12px] font-bold text-slate-800 shrink-0 flex justify-between items-end mt-1 leading-tight">
                  <div className="w-[70%] pr-4">
                    <p className="text-[12px] mb-1">请提前一天提交订单,同日送达的截止时间为下午12点前。每周日休息</p>
                    <p className="text-[11px] mb-3 text-slate-600">Please submit orders one day in advance. The cut-off time for same-day delivery is before 12 PM. Closed on Sundays.</p>
                    
                    <div className="flex items-center">
                      <div className="w-[75px] h-[75px] shrink-0 mr-4 border border-slate-200 p-1 rounded bg-white">
                        <img src={paynowQr} alt="PayNow QR Code" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex flex-col justify-center text-[11px] space-y-0.5">
                        <p>UEN: <span className="font-black">53033969B</span></p>
                        <p>A/C Name: <span className="font-black">Three Leaves (Singapore) Trading Enterprise</span></p>
                        <p>A/C Number: <span className="font-black">535-846562-001</span></p>
                        <p>Bank Name: <span className="font-black">OCBC</span></p>
                        <p className="mt-1 font-normal text-[10px] text-slate-600">All payments must be made payable to Three Leaves (Singapore) Trading Enterprise.</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-[30%] flex flex-col justify-end items-end pb-1 pl-2">
                    <div className="text-[10px] font-black tracking-widest text-slate-400 mb-8">
                      PAGE {pageIndex + 1} OF {pages.length}
                    </div>
                    <div className="w-40 border-t-2 border-black text-center pt-1.5 text-[12px] font-bold uppercase tracking-widest">
                      Received By
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================
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

  // FIXED: Changed from toggle to dropdown selection handler
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
            #print-ui { display: block !important; position: static !important; width: 100% !important; opacity: 1 !important; z-index: auto !important; }
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

      {/* ========================================================================= */}
      {/* EXCLUSIVE PRINT UI (RE-FORMATTED WITH NEW BORDER SPECIFICATIONS) */}
      {/* ========================================================================= */}
      <div id="print-ui" className={isZipping ? "absolute left-[-9999px] top-0 opacity-100 z-[-100] block" : "hidden"}>
        {statementsToPrint.map((data, index) => {
          // CHUNKING: Split the customer's invoices into pages of exactly 22 invoices each
          const ITEMS_PER_PAGE = 22;
          const pages = [];
          for (let i = 0; i < data.invoices.length; i += ITEMS_PER_PAGE) {
            pages.push(data.invoices.slice(i, i + ITEMS_PER_PAGE));
          }
          if (pages.length === 0) pages.push([]);

          return (
            <div key={data.customer?.id || index} className="customer-print-wrapper">
              {pages.map((pageItems, pageIndex) => {
                const isLastPage = pageIndex === pages.length - 1;

                return (
                  <div key={pageIndex} className="page-break w-[210mm] min-h-[297mm] bg-white p-[15mm] text-black flex flex-col mx-auto box-border relative" style={{ fontFamily: CJK_FONT }}>
                    
                    {/* Header Section */}
                    <div className="flex w-full mb-6 justify-between shrink-0">
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

                        <div className="flex justify-between items-end w-full text-[14px] font-bold">
                          <div className="flex items-end flex-1 pr-4">
                            <span className="shrink-0 mr-2 text-black">ADDRESS:</span>
                            <span className="flex-1 uppercase border-b border-black pb-0.5 whitespace-nowrap text-[12px] tracking-tighter" style={{ fontFamily: CJK_FONT }}>{data.customer?.address || ''}</span>
                          </div>
                          <div className="flex items-end w-[40%] pl-2">
                            <span className="shrink-0 mr-2 text-black">TERMS:</span>
                            <span className="flex-1 text-center border-b border-black pb-0.5 uppercase text-[13px]">
                              {data.customer?.payment_terms === 'cod' ? 'C.O.D' : '30 DAYS'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="w-[180px] shrink-0 flex flex-col items-start pl-4 pt-1">
                        <h2 className="text-[22px] font-bold tracking-[0.4em] leading-none mb-1" style={{ fontFamily: CJK_FONT }}>结账单</h2>
                        <h3 className="text-[15px] font-black tracking-wide uppercase mb-6 text-black">STATEMENT</h3>
                      </div>
                    </div>

                    {/* Formatted Table Section without Grid Borders */}
                    <div className="w-full flex-1 flex flex-col justify-start overflow-hidden">
                      <table className="w-full text-[15px] text-center mb-0 border-collapse" style={{ fontFamily: CJK_FONT }}>
                        <thead>
                          <tr className="font-bold text-[14px] border-y-2 border-black">
                            <th className="py-2 px-3 text-center w-24">NO.</th>
                            <th className="py-2 px-3 text-center w-40">DATE</th>
                            <th className="py-2 px-3 text-center">INVOICE NO.</th>
                            <th className="py-2 px-3 text-right w-56 pr-5">AMOUNT</th>
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
                                <td className="p-1 text-right pr-5 font-bold text-black">${formatMoney(billed)}</td>
                              </tr>
                            );
                          })}
                          
                          {/* Padding Empty Rows to anchor the layout */}
                          {pageItems.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - pageItems.length }).map((_, i) => (
                            <tr key={`blank-${i}`} className="h-[28px] align-middle">
                              <td></td>
                              <td></td>
                              <td></td>
                              <td></td>
                            </tr>
                          ))}

                          {/* Beautifully Integrated Total Row (Final Page Only) */}
                          {isLastPage && data.previousOutstanding > 0 ? (
                            <>
                              <tr className="h-[28px] align-middle border-t-2 border-black">
                                <td colSpan="3" className="py-1 px-4 text-right font-bold text-[13px] tracking-wide">THIS MONTH TOTAL:</td>
                                <td className="py-1 text-right pr-5 font-bold text-[14px]">${formatMoney(data.totalBilled)}</td>
                              </tr>
                              <tr className="h-[28px] align-middle">
                                <td colSpan="3" className="py-1 px-4 text-right font-bold text-[13px] text-slate-600 tracking-wide">PREV. OUTSTANDING:</td>
                                <td className="py-1 text-right pr-5 font-bold text-[14px] text-slate-600">${formatMoney(data.previousOutstanding)}</td>
                              </tr>
                              <tr className="h-[40px] align-middle border-y-2 border-black">
                                <td colSpan="3" className="py-2 px-4 text-right font-black text-[16px] text-red-600 tracking-widest uppercase">OVERALL TOTAL DUE:</td>
                                <td className="py-2 text-right pr-5 font-black text-[18px] text-red-600">${formatMoney(data.overallDue)}</td>
                              </tr>
                            </>
                          ) : isLastPage ? (
                            <tr className="h-[40px] align-middle border-y-2 border-black">
                              <td colSpan="3" className="py-2 px-4 text-right font-black text-[16px] tracking-widest uppercase">TOTAL AMOUNT DUE:</td>
                              <td className="py-2 text-right pr-5 font-black text-[18px] text-red-600">${formatMoney(data.totalBilled)}</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Section */}
                    <div className="flex w-full mt-2 pt-3 items-end shrink-0 relative">
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
  );
}
