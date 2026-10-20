import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// The store binds its client at module load, so point it at a throwaway file DB first.
process.env.TURSO_DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), 'scopefirm-actions-test-')), 'test.db')}`;

// Server actions redirect on every failure path; capture the target instead of crashing.
class RedirectError extends Error { constructor(public url: string) { super(`NEXT_REDIRECT:${url}`); } }
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new RedirectError(url); } }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
// Cookies are the editor auth; tests control them per case.
let cookieValue: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (cookieValue === undefined ? undefined : { value: cookieValue }), set: () => {} }),
  headers: async () => new Headers({ 'x-real-ip': '127.0.0.1' }),
}));

let store: typeof import('@/lib/store');
let actions: typeof import('./index');

const baseInput = {
  client: 'Acme', project: 'Site', ask: '', deliverables: 'Pages', exclusions: 'None',
  price: 50000, currency: 'INR' as const, revision_limit: 3, client_email: null, pages_count: null,
  forms_count: null, cms_needed: null, timeline: null, supplier_name: null, supplier_address: null,
  supplier_gstin: null, client_gstin: null, sac_code: null, gst_rate: null, gst_treatment: null,
  gst_split: null, upi_id: 'ravi@okaxis', advance_amount: null, payment_link: null, region: 'IN' as const,
  valid_until: null,
};

let q: import('@/lib/store').Quote;

function orderForm(fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

beforeAll(async () => {
  store = await import('@/lib/store');
  actions = await import('./index');
  const created = await store.createQuote(baseInput);
  await store.clientAction(created, 'accepted', 'Accepted this exact version. Typed name: Test.');
  q = (await store.getQuote(created.id))!;
  cookieValue = q.edit_key;
});

describe('proposeChangeOrder advance validation', () => {
  it('rejects an advance greater than the price and creates no order', async () => {
    const before = (await store.getChangeOrders(q.id)).length;
    const err = await actions.proposeChangeOrder(orderForm({ id: q.id, title: 'Too big', description: 'x', price: '1000', advance_amount: '2000' }))
      .then(() => null, (e) => e as RedirectError);
    expect(err?.url).toContain('error=order');
    expect((await store.getChangeOrders(q.id)).length).toBe(before);
  });

  it('creates the order with a valid advance persisted', async () => {
    await actions.proposeChangeOrder(orderForm({ id: q.id, title: 'With advance', description: 'x', price: '9000', advance_amount: '3000' }))
      .then(() => null, (e) => e as RedirectError);
    const order = (await store.getChangeOrders(q.id)).find(o => o.title === 'With advance')!;
    expect(order).toBeTruthy();
    expect(order.advance_amount).toBe(3000);
  });

  it('treats an empty advance field as no advance', async () => {
    await actions.proposeChangeOrder(orderForm({ id: q.id, title: 'No advance', description: 'x', price: '4000', advance_amount: '' }))
      .then(() => null, (e) => e as RedirectError);
    const order = (await store.getChangeOrders(q.id)).find(o => o.title === 'No advance')!;
    expect(order).toBeTruthy();
    expect(order.advance_amount).toBeNull();
  });
});

describe('markChangeOrderAdvancePaidAction editor auth', () => {
  it('redirects without the editor cookie and mutates nothing', async () => {
    const order = (await store.getChangeOrders(q.id)).find(o => o.title === 'With advance')!;
    cookieValue = undefined;
    const err = await actions.markChangeOrderAdvancePaidAction(orderForm({ id: q.id, order_id: order.id }))
      .then(() => null, (e) => e as RedirectError);
    expect(err?.url).toContain('error=editor');
    const after = (await store.getChangeOrders(q.id)).find(o => o.id === order.id)!;
    expect(after.status).toBe('proposed');
    expect(after.advance_paid_at).toBeNull();
    cookieValue = q.edit_key;
  });
});

describe('change-order decisions and payment corrections', () => {
  it('requires a typed name to accept and DECLINE to decline', async () => {
    const order = (await store.getChangeOrders(q.id)).find(o => o.title === 'With advance')!;
    let err = await actions.respondToChangeOrder(orderForm({ id: q.id, order_id: order.id, choice: 'accepted' }))
      .then(() => null, (e) => e as RedirectError);
    expect(err?.url).toContain('error=response');
    err = await actions.respondToChangeOrder(orderForm({ id: q.id, order_id: order.id, choice: 'rejected' }))
      .then(() => null, (e) => e as RedirectError);
    expect(err?.url).toContain('error=orderConfirm');
    expect((await store.getChangeOrders(q.id)).find(o => o.id === order.id)!.status).toBe('proposed');
  });

  it('accepts with a typed name, then requires RECEIVED and UNDO for payment marks', async () => {
    const order = (await store.getChangeOrders(q.id)).find(o => o.title === 'With advance')!;
    await actions.respondToChangeOrder(orderForm({ id: q.id, order_id: order.id, choice: 'accepted', name: 'Client Tester' }))
      .then(() => null, (e) => e as RedirectError);
    expect((await store.getChangeOrders(q.id)).find(o => o.id === order.id)!.status).toBe('awaiting_advance');

    let err = await actions.markChangeOrderAdvancePaidAction(orderForm({ id: q.id, order_id: order.id }))
      .then(() => null, (e) => e as RedirectError);
    expect(err?.url).toContain('error=paymentConfirm');
    expect((await store.getChangeOrders(q.id)).find(o => o.id === order.id)!.advance_paid_at).toBeNull();

    await actions.markChangeOrderAdvancePaidAction(orderForm({ id: q.id, order_id: order.id, confirm: 'RECEIVED' }))
      .then(() => null, (e) => e as RedirectError);
    expect((await store.getChangeOrders(q.id)).find(o => o.id === order.id)!.status).toBe('in_progress');

    err = await actions.undoChangeOrderAdvancePaidAction(orderForm({ id: q.id, order_id: order.id }))
      .then(() => null, (e) => e as RedirectError);
    expect(err?.url).toContain('error=undoConfirm');
    expect((await store.getChangeOrders(q.id)).find(o => o.id === order.id)!.status).toBe('in_progress');

    await actions.undoChangeOrderAdvancePaidAction(orderForm({ id: q.id, order_id: order.id, undo: 'UNDO' }))
      .then(() => null, (e) => e as RedirectError);
    const after = (await store.getChangeOrders(q.id)).find(o => o.id === order.id)!;
    expect(after.status).toBe('awaiting_advance');
    expect(after.advance_paid_at).toBeNull();
  });

  it('requires RECEIVED before marking payment and UNDO before reversing it', async () => {
    const order = (await store.getChangeOrders(q.id)).find(o => o.title === 'No advance')!;
    await actions.respondToChangeOrder(orderForm({ id: q.id, order_id: order.id, choice: 'accepted', name: 'Client Tester' }))
      .then(() => null, (e) => e as RedirectError);

    let err = await actions.markChangeOrderPaidAction(orderForm({ id: q.id, order_id: order.id }))
      .then(() => null, (e) => e as RedirectError);
    expect(err?.url).toContain('error=paymentConfirm');
    expect((await store.getChangeOrders(q.id)).find(o => o.id === order.id)!.paid_at).toBeNull();

    await actions.markChangeOrderPaidAction(orderForm({ id: q.id, order_id: order.id, confirm: 'RECEIVED' }))
      .then(() => null, (e) => e as RedirectError);
    expect((await store.getChangeOrders(q.id)).find(o => o.id === order.id)!.paid_at).toBeTruthy();

    err = await actions.undoChangeOrderPaidAction(orderForm({ id: q.id, order_id: order.id }))
      .then(() => null, (e) => e as RedirectError);
    expect(err?.url).toContain('error=undoConfirm');
    expect((await store.getChangeOrders(q.id)).find(o => o.id === order.id)!.paid_at).toBeTruthy();

    await actions.undoChangeOrderPaidAction(orderForm({ id: q.id, order_id: order.id, undo: 'UNDO' }))
      .then(() => null, (e) => e as RedirectError);
    expect((await store.getChangeOrders(q.id)).find(o => o.id === order.id)!.paid_at).toBeNull();
  });
});

describe('markAdvancePaidAction confirmation and undo', () => {
  it('requires RECEIVED before marking and UNDO before reversing', async () => {
    const created = await store.createQuote({ ...baseInput, project: 'Advance quote', advance_amount: 1000 });
    await store.clientAction(created, 'accepted', 'Accepted this exact version. Typed name: Test.');
    const advanceQuote = (await store.getQuote(created.id))!;
    cookieValue = advanceQuote.edit_key;

    let err = await actions.markAdvancePaidAction(orderForm({ id: advanceQuote.id }))
      .then(() => null, (e) => e as RedirectError);
    expect(err?.url).toContain('error=paymentConfirm');
    expect((await store.getQuote(advanceQuote.id))!.advance_paid_at).toBeNull();

    await actions.markAdvancePaidAction(orderForm({ id: advanceQuote.id, confirm: 'RECEIVED' }))
      .then(() => null, (e) => e as RedirectError);
    expect((await store.getQuote(advanceQuote.id))!.advance_paid_at).toBeTruthy();

    err = await actions.undoAdvancePaidAction(orderForm({ id: advanceQuote.id }))
      .then(() => null, (e) => e as RedirectError);
    expect(err?.url).toContain('error=undoConfirm');
    expect((await store.getQuote(advanceQuote.id))!.advance_paid_at).toBeTruthy();

    await actions.undoAdvancePaidAction(orderForm({ id: advanceQuote.id, undo: 'UNDO' }))
      .then(() => null, (e) => e as RedirectError);
    expect((await store.getQuote(advanceQuote.id))!.advance_paid_at).toBeNull();
    cookieValue = q.edit_key;
  });
});
