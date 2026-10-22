'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { clientIp } from '@/lib/client-ip';
import { z } from 'zod';
import { allowEvent, claimQuote, consumeLoginCode, createSession, deleteAccount, deleteSession, findOrCreateAccount, getQuote, issueLoginCode, joinProWaitlist, keyMatches, setArchived } from '@/lib/store';
import { emailEnabled, sendLoginCode } from '@/lib/email';
import { editorCookie } from '@/lib/editor-cookie';
import { accountsEnabled, anonQuoteCookie, anonQuote, clearedCookie, currentAccount, pendingEmailCookie, pendingEmailCookieOptions, referralCookie, safeNext, sessionCookie, sessionCookieOptions } from '@/lib/session';
import type { ErrorCode } from '@/lib/errors';

const emailField = z.string().trim().toLowerCase().max(254).email();
const quoteId = z.string().regex(/^[a-f0-9]{24}$/);
const day = 24 * 60 * 60 * 1000;

const signinUrl = (next: string, extra: Record<string, string>) => `/signin?${new URLSearchParams({ next, ...extra })}`;

/**
 * Sends a 6-digit sign-in code. In development without email, the code goes to the server log. A resend from the
 * code step stays on that step, whether it worked or hit a limit.
 */
export async function requestLoginCode(form: FormData) {
  const next = safeNext(form.get('next'));
  if (!accountsEnabled()) redirect(signinUrl(next, { error: 'signinOff' satisfies ErrorCode }));
  const email = emailField.safeParse(form.get('email'));
  if (!email.success) redirect(signinUrl(next, { error: 'email' satisfies ErrorCode }));
  const resend = form.get('resend') === '1';
  const fail = (error: ErrorCode) => redirect(signinUrl(next, resend ? { step: 'code', error } : { error }));
  // Per address *and* network, so a stranger spending their own requests cannot lock the owner out; the looser
  // per-address ceilings still stop anyone from flooding one inbox.
  const ip = await clientIp();
  if (!await allowEvent('login-to-ip', `${email.data}|${ip}`, 3, 15 * 60 * 1000) || !await allowEvent('login-to', email.data, 10, 15 * 60 * 1000)
    || !await allowEvent('login-to-day', email.data, 30, day) || !await allowEvent('login-ip', ip, 20, day)) fail('signinRate');
  const code = await issueLoginCode(email.data);
  if (emailEnabled()) {
    if (!await sendLoginCode(email.data, code)) fail('emailFailed');
  } else {
    console.info(`[dev] FirmQuote sign-in code for ${email.data}: ${code}`);
  }
  (await cookies()).set(pendingEmailCookie, email.data, pendingEmailCookieOptions);
  redirect(signinUrl(next, resend ? { step: 'code', sent: '1' } : { step: 'code' }));
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
  jar.set(sessionCookie, await createSession(account.id, await clientIp()), sessionCookieOptions);
  const anon = await anonQuote();
  if (anon && keyMatches(await getQuote(anon.id), anon.key)) await claimQuote(anon.id, account.id);
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

/** Soft-deletes the account after the typed confirmation. Signing back in within 48 hours restores it. */
export async function deleteAccountAction(form: FormData) {
  const account = await requireAccount('/account');
  const confirm = z.string().trim().toUpperCase().safeParse(form.get('confirm'));
  if (!confirm.success || confirm.data !== 'DELETE') redirect('/account?error=confirm');
  await deleteAccount(account.id);
  (await cookies()).set(sessionCookie, '', clearedCookie);
  redirect('/?bye=1');
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
