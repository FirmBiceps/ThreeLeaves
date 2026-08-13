import { useMemo } from 'react';
import {
  ChevronLeft,
  Edit,
  Eye,
  FileText,
  Printer,
  Save,
  X,
} from 'lucide-react';
import { formatMoney } from '../../utils/format';
import logo from './three_leaves_logo.png';
import paynowQr from './paynow_qr.jpg';

const CJK_FONT =
  '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "SimHei", "黑体", "SimSun", "宋体", serif';

const ITEMS_PER_PAGE = 30;

function splitIntoPages(items, pageSize) {
  const pages = [];

  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }

  return pages.length > 0 ? pages : [[]];
}

function getPageDensity(itemCount, isSpecialFormat, isLastPage) {
  /*
   * A continuation page does not contain totals, remarks, PayNow details,
   * or the signature footer. It therefore has considerably more vertical
   * space available than the final page. Use that space to make the first
   * 30 products larger and more comfortable instead of leaving a large gap.
   */
  if (!isLastPage && itemCount <= ITEMS_PER_PAGE) {
    /*
     * Continuation pages have no payment footer, but they still need a safe
     * bottom boundary for the continuation note and page number. Keep the
     * rows only slightly larger than the final-page 25–30 item setting.
     */
    return {
      tableText: isSpecialFormat
        ? 'text-[11.5px] leading-[1.16]'
        : 'text-[13px] leading-[1.22]',
      cellPad: isSpecialFormat ? 'py-[1px]' : 'py-[2px]',
      headerText: 'text-[12px]',
      headerPad: 'py-1.5',
      totalText: 'text-[16px]',
      subtotalText: 'text-[14px]',
      gstText: 'text-[13px]',
      spacerRow: 'h-full',
    };
  }

  // Preserve the original formatting for invoices with up to 20 products.
  if (itemCount <= 14) {
    return {
      tableText: isSpecialFormat ? 'text-[14px]' : 'text-[15px]',
      cellPad: isSpecialFormat ? 'py-1.5' : 'py-1',
      headerText: 'text-[14px]',
      headerPad: 'py-2',
      totalText: 'text-[17px]',
      subtotalText: 'text-[15px]',
      gstText: 'text-[14px]',
      spacerRow: 'h-full',
    };
  }

  if (itemCount <= 20) {
    return {
      tableText: isSpecialFormat
        ? 'text-[12px] leading-tight'
        : 'text-[14px] leading-tight',
      cellPad: 'py-0.5',
      headerText: 'text-[14px]',
      headerPad: 'py-2',
      totalText: 'text-[16px]',
      subtotalText: 'text-[14px]',
      gstText: 'text-[13px]',
      spacerRow: 'h-full',
    };
  }

  if (itemCount <= 24) {
    /*
     * 21–24 items still share the final page with remarks, totals, PayNow
     * details and the Received By signature area. The previous layout made
     * these rows LARGER than the 25–30 item layout (py-[3px]), which could
     * push the footer below the A4 boundary around 22 items.
     *
     * Keep this range comfortably readable, but compact enough to guarantee
     * footer space.
     */
    return {
      tableText: isSpecialFormat
        ? 'text-[11.5px] leading-[1.15]'
        : 'text-[13px] leading-[1.2]',
      cellPad: 'py-[1px]',
      headerText: 'text-[12px]',
      headerPad: 'py-1.5',
      totalText: 'text-[16px]',
      subtotalText: 'text-[14px]',
      gstText: 'text-[13px]',
      spacerRow: 'h-[8px]',
    };
  }

  // 25–30 products: compact, with only a minimal spacer before totals.
  return {
    tableText: isSpecialFormat
      ? 'text-[11.5px] leading-[1.15]'
      : 'text-[13px] leading-[1.2]',
    cellPad: 'py-[1px]',
    headerText: 'text-[12px]',
    headerPad: 'py-1.5',
    totalText: 'text-[16px]',
    subtotalText: 'text-[14px]',
    gstText: 'text-[13px]',
    spacerRow: 'h-[4px]',
  };
}

function formatInvoiceDate(invoiceDate) {
  if (invoiceDate && !Number.isNaN(new Date(invoiceDate).getTime())) {
    return new Date(invoiceDate)
      .toLocaleDateString('en-GB')
      .replace(/\//g, '-');
  }

  return new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
}

function InvoiceHeader({
  isSpecialFormat,
  invoiceNumber,
  invoiceDate,
  paymentTerms,
  poNumber,
  customer,
  existingInvoice,
  customerAddress,
}) {
  if (isSpecialFormat) {
    return (
      <div className="w-full shrink-0">
        <div className="mb-3 flex w-full shrink-0 items-start justify-between border-b-2 border-slate-800 pb-4">
          <div className="flex w-[55%] flex-col gap-2 pr-4">
            <img
              src={logo}
              className="h-auto w-[100px] object-contain"
              alt="Logo"
            />

            <div className="leading-snug">
              <h1
                className="text-[16px] font-black uppercase tracking-tight"
                style={{ fontFamily: CJK_FONT }}
              >
                Three Leaves (Singapore) Trading Enterprise
              </h1>
              <h2
                className="mb-1 text-[14px] font-bold"
                style={{ fontFamily: CJK_FONT }}
              >
                三叶（新加坡） 贸易公司
              </h2>
              <div className="text-[9px] font-bold leading-tight tracking-tight text-[#d55e2d]">
                <p>CO.REG NO.53033969B &nbsp;|&nbsp; GST REG NO. M90355440L</p>
                <p>280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322</p>
                <p>HP: 97578869 (Mr Ye) &nbsp;|&nbsp; HP: 91113505 (Min) &nbsp;|&nbsp; 3leaves.sg@gmail.com</p>
              </div>
            </div>
          </div>

          <div className="flex w-[45%] flex-col items-end pl-4 text-right">
            <img
              src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(
                String(invoiceNumber || '')
              )}&scale=3&height=10&includetext=true&textxalign=center`}
              alt="Barcode"
              className="mb-3 h-[60px] w-auto max-w-full object-contain"
            />
            <h2
              className="mb-1 text-[20px] font-black leading-none tracking-[0.3em]"
              style={{ fontFamily: CJK_FONT }}
            >
              發票
            </h2>
            <h3 className="mb-3 text-[14px] font-black uppercase tracking-widest text-black">
              TAX INVOICE
            </h3>

            <table className="w-full max-w-[200px] text-right text-[12px] font-bold text-slate-800">
              <tbody>
                <tr>
                  <td className="w-[40%] pb-1 text-left text-slate-500">NO:</td>
                  <td className="pb-1 text-[14px] font-black text-red-600">
                    {invoiceNumber}
                  </td>
                </tr>
                <tr>
                  <td className="pb-1 text-left text-slate-500">TERM:</td>
                  <td className="pb-1">
                    {paymentTerms === 'cod' ? 'COD' : '30 Days'}
                  </td>
                </tr>
                {poNumber && (
                  <tr>
                    <td className="text-left text-slate-500">PO NO:</td>
                    <td>{poNumber}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-3 flex shrink-0 items-end justify-between text-[12px] font-bold">
          <div className="w-[65%] leading-relaxed">
            <div className="flex items-start">
              <span className="w-[45px] shrink-0 text-slate-500">TO:</span>
              <span className="flex-1 border-b border-slate-800 pb-0.5 uppercase">
                {String(customer?.name || existingInvoice?.customer || '')}
              </span>
            </div>
            <div className="mt-1 flex items-start">
              <span className="w-[45px] shrink-0 text-slate-500">ADD:</span>
              <span className="flex-1 truncate border-b border-slate-800 pb-0.5 uppercase">
                {String(customerAddress)}
              </span>
            </div>
          </div>

          <div className="flex w-[30%] items-end">
            <span className="w-[45px] shrink-0 text-slate-500">DATE:</span>
            <span className="flex-1 border-b border-slate-800 pb-0.5 text-right">
              {formatInvoiceDate(invoiceDate)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full shrink-0">
      <div className="mb-4 flex w-full shrink-0 justify-between">
        <div className="flex flex-1 flex-col pr-4">
          <div className="mb-5 flex items-start justify-between">
            <div className="flex items-center">
              <div className="mr-4 w-[110px] shrink-0">
                <img
                  src={logo}
                  alt="Three Leaves Logo"
                  className="h-auto w-full object-contain"
                />
              </div>

              <div className="flex-1 overflow-visible whitespace-nowrap pt-2 text-left leading-snug">
                <h1
                  className="text-[17px] font-black"
                  style={{ fontFamily: CJK_FONT }}
                >
                  THREE LEAVES (SINGAPORE) TRADING ENTERPRISE
                </h1>
                <h2
                  className="mb-1 text-[16px] font-bold"
                  style={{ fontFamily: CJK_FONT }}
                >
                  三叶（新加坡） 贸易公司
                </h2>
                <div className="text-[10.5px] font-bold leading-tight tracking-tight text-[#d55e2d]">
                  <p className="whitespace-nowrap">
                    CO.REG NO.53033969B &nbsp;&nbsp; GST REG NO. M90355440L
                  </p>
                  <p className="whitespace-nowrap">
                    280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322
                  </p>
                  <p className="whitespace-nowrap">
                    HP: 97578869 (Mr Ye) &nbsp;&nbsp; HP: 91113505 (Min) &nbsp;&nbsp; Email: 3leaves.sg@gmail.com
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-2 flex w-full items-end justify-between text-[14px] font-bold">
            <div className="flex flex-1 items-end pr-4">
              <span className="mr-2 shrink-0 text-black">TO:</span>
              <span
                className="flex-1 whitespace-nowrap border-b border-black pb-0.5 text-[13px] uppercase tracking-tight"
                style={{ fontFamily: CJK_FONT }}
              >
                {String(customer?.name || existingInvoice?.customer || '')}
              </span>
            </div>

            <div className="flex w-[35%] items-end pl-2">
              <span className="mr-2 shrink-0 text-black">DATE:</span>
              <span className="flex-1 border-b border-black pb-0.5 text-center">
                {formatInvoiceDate(invoiceDate)}
              </span>
            </div>
          </div>

          <div className="flex w-full items-end text-[14px] font-bold">
            <span className="mr-2 shrink-0 text-black">ADDRESS:</span>
            <span
              className="flex-1 whitespace-nowrap border-b border-black pb-0.5 text-[12px] uppercase tracking-tighter"
              style={{ fontFamily: CJK_FONT }}
            >
              {String(customerAddress)}
            </span>
          </div>
        </div>

        <div className="flex w-[180px] shrink-0 flex-col items-start pl-4 pt-1">
          <h2
            className="mb-1 text-[22px] font-bold leading-none tracking-[0.4em]"
            style={{ fontFamily: CJK_FONT }}
          >
            發票
          </h2>
          <h3 className="mb-2 text-[15px] font-black uppercase tracking-wide text-black">
            TAX INVOICE
          </h3>

          <div className="mb-2 mt-auto flex w-full flex-col gap-3">
            <div className="flex items-baseline">
              <span className="w-[50px] shrink-0 text-[15px] font-bold text-black">
                No.
              </span>
              <span className="text-[17px] font-bold leading-none tracking-wider text-red-600">
                {String(invoiceNumber)}
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="w-[50px] shrink-0 text-[15px] font-bold text-black">
                Term:
              </span>
              <span className="text-[16px] font-bold leading-none text-red-600">
                {paymentTerms === 'cod' ? 'COD' : '30 Days'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceFooter() {
  return (
    <div className="mt-3 flex w-full shrink-0 items-end pt-1">
      <div className="w-[70%] pr-4 text-[12px] font-bold leading-snug">
        <div style={{ fontFamily: CJK_FONT }}>
          <p className="text-[12px]">
            请提前一天提交订单,同日送达的截止时间为下午12点前。每周日休息
          </p>
          <p className="whitespace-nowrap text-[10px] text-slate-800">
            Please submit orders one day in advance. The cut-off time for same-day delivery is before 12 PM. Closed on Sundays.
          </p>

          <div className="mt-2 flex items-center">
            <div className="mr-3 flex h-[72px] w-[72px] shrink-0 items-center justify-center">
              <img
                src={paynowQr}
                alt="PayNow QR Code"
                className="h-[72px] w-[72px] object-contain"
              />
            </div>

            <div className="flex flex-col justify-center text-[11px]">
              <p>UEN: 53033969B</p>
              <p>A/C Name: Three Leaves (Singapore) Trading Enterprise</p>
              <p>A/C Number: 535-846562-001</p>
              <p>Bank Name: OCBC</p>
              <p className="mt-0.5 text-[10px] font-normal text-slate-800">
                All payments must be made payable to Three Leaves (Singapore) Trading Enterprise.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-[30%] shrink-0 flex-col justify-end pb-1 pl-2">
        <div className="h-12" />
        <div className="border-t-2 border-black pt-1.5 text-center text-[12px] font-bold uppercase tracking-widest">
          Received By
        </div>
      </div>
    </div>
  );
}

export function InvoicePreview({
  mode = 'generator',
  customer,
  gst,
  invoiceNumber,
  invoiceDate,
  items,
  remarks,
  onBack,
  onRegister,
  onPrint,
  onEdit,
  onClose,
  paymentTerms,
  subtotal,
  sys,
  total,
  existingInvoice,
  isSpecialFormat,
  poNumber,
  carPlateNo,
}) {
  const customerAddress = customer?.address || existingInvoice?.address || '';
  const safeInventory = Array.isArray(sys?.inventory) ? sys.inventory : [];
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  const itemPages = useMemo(
    () => splitIntoPages(safeItems, ITEMS_PER_PAGE),
    [safeItems]
  );

  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto bg-slate-950/90 print:static print:block print:bg-white print:p-0 print:backdrop-filter-none">
      <style type="text/css">
        {`
          #printable-invoice-wrapper {
            width: 100%;
          }

          .invoice-print-page {
            position: relative;
            display: flex;
            width: 210mm;
            height: 297mm;
            flex-direction: column;
            box-sizing: border-box;
            background: white;
            padding: 15mm 10mm;
          }

          .invoice-footer-safe {
            /*
             * Do not clip the PayNow / Received By footer. The old
             * max-height: 39mm + overflow: hidden combination could cut off
             * the signature text when the product table became taller.
             */
            flex: 0 0 auto;
            min-height: 0;
            overflow: visible;
          }

          .invoice-page-number {
            position: absolute;
            right: 10mm;
            bottom: 5mm;
            font-size: 9px;
            font-weight: 700;
          }

          @media print {
            @page { size: A4; margin: 0 !important; }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body * {
              visibility: hidden !important;
            }

            #printable-invoice-wrapper,
            #printable-invoice-wrapper * {
              visibility: visible !important;
            }

            #printable-invoice-wrapper {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 210mm !important;
              height: auto !important;
              padding: 0 !important;
              margin: 0 !important;
              background: white !important;
              box-sizing: border-box !important;
            }

            .invoice-print-page {
              width: 210mm !important;
              height: 297mm !important;
              min-height: 297mm !important;
              padding: 15mm 10mm !important;
              margin: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              page-break-after: always !important;
              break-after: page !important;
              overflow: hidden !important;
            }

            .invoice-print-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }

            *, html, body, div, p, span, h1, h2, h3, table, th, td {
              font-family: ${CJK_FONT} !important;
            }

            tr, td, th {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        `}
      </style>

      <div className="flex min-h-full flex-col items-center py-12 print:m-0 print:block print:py-0">
        <div className="flex w-full max-w-[210mm] shrink-0 items-center justify-between rounded-t-2xl border-b-4 border-blue-600 bg-slate-900 px-8 py-4 text-white shadow-2xl print:hidden">
          <div className="flex items-center">
            {mode === 'generator' ? (
              <Eye size={24} className="mr-3 text-blue-400" />
            ) : (
              <FileText size={24} className="mr-3 text-blue-400" />
            )}

            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-200">
                {mode === 'generator'
                  ? 'Invoice Layout Check'
                  : 'A4 Print Preview'}
              </h2>
              <p className="mt-0.5 text-lg font-bold leading-none text-white">
                #{String(invoiceNumber)}
              </p>
              {itemPages.length > 1 && (
                <p className="mt-1 text-xs font-semibold text-blue-300">
                  {itemPages.length} print pages · maximum {ITEMS_PER_PAGE} items per page
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {mode === 'generator' ? (
              <>
                <button
                  className="flex items-center rounded border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-700"
                  onClick={onBack}
                  type="button"
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Edit Draft
                </button>
                <button
                  className="flex items-center rounded bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition-all hover:bg-slate-50"
                  onClick={() => onRegister(false)}
                  type="button"
                >
                  <Save className="mr-2" size={16} />
                  Save Invoice
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onPrint}
                  className="flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold shadow-lg transition-colors hover:bg-blue-500"
                  type="button"
                >
                  <Printer size={18} className="mr-2" />
                  Print
                </button>
                <button
                  onClick={onEdit}
                  className="flex items-center rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-bold transition-colors hover:bg-slate-700"
                  type="button"
                >
                  <Edit size={16} className="mr-2" />
                  Edit
                </button>
                <button
                  onClick={onClose}
                  className="ml-2 rounded-full bg-slate-800 p-2.5 transition-colors hover:bg-slate-700"
                  type="button"
                >
                  <X size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        <div
          id="printable-invoice-wrapper"
          lang="zh"
          className="flex w-full flex-col items-center gap-8 print:block print:gap-0"
          style={{ fontFamily: CJK_FONT }}
        >
          {itemPages.map((pageItems, pageIndex) => {
            const isLastPage = pageIndex === itemPages.length - 1;
            const density = getPageDensity(
              pageItems.filter((item) => {
                const name = String(
                  item?.name ||
                    item?.Items ||
                    item?.rawSearchString ||
                    ''
                ).trim();
                return name !== '' && name !== '-';
              }).length,
              Boolean(isSpecialFormat),
              isLastPage
            );

            return (
              <div
                key={`invoice-page-${pageIndex}`}
                className="invoice-print-page rounded-b-2xl shadow-2xl print:rounded-none print:shadow-none"
                style={{ fontFamily: CJK_FONT }}
              >
                <InvoiceHeader
                  isSpecialFormat={Boolean(isSpecialFormat)}
                  invoiceNumber={invoiceNumber}
                  invoiceDate={invoiceDate}
                  paymentTerms={paymentTerms}
                  poNumber={poNumber}
                  customer={customer}
                  existingInvoice={existingInvoice}
                  customerAddress={customerAddress}
                />

                <table
                  className={`mt-2 min-h-0 w-full flex-grow border-2 border-black text-center ${density.tableText} ${
                    isLastPage ? 'mb-0' : 'mb-[9mm]'
                  }`}
                  style={{ fontFamily: CJK_FONT }}
                >
                  <thead className="border-b-2 border-black">
                    <tr className={`bg-white font-bold ${density.headerText}`}>
                      <th className={`${density.headerPad} w-12 px-1 text-center`}>
                        NO.
                      </th>
                      <th className={`${density.headerPad} px-2 text-left`}>
                        DESCRIPTION
                      </th>
                      <th className={`${density.headerPad} w-24 px-1 text-center`}>
                        QUANTITY
                      </th>
                      <th className={`${density.headerPad} w-32 px-1 text-center`}>
                        UNIT PRICE
                      </th>
                      <th className={`${density.headerPad} w-32 px-1 text-center`}>
                        AMOUNT
                      </th>
                    </tr>
                  </thead>

                  <tbody style={{ fontFamily: CJK_FONT }}>
                    {pageItems.map((item, itemIndex) => {
                      const globalIndex =
                        pageIndex * ITEMS_PER_PAGE + itemIndex;
                      const foundProduct = safeInventory.find(
                        (entry) => entry?.id === item?.itemId
                      );
                      const productName = foundProduct
                        ? String(
                            foundProduct.Name ||
                              foundProduct.name ||
                              foundProduct.Items ||
                              ''
                          )
                        : String(
                            item?.name ||
                              item?.Items ||
                              item?.rawSearchString ||
                              ''
                          ).trim();
                      const isBlank =
                        productName === '' || productName === '-';

                      return (
                        <tr
                          key={`${item?.itemId || 'item'}-${globalIndex}`}
                          className="align-middle text-slate-900"
                          style={{ fontFamily: CJK_FONT }}
                        >
                          <td
                            className={`px-1 text-center align-middle font-normal ${density.cellPad}`}
                          >
                            {globalIndex + 1}
                          </td>
                          <td
                            className={`px-1 pl-2 text-left align-middle font-normal ${density.cellPad}`}
                            style={{ fontFamily: CJK_FONT }}
                          >
                            {!isBlank ? (
                              <span className="block whitespace-nowrap">
                                ☐ {productName}
                              </span>
                            ) : (
                              <div className="select-none text-transparent">☐</div>
                            )}
                          </td>
                          <td
                            className={`px-1 text-center align-middle font-normal ${density.cellPad}`}
                            style={{ fontFamily: CJK_FONT }}
                          >
                            {String(item?.qty || item?.quantity || 0)}{' '}
                            {String(item?.unit || '')}
                          </td>
                          <td
                            className={`px-1 text-center align-middle font-normal ${density.cellPad}`}
                          >
                            ${formatMoney(item?.unitPrice)}
                          </td>
                          <td
                            className={`px-1 text-center align-middle font-normal ${density.cellPad}`}
                          >
                            $
                            {formatMoney(
                              (Number(item?.qty || item?.quantity) || 0) *
                                (Number(item?.unitPrice) || 0)
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    <tr className={density.spacerRow || 'h-full'}>
                      <td />
                      <td className="py-4 text-center align-middle">
                        {isSpecialFormat && carPlateNo && isLastPage && (
                          <div className="inline-block text-slate-900">
                            <span className="text-[14px] font-bold">
                              Car Plate No:{' '}
                            </span>
                            <span className="text-[16px] font-black">
                              {carPlateNo}
                            </span>
                          </div>
                        )}
                      </td>
                      <td />
                      <td />
                      <td />
                    </tr>

                    {isLastPage ? (
                      <>
                        <tr className="h-[28px] border-t-2 border-black font-bold">
                          {!isSpecialFormat ? (
                            <td
                              colSpan="3"
                              className="border-r-2 border-black bg-white px-2 py-1 text-left align-middle text-[12px] font-bold text-slate-800"
                            >
                              Remarks:
                            </td>
                          ) : (
                            <td
                              colSpan="3"
                              rowSpan="3"
                              className="border-r-2 border-black bg-white p-2 text-left align-top"
                            />
                          )}
                          <td
                            className={`bg-white p-1 text-center ${density.gstText}`}
                          >
                            SUBTOTAL
                          </td>
                          <td
                            className={`bg-white p-1 text-center ${density.subtotalText}`}
                          >
                            ${formatMoney(subtotal)}
                          </td>
                        </tr>

                        <tr className="h-[28px] border-t border-black bg-white font-bold">
                          {!isSpecialFormat && (
                            <td
                              colSpan="3"
                              rowSpan="2"
                              className="border-r-2 border-black bg-white px-2 py-1 text-left align-top"
                            >
                              <div
                                className="max-h-[44px] w-full overflow-hidden whitespace-pre-wrap break-words text-[11px] font-normal leading-tight text-slate-800"
                                style={{ fontFamily: CJK_FONT }}
                              >
                                {remarks}
                              </div>
                            </td>
                          )}
                          <td
                            className={`p-1 text-center ${density.gstText}`}
                          >
                            9% GST
                          </td>
                          <td
                            className={`p-1 text-center ${density.subtotalText}`}
                          >
                            ${formatMoney(gst)}
                          </td>
                        </tr>

                        <tr className="h-[32px] border-t-2 border-black bg-white font-bold">
                          <td className="p-1 text-center text-[16px]">TOTAL</td>
                          <td
                            className={`p-1 text-center ${density.totalText}`}
                          >
                            ${formatMoney(total)}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr className="h-[34px] border-t-2 border-black bg-white">
                        <td
                          colSpan="5"
                          className="px-3 py-1.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500"
                        >
                          Continued on page {pageIndex + 2}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {isLastPage && <div className="invoice-footer-safe"><InvoiceFooter /></div>}

                <div className="invoice-page-number">
                  Page {pageIndex + 1} of {itemPages.length}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function InvoicePreviewModal({ invoice, onClose, onEdit, sys }) {
  if (!invoice) return null;

  const safeCustomers = Array.isArray(sys?.customers) ? sys.customers : [];
  const customerObj =
    safeCustomers.find((customer) => customer?.id === invoice?.customerId) || {};
  const customerAddress = String(customerObj?.address || '');
  const safeInvoiceItems = Array.isArray(invoice?.items)
    ? invoice.items.filter(Boolean)
    : [];
  const subtotal = safeInvoiceItems.reduce(
    (sum, item) =>
      sum +
      (Number(item?.qty || item?.quantity) || 0) *
        (Number(item?.unitPrice) || 0),
    0
  );
  const gst = subtotal * 0.09;

  return (
    <InvoicePreview
      mode="history"
      customer={{
        name: invoice.customer,
        address: customerAddress,
      }}
      gst={gst}
      invoiceNumber={invoice.number || invoice.id}
      invoiceDate={invoice.date}
      items={safeInvoiceItems}
      remarks={invoice.remarks}
      onPrint={() => window.print()}
      onEdit={() => onEdit(invoice)}
      onClose={onClose}
      paymentTerms={invoice.paymentTerms}
      subtotal={subtotal}
      sys={sys}
      total={subtotal + gst}
      isSpecialFormat={invoice.isSpecialFormat}
      poNumber={invoice.poNumber}
      carPlateNo={invoice.carPlateNo}
    />
  );
}
