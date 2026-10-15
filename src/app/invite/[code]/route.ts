import { NextRequest, NextResponse } from 'next/server';
import { accountByReferralCode } from '@/lib/store';
import { referralCookie, referralCookieOptions } from '@/lib/session';

/** An invite link remembers who invited this browser, then sends the visitor to the quote builder. */
export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const response = NextResponse.redirect(new URL('/?invited=1#quote-builder', request.url));
  if (/^[a-f0-9]{10}$/.test(code) && await accountByReferralCode(code)) response.cookies.set(referralCookie, code, referralCookieOptions);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
