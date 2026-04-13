function InvoicePreview({
  customer,
  gst,
  invoiceNumber,
  items,
  onBack,
  onRegister,
  paymentTerms,
  subtotal,
  sys,
  total,
}) {
  return (
    <div className="fixed inset-0 z-[3000] overflow-y-auto bg-slate-950/90 print:bg-white print:p-0">
      <div className="flex min-h-full justify-center py-12 print:py-0">
        <div className="relative w-full max-w-[210mm] bg-white px-6 py-6 shadow-2xl print:shadow-none print:p-4 font-sans text-black">

          {/* ACTION BAR */}
          <div className="absolute -top-16 left-0 right-0 flex justify-between print:hidden">
            <button
              onClick={onBack}
              className="bg-slate-800 text-white px-5 py-2 rounded-xl font-bold"
            >
              Edit
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => onRegister(false)}
                className="bg-white border px-5 py-2 rounded-xl font-bold"
              >
                Save
              </button>
              <button
                onClick={() => onRegister(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold"
              >
                Print
              </button>
            </div>
          </div>

          {/* PRINT AREA */}
          <div className="text-[11px] leading-[1.05] tracking-tight">

            {/* HEADER */}
            <div className="text-center mb-2">
              <h1 className="font-bold text-[11px]">
                THREE LEAVES (SINGAPORE) TRADING ENTERPRISE
              </h1>
              <p className="text-[9px] font-bold">
                CO.REG NO.53033969B &nbsp;&nbsp; GST REG NO. M90355440L
              </p>
              <p className="text-[9px]">
                280 Woodlands Industrial Park E5 #06-35 Harvest @ Singapore 757322
              </p>
              <p className="text-[9px] font-bold">
                HP: 97578869 &nbsp; HP: 91113505 &nbsp; Email: 3leaves.sg@gmail.com
              </p>
            </div>

            {/* TO / DATE / TERM */}
            <div className="flex justify-between font-bold text-[10px] mb-1">
              <div>TO: {customer?.name || ''}</div>
              <div>DATE: {new Date().toLocaleDateString('en-GB')}</div>
              <div>TERM: {paymentTerms === '30_days' ? '30 Days' : 'COD'}</div>
            </div>

            <div className="font-bold text-[10px] mb-2">
              ADDRESS: {customer?.address || ''}
            </div>

            {/* TABLE */}
            <table className="w-full text-[11px] border-t border-b border-black">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="w-8">NO</th>
                  <th>DESCRIPTION</th>
                  <th className="w-20 text-center">QTY</th>
                  <th className="w-6"></th>
                  <th className="w-24 text-right">UNIT PRICE</th>
                  <th className="w-24 text-right">AMOUNT</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, idx) => {
                  const found = sys.inventory.find(p => p.id === item.itemId);
                  const name = found ? (found.name || found.Items) : '-';

                  const amount =
                    (Number(item.qty) || 0) *
                    (Number(item.unitPrice) || 0);

                  return (
                    <tr key={idx} className="h-[18px]">
                      <td>{idx + 1}</td>
                      <td className="font-bold">{name}</td>
                      <td className="text-center">
                        {item.qty} {item.unit}
                      </td>
                      <td className="text-center">☐</td>
                      <td className="text-right">
                        ${formatMoney(item.unitPrice)}
                      </td>
                      <td className="text-right">
                        ${formatMoney(amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* TOTALS */}
            <div className="flex justify-end mt-2">
              <div className="w-48 text-[11px] font-bold">
                <div className="flex justify-between">
                  <span>SUBTOTAL</span>
                  <span>${formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>9% GST</span>
                  <span>${formatMoney(gst)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span>TOTAL</span>
                  <span>${formatMoney(total)}</span>
                </div>
              </div>
            </div>

            {/* NOTES */}
            <div className="mt-3 text-[9px] leading-tight font-bold">
              <p>
                请提前一天提交订单，同日送达的截止时间为下午12点前。每周日休息
              </p>
              <p>
                Please submit orders one day in advance. The cut-off time for
                same-day delivery is before 12 PM. Closed on Sundays.
              </p>
            </div>

            {/* BANK DETAILS */}
            <div className="mt-2 text-[9px] leading-tight">
              <p>UEN: 53033969B</p>
              <p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p>
              <p>A/C Number: 535-846562-001</p>
              <p>Bank Name: OCBC</p>
            </div>

            {/* FOOTER */}
            <div className="flex justify-between items-end mt-4">
              <p className="text-[9px] font-bold">
                All payments must be made payable to Three Leaves (Singapore)
                Trading Enterprise.
              </p>

              <div className="w-40 border-t border-black text-center text-[10px] font-bold pt-1">
                Received By
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
