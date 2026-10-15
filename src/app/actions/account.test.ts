import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The store binds its client at module load, so point it at a throwaway file DB first.
process.env.TURSO_DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), 'scopefirm-account-actions-')), 'test.db')}`;

// Server actions redirect on every path; capture the target instead of crashing.
class RedirectError extends Error { constructor(public url: string) { super(`NEXT_REDIRECT:${url}`); } }
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new RedirectError(url); }, notFound: () => { throw new RedirectError('404'); } }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
// A real cookie jar, so session, anonymous-quote and referral cookies are tracked separately.
const jar = new Map<string, string>();
let ip = '10.0.0.1';
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name)! } : undefined),
    set: (name: string, value: string, options?: { maxAge?: number }) => { if (options?.maxAge === 0) jar.delete(name); else jar.set(name, value); },
  }),
  headers: async () => new Headers({ 'x-real-ip': ip }),
}));
const sent: { to: string; code: string }[] = [];
vi.mock('@/lib/email', async (original) => ({
  ...(await original<typeof import('@/lib/email')>()),
  emailEnabled: () => true,
  sendLoginCode: async (to: string, code: string) => { sent.push({ to, code }); return true; },
}));

let store: typeof import('@/lib/store');
let quoteActions: typeof import('./index');
let accountActions: typeof import('./account');

const quoteForm = () => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ client: 'Acme', project: 'Site', ask: '', deliverables: 'Pages', exclusions: 'None', price: '50000', currency: 'INR', revision_limit: '3', region: 'OTHER' })) f.set(k, v);
  return f;
};
async function run(action: () => Promise<unknown>) {
  try { await action(); } catch (e) { if (e instanceof RedirectError) return e.url; throw e; }
  throw new Error('expected a redirect');
}
let n = 0;
const email = () => `free${++n}-${Date.now()}@example.com`;
async function signIn(address = email(), next = '/account') {
  const ask = new FormData(); ask.set('email', address);
  await run(() => accountActions.requestLoginCode(ask));
  const code = sent.filter(s => s.to === address).at(-1)!.code;
  const verify = new FormData(); verify.set('email', address); verify.set('code', code); verify.set('next', next);
  return run(() => accountActions.verifyLoginCode(verify));
}
const sessionAccount = async () => (await store.accountForSession(jar.get('firmquote_session')))!;

beforeAll(async () => {
  store = await import('@/lib/store');
  quoteActions = await import('./index');
  accountActions = await import('./account');
});
beforeEach(() => { jar.clear(); ip = `10.0.${n % 250}.${(n * 7) % 250}`; });

describe('sign-in (U2)', () => {
  it('Covers F1 / AE1: the free quote, then sign-in attaches it', async () => {
    const first = await run(() => quoteActions.makeQuote(quoteForm()));
    expect(first).toMatch(/^\/quotes\/[a-f0-9]{24}\?created=1$/);
    const quoteId = first.split('/')[2].split('?')[0];
    expect(jar.get('firmquote_anon_quote')?.startsWith(`${quoteId}.`)).toBe(true);
    expect(await run(() => quoteActions.makeQuote(quoteForm()))).toBe('/signin?next=/&error=signin');
    expect(await signIn()).toBe('/account');
    expect((await store.getQuote(quoteId))?.account_id).toBe((await sessionAccount()).id);
    expect(jar.has('firmquote_anon_quote')).toBe(false);
    const second = await run(() => quoteActions.makeQuote(quoteForm()));
    expect((await store.getQuote(second.split('/')[2].split('?')[0]))?.account_id).toBe((await sessionAccount()).id);
  });

  it('does not claim a quote named only by its public id in a forged free-quote cookie', async () => {
    const victim = await run(() => quoteActions.makeQuote(quoteForm()));
    const victimId = victim.split('/')[2].split('?')[0];
    jar.clear();
    // The id is public: it is in every client link. Without the editor key it must not be claimable.
    jar.set('firmquote_anon_quote', victimId);
    await signIn();
    expect((await store.getQuote(victimId))?.account_id).toBeNull();
  });

  it('a wrong code sets no session', async () => {
    const address = email();
    const ask = new FormData(); ask.set('email', address);
    await run(() => accountActions.requestLoginCode(ask));
    const code = sent.at(-1)!.code;
    const verify = new FormData(); verify.set('email', address); verify.set('code', code === '000000' ? '111111' : '000000');
    expect(await run(() => accountActions.verifyLoginCode(verify))).toContain('error=signinCode');
    expect(jar.has('firmquote_session')).toBe(false);
  });

  it('limits code requests to 3 per 15 minutes per address', async () => {
    const address = email();
    const ask = new FormData(); ask.set('email', address);
    for (let i = 0; i < 3; i++) expect(await run(() => accountActions.requestLoginCode(ask))).toContain('step=code');
    expect(await run(() => accountActions.requestLoginCode(ask))).toContain('error=signinRate');
  });

  it('rejects an invalid email', async () => {
    const ask = new FormData(); ask.set('email', 'not-an-email');
    expect(await run(() => accountActions.requestLoginCode(ask))).toContain('error=email');
  });

  it('ignores an off-site next', async () => {
    expect(await signIn(email(), '//evil.example/x')).toBe('/account');
  });

  it('signs out', async () => {
    await signIn();
    const token = jar.get('firmquote_session')!;
    await run(() => accountActions.signOut());
    expect(jar.has('firmquote_session')).toBe(false);
    expect(await store.accountForSession(token)).toBeNull();
  });

  it('records a referral from the invite cookie for a new account only', async () => {
    await signIn();
    const inviter = await sessionAccount();
    jar.clear();
    jar.set('firmquote_ref', inviter.referral_code);
    await signIn();
    expect((await sessionAccount()).referred_by).toBe(inviter.id);
    expect(jar.has('firmquote_ref')).toBe(false);
  });
});

describe('create gate and limits (U3)', () => {
  it('Covers AE4: at the limit only new quotes are blocked', async () => {
    await signIn();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await run(() => quoteActions.makeQuote(quoteForm()))).split('/')[2].split('?')[0]);
    expect(await run(() => quoteActions.makeQuote(quoteForm()))).toBe('/limit');
    // Duplicating is creating too.
    const q = (await store.getQuote(ids[0]))!;
    jar.set(`scopefirm_editor_${q.id}`, q.edit_key);
    const dup = quoteForm(); dup.set('id', q.id);
    expect(await run(() => quoteActions.duplicateQuoteAction(dup))).toBe('/limit');
    // Existing quotes keep working: the client accepts, the freelancer proposes a change, the client accepts it.
    await store.clientAction(q, 'accepted', 'Riya');
    const accepted = (await store.getQuote(q.id))!;
    const orderId = await store.addChangeOrder(accepted, { title: 'Extra page', description: 'One more', price: 5000, advance_amount: null });
    expect(await store.decideChangeOrder(accepted, orderId, 'accepted')).toBe(true);
    // Archiving frees a slot.
    const archive = new FormData(); archive.set('id', ids[1]); archive.set('archived', '1');
    expect(await run(() => accountActions.setArchivedAction(archive))).toBe('/account');
    expect(await run(() => quoteActions.makeQuote(quoteForm()))).toMatch(/created=1$/);
  });

  it('opens an owned tracker through the dashboard route only for the owner', async () => {
    await signIn();
    const quoteId = (await run(() => quoteActions.makeQuote(quoteForm()))).split('/')[2].split('?')[0];
    const owner = jar.get('firmquote_session')!;
    const { ownedQuote } = await import('@/lib/session');
    expect(await ownedQuote(quoteId)).not.toBeNull();
    jar.clear();
    await signIn();
    expect(await ownedQuote(quoteId)).toBeNull();
    jar.set('firmquote_session', owner);
  });

  it('claims a quote the visitor holds the editor cookie for', async () => {
    jar.clear();
    const quoteId = (await run(() => quoteActions.makeQuote(quoteForm()))).split('/')[2].split('?')[0];
    const q = (await store.getQuote(quoteId))!;
    jar.delete('firmquote_anon_quote');
    await signIn();
    const claim = new FormData(); claim.set('id', quoteId);
    jar.set(`scopefirm_editor_${quoteId}`, q.edit_key);
    expect(await run(() => accountActions.claimQuoteAction(claim))).toBe(`/quotes/${quoteId}`);
    expect((await store.getQuote(quoteId))?.account_id).toBe((await sessionAccount()).id);
  });

  it('joins the Pro waitlist', async () => {
    await signIn();
    expect(await run(() => accountActions.joinWaitlistAction())).toBe('/limit?waitlist=1');
    expect((await sessionAccount()).pro_waitlist_at).toBeTruthy();
  });
});
