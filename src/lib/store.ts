import { createClient } from '@libsql/client';
import { randomBytes } from 'node:crypto';

// Local SQLite for development; configure Turso's libSQL URL/token for a durable Vercel deployment.
const url = process.env.TURSO_DATABASE_URL || 'file:./scopefirm.db';
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
let ready: Promise<void> | undefined;
function init() {
  return ready ||= (async () => {
    if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before deploying on Vercel. Its local filesystem is not durable.');
    await db.execute(`CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, edit_key TEXT NOT NULL, client TEXT NOT NULL, project TEXT NOT NULL, ask TEXT NOT NULL, deliverables TEXT NOT NULL, exclusions TEXT NOT NULL, price INTEGER NOT NULL, revision_limit INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, accepted_at TEXT, accepted_revision INTEGER)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, note TEXT NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL)`);
  })();
}
export type Quote = { id:string; edit_key:string; client:string; project:string; ask:string; deliverables:string; exclusions:string; price:number; revision_limit:number; revision:number; status:string; created_at:string; updated_at:string; accepted_at:string|null; accepted_revision:number|null };
export type History = {id:number; quote_id:string; revision:number; kind:string; note:string; snapshot:string; created_at:string};
const id = () => randomBytes(12).toString('hex');
export async function createQuote(input: Omit<Quote,'id'|'edit_key'|'revision'|'status'|'created_at'|'updated_at'|'accepted_at'|'accepted_revision'>) {
  await init(); const quoteId=id(), editKey=id()+id(), now=new Date().toISOString();
  await db.execute({sql:'INSERT INTO quotes (id,edit_key,client,project,ask,deliverables,exclusions,price,revision_limit,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',args:[quoteId,editKey,input.client,input.project,input.ask,input.deliverables,input.exclusions,input.price,input.revision_limit,now,now]});
  const q = await getQuote(quoteId); if (!q) throw new Error('Quote not found after creation');
  await db.execute({sql:'INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) VALUES (?,?,?,?,?,?)',args:[quoteId,1,'created','Draft created',JSON.stringify(q),now]});
  return q;
}
export async function getQuote(quoteId:string):Promise<Quote|null> { await init(); const result=await db.execute({sql:'SELECT * FROM quotes WHERE id=?',args:[quoteId]}); return result.rows[0] as unknown as Quote || null; }
export async function getHistory(quoteId:string):Promise<History[]> { await init(); const r=await db.execute({sql:'SELECT * FROM history WHERE quote_id=? ORDER BY id DESC',args:[quoteId]}); return r.rows as unknown as History[]; }
export async function reviseQuote(q:Quote, input:Pick<Quote,'client'|'project'|'ask'|'deliverables'|'exclusions'|'price'|'revision_limit'>) {
  await init(); if(q.status==='accepted') throw new Error('Accepted quotes are locked. Create a new quote for new work.');
  const now=new Date().toISOString(), next=q.revision+1;
  const result=await db.execute({sql:'UPDATE quotes SET client=?,project=?,ask=?,deliverables=?,exclusions=?,price=?,revision_limit=?,revision=?,status=?,updated_at=? WHERE id=? AND revision=? AND status!=?',args:[input.client,input.project,input.ask,input.deliverables,input.exclusions,input.price,input.revision_limit,next,'sent',now,q.id,q.revision,'accepted']});
  if(!result.rowsAffected) throw new Error('This quote changed. Refresh and try again.');
  const latest=await getQuote(q.id); await db.execute({sql:'INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) VALUES (?,?,?,?,?,?)',args:[q.id,next,'revised','Scope updated',JSON.stringify(latest),now]});
}
export async function clientAction(q:Quote, kind:'accepted'|'change_requested', note:string) {
  await init(); if(q.status==='accepted') throw new Error('This quote is already accepted.');
  const now=new Date().toISOString();
  const result=await db.execute({sql:'UPDATE quotes SET status=?,updated_at=?,accepted_at=?,accepted_revision=? WHERE id=? AND revision=? AND status!=?',args:[kind,now,kind==='accepted'?now:null,kind==='accepted'?q.revision:null,q.id,q.revision,'accepted']});
  if(!result.rowsAffected) throw new Error('This quote changed. Refresh and review the latest version.');
  await db.execute({sql:'INSERT INTO history (quote_id,revision,kind,note,snapshot,created_at) VALUES (?,?,?,?,?,?)',args:[q.id,q.revision,kind,note,JSON.stringify({...q,status:kind,accepted_at:kind==='accepted'?now:null,accepted_revision:kind==='accepted'?q.revision:null}),now]});
}
