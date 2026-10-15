import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Gauge } from 'lucide-react';
import { hasProFeatures, quoteAllowance, REFERRAL_BONUS } from '@/lib/store';
import { currentAccount } from '@/lib/session';
import { CopyText } from '@/app/components/share-link';
import { ProOffer } from '@/app/components/pro-offer';
import { errorMessage } from '@/lib/errors';

export const metadata: Metadata = { title: 'Quote limit reached', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LimitPage({ searchParams }: { searchParams: Promise<{ waitlist?: string; error?: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin?next=/limit');
  if (hasProFeatures(account)) redirect('/account');
  const allowance = await quoteAllowance(account);
  const sp = await searchParams, error = errorMessage(sp.error);
  if (allowance.canCreate && !sp.waitlist && !error) redirect('/#quote-builder');
  const invitePath = `/invite/${account.referral_code}`;
  return <main className="shell compact">
    <div className="hero small">
      <div className="eyebrow"><Gauge size={14}/> FREE PLAN</div>
      <h1>You are using {allowance.active} of {allowance.limit} active quotes.</h1>
      <p>Your existing quotes keep working: clients can still approve, and you can still propose and track change orders. Only new quotes need a free slot.</p>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
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
        <span className="kicker">PRO</span>
        <h2>Unlimited quotes</h2>
        <p className="hint">Unlimited active quotes, your logo and colour on client pages, and no FirmQuote badge.</p>
        <ProOffer from="limit" waitlisted={account.pro_waitlist_at != null}/>
      </div>
    </div>
  </main>;
}
