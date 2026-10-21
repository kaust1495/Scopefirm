'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { allowEvent, applySubscription, hasProFeatures, isPro, recordPendingSubscription, setBranding } from '@/lib/store';
import { BillingError, cancelDodo, cancelRazorpay, cancelStripe, createDodoCheckout, resumeDodo, resumeStripe, createRazorpaySubscription, createStripeCheckout, providerEnabled } from '@/lib/billing';
import { brandColorPattern, LOGO_MAX_BYTES, sniffLogo } from '@/lib/branding';
import { currentAccount } from '@/lib/session';
import { siteUrl } from '@/lib/site';
import type { ErrorCode } from '@/lib/errors';

const checkoutFields = z.object({ provider: z.enum(['dodo', 'stripe', 'razorpay']), interval: z.enum(['month', 'year']), from: z.enum(['account', 'limit']).catch('account') });

async function requireAccount(next: string) {
  const account = await currentAccount();
  if (!account) redirect(`/signin?next=${next}`);
  return account;
}

/** Production returns to the canonical domain; local builds return to whatever host served the page. */
async function origin() {
  if (process.env.NODE_ENV === 'production') return siteUrl;
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost:3000'}`;
}

/** Sends a signed-in, non-founder, non-Pro freelancer to the provider's hosted checkout page. */
export async function startCheckout(form: FormData) {
  const fields = checkoutFields.safeParse({ provider: form.get('provider'), interval: form.get('interval'), from: form.get('from') });
  const back = `/${fields.success ? fields.data.from : 'account'}`;
  const account = await requireAccount(back);
  if (hasProFeatures(account)) redirect('/account');
  if (!fields.success || !providerEnabled(fields.data.provider)) redirect(`${back}?error=${'billingOff' satisfies ErrorCode}`);
  if (!await allowEvent('checkout', account.id, 10, 60 * 60 * 1000)) redirect(`${back}?error=${'billingRate' satisfies ErrorCode}`);
  const { provider, interval } = fields.data;
  let url: string;
  try {
    if (provider === 'dodo') {
      // Dodo appends subscription_id and status to this URL; the account page confirms them with Dodo.
      url = await createDodoCheckout({ accountId: account.id, email: account.email, interval, returnUrl: `${await origin()}/account?checkout=dodo` });
    } else if (provider === 'stripe') {
      const base = await origin();
      url = await createStripeCheckout({ accountId: account.id, email: account.email, interval,
        successUrl: `${base}/account?checkout=stripe&session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${base}${back}` });
    } else {
      const sub = await createRazorpaySubscription({ accountId: account.id, email: account.email, interval });
      await recordPendingSubscription(account.id, 'razorpay', sub.subscriptionId);
      url = sub.url;
    }
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;
    console.error('[billing] checkout failed', error.message);
    redirect(`${back}?error=${'billing' satisfies ErrorCode}`);
  }
  redirect(url);
}

/** Stops renewal. Pro stays on until the end of the period already paid for. */
export async function cancelSubscriptionAction(form: FormData) {
  const account = await requireAccount('/account');
  if (form.get('confirm') !== 'yes') redirect(`/account?error=${'cancelConfirm' satisfies ErrorCode}#plan`);
  const { billing_provider: provider, subscription_id: subscriptionId } = account;
  if (!provider || !subscriptionId || !isPro(account) || account.cancel_at_period_end || !providerEnabled(provider)) redirect('/account#plan');
  try {
    const state = provider === 'dodo' ? await cancelDodo(subscriptionId) : provider === 'stripe' ? await cancelStripe(subscriptionId) : await cancelRazorpay(subscriptionId);
    // Razorpay does not report a scheduled cancel, so record the one just made.
    if (state) await applySubscription(account.id, { ...state, cancelAtPeriodEnd: true });
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;
    console.error('[billing] cancel failed', error.message);
    redirect(`/account?error=${'billing' satisfies ErrorCode}#plan`);
  }
  revalidatePath('/account');
  redirect('/account?billing=cancelled#plan');
}

/** Turns renewal back on for a cancelled Dodo or Stripe subscription that has not ended yet. */
export async function resumeSubscriptionAction() {
  const account = await requireAccount('/account');
  const { billing_provider: provider, subscription_id: subscriptionId } = account;
  if ((provider !== 'stripe' && provider !== 'dodo') || !subscriptionId || !isPro(account) || !account.cancel_at_period_end || !providerEnabled(provider)) redirect('/account#plan');
  try {
    const state = provider === 'dodo' ? await resumeDodo(subscriptionId) : await resumeStripe(subscriptionId);
    if (state) await applySubscription(account.id, state);
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;
    console.error('[billing] resume failed', error.message);
    redirect(`/account?error=${'billing' satisfies ErrorCode}#plan`);
  }
  revalidatePath('/account');
  redirect('/account?billing=resumed#plan');
}

/** Saves the accent colour and logo shown on this freelancer's client pages (Pro and founders). */
export async function saveBrandingAction(form: FormData) {
  const account = await requireAccount('/account');
  if (!hasProFeatures(account)) redirect(`/account?error=${'proOnly' satisfies ErrorCode}#branding`);
  const rawColor = String(form.get('brand_color') ?? '').trim();
  const useColor = form.get('use_color') === 'on';
  if (useColor && !brandColorPattern.test(rawColor)) redirect(`/account?error=${'brandColor' satisfies ErrorCode}#branding`);
  let logo: { data: Uint8Array; type: string } | 'remove' | undefined;
  const file = form.get('logo');
  if (form.get('remove_logo') === 'on') logo = 'remove';
  else if (file instanceof File && file.size > 0) {
    if (file.size > LOGO_MAX_BYTES) redirect(`/account?error=${'logo' satisfies ErrorCode}#branding`);
    const data = new Uint8Array(await file.arrayBuffer()), type = sniffLogo(data);
    if (!type) redirect(`/account?error=${'logo' satisfies ErrorCode}#branding`);
    logo = { data, type };
  }
  await setBranding(account.id, useColor ? rawColor.toLowerCase() : null, logo);
  revalidatePath('/account');
  redirect('/account?branding=saved#branding');
}
