import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowUpRight, Award, LayoutList } from 'lucide-react';
import { setArchivedAction, signOut } from '@/app/actions/account';
import { countActivatedInvitees, FOUNDER_SPOTS, foundersRemaining, listAccountQuotes, quoteAllowance, REFERRAL_BONUS, REFERRAL_CAP, type Quote } from '@/lib/store';
import { currentAccount } from '@/lib/session';
import { formatQuotePrice } from '@/lib/currency';
import { errorMessage } from '@/lib/errors';
import { LocalTime } from '@/app/components/local-time';
import { CopyText } from '@/app/components/share-link';

export const metadata: Metadata = { title: 'My quotes', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const statusLabel: Record<string, string> = { draft: 'Draft', sent: 'Updated', change_requested: 'Changes requested', accepted: 'Accepted' };

function QuoteRow({ q, archived }: { q: Quote; archived: boolean }) {
  return <li className="account-quote">
    <div>
      <strong>{q.project}</strong>
      <span className="hint">{q.client} · {statusLabel[q.status] ?? q.status} · {formatQuotePrice(q.price, q.currency)} · updated <LocalTime iso={q.updated_at}/></span>
    </div>
    <div className="order-actions">
      <a className="secondary" href={`/quotes/${q.id}/open`}>Open <ArrowUpRight size={16}/></a>
      <form action={setArchivedAction}>
        <input type="hidden" name="id" value={q.id}/>
        <input type="hidden" name="archived" value={archived ? '0' : '1'}/>
        <button className="secondary" type="submit">{archived ? <><ArchiveRestore size={16}/> Unarchive</> : <><Archive size={16}/> Archive</>}</button>
      </form>
    </div>
  </li>;
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const account = await currentAccount();
  if (!account) redirect('/signin?next=/account');
  const error = errorMessage((await searchParams).error);
  const [quotes, allowance, invitees, spotsLeft] = await Promise.all([listAccountQuotes(account.id), quoteAllowance(account), countActivatedInvitees(account.id), foundersRemaining()]);
  const active = quotes.filter(q => !q.archived_at), archived = quotes.filter(q => q.archived_at);
  const invitePath = `/invite/${account.referral_code}`;
  return <main className="shell compact">
    <div className="backline"><Link href="/#quote-builder">← New quote</Link><form action={signOut}><button className="secondary" type="submit">Sign out</button></form></div>
    <div className="hero small">
      <div className="eyebrow"><LayoutList size={14}/> MY QUOTES</div>
      <h1>Your quotes</h1>
      <p>Signed in as {account.email}.</p>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="grid">
      <div className="panel">
        <span className="kicker">ACTIVE</span>
        <h2>{active.length ? `${active.length} active ${active.length === 1 ? 'quote' : 'quotes'}` : 'No active quotes yet'}</h2>
        {active.length ? <ul className="account-quotes">{active.map(q => <QuoteRow key={q.id} q={q} archived={false}/>)}</ul>
          : <p className="hint">Create a quote and it will appear here. <Link href="/#quote-builder">Write a quote →</Link></p>}
        {archived.length > 0 && <details className="optional archived-list"><summary>Archived ({archived.length})</summary>
          <ul className="account-quotes">{archived.map(q => <QuoteRow key={q.id} q={q} archived/>)}</ul></details>}
      </div>
      <div>
        <div className={account.founder_number != null ? 'panel accepted-note' : 'panel'}>
          {account.founder_number != null ? <>
            <span className="kicker"><Award size={14}/> FOUNDER #{account.founder_number} OF {FOUNDER_SPOTS}</span>
            <h2>Free for life</h2>
            <p className="hint">Unlimited active quotes, forever. Thank you for being early.</p>
          </> : <>
            <span className="kicker">YOUR PLAN</span>
            <h2>{allowance.active} of {allowance.limit} active quotes</h2>
            <p className="hint">{!account.activated_at && spotsLeft > 0 ? `Send your first quote: when a client opens it, you may claim one of ${spotsLeft} remaining free-for-life founder spots.` : 'Archive finished quotes to free a slot, or invite freelancers for more.'}</p>
          </>}
        </div>
        <div className="panel">
          <span className="kicker">INVITE A FREELANCER</span>
          <h2>+{REFERRAL_BONUS} quotes each</h2>
          <p className="hint">When someone you invite sends their first quote and their client opens it, you both get {REFERRAL_BONUS} more active quotes, permanently (up to {REFERRAL_CAP} invites).</p>
          <p className="hint mono share-url">{invitePath}</p>
          <CopyText path={invitePath} label="Copy invite link"/>
          <p className="hint">{invitees} of {REFERRAL_CAP} invites activated.</p>
        </div>
      </div>
    </div>
  </main>;
}
