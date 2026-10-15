import { headers } from 'next/headers';
import { startCheckout } from '@/app/actions/billing';
import { joinWaitlistAction } from '@/app/actions/account';
import { PRO_PRICES, providerEnabled } from '@/lib/billing';
import type { BillingProvider } from '@/lib/store';

const providerCopy: Record<BillingProvider, { title: string; note: string }> = {
  razorpay: { title: 'Paying from India', note: 'UPI AutoPay, cards or netbanking, via Razorpay. Prices in rupees.' },
  stripe: { title: 'Paying from elsewhere', note: 'Cards, via Stripe. Prices in US dollars.' },
};

/**
 * Pro checkout buttons for each configured provider; the visitor's country only decides which comes first, so
 * nobody is locked out of the currency they need. With no provider configured, the Pro waitlist stays.
 */
export async function ProOffer({ from, waitlisted }: { from: 'account' | 'limit'; waitlisted: boolean }) {
  const india = (await headers()).get('x-vercel-ip-country') === 'IN';
  const providers = ((india ? ['razorpay', 'stripe'] : ['stripe', 'razorpay']) as BillingProvider[]).filter(providerEnabled);
  if (!providers.length) return waitlisted
    ? <p className="success">You&apos;re on the Pro waitlist. We&apos;ll email you when it opens.</p>
    : <form action={joinWaitlistAction}><button className="primary" type="submit">Join the Pro waitlist</button></form>;
  return <div className="pro-offer">
    {providers.map(provider => <div className="pro-provider" key={provider}>
      <strong>{providerCopy[provider].title}</strong>
      <span className="hint">{providerCopy[provider].note}</span>
      <div className="order-actions">
        {(['month', 'year'] as const).map(interval => <form action={startCheckout} key={interval}>
          <input type="hidden" name="provider" value={provider}/>
          <input type="hidden" name="interval" value={interval}/>
          <input type="hidden" name="from" value={from}/>
          <button className={interval === 'month' ? 'primary' : 'secondary'} type="submit">{PRO_PRICES[provider][interval]} / {interval}</button>
        </form>)}
      </div>
    </div>)}
    <p className="hint">Cancel any time; Pro stays on until the end of the period you paid for.</p>
  </div>;
}
