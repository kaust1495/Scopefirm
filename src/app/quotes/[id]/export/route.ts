import { NextRequest, NextResponse } from 'next/server';
import { getChangeOrders, getHistory, getQuote, keyMatches } from '@/lib/store';
import { editorCookie } from '@/lib/editor-cookie';

/** Editor-only JSON download of a quote, its dated history and change orders. The editor key is never included. */
export async function GET(request: NextRequest, context: {params: Promise<{id:string}>}) {
  const {id} = await context.params;
  if (!/^[a-f0-9]{24}$/.test(id)) return new NextResponse('Not found', {status:404});
  const q = await getQuote(id);
  if (!keyMatches(q, request.cookies.get(editorCookie(id))?.value)) return new NextResponse('Not found', {status:404});
  const [history, changeOrders] = await Promise.all([getHistory(id), getChangeOrders(id)]);
  const strip = (row: object) => ({...row, edit_key: undefined});
  const body = {
    exported_at: new Date().toISOString(),
    quote: strip(q!),
    change_orders: changeOrders,
    history: history.map(h => ({...h, snapshot: (() => { try { return strip(JSON.parse(h.snapshot)); } catch { return h.snapshot; } })()})),
  };
  return new NextResponse(JSON.stringify(body, null, 2), {headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="scopefirm-quote-${id}.json"`,
    'Cache-Control': 'private, no-store',
  }});
}
