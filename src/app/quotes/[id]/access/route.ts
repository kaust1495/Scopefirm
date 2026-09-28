import { NextRequest, NextResponse } from 'next/server';
import { getQuote } from '@/lib/store';

export async function GET(request: NextRequest, context: {params: Promise<{id:string}>}) {
  const {id} = await context.params;
  const key = request.nextUrl.searchParams.get('key');
  if (!/^[a-f0-9]{24}$/.test(id) || !key || !/^[a-f0-9]{48}$/.test(key))
    return new NextResponse('Invalid editor link', {status:404});
  const q = await getQuote(id);
  if (!q || q.edit_key !== key) return new NextResponse('Invalid editor link', {status:404});
  const response = NextResponse.redirect(new URL(`/quotes/${id}`, request.url));
  response.cookies.set(`scopefirm_editor_${id}`, key, {
    httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax',
    path:`/quotes/${id}`, maxAge:60*60*24*30,
  });
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('Referrer-Policy','no-referrer');
  return response;
}
