// Pro subscriptions: Dodo Payments (merchant of record; the live provider), plus dormant Stripe Billing (USD) and
// Razorpay Subscriptions (INR), all called over plain HTTPS like email.ts. Each provider turns on only when every one of
// its variables is set. Card and UPI details stay on the providers' pages.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { BillingProvider, SubscriptionState } from './store';

export type BillingInterval = 'month' | 'year';

/** Display prices. The amounts actually charged live in the provider dashboards' prices/plans; keep them equal. */
export const PRO_PRICES: Record<'razorpay' | 'stripe', Record<BillingInterval, string>> = {
  razorpay: { month: '₹299', year: '₹1,999' },
  stripe: { month: '$9', year: '$69' },
};
/** Dodo shows each buyer one localized price; set the INR price for India in Dodo's localized pricing to match. */
export const dodoPrice = (interval: BillingInterval, india: boolean) => PRO_PRICES[india ? 'razorpay' : 'stripe'][interval];

const env = (name: string) => process.env[name]?.trim() || '';
const stripeVars = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_YEARLY'];
const razorpayVars = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RAZORPAY_PLAN_MONTHLY', 'RAZORPAY_PLAN_YEARLY'];
const dodoVars = ['DODO_API_KEY', 'DODO_WEBHOOK_SECRET', 'DODO_PRODUCT_MONTHLY', 'DODO_PRODUCT_YEARLY'];
export const stripeEnabled = () => stripeVars.every(env);
export const razorpayEnabled = () => razorpayVars.every(env);
export const dodoEnabled = () => dodoVars.every(env);
export const providerEnabled = (provider: BillingProvider) =>
  provider === 'dodo' ? dodoEnabled() : provider === 'stripe' ? stripeEnabled() : razorpayEnabled();
export const billingEnabled = () => dodoEnabled() || stripeEnabled() || razorpayEnabled();

// ---- Webhook signatures --------------------------------------------------------------------------

const hmacHex = (secret: string, payload: string) => createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
function sameHex(a: string, b: string) {
  if (!/^[a-f0-9]+$/.test(a) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/** Stripe signs `<timestamp>.<raw body>`; the header lists `t=` and one or more `v1=` signatures. */
export const STRIPE_TOLERANCE_SECONDS = 300;
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = header.split(',').map(part => part.trim().split('='));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value ?? '');
  if (!Number.isInteger(timestamp) || !signatures.length) return false;
  if (Math.abs(now / 1000 - timestamp) > STRIPE_TOLERANCE_SECONDS) return false;
  const expected = hmacHex(secret, `${timestamp}.${rawBody}`);
  return signatures.some(signature => sameHex(signature, expected));
}

/** Razorpay sends the hex HMAC-SHA256 of the raw body in X-Razorpay-Signature. */
export function verifyRazorpaySignature(rawBody: string, header: string | null, secret: string) {
  if (!header || !secret) return false;
  return sameHex(header.trim(), hmacHex(secret, rawBody));
}

/**
 * Dodo follows Standard Webhooks: sign `<webhook-id>.<webhook-timestamp>.<raw body>` with HMAC-SHA256 under the
 * base64 key after `whsec_`; `webhook-signature` holds space-separated `v1,<base64>` entries. 5-minute window.
 */
export const DODO_TOLERANCE_SECONDS = 300;
export function verifyDodoSignature(rawBody: string, h: { id: string | null; timestamp: string | null; signature: string | null }, secret: string, now = Date.now()) {
  if (!h.id || !h.timestamp || !h.signature || !secret) return false;
  const timestamp = Number(h.timestamp);
  if (!Number.isInteger(timestamp) || Math.abs(now / 1000 - timestamp) > DODO_TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  if (!key.length) return false;
  const expected = createHmac('sha256', key).update(`${h.id}.${h.timestamp}.${rawBody}`, 'utf8').digest();
  return h.signature.split(' ').some(entry => {
    const [scheme, value] = entry.split(',');
    if (scheme !== 'v1' || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// ---- Subscription state ----------------------------------------------------------------------------

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => (value && typeof value === 'object' ? value as Json : {});
const str = (value: unknown) => (typeof value === 'string' && value ? value : null);
const seconds = (value: unknown) => (typeof value === 'number' && value > 0 ? new Date(value * 1000) : null);

/** Stripe keeps charging retries under past_due, so Pro continues until the period (plus grace) ends. */
const stripeEntitled = new Set(['active', 'trialing', 'past_due']);
export function stripeState(sub: unknown): SubscriptionState | null {
  const s = obj(sub), id = str(s.id);
  if (!id) return null;
  // API versions from 2025 moved the billing period onto each subscription item.
  const itemEnds = (Array.isArray(obj(s.items).data) ? obj(s.items).data as unknown[] : []).map(item => obj(item).current_period_end).filter(value => typeof value === 'number') as number[];
  const periodEnd = seconds(s.current_period_end) ?? seconds(itemEnds.length ? Math.max(...itemEnds) : null);
  const status = str(s.status) ?? 'unknown';
  return {
    provider: 'stripe', subscriptionId: id, accountId: str(obj(s.metadata).account_id), status,
    entitled: stripeEntitled.has(status) && periodEnd != null, periodEnd,
    cancelAtPeriodEnd: s.cancel_at_period_end === true || typeof s.cancel_at === 'number',
  };
}

/** Razorpay's `pending` means a renewal failed and is being retried; `halted` means retries ran out. */
const razorpayEntitled = new Set(['active', 'pending']);
export function razorpayState(sub: unknown): SubscriptionState | null {
  const s = obj(sub), id = str(s.id);
  if (!id) return null;
  const status = str(s.status) ?? 'unknown', periodEnd = seconds(s.current_end);
  return {
    provider: 'razorpay', subscriptionId: id, accountId: str(obj(s.notes).account_id), status,
    entitled: razorpayEntitled.has(status) && periodEnd != null, periodEnd,
    // Razorpay's entity does not say whether a cancel-at-cycle-end is scheduled; the app records its own cancels.
    cancelAtPeriodEnd: null,
  };
}

/** Dodo's `past_due` is its renewal grace period (the customer keeps access); `on_hold` means the grace ran out. */
const dodoEntitled = new Set(['active', 'past_due']);
export function dodoState(sub: unknown): SubscriptionState | null {
  const s = obj(sub), id = str(s.subscription_id);
  if (!id) return null;
  const status = str(s.status) ?? 'unknown', next = str(s.next_billing_date);
  const periodEnd = next && !Number.isNaN(Date.parse(next)) ? new Date(next) : null;
  return {
    provider: 'dodo', subscriptionId: id, accountId: str(obj(s.metadata).account_id), status,
    entitled: dodoEntitled.has(status) && periodEnd != null, periodEnd,
    cancelAtPeriodEnd: s.cancel_at_next_billing_date === true,
  };
}

// ---- Provider APIs ---------------------------------------------------------------------------------

export class BillingError extends Error {}

async function call(url: string, init: RequestInit): Promise<Json> {
  let res: Response;
  try { res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) }); }
  catch (error) { throw new BillingError(`Billing provider unreachable: ${String(error)}`); }
  const body = obj(await res.json().catch(() => ({})));
  if (!res.ok) throw new BillingError(`Billing provider error ${res.status}: ${str(obj(body.error).message) ?? str(obj(body.error).description) ?? str(body.message) ?? 'unknown'}`);
  return body;
}

// Stripe: form-encoded requests, pinned API version so response shapes do not drift.
const stripeApi = 'https://api.stripe.com/v1';
const stripeHeaders = () => ({ Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Stripe-Version': '2024-06-20', 'Content-Type': 'application/x-www-form-urlencoded' });
const stripeId = /^[A-Za-z0-9_]{3,255}$/;

export async function createStripeCheckout(input: { accountId: string; email: string; interval: BillingInterval; successUrl: string; cancelUrl: string }) {
  const form = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': env(input.interval === 'year' ? 'STRIPE_PRICE_YEARLY' : 'STRIPE_PRICE_MONTHLY'),
    'line_items[0][quantity]': '1',
    customer_email: input.email,
    client_reference_id: input.accountId,
    'metadata[account_id]': input.accountId,
    'subscription_data[metadata][account_id]': input.accountId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  const session = await call(`${stripeApi}/checkout/sessions`, { method: 'POST', headers: stripeHeaders(), body: form });
  const url = str(session.url);
  if (!url?.startsWith('https://')) throw new BillingError('Stripe returned no checkout URL');
  return url;
}

/** A finished Checkout Session's account and subscription, read back from Stripe (never from the browser). */
export async function getStripeCheckoutSession(sessionId: string) {
  if (!stripeId.test(sessionId)) return null;
  const session = await call(`${stripeApi}/checkout/sessions/${sessionId}`, { headers: stripeHeaders() });
  return { accountId: str(session.client_reference_id), subscriptionId: str(session.subscription), complete: session.status === 'complete' };
}

export async function getStripeSubscription(subscriptionId: string) {
  if (!stripeId.test(subscriptionId)) throw new BillingError('Bad subscription id');
  return stripeState(await call(`${stripeApi}/subscriptions/${subscriptionId}`, { headers: stripeHeaders() }));
}

/** Stops renewal; Pro continues to the end of the paid period. */
export async function cancelStripe(subscriptionId: string) {
  if (!stripeId.test(subscriptionId)) throw new BillingError('Bad subscription id');
  return stripeState(await call(`${stripeApi}/subscriptions/${subscriptionId}`, { method: 'POST', headers: stripeHeaders(), body: new URLSearchParams({ cancel_at_period_end: 'true' }) }));
}

/** Undoes a scheduled cancel while the period is still running, so the subscription renews again. */
export async function resumeStripe(subscriptionId: string) {
  if (!stripeId.test(subscriptionId)) throw new BillingError('Bad subscription id');
  return stripeState(await call(`${stripeApi}/subscriptions/${subscriptionId}`, { method: 'POST', headers: stripeHeaders(), body: new URLSearchParams({ cancel_at_period_end: 'false' }) }));
}

// Razorpay: JSON requests with basic auth. Razorpay cannot undo a cancel-at-cycle-end, so it has no resume.
const razorpayApi = 'https://api.razorpay.com/v1';
const razorpayHeaders = () => ({ Authorization: `Basic ${Buffer.from(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`).toString('base64')}`, 'Content-Type': 'application/json' });
const razorpayId = /^sub_[A-Za-z0-9]{6,40}$/;
/** Razorpay needs a fixed number of billing cycles; ten years either way, after which the freelancer resubscribes. */
export const RAZORPAY_TOTAL_COUNT: Record<BillingInterval, number> = { month: 120, year: 10 };

export async function createRazorpaySubscription(input: { accountId: string; email: string; interval: BillingInterval }) {
  const sub = await call(`${razorpayApi}/subscriptions`, {
    method: 'POST', headers: razorpayHeaders(),
    body: JSON.stringify({
      plan_id: env(input.interval === 'year' ? 'RAZORPAY_PLAN_YEARLY' : 'RAZORPAY_PLAN_MONTHLY'),
      total_count: RAZORPAY_TOTAL_COUNT[input.interval],
      quantity: 1,
      customer_notify: 1,
      notify_info: { notify_email: input.email },
      // Unpaid links expire after a day, so an abandoned checkout cannot be paid weeks later by surprise.
      expire_by: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      notes: { account_id: input.accountId },
    }),
  });
  const id = str(sub.id), url = str(sub.short_url);
  if (!id || !url?.startsWith('https://')) throw new BillingError('Razorpay returned no subscription link');
  return { subscriptionId: id, url };
}

export async function getRazorpaySubscription(subscriptionId: string) {
  if (!razorpayId.test(subscriptionId)) throw new BillingError('Bad subscription id');
  return razorpayState(await call(`${razorpayApi}/subscriptions/${subscriptionId}`, { headers: razorpayHeaders() }));
}

/** Stops renewal at the end of the current cycle; Pro continues until then. */
export async function cancelRazorpay(subscriptionId: string) {
  if (!razorpayId.test(subscriptionId)) throw new BillingError('Bad subscription id');
  return razorpayState(await call(`${razorpayApi}/subscriptions/${subscriptionId}/cancel`, { method: 'POST', headers: razorpayHeaders(), body: JSON.stringify({ cancel_at_cycle_end: 1 }) }));
}

// Dodo: JSON with a bearer key; DODO_ENVIRONMENT=test switches to test mode. Cancel and resume flip one flag.
const dodoApi = () => env('DODO_ENVIRONMENT') === 'test' ? 'https://test.dodopayments.com' : 'https://live.dodopayments.com';
const dodoHeaders = () => ({ Authorization: `Bearer ${env('DODO_API_KEY')}`, 'Content-Type': 'application/json' });
const dodoId = /^sub_[A-Za-z0-9]{3,64}$/;

export async function createDodoCheckout(input: { accountId: string; email: string; interval: BillingInterval; returnUrl: string }) {
  const session = await call(`${dodoApi()}/checkouts`, {
    method: 'POST', headers: dodoHeaders(),
    body: JSON.stringify({
      product_cart: [{ product_id: env(input.interval === 'year' ? 'DODO_PRODUCT_YEARLY' : 'DODO_PRODUCT_MONTHLY'), quantity: 1 }],
      customer: { email: input.email },
      metadata: { account_id: input.accountId },
      return_url: input.returnUrl,
    }),
  });
  const url = str(session.checkout_url);
  if (!url?.startsWith('https://')) throw new BillingError('Dodo returned no checkout URL');
  return url;
}

export async function getDodoSubscription(subscriptionId: string) {
  if (!dodoId.test(subscriptionId)) throw new BillingError('Bad subscription id');
  return dodoState(await call(`${dodoApi()}/subscriptions/${subscriptionId}`, { headers: dodoHeaders() }));
}

async function setDodoCancel(subscriptionId: string, cancel: boolean) {
  if (!dodoId.test(subscriptionId)) throw new BillingError('Bad subscription id');
  return dodoState(await call(`${dodoApi()}/subscriptions/${subscriptionId}`, { method: 'PATCH', headers: dodoHeaders(), body: JSON.stringify({ cancel_at_next_billing_date: cancel }) }));
}
/** Stops renewal; Pro continues to the end of the paid period. */
export const cancelDodo = (subscriptionId: string) => setDodoCancel(subscriptionId, true);
/** Undoes a scheduled cancel while the period is still running. */
export const resumeDodo = (subscriptionId: string) => setDodoCancel(subscriptionId, false);

export const fetchSubscription = (provider: BillingProvider, subscriptionId: string) =>
  provider === 'dodo' ? getDodoSubscription(subscriptionId) : provider === 'stripe' ? getStripeSubscription(subscriptionId) : getRazorpaySubscription(subscriptionId);
