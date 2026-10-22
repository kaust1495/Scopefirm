// Smoke test for Dodo checkout wiring against a build with Dodo enabled in test mode with dummy keys.
// Expects: Dodo buttons on /limit, a checkout click that reaches Dodo's API and comes back with a clean error,
// and the webhook endpoint refusing unsigned calls. Run with E2E_BASE, E2E_DB and E2E_EMAILS set.
import { Visitor, db, lastCode, quoteId, test, expect, eq, summary } from './harness.mjs';

const form = { client: 'Smoke', project: 'Dodo smoke', deliverables: 'A', exclusions: 'B', price: '1000', currency: 'INR', region: 'IN', revision_limit: '1' };
const v = new Visitor('10.88.0.1');
const email = `dodo-smoke-${Date.now()}@example.com`;

await test('a free account at its limit sees Dodo checkout buttons with ₹ prices from India', async () => {
  const ask = await v.submit('/signin', 'Email me a code', { email });
  const page = await v.get(ask.location);
  await v.submit({ body: page.body, path: '/signin' }, 'name="code"', { code: lastCode(email, 'sign-in') });
  const acc = (await db.execute({ sql: 'SELECT id FROM accounts WHERE email=?', args: [email] })).rows[0];
  await db.execute({ sql: 'UPDATE accounts SET founder_number=NULL WHERE id=?', args: [acc.id] });
  for (let i = 0; i < 3; i++) quoteId((await v.submit('/', 'name="client"', form)).location);
  const limit = await v.request('/limit', { headers: { 'x-vercel-ip-country': 'IN' } });
  eq(limit.status, 200, 'limit page');
  expect(limit.body.includes('Upgrade to Pro'), 'no Dodo offer');
  expect(limit.body.includes('value="dodo"'), 'no dodo provider field');
  expect(limit.body.includes('₹299') && limit.body.includes('₹1,999'), 'no rupee prices');
  expect(!limit.body.includes('Join the Pro waitlist'), 'waitlist still shown');
});
await test('clicking a plan reaches Dodo (test mode) and a rejected key returns a clean error, not a crash', async () => {
  const r = await v.submit({ body: (await v.get('/limit')).body, path: '/limit' }, /value="dodo"[\s\S]*value="month"/);
  eq(r.status, 303, 'checkout response');
  expect(r.location?.includes('error=billing'), `expected billing error redirect, got ${r.location}`);
});
await test('the Dodo webhook refuses unsigned calls', async () => {
  const r = await new Visitor().request('/api/billing/dodo', { method: 'POST', body: '{"type":"subscription.active","data":{"subscription_id":"sub_x"}}', headers: { 'content-type': 'application/json' } });
  eq(r.status, 400, 'unsigned webhook');
});
await test('the security policy lets the checkout form leave for Dodo', async () => {
  const csp = (await new Visitor().get('/')).headers.get('content-security-policy') || '';
  expect(csp.includes('https://checkout.dodopayments.com') && csp.includes('https://test.checkout.dodopayments.com'), 'form-action missing Dodo');
});

const s = summary('Dodo smoke');
process.exit(s.failures.length ? 1 : 0);
