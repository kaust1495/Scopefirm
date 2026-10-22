import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowUpRight, Award, LayoutList, Palette, Sparkles } from 'lucide-react';
import { deleteAccountAction, setArchivedAction, signOut } from '@/app/actions/account';
import { cancelSubscriptionAction, resumeSubscriptionAction, saveBrandingAction } from '@/app/actions/billing';
import { BrandLogo } from '@/app/components/brand-logo';
import { countActivatedInvitees, foundersRemaining, hasProFeatures, isPro, listAccountQuotes, quoteAllowance, REFERRAL_BONUS, REFERRAL_CAP, RENEWAL_GRACE_DAYS, type Account, type Quote } from '@/lib/store';
import { completeDodoReturn, completeStripeReturn, refreshPendingBilling } from '@/lib/billing-sync';
import { providerEnabled } from '@/lib/billing';
import { LOGO_MAX_BYTES } from '@/lib/branding';
import { ProOffer } from '@/app/components/pro-offer';
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

/** The paid period's end, without the renewal grace FirmQuote adds on top. */
const paidThrough = (account: Account) => new Date(Date.parse(account.pro_until!) - RENEWAL_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
const awaitingPayment = (account: Account) => !isPro(account) && ['created', 'authenticated', 'incomplete', 'pending'].includes(account.subscription_status ?? '');
const providerName: Record<string, string> = { dodo: 'Dodo Payments', stripe: 'Stripe', razorpay: 'Razorpay' };

function PlanPanel({ account, active, limit, spotsLeft }: { account: Account; active: number; limit: number | null; spotsLeft: number }) {
  if (account.founder_number != null) return <div className="panel accepted-note" id="plan">
    <span className="kicker"><Award size={14}/> FOUNDING MEMBER</span>
    <h2>Free, unlimited</h2>
    <p className="hint">Unlimited active quotes and every Pro feature. Thank you for being early.</p>
  </div>;
  if (isPro(account)) return <div className="panel accepted-note" id="plan">
    <span className="kicker"><Sparkles size={14}/> PRO</span>
    <h2>Unlimited active quotes</h2>
    {account.cancel_at_period_end
      ? <>
        <p className="hint">Cancelled: Pro stays on until <LocalTime iso={paidThrough(account)} style="date"/> and will not renew. After that, new quotes need a free slot again; existing quotes keep working.</p>
        {(account.billing_provider === 'stripe' || account.billing_provider === 'dodo') && providerEnabled(account.billing_provider)
          ? <form action={resumeSubscriptionAction}><button className="secondary" type="submit">Keep Pro (resume renewal)</button></form>
          : <p className="hint">Razorpay cannot undo a cancellation; you can subscribe again once this period ends.</p>}
      </>
      : <p className="hint">Renews automatically on <LocalTime iso={paidThrough(account)} style="date"/> via {providerName[account.billing_provider ?? 'dodo']}. Receipts come from them.</p>}
    {!account.cancel_at_period_end && account.billing_provider && providerEnabled(account.billing_provider) && <details className="optional">
      <summary>Cancel subscription</summary>
      <form action={cancelSubscriptionAction} className="change-form">
        <label className="choice"><input type="checkbox" name="confirm" value="yes" required/> Stop renewing. Pro stays on until the paid period ends.</label>
        <button className="secondary" type="submit">Cancel Pro</button>
      </form>
    </details>}
  </div>;
  return <div className="panel" id="plan">
    <span className="kicker">YOUR PLAN</span>
    <h2>{active} of {limit} active quotes</h2>
    <p className="hint">{!account.activated_at && spotsLeft > 0 ? 'Free for initial users. Send your first quote: when a client opens it, your account is activated.' : 'Archive finished quotes to free a slot, or invite freelancers for more.'}</p>
    {awaitingPayment(account)
      ? <p className="success" role="status">Waiting for the payment to be confirmed. If you have paid, refresh this page in a minute.</p>
      : <><h3>Go Pro</h3><p className="hint">Unlimited active quotes, your logo and colour on client pages, and no FirmQuote badge.</p></>}
    <ProOffer from="account" waitlisted={account.pro_waitlist_at != null}/>
  </div>;
}

function BrandingPanel({ account }: { account: Account }) {
  if (!hasProFeatures(account)) return <div className="panel" id="branding">
    <span className="kicker"><Palette size={14}/> BRANDING</span>
    <h2>Your brand on client pages</h2>
    <p className="hint">Pro adds your logo and accent colour to every quote your client opens, and removes the &ldquo;Created with FirmQuote&rdquo; line.</p>
  </div>;
  return <div className="panel" id="branding">
    <span className="kicker"><Palette size={14}/> BRANDING</span>
    <h2>Your brand on client pages</h2>
    <form action={saveBrandingAction} className="change-form">
      {account.brand_logo_at && <BrandLogo className="brand-preview" accountId={account.id} version={account.brand_logo_at} alt="Your current logo"/>}
      <label>Logo <small>PNG, JPEG or WebP, up to {LOGO_MAX_BYTES / 1024} KB</small><input type="file" name="logo" accept="image/png,image/jpeg,image/webp"/></label>
      {account.brand_logo_at && <label className="choice"><input type="checkbox" name="remove_logo"/> Remove the current logo</label>}
      <label className="choice"><input type="checkbox" name="use_color" defaultChecked={account.brand_color != null}/> Use an accent colour</label>
      <label>Accent colour<input className="color-input" type="color" name="brand_color" defaultValue={account.brand_color ?? '#1f5a41'}/></label>
      <button className="primary" type="submit">Save branding</button>
    </form>
  </div>;
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; checkout?: string; session_id?: string; subscription_id?: string; billing?: string; branding?: string }> }) {
  let account = await currentAccount();
  if (!account) redirect('/signin?next=/account');
  const sp = await searchParams, error = errorMessage(sp.error);
  // Back from Stripe: confirm with Stripe directly instead of waiting for the webhook.
  if (sp.checkout === 'stripe' && sp.session_id) account = await completeStripeReturn(account, sp.session_id);
  // Back from Dodo: it appends subscription_id; confirm with Dodo that it is this account's before trusting it.
  if (sp.checkout === 'dodo' && sp.subscription_id) account = await completeDodoReturn(account, sp.subscription_id);
  account = await refreshPendingBilling(account);
  const notice = sp.billing === 'cancelled' ? 'Your subscription is cancelled. Pro stays on until the end of the paid period.'
    : sp.billing === 'resumed' ? 'Pro will renew again as normal.'
    : sp.branding === 'saved' ? 'Branding saved. Your client pages now use it.'
    : (sp.checkout === 'stripe' || sp.checkout === 'dodo') && isPro(account) ? 'Welcome to Pro. Your quotes are now unlimited.' : null;
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
    {notice && <p role="status" className="success">{notice}</p>}
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
        <PlanPanel account={account} active={allowance.active} limit={allowance.limit} spotsLeft={spotsLeft}/>
        <BrandingPanel account={account}/>
        <div className="panel">
          <span className="kicker">INVITE A FREELANCER</span>
          <h2>+{REFERRAL_BONUS} quotes each</h2>
          <p className="hint">When someone you invite sends their first quote and their client opens it, you both get {REFERRAL_BONUS} more active quotes, permanently (up to {REFERRAL_CAP} invites).</p>
          <p className="hint mono share-url">{invitePath}</p>
          <CopyText path={invitePath} label="Copy invite link"/>
          <p className="hint">{invitees} of {REFERRAL_CAP} invites activated.</p>
        </div>
        <div className="panel">
          <span className="kicker">DELETE ACCOUNT</span>
          <h2>Delete your account</h2>
          <p className="hint">Your sent quotes stay online for your clients. Signing back in within 48 hours restores your account; after that it is gone for good.</p>
          <details className="optional">
            <summary>Delete account</summary>
            <form action={deleteAccountAction} className="change-form">
              <label>Type DELETE to confirm<input name="confirm" autoComplete="off" required/></label>
              <button className="secondary" type="submit">Delete my account</button>
            </form>
          </details>
        </div>
      </div>
    </div>
  </main>;
}
