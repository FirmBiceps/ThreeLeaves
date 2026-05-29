import { useMemo, useState, useEffect, useRef } from 'react';
import { FileText, Printer, Search, X, Calendar, User, ChevronRight } from 'lucide-react';
import { formatMoney } from '../../utils/format';
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
                        <span className="shrink-0 text-slate-500 font-bold text-[12px] mr-2">DATE ISSUED:</span>
                        <span className="w-28 text-center border-b border-black pb-0.5 font-bold text-[13px]">
                          {today}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BODY / TABLE */}
                <div className="w-full flex-1 flex flex-col justify-start overflow-hidden my-2">
                  <table className="w-full border-2 border-black text-[14px] border-collapse" style={{ fontFamily: CJK_FONT }}>
                    <thead className="border-b-2 border-black bg-slate-50 shrink-0">
                      <tr className="font-black text-slate-900 h-[32px]">
                        <th className="py-1 px-3 w-40 border-r border-black text-center">DATE</th>
                        <th className="py-1 px-3 border-r border-black text-center">INVOICE NO.</th>
                        <th className="py-1 px-6 w-48 text-left">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black" style={{ fontFamily: CJK_FONT }}>
                      {pageItems.map((inv, idx) => (
                        <tr key={idx} className="h-[28px] align-middle text-black overflow-hidden" style={{ fontFamily: CJK_FONT }}>
                          <td className="py-0 px-3 border-r border-black text-center font-bold text-[14px]">{inv.date ? new Date(inv.date).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}</td>
                          <td className="py-0 px-3 border-r border-black text-center font-bold text-[14px] text-black">#{inv.number}</td>
                          <td className="py-0 px-6 text-left font-black text-[15px]">${formatMoney(inv.total)}</td>
                        </tr>
                      ))}

                      {/* Padding rows */}
                      {pageItems.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - pageItems.length }).map((_, i) => (
                        <tr key={`blank-${i}`} className="h-[28px] align-middle">
                          <td className="py-0 border-r border-black"></td>
                          <td className="py-0 border-r border-black"></td>
                          <td className="py-0"></td>
                        </tr>
                      ))}

                      {/* Grand Total Row (Only on the last page) */}
                      {isLastPage && (
                        <tr className="h-[36px] align-middle bg-slate-100 border-t-2 border-black">
                          <td colSpan="2" className="py-0 px-4 border-r border-black text-right font-black text-[15px] tracking-widest uppercase">
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
  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];
  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [showPreview, setShowPreview] = useState(false);

  // Filter invoices for the selected customer and month
  const statementInvoices = useMemo(() => {
    if (!selectedCustomerId || !selectedMonth) return [];
    
    const [yearStr, monthStr] = selectedMonth.split('-');
    const targetYear = parseInt(yearStr, 10);
    const targetMonth = parseInt(monthStr, 10);

    return safeInvoices.filter(inv => {
      if (inv.customerId !== selectedCustomerId) return false;
      if (inv.status === 'Void') return false; 
      
      const invDate = new Date(inv.date);
      if (isNaN(invDate.getTime())) return false;
      
      return invDate.getFullYear() === targetYear && (invDate.getMonth() + 1) === targetMonth;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [safeInvoices, selectedCustomerId, selectedMonth]);

  const selectedCustomer = safeCustomers.find(c => c.id === selectedCustomerId);
  const totalDue = statementInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

  // Format month for display (e.g., "MAY 2026")
  const displayMonthStr = useMemo(() => {
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  }, [selectedMonth]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between rounded-t-xl border-b border-gray-100 bg-gray-50 p-5">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Account Statements</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">Generate monthly billing statements for individual accounts.</p>
        </div>
      </div>

      {/* Control Panel */}
      <div className="p-6 border-b border-slate-100 bg-white shrink-0">
        <div className="flex space-x-6">
          <div className="flex-1">
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Select Customer</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-3 text-slate-400" />
              <select 
                className="w-full border border-slate-200 bg-slate-50 rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer appearance-none"
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
              >
                <option value="">-- Choose Account --</option>
                {safeCustomers.sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="w-48">
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Billing Month</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
              <input 
                type="month" 
                className="w-full border border-slate-200 bg-slate-50 rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              />
            </div>
          </div>

          <div className="w-48 flex items-end">
            <button 
              disabled={!selectedCustomerId || statementInvoices.length === 0}
              onClick={() => setShowPreview(true)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center text-sm"
            >
              <FileText size={18} className="mr-2" /> Generate PDF
            </button>
          </div>
        </div>
      </div>

      {/* Results Overview */}
      <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
        {!selectedCustomerId ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <FileText size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">Select an account to view statement</p>
          </div>
        ) : statementInvoices.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <p className="text-sm font-bold uppercase tracking-widest">No invoices found for {displayMonthStr}</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 p-4 px-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">{selectedCustomer?.name}</h3>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Billing Period: {displayMonthStr}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total Amount Due</p>
                  <p className="text-2xl font-black text-indigo-400">${formatMoneyWhole(totalDue)}</p>
                </div>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="p-4 pl-6">Date</th>
                    <th className="p-4">Invoice No.</th>
                    <th className="p-4 text-right pr-6">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statementInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 pl-6 text-sm font-bold text-slate-700">
                        {new Date(inv.date).toLocaleDateString('en-GB').replace(/\//g, '-')}
                      </td>
                      <td className="p-4 text-sm font-bold text-indigo-600">#{inv.number}</td>
                      <td className="p-4 pr-6 text-right text-sm font-black text-slate-900">${formatMoney(inv.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showPreview && selectedCustomer && (
        <StatementPreviewModal 
          customer={selectedCustomer}
          monthStr={displayMonthStr}
          invoices={statementInvoices}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
