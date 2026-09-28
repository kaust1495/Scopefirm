import { NextRequest, NextResponse } from 'next/server';
import { getQuote, keyMatches } from '@/lib/store';
import { editorCookie, editorCookieOptions } from '@/lib/editor-cookie';

export async function GET(request: NextRequest, context: {params: Promise<{id:string}>}) {
  const {id} = await context.params;
  const key = request.nextUrl.searchParams.get('key');
  if (!/^[a-f0-9]{24}$/.test(id) || !key || !/^[a-f0-9]{48}$/.test(key))
    return new NextResponse('Invalid editor link', {status:404});
  const q = await getQuote(id);
  if (!keyMatches(q, key)) return new NextResponse('Invalid editor link', {status:404});
  const response = NextResponse.redirect(new URL(`/quotes/${id}`, request.url));
  response.cookies.set(editorCookie(id), key, editorCookieOptions(id));
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
