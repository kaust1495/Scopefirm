import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Quote, QuoteInput } from './store';

// The store binds its client at module load, so point it at a throwaway file DB first.
process.env.TURSO_DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), 'scopefirm-test-')), 'test.db')}`;

let store: typeof import('./store');

const baseInput: QuoteInput = {
  client: 'Acme', project: 'Brochure site', ask: '', deliverables: '5 pages', exclusions: 'Content writing',
  price: 100000, currency: 'INR', revision_limit: 3, client_email: null, pages_count: null, forms_count: null,
  cms_needed: null, timeline: null, supplier_name: null, supplier_address: null, supplier_gstin: null,
  client_gstin: null, sac_code: null, gst_rate: null, gst_treatment: null, gst_split: null, upi_id: null,
  advance_amount: null, payment_link: null, region: 'IN', valid_until: null,
};

let accepted: Quote;

async function proposedOrder(overrides: Partial<{ title: string; description: string; price: number; advance_amount: number | null }> = {}) {
  const orderId = await store.addChangeOrder(accepted, { title: 'Extra page', description: 'One more page', price: 15000, advance_amount: null, ...overrides });
  const orders = await store.getChangeOrders(accepted.id);
  return { orderId, order: orders.find(o => o.id === orderId)! };
}

beforeAll(async () => {
  store = await import('./store');
  const q = await store.createQuote(baseInput);
  await store.clientAction(q, 'accepted', 'Accepted this exact version. Typed name: Test.');
  accepted = (await store.getQuote(q.id))!;
});

describe('addChangeOrder with an advance', () => {
  it('persists the advance on the order', async () => {
    const { order } = await proposedOrder({ advance_amount: 5000 });
    expect(order.advance_amount).toBe(5000);
    expect(order.advance_paid_at).toBeNull();
  });

  it('rejects an advance larger than the price', async () => {
    await expect(store.addChangeOrder(accepted, { title: 'Bad', description: 'x', price: 100, advance_amount: 200 })).rejects.toThrow(/advance cannot be more than the price/i);
  });
});

describe('decideChangeOrder gate', () => {
  it('parks an order with an advance in awaiting_advance on accept', async () => {
    const { orderId, order } = await proposedOrder({ advance_amount: 5000 });
    expect(order.status).toBe('proposed');
    await store.decideChangeOrder(accepted, orderId, 'accepted');
    const after = (await store.getChangeOrders(accepted.id)).find(o => o.id === orderId)!;
    expect(after.status).toBe('awaiting_advance');
  });

  it('accepts a no-advance order exactly as before', async () => {
    const { orderId } = await proposedOrder();
    await store.decideChangeOrder(accepted, orderId, 'accepted');
    const after = (await store.getChangeOrders(accepted.id)).find(o => o.id === orderId)!;
    expect(after.status).toBe('accepted');
  });

  it('declines an order with an advance to rejected', async () => {
    const { orderId } = await proposedOrder({ advance_amount: 1000 });
    await store.decideChangeOrder(accepted, orderId, 'rejected');
    const after = (await store.getChangeOrders(accepted.id)).find(o => o.id === orderId)!;
    expect(after.status).toBe('rejected');
  });
});

describe('markChangeOrderAdvancePaid (R5)', () => {
  it('sets the mark, flips to in_progress, and writes one change_advance_paid history row', async () => {
    const { orderId } = await proposedOrder({ advance_amount: 5000 });
    await store.decideChangeOrder(accepted, orderId, 'accepted');
    expect(await store.markChangeOrderAdvancePaid(accepted, orderId)).toBe(true);
    const after = (await store.getChangeOrders(accepted.id)).find(o => o.id === orderId)!;
    expect(after.status).toBe('in_progress');
    expect(after.advance_paid_at).toBeTruthy();
    const rows = (await store.getHistory(accepted.id)).filter(h => h.kind === 'change_advance_paid');
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toContain('Extra page');
  });

  it('is a no-op outside awaiting_advance', async () => {
    const { orderId } = await proposedOrder({ advance_amount: 5000 });
    expect(await store.markChangeOrderAdvancePaid(accepted, orderId)).toBe(false);
    const rows = (await store.getHistory(accepted.id)).filter(h => h.kind === 'change_advance_paid');
    expect(rows).toHaveLength(1); // only the one written by the previous test
  });
});

describe('AE1: advance equal to price', () => {
  it('settles with no balance step and leaves paid_at null', async () => {
    const { orderId } = await proposedOrder({ price: 6000, advance_amount: 6000 });
    await store.decideChangeOrder(accepted, orderId, 'accepted');
    await store.markChangeOrderAdvancePaid(accepted, orderId);
    const after = (await store.getChangeOrders(accepted.id)).find(o => o.id === orderId)!;
    expect(after.status).toBe('in_progress');
    expect(after.paid_at).toBeNull();
    expect(store.orderBalance(after)).toBe(0);
  });
});

describe('AE2: partial advance produces a balance that closes out', () => {
  it('balance computes as price minus advance and paid_at closes it with a change_paid row', async () => {
    const { orderId } = await proposedOrder({ price: 15000, advance_amount: 5000 });
    await store.decideChangeOrder(accepted, orderId, 'accepted');
    await store.markChangeOrderAdvancePaid(accepted, orderId);
    const mid = (await store.getChangeOrders(accepted.id)).find(o => o.id === orderId)!;
    expect(store.orderBalance(mid)).toBe(10000);
    expect(await store.markChangeOrderPaid(accepted, orderId)).toBe(true);
    const closed = (await store.getChangeOrders(accepted.id)).find(o => o.id === orderId)!;
    expect(closed.paid_at).toBeTruthy();
    const rows = (await store.getHistory(accepted.id)).filter(h => h.kind === 'change_paid');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some(r => r.note.includes('Extra page'))).toBe(true);
  });
});

describe('R10 regression: the no-advance path is unchanged', () => {
  it('accept then mark-received produces the same statuses and history kinds as before', async () => {
    // Earlier tests share this quote's history; count advance rows so this flow is judged on its own writes.
    const advanceRowsBefore = (await store.getHistory(accepted.id)).filter(h => h.kind === 'change_advance_paid').length;
    const { orderId } = await proposedOrder({ price: 8000 });
    await store.decideChangeOrder(accepted, orderId, 'accepted');
    const order = (await store.getChangeOrders(accepted.id)).find(o => o.id === orderId)!;
    expect(order.status).toBe('accepted');
    expect(order.advance_amount).toBeNull();
    expect(await store.markChangeOrderPaid(accepted, orderId)).toBe(true);
    const after = (await store.getChangeOrders(accepted.id)).find(o => o.id === orderId)!;
    expect(after.paid_at).toBeTruthy();
    expect(after.advance_paid_at).toBeNull();
    const history = await store.getHistory(accepted.id);
    const kinds = history.map(h => h.kind);
    expect(kinds).toContain('change_proposed');
    expect(kinds).toContain('change_accepted');
    expect(kinds).toContain('change_paid');
    expect(history.filter(h => h.kind === 'change_advance_paid').length).toBe(advanceRowsBefore);
  });
});
