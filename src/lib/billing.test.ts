import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelRazorpay, createRazorpaySubscription, createStripeCheckout, getStripeCheckoutSession, razorpayState, stripeState, verifyRazorpaySignature, verifyStripeSignature, BillingError } from './billing';

const secret = 'whsec_test_secret';
const body = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated' });
const stripeHeader = (payload: string, t: number, key = secret) => `t=${t},v1=${createHmac('sha256', key).update(`${t}.${payload}`).digest('hex')}`;
const now = Date.UTC(2026, 9, 15, 12);
const nowSec = Math.floor(now / 1000);

describe('Stripe webhook signature', () => {
  it('accepts a correctly signed, fresh body', () => {
    expect(verifyStripeSignature(body, stripeHeader(body, nowSec), secret, now)).toBe(true);
  });
  it('accepts when any one of several v1 signatures matches (secret rotation)', () => {
    const header = `t=${nowSec},v1=${'0'.repeat(64)},${stripeHeader(body, nowSec).split(',')[1]}`;
    expect(verifyStripeSignature(body, header, secret, now)).toBe(true);
  });
  it('rejects a tampered body', () => {
    expect(verifyStripeSignature(body.replace('updated', 'deleted'), stripeHeader(body, nowSec), secret, now)).toBe(false);
  });
  it('rejects a signature made with another secret', () => {
    expect(verifyStripeSignature(body, stripeHeader(body, nowSec, 'whsec_other'), secret, now)).toBe(false);
  });
  it('rejects a replay older than the 5-minute tolerance, and one from the future', () => {
    expect(verifyStripeSignature(body, stripeHeader(body, nowSec - 301), secret, now)).toBe(false);
    expect(verifyStripeSignature(body, stripeHeader(body, nowSec + 301), secret, now)).toBe(false);
    expect(verifyStripeSignature(body, stripeHeader(body, nowSec - 299), secret, now)).toBe(true);
  });
  it('rejects missing or malformed headers and an empty secret', () => {
    expect(verifyStripeSignature(body, null, secret, now)).toBe(false);
    expect(verifyStripeSignature(body, 'garbage', secret, now)).toBe(false);
    expect(verifyStripeSignature(body, `t=${nowSec}`, secret, now)).toBe(false);
    expect(verifyStripeSignature(body, `t=${nowSec},v1=zz`, secret, now)).toBe(false);
    expect(verifyStripeSignature(body, stripeHeader(body, nowSec, ''), '', now)).toBe(false);
  });
});

describe('Razorpay webhook signature', () => {
  const sign = (payload: string, key = secret) => createHmac('sha256', key).update(payload).digest('hex');
  it('accepts the HMAC of the exact raw body', () => {
    expect(verifyRazorpaySignature(body, sign(body), secret)).toBe(true);
  });
  it('rejects a tampered body, another secret, a missing header or an empty secret', () => {
    expect(verifyRazorpaySignature(`${body} `, sign(body), secret)).toBe(false);
    expect(verifyRazorpaySignature(body, sign(body, 'other'), secret)).toBe(false);
    expect(verifyRazorpaySignature(body, null, secret)).toBe(false);
    expect(verifyRazorpaySignature(body, sign(body, ''), '')).toBe(false);
    expect(verifyRazorpaySignature(body, sign(body).toUpperCase(), secret)).toBe(false);
  });
});

describe('subscription state mapping', () => {
  it('reads a Stripe subscription with the period on the subscription', () => {
    const state = stripeState({ id: 'sub_1', status: 'active', current_period_end: nowSec + 86400, cancel_at_period_end: false, metadata: { account_id: 'acc' } })!;
    expect(state).toMatchObject({ provider: 'stripe', subscriptionId: 'sub_1', accountId: 'acc', entitled: true, cancelAtPeriodEnd: false });
    expect(state.periodEnd!.getTime()).toBe((nowSec + 86400) * 1000);
  });
  it('reads the newer Stripe shape with the period on the items', () => {
    const state = stripeState({ id: 'sub_2', status: 'past_due', items: { data: [{ current_period_end: nowSec + 10 }, { current_period_end: nowSec + 20 }] }, cancel_at: nowSec + 20, metadata: {} })!;
    expect(state.periodEnd!.getTime()).toBe((nowSec + 20) * 1000);
    expect(state).toMatchObject({ entitled: true, cancelAtPeriodEnd: true, accountId: null });
  });
  it('does not entitle canceled, unpaid or incomplete Stripe subscriptions', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'])
      expect(stripeState({ id: 'sub_3', status, current_period_end: nowSec + 100 })!.entitled).toBe(false);
  });
  it('reads Razorpay subscriptions; pending (retrying) keeps Pro, halted does not', () => {
    const base = { id: 'sub_ABCDEF123', current_end: nowSec + 100, notes: { account_id: 'acc' } };
    expect(razorpayState({ ...base, status: 'active' })).toMatchObject({ provider: 'razorpay', entitled: true, accountId: 'acc', cancelAtPeriodEnd: null });
    expect(razorpayState({ ...base, status: 'pending' })!.entitled).toBe(true);
    for (const status of ['created', 'authenticated', 'halted', 'cancelled', 'completed', 'expired'])
      expect(razorpayState({ ...base, status })!.entitled).toBe(false);
    expect(razorpayState({ ...base, status: 'active', current_end: null })!.entitled).toBe(false);
  });
  it('returns null without an id', () => {
    expect(stripeState({})).toBeNull();
    expect(razorpayState(null)).toBeNull();
  });
});

describe('provider HTTP calls', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const respond = (json: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(json), { status }));

  it('creates a Stripe Checkout Session tied to the account', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x'); vi.stubEnv('STRIPE_PRICE_YEARLY', 'price_year');
    const fetch = respond({ url: 'https://checkout.stripe.com/c/pay/cs_1' });
    vi.stubGlobal('fetch', fetch);
    const url = await createStripeCheckout({ accountId: 'acc1', email: 'a@b.co', interval: 'year', successUrl: 'https://x/ok', cancelUrl: 'https://x/no' });
    expect(url).toBe('https://checkout.stripe.com/c/pay/cs_1');
    const [target, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toBe('https://api.stripe.com/v1/checkout/sessions');
    const form = new URLSearchParams(String(init.body));
    expect(form.get('mode')).toBe('subscription');
    expect(form.get('line_items[0][price]')).toBe('price_year');
    expect(form.get('client_reference_id')).toBe('acc1');
    expect(form.get('subscription_data[metadata][account_id]')).toBe('acc1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_x');
  });

  it('turns a provider error into a BillingError', async () => {
    vi.stubGlobal('fetch', respond({ error: { message: 'No such price' } }, 400));
    await expect(createStripeCheckout({ accountId: 'a', email: 'a@b.co', interval: 'month', successUrl: 'https://x', cancelUrl: 'https://x' })).rejects.toBeInstanceOf(BillingError);
  });

  it('refuses malformed Checkout Session ids without calling Stripe', async () => {
    const fetch = respond({});
    vi.stubGlobal('fetch', fetch);
    expect(await getStripeCheckoutSession('../customers')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('creates a Razorpay subscription with the account in its notes and returns its link', async () => {
    vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test_id'); vi.stubEnv('RAZORPAY_KEY_SECRET', 'secret'); vi.stubEnv('RAZORPAY_PLAN_MONTHLY', 'plan_month');
    const fetch = respond({ id: 'sub_ABCDEF123', short_url: 'https://rzp.io/i/abc', status: 'created' });
    vi.stubGlobal('fetch', fetch);
    expect(await createRazorpaySubscription({ accountId: 'acc1', email: 'a@b.co', interval: 'month' })).toEqual({ subscriptionId: 'sub_ABCDEF123', url: 'https://rzp.io/i/abc' });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ plan_id: 'plan_month', total_count: 120, notes: { account_id: 'acc1' } });
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('rzp_test_id:secret').toString('base64')}`);
  });

  it('cancels a Razorpay subscription at the end of the cycle', async () => {
    const fetch = respond({ id: 'sub_ABCDEF123', status: 'active', current_end: nowSec + 100 });
    vi.stubGlobal('fetch', fetch);
    await cancelRazorpay('sub_ABCDEF123');
    const [target, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toBe('https://api.razorpay.com/v1/subscriptions/sub_ABCDEF123/cancel');
    expect(JSON.parse(String(init.body))).toEqual({ cancel_at_cycle_end: 1 });
  });
});
