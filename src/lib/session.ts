import { cache } from 'react';
import { cookies } from 'next/headers';
import { emailEnabled } from './email';
import { accountForSession, getQuote, quoteAllowance, type Account } from './store';

// Cookie names: the signed-in session, the one free no-signup quote, an invite link's referral code,
// and the address awaiting its sign-in code (kept out of the URL so it never lands in logs or history).
export const sessionCookie = 'firmquote_session';
export const anonQuoteCookie = 'firmquote_anon_quote';
export const referralCookie = 'firmquote_ref';
export const pendingEmailCookie = 'firmquote_signin_email';

const base = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
export const sessionCookieOptions = { ...base, maxAge: 60 * 60 * 24 * 180 };
export const anonQuoteCookieOptions = { ...base, maxAge: 60 * 60 * 24 * 365 };
export const referralCookieOptions = { ...base, maxAge: 60 * 60 * 24 * 30 };
export const pendingEmailCookieOptions = { ...base, maxAge: 60 * 10 };
export const clearedCookie = { ...base, maxAge: 0 };

/**
 * Accounts need a way to send sign-in codes. Without email in production the gate stays off and quote
 * creation works anonymously as before; in development codes go to the server log instead.
 */
export const accountsEnabled = () => emailEnabled() || process.env.NODE_ENV !== 'production';

/** The signed-in account, resolved once per request (the layout and the page both ask). */
export const currentAccount = cache(async (): Promise<Account | null> => accountForSession((await cookies()).get(sessionCookie)?.value));

/**
 * The quote this browser created without signing in, as `<id>.<editor key>`. The key matters: quote ids are
 * public (they are in every client link), so only the key proves this browser created it.
 */
export const anonQuoteValue = (q: { id: string; edit_key: string }) => `${q.id}.${q.edit_key}`;
export async function anonQuote() {
  const match = /^([a-f0-9]{24})\.([a-f0-9]{48})$/.exec((await cookies()).get(anonQuoteCookie)?.value ?? '');
  return match ? { id: match[1], key: match[2] } : null;
}

export type CreateGate =
  | { kind: 'open' }                      // accounts off: create anonymously, as before accounts existed
  | { kind: 'first' }                     // signed out, no free quote used yet on this browser
  | { kind: 'signin' }                    // signed out and the free quote is used
  | { kind: 'owned'; account: Account }   // signed in with room for another quote
  | { kind: 'limit'; account: Account; active: number; limit: number };

/** Decides whether this visitor may create a quote now, and as whom. */
export async function createGate(): Promise<CreateGate> {
  const account = await currentAccount();
  if (account) {
    const allowance = await quoteAllowance(account);
    return allowance.canCreate ? { kind: 'owned', account } : { kind: 'limit', account, active: allowance.active, limit: allowance.limit ?? 0 };
  }
  if (!accountsEnabled()) return { kind: 'open' };
  return (await anonQuote()) ? { kind: 'signin' } : { kind: 'first' };
}

/**
 * The quote, editor key included, when the signed-in account owns it. Server-only: kept out of the
 * 'use server' action files, whose every export is callable from the browser.
 */
export async function ownedQuote(quoteId: string) {
  if (!/^[a-f0-9]{24}$/.test(quoteId)) return null;
  const [account, q] = await Promise.all([currentAccount(), getQuote(quoteId)]);
  return account && q && q.account_id === account.id ? q : null;
}

/** Internal paths only, so a crafted ?next= cannot send a signed-in user off-site. */
export function safeNext(next: unknown, fallback = '/account') {
  return typeof next === 'string' && /^\/(?!\/)[A-Za-z0-9/_#-]*$/.test(next) ? next : fallback;
}
