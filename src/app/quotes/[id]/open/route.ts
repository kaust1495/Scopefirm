import { NextRequest, NextResponse } from 'next/server';
import { editorCookie, editorCookieOptions } from '@/lib/editor-cookie';
import { ownedQuote } from '@/lib/session';

/** Opens a tracker from the dashboard: the signed-in owner gets the same scoped editor cookie an editor link sets. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const q = await ownedQuote(id);
  if (!q) return new NextResponse('Not found', { status: 404 });
  const response = NextResponse.redirect(new URL(`/quotes/${id}`, request.url));
  response.cookies.set(editorCookie(id), q.edit_key, editorCookieOptions(id));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
