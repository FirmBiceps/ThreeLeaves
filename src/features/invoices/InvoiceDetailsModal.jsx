import { useState } from 'react';
import { Printer, Edit, X, Truck, AlertTriangle, CheckCircle } from 'lucide-react';
// Import the same logo you used for the generator!
import logo from '../../public/three_leaves_logo.png'; 
import { formatMoney } from '../../utils/format';

export function InvoiceDetailsModal({ invoice, sys, onClose, onEdit }) {
  const [deliveryStatus, setDeliveryStatus] = useState(invoice.deliveryStatus || 'Pending');

  // Function to save the new delivery status to your Supabase cloud
  const handleStatusChange = (newStatus) => {
    setDeliveryStatus(newStatus);
    
    // Update the local state
    const updatedInvoices = sys.invoices.map(inv => 
      inv.id === invoice.id ? { ...inv, deliveryStatus: newStatus } : inv
    );
    sys.setInvoices(updatedInvoices);
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-950/90 p-4 print:p-0 print:bg-white">
      
      {/* THE FIX: Aggressively prioritize Chinese fonts first to force the print spooler to load them, and remove browser margins */}
      <style type="text/css">
        {`
          @media print {
            @page {
              margin: 0; 
            }
            body {
              margin: 1cm;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            *, html, body, div, p, span, h1, h2, h3, table, th, td {
              font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", "SimHei", "黑体", Arial, sans-serif !important;
            }
          }
        `}
      </style>

      {/* 1. CONTROL PANEL (Hidden during printing) */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 print:hidden">
        
        {/* Status Dropdown */}
        <div className="bg-white p-2 rounded-xl flex items-center shadow-xl">
          <Truck size={18} className="text-slate-500 mr-2 ml-2" />
          <select 
            value={deliveryStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="font-bold text-sm border-none focus:ring-0 cursor-pointer"
          >
            <option value="Pending">🚚 Pending Delivery</option>
            <option value="Delivered">✅ Fully Delivered</option>
            <option value="Partial">⚠️ Partial / Mispicked</option>
          </select>
        </div>

        {/* Action Buttons */}
        <button 
          onClick={triggerPrint}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold flex items-center shadow-xl transition-all"
        >
          <Printer size={18} className="mr-2" /> View PDF / Print
        </button>

        <button 
          onClick={() => {
            onClose(); // Close this view
            onEdit(invoice); // Open the InvoiceGenerator with this data!
          }}
          className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-xl font-bold flex items-center shadow-xl transition-all"
        >
          <Edit size={18} className="mr-2" /> Edit Invoice
        </button>

        <button onClick={onClose} className="bg-red-500 hover:bg-red-400 text-white p-2 px-4 rounded-xl shadow-xl transition-all">
          <X size={20} />
        </button>
      </div>

      {/* 2. THE PDF PREVIEW (Exact same Excel design we built earlier) */}
      <div 
        className="bg-white w-full max-w-[210mm] min-h-[297mm] p-12 shadow-2xl print:w-full print:shadow-none print:p-0 mt-16 print:mt-0 flex flex-col"
        style={{ fontFamily: '"Microsoft YaHei", "微软雅黑", "PingFang SC", "SimHei", "黑体", Arial, sans-serif' }}
      >
        
        {/* If there's an issue, show a watermark on screen (hides on print) */}
        {deliveryStatus === 'Partial' && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 opacity-10 pointer-events-none print:hidden">
            <span className="text-8xl font-black text-red-600 border-8 border-red-600 p-8 rounded-3xl">PARTIAL</span>
          </div>
        )}

        <div className="flex justify-between items-start mb-6">
          <div className="w-1/4">
            <img src={logo} alt="Three Leaves Logo" className="w-32 h-auto object-contain" />
          </div>

          <div className="w-2/4 text-center text-[11px] leading-tight pt-2">
            <h1 className="font-bold text-lg mb-1">THREE LEAVES (SINGAPORE) TRADING ENTERPRISE</h1>
            <h2 className="font-bold text-base mb-1">三叶（新加坡） 贸易公司</h2>
            <p className="font-bold">CO.REG NO.53033969B &nbsp;&nbsp;&nbsp; GST REG NO. M90355440L</p>
            <p>280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
            <p className="font-bold">HP: 97578869 (Mr Ye) &nbsp; HP: 91113505 (Min) &nbsp; Email: 3leaves.sg@gmail.com</p>
          </div>

          <div className="w-1/4 flex flex-col items-end pt-2">
            <div className="w-full text-right">
              <h2 className="text-xl font-bold tracking-widest uppercase">INVOICE</h2>
              <div className="border-t-2 border-b-2 border-black py-1 my-1 flex justify-end gap-2">
                <span className="font-bold text-sm">No.</span>
                <span className="font-bold text-sm text-red-600">{invoice.number}</span>
              </div>
              <div className="flex justify-end gap-2 font-bold text-xs">
                <span>DATE:</span>
                <span>{invoice.date.replace(/-/g, '/')}</span>
              </div>
              <div className="flex justify-end gap-2 font-bold text-xs mt-1">
                <span>Term:</span>
                <span>{invoice.paymentTerms === 'cod' ? 'COD' : '30 Days'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm font-bold flex flex-col gap-1">
          <div className="flex">
            <span className="w-20">TO:</span>
            <span className="border-b border-black flex-1 uppercase pb-1">{invoice.customer}</span>
          </div>
        </div>

        <table className="w-full text-sm border-2 border-black text-center mb-0">
          <thead className="border-b-2 border-black">
            <tr className="font-bold bg-white">
              <th className="p-2 w-12">NO.</th>
              <th className="p-2 text-left">DESCRIPTION</th>
              <th className="p-2 w-24">QUANTITY</th>
              <th className="p-2 w-32">UNIT PRICE</th>
              <th className="p-2 w-32">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr key={idx} className="h-7 align-top">
                <td className="p-1">{idx + 1}</td>
                <td className="p-1 text-left">{item.name}</td>
                <td className="p-1">{item.qty} {item.unit}</td>
                <td className="p-1 text-right">${formatMoney(item.unitPrice)}</td>
                <td className="p-1 text-right pr-2">
                  ${formatMoney((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}
                </td>
              </tr>
            ))}
            {invoice.items.length < 15 && Array.from({ length: 15 - invoice.items.length }).map((_, i) => (
              <tr key={`blank-${i}`} className="h-7">
                <td className="p-1"></td><td className="p-1"></td><td className="p-1"></td><td className="p-1"></td><td className="p-1"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-0">
          <table className="w-64 text-sm border-2 border-t-0 border-black text-right bg-white">
            <tbody>
              <tr>
                <td className="p-2 font-bold text-center">SUBTOTAL</td>
                <td className="p-2 w-32 pr-2">${formatMoney(invoice.total / 1.09)}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold text-center">9% GST</td>
                <td className="p-2 pr-2">${formatMoney((invoice.total / 1.09) * 0.09)}</td>
              </tr>
              <tr className="border-t-2 border-black">
                <td className="p-2 font-bold text-center">TOTAL</td>
                <td className="p-2 font-bold pr-2">${formatMoney(invoice.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-8 text-[11px] font-bold flex flex-col gap-1 mt-auto pb-4">
          <p>请提前一天提交订单，同日送达的截止时间为下午12点前。每周日休息</p>
          <p>Please submit orders one day in advance. The cut-off time for same-day delivery is before 12 PM. Closed on Sundays</p>
          <p className="mt-2">UEN: 53033969B</p>
          <p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p>
        </div>

      </div>
    </div>
  );
}
