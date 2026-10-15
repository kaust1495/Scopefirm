'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { allowEvent, claimQuote, consumeLoginCode, createSession, deleteSession, findOrCreateAccount, getQuote, issueLoginCode, joinProWaitlist, keyMatches, setArchived } from '@/lib/store';
import { emailEnabled, sendLoginCode } from '@/lib/email';
import { editorCookie } from '@/lib/editor-cookie';
import { accountsEnabled, anonQuoteCookie, anonQuoteId, clearedCookie, currentAccount, pendingEmailCookie, pendingEmailCookieOptions, referralCookie, safeNext, sessionCookie, sessionCookieOptions } from '@/lib/session';
import type { ErrorCode } from '@/lib/errors';

const emailField = z.string().trim().toLowerCase().max(254).email();
const quoteId = z.string().regex(/^[a-f0-9]{24}$/);
const day = 24 * 60 * 60 * 1000;

const clientIp = async () => {
  const h = await headers();
  return h.get('x-real-ip')?.trim() || h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
};
const signinUrl = (next: string, extra: Record<string, string>) => `/signin?${new URLSearchParams({ next, ...extra })}`;

/** Sends a 6-digit sign-in code. In development without email, the code goes to the server log. */
export async function requestLoginCode(form: FormData) {
  const next = safeNext(form.get('next'));
  if (!accountsEnabled()) redirect(signinUrl(next, { error: 'signinOff' satisfies ErrorCode }));
  const email = emailField.safeParse(form.get('email'));
  if (!email.success) redirect(signinUrl(next, { error: 'email' satisfies ErrorCode }));
  if (!await allowEvent('login-to', email.data, 3, 15 * 60 * 1000) || !await allowEvent('login-to-day', email.data, 10, day)
    || !await allowEvent('login-ip', await clientIp(), 20, day)) redirect(signinUrl(next, { error: 'signinRate' satisfies ErrorCode }));
  const code = await issueLoginCode(email.data);
  if (emailEnabled()) {
    if (!await sendLoginCode(email.data, code)) redirect(signinUrl(next, { error: 'emailFailed' satisfies ErrorCode }));
  } else {
    console.info(`[dev] FirmQuote sign-in code for ${email.data}: ${code}`);
  }
  (await cookies()).set(pendingEmailCookie, email.data, pendingEmailCookieOptions);
  redirect(signinUrl(next, { step: 'code' }));
}

/** Checks the code, signs in (creating the account on first use) and attaches this browser's free quote. */
export async function verifyLoginCode(form: FormData) {
  const next = safeNext(form.get('next'));
  const email = emailField.safeParse(form.get('email'));
  const code = z.string().trim().regex(/^\d{6}$/).safeParse(form.get('code'));
  if (!email.success || !code.success || !await consumeLoginCode(email.data, code.data))
    redirect(signinUrl(next, { step: 'code', error: 'signinCode' satisfies ErrorCode }));
  const jar = await cookies();
  const referral = jar.get(referralCookie)?.value;
  const account = await findOrCreateAccount(email.data, referral && /^[a-f0-9]{10}$/.test(referral) ? referral : null);
  jar.set(sessionCookie, await createSession(account.id), sessionCookieOptions);
  const anon = await anonQuoteId();
  if (anon) await claimQuote(anon, account.id);
  for (const name of [anonQuoteCookie, referralCookie, pendingEmailCookie]) jar.set(name, '', clearedCookie);
  redirect(next);
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await deleteSession(token);
  jar.set(sessionCookie, '', clearedCookie);
  redirect('/');
}

async function requireAccount(next: string) {
  const account = await currentAccount();
  if (!account) redirect(`/signin?next=${next}`);
  return account;
}

export async function setArchivedAction(form: FormData) {
  const account = await requireAccount('/account');
  const id = quoteId.safeParse(form.get('id'));
  const ok = id.success && await setArchived(id.data, account.id, form.get('archived') === '1');
  revalidatePath('/account');
  redirect(ok ? '/account' : '/account?error=archive');
}

/** Adds a quote to the signed-in account; the visitor must hold that quote's editor access. */
export async function claimQuoteAction(form: FormData) {
  const id = quoteId.safeParse(form.get('id'));
  if (!id.success) redirect('/account');
  const tracker = `/quotes/${id.data}`;
  const account = await requireAccount(tracker);
  const q = await getQuote(id.data);
  if (!q || !keyMatches(q, (await cookies()).get(editorCookie(id.data))?.value)) redirect('/?error=editor');
  await claimQuote(q.id, account.id);
  revalidatePath(tracker);
  redirect(tracker);
}

export async function joinWaitlistAction() {
  const account = await requireAccount('/limit');
  await joinProWaitlist(account.id);
  redirect('/limit?waitlist=1');
}
