import { createHmac } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuoteInput, SubscriptionState } from './store';

// The store binds its client at module load, so point it at a throwaway file DB first.
const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'firmquote-billing-test-')), 'test.db')}`;
process.env.TURSO_DATABASE_URL = dbUrl;

let store: typeof import('./store');
let webhooks: typeof import('./billing-webhooks');
let sync: typeof import('./billing-sync');
let waitlist: { eligible: (db: unknown) => Promise<{ id: string; email: string }[]>; sendAll: (db: unknown, send: (to: string, s: string, b: string) => Promise<boolean>, o?: object) => Promise<{ sent: number; failed: number }> };

const input: QuoteInput = {
  client: 'Acme', project: 'Site', ask: '', deliverables: 'Pages', exclusions: 'None',
  price: 50000, currency: 'INR', revision_limit: 3, client_email: null, pages_count: null, forms_count: null,
  cms_needed: null, timeline: null, supplier_name: null, supplier_address: null, supplier_gstin: null,
  client_gstin: null, sac_code: null, gst_rate: null, gst_treatment: null, gst_split: null, upi_id: null,
  advance_amount: null, payment_link: null, region: 'IN', valid_until: null,
};
let n = 0;
const account = () => store.findOrCreateAccount(`billing${++n}-${Date.now()}@example.com`, null);
const reload = async (id: string) => (await store.getAccount(id))!;
const day = 24 * 60 * 60 * 1000;
const state = (accountId: string, over: Partial<SubscriptionState> = {}): SubscriptionState => ({
  provider: 'stripe', subscriptionId: `sub_${accountId}`, accountId, status: 'active', entitled: true,
  periodEnd: new Date(Date.now() + 30 * day), cancelAtPeriodEnd: false, ...over,
});
/** Fills an account's free slots. */
async function fill(accountId: string, count = store.FREE_ACTIVE_QUOTES) {
  for (let i = 0; i < count; i++) await store.createQuote(input, null, accountId);
}

const dodoKey = Buffer.from('dodo-flow-signing-key-123456');
const secrets = { stripe: 'whsec_flow', razorpay: 'rzp_whsec_flow', dodo: `whsec_${dodoKey.toString('base64')}` };
function enableBilling() {
  vi.stubEnv('DODO_API_KEY', 'dodo_test'); vi.stubEnv('DODO_WEBHOOK_SECRET', secrets.dodo);
  vi.stubEnv('DODO_PRODUCT_MONTHLY', 'pdt_m'); vi.stubEnv('DODO_PRODUCT_YEARLY', 'pdt_y');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test'); vi.stubEnv('STRIPE_WEBHOOK_SECRET', secrets.stripe);
  vi.stubEnv('STRIPE_PRICE_MONTHLY', 'price_m'); vi.stubEnv('STRIPE_PRICE_YEARLY', 'price_y');
  vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test'); vi.stubEnv('RAZORPAY_KEY_SECRET', 'rzp_secret'); vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', secrets.razorpay);
  vi.stubEnv('RAZORPAY_PLAN_MONTHLY', 'plan_m'); vi.stubEnv('RAZORPAY_PLAN_YEARLY', 'plan_y');
}
/** A fake provider API: GET/POST of a subscription returns whatever `remote` holds for it. */
const remote = new Map<string, unknown>();
function fakeProviders() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const id = /subscriptions\/([A-Za-z0-9_]+)/.exec(url)?.[1];
    return id && remote.has(id) ? new Response(JSON.stringify(remote.get(id))) : new Response('{"error":{"message":"missing"}}', { status: 404 });
  }));
}
const stripeSigned = (payload: string) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${createHmac('sha256', secrets.stripe).update(`${t}.${payload}`).digest('hex')}`; };
const razorpaySigned = (payload: string) => createHmac('sha256', secrets.razorpay).update(payload).digest('hex');
let dodoMsg = 0;
const dodoSigned = (payload: string, key = dodoKey) => {
  const id = `msg_${++dodoMsg}`, timestamp = String(Math.floor(Date.now() / 1000));
  return { id, timestamp, signature: `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64')}` };
};
const sec = (ms: number) => Math.floor(ms / 1000);

beforeAll(async () => {
  store = await import('./store');
  webhooks = await import('./billing-webhooks');
  sync = await import('./billing-sync');
  waitlist = await import('../../scripts/email-waitlist.mjs') as unknown as typeof waitlist;
});
beforeEach(() => { enableBilling(); fakeProviders(); remote.clear(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('entitlement and limits', () => {
  it('a paid subscription lifts the active-quote limit; a lapsed one restores it without touching quotes', async () => {
    const a = await account();
    await fill(a.id);
    expect((await store.quoteAllowance(await reload(a.id))).canCreate).toBe(false);
    await store.applySubscription(a.id, state(a.id));
    const pro = await reload(a.id);
    expect(store.isPro(pro)).toBe(true);
    expect(await store.quoteAllowance(pro)).toMatchObject({ limit: null, canCreate: true });
    await fill(a.id, 2);
    await store.applySubscription(a.id, state(a.id, { status: 'canceled', entitled: false }));
    const lapsed = await reload(a.id);
    expect(store.isPro(lapsed)).toBe(false);
    expect(await store.quoteAllowance(lapsed)).toMatchObject({ active: 5, limit: 3, canCreate: false });
    expect(await store.listAccountQuotes(a.id)).toHaveLength(5);
  });

  it('keeps Pro for the renewal grace period after the paid period ends', async () => {
    const a = await account();
    await store.applySubscription(a.id, state(a.id, { periodEnd: new Date(Date.now() - day) }));
    const acc = await reload(a.id);
    expect(store.isPro(acc)).toBe(true);
    expect(store.isPro(acc, new Date(Date.now() + store.RENEWAL_GRACE_DAYS * day))).toBe(false);
  });

  it('founders have every Pro feature without paying', async () => {
    const a = await account();
    expect(store.hasProFeatures({ ...a, founder_number: 7 })).toBe(true);
    expect(store.hasProFeatures(a)).toBe(false);
  });

  it('a stale cancellation of an older subscription cannot end a newer paid one', async () => {
    const a = await account();
    await store.applySubscription(a.id, state(a.id, { subscriptionId: 'sub_new' }));
    expect(await store.applySubscription(a.id, state(a.id, { subscriptionId: 'sub_old', status: 'canceled', entitled: false }))).toBe(false);
    const acc = await reload(a.id);
    expect(acc.subscription_id).toBe('sub_new');
    expect(store.isPro(acc)).toBe(true);
  });

  it('keeps the app-recorded cancel flag when the provider does not report one (Razorpay)', async () => {
    const a = await account();
    await store.applySubscription(a.id, state(a.id, { provider: 'razorpay', cancelAtPeriodEnd: true }));
    await store.applySubscription(a.id, state(a.id, { provider: 'razorpay', cancelAtPeriodEnd: null }));
    expect((await reload(a.id)).cancel_at_period_end).toBe(1);
  });

  it('a pending checkout never replaces a subscription that is still paid for', async () => {
    const a = await account();
    await store.applySubscription(a.id, state(a.id));
    await store.recordPendingSubscription(a.id, 'razorpay', 'sub_PENDING01');
    expect((await reload(a.id)).subscription_id).toBe(`sub_${a.id}`);
  });
});

describe('webhooks (signed, re-read from the provider)', () => {
  it('Stripe: a signed event makes the account Pro using the subscription Stripe returns, not the event body', async () => {
    const a = await account();
    remote.set('sub_flow1', { id: 'sub_flow1', status: 'active', current_period_end: sec(Date.now() + 30 * day), metadata: { account_id: a.id } });
    // The event body claims "canceled"; the re-read subscription is what counts.
    const payload = JSON.stringify({ type: 'customer.subscription.updated', data: { object: { id: 'sub_flow1', status: 'canceled' } } });
    const res = await webhooks.handleWebhook('stripe', payload, stripeSigned(payload));
    expect(res.status).toBe(200);
    expect(store.isPro(await reload(a.id))).toBe(true);
  });

  it('Stripe: rejects a bad signature with 400 and changes nothing', async () => {
    const a = await account();
    remote.set('sub_flow2', { id: 'sub_flow2', status: 'active', current_period_end: sec(Date.now() + 30 * day), metadata: { account_id: a.id } });
    const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: { subscription: 'sub_flow2' } } });
    const forged = `t=${Math.floor(Date.now() / 1000)},v1=${createHmac('sha256', 'whsec_attacker').update(`x.${payload}`).digest('hex')}`;
    expect((await webhooks.handleWebhook('stripe', payload, forged)).status).toBe(400);
    expect((await webhooks.handleWebhook('stripe', payload, null)).status).toBe(400);
    expect(store.isPro(await reload(a.id))).toBe(false);
  });

  it('Stripe: handles invoice events in both API shapes and ignores unrelated events', async () => {
    expect(webhooks.stripeSubscriptionId({ type: 'invoice.paid', data: { object: { subscription: 'sub_a' } } })).toBe('sub_a');
    expect(webhooks.stripeSubscriptionId({ type: 'invoice.paid', data: { object: { parent: { subscription_details: { subscription: 'sub_b' } } } } })).toBe('sub_b');
    const payload = JSON.stringify({ type: 'charge.refunded', data: { object: { id: 'ch_1' } } });
    const res = await webhooks.handleWebhook('stripe', payload, stripeSigned(payload));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Ignored');
  });

  it('Razorpay: activation, then a duplicate, then cancellation', async () => {
    const a = await account();
    const sub = { id: 'sub_RZPFLOW01', status: 'active', current_end: sec(Date.now() + 30 * day), notes: { account_id: a.id } };
    remote.set(sub.id, sub);
    const payload = JSON.stringify({ event: 'subscription.activated', payload: { subscription: { entity: { id: sub.id } } } });
    expect((await webhooks.handleWebhook('razorpay', payload, razorpaySigned(payload))).status).toBe(200);
    expect((await webhooks.handleWebhook('razorpay', payload, razorpaySigned(payload))).status).toBe(200);
    expect(store.isPro(await reload(a.id))).toBe(true);
    remote.set(sub.id, { ...sub, status: 'cancelled' });
    const cancelled = JSON.stringify({ event: 'subscription.cancelled', payload: { subscription: { entity: { id: sub.id } } } });
    expect((await webhooks.handleWebhook('razorpay', cancelled, razorpaySigned(cancelled))).status).toBe(200);
    expect(store.isPro(await reload(a.id))).toBe(false);
  });

  it('Razorpay: rejects a tampered body', async () => {
    const payload = JSON.stringify({ event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_RZPFLOW02' } } } });
    expect((await webhooks.handleWebhook('razorpay', payload.replace('02', '03'), razorpaySigned(payload))).status).toBe(400);
  });

  it('Dodo: a signed event makes the account Pro from the re-read subscription; cancellation then ends it', async () => {
    const a = await account();
    const sub = { subscription_id: 'sub_DODOFLOW1', status: 'active', next_billing_date: new Date(Date.now() + 30 * day).toISOString(), metadata: { account_id: a.id }, cancel_at_next_billing_date: false };
    remote.set(sub.subscription_id, sub);
    // The event body claims "cancelled"; the subscription Dodo returns is what counts.
    const payload = JSON.stringify({ business_id: 'bus_1', type: 'subscription.active', data: { payload_type: 'Subscription', subscription_id: sub.subscription_id, status: 'cancelled' } });
    expect((await webhooks.handleWebhook('dodo', payload, dodoSigned(payload))).status).toBe(200);
    const pro = await reload(a.id);
    expect(store.isPro(pro)).toBe(true);
    expect(pro.billing_provider).toBe('dodo');
    remote.set(sub.subscription_id, { ...sub, status: 'cancelled' });
    const cancelled = JSON.stringify({ type: 'subscription.cancelled', data: { subscription_id: sub.subscription_id } });
    expect((await webhooks.handleWebhook('dodo', cancelled, dodoSigned(cancelled))).status).toBe(200);
    expect(store.isPro(await reload(a.id))).toBe(false);
  });

  it('Dodo: rejects a forged or missing signature with 400, and ignores non-subscription events', async () => {
    const a = await account();
    remote.set('sub_DODOFLOW2', { subscription_id: 'sub_DODOFLOW2', status: 'active', next_billing_date: new Date(Date.now() + 30 * day).toISOString(), metadata: { account_id: a.id } });
    const payload = JSON.stringify({ type: 'subscription.active', data: { subscription_id: 'sub_DODOFLOW2' } });
    expect((await webhooks.handleWebhook('dodo', payload, dodoSigned(payload, Buffer.from('attacker-key')))).status).toBe(400);
    expect((await webhooks.handleWebhook('dodo', payload, { id: null, timestamp: null, signature: null })).status).toBe(400);
    expect(store.isPro(await reload(a.id))).toBe(false);
    const payment = JSON.stringify({ type: 'payment.succeeded', data: { payment_id: 'pay_1' } });
    const res = await webhooks.handleWebhook('dodo', payment, dodoSigned(payment));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Ignored');
  });

  it('answers 503 when billing is not configured or the provider cannot be reached, so the provider retries', async () => {
    const payload = JSON.stringify({ event: 'subscription.charged', payload: { subscription: { entity: { id: 'sub_UNKNOWN01' } } } });
    expect((await webhooks.handleWebhook('razorpay', payload, razorpaySigned(payload))).status).toBe(503);
    vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', '');
    expect((await webhooks.handleWebhook('razorpay', payload, razorpaySigned(payload))).status).toBe(503);
  });
});

describe('return and pending sync', () => {
  it('Stripe return applies only a session that Stripe says belongs to this account', async () => {
    const a = await account(), other = await account();
    remote.set('sub_RET1', { id: 'sub_RET1', status: 'active', current_period_end: sec(Date.now() + 30 * day), metadata: { account_id: a.id } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/checkout/sessions/')
      ? new Response(JSON.stringify({ client_reference_id: a.id, subscription: 'sub_RET1', status: 'complete' }))
      : new Response(JSON.stringify(remote.get('sub_RET1')))));
    expect(store.isPro(await sync.completeStripeReturn(other, 'cs_test_1'))).toBe(false);
    expect(store.isPro(await sync.completeStripeReturn(a, 'cs_test_1'))).toBe(true);
  });

  it('Dodo return applies only a subscription that Dodo says belongs to this account', async () => {
    const a = await account(), other = await account();
    remote.set('sub_DODORET1', { subscription_id: 'sub_DODORET1', status: 'active', next_billing_date: new Date(Date.now() + 30 * day).toISOString(), metadata: { account_id: a.id } });
    expect(store.isPro(await sync.completeDodoReturn(other, 'sub_DODORET1'))).toBe(false);
    expect(store.isPro(await sync.completeDodoReturn(a, 'sub_DODORET1'))).toBe(true);
    expect(store.isPro(await sync.completeDodoReturn(other, '../bad'))).toBe(false);
  });

  it('the account page picks up a paid Razorpay checkout before the webhook arrives', async () => {
    const a = await account();
    await store.recordPendingSubscription(a.id, 'razorpay', 'sub_PEND01');
    remote.set('sub_PEND01', { id: 'sub_PEND01', status: 'active', current_end: sec(Date.now() + 30 * day), notes: { account_id: a.id } });
    expect(store.isPro(await sync.refreshPendingBilling(await reload(a.id)))).toBe(true);
  });
});

describe('waitlist email script', () => {
  it('emails waitlisted free accounts once, skips founders and Pro, and retries failures', async () => {
    const db = createClient({ url: dbUrl });
    await db.execute("UPDATE accounts SET pro_waitlist_at=NULL");
    const free = await account(), founder = await account(), pro = await account(), flaky = await account();
    for (const a of [free, founder, pro, flaky]) await store.joinProWaitlist(a.id);
    await db.execute({ sql: 'UPDATE accounts SET founder_number=999 WHERE id=?', args: [founder.id] });
    await store.applySubscription(pro.id, state(pro.id));
    expect((await waitlist.eligible(db)).map(a => a.id).sort()).toEqual([free.id, flaky.id].sort());

    const sent: string[] = [];
    const send = async (to: string, subject: string, body: string) => {
      expect(subject).toBe('FirmQuote Pro is open');
      expect(body).toContain('/account');
      if (to === flaky.email && !sent.includes('retry')) { sent.push('retry'); return false; }
      sent.push(to); return true;
    };
    expect(await waitlist.sendAll(db, send, { log: () => {}, pauseMs: 0 })).toEqual({ sent: 1, failed: 1 });
    expect(await waitlist.sendAll(db, send, { log: () => {}, pauseMs: 0 })).toEqual({ sent: 1, failed: 0 });
    expect(await waitlist.sendAll(db, send, { log: () => {}, pauseMs: 0 })).toEqual({ sent: 0, failed: 0 });
    expect(sent.filter(to => to === free.email)).toHaveLength(1);
    expect(sent.filter(to => to === flaky.email)).toHaveLength(1);
  });
});

describe('branding', () => {
  it('stores the logo apart from the account row and removes it', async () => {
    const a = await account();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    await store.setBranding(a.id, '#123456', { data: png, type: 'image/png' });
    const acc = await reload(a.id);
    expect(acc.brand_color).toBe('#123456');
    expect(acc.brand_logo_at).not.toBeNull();
    expect(Object.keys(acc)).not.toContain('data');
    expect(Array.from((await store.getBrandLogo(a.id))!.data)).toEqual(Array.from(png));
    await store.setBranding(a.id, null, 'remove');
    expect(await store.getBrandLogo(a.id)).toBeNull();
    expect((await reload(a.id)).brand_logo_at).toBeNull();
  });
});
