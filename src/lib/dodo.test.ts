import { createHmac, randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelDodo, createDodoCheckout, dodoState, resumeDodo, verifyDodoSignature, BillingError } from './billing';

// Standard Webhooks: the secret is whsec_<base64 key>; the signature is base64 HMAC-SHA256 of `${id}.${timestamp}.${body}`.
const key = randomBytes(24);
const secret = `whsec_${key.toString('base64')}`;
const body = JSON.stringify({ type: 'subscription.active', data: { subscription_id: 'sub_123' } });
const now = Date.UTC(2026, 9, 21, 12);
const nowSec = Math.floor(now / 1000);
const sign = (id: string, ts: number, payload: string, k = key) => `v1,${createHmac('sha256', k).update(`${id}.${ts}.${payload}`).digest('base64')}`;
const headers = (over: Partial<Record<'id' | 'timestamp' | 'signature', string | null>> = {}) => ({
  id: 'msg_1', timestamp: String(nowSec), signature: sign('msg_1', nowSec, body), ...over,
});

describe('Dodo webhook signature (Standard Webhooks)', () => {
  it('accepts a correctly signed, fresh body', () => {
    expect(verifyDodoSignature(body, headers(), secret, now)).toBe(true);
  });
  it('accepts when any one of several space-separated v1 signatures matches (secret rotation)', () => {
    expect(verifyDodoSignature(body, headers({ signature: `v1,${'A'.repeat(44)} ${sign('msg_1', nowSec, body)}` }), secret, now)).toBe(true);
  });
  it('rejects a tampered body, another secret, or a changed message id', () => {
    expect(verifyDodoSignature(body.replace('active', 'cancelled'), headers(), secret, now)).toBe(false);
    expect(verifyDodoSignature(body, headers({ signature: sign('msg_1', nowSec, body, randomBytes(24)) }), secret, now)).toBe(false);
    expect(verifyDodoSignature(body, headers({ id: 'msg_2' }), secret, now)).toBe(false);
  });
  it('rejects a replay older than 5 minutes and one from the future', () => {
    const old = nowSec - 301, future = nowSec + 301;
    expect(verifyDodoSignature(body, headers({ timestamp: String(old), signature: sign('msg_1', old, body) }), secret, now)).toBe(false);
    expect(verifyDodoSignature(body, headers({ timestamp: String(future), signature: sign('msg_1', future, body) }), secret, now)).toBe(false);
  });
  it('rejects missing headers, a non-v1 scheme and an empty secret', () => {
    expect(verifyDodoSignature(body, headers({ id: null }), secret, now)).toBe(false);
    expect(verifyDodoSignature(body, headers({ timestamp: null }), secret, now)).toBe(false);
    expect(verifyDodoSignature(body, headers({ signature: null }), secret, now)).toBe(false);
    expect(verifyDodoSignature(body, headers({ signature: sign('msg_1', nowSec, body).replace('v1,', 'v2,') }), secret, now)).toBe(false);
    expect(verifyDodoSignature(body, headers(), '', now)).toBe(false);
  });
});

describe('Dodo subscription state', () => {
  const sub = (over: Record<string, unknown> = {}) => ({
    subscription_id: 'sub_abc123', status: 'active', next_billing_date: '2026-11-21T00:00:00Z',
    metadata: { account_id: 'acc1' }, cancel_at_next_billing_date: false, ...over,
  });
  it('reads an active subscription', () => {
    expect(dodoState(sub())).toEqual({ provider: 'dodo', subscriptionId: 'sub_abc123', accountId: 'acc1', status: 'active', entitled: true, periodEnd: new Date('2026-11-21T00:00:00Z'), cancelAtPeriodEnd: false });
  });
  it('keeps Pro while a failed renewal is in its grace period (past_due) and reports a scheduled cancel', () => {
    expect(dodoState(sub({ status: 'past_due' }))?.entitled).toBe(true);
    expect(dodoState(sub({ cancel_at_next_billing_date: true }))?.cancelAtPeriodEnd).toBe(true);
  });
  it('does not entitle pending, on_hold, failed, cancelled or expired subscriptions', () => {
    for (const status of ['pending', 'on_hold', 'failed', 'cancelled', 'expired', 'paused']) expect(dodoState(sub({ status }))?.entitled).toBe(false);
  });
  it('returns null without an id', () => {
    expect(dodoState({ status: 'active' })).toBeNull();
  });
});

describe('Dodo API calls', () => {
  const calls: { url: string; init: RequestInit }[] = [];
  function stubFetch(response: unknown, status = 200) {
    calls.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify(response), { status }); }));
  }
  function enable(environment?: string) {
    vi.stubEnv('DODO_API_KEY', 'dodo_test_key'); vi.stubEnv('DODO_WEBHOOK_SECRET', secret);
    vi.stubEnv('DODO_PRODUCT_MONTHLY', 'pdt_month'); vi.stubEnv('DODO_PRODUCT_YEARLY', 'pdt_year');
    if (environment) vi.stubEnv('DODO_ENVIRONMENT', environment);
  }
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('creates a hosted checkout for the chosen plan, tied to the account, on the live host by default', async () => {
    enable();
    stubFetch({ session_id: 'cks_1', checkout_url: 'https://checkout.dodopayments.com/session/cks_1' });
    const url = await createDodoCheckout({ accountId: 'acc1', email: 'a@example.com', interval: 'year', returnUrl: 'https://www.firmquote.tech/account?checkout=dodo' });
    expect(url).toBe('https://checkout.dodopayments.com/session/cks_1');
    expect(calls[0].url).toBe('https://live.dodopayments.com/checkouts');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer dodo_test_key');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      product_cart: [{ product_id: 'pdt_year', quantity: 1 }],
      customer: { email: 'a@example.com' },
      metadata: { account_id: 'acc1' },
      return_url: 'https://www.firmquote.tech/account?checkout=dodo',
    });
  });
  it('uses the test host when DODO_ENVIRONMENT is test', async () => {
    enable('test');
    stubFetch({ checkout_url: 'https://test.checkout.dodopayments.com/session/cks_2' });
    await createDodoCheckout({ accountId: 'acc1', email: 'a@example.com', interval: 'month', returnUrl: 'https://x.test/account' });
    expect(calls[0].url).toBe('https://test.dodopayments.com/checkouts');
    expect(JSON.parse(String(calls[0].init.body)).product_cart[0].product_id).toBe('pdt_month');
  });
  it('refuses a checkout URL that is not https', async () => {
    enable();
    stubFetch({ checkout_url: 'javascript:alert(1)' });
    await expect(createDodoCheckout({ accountId: 'acc1', email: 'a@example.com', interval: 'month', returnUrl: 'https://x.test' })).rejects.toBeInstanceOf(BillingError);
  });
  it('cancels at the end of the period and resumes, by PATCHing the subscription', async () => {
    enable();
    stubFetch({ subscription_id: 'sub_abc123', status: 'active', next_billing_date: '2026-11-21T00:00:00Z', metadata: { account_id: 'acc1' }, cancel_at_next_billing_date: true });
    expect((await cancelDodo('sub_abc123'))?.cancelAtPeriodEnd).toBe(true);
    expect(calls[0].url).toBe('https://live.dodopayments.com/subscriptions/sub_abc123');
    expect(calls[0].init.method).toBe('PATCH');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ cancel_at_next_billing_date: true });
    await resumeDodo('sub_abc123');
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ cancel_at_next_billing_date: false });
  });
  it('rejects malformed subscription ids before calling Dodo, and turns API errors into BillingError', async () => {
    enable();
    stubFetch({ code: 'NOT_FOUND', message: 'no such subscription' }, 404);
    await expect(cancelDodo('../../etc')).rejects.toBeInstanceOf(BillingError);
    expect(calls).toHaveLength(0);
    await expect(cancelDodo('sub_abc123')).rejects.toThrow('no such subscription');
  });
});
