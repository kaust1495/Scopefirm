// Stress suite: load on the hot pages, then concurrency races on every state change that must happen once.
import { Visitor, db, lastCode, quoteId, test, expect, eq, summary, results } from './harness.mjs';
import { writeFileSync } from 'node:fs';

const one = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];
const count = async (sql, args = []) => Number((await one(sql, args)).n);
const quoteForm = (over = {}) => ({ client: 'Load Client', project: 'Load test', deliverables: 'Pages', exclusions: 'None', price: '10000', currency: 'INR', region: 'IN', revision_limit: '2', ...over });
const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let ipN = 0;
const freshIp = () => { ipN++; return `172.${16 + (ipN >> 16) % 16}.${(ipN >> 8) & 255}.${ipN & 255}`; };
const metrics = {};

async function pool(n, concurrency, task) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => { while (i < n) { const k = i++; out[k] = await task(k); } }));
  return out;
}
const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))];

async function signIn(v, email) {
  const ask = await v.submit('/signin', 'Email me a code', { email });
  expect(ask.location?.includes('step=code'), `code request: ${ask.location}`);
  const page = await v.get(ask.location);
  const r = await v.submit({ body: page.body, path: '/signin' }, 'name="code"', { code: lastCode(email, 'sign-in') });
  expect(v.cookie('firmquote_session'), `sign-in failed for ${email}: ${r.location}`);
  return one('SELECT * FROM accounts WHERE email=?', [email.toLowerCase()]);
}
/** A freelancer with an accepted quote, ready for change orders. */
async function acceptedQuote() {
  const fl = new Visitor(freshIp());
  const qid = quoteId((await fl.submit('/', 'name="client"', quoteForm())).location);
  await new Visitor(freshIp()).submit(`/q/${qid}`, 'Accept version', { name: 'Client' });
  eq((await one('SELECT status FROM quotes WHERE id=?', [qid])).status, 'accepted', 'setup accept');
  return { fl, qid };
}

console.log('\n# Load');
const seed = await acceptedQuote();
await test('2,000 mixed page loads at 50 concurrent: no errors, p95 under 1.5 s', async () => {
  const paths = ['/', `/q/${seed.qid}`, '/blog', '/how-it-works', `/quotes/${seed.qid}`, '/signin'];
  const visitors = Array.from({ length: 50 }, () => new Visitor(freshIp()));
  for (const v of visitors) for (const c of seed.fl.jar.values()) v.jar.set(`${c.name}|${c.path}`, c);
  const lat = [], errors = []; const t0 = Date.now();
  await pool(2000, 50, async k => {
    const v = visitors[k % 50], p = paths[k % paths.length], s = Date.now();
    const r = await v.get(p); lat.push(Date.now() - s);
    if (r.status !== 200) errors.push(`${p} ${r.status}`);
  });
  const secs = (Date.now() - t0) / 1000;
  metrics.load = { requests: 2000, concurrency: 50, seconds: +secs.toFixed(1), rps: Math.round(2000 / secs), p50: pct(lat, .5), p95: pct(lat, .95), p99: pct(lat, .99), max: Math.max(...lat), errors: errors.length };
  console.log('        ', JSON.stringify(metrics.load));
  eq(errors.length, 0, `errors (${errors.slice(0, 3).join('; ')})`);
  expect(metrics.load.p95 < 1500, `p95 ${metrics.load.p95} ms`);
});
await test('300 quote creations from 300 freelancers at 30 concurrent: all saved, none lost', async () => {
  const before = await count('SELECT COUNT(*) n FROM quotes');
  const lat = [];
  const res = await pool(300, 30, async k => { const s = Date.now(); const r = await new Visitor(freshIp()).submit('/', 'name="client"', quoteForm({ project: `Bulk ${k}` })); lat.push(Date.now() - s); return r; });
  const ok = res.filter(r => r.status === 303 && quoteId(r.location)).length;
  metrics.create = { requests: 300, concurrency: 30, ok, p50: pct(lat, .5), p95: pct(lat, .95), max: Math.max(...lat) };
  console.log('        ', JSON.stringify(metrics.create));
  eq(ok, 300, 'created'); eq(await count('SELECT COUNT(*) n FROM quotes') - before, 300, 'rows');
});

console.log('\n# Races: things that must happen exactly once');
await test('30 clients accept the same version at once: exactly one acceptance recorded', async () => {
  const fl = new Visitor(freshIp());
  const qid = quoteId((await fl.submit('/', 'name="client"', quoteForm())).location);
  const page = await new Visitor(freshIp()).get(`/q/${qid}`);
  const res = await Promise.all(Array.from({ length: 30 }, () => new Visitor(freshIp()).submit({ body: page.body, path: `/q/${qid}` }, 'Accept version', { name: 'Client' })));
  expect(res.every(r => r.status === 303), `non-redirect responses: ${res.filter(r => r.status !== 303).map(r => r.status).join(',')}`);
  eq(await count("SELECT COUNT(*) n FROM history WHERE quote_id=? AND kind='accepted'", [qid]), 1, 'accepted history rows');
});
await test('20 parallel accept/decline clicks on one change order: one decision', async () => {
  const { fl, qid } = await acceptedQuote();
  await fl.submit(`/quotes/${qid}`, 'Propose change order', { title: 'Race', description: 'x', price: '500' });
  const orderId = (await one('SELECT id FROM change_orders WHERE quote_id=?', [qid])).id;
  const page = await new Visitor(freshIp()).get(`/q/${qid}`);
  await Promise.all(Array.from({ length: 20 }, (_, i) => new Visitor(freshIp()).submit({ body: page.body, path: `/q/${qid}` }, new RegExp(`value="${orderId}"[\\s\\S]*value="${i % 2 ? 'rejected' : 'accepted'}"`), i % 2 ? { confirmation: 'DECLINE' } : { name: 'Client' })));
  eq(await count("SELECT COUNT(*) n FROM history WHERE quote_id=? AND kind IN ('change_accepted','change_declined')", [qid]), 1, 'decisions');
});
await test('20 parallel "mark payment received" clicks: one payment record', async () => {
  const { fl, qid } = await acceptedQuote();
  await fl.submit(`/quotes/${qid}`, 'Propose change order', { title: 'Pay race', description: 'x', price: '700' });
  const orderId = (await one('SELECT id FROM change_orders WHERE quote_id=?', [qid])).id;
  await new Visitor(freshIp()).submit(`/q/${qid}`, new RegExp(`value="${orderId}"[\\s\\S]*value="accepted"`), { name: 'Client' });
  const page = await fl.get(`/quotes/${qid}`);
  await Promise.all(Array.from({ length: 20 }, () => fl.submit({ body: page.body, path: `/quotes/${qid}` }, 'Mark payment received', { confirm: 'RECEIVED' })));
  eq(await count("SELECT COUNT(*) n FROM history WHERE quote_id=? AND kind='change_paid'", [qid]), 1, 'payment rows');
});
await test('20 parallel "mark advance received" clicks on the quote: one record', async () => {
  const fl = new Visitor(freshIp());
  const qid = quoteId((await fl.submit('/', 'name="client"', quoteForm({ advance_amount: '2000' }))).location);
  await new Visitor(freshIp()).submit(`/q/${qid}`, 'Accept version', { name: 'Client' });
  const page = await fl.get(`/quotes/${qid}`);
  await Promise.all(Array.from({ length: 20 }, () => fl.submit({ body: page.body, path: `/quotes/${qid}` }, 'Mark advance as received', { confirm: 'RECEIVED' })));
  eq(await count("SELECT COUNT(*) n FROM history WHERE quote_id=? AND kind='advance_paid'", [qid]), 1, 'advance rows');
});
await test('25 parallel wrong sign-in codes, then the right one: locked after 5, no session', async () => {
  const v = new Visitor(freshIp()), email = `brute-${uniq()}@example.com`;
  const ask = await v.submit('/signin', 'Email me a code', { email });
  const code = lastCode(email, 'sign-in'), page = await v.get(ask.location);
  const wrong = code === '000000' ? '111111' : '000000';
  await Promise.all(Array.from({ length: 25 }, () => { const a = new Visitor(freshIp()); return a.submit({ body: page.body, path: '/signin' }, 'name="code"', { code: wrong, email }); }));
  const r = await v.submit({ body: page.body, path: '/signin' }, 'name="code"', { code });
  expect(r.location?.includes('error=signinCode'), `right code accepted after 25 guesses: ${r.location}`);
  expect(!v.cookie('firmquote_session'), 'session issued');
});
await test('10 parallel creates by a free account with 1 slot left: limit holds', async () => {
  const v = new Visitor(freshIp());
  const acc = await signIn(v, `limit-${uniq()}@example.com`);
  await db.execute({ sql: 'UPDATE accounts SET founder_number=NULL WHERE id=?', args: [acc.id] });
  for (const p of ['L1', 'L2']) await v.submit('/', 'name="client"', quoteForm({ project: p }));
  const page = await new Visitor(freshIp()).get('/');
  await Promise.all(Array.from({ length: 10 }, (_, i) => v.submit({ body: page.body, path: '/' }, 'name="client"', quoteForm({ project: `L-par-${i}` }))));
  const active = await count('SELECT COUNT(*) n FROM quotes WHERE account_id=? AND archived_at IS NULL', [acc.id]);
  metrics.limitRace = { limit: 3, activeAfter10ParallelCreates: active };
  expect(active <= 3, `free limit exceeded under concurrency: ${active} active quotes (limit 3)`);
});
await test('Founding 50 under a stampede: 70 accounts activated at once, exactly 50 unique founders', async () => {
  const accounts = await pool(70, 10, async k => {
    const v = new Visitor(freshIp());
    const acc = await signIn(v, `stampede-${k}-${uniq()}@example.com`);
    const qid = quoteId((await v.submit('/', 'name="client"', quoteForm({ project: `S${k}` }))).location);
    return { acc, qid };
  });
  await Promise.all(accounts.map(({ qid }) => new Visitor(freshIp()).get(`/q/${qid}`)));
  const founders = (await db.execute('SELECT founder_number FROM accounts WHERE founder_number IS NOT NULL')).rows.map(r => Number(r.founder_number));
  metrics.founders = { founders: founders.length, unique: new Set(founders).size, max: Math.max(...founders) };
  eq(founders.length, 50, 'founder count'); eq(new Set(founders).size, 50, 'unique numbers'); eq(Math.max(...founders), 50, 'highest number');
  eq(await count('SELECT COUNT(*) n FROM accounts WHERE email LIKE ? AND activated_at IS NULL', ['stampede-%']), 0, 'every stampede account activated');
});
await test('one IP creating 25 quotes in an hour is rate-limited after 20', async () => {
  const ip = freshIp();
  const res = [];
  for (let i = 0; i < 25; i++) res.push(await new Visitor(ip).submit('/', 'name="client"', quoteForm({ project: `Rate ${i}` })));
  const limited = res.filter(r => r.location?.includes('error=rate')).length;
  metrics.rateLimit = { attempts: 25, created: 25 - limited, limited };
  eq(limited, 5, 'rate-limited creates');
});
await test('server stayed healthy (home page still 200 after the stress)', async () => {
  eq((await new Visitor(freshIp()).get('/')).status, 200, 'home');
});

const s = summary('Stress');
writeFileSync(process.env.E2E_REPORT || 'e2e/stress-results.json', JSON.stringify({ results, metrics }, null, 2));
process.exit(s.failures.length ? 1 : 0);
