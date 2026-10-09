import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getChangeOrders, getQuote, keyMatches } from '@/lib/store';
import { editorCookie } from '@/lib/editor-cookie';
import { ledger } from '@/lib/ledger';
import { formatQuotePrice } from '@/lib/currency';
import { siteUrl } from '@/lib/site';

// RFC 5545 text escaping, and 75-octet line folding.
const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
function fold(line: string) {
  const out: string[] = []; let cur = '';
  for (const ch of line) {
    // Continuation lines start with a space, so keep every chunk within 74 octets.
    if (Buffer.byteLength(cur + ch) > 74) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** Editor-only calendar reminder (.ics) to follow up an unpaid advance or change order. */
export async function GET(request: NextRequest, context: {params: Promise<{id:string}>}) {
  const {id} = await context.params;
  if (!/^[a-f0-9]{24}$/.test(id)) return new NextResponse('Not found', {status:404});
  const q = await getQuote(id);
  if (!keyMatches(q, request.cookies.get(editorCookie(id))?.value)) return new NextResponse('Not found', {status:404});
  const item = request.nextUrl.searchParams.get('item') ?? '';
  const line = ledger(q!, await getChangeOrders(id)).lines.find(l => l.key === item && l.followUp);
  if (!line) return new NextResponse('Nothing to remind about', {status:404});
  // Reminders never land in the past: an overdue follow-up moves two UTC days out, which is still in the future at 10:00 in every timezone.
  const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const day = (line.followUp! < tomorrow ? tomorrow : line.followUp!).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const summary = `Follow up payment: ${line.item} (${formatQuotePrice(line.amount, q!.currency)}) - ${q!.project}`;
  const body = `${line.item} for "${q!.project}" (${q!.client}) is unpaid. Amount: ${formatQuotePrice(line.amount, q!.currency)}. Due since ${line.dueFrom}. Mark it received on your ScopeFirm tracker once paid: ${siteUrl}/quotes/${id}`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ScopeFirm//Payment reminder//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${randomBytes(12).toString('hex')}@scopefirm`, `DTSTAMP:${stamp}`,
    // Floating 10:00 local time, so it rings in the freelancer's own timezone.
    `DTSTART:${day}T100000`, `DTEND:${day}T101500`,
    fold(`SUMMARY:${esc(summary)}`), fold(`DESCRIPTION:${esc(body)}`),
    'BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${esc(summary)}`), 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  return new NextResponse(ics, {headers: {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="scopefirm-reminder-${id}-${item.slice(0, 24)}.ics"`,
    'Cache-Control': 'private, no-store',
  }});
}
