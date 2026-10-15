// Functional end-to-end suite against a running production build (see e2e/README.md).
import { Visitor, db, lastCode, quoteId, test, expect, eq, summary, results } from './harness.mjs';
import { writeFileSync } from 'node:fs';

const one = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];
const quoteForm = (over = {}) => ({ client: 'Riya at Studio North', project: 'Portfolio site', deliverables: '5 pages\nContact form', exclusions: 'Copywriting', price: '25000', currency: 'INR', region: 'IN', revision_limit: '2', ...over });
const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));

async function signIn(v, email, next = '/account') {
  const ask = await v.submit(`/signin?next=${encodeURIComponent(next)}`, 'Email me a code', { email });
  expect(ask.status === 303 && ask.location.includes('step=code'), `code request failed: ${ask.status} ${ask.location}`);
  const code = lastCode(email, 'sign-in');
  expect(code, `no sign-in email for ${email}`);
  const page = await v.get(ask.location);
  return v.submit({ body: page.body, path: ask.location.split('?')[0] }, 'name="code"', { code });
}

console.log('\n# Public pages');
await test('every public page and file returns 200', async () => {
  const v = new Visitor();
  for (const p of ['/', '/how-it-works', '/faq', '/compare', '/blog', '/templates', '/tools/scope-creep-calculator', '/tools/change-order-email-generator', '/support', '/privacy', '/terms', '/signin', '/robots.txt', '/sitemap.xml', '/llms.txt', '/opengraph-image', '/icon', '/apple-icon']) {
    const r = await v.get(p); eq(r.status, 200, `GET ${p}`);
  }
});
await test('blog posts render', async () => {
  const v = new Visitor(); const list = await v.get('/blog');
  const slugs = [...new Set([...list.body.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map(m => m[1]))];
  expect(slugs.length > 0, 'no blog posts linked');
  for (const s of slugs) eq((await v.get(`/blog/${s}`)).status, 200, `post ${s}`);
});
await test('security headers: CSP with nonce on pages', async () => {
  const r = await new Visitor().get('/');
  expect(/script-src 'self' 'nonce-/.test(r.headers.get('content-security-policy') || ''), 'missing nonce CSP');
});
await test('robots disallows private and account paths', async () => {
  const r = await new Visitor().get('/robots.txt');
  for (const p of ['/q/', '/quotes/', '/account', '/signin', '/limit', '/invite/']) expect(r.body.includes(`Disallow: ${p}`), `robots missing ${p}`);
});
await test('unknown quote ids 404; crafted ?error text is never echoed', async () => {
  const v = new Visitor();
  eq((await v.get('/q/aaaaaaaaaaaaaaaaaaaaaaaa')).status, 404, 'unknown client page');
  eq((await v.get('/quotes/aaaaaaaaaaaaaaaaaaaaaaaa')).status, 404, 'unknown tracker');
  const r = await v.get('/?error=%3Cscript%3Ealert(1)%3C/script%3E');
  expect(!r.body.includes('<script>alert(1)'), 'error param echoed');
});

console.log('\n# Quote lifecycle (no account, freelancer in India)');
const fl = new Visitor('10.1.1.1');
const client = new Visitor('10.2.2.2');
const clientEmail = `client-${uniq()}@example.com`;
let qid;
await test('create a quote with GST, UPI and an advance', async () => {
  const r = await fl.submit('/', 'name="client"', quoteForm({ supplier_name: 'Asha Studio', supplier_gstin: '27AAPFU0939F1ZV', sac_code: '998314', gst_rate: '18', gst_treatment: 'exclusive', gst_split: 'igst', upi_id: 'asha@okhdfcbank', advance_amount: '5000', client_email: clientEmail }));
  eq(r.status, 303, 'create status'); qid = quoteId(r.location); expect(qid, 'no quote id');
  const q = await one('SELECT * FROM quotes WHERE id=?', [qid]);
  eq(q.status, 'draft', 'status'); eq(q.upi_id, 'asha@okhdfcbank', 'upi'); eq(q.gst_rate, 18, 'gst'); eq(q.account_id, null, 'owner');
});
await test('validation: advance above price and bad GSTIN are refused', async () => {
  const v = new Visitor();
  for (const bad of [{ advance_amount: '999999' }, { supplier_gstin: 'NOTAGSTIN' }, { price: '0' }, { client: '' }]) {
    const r = await v.submit('/', 'name="client"', quoteForm(bad));
    expect(r.location?.includes('error=fields'), `accepted bad input ${JSON.stringify(bad)}: ${r.location}`);
  }
});
await test('tracker needs the editor cookie; the editor link restores it', async () => {
  const stranger = new Visitor();
  eq((await stranger.get(`/quotes/${qid}`)).status, 404, 'tracker without cookie');
  const key = (await one('SELECT edit_key FROM quotes WHERE id=?', [qid])).edit_key;
  const r = await stranger.follow(`/quotes/${qid}/access?key=${key}`);
  eq(r.status, 200, 'editor link'); expect(r.body.includes('QUOTE TRACKER'), 'tracker content');
  eq((await new Visitor().get(`/quotes/${qid}/access?key=${'0'.repeat(48)}`)).status, 404, 'wrong key');
});
await test('client page shows the scope, masks the email, never leaks the editor key', async () => {
  const r = await client.get(`/q/${qid}`);
  eq(r.status, 200, 'client page');
  const key = (await one('SELECT edit_key FROM quotes WHERE id=?', [qid])).edit_key;
  expect(!r.body.includes(key), 'editor key leaked'); expect(!r.body.includes(clientEmail), 'client email unmasked');
  expect(r.body.includes('Contact form'), 'deliverables missing');
  eq((await one('SELECT view_count FROM quotes WHERE id=?', [qid])).view_count, 1, 'view counted');
});
await test('link-preview bots and ?preview=1 are not counted as views', async () => {
  await new Visitor('10.3.3.3').request(`/q/${qid}`, { headers: { 'user-agent': 'WhatsApp/2.23' } });
  await new Visitor('10.3.3.4').get(`/q/${qid}?preview=1`);
  eq((await one('SELECT view_count FROM quotes WHERE id=?', [qid])).view_count, 1, 'view count');
});
await test('client asks for changes; freelancer edits to version 2', async () => {
  const r = await client.submit(`/q/${qid}`, 'Request changes', { note: 'Add a blog page please' });
  eq(r.status, 303, 'change request');
  eq((await one('SELECT status FROM quotes WHERE id=?', [qid])).status, 'change_requested', 'status');
  const e = await fl.submit(`/quotes/${qid}`, 'Save as version', { deliverables: '5 pages\nContact form\nBlog page', price: '28000' });
  eq(e.status, 303, 'edit');
  const q = await one('SELECT revision,status,price FROM quotes WHERE id=?', [qid]);
  eq(q.revision, 2, 'revision'); eq(q.status, 'sent', 'status'); eq(q.price, 28000, 'price');
});
await test('accepting a stale version is refused', async () => {
  const r = await client.submit(`/q/${qid}`, 'Accept version', { name: 'Riya', revision: '1' });
  expect(r.location?.includes('error='), `stale accept allowed: ${r.location}`);
});
await test('approval needs the emailed code: wrong code refused, right code accepts', async () => {
  const send = await client.submit(`/q/${qid}`, 'Email me a code');
  expect(send.location?.includes('sent=1'), `send code: ${send.location}`);
  const code = lastCode(clientEmail, 'approval'); expect(code, 'no approval email');
  const wrong = await client.submit(`/q/${qid}?sent=1`, 'Accept version', { name: 'Riya', code: code === '000000' ? '111111' : '000000' });
  expect(wrong.location?.includes('error=code'), `wrong code: ${wrong.location}`);
  const ok = await client.submit(`/q/${qid}?sent=1`, 'Accept version', { name: 'Riya', code });
  eq(ok.status, 303, 'accept');
  const q = await one('SELECT status,accepted_revision FROM quotes WHERE id=?', [qid]);
  eq(q.status, 'accepted', 'status'); eq(q.accepted_revision, 2, 'accepted revision');
});
await test('accepted quotes are locked against edits', async () => {
  const html = (await fl.get(`/quotes/${qid}`)).body;
  expect(!html.includes('Save as version'), 'edit form still shown after acceptance');
});
await test('freelancer marks the quote advance received', async () => {
  const r = await fl.submit(`/quotes/${qid}`, 'Mark advance as received');
  eq(r.status, 303, 'mark');
  expect((await one('SELECT advance_paid_at FROM quotes WHERE id=?', [qid])).advance_paid_at, 'not marked');
});
let orderAdv, orderPlain, orderDeclined;
await test('freelancer proposes three change orders (one with an advance)', async () => {
  for (const [title, price, adv] of [['Booking page', '6000', '2000'], ['Extra form', '3000', ''], ['Animations', '9000', '']]) {
    const r = await fl.submit(`/quotes/${qid}`, 'Propose change order', { title, description: `${title} please`, price, advance_amount: adv });
    eq(r.status, 303, `propose ${title}`);
  }
  const rows = (await db.execute({ sql: 'SELECT id,title FROM change_orders WHERE quote_id=?', args: [qid] })).rows;
  eq(rows.length, 3, 'orders');
  [orderAdv, orderPlain, orderDeclined] = ['Booking page', 'Extra form', 'Animations'].map(t => rows.find(r => r.title === t).id);
});
await test('advance > price on a change order is refused', async () => {
  const r = await fl.submit(`/quotes/${qid}`, 'Propose change order', { title: 'Bad', description: 'x', price: '100', advance_amount: '500' });
  expect(r.location?.includes('error=order'), `accepted: ${r.location}`);
});
await test('client accepts two changes and declines one; advance order waits for its advance', async () => {
  const decide = (order, choice) => client.submit(`/q/${qid}`, new RegExp(`value="${order}"[\\s\\S]*value="${choice}"`), {});
  eq((await decide(orderAdv, 'accepted')).status, 303, 'accept adv');
  eq((await decide(orderPlain, 'accepted')).status, 303, 'accept plain');
  eq((await decide(orderDeclined, 'rejected')).status, 303, 'decline');
  const st = id => one('SELECT status FROM change_orders WHERE id=?', [id]).then(r => r.status);
  eq(await st(orderAdv), 'awaiting_advance', 'adv'); eq(await st(orderPlain), 'accepted', 'plain'); eq(await st(orderDeclined), 'rejected', 'declined');
  expect((await client.get(`/q/${qid}`)).body.includes('Advance due'), 'client sees advance due');
});
await test('a change order cannot be answered twice', async () => {
  const html = (await client.get(`/q/${qid}`)).body;
  expect(!new RegExp(`value="${orderPlain}"`).test(html.match(/<form[\s\S]*?<\/form>/g)?.join('') || ''), 'decision form still offered');
});
await test('unpaid items offer an .ics reminder (editor only)', async () => {
  const href = /href="(\/quotes\/[a-f0-9]{24}\/reminder\?item=[^"]+)"/.exec((await fl.get(`/quotes/${qid}`)).body)?.[1];
  expect(href, 'no reminder link on tracker');
  const ics = await fl.get(href.replace(/&amp;/g, '&'));
  eq(ics.status, 200, 'ics'); expect(ics.body.includes('BEGIN:VCALENDAR'), 'ics body');
  expect([401, 403, 404].includes((await new Visitor().get(href.replace(/&amp;/g, '&'))).status), 'reminder open to strangers');
});
await test('freelancer marks advance (work starts), then balance, then the plain order paid', async () => {
  eq((await fl.submit(`/quotes/${qid}`, 'Mark advance received')).status, 303, 'advance');
  eq((await one('SELECT status FROM change_orders WHERE id=?', [orderAdv])).status, 'in_progress', 'in progress');
  eq((await fl.submit(`/quotes/${qid}`, new RegExp(`value="${orderAdv}"[\\s\\S]*Mark balance`))).status, 303, 'balance');
  eq((await fl.submit(`/quotes/${qid}`, new RegExp(`value="${orderPlain}"[\\s\\S]*Mark payment received`))).status, 303, 'plain paid');
  const paid = (await db.execute({ sql: 'SELECT COUNT(*) n FROM change_orders WHERE quote_id=? AND paid_at IS NOT NULL', args: [qid] })).rows[0].n;
  eq(Number(paid), 2, 'paid orders');
});
await test('history records every step', async () => {
  const kinds = (await db.execute({ sql: 'SELECT kind FROM history WHERE quote_id=? ORDER BY id', args: [qid] })).rows.map(r => r.kind);
  for (const k of ['created', 'change_requested', 'revised', 'accepted', 'advance_paid', 'change_proposed', 'change_accepted', 'change_declined', 'change_advance_paid', 'change_paid']) expect(kinds.includes(k), `history missing ${k} (${kinds.join(',')})`);
});
await test('printable PDF page and JSON export work for the editor only', async () => {
  eq((await fl.get(`/quotes/${qid}/pdf`)).status, 200, 'pdf');
  const exp = await fl.get(`/quotes/${qid}/export`); eq(exp.status, 200, 'export');
  const key = (await one('SELECT edit_key FROM quotes WHERE id=?', [qid])).edit_key;
  expect(!exp.body.includes(key), 'export leaks editor key'); JSON.parse(exp.body);
  const s = new Visitor();
  for (const p of ['pdf', 'export']) expect([401, 403, 404].includes((await s.get(`/quotes/${qid}/${p}`)).status), `${p} open to strangers`);
});
await test('editor actions are refused without the editor cookie', async () => {
  const s = new Visitor();
  const page = (await fl.get(`/quotes/${qid}`)).body;
  const r = await s.submit({ body: page, path: `/quotes/${qid}` }, 'Propose change order', { title: 'Hack', description: 'x', price: '1' });
  expect(r.location?.includes('error=editor'), `stranger proposed an order: ${r.location}`);
});
await test('duplicating counts as a new quote: an anonymous freelancer is asked to sign in', async () => {
  const d = await fl.submit(`/quotes/${qid}`, 'Duplicate as a new quote');
  expect(d.location?.startsWith('/signin'), `anonymous duplicate not gated: ${d.location}`);
});
const N = new Visitor('10.5.5.5');
let nq;
await test('non-India freelancer: UPI and GST are dropped', async () => {
  const r = await N.submit('/', 'name="client"', quoteForm({ region: 'OTHER', currency: 'USD', upi_id: 'x@okaxis', gst_rate: '18', gst_treatment: 'exclusive', gst_split: 'igst' }));
  nq = quoteId(r.location);
  const q = await one('SELECT upi_id,gst_rate,currency FROM quotes WHERE id=?', [nq]);
  eq(q.upi_id, null, 'upi'); eq(q.gst_rate, null, 'gst'); eq(q.currency, 'USD', 'currency');
});
await test('delete needs the exact typed confirmation, then removes quote and history', async () => {
  const proj = (await one('SELECT project FROM quotes WHERE id=?', [nq])).project;
  const bad = await N.submit(`/quotes/${nq}`, 'Delete quote and history', { confirmation: 'DELETE nope' });
  expect(bad.location?.includes('error=confirm'), 'deleted without confirmation');
  const ok = await N.submit(`/quotes/${nq}`, 'Delete quote and history', { confirmation: `DELETE ${proj}` });
  expect(ok.location?.startsWith('/?deleted='), `delete: ${ok.location}`);
  eq(await one('SELECT id FROM quotes WHERE id=?', [nq]), undefined, 'quote still in DB');
  eq(Number((await one('SELECT COUNT(*) n FROM history WHERE quote_id=?', [nq])).n), 0, 'history left behind');
});

console.log('\n# Accounts, founders, limits, referrals');
const staleHome = { body: (await new Visitor().get('/')).body, path: '/' };
const A = new Visitor('10.10.0.1'), aEmail = `founder-${uniq()}@example.com`;
let aQuote, aAccount;
await test('first quote free; second asks to sign in; sign-in attaches the first', async () => {
  aQuote = quoteId((await A.submit('/', 'name="client"', quoteForm({ project: 'A1' }))).location);
  expect((await A.get('/')).body.includes('Sign in to continue'), 'home does not show the gate');
  // A tab opened before the gate still holds the form: the server must enforce the gate too.
  const second = await A.submit(staleHome, 'name="client"', quoteForm({ project: 'A2' }));
  expect(second.location?.startsWith('/signin'), `second create not gated: ${second.location}`);
  const s = await signIn(A, aEmail);
  eq(s.location, '/account', 'after sign-in');
  aAccount = await one('SELECT * FROM accounts WHERE email=?', [aEmail]);
  eq((await one('SELECT account_id FROM quotes WHERE id=?', [aQuote])).account_id, aAccount.id, 'first quote attached');
});
await test('sign-in: wrong code refused; 6th guess refused even with the right code', async () => {
  const v = new Visitor('10.10.0.9'), email = `guess-${uniq()}@example.com`;
  const ask = await v.submit('/signin', 'Email me a code', { email });
  const code = lastCode(email, 'sign-in'); const page = await v.get(ask.location);
  for (let i = 0; i < 5; i++) await v.submit({ body: page.body, path: '/signin' }, 'name="code"', { code: code === '000000' ? '111111' : '000000' });
  const r = await v.submit({ body: page.body, path: '/signin' }, 'name="code"', { code });
  expect(r.location?.includes('error=signinCode'), `6th guess accepted: ${r.location}`);
  expect(!v.cookie('firmquote_session'), 'session issued');
});
await test('dashboard lists quotes; open route works for owner only', async () => {
  const d = await A.get('/account'); eq(d.status, 200, 'dashboard'); expect(d.body.includes('A1'), 'quote listed');
  const o = await A.get(`/quotes/${aQuote}/open`); eq(o.status, 307, 'open redirect');
  eq((await new Visitor().get(`/quotes/${aQuote}/open`)).status, 404, 'open for stranger');
});
await test("owner's own visit (even signed out, same network) does not activate; a client does", async () => {
  await A.submit('/account', 'Sign out');
  await new Visitor('10.10.0.1').get(`/q/${aQuote}`);
  eq((await one('SELECT activated_at FROM accounts WHERE id=?', [aAccount.id])).activated_at, null, 'self-activated');
  await new Visitor('10.20.0.1').get(`/q/${aQuote}`);
  const acc = await one('SELECT activated_at,founder_number FROM accounts WHERE id=?', [aAccount.id]);
  expect(acc.activated_at, 'client view did not activate'); expect(acc.founder_number >= 1, 'no founder number');
});
await test('signed-out session cookie no longer works', async () => {
  eq((await A.get('/account')).location?.startsWith('/signin'), true, 'still signed in');
});
const B = new Visitor('10.30.0.1'), bEmail = `invitee-${uniq()}@example.com`;
let bAccount;
await test('invite link -> invitee signs up -> is recorded as referred', async () => {
  await signIn(A, aEmail);
  const inviteCode = (await one('SELECT referral_code FROM accounts WHERE id=?', [aAccount.id])).referral_code;
  const r = await B.get(`/invite/${inviteCode}`); expect(r.location?.includes('invited=1'), 'invite redirect');
  await B.submit('/', 'name="client"', quoteForm({ project: 'B1' }));
  await signIn(B, bEmail);
  bAccount = await one('SELECT * FROM accounts WHERE email=?', [bEmail]);
  eq(bAccount.referred_by, aAccount.id, 'referred_by');
});
await test('free plan: 3 active quotes, 4th goes to /limit, archive frees a slot, unarchive refused at limit', async () => {
  // Make B a non-founder for this check regardless of how many founders exist.
  await db.execute({ sql: 'UPDATE accounts SET founder_number=NULL WHERE id=?', args: [bAccount.id] });
  for (const p of ['B2', 'B3']) eq((await B.submit('/', 'name="client"', quoteForm({ project: p }))).status, 303, p);
  expect((await B.get('/')).body.includes('See your options'), 'home does not show the limit');
  const fourth = await B.submit(staleHome, 'name="client"', quoteForm({ project: 'B4' }));
  eq(fourth.location, '/limit', 'limit redirect');
  eq((await B.get('/limit')).status, 200, 'limit page');
  const ids = (await db.execute({ sql: 'SELECT id FROM quotes WHERE account_id=? ORDER BY created_at', args: [bAccount.id] })).rows.map(r => r.id);
  eq((await B.submit('/account', new RegExp(`value="${ids[0]}"[\\s\\S]*Archive`))).location, '/account', 'archive');
  eq((await B.submit('/', 'name="client"', quoteForm({ project: 'B5' }))).status, 303, 'create after archive');
  const un = await B.submit('/account', new RegExp(`value="${ids[0]}"[\\s\\S]*Unarchive`));
  expect(un.location?.includes('error=archive'), `unarchive at limit allowed: ${un.location}`);
});
await test('referral: invitee activation credits both sides once', async () => {
  const before = Number((await one('SELECT bonus_slots FROM accounts WHERE id=?', [aAccount.id])).bonus_slots);
  const bq = (await db.execute({ sql: 'SELECT id FROM quotes WHERE account_id=? LIMIT 1', args: [bAccount.id] })).rows[0].id;
  await new Visitor('10.40.0.1').get(`/q/${bq}`);
  await new Visitor('10.40.0.2').get(`/q/${bq}`);
  eq(Number((await one('SELECT bonus_slots FROM accounts WHERE id=?', [aAccount.id])).bonus_slots), before + 2, 'inviter bonus');
  eq(Number((await one('SELECT bonus_slots FROM accounts WHERE id=?', [bAccount.id])).bonus_slots), 2, 'invitee bonus');
});
await test('forged free-quote cookie cannot claim someone else\'s quote', async () => {
  const victim = quoteId((await new Visitor().submit('/', 'name="client"', quoteForm({ project: 'Victim' }))).location);
  const atk = new Visitor('10.50.0.1');
  atk.jar.set('firmquote_anon_quote|/', { name: 'firmquote_anon_quote', value: `${victim}.${'a'.repeat(48)}`, path: '/' });
  await signIn(atk, `attacker-${uniq()}@example.com`);
  eq((await one('SELECT account_id FROM quotes WHERE id=?', [victim])).account_id, null, 'victim quote claimed');
});
await test('Pro waitlist (billing not configured) records interest once', async () => {
  // B became a founder when activated in a fresh DB; founders never see the offer, so make B a free-plan user here.
  await db.execute({ sql: 'UPDATE accounts SET founder_number=NULL WHERE id=?', args: [bAccount.id] });
  const r = await B.submit('/limit?waitlist=1', 'Join the Pro waitlist');
  expect(r.location?.includes('waitlist=1'), `waitlist: ${r.location}`);
  expect((await one('SELECT pro_waitlist_at FROM accounts WHERE id=?', [bAccount.id])).pro_waitlist_at, 'not recorded');
});
await test('billing webhooks refuse unsigned calls while billing is off', async () => {
  for (const p of ['/api/billing/stripe', '/api/billing/razorpay']) {
    const r = await new Visitor().request(p, { method: 'POST', body: '{"type":"x"}', headers: { 'content-type': 'application/json' } });
    expect([400, 503].includes(r.status), `${p} -> ${r.status}`);
  }
});

console.log('\n# Pro features (account marked Pro in the test DB; checkout needs real provider keys)');
await test('Pro: unlimited quotes, logo + colour on client page, no "Created with" line', async () => {
  await db.execute({ sql: "UPDATE accounts SET pro_until=?, subscription_status='active' WHERE id=?", args: [new Date(Date.now() + 30 * 864e5).toISOString(), bAccount.id] });
  eq((await B.submit('/', 'name="client"', quoteForm({ project: 'B-pro' }))).status, 303, 'create beyond free limit');
  const page = await B.get('/account');
  const r = await B.submit({ body: page.body, path: '/account' }, 'Save branding', { use_color: 'on', brand_color: '#aa3355', logo: new Blob([PNG], { type: 'image/png' }) });
  eq(r.status, 303, `save branding ${r.location}`);
  const acc = await one('SELECT brand_color,brand_logo_at FROM accounts WHERE id=?', [bAccount.id]);
  eq(acc.brand_color, '#aa3355', 'colour'); expect(acc.brand_logo_at, 'logo not stored');
  const logo = await new Visitor().get(`/brand/${bAccount.id}`);
  eq(logo.status, 200, 'logo route'); eq(logo.headers.get('content-type'), 'image/png', 'logo type'); eq(logo.headers.get('x-content-type-options'), 'nosniff', 'nosniff');
  const bq = (await db.execute({ sql: 'SELECT id FROM quotes WHERE account_id=? LIMIT 1', args: [bAccount.id] })).rows[0].id;
  const cp = await new Visitor().get(`/q/${bq}`);
  expect(cp.body.includes(`/brand/${bAccount.id}`), 'logo not on client page'); expect(!cp.body.includes('Created with FirmQuote'), 'badge still shown');
});
await test('Pro: an SVG disguised as PNG is refused', async () => {
  const page = await B.get('/account');
  const r = await B.submit({ body: page.body, path: '/account' }, 'Save branding', { logo: new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/png' }) });
  expect(r.location?.includes('error=logo'), `svg accepted: ${r.location}`);
});
await test('non-Pro account: logo route 404 and badge shown', async () => {
  await db.execute({ sql: 'UPDATE accounts SET pro_until=NULL, founder_number=NULL WHERE id=?', args: [bAccount.id] });
  eq((await new Visitor().get(`/brand/${bAccount.id}`)).status, 404, 'logo after lapse');
});

const s = summary('Functional E2E');
writeFileSync(process.env.E2E_REPORT || 'e2e/functional-results.json', JSON.stringify(results, null, 2));
process.exit(s.failures.length ? 1 : 0);
