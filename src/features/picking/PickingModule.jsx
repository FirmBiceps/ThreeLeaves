import { useMemo, useState } from 'react';
import { ClipboardList, Printer, Calendar, PackageCheck, Search, ChevronRight } from 'lucide-react';
import logo from '../invoices/three_leaves_logo.png'; // Re-using your existing logo

const CJK_FONT = '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

export function PickingModule({ sys }) {
  // Default to today's date
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  const safeInvoices = Array.isArray(sys?.invoices) ? sys.invoices : [];
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];

  // ==========================================
  // AGGREGATION ENGINE: Products -> Customers
  // ==========================================
  const picklistData = useMemo(() => {
    // 1. Get all invoices for the selected date
    const targetInvoices = safeInvoices.filter(inv => inv.date === selectedDate);
    const productMap = {};
    let totalItemsToPick = 0;

    // 2. Extract items and group them
    targetInvoices.forEach(inv => {
      const customerName = inv.customer || 'Unknown Customer';
      
      (Array.isArray(inv.items) ? inv.items : []).forEach(item => {
        const productId = item.itemId || item.name; // Fallback to name if no ID
        if (!productId) return;

        // Initialize product entry if it doesn't exist
        if (!productMap[productId]) {
          const inventoryData = safeInventory.find(i => i.id === item.itemId);
          productMap[productId] = {
            id: productId,
            name: inventoryData ? String(inventoryData.Name || inventoryData.name || inventoryData.Items) : String(item.name || item.Items || 'Unknown Product'),
            unit: String(item.unit || inventoryData?.Unit || inventoryData?.unit || '箱'),
            totalQty: 0,
            customers: {}
          };
        }

        const qty = Number(item.qty || item.quantity) || 0;
        
        // Add to total
        productMap[productId].totalQty += qty;
        totalItemsToPick += qty;
        
        // Add to customer breakdown
        productMap[productId].customers[customerName] = (productMap[productId].customers[customerName] || 0) + qty;
      });
    });

    // 3. Convert to array and format the breakdown for easy rendering
    let dataArray = Object.values(productMap).map(prod => ({
      ...prod,
      breakdown: Object.entries(prod.customers)
        .map(([cName, cQty]) => ({ cName, cQty }))
        .sort((a, b) => b.cQty - a.cQty) // Sort breakdown by highest qty first
    }));

    // 4. Sort alphabetically by product name
    dataArray.sort((a, b) => a.name.localeCompare(b.name));

    // 5. Apply screen search filter (Optional, for UI only)
    let displayArray = dataArray;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      displayArray = dataArray.filter(prod => 
        prod.name.toLowerCase().includes(lowerSearch) || 
        prod.breakdown.some(b => b.cName.toLowerCase().includes(lowerSearch))
      );
    }

    return {
      date: selectedDate,
      invoiceCount: targetInvoices.length,
      totalUniqueProducts: dataArray.length,
      totalItemsToPick,
      allData: dataArray,
      displayData: displayArray
    };
  }, [safeInvoices, safeInventory, selectedDate, searchTerm]);

  // Handle Print
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  };

  const formattedDate = useMemo(() => {
    if (!selectedDate) return '';
    const dateObj = new Date(selectedDate);
    return isNaN(dateObj.getTime()) ? selectedDate : dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [selectedDate]);

  return (
    <div className="p-8 h-full overflow-y-auto relative bg-slate-50/50">
      
      {/* IMAGE PRELOADER FOR PDF LOGO */}
      <div className="absolute opacity-0 w-0 h-0 overflow-hidden pointer-events-none">
        <img src={logo} alt="preload logo" />
      </div>

      {/* INJECTED PRINT STYLES */}
      <style type="text/css">
        {`
          @media print {
            @page { size: A4; margin: 10mm; }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            #screen-ui { display: none !important; }
            #print-ui { 
              display: block !important; 
              position: relative !important; 
            }
            /* Prevent rows from breaking cleanly across pages */
            tr { page-break-inside: avoid; break-inside: avoid; }
            td, th { page-break-inside: avoid; break-inside: avoid; }
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
              <ClipboardList className="mr-3 text-blue-600" size={28} />
              Daily Fulfillment Picklist
            </h1>
            <p className="text-base text-slate-500 mt-1">
              Consolidate product picking totals and view customer box allocations.
            </p>
          </div>
          
          <button
            className="flex items-center rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
            onClick={handlePrint}
            disabled={picklistData.allData.length === 0}
            type="button"
          >
            <Printer className="mr-2" size={18} /> Print A4 Picklist
          </button>
        </div>

        {/* METRICS DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Orders Processing</p>
            <p className="text-3xl font-black text-slate-800">{picklistData.invoiceCount} <span className="text-sm font-medium text-slate-400">invoices</span></p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Unique Products</p>
            <p className="text-3xl font-black text-blue-600">{picklistData.totalUniqueProducts} <span className="text-sm font-medium text-slate-400">SKUs to pull</span></p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Physical Units</p>
            <p className="text-3xl font-black text-emerald-600">{picklistData.totalItemsToPick} <span className="text-sm font-medium text-slate-400">items total</span></p>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-100 bg-slate-50 p-4 gap-4">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-100">
              <Calendar className="text-slate-400 mr-2" size={18} />
              <input
                type="date"
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none cursor-pointer"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm w-full sm:w-80 focus-within:ring-2 focus-within:ring-blue-100">
              <Search className="text-slate-400 mr-2" size={18} />
              <input
                type="text"
                placeholder="Search products or customers..."
                className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* ON-SCREEN TABLE */}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                <th className="p-5 pl-8 w-16 text-center">Done</th>
                <th className="p-5">Product Details</th>
                <th className="p-5 text-center">Total Required</th>
                <th className="p-5 pr-8">Allocation Breakdown (Customer)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {picklistData.displayData.map((row, idx) => (
                <tr className="hover:bg-blue-50/30 transition-colors" key={row.id || idx}>
                  <td className="p-5 pl-8 text-center align-top">
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-1" />
                  </td>
                  <td className="p-5 align-top">
                    <p className="font-bold text-slate-900 text-base">{row.name}</p>
                  </td>
                  <td className="p-5 align-top text-center">
                    <span className="inline-flex flex-col items-center bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
                      <span className="text-2xl font-black text-blue-700 leading-none">{row.totalQty}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mt-1">{row.unit}</span>
                    </span>
                  </td>
                  <td className="p-5 pr-8 align-top">
                    <ul className="space-y-1.5">
                      {row.breakdown.map((b, i) => (
                        <li key={i} className="flex items-center text-sm">
                          <ChevronRight size={14} className="text-slate-300 mr-2 shrink-0" />
                          <span className="font-medium text-slate-700 flex-1">{b.cName}</span>
                          <span className="font-black text-slate-900 ml-4 px-2 py-0.5 bg-slate-100 rounded text-xs">{b.cQty} {row.unit}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
              {picklistData.displayData.length === 0 && (
                <tr>
                  <td className="p-12 text-center text-sm font-bold text-slate-400" colSpan="4">
                    No orders found for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT UI (Hidden on screen, styled cleanly for A4 PDF Output) */}
      {/* ========================================================================= */}
      <div id="print-ui" className={isPrinting ? "block" : "hidden"}>
        <div className="w-full bg-white text-black font-sans" style={{ fontFamily: CJK_FONT }}>
          
          {/* HEADER MATCHING THE INVOICE AESTHETIC */}
          <div className="flex w-full mb-6 justify-between items-start border-b-2 border-black pb-4">
            <div className="flex items-center">
              <div className="w-[90px] shrink-0 mr-4">
                <img src={logo} alt="Three Leaves Logo" className="w-full h-auto object-contain" />
              </div>
              <div className="text-left leading-snug">
                <h1 className="font-black text-[18px] tracking-wide" style={{ fontFamily: CJK_FONT }}>THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
                <h2 className="font-bold text-[14px] text-slate-700" style={{ fontFamily: CJK_FONT }}>三叶（新加坡） 贸易公司</h2>
              </div>
            </div>
            <div className="text-right flex flex-col items-end pt-1">
              <h2 className="text-[24px] font-black tracking-widest leading-none mb-2" style={{ fontFamily: CJK_FONT }}>拣货单</h2>
              <h3 className="text-[14px] font-black tracking-widest uppercase text-slate-500 mb-1">DAILY PICKLIST</h3>
              <p className="text-[14px] font-bold bg-slate-100 px-3 py-1 border border-black rounded-md">{formattedDate}</p>
            </div>
          </div>

          <div className="flex justify-between items-end mb-4 text-[12px] font-bold">
            <div>
              TOTAL ORDERS: <span className="text-blue-600 text-[14px]">{picklistData.invoiceCount}</span>
            </div>
            <div>
              TOTAL PHYSICAL ITEMS TO PULL: <span className="text-red-600 text-[16px]">{picklistData.totalItemsToPick}</span>
            </div>
          </div>

          {/* TABLE AREA - BORDERLESS INTERIOR MATCHING INVOICE */}
          <table className="w-full text-[14px] border-2 border-black text-left mb-0" style={{ fontFamily: CJK_FONT }}>
            <thead className="border-b-2 border-black">
              <tr className="font-bold bg-slate-50 text-[12px]">
                <th className="py-2 px-2 w-12 text-center border-r border-black/20">DONE</th>
                <th className="py-2 px-3 text-left">PRODUCT DESCRIPTION</th>
                <th className="py-2 px-3 w-32 text-center bg-blue-50/50">TOTAL QTY</th>
                <th className="py-2 px-3 w-[45%] text-left">CUSTOMER ALLOCATION BREAKDOWN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/20" style={{ fontFamily: CJK_FONT }}>
              {picklistData.allData.map((row, idx) => (
                <tr key={idx} className="align-top py-2">
                  <td className="px-2 py-3 text-center border-r border-black/20">
                    <div className="w-5 h-5 border-2 border-slate-400 rounded mx-auto mt-0.5"></div>
                  </td>
                  <td className="px-3 py-3 text-left font-bold text-[15px]" style={{ fontFamily: CJK_FONT }}>
                    {row.name}
                  </td>
                  <td className="px-3 py-3 text-center bg-blue-50/30" style={{ fontFamily: CJK_FONT }}>
                    <span className="font-black text-[18px]">{row.totalQty}</span>
                    <span className="text-[12px] ml-1 text-slate-600">{row.unit}</span>
                  </td>
                  <td className="px-3 py-2 text-left">
                    <ul className="space-y-1.5 mt-1">
                      {row.breakdown.map((b, i) => (
                        <li key={i} className="flex items-start text-[13px] leading-tight break-inside-avoid">
                          <span className="font-black text-slate-800 w-12 shrink-0">{b.cQty} {row.unit}</span>
                          <span className="font-medium text-slate-700 ml-2">➜ {b.cName}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
              {picklistData.allData.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-400 font-bold">No items to pick for this date.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* FOOTER */}
          <div className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            End of Picklist • Generated by Three Leaves ERP
          </div>

        </div>
      </div>
    </div>
  );
}
