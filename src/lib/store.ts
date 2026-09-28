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
    if (!columns.rows.some(row => row.name === 'currency')) {
      try { await db.execute("ALTER TABLE quotes ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR'"); }
      catch (error) {
        // Concurrent cold starts may both see the old schema. Only ignore that exact race.
        if (!String(error).includes('duplicate column name: currency')) throw error;
      }
    }
    await db.execute(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, note TEXT NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS history_quote ON history (quote_id, created_at)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS rate_events (bucket TEXT NOT NULL, created_at TEXT NOT NULL)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS rate_events_bucket ON rate_events (bucket, created_at)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS change_orders (id TEXT PRIMARY KEY, quote_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, price REAL NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed', created_at TEXT NOT NULL, responded_at TEXT)`);
  })();
}
export type Quote = { id:string; edit_key:string; client:string; project:string; ask:string; deliverables:string; exclusions:string; price:number; currency:QuoteCurrency; revision_limit:number; revision:number; status:string; created_at:string; updated_at:string; accepted_at:string|null; accepted_revision:number|null };
export type ChangeOrder = {id:string; quote_id:string; title:string; description:string; price:number; currency:QuoteCurrency; status:'proposed'|'accepted'|'rejected'; created_at:string; responded_at:string|null};
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
  const [, count] = await db.batch([
    {sql:'DELETE FROM rate_events WHERE created_at < ?', args:[new Date(now.getTime() - 24*60*60*1000).toISOString()]},
    {sql:'SELECT COUNT(*) AS n FROM rate_events WHERE bucket=? AND created_at >= ?', args:[bucket, since]},
  ],'write');
  if (Number(count.rows[0].n) >= limit) return false;
  await db.execute({sql:'INSERT INTO rate_events (bucket, created_at) VALUES (?, ?)', args:[bucket, now.toISOString()]});
  return true;
}
export async function createQuote(input: Omit<Quote,'id'|'edit_key'|'revision'|'status'|'created_at'|'updated_at'|'accepted_at'|'accepted_revision'>) {
  await init(); const quoteId=id(), editKey=id()+id(), now=new Date().toISOString();
  const q: Quote = {...input, id:quoteId, edit_key:editKey, revision:1, status:'draft', created_at:now, updated_at:now, accepted_at:null, accepted_revision:null};
  await db.batch([
    {sql:'INSERT INTO quotes (id,edit_key,client,project,ask,deliverables,exclusions,price,currency,revision_limit,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',args:[quoteId,editKey,input.client,input.project,input.ask,input.deliverables,input.exclusions,input.price,input.currency,input.revision_limit,now,now]},
    {sql:'INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) VALUES (?,?,?,?,?,?)',args:[quoteId,1,'created','Draft created',snapshot(q),now]},
  ],'write');
  return q;
}
export async function getQuote(quoteId:string):Promise<Quote|null> { await init(); const result=await db.execute({sql:'SELECT * FROM quotes WHERE id=?',args:[quoteId]}); return result.rows[0] as unknown as Quote || null; }
export async function getHistory(quoteId:string):Promise<History[]> { await init(); const r=await db.execute({sql:'SELECT * FROM history WHERE quote_id=? ORDER BY id DESC',args:[quoteId]}); return r.rows as unknown as History[]; }
export async function reviseQuote(q:Quote, input:Pick<Quote,'client'|'project'|'ask'|'deliverables'|'exclusions'|'price'|'currency'|'revision_limit'>) {
  await init(); if(q.status==='accepted') throw new Error('Accepted quotes are locked. Create a new quote for new work.');
  const now=new Date().toISOString(), next=q.revision+1;
  const latest: Quote = {...q, ...input, revision:next, status:'sent', updated_at:now};
  // One transaction: the history row is written only if the guarded update changed the quote.
  const [result]=await db.batch([
    {sql:'UPDATE quotes SET client=?,project=?,ask=?,deliverables=?,exclusions=?,price=?,currency=?,revision_limit=?,revision=?,status=?,updated_at=? WHERE id=? AND revision=? AND status!=?',args:[input.client,input.project,input.ask,input.deliverables,input.exclusions,input.price,input.currency,input.revision_limit,next,'sent',now,q.id,q.revision,'accepted']},
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
    {sql:'DELETE FROM quotes WHERE id=? AND edit_key=?',args:[quoteId,key]},
    {sql:'DELETE FROM history WHERE quote_id=?',args:[quoteId]},
    {sql:'DELETE FROM change_orders WHERE quote_id=?',args:[quoteId]},
  ],'write');
  return true;
}

export async function getChangeOrders(quoteId:string):Promise<ChangeOrder[]> {
  await init();
  const r=await db.execute({sql:'SELECT * FROM change_orders WHERE quote_id=? ORDER BY created_at,id',args:[quoteId]});
  return r.rows as unknown as ChangeOrder[];
}
export async function addChangeOrder(q:Quote, input:{title:string; description:string; price:number}) {
  await init();
  if(q.status!=='accepted') throw new Error('Accept the original quote before proposing additional work.');
  const orderId=id(), now=new Date().toISOString();
  const current=await getQuote(q.id);
  if(!current || current.status!=='accepted' || current.currency!==q.currency) throw new Error('Original quote changed. Refresh before proposing extra work.');
  await db.execute({sql:'INSERT INTO change_orders (id,quote_id,title,description,price,currency,status,created_at) VALUES (?,?,?,?,?,?,?,?)',args:[orderId,q.id,input.title,input.description,input.price,q.currency,'proposed',now]});
  return orderId;
}
export async function decideChangeOrder(q:Quote, orderId:string, choice:'accepted'|'rejected') {
  await init();
  const now=new Date().toISOString();
  const result=await db.execute({sql:"UPDATE change_orders SET status=?,responded_at=? WHERE id=? AND quote_id=? AND currency=? AND status='proposed'",args:[choice,now,orderId,q.id,q.currency]});
  return result.rowsAffected>0;
}
