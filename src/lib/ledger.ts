// Pure helpers shared by the Excel payments sheet (browser) and calendar reminders (server).

export type LedgerQuote = {
  id: string; client: string; project: string; price: number; currency: string; status: string;
  accepted_at: string | null; advance_amount: number | null; advance_paid_at: string | null; valid_until?: string | null;
};
export type LedgerOrder = { id: string; title: string; price: number; status: string; responded_at: string | null; paid_at?: string | null };

export type LedgerLine = {
  key: string; item: string; amount: number; status: 'Paid' | 'Due' | 'Due on delivery' | 'Not yet due';
  dueFrom: string | null; followUp: string | null; paidAt: string | null;
};

/** Unpaid amounts get a follow-up date three days after they became due. */
export const FOLLOW_UP_DAYS = 3;
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);

export function ledger(q: LedgerQuote, orders: LedgerOrder[]) {
  const accepted = q.status === 'accepted' && q.accepted_at;
  const lines: LedgerLine[] = [];
  const advance = q.advance_amount ?? 0;
  if (q.advance_amount != null) {
    lines.push({
      key: 'advance', item: 'Advance', amount: q.advance_amount,
      status: q.advance_paid_at ? 'Paid' : accepted ? 'Due' : 'Not yet due',
      dueFrom: accepted ? q.accepted_at!.slice(0, 10) : null,
      followUp: accepted && !q.advance_paid_at ? addDays(q.accepted_at!, FOLLOW_UP_DAYS) : null,
      paidAt: q.advance_paid_at?.slice(0, 10) ?? null,
    });
  }
  lines.push({ key: 'balance', item: 'Project fee (after advance)', amount: Math.max(0, q.price - advance), status: accepted ? 'Due on delivery' : 'Not yet due', dueFrom: null, followUp: null, paidAt: null });
  for (const o of orders.filter(o => o.status === 'accepted')) {
    lines.push({
      key: o.id, item: `Change: ${o.title}`, amount: o.price, status: o.paid_at ? 'Paid' : 'Due',
      dueFrom: o.responded_at?.slice(0, 10) ?? null,
      followUp: !o.paid_at && o.responded_at ? addDays(o.responded_at, FOLLOW_UP_DAYS) : null,
      paidAt: o.paid_at?.slice(0, 10) ?? null,
    });
  }
  const changes = orders.filter(o => o.status === 'accepted').reduce((s, o) => s + o.price, 0);
  const received = lines.filter(l => l.status === 'Paid').reduce((s, l) => s + l.amount, 0);
  const total = q.price + changes;
  const followUps = lines.map(l => l.followUp).filter((d): d is string => Boolean(d)).sort();
  return { lines, changes, total, received, balance: Math.round((total - received) * 100) / 100, nextFollowUp: followUps[0] ?? null };
}
