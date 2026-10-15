import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowUpRight, Mail } from 'lucide-react';
import { requestLoginCode, verifyLoginCode } from '@/app/actions/account';
import { errorMessage } from '@/lib/errors';
import { accountsEnabled, currentAccount, pendingEmailCookie, safeNext } from '@/lib/session';
import { emailEnabled } from '@/lib/email';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; step?: string; error?: string }> }) {
  const sp = await searchParams, next = safeNext(sp.next), error = errorMessage(sp.error);
  if (await currentAccount()) redirect(next);
  const pending = (await cookies()).get(pendingEmailCookie)?.value;
  const codeStep = sp.step === 'code' && pending;
  return <main className="shell compact">
    <div className="hero small">
      <div className="eyebrow"><Mail size={14}/> SIGN IN</div>
      <h1>All your quotes, <em>one place.</em></h1>
      <p>No password. We email you a 6-digit code. Your first quote on this browser is added to your account when you sign in.</p>
    </div>
    <div className="panel signin">
      {error && <p role="alert" className="error">{error}</p>}
      {!accountsEnabled() ? <p className="hint">Sign-in is not switched on yet. You can keep creating quotes without an account.</p>
      : codeStep ? <form action={verifyLoginCode} className="form">
          <input type="hidden" name="email" value={pending}/>
          <input type="hidden" name="next" value={next}/>
          <p className="hint">{emailEnabled() ? <>We sent a code to <strong>{pending}</strong>. It expires in 10 minutes.</> : <>Development mode: the code for <strong>{pending}</strong> is in the server log.</>}</p>
          <label>6-digit code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus/></label>
          <button className="primary" type="submit">Sign in <ArrowUpRight size={18}/></button>
          <p className="hint"><a href={`/signin?next=${encodeURIComponent(next)}`}>Use a different email or resend the code</a></p>
        </form>
      : <form action={requestLoginCode} className="form">
          <input type="hidden" name="next" value={next}/>
          <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@studio.com" autoFocus/></label>
          <button className="primary" type="submit">Email me a code <ArrowUpRight size={18}/></button>
          <p className="hint">Your email is used only to sign you in. Clients never need an account.</p>
        </form>}
    </div>
  </main>;
}
