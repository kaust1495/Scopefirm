import type { Attribution } from './marketing';
import { createClient } from '@libsql/client';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { QuoteCurrency } from './currency';

// Local SQLite for development; configure Turso's libSQL URL/token for a durable Vercel deployment.
const url = process.env.TURSO_DATABASE_URL || 'file:./scopefirm.db';
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
let ready: Promise<void> | undefined;
function init() {
  return ready ||= (async () => {
    if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before deploying on Vercel. Its local filesystem is not durable.');
    await db.execute(`CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, edit_key TEXT NOT NULL, client TEXT NOT NULL, project TEXT NOT NULL, ask TEXT NOT NULL, deliverables TEXT NOT NULL, exclusions TEXT NOT NULL, price REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'INR', revision_limit INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, accepted_at TEXT, accepted_revision INTEGER)`);
    const columns = await db.execute('PRAGMA table_info(quotes)');
    for (const [name, definition] of [['currency', "TEXT NOT NULL DEFAULT 'INR'"], ['client_email', 'TEXT'], ['pages_count', 'INTEGER'], ['forms_count', 'INTEGER'], ['cms_needed', 'TEXT'], ['timeline', 'TEXT'], ['supplier_name', 'TEXT'], ['supplier_address', 'TEXT'], ['supplier_gstin', 'TEXT'], ['client_gstin', 'TEXT'], ['sac_code', 'TEXT'], ['gst_rate', 'REAL'], ['gst_treatment', 'TEXT'], ['gst_split', 'TEXT'], ['upi_id', 'TEXT'], ['advance_amount', 'REAL'], ['advance_paid_at', 'TEXT'], ['region', 'TEXT'], ['payment_link', 'TEXT'], ['valid_until', 'TEXT'], ['first_viewed_at', 'TEXT'], ['last_viewed_at', 'TEXT'], ['view_count', 'INTEGER NOT NULL DEFAULT 0'], ['account_id', 'TEXT'], ['archived_at', 'TEXT'], ['first_view_ip', 'TEXT']]) {
      if (columns.rows.some(row => row.name === name)) continue;
      try { await db.execute(`ALTER TABLE quotes ADD COLUMN ${name} ${definition}`); }
      catch (error) {
        // Concurrent cold starts may both see the old schema. Only ignore that exact race.
        if (!String(error).includes(`duplicate column name: ${name}`)) throw error;
      }
    }
    await db.execute(`CREATE TABLE IF NOT EXISTS quote_attribution (quote_id TEXT PRIMARY KEY, utm_source TEXT NOT NULL, utm_medium TEXT NOT NULL, utm_campaign TEXT NOT NULL)`);
    const attributionColumns = await db.execute('PRAGMA table_info(quote_attribution)');
    if (!attributionColumns.rows.some(row => row.name === 'utm_content')) {
      try { await db.execute('ALTER TABLE quote_attribution ADD COLUMN utm_content TEXT'); }
      catch (error) { if (!String(error).includes('duplicate column name: utm_content')) throw error; }
    }
    await db.execute(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, note TEXT NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS history_quote ON history (quote_id, created_at)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS change_orders (id TEXT PRIMARY KEY, quote_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, price REAL NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed', created_at TEXT NOT NULL, responded_at TEXT)`);
    // A change order is immutable after insert. If an edit path is ever added, changing advance_amount
    // must clear advance_paid_at and return the order to 'awaiting_advance' (the quote-level rule in reviseQuote).
    const orderColumns = await db.execute('PRAGMA table_info(change_orders)');
    for (const [name, definition] of [['paid_at', 'TEXT'], ['advance_amount', 'REAL'], ['advance_paid_at', 'TEXT']]) {
      if (orderColumns.rows.some(row => row.name === name)) continue;
      try { await db.execute(`ALTER TABLE change_orders ADD COLUMN ${name} ${definition}`); }
      catch (error) { if (!String(error).includes(`duplicate column name: ${name}`)) throw error; }
    }
    await db.execute(`CREATE INDEX IF NOT EXISTS change_orders_quote ON change_orders (quote_id, created_at)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS accept_codes (quote_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS rate_events (bucket TEXT NOT NULL, created_at TEXT NOT NULL)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS rate_events_bucket ON rate_events (bucket, created_at)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS quotes_account ON quotes (account_id)`);
    // Freelancer accounts. founder_number is UNIQUE so concurrent activations can never share a founder spot.
    await db.execute(`CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, referral_code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, activated_at TEXT, founder_number INTEGER UNIQUE, referred_by TEXT, referral_credited_at TEXT, bonus_slots INTEGER NOT NULL DEFAULT 0, pro_waitlist_at TEXT)`);
    const accountColumns = await db.execute('PRAGMA table_info(accounts)');
    // Pro billing and client-page branding. pro_until is the paid-through date (plus grace); Pro is pro_until > now.
    for (const [name, definition] of [['billing_provider', 'TEXT'], ['subscription_id', 'TEXT'], ['subscription_status', 'TEXT'], ['pro_until', 'TEXT'], ['cancel_at_period_end', 'INTEGER NOT NULL DEFAULT 0'], ['billing_synced_at', 'TEXT'], ['brand_color', 'TEXT'], ['brand_logo_at', 'TEXT'], ['pro_launch_emailed_at', 'TEXT']]) {
      if (accountColumns.rows.some(row => row.name === name)) continue;
      try { await db.execute(`ALTER TABLE accounts ADD COLUMN ${name} ${definition}`); }
      catch (error) { if (!String(error).includes(`duplicate column name: ${name}`)) throw error; }
    }
    await db.execute(`CREATE INDEX IF NOT EXISTS accounts_referred_by ON accounts (referred_by)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS accounts_subscription ON accounts (subscription_id)`);
    // Logos live apart from accounts so the per-request account lookup never loads image bytes.
    await db.execute(`CREATE TABLE IF NOT EXISTS brand_logos (account_id TEXT PRIMARY KEY, data BLOB NOT NULL, type TEXT NOT NULL)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)`);
    // The hashed IP each session signed in from: a "client" view from the owner's own network is not a client.
    const sessionColumns = await db.execute('PRAGMA table_info(sessions)');
    if (!sessionColumns.rows.some(row => row.name === 'ip_hash')) {
      try { await db.execute('ALTER TABLE sessions ADD COLUMN ip_hash TEXT'); }
      catch (error) { if (!String(error).includes('duplicate column name: ip_hash')) throw error; }
    }
    await db.execute(`CREATE INDEX IF NOT EXISTS sessions_account_ip ON sessions (account_id, ip_hash)`);
    // Every network an account has signed in from, kept after sign-out so a signed-out owner's own visit stays theirs.
    await db.execute(`CREATE TABLE IF NOT EXISTS account_networks (account_id TEXT NOT NULL, ip_hash TEXT NOT NULL, PRIMARY KEY (account_id, ip_hash))`);
    await db.execute(`INSERT OR IGNORE INTO account_networks (account_id, ip_hash) SELECT account_id, ip_hash FROM sessions WHERE ip_hash IS NOT NULL`);
    await db.execute(`CREATE TABLE IF NOT EXISTS login_codes (email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)`);
  })();
}
export type Quote = { id:string; edit_key:string; client:string; project:string; ask:string; deliverables:string; exclusions:string; price:number; currency:QuoteCurrency; client_email:string|null; pages_count:number|null; forms_count:number|null; cms_needed:'yes'|'no'|null; timeline:string|null; supplier_name:string|null; supplier_address:string|null; supplier_gstin:string|null; client_gstin:string|null; sac_code:string|null; gst_rate:number|null; gst_treatment:'inclusive'|'exclusive'|null; gst_split:'cgst_sgst'|'igst'|null; upi_id:string|null; advance_amount:number|null; advance_paid_at:string|null; region:'IN'|'OTHER'|null; payment_link:string|null; valid_until:string|null; first_viewed_at:string|null; last_viewed_at:string|null; view_count:number; account_id:string|null; archived_at:string|null; revision_limit:number; revision:number; status:string; created_at:string; updated_at:string; accepted_at:string|null; accepted_revision:number|null };
export type ChangeOrder = {id:string; quote_id:string; title:string; description:string; price:number; currency:QuoteCurrency; status:'proposed'|'accepted'|'rejected'|'awaiting_advance'|'in_progress'; created_at:string; responded_at:string|null; paid_at:string|null; advance_amount:number|null; advance_paid_at:string|null};
/** The unpaid remainder of an accepted advance order; a no-advance order has no balance concept. */
export const orderBalance = (order: Pick<ChangeOrder,'price'|'advance_amount'>) => order.advance_amount == null ? null : Math.max(0, order.price - order.advance_amount);
export type History = {id:number; quote_id:string; revision:number; kind:string; note:string; snapshot:string; created_at:string};
const id = () => randomBytes(12).toString('hex');
// History snapshots never include the private editor key.
const snapshot = (q: Quote) => JSON.stringify({...q, edit_key: undefined});

/** Constant-time check of a presented editor key against the stored one. */
export function keyMatches(q: Pick<Quote,'edit_key'> | null, key: string | undefined | null) {
  if (!q || !key) return false;
  const a = Buffer.from(q.edit_key), b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Fixed-window limiter stored beside the data. Buckets hold only hashed identifiers.
 * Returns false when the caller has used `limit` events in the last `windowMs`.
 */
export async function allowEvent(scope: string, identifier: string, limit: number, windowMs: number) {
  await init();
  const bucket = `${scope}:${createHash('sha256').update(identifier).digest('hex').slice(0, 32)}`;
  const now = new Date(), since = new Date(now.getTime() - windowMs).toISOString();
  // Count and record in one statement inside one transaction, so parallel requests cannot all pass the check.
  const [, inserted] = await db.batch([
    {sql:'DELETE FROM rate_events WHERE created_at < ?', args:[new Date(now.getTime() - 24*60*60*1000).toISOString()]},
    {sql:'INSERT INTO rate_events (bucket, created_at) SELECT ?, ? WHERE (SELECT COUNT(*) FROM rate_events WHERE bucket=? AND created_at >= ?) < ?', args:[bucket, now.toISOString(), bucket, since, limit]},
  ],'write');
  return inserted.rowsAffected === 1;
}
/** Columns the freelancer edits; createQuote and reviseQuote write exactly these. */
export const editableColumns = ['client','project','ask','deliverables','exclusions','price','currency','client_email','pages_count','forms_count','cms_needed','timeline','supplier_name','supplier_address','supplier_gstin','client_gstin','sac_code','gst_rate','gst_treatment','gst_split','upi_id','advance_amount','payment_link','region','valid_until','revision_limit'] as const;
export type QuoteInput = Pick<Quote, typeof editableColumns[number]>;
const editableValues = (input: QuoteInput) => editableColumns.map(c => input[c] ?? null);

/** Where the freelancer is based decides the India-only sections; older quotes fall back to their currency. */
export const regionOf = (q: Pick<Quote,'region'|'currency'>): 'IN'|'OTHER' => q.region ?? (q.currency === 'INR' ? 'IN' : 'OTHER');

export async function createQuote(input: QuoteInput, labels: Attribution | null = null, accountId: string | null = null) {
  await init(); const quoteId=id(), editKey=id()+id(), now=new Date().toISOString();
  const q: Quote = {...input, id:quoteId, edit_key:editKey, revision:1, status:'draft', created_at:now, updated_at:now, accepted_at:null, accepted_revision:null, advance_paid_at:null, first_viewed_at:null, last_viewed_at:null, view_count:0, account_id:accountId, archived_at:null};
  const cols = ['id','edit_key',...editableColumns,'created_at','updated_at','account_id'];
  await db.batch([
    {sql:`INSERT INTO quotes (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,args:[quoteId,editKey,...editableValues(input),now,now,accountId]},
    {sql:'INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) VALUES (?,?,?,?,?,?)',args:[quoteId,1,'created','Draft created',snapshot(q),now]},
    ...(labels ? [{sql:'INSERT INTO quote_attribution (quote_id,utm_source,utm_medium,utm_campaign,utm_content) VALUES (?,?,?,?,?)',args:[quoteId,labels.utm_source,labels.utm_medium,labels.utm_campaign,labels.utm_content ?? null]}] : []),
  ],'write');
  return q;
}
export async function getQuote(quoteId:string):Promise<Quote|null> { await init(); const result=await db.execute({sql:'SELECT * FROM quotes WHERE id=?',args:[quoteId]}); return result.rows[0] as unknown as Quote || null; }
export async function getHistory(quoteId:string):Promise<History[]> { await init(); const r=await db.execute({sql:'SELECT * FROM history WHERE quote_id=? ORDER BY id DESC',args:[quoteId]}); return r.rows as unknown as History[]; }
export async function reviseQuote(q:Quote, input:QuoteInput) {
  await init(); if(q.status==='accepted') throw new Error('Accepted quotes are locked. Create a new quote for new work.');
  const now=new Date().toISOString(), next=q.revision+1;
  // A changed advance is a new amount, so an earlier "received" mark no longer applies to it.
  const advancePaid = input.advance_amount === q.advance_amount ? q.advance_paid_at : null;
  const latest: Quote = {...q, ...input, advance_paid_at:advancePaid, revision:next, status:'sent', updated_at:now};
  // One transaction: the history row is written only if the guarded update changed the quote.
  const [result]=await db.batch([
    {sql:`UPDATE quotes SET ${editableColumns.map(c => `${c}=?`).join(',')},advance_paid_at=?,revision=?,status=?,updated_at=? WHERE id=? AND revision=? AND status!=?`,args:[...editableValues(input),advancePaid,next,'sent',now,q.id,q.revision,'accepted']},
    {sql:'INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1',args:[q.id,next,'revised','Scope updated',snapshot(latest),now]},
  ],'write');
  if(!result.rowsAffected) throw new Error('This quote changed. Refresh and try again.');
}
export async function clientAction(q:Quote, kind:'accepted'|'change_requested', note:string) {
  await init(); if(q.status==='accepted') throw new Error('This quote is already accepted.');
  const now=new Date().toISOString();
  const latest: Quote = {...q, status:kind, updated_at:now, accepted_at:kind==='accepted'?now:null, accepted_revision:kind==='accepted'?q.revision:null};
  const [result]=await db.batch([
    {sql:'UPDATE quotes SET status=?,updated_at=?,accepted_at=?,accepted_revision=? WHERE id=? AND revision=? AND status!=?',args:[kind,now,latest.accepted_at,latest.accepted_revision,q.id,q.revision,'accepted']},
    {sql:'INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1',args:[q.id,q.revision,kind,note,snapshot(latest),now]},
  ],'write');
  if(!result.rowsAffected) throw new Error('This quote changed. Refresh and review the latest version.');
}

/** Removes a quote and its history only after the current private editor key is checked. */
export async function deleteQuote(quoteId: string, key: string, confirmation: string) {
  await init();
  const q = await getQuote(quoteId);
  if (!q || !keyMatches(q, key) || confirmation !== `DELETE ${q.project}`) return false;
  await db.batch([
    {sql:'DELETE FROM quote_attribution WHERE quote_id=?',args:[quoteId]},
    {sql:'DELETE FROM quotes WHERE id=? AND edit_key=?',args:[quoteId,key]},
    {sql:'DELETE FROM history WHERE quote_id=?',args:[quoteId]},
    {sql:'DELETE FROM change_orders WHERE quote_id=?',args:[quoteId]},
    {sql:'DELETE FROM accept_codes WHERE quote_id=?',args:[quoteId]},
  ],'write');
  return true;
}

export async function getChangeOrders(quoteId:string):Promise<ChangeOrder[]> {
  await init();
  const r=await db.execute({sql:'SELECT * FROM change_orders WHERE quote_id=? ORDER BY created_at,id',args:[quoteId]});
  return r.rows as unknown as ChangeOrder[];
}

/** Adds a proposed change to an accepted quote; the quote row itself stays locked. */
export async function addChangeOrder(q:Quote, input:{title:string; description:string; price:number; advance_amount:number|null}) {
  await init();
  if(q.status!=='accepted') throw new Error('Accept the original quote before proposing additional work.');
  if(input.advance_amount != null && input.advance_amount > input.price) throw new Error('The advance cannot be more than the price.');
  const orderId=id(), now=new Date().toISOString();
  const order={id:orderId, quote_id:q.id, ...input, currency:q.currency, status:'proposed', created_at:now, responded_at:null, advance_paid_at:null};
  // Insert and log together, and only while the quote is still accepted in the same currency.
  const [result]=await db.batch([
    {sql:"INSERT INTO change_orders (id,quote_id,title,description,price,currency,status,created_at,advance_amount) SELECT ?,?,?,?,?,?,'proposed',?,? WHERE EXISTS (SELECT 1 FROM quotes WHERE id=? AND status='accepted' AND currency=?)",args:[orderId,q.id,input.title,input.description,input.price,q.currency,now,input.advance_amount,q.id,q.currency]},
    {sql:'INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1',args:[q.id,q.revision,'change_proposed',`Change order proposed: ${input.title}`,JSON.stringify(order),now]},
  ],'write');
  if(!result.rowsAffected) throw new Error('Original quote changed. Refresh before proposing extra work.');
  return orderId;
}

export async function decideChangeOrder(q:Quote, orderId:string, choice:'accepted'|'rejected', decisionNote='') {
  await init();
  const now=new Date().toISOString();
  // Accepting a change with an advance parks it awaiting that advance; without one it is accepted as before.
  const [result]=await db.batch([
    {sql:"UPDATE change_orders SET status=CASE WHEN ?='accepted' AND advance_amount IS NOT NULL THEN 'awaiting_advance' ELSE ? END,responded_at=? WHERE id=? AND quote_id=? AND currency=? AND status='proposed'",args:[choice,choice,now,orderId,q.id,q.currency]},
    {sql:"INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) SELECT ?,?,?,'Change order '||?||': '||title||?,json_object('id',id,'title',title,'price',price,'currency',currency,'status',status,'responded_at',responded_at),? FROM change_orders WHERE id=? AND changes()=1",args:[q.id,q.revision,choice==='accepted'?'change_accepted':'change_declined',choice==='accepted'?'accepted':'declined',decisionNote,now,orderId]},
  ],'write');
  return result.rowsAffected>0;
}

const codeHash = (q: Pick<Quote,'id'|'revision'>, code: string) => createHash('sha256').update(`${q.id}:${q.revision}:${code}`).digest('hex');

/** Issues a 6-digit approval code for the quote's current revision; only its hash is stored, for 10 minutes. */
/** Issues a 10-minute code, or returns null if a still-usable code for this revision was issued under a minute ago (so a link holder cannot keep replacing the client's code). */
export async function issueAcceptCode(q: Quote) {
  await init();
  const code = String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, '0');
  const now = Date.now(), expires = new Date(now + 10 * 60 * 1000).toISOString(), freshUntil = new Date(now + 9 * 60 * 1000).toISOString();
  const r = await db.execute({sql:'INSERT INTO accept_codes (quote_id,revision,code_hash,expires_at,attempts) VALUES (?,?,?,?,0) ON CONFLICT(quote_id) DO UPDATE SET revision=excluded.revision,code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0 WHERE accept_codes.revision!=excluded.revision OR accept_codes.attempts>=5 OR accept_codes.expires_at<=?',args:[q.id,q.revision,codeHash(q,code),expires,freshUntil]});
  return r.rowsAffected ? code : null;
}

/** Checks a code for the current revision: five attempts, then it must be re-sent. A correct code is used up. */
export async function consumeAcceptCode(q: Quote, code: string) {
  await init();
  const [, row] = await db.batch([
    {sql:"UPDATE accept_codes SET attempts=attempts+1 WHERE quote_id=? AND revision=? AND expires_at>? AND attempts<5",args:[q.id,q.revision,new Date().toISOString()]},
    // Only readable when the guarded increment above succeeded, so a sixth guess can never be checked.
    {sql:'SELECT code_hash FROM accept_codes WHERE quote_id=? AND changes()=1',args:[q.id]},
  ],'write');
  const stored = row.rows[0]?.code_hash as string | undefined;
  if (!stored || !/^\d{6}$/.test(code)) return false;
  const a = Buffer.from(stored), b = Buffer.from(codeHash(q, code));
  if (!timingSafeEqual(a, b)) return false;
  await db.execute({sql:'DELETE FROM accept_codes WHERE quote_id=?',args:[q.id]});
  return true;
}

/** Editor-only manual record that the advance was received. No payment is processed or verified: this is the freelancer's own bookkeeping entry. */
export async function markAdvancePaid(q: Quote) {
  await init();
  if (q.advance_amount == null) throw new Error('Set an advance amount first.');
  if (q.advance_paid_at) return;
  const now = new Date().toISOString();
  const [result] = await db.batch([
    {sql:'UPDATE quotes SET advance_paid_at=?,updated_at=? WHERE id=? AND revision=? AND advance_amount IS NOT NULL AND advance_paid_at IS NULL',args:[now,now,q.id,q.revision]},
    {sql:"INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1",args:[q.id,q.revision,'advance_paid','Advance marked as received by the freelancer (manual record, not verified)',snapshot({...q, advance_paid_at: now, updated_at: now}),now]},
  ],'write');
  if (!result.rowsAffected) throw new Error('This quote changed. Refresh and try again.');
}

/** Freelancer's own record that the advance for a change order arrived; flips the order to in_progress. */
export async function markChangeOrderAdvancePaid(q: Quote, orderId: string) {
  await init();
  const now = new Date().toISOString();
  const [result] = await db.batch([
    {sql:"UPDATE change_orders SET advance_paid_at=?,status='in_progress' WHERE id=? AND quote_id=? AND status='awaiting_advance' AND advance_paid_at IS NULL",args:[now,orderId,q.id]},
    {sql:"INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) SELECT ?,?,'change_advance_paid','Advance for change order marked received by the freelancer (manual record, not verified): '||title,json_object('id',id,'title',title,'price',price,'currency',currency,'advance_amount',advance_amount,'advance_paid_at',advance_paid_at,'status',status),? FROM change_orders WHERE id=? AND changes()=1",args:[q.id,q.revision,now,orderId]},
  ],'write');
  return result.rowsAffected > 0;
}

/** Freelancer's own record that an accepted change order was paid; on an advance order this closes out the balance. FirmQuote does not verify payments. */
export async function markChangeOrderPaid(q: Quote, orderId: string) {
  await init();
  const now = new Date().toISOString();
  const [result] = await db.batch([
    // No-advance orders settle from 'accepted' exactly as before; advance orders settle their balance from 'in_progress'.
    {sql:"UPDATE change_orders SET paid_at=? WHERE id=? AND quote_id=? AND status IN ('accepted','in_progress') AND paid_at IS NULL",args:[now,orderId,q.id]},
    {sql:"INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) SELECT ?,?,'change_paid','Payment for change order marked received by the freelancer (manual record, not verified): '||title,json_object('id',id,'title',title,'price',price,'currency',currency,'paid_at',paid_at),? FROM change_orders WHERE id=? AND changes()=1",args:[q.id,q.revision,now,orderId]},
  ],'write');
  return result.rowsAffected > 0;
}
const PAYMENT_UNDO_WINDOW_MS = 10 * 60 * 1000;
const undoCutoff = () => new Date(Date.now() - PAYMENT_UNDO_WINDOW_MS).toISOString();

/** Reverses a very recent accidental advance mark; the original event stays in history. */
export async function undoAdvancePaid(q: Quote) {
  await init();
  const now = new Date().toISOString();
  const [result] = await db.batch([
    {sql:'UPDATE quotes SET advance_paid_at=NULL,updated_at=? WHERE id=? AND advance_paid_at>=?',args:[now,q.id,undoCutoff()]},
    {sql:"INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1",args:[q.id,q.revision,'advance_unmarked','Advance payment mark undone within the correction window',snapshot({...q,advance_paid_at:null,updated_at:now}),now]},
  ],'write');
  return result.rowsAffected > 0;
}

/** Reverses a very recent change-order advance mark and parks the order back on awaiting advance. */
export async function undoChangeOrderAdvancePaid(q: Quote, orderId: string) {
  await init();
  const now = new Date().toISOString();
  const [result] = await db.batch([
    {sql:"UPDATE change_orders SET advance_paid_at=NULL,status='awaiting_advance' WHERE id=? AND quote_id=? AND advance_paid_at>=? AND paid_at IS NULL AND status='in_progress'",args:[orderId,q.id,undoCutoff()]},
    {sql:"INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) SELECT ?,?,'change_advance_unmarked','Change-order advance payment mark undone within the correction window: '||title,json_object('id',id,'title',title,'status',status,'advance_paid_at',advance_paid_at),? FROM change_orders WHERE id=? AND changes()=1",args:[q.id,q.revision,now,orderId]},
  ],'write');
  return result.rowsAffected > 0;
}

/** Reverses a very recent change-order payment mark; the original event stays in history. */
export async function undoChangeOrderPaid(q: Quote, orderId: string) {
  await init();
  const now = new Date().toISOString();
  const [result] = await db.batch([
    {sql:"UPDATE change_orders SET paid_at=NULL WHERE id=? AND quote_id=? AND paid_at>=? AND status IN ('accepted','in_progress')",args:[orderId,q.id,undoCutoff()]},
    {sql:"INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) SELECT ?,?,'change_payment_unmarked','Change-order payment mark undone within the correction window: '||title,json_object('id',id,'title',title,'status',status,'paid_at',paid_at),? FROM change_orders WHERE id=? AND changes()=1",args:[q.id,q.revision,now,orderId]},
  ],'write');
  return result.rowsAffected > 0;
}

/** A quote's "valid until" date has passed everywhere: the day ends last in UTC-12, so no client loses it early. */
export function isExpired(q: Pick<Quote,'valid_until'|'status'>, now = new Date()) {
  if (!q.valid_until || q.status === 'accepted') return false;
  return now.getTime() > Date.parse(`${q.valid_until}T23:59:59-12:00`);
}

/** Records that the client link was opened. Callers skip link-preview bots and the freelancer's own preview. */
export async function recordView(quoteId: string, ip: string | null = null) {
  await init();
  const now = new Date().toISOString();
  await db.execute({sql:'UPDATE quotes SET first_viewed_at=COALESCE(first_viewed_at,?), first_view_ip=CASE WHEN first_viewed_at IS NULL THEN ? ELSE first_view_ip END, last_viewed_at=?, view_count=view_count+1 WHERE id=?',args:[now,ipHash(ip),now,quoteId]});
}

// ---- Freelancer accounts -------------------------------------------------------------------------

/** The first 50 activated accounts are founders: free with no quote limit, for life. */
export const FOUNDER_SPOTS = 50;
/** Non-founders may keep this many non-archived quotes, plus any referral bonus. */
export const FREE_ACTIVE_QUOTES = 3;
/** Slots each side gains when an invitee activates; an inviter is credited for at most REFERRAL_CAP invitees. */
export const REFERRAL_BONUS = 2;
export const REFERRAL_CAP = 10;
const SESSION_DAYS = 180;

export type BillingProvider = 'stripe' | 'razorpay' | 'dodo';
export type Account = {id:string; email:string; referral_code:string; created_at:string; activated_at:string|null; founder_number:number|null; referred_by:string|null; referral_credited_at:string|null; bonus_slots:number; pro_waitlist_at:string|null;
  billing_provider:BillingProvider|null; subscription_id:string|null; subscription_status:string|null; pro_until:string|null; cancel_at_period_end:number; billing_synced_at:string|null;
  brand_color:string|null; brand_logo_at:string|null; pro_launch_emailed_at:string|null};

/** A paid subscription covers today (pro_until already includes the renewal grace period). */
export const isPro = (account: Pick<Account,'pro_until'>, now = new Date()) => account.pro_until != null && Date.parse(account.pro_until) > now.getTime();
/** Founders get every Pro feature for life; everyone else needs a current subscription. */
export const hasProFeatures = (account: Pick<Account,'pro_until'|'founder_number'>, now = new Date()) => account.founder_number != null || isPro(account, now);
/** Days of Pro kept after a missed renewal while the provider retries the charge. */
export const RENEWAL_GRACE_DAYS = 3;

/** One subscription's current state, as re-read from the provider. */
export type SubscriptionState = { provider: BillingProvider; subscriptionId: string; accountId: string | null; status: string; entitled: boolean; periodEnd: Date | null; cancelAtPeriodEnd: boolean | null };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const loginHash = (email: string, code: string) => sha256(`login:${email}:${code}`);
/** Only a hash of an IP address is stored, used to tell the owner's own visits from a client's. */
const ipHash = (ip: string | null | undefined) => (ip && ip !== 'unknown' ? sha256(`ip:${ip}`) : null);

/** Issues a 10-minute sign-in code for the address; only its hash is stored. Callers rate-limit sends. */
export async function issueLoginCode(rawEmail: string) {
  await init();
  const email = normalizeEmail(rawEmail);
  const code = String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, '0');
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await db.execute({sql:'INSERT INTO login_codes (email,code_hash,expires_at,attempts) VALUES (?,?,?,0) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0',args:[email,loginHash(email,code),expires]});
  return code;
}

/** Checks a sign-in code: five attempts, then it must be re-sent. A correct code is used up. */
export async function consumeLoginCode(rawEmail: string, code: string) {
  await init();
  const email = normalizeEmail(rawEmail);
  const [, row] = await db.batch([
    {sql:'UPDATE login_codes SET attempts=attempts+1 WHERE email=? AND expires_at>? AND attempts<5',args:[email,new Date().toISOString()]},
    // Only readable when the guarded increment above succeeded, so a sixth guess can never be checked.
    {sql:'SELECT code_hash FROM login_codes WHERE email=? AND changes()=1',args:[email]},
  ],'write');
  const stored = row.rows[0]?.code_hash as string | undefined;
  if (!stored || !/^\d{6}$/.test(code)) return false;
  if (!timingSafeEqual(Buffer.from(stored), Buffer.from(loginHash(email, code)))) return false;
  await db.execute({sql:'DELETE FROM login_codes WHERE email=?',args:[email]});
  return true;
}

export async function getAccount(accountId: string): Promise<Account|null> {
  await init();
  const r = await db.execute({sql:'SELECT * FROM accounts WHERE id=?',args:[accountId]});
  return (r.rows[0] as unknown as Account) || null;
}

/** Returns the account for this email, creating it on first sign-in. A referral code is recorded only on creation. */
export async function findOrCreateAccount(rawEmail: string, referralCode: string | null) {
  await init();
  const email = normalizeEmail(rawEmail);
  await db.execute({sql:'INSERT INTO accounts (id,email,referral_code,created_at,referred_by) VALUES (?,?,?,?,(SELECT id FROM accounts WHERE referral_code=?)) ON CONFLICT(email) DO NOTHING',args:[id(),email,randomBytes(5).toString('hex'),new Date().toISOString(),referralCode ?? '']});
  const r = await db.execute({sql:'SELECT * FROM accounts WHERE email=?',args:[email]});
  return r.rows[0] as unknown as Account;
}

export async function accountByReferralCode(code: string) {
  await init();
  const r = await db.execute({sql:'SELECT id FROM accounts WHERE referral_code=?',args:[code]});
  return (r.rows[0]?.id as string | undefined) ?? null;
}

/** Starts a session and returns the raw token for the cookie; only its hash is stored. */
export async function createSession(accountId: string, ip: string | null = null) {
  await init();
  const token = randomBytes(32).toString('hex'), now = Date.now(), network = ipHash(ip);
  await db.batch([
    {sql:'INSERT INTO sessions (token_hash,account_id,created_at,expires_at,ip_hash) VALUES (?,?,?,?,?)',args:[sha256(token),accountId,new Date(now).toISOString(),new Date(now + SESSION_DAYS*24*60*60*1000).toISOString(),network]},
    ...(network ? [{sql:'INSERT OR IGNORE INTO account_networks (account_id, ip_hash) VALUES (?,?)',args:[accountId,network]}] : []),
  ],'write');
  return token;
}

export async function accountForSession(token: string | undefined | null): Promise<Account|null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  await init();
  const r = await db.execute({sql:'SELECT accounts.* FROM sessions JOIN accounts ON accounts.id=sessions.account_id WHERE sessions.token_hash=? AND sessions.expires_at>?',args:[sha256(token),new Date().toISOString()]});
  return (r.rows[0] as unknown as Account) || null;
}

export async function deleteSession(token: string) {
  await init();
  await db.execute({sql:'DELETE FROM sessions WHERE token_hash=?',args:[sha256(token)]});
}

/** Non-archived quotes count against the free limit; founders and Pro have none (limit null). */
export async function quoteAllowance(account: Account) {
  await init();
  const r = await db.execute({sql:'SELECT COUNT(*) AS n FROM quotes WHERE account_id=? AND archived_at IS NULL',args:[account.id]});
  const active = Number(r.rows[0].n);
  const limit = hasProFeatures(account) ? null : FREE_ACTIVE_QUOTES + Number(account.bonus_slots);
  return {active, limit, canCreate: limit == null || active < limit};
}

/** Attaches an unowned quote to an account. A quote a client already opened activates the account. */
export async function claimQuote(quoteId: string, accountId: string) {
  await init();
  const r = await db.execute({sql:'UPDATE quotes SET account_id=? WHERE id=? AND account_id IS NULL',args:[accountId,quoteId]});
  if (!r.rowsAffected) return false;
  await activateForQuote(quoteId);
  return true;
}

/** Archives or restores an owned quote. Restoring is refused when it would exceed the account's limit. */
export async function setArchived(quoteId: string, accountId: string, archived: boolean) {
  await init();
  if (!archived) {
    const account = await getAccount(accountId);
    if (!account || !(await quoteAllowance(account)).canCreate) return false;
  }
  const r = await db.execute({sql:`UPDATE quotes SET archived_at=? WHERE id=? AND account_id=? AND archived_at IS ${archived ? 'NULL' : 'NOT NULL'}`,args:[archived ? new Date().toISOString() : null,quoteId,accountId]});
  return r.rowsAffected > 0;
}

export async function listAccountQuotes(accountId: string): Promise<Quote[]> {
  await init();
  const r = await db.execute({sql:'SELECT * FROM quotes WHERE account_id=? ORDER BY updated_at DESC',args:[accountId]});
  return r.rows as unknown as Quote[];
}

export async function joinProWaitlist(accountId: string) {
  await init();
  await db.execute({sql:'UPDATE accounts SET pro_waitlist_at=? WHERE id=? AND pro_waitlist_at IS NULL',args:[new Date().toISOString(),accountId]});
}

export async function foundersRemaining() {
  await init();
  const r = await db.execute('SELECT COUNT(*) AS n FROM accounts WHERE founder_number IS NOT NULL');
  return Math.max(0, FOUNDER_SPOTS - Number(r.rows[0].n));
}

export async function countActivatedInvitees(accountId: string) {
  await init();
  const r = await db.execute({sql:'SELECT COUNT(*) AS n FROM accounts WHERE referred_by=? AND referral_credited_at IS NOT NULL',args:[accountId]});
  return Number(r.rows[0].n);
}

/**
 * Called when a client opens an owned quote (the caller skips bots, previews and the owner's own visits).
 * Activates the owner once: takes a founder spot while any remain, then credits a referral once.
 */
export async function activateForQuote(quoteId: string, viewerIp: string | null = null) {
  await init();
  const now = new Date().toISOString();
  const owner = await db.execute({sql:'SELECT account_id, first_view_ip FROM quotes WHERE id=? AND account_id IS NOT NULL AND first_viewed_at IS NOT NULL',args:[quoteId]});
  const accountId = owner.rows[0]?.account_id as string | undefined;
  if (!accountId) return;
  // A view from an address the owner signed in from (say, their own link in a private window) does not activate.
  // Without a live viewer (a quote claimed at sign-in), the first recorded view is checked instead.
  const viewHash = viewerIp ? ipHash(viewerIp) : (owner.rows[0]?.first_view_ip as string | null);
  if (viewHash) {
    const own = await db.execute({sql:'SELECT 1 FROM account_networks WHERE account_id=? AND ip_hash=? LIMIT 1',args:[accountId,viewHash]});
    if (own.rows.length) return;
  }
  const activated = await db.execute({sql:'UPDATE accounts SET activated_at=? WHERE id=? AND activated_at IS NULL',args:[now,accountId]});
  if (!activated.rowsAffected) return;
  try {
    // One statement reads the count and claims the next number; the UNIQUE index rejects a concurrent duplicate.
    await db.execute({sql:'UPDATE accounts SET founder_number=(SELECT COALESCE(MAX(founder_number),0)+1 FROM accounts) WHERE id=? AND founder_number IS NULL AND (SELECT COUNT(*) FROM accounts WHERE founder_number IS NOT NULL) < ?',args:[accountId,FOUNDER_SPOTS]});
  } catch (error) {
    if (!String(error).includes('UNIQUE')) throw error;
  }
  await db.batch([
    {sql:'UPDATE accounts SET referral_credited_at=?, bonus_slots=bonus_slots+? WHERE id=? AND referred_by IS NOT NULL AND referral_credited_at IS NULL',args:[now,REFERRAL_BONUS,accountId]},
    // The invitee was just counted above, so the inviter is credited while its credited invitees number at most the cap.
    {sql:'UPDATE accounts SET bonus_slots=bonus_slots+? WHERE changes()=1 AND id=(SELECT referred_by FROM accounts WHERE id=?) AND (SELECT COUNT(*) FROM accounts WHERE referred_by=(SELECT referred_by FROM accounts WHERE id=?) AND referral_credited_at IS NOT NULL) <= ?',args:[REFERRAL_BONUS,accountId,accountId,REFERRAL_CAP]},
  ],'write');
}

// ---- Pro billing and branding --------------------------------------------------------------------

/** Remembers the subscription a checkout just created, so the account page can sync it before any webhook. */
export async function recordPendingSubscription(accountId: string, provider: BillingProvider, subscriptionId: string) {
  await init();
  // Never replace a subscription that is still paid for.
  await db.execute({sql:'UPDATE accounts SET billing_provider=?, subscription_id=?, subscription_status=?, cancel_at_period_end=0 WHERE id=? AND (pro_until IS NULL OR pro_until<=?)',args:[provider,subscriptionId,'created',accountId,new Date().toISOString()]});
}

export async function accountForSubscription(subscriptionId: string): Promise<Account|null> {
  await init();
  const r = await db.execute({sql:'SELECT * FROM accounts WHERE subscription_id=?',args:[subscriptionId]});
  return (r.rows[0] as unknown as Account) || null;
}

/**
 * Stores a subscription's current state on its account. A paid state always wins. A lapsed state is applied
 * only to the subscription the account already tracks, so a stale old subscription cannot end a newer one.
 * Returns false when nothing was written (unknown account, or a lapsed state for a different subscription).
 */
export async function applySubscription(accountId: string, state: SubscriptionState) {
  await init();
  const proUntil = state.entitled && state.periodEnd ? new Date(state.periodEnd.getTime() + RENEWAL_GRACE_DAYS*24*60*60*1000).toISOString() : null;
  const r = await db.execute({
    // cancelAtPeriodEnd null means the provider does not say; keep what the app recorded for the same subscription.
    sql:`UPDATE accounts SET cancel_at_period_end=COALESCE(?, CASE WHEN subscription_id=? THEN cancel_at_period_end ELSE 0 END),
      billing_provider=?, subscription_id=?, subscription_status=?, pro_until=?, billing_synced_at=?
      WHERE id=? AND (?=1 OR subscription_id IS NULL OR subscription_id=?)`,
    args:[state.cancelAtPeriodEnd == null ? null : state.cancelAtPeriodEnd ? 1 : 0,state.subscriptionId,state.provider,state.subscriptionId,state.status,proUntil,new Date().toISOString(),accountId,state.entitled ? 1 : 0,state.subscriptionId],
  });
  return r.rowsAffected > 0;
}

/** Saves the accent colour (#rrggbb or null) and, when given, a new logo or its removal. Callers check Pro and validate. */
export async function setBranding(accountId: string, color: string | null, logo?: { data: Uint8Array; type: string } | 'remove') {
  await init();
  const now = new Date().toISOString();
  await db.batch([
    {sql:'UPDATE accounts SET brand_color=? WHERE id=?',args:[color,accountId]},
    ...(logo === 'remove' ? [
      {sql:'DELETE FROM brand_logos WHERE account_id=?',args:[accountId]},
      {sql:'UPDATE accounts SET brand_logo_at=NULL WHERE id=?',args:[accountId]},
    ] : logo ? [
      {sql:'INSERT INTO brand_logos (account_id,data,type) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET data=excluded.data,type=excluded.type',args:[accountId,logo.data,logo.type]},
      {sql:'UPDATE accounts SET brand_logo_at=? WHERE id=?',args:[now,accountId]},
    ] : []),
  ],'write');
}

export async function getBrandLogo(accountId: string) {
  await init();
  const r = await db.execute({sql:'SELECT data,type FROM brand_logos WHERE account_id=?',args:[accountId]});
  const row = r.rows[0];
  return row ? { data: new Uint8Array(row.data as ArrayBuffer), type: String(row.type) } : null;
}

export async function markBillingSynced(accountId: string) {
  await init();
  await db.execute({sql:'UPDATE accounts SET billing_synced_at=? WHERE id=?',args:[new Date().toISOString(),accountId]});
}
