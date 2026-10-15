import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The store binds its client at module load, so point it at a throwaway file DB first.
process.env.TURSO_DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), 'firmquote-billing-actions-')), 'test.db')}`;

class RedirectError extends Error { constructor(public url: string) { super(`NEXT_REDIRECT:${url}`); } }
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new RedirectError(url); } }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers({ host: 'localhost:3000' }) }));
let signedIn: import('@/lib/store').Account | null = null;
vi.mock('@/lib/session', () => ({ currentAccount: async () => signedIn }));

let store: typeof import('@/lib/store');
let actions: typeof import('./billing');
const day = 24 * 60 * 60 * 1000;

async function redirectOf(run: Promise<unknown>) {
  try { await run; } catch (error) { if (error instanceof RedirectError) return error.url; throw error; }
  throw new Error('expected a redirect');
}
const form = (fields: Record<string, string | Blob>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };
let n = 0;
const fresh = async () => store.findOrCreateAccount(`act${++n}-${Date.now()}@example.com`, null);
const reload = async (id: string) => (await store.getAccount(id))!;

beforeAll(async () => { store = await import('@/lib/store'); actions = await import('./billing'); });
beforeEach(() => {
  vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test'); vi.stubEnv('RAZORPAY_KEY_SECRET', 's'); vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', 'w');
  vi.stubEnv('RAZORPAY_PLAN_MONTHLY', 'plan_m'); vi.stubEnv('RAZORPAY_PLAN_YEARLY', 'plan_y');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); signedIn = null; });

describe('startCheckout', () => {
  it('sends a free account to the Razorpay link and remembers the pending subscription', async () => {
    signedIn = await fresh();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'sub_ACTION0001', short_url: 'https://rzp.io/i/x', status: 'created' }))));
    expect(await redirectOf(actions.startCheckout(form({ provider: 'razorpay', interval: 'month', from: 'limit' })))).toBe('https://rzp.io/i/x');
    expect(await reload(signedIn.id)).toMatchObject({ billing_provider: 'razorpay', subscription_id: 'sub_ACTION0001', subscription_status: 'created' });
  });

  it('never charges founders or current Pro accounts', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    signedIn = { ...(await fresh()), founder_number: 3 };
    expect(await redirectOf(actions.startCheckout(form({ provider: 'razorpay', interval: 'year' })))).toBe('/account');
    signedIn = { ...(await fresh()), pro_until: new Date(Date.now() + day).toISOString() };
    expect(await redirectOf(actions.startCheckout(form({ provider: 'razorpay', interval: 'year' })))).toBe('/account');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a provider that is not configured and asks signed-out visitors to sign in', async () => {
    signedIn = await fresh();
    expect(await redirectOf(actions.startCheckout(form({ provider: 'stripe', interval: 'month', from: 'limit' })))).toBe('/limit?error=billingOff');
    signedIn = null;
    expect(await redirectOf(actions.startCheckout(form({ provider: 'razorpay', interval: 'month' })))).toBe('/signin?next=/account');
  });

  it('reports a provider failure without leaving a pending subscription', async () => {
    signedIn = await fresh();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"description":"bad plan"}}', { status: 400 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await redirectOf(actions.startCheckout(form({ provider: 'razorpay', interval: 'month' })))).toBe('/account?error=billing');
    expect((await reload(signedIn.id)).subscription_id).toBeNull();
  });
});

describe('cancelSubscriptionAction', () => {
  it('needs the confirm box, then cancels at period end and records it', async () => {
    const a = await fresh();
    const end = Math.floor((Date.now() + 20 * day) / 1000);
    await store.applySubscription(a.id, { provider: 'razorpay', subscriptionId: 'sub_CANCEL001', accountId: a.id, status: 'active', entitled: true, periodEnd: new Date(end * 1000), cancelAtPeriodEnd: null });
    signedIn = await reload(a.id);
    expect(await redirectOf(actions.cancelSubscriptionAction(form({})))).toBe('/account?error=cancelConfirm#plan');
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'sub_CANCEL001', status: 'active', current_end: end, notes: { account_id: a.id } })));
    vi.stubGlobal('fetch', fetch);
    expect(await redirectOf(actions.cancelSubscriptionAction(form({ confirm: 'yes' })))).toBe('/account?billing=cancelled#plan');
    const after = await reload(a.id);
    expect(after.cancel_at_period_end).toBe(1);
    expect(store.isPro(after)).toBe(true);
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toContain('/sub_CANCEL001/cancel');
  });
});

describe('resumeSubscriptionAction', () => {
  it('turns renewal back on for a cancelled Stripe subscription', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk'); vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'w'); vi.stubEnv('STRIPE_PRICE_MONTHLY', 'p'); vi.stubEnv('STRIPE_PRICE_YEARLY', 'p');
    const a = await fresh();
    const end = Math.floor((Date.now() + 20 * day) / 1000);
    await store.applySubscription(a.id, { provider: 'stripe', subscriptionId: 'sub_RESUME1', accountId: a.id, status: 'active', entitled: true, periodEnd: new Date(end * 1000), cancelAtPeriodEnd: true });
    signedIn = await reload(a.id);
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'sub_RESUME1', status: 'active', current_period_end: end, cancel_at_period_end: false, metadata: { account_id: a.id } })));
    vi.stubGlobal('fetch', fetch);
    expect(await redirectOf(actions.resumeSubscriptionAction())).toBe('/account?billing=resumed#plan');
    expect((await reload(a.id)).cancel_at_period_end).toBe(0);
    expect(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)).toBe('cancel_at_period_end=false');
  });
  it('does nothing for Razorpay, which cannot resume', async () => {
    const a = await fresh();
    await store.applySubscription(a.id, { provider: 'razorpay', subscriptionId: 'sub_RESUME02', accountId: a.id, status: 'active', entitled: true, periodEnd: new Date(Date.now() + day), cancelAtPeriodEnd: true });
    signedIn = await reload(a.id);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await redirectOf(actions.resumeSubscriptionAction())).toBe('/account#plan');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('saveBrandingAction', () => {
  const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])], { type: 'image/png' });
  it('is Pro-only', async () => {
    signedIn = await fresh();
    expect(await redirectOf(actions.saveBrandingAction(form({ use_color: 'on', brand_color: '#112233' })))).toBe('/account?error=proOnly#branding');
  });
  it('saves a valid colour and logo, and refuses SVG or oversized files whatever their declared type', async () => {
    signedIn = { ...(await fresh()), founder_number: 4 };
    expect(await redirectOf(actions.saveBrandingAction(form({ use_color: 'on', brand_color: 'red' })))).toBe('/account?error=brandColor#branding');
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/png' });
    expect(await redirectOf(actions.saveBrandingAction(form({ logo: new File([svg], 'logo.png') })))).toBe('/account?error=logo#branding');
    expect(await redirectOf(actions.saveBrandingAction(form({ logo: new File([new Uint8Array(200 * 1024 + 1)], 'big.png') })))).toBe('/account?error=logo#branding');
    expect(await redirectOf(actions.saveBrandingAction(form({ use_color: 'on', brand_color: '#AABBCC', logo: new File([png()], 'logo.png') })))).toBe('/account?branding=saved#branding');
    const saved = await reload(signedIn.id);
    expect(saved.brand_color).toBe('#aabbcc');
    expect((await store.getBrandLogo(signedIn.id))?.type).toBe('image/png');
  });
});
