'use client';
import { useState } from 'react';
import { ledger, FOLLOW_UP_DAYS, type LedgerOrder, type LedgerQuote } from '@/lib/ledger';

type Exported = { quote: LedgerQuote; change_orders: LedgerOrder[] };
const bold = { fontWeight: 'bold' as const, backgroundColor: '#EAF2E6' };
const overdueFill = '#FDE2E1';
const money = (value: number) => ({ value, format: '#,##0.00' });
const date = (iso: string | null) => (iso ? { value: new Date(`${iso}T00:00:00Z`), type: Date, format: 'dd mmm yyyy' } : null);

/**
 * Builds an Excel payments sheet in the browser from the editor-only JSON export of each quote.
 * Quotes this browser is not signed in to are skipped, so nothing leaks between accounts.
 */
export function PaymentsSheetButton({ ids, label = 'Download payments sheet (Excel)' }: { ids: string[]; label?: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [note, setNote] = useState('');
  async function download() {
    setState('working'); setNote('');
    try {
      const results = await Promise.all(ids.map(async id => {
        const res = await fetch(`/quotes/${id}/export`, { credentials: 'same-origin', cache: 'no-store' });
        return res.ok ? (await res.json()) as Exported : null;
      }));
      const quotes = results.filter((r): r is Exported => Boolean(r));
      if (!quotes.length) { setState('error'); setNote('This browser is not signed in to any of these quotes. Open each one with its private editor link first.'); return; }
      const today = new Date().toISOString().slice(0, 10);
      const accounts: unknown[][] = [[
        'Client', 'Project', 'Status', 'Currency', 'Quote price', 'Accepted changes', 'Total agreed', 'Received', 'Balance', 'Next follow-up', 'Overdue',
      ].map(value => ({ value, ...bold }))];
      const payments: unknown[][] = [[
        'Client', 'Project', 'Item', 'Currency', 'Amount', 'Status', 'Due from', 'Follow up on', 'Paid on', 'Overdue',
      ].map(value => ({ value, ...bold }))];
      for (const { quote: q, change_orders } of quotes) {
        const l = ledger(q, change_orders);
        const overdue = Boolean(l.nextFollowUp && l.nextFollowUp < today);
        const fill = overdue ? { backgroundColor: overdueFill } : {};
        accounts.push([
          { value: q.client, ...fill }, { value: q.project, ...fill }, q.status.replace('_', ' '), q.currency,
          money(q.price), money(l.changes), money(l.total), money(l.received), { ...money(l.balance), fontWeight: 'bold' },
          date(l.nextFollowUp), overdue ? { value: 'Yes', ...fill, fontWeight: 'bold' } : 'No',
        ]);
        for (const line of l.lines) {
          const late = Boolean(line.followUp && line.followUp < today);
          payments.push([
            q.client, q.project, line.item, q.currency, money(line.amount), line.status,
            date(line.dueFrom), date(line.followUp), date(line.paidAt), late ? { value: 'Yes', backgroundColor: overdueFill, fontWeight: 'bold' } : 'No',
          ]);
        }
      }
      const readme = [
        [{ value: 'ScopeFirm payments sheet', fontWeight: 'bold' as const }],
        [`Exported ${new Date().toLocaleString()}. ${quotes.length} quote(s)${quotes.length < ids.length ? `; ${ids.length - quotes.length} skipped because this browser is not signed in to them` : ''}.`],
        [`Follow-up dates are ${FOLLOW_UP_DAYS} days after an amount became due. Overdue rows are highlighted.`],
        ['"Received" counts only payments you marked received on the tracker. ScopeFirm does not see or verify payments.'],
        ['Amounts are in each quote\'s own currency and are not converted.'],
      ];
      const { default: writeExcelFile } = await import('write-excel-file/universal');
      const blob = await writeExcelFile([
        { data: accounts as never, sheet: 'Accounts', columns: [22, 26, 16, 10, 14, 16, 14, 14, 14, 16, 10].map(width => ({ width })), stickyRowsCount: 1 },
        { data: payments as never, sheet: 'Payments', columns: [22, 26, 30, 10, 14, 16, 14, 14, 14, 10].map(width => ({ width })), stickyRowsCount: 1 },
        { data: readme as never, sheet: 'Read me', columns: [{ width: 110 }] },
      ] as never).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `scopefirm-payments-${today}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState('done');
      setNote(quotes.length < ids.length ? `${ids.length - quotes.length} quote(s) skipped: open them with their editor links to include them.` : '');
    } catch {
      setState('error'); setNote('Could not build the sheet. Please try again.');
    }
  }
  return <div className="sheet-download">
    <button type="button" className="secondary" onClick={download} disabled={state === 'working'}>{state === 'working' ? 'Preparing…' : state === 'done' ? 'Downloaded ✓' : label}</button>
    {note && <p className="hint" role={state === 'error' ? 'alert' : 'status'}>{note}</p>}
  </div>;
}
