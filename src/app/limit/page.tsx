import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Gauge } from 'lucide-react';
import { joinWaitlistAction } from '@/app/actions/account';
import { quoteAllowance, REFERRAL_BONUS } from '@/lib/store';
import { currentAccount } from '@/lib/session';
import { CopyText } from '@/app/components/copy-text';

export const metadata: Metadata = { title: 'Quote limit reached', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LimitPage({ searchParams }: { searchParams: Promise<{ waitlist?: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin?next=/limit');
  const allowance = await quoteAllowance(account);
  if (allowance.canCreate && !(await searchParams).waitlist) redirect('/#quote-builder');
  const invitePath = `/invite/${account.referral_code}`;
  return <main className="shell compact">
    <div className="hero small">
      <div className="eyebrow"><Gauge size={14}/> FREE PLAN</div>
      <h1>You are using {allowance.active} of {allowance.limit} active quotes.</h1>
      <p>Your existing quotes keep working: clients can still approve, and you can still propose and track change orders. Only new quotes need a free slot.</p>
    </div>
    <div className="three limit-options">
      <div className="panel">
        <span className="kicker">FREE A SLOT</span>
        <h2>Archive a finished quote</h2>
        <p className="hint">Archived quotes stay viewable and don&apos;t count toward your limit.</p>
        <Link className="secondary" href="/account">Go to my quotes</Link>
      </div>
      <div className="panel">
        <span className="kicker">INVITE</span>
        <h2>+{REFERRAL_BONUS} quotes each</h2>
        <p className="hint">When a freelancer you invite sends a quote their client opens, you both get {REFERRAL_BONUS} more, permanently.</p>
        <CopyText path={invitePath} label="Copy invite link"/>
      </div>
      <div className="panel">
        <span className="kicker">PRO (COMING SOON)</span>
        <h2>Unlimited quotes</h2>
        {account.pro_waitlist_at ? <p className="success">You&apos;re on the Pro waitlist. We&apos;ll email you when it opens.</p>
          : <form action={joinWaitlistAction}><p className="hint">Unlimited active quotes and your own branding on client pages.</p><button className="primary" type="submit">Join the Pro waitlist</button></form>}
      </div>
    </div>
  </main>;
}
