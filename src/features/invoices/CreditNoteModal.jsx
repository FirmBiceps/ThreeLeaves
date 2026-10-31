import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Download,
  FileMinus,
  Loader2,
  RefreshCcw,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { formatMoney } from '../../utils/format';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const DEFAULT_GST_RATE = 0.09;

const toCents = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(Number(number.toFixed(2)) * 100);
};

const getItemQty = (item) => Number(item?.qty ?? item?.quantity ?? 0) || 0;
const getItemPrice = (item) => Number(item?.unitPrice ?? item?.price ?? 0) || 0;
const getItemGstRate = (item) => {
  const raw = item?.gstRate ?? item?.gst_rate ?? item?.taxRate ?? item?.tax_rate;
  const rate = Number(raw);
  if (!Number.isFinite(rate)) return DEFAULT_GST_RATE;
  return rate > 1 ? rate / 100 : Math.max(0, rate);
};

const money = (cents) => Number(cents || 0) / 100;

function createCreditNoteNumber() {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();

  return `CN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomPart}`;
}

function formatPdfDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB').replace(/\//g, '-');
}

function settlementLabel(type) {
  if (type === 'customer_credit') return 'Customer Credit';
  if (type === 'refund') return 'Refund';
  return 'Invoice Adjustment';
}

export function CreditNoteModal({ invoice, onClose, onSaved }) {
  const [previousRows, setPreviousRows] = useState([]);
  const [existingNotes, setExistingNotes] = useState([]);
  const [customerCreditBalance, setCustomerCreditBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingNoteId, setWorkingNoteId] = useState(null);
  const [error, setError] = useState(null);
  const [reason, setReason] = useState('Customer return');
  const [remarks, setRemarks] = useState('');
  const [quantities, setQuantities] = useState({});
  const [settlementMethod, setSettlementMethod] = useState('invoice_adjustment');
  const [creditAmount, setCreditAmount] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('Bank transfer');
  const [refundReference, setRefundReference] = useState('');

  const items = useMemo(
    () => (Array.isArray(invoice?.items) ? invoice.items.filter(Boolean) : []),
    [invoice]
  );

  const loadHistory = async () => {
    if (!invoice?.id) return;

    setLoading(true);
    setError(null);

    try {
      const [{ data: itemData, error: itemError }, { data: noteData, error: noteError }] = await Promise.all([
        supabase
          .from('credit_note_items')
          .select('invoice_item_index, returned_qty, credit_note_id, credit_notes!inner(status)')
          .eq('invoice_id', String(invoice.id))
          .eq('credit_notes.status', 'issued'),
        supabase
          .from('credit_notes')
          .select('*, credit_note_items(*) , credit_note_settlements(*)')
          .eq('invoice_id', String(invoice.id))
          .order('credit_note_date', { ascending: false }),
      ]);

      if (itemError) throw itemError;
      if (noteError) throw noteError;

      setPreviousRows(Array.isArray(itemData) ? itemData : []);
      setExistingNotes(Array.isArray(noteData) ? noteData : []);

      if (invoice?.customerId) {
        const { data: ledger, error: ledgerError } = await supabase
          .from('customer_credit_ledger')
          .select('amount')
          .eq('customer_id', String(invoice.customerId));

        if (ledgerError) throw ledgerError;
        const balance = (Array.isArray(ledger) ? ledger : []).reduce(
          (sum, row) => sum + Number(row?.amount || 0),
          0
        );
        setCustomerCreditBalance(Math.max(0, Number(balance.toFixed(2))));
      } else {
        setCustomerCreditBalance(0);
      }
    } catch (queryError) {
      setError(queryError?.message || 'Unable to load credit note history.');
      setPreviousRows([]);
      setExistingNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [invoice?.id, invoice?.customerId]);

  const returnedByIndex = useMemo(() => {
    const map = new Map();

    previousRows.forEach((row) => {
      const index = Number(row?.invoice_item_index);
      const qty = Number(row?.returned_qty) || 0;
      if (!Number.isInteger(index) || qty <= 0) return;
      map.set(index, (map.get(index) || 0) + qty);
    });

    return map;
  }, [previousRows]);

  const rows = useMemo(
    () =>
      items.map((item, index) => {
        const originalQty = getItemQty(item);
        const alreadyReturned = returnedByIndex.get(index) || 0;
        const remainingQty = Math.max(0, originalQty - alreadyReturned);
        const requestedQty = Math.min(
          Math.max(0, Number(quantities[index] ?? 0) || 0),
          remainingQty
        );
        const unitPrice = getItemPrice(item);
        const gstRate = getItemGstRate(item);
        const lineExGstCents = toCents(requestedQty * unitPrice);
        const lineGstCents = Math.round(lineExGstCents * gstRate);

        return {
          index,
          item,
          originalQty,
          alreadyReturned,
          remainingQty,
          requestedQty,
          unitPrice,
          gstRate,
          lineExGstCents,
          lineGstCents,
          lineTotalCents: lineExGstCents + lineGstCents,
        };
      }),
    [items, quantities, returnedByIndex]
  );

  const totalExGstCents = rows.reduce((sum, row) => sum + row.lineExGstCents, 0);
  const totalGstCents = rows.reduce((sum, row) => sum + row.lineGstCents, 0);
  const totalCents = totalExGstCents + totalGstCents;
  const hasReturn = totalCents > 0;

  const splitCreditCents = toCents(creditAmount);
  const splitRefundCents = toCents(refundAmount);
  const splitInvoiceCents = Math.max(0, totalCents - splitCreditCents - splitRefundCents);
  const splitValid = splitCreditCents + splitRefundCents <= totalCents;

  const settlementPreview = useMemo(() => {
    if (!hasReturn) return [];

    if (settlementMethod === 'customer_credit') {
      return [{ type: 'customer_credit', amount: totalCents }];
    }
    if (settlementMethod === 'refund') {
      return [{ type: 'refund', amount: totalCents }];
    }
    if (settlementMethod === 'split') {
      const result = [];
      if (splitInvoiceCents > 0) result.push({ type: 'invoice_adjustment', amount: splitInvoiceCents });
      if (splitCreditCents > 0) result.push({ type: 'customer_credit', amount: splitCreditCents });
      if (splitRefundCents > 0) result.push({ type: 'refund', amount: splitRefundCents });
      return result;
    }
    return [{ type: 'invoice_adjustment', amount: totalCents }];
  }, [hasReturn, settlementMethod, totalCents, splitInvoiceCents, splitCreditCents, splitRefundCents]);

  const setQty = (index, value) => {
    const numeric = Math.max(0, Number(value) || 0);
    const row = rows.find((entry) => entry.index === index);
    const capped = row ? Math.min(numeric, row.remainingQty) : numeric;

    setQuantities((current) => ({ ...current, [index]: capped }));
  };

  const issueSettlements = async (creditNoteId, settlementRows, customerId) => {
    if (!settlementRows.length) return;

    const payload = settlementRows.map((entry) => ({
      credit_note_id: creditNoteId,
      customer_id: customerId ? String(customerId) : null,
      settlement_type: entry.type,
      amount: money(entry.amount),
      status: entry.type === 'refund' ? 'pending' : 'completed',
      payment_method: entry.type === 'refund' ? refundMethod : null,
      reference: entry.type === 'refund' ? refundReference.trim() || null : null,
      processed_date: null,
      remarks: null,
    }));

    const { error: settlementError } = await supabase
      .from('credit_note_settlements')
      .insert(payload);

    if (settlementError) throw settlementError;

    const creditSettlement = settlementRows.find((entry) => entry.type === 'customer_credit');
    if (creditSettlement && customerId) {
      const { error: ledgerError } = await supabase
        .from('customer_credit_ledger')
        .insert({
          customer_id: String(customerId),
          customer_name: String(invoice.customer || ''),
          credit_note_id: creditNoteId,
          entry_type: 'credit',
          amount: money(creditSettlement.amount),
          reference: `Credit note ${invoice.number || invoice.id}`,
          remarks: remarks.trim() || 'Customer credit from returned goods',
        });

      if (ledgerError) throw ledgerError;
    }
  };

  const handleSave = async () => {
    if (!invoice?.id || !hasReturn || saving) return;
    if (settlementMethod === 'split' && !splitValid) {
      setError('The split settlement cannot exceed the credit note total.');
      return;
    }
    if (settlementMethod === 'customer_credit' && !invoice?.customerId) {
      setError('This invoice has no customer ID, so a customer credit balance cannot be created.');
      return;
    }

    setSaving(true);
    setError(null);

    let createdNoteId = null;

    try {
      const selectedRows = rows.filter((row) => row.requestedQty > 0);
      const noteNumber = createCreditNoteNumber();
      const hasPendingRefund = settlementPreview.some((entry) => entry.type === 'refund');
      const settlementStatus = hasPendingRefund ? 'pending' : 'settled';

      const { data: note, error: noteError } = await supabase
        .from('credit_notes')
        .insert({
          credit_note_number: noteNumber,
          invoice_id: String(invoice.id),
          invoice_number: String(invoice.number || invoice.id),
          customer_id: invoice.customerId || null,
          customer_name: String(invoice.customer || ''),
          credit_note_date: new Date().toISOString().slice(0, 10),
          reason,
          remarks: remarks.trim() || null,
          subtotal_ex_gst: money(totalExGstCents),
          gst_amount: money(totalGstCents),
          total_amount: money(totalCents),
          settlement_method: settlementMethod,
          settlement_status: settlementStatus,
          status: 'issued',
        })
        .select('id, credit_note_number')
        .single();

      if (noteError) throw noteError;
      createdNoteId = note.id;

      const itemPayload = selectedRows.map((row) => ({
        credit_note_id: note.id,
        invoice_id: String(invoice.id),
        invoice_item_index: row.index,
        product_id: row.item?.itemId || row.item?.productId || null,
        product_name: String(row.item?.name || row.item?.productName || 'Item'),
        original_qty: row.originalQty,
        returned_qty: row.requestedQty,
        unit_price: row.unitPrice,
        gst_rate: row.gstRate,
        amount_ex_gst: money(row.lineExGstCents),
        gst_amount: money(row.lineGstCents),
        total_amount: money(row.lineTotalCents),
      }));

      const { error: itemError } = await supabase
        .from('credit_note_items')
        .insert(itemPayload);

      if (itemError) throw itemError;

      await issueSettlements(note.id, settlementPreview, invoice.customerId);

      await loadHistory();
      onSaved?.({
        ...note,
        invoiceId: invoice.id,
        totalAmount: money(totalCents),
      });

      setQuantities({});
      setRemarks('');
      setCreditAmount('');
      setRefundAmount('');
      setSettlementMethod('invoice_adjustment');
    } catch (saveError) {
      if (createdNoteId) {
        // Best-effort rollback for a partially-created note.
        await supabase.from('credit_notes').delete().eq('id', createdNoteId);
      }
      setError(saveError?.message || 'Unable to save the credit note.');
    } finally {
      setSaving(false);
    }
  };

  const processRefund = async (note, settlement) => {
    const method = window.prompt(
      'Refund method (e.g. Bank transfer, PayNow, Cash):',
      settlement.payment_method || 'Bank transfer'
    );
    if (!method) return;

    const reference = window.prompt(
      'Refund reference / transaction number (optional):',
      settlement.reference || ''
    );

    setWorkingNoteId(note.id);
    setError(null);

    try {
      const { error: settlementError } = await supabase
        .from('credit_note_settlements')
        .update({
          status: 'completed',
          payment_method: method,
          reference: reference?.trim() || null,
          processed_date: new Date().toISOString().slice(0, 10),
        })
        .eq('id', settlement.id);

      if (settlementError) throw settlementError;

      const remainingPending = (note.credit_note_settlements || []).filter(
        (entry) => entry.id !== settlement.id && entry.status === 'pending'
      );

      await supabase
        .from('credit_notes')
        .update({
          settlement_status: remainingPending.length > 0 ? 'pending' : 'settled',
        })
        .eq('id', note.id);

      await loadHistory();
    } catch (refundError) {
      setError(refundError?.message || 'Unable to process the refund.');
    } finally {
      setWorkingNoteId(null);
    }
  };

  const cancelCreditNote = async (note) => {
    if (!window.confirm(`Void credit note ${note.credit_note_number}? This will restore the invoice to its pre-credit statement amount.`)) return;

    const settlements = Array.isArray(note.credit_note_settlements) ? note.credit_note_settlements : [];
    const completedRefund = settlements.find(
      (entry) => entry.settlement_type === 'refund' && entry.status === 'completed'
    );

    if (completedRefund) {
      setError('This credit note cannot be voided because its refund has already been completed.');
      return;
    }

    setWorkingNoteId(note.id);
    setError(null);

    try {
      const completedCredit = settlements.find(
        (entry) => entry.settlement_type === 'customer_credit' && entry.status === 'completed'
      );

      if (completedCredit && note.customer_id) {
        const { error: ledgerError } = await supabase
          .from('customer_credit_ledger')
          .insert({
            customer_id: String(note.customer_id),
            customer_name: String(note.customer_name || ''),
            credit_note_id: note.id,
            entry_type: 'reversal',
            amount: -Math.abs(Number(completedCredit.amount) || 0),
            reference: `Void ${note.credit_note_number}`,
            remarks: 'Reversal of customer credit following credit note cancellation',
          });

        if (ledgerError) throw ledgerError;
      }

      const { error: settlementError } = await supabase
        .from('credit_note_settlements')
        .update({ status: 'cancelled' })
        .eq('credit_note_id', note.id)
        .neq('status', 'cancelled');

      if (settlementError) throw settlementError;

      const { error: noteError } = await supabase
        .from('credit_notes')
        .update({
          status: 'void',
          settlement_status: 'settled',
          cancellation_reason: 'Cancelled by user',
          voided_at: new Date().toISOString(),
        })
        .eq('id', note.id);

      if (noteError) throw noteError;

      await loadHistory();
    } catch (cancelError) {
      setError(cancelError?.message || 'Unable to cancel the credit note.');
    } finally {
      setWorkingNoteId(null);
    }
  };

  const downloadPdf = (note) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const itemsForNote = Array.isArray(note.credit_note_items) ? note.credit_note_items : [];

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('THREE LEAVES (SINGAPORE) TRADING ENTERPRISE', 14, 17);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CO.REG NO. 53033969B  |  GST REG NO. M90355440L', 14, 23);
    doc.text('280 Woodlands Industrial Park E5 #06-35/36 Harvest @ Singapore 757322', 14, 28);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('CREDIT NOTE', pageWidth - 14, 18, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Credit Note No.: ${note.credit_note_number}`, pageWidth - 14, 24, { align: 'right' });
    doc.text(`Date: ${formatPdfDate(note.credit_note_date)}`, pageWidth - 14, 29, { align: 'right' });
    doc.text(`Original Invoice: ${note.invoice_number}`, pageWidth - 14, 34, { align: 'right' });

    doc.line(14, 37, pageWidth - 14, 37);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CUSTOMER', 14, 44);
    doc.setFont('helvetica', 'normal');
    doc.text(String(note.customer_name || invoice.customer || '-'), 14, 49);
    doc.text(`Reason: ${note.reason || 'Customer return'}`, 14, 54);
    if (note.remarks) doc.text(`Remarks: ${String(note.remarks).slice(0, 120)}`, 14, 59);

    autoTable(doc, {
      startY: 65,
      head: [['Item', 'Original Qty', 'Returned Qty', 'Unit Price', 'Ex-GST', 'GST', 'Total']],
      body: itemsForNote.map((item) => [
        item.product_name || 'Item',
        Number(item.original_qty || 0).toString(),
        Number(item.returned_qty || 0).toString(),
        `$${formatMoney(item.unit_price)}`,
        `$${formatMoney(item.amount_ex_gst)}`,
        `$${formatMoney(item.gst_amount)}`,
        `$${formatMoney(item.total_amount)}`,
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
    });

    const summaryY = (doc.lastAutoTable?.finalY || 65) + 10;
    autoTable(doc, {
      startY: summaryY,
      margin: { left: pageWidth - 88, right: 14 },
      head: [['Credit Note Summary', 'Amount']],
      body: [
        ['Value ex-GST', `$${formatMoney(note.subtotal_ex_gst)}`],
        ['GST', `$${formatMoney(note.gst_amount)}`],
        ['Credit Note Total', `$${formatMoney(note.total_amount)}`],
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
    });

    const settlementY = (doc.lastAutoTable?.finalY || summaryY) + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Settlement', 14, settlementY);
    doc.setFont('helvetica', 'normal');
    doc.text(
      (note.credit_note_settlements || [])
        .map((entry) => `${settlementLabel(entry.settlement_type)}: $${formatMoney(entry.amount)} (${entry.status})`)
        .join('  |  ') || settlementLabel(note.settlement_method),
      14,
      settlementY + 6,
      { maxWidth: pageWidth - 28 }
    );

    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('This credit note adjusts the original invoice and records the subsequent return/credit transaction.', 14, 280);
    doc.text('Generated by Three Leaves ERP', pageWidth - 14, 287, { align: 'right' });

    doc.save(`${note.credit_note_number}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-black text-slate-900">
              <FileMinus size={20} />
              Returns & Credit Notes
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Invoice #{invoice?.number || invoice?.id} · {invoice?.customer || 'Customer'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <section className="mb-6 rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-black text-slate-900">Create return / credit</h3>
              <p className="mt-1 text-xs text-slate-500">Select the returned quantities. The original invoice remains unchanged.</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm font-bold text-slate-500">
                <Loader2 size={18} className="mr-2 animate-spin" /> Loading return history…
              </div>
            ) : (
              <div className="p-5">
                <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600">Reason</span>
                    <select value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500">
                      <option>Customer return</option>
                      <option>Damaged goods</option>
                      <option>Incorrect item</option>
                      <option>Incorrect quantity</option>
                      <option>Quality issue</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600">Remarks</span>
                    <input value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional note" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none focus:border-slate-500" />
                  </label>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[820px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-600">
                        <th className="px-3 py-3">Item</th>
                        <th className="px-3 py-3 text-right">Original</th>
                        <th className="px-3 py-3 text-right">Returned</th>
                        <th className="px-3 py-3 text-right">Available</th>
                        <th className="px-3 py-3 text-right">Return Qty</th>
                        <th className="px-3 py-3 text-right">Unit Price</th>
                        <th className="px-3 py-3 text-right">GST</th>
                        <th className="px-3 py-3 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.index} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-3 py-3 font-semibold text-slate-800">{row.item?.name || row.item?.productName || 'Item'}</td>
                          <td className="px-3 py-3 text-right text-slate-600">{row.originalQty}</td>
                          <td className="px-3 py-3 text-right text-slate-500">{row.alreadyReturned}</td>
                          <td className="px-3 py-3 text-right font-bold text-slate-700">{row.remainingQty}</td>
                          <td className="px-3 py-3 text-right">
                            <input type="number" min="0" max={row.remainingQty} step="any" value={quantities[row.index] ?? ''} onChange={(event) => setQty(row.index, event.target.value)} disabled={row.remainingQty <= 0} placeholder="0" className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right font-bold outline-none focus:border-slate-500 disabled:bg-slate-100" />
                          </td>
                          <td className="px-3 py-3 text-right text-slate-700">${formatMoney(row.unitPrice)}</td>
                          <td className="px-3 py-3 text-right text-slate-600">{(row.gstRate * 100).toFixed(0)}%</td>
                          <td className="px-3 py-3 text-right font-black text-slate-900">${formatMoney(row.lineTotalCents / 100)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Settlement</h4>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        ['invoice_adjustment', 'Apply to invoice'],
                        ['customer_credit', 'Customer credit balance'],
                        ['refund', 'Refund customer'],
                        ['split', 'Split settlement'],
                      ].map(([value, label]) => (
                        <label key={value} className={`cursor-pointer rounded-lg border p-3 ${settlementMethod === value ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}>
                          <input type="radio" className="mr-2" value={value} checked={settlementMethod === value} onChange={(event) => setSettlementMethod(event.target.value)} />
                          <span className="text-xs font-bold text-slate-800">{label}</span>
                        </label>
                      ))}
                    </div>

                    {settlementMethod === 'customer_credit' && (
                      <p className="mt-3 text-xs font-semibold text-slate-500">Current customer credit balance: <strong>${formatMoney(customerCreditBalance)}</strong>. This credit note will add ${formatMoney(totalCents / 100)}.</p>
                    )}

                    {settlementMethod === 'refund' && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Refund method</span><select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"><option>Bank transfer</option><option>PayNow</option><option>Cash</option><option>Cheque</option><option>Other</option></select></label>
                        <label><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Reference</span><input value={refundReference} onChange={(e) => setRefundReference(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold" placeholder="Optional" /></label>
                      </div>
                    )}

                    {settlementMethod === 'split' && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Customer credit</span><input type="number" min="0" step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right text-xs font-bold" /></label>
                        <label><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Refund</span><input type="number" min="0" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right text-xs font-bold" /></label>
                        <label><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Refund method</span><select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"><option>Bank transfer</option><option>PayNow</option><option>Cash</option><option>Cheque</option><option>Other</option></select></label>
                        <label><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Refund reference</span><input value={refundReference} onChange={(e) => setRefundReference(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold" placeholder="Optional" /></label>
                        <p className={`sm:col-span-2 text-xs font-bold ${splitValid ? 'text-slate-500' : 'text-red-600'}`}>Invoice adjustment remainder: ${formatMoney(splitInvoiceCents)} {splitValid ? '' : '— split exceeds credit note total.'}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t-2 border-slate-900 pt-3 text-sm">
                    <div className="flex justify-between py-1 text-slate-600"><span>Return value ex-GST</span><strong>${formatMoney(totalExGstCents / 100)}</strong></div>
                    <div className="flex justify-between py-1 text-slate-600"><span>GST reversed</span><strong>${formatMoney(totalGstCents / 100)}</strong></div>
                    <div className="mt-1 flex justify-between border-t border-slate-300 pt-2 text-base font-black text-slate-900"><span>Credit Note Total</span><strong>${formatMoney(totalCents / 100)}</strong></div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Credit note history</h3>
                <p className="mt-1 text-xs text-slate-500">Issued, refunded, credited and cancelled return transactions for this invoice.</p>
              </div>
              <button type="button" onClick={loadHistory} className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><RefreshCcw size={14} className="mr-2" />Refresh</button>
            </div>

            <div className="divide-y divide-slate-100">
              {existingNotes.length === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-500">No credit notes have been issued for this invoice.</div>
              ) : existingNotes.map((note) => {
                const settlements = Array.isArray(note.credit_note_settlements) ? note.credit_note_settlements : [];
                const isVoid = note.status === 'void';
                return (
                  <div key={note.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-black text-slate-900">{note.credit_note_number}</span>
                          <span className={`rounded border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${isVoid ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{isVoid ? 'Void' : 'Issued'}</span>
                          <span className="text-xs font-semibold text-slate-500">{formatPdfDate(note.credit_note_date)}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{note.reason || 'Customer return'} · Credit ${formatMoney(note.total_amount)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => downloadPdf(note)} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Download size={14} className="mr-2" />PDF</button>
                        {!isVoid && settlements.map((settlement) => settlement.status === 'pending' && settlement.settlement_type === 'refund' ? (
                          <button key={settlement.id} type="button" onClick={() => processRefund(note, settlement)} disabled={workingNoteId === note.id} className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
                            {workingNoteId === note.id ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}Process Refund
                          </button>
                        ) : null)}
                        {!isVoid && (
                          <button type="button" onClick={() => cancelCreditNote(note)} disabled={workingNoteId === note.id} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Cancel / Void</button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {settlements.map((settlement) => (
                        <span key={settlement.id} className="rounded bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold text-slate-600">
                          {settlementLabel(settlement.settlement_type)} · ${formatMoney(settlement.amount)} · {settlement.status}
                          {settlement.payment_method ? ` · ${settlement.payment_method}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Close</button>
          <button type="button" onClick={handleSave} disabled={saving || loading || !hasReturn || (settlementMethod === 'split' && !splitValid)} className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle size={16} className="mr-2" />}
            {saving ? 'Issuing…' : 'Issue Credit Note'}
          </button>
        </div>
      </div>
    </div>
  );
}
