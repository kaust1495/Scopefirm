import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { beforeAll, describe, expect, it } from 'vitest';
import type { QuoteInput } from './store';

// The store binds its client at module load, so point it at a throwaway file DB first.
const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'scopefirm-accounts-test-')), 'test.db')}`;
process.env.TURSO_DATABASE_URL = dbUrl;

let store: typeof import('./store');

const input: QuoteInput = {
  client: 'Acme', project: 'Site', ask: '', deliverables: 'Pages', exclusions: 'None',
  price: 50000, currency: 'INR', revision_limit: 3, client_email: null, pages_count: null, forms_count: null,
  cms_needed: null, timeline: null, supplier_name: null, supplier_address: null, supplier_gstin: null,
  client_gstin: null, sac_code: null, gst_rate: null, gst_treatment: null, gst_split: null, upi_id: null,
  advance_amount: null, payment_link: null, region: 'IN', valid_until: null,
};

let n = 0;
const freshEmail = () => `user${++n}-${Date.now()}@example.com`;
async function account(referralCode: string | null = null) {
  return store.findOrCreateAccount(freshEmail(), referralCode);
}
/** An owned quote whose client opened the link: the path that activates its owner. */
async function activate(accountId: string) {
  const q = await store.createQuote(input, null, accountId);
  await store.recordView(q.id);
  await store.activateForQuote(q.id);
  return q;
}
const reload = async (id: string) => (await store.getAccount(id))!;

beforeAll(async () => { store = await import('./store'); });

describe('login codes (U1)', () => {
  it('accepts the right code once', async () => {
    const email = freshEmail();
    const code = (await store.issueLoginCode(email))!;
    expect(code).toMatch(/^\d{6}$/);
    expect(await store.consumeLoginCode(email, code)).toBe(true);
    expect(await store.consumeLoginCode(email, code)).toBe(false);
  });

  it('locks after five wrong attempts, even for the right code', async () => {
    const email = freshEmail();
    const code = (await store.issueLoginCode(email))!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect(await store.consumeLoginCode(email, wrong)).toBe(false);
    expect(await store.consumeLoginCode(email, code)).toBe(false);
  });

  it('rejects an expired code', async () => {
    const email = freshEmail();
    const code = (await store.issueLoginCode(email))!;
    const raw = createClient({ url: dbUrl });
    await raw.execute({ sql: 'UPDATE login_codes SET expires_at=? WHERE email=?', args: ['2000-01-01T00:00:00.000Z', email] });
    expect(await store.consumeLoginCode(email, code)).toBe(false);
  });

  it('treats email case and surrounding space as the same address', async () => {
    const base = freshEmail();
    const code = (await store.issueLoginCode(`  ${base.toUpperCase()} `))!;
    expect(await store.consumeLoginCode(base, code)).toBe(true);
    const a = await store.findOrCreateAccount(` ${base.toUpperCase()}`, null);
    const b = await store.findOrCreateAccount(base, null);
    expect(a.id).toBe(b.id);
  });
});

describe('sessions (U1)', () => {
  it('resolves a fresh token, and nothing once deleted', async () => {
    const a = await account();
    const token = await store.createSession(a.id);
    expect((await store.accountForSession(token))?.id).toBe(a.id);
    await store.deleteSession(token);
    expect(await store.accountForSession(token)).toBeNull();
  });

  it('rejects unknown and expired tokens and never stores the raw token', async () => {
    const a = await account();
    const token = await store.createSession(a.id);
    expect(await store.accountForSession('f'.repeat(64))).toBeNull();
    const raw = createClient({ url: dbUrl });
    const rows = await raw.execute('SELECT token_hash FROM sessions');
    expect(rows.rows.some(r => r.token_hash === token)).toBe(false);
    await raw.execute({ sql: 'UPDATE sessions SET expires_at=? WHERE account_id=?', args: ['2000-01-01T00:00:00.000Z', a.id] });
    expect(await store.accountForSession(token)).toBeNull();
  });
});

describe('ownership and limits (U3)', () => {
  it('claims an unowned quote once', async () => {
    const [a, b] = [await account(), await account()];
    const q = await store.createQuote(input);
    expect(await store.claimQuote(q.id, a.id)).toBe(true);
    expect(await store.claimQuote(q.id, b.id)).toBe(false);
    expect((await store.getQuote(q.id))?.account_id).toBe(a.id);
  });

  it('allows 3 active quotes, frees a slot on archive, and refuses unarchive at the limit', async () => {
    const a = await account();
    const quotes = [];
    for (let i = 0; i < 3; i++) quotes.push(await store.createQuote(input, null, a.id));
    expect(await store.quoteAllowance(await reload(a.id))).toMatchObject({ active: 3, limit: 3, canCreate: false });
    expect(await store.setArchived(quotes[0].id, a.id, true)).toBe(true);
    expect((await store.quoteAllowance(await reload(a.id))).canCreate).toBe(true);
    await store.createQuote(input, null, a.id);
    expect(await store.setArchived(quotes[0].id, a.id, false)).toBe(false);
    expect((await store.listAccountQuotes(a.id)).length).toBe(4);
  });

  it('does not let another account archive a quote', async () => {
    const [a, b] = [await account(), await account()];
    const q = await store.createQuote(input, null, a.id);
    expect(await store.setArchived(q.id, b.id, true)).toBe(false);
  });

  it('adds bonus slots to the free limit', async () => {
    const a = await account();
    const raw = createClient({ url: dbUrl });
    await raw.execute({ sql: 'UPDATE accounts SET bonus_slots=2 WHERE id=?', args: [a.id] });
    for (let i = 0; i < 4; i++) await store.createQuote(input, null, a.id);
    expect(await store.quoteAllowance(await reload(a.id))).toMatchObject({ active: 4, limit: 5, canCreate: true });
    await store.createQuote(input, null, a.id);
    expect((await store.quoteAllowance(await reload(a.id))).canCreate).toBe(false);
  });

  it('records the Pro waitlist once', async () => {
    const a = await account();
    await store.joinProWaitlist(a.id);
    const first = (await reload(a.id)).pro_waitlist_at;
    expect(first).toBeTruthy();
    await store.joinProWaitlist(a.id);
    expect((await reload(a.id)).pro_waitlist_at).toBe(first);
  });
});

describe('activation, founders and referrals (U4)', () => {
  // Runs in order: the founder cap is global to this test database.
  it('gives the next founder number and is a no-op the second time', async () => {
    const before = await store.foundersRemaining();
    const a = await account();
    const q = await activate(a.id);
    const after = await reload(a.id);
    expect(after.activated_at).toBeTruthy();
    expect(after.founder_number).toBe(50 - before + 1);
    await store.activateForQuote(q.id);
    expect((await reload(a.id)).founder_number).toBe(after.founder_number);
    expect(await store.foundersRemaining()).toBe(before - 1);
  });

  it('does not activate on a quote nobody owns, or before any client view', async () => {
    const q = await store.createQuote(input);
    await store.recordView(q.id);
    await store.activateForQuote(q.id);
    const a = await account();
    await store.createQuote(input, null, a.id);
    expect((await reload(a.id)).activated_at).toBeNull();
  });

  it('activates the account that claims an already-viewed quote', async () => {
    const a = await account();
    const q = await store.createQuote(input);
    await store.recordView(q.id);
    await store.claimQuote(q.id, a.id);
    expect((await reload(a.id)).activated_at).toBeTruthy();
  });

  it("does not activate on a view from a network the owner signed in from (their own link in a private window)", async () => {
    const a = await account();
    await store.createSession(a.id, '203.0.113.7');
    const q = await store.createQuote(input, null, a.id);
    await store.recordView(q.id, '203.0.113.7');
    await store.activateForQuote(q.id, '203.0.113.7');
    expect((await reload(a.id)).activated_at).toBeNull();
    await store.recordView(q.id, '198.51.100.9');
    await store.activateForQuote(q.id, '198.51.100.9');
    expect((await reload(a.id)).activated_at).toBeTruthy();
  });

  it('still does not activate after the owner signs out (their own link, same network, signed out)', async () => {
    const a = await account();
    const token = await store.createSession(a.id, '203.0.113.20');
    const q = await store.createQuote(input, null, a.id);
    await store.deleteSession(token);
    await store.recordView(q.id, '203.0.113.20');
    await store.activateForQuote(q.id, '203.0.113.20');
    expect((await reload(a.id)).activated_at).toBeNull();
  });

  it('does not activate when a no-signup quote was first opened from the network its creator then signs in from', async () => {
    const a = await account();
    const q = await store.createQuote(input);
    await store.recordView(q.id, '203.0.113.8');
    await store.createSession(a.id, '203.0.113.8');
    await store.claimQuote(q.id, a.id);
    expect((await reload(a.id)).activated_at).toBeNull();
  });

  it('credits both sides once per invitee, capping the inviter at 10', async () => {
    const inviter = await account();
    const invitees = [];
    for (let i = 0; i < 11; i++) invitees.push(await account(inviter.referral_code));
    for (const invitee of invitees) {
      const q = await activate(invitee.id);
      await store.activateForQuote(q.id);
    }
    expect((await reload(inviter.id)).bonus_slots).toBe(20);
    for (const invitee of invitees) expect((await reload(invitee.id)).bonus_slots).toBe(2);
    expect(await store.countActivatedInvitees(inviter.id)).toBe(11);
  });

  it('ignores a referral code for an existing account and an unknown code', async () => {
    const inviter = await account();
    const email = freshEmail();
    await store.findOrCreateAccount(email, null);
    expect((await store.findOrCreateAccount(email, inviter.referral_code)).referred_by).toBeNull();
    expect((await store.findOrCreateAccount(freshEmail(), 'nope')).referred_by).toBeNull();
  });

  it('hands out exactly 50 founder spots, even under concurrent activation', async () => {
    while (await store.foundersRemaining() > 1) await activate((await account()).id);
    const [a, b] = [await account(), await account()];
    const [qa, qb] = [await store.createQuote(input, null, a.id), await store.createQuote(input, null, b.id)];
    await Promise.all([store.recordView(qa.id), store.recordView(qb.id)]);
    await Promise.all([store.activateForQuote(qa.id), store.activateForQuote(qb.id)]);
    const founders = [(await reload(a.id)).founder_number, (await reload(b.id)).founder_number].filter(x => x != null);
    expect(founders).toEqual([50]);
    expect(await store.foundersRemaining()).toBe(0);
    const late = await account();
    await activate(late.id);
    const lateAccount = await reload(late.id);
    expect(lateAccount.activated_at).toBeTruthy();
    expect(lateAccount.founder_number).toBeNull();
  });

  it('gives founders no active-quote limit', async () => {
    const raw = createClient({ url: dbUrl });
    const founder = (await raw.execute('SELECT id FROM accounts WHERE founder_number=1')).rows[0].id as string;
    for (let i = 0; i < 10; i++) await store.createQuote(input, null, founder);
    expect(await store.quoteAllowance(await reload(founder))).toMatchObject({ limit: null, canCreate: true });
  });
});
