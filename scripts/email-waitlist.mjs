// Emails everyone on the Pro waitlist once, when Pro opens. Dry run by default; pass --send to send.
//
//   node --env-file=.env.production.local scripts/email-waitlist.mjs          # lists who would get it
//   node --env-file=.env.production.local scripts/email-waitlist.mjs --send   # sends, once per account
//
// Needs TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN), RESEND_API_KEY and EMAIL_FROM. Founders and current Pro
// subscribers are skipped. Each account is claimed before its email goes out, so two runs never double-send.
import { createClient } from '@libsql/client';
import { pathToFileURL } from 'node:url';

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.firmquote.tech').replace(/\/$/, '');

export const subject = 'FirmQuote Pro is open';
// Fixed text: nothing user-supplied goes into the email.
export const body = () => `You joined the FirmQuote Pro waitlist. Pro is open now.

Pro gives you unlimited active quotes, your logo and accent colour on client pages, and no FirmQuote badge.
India: Rs 299 a month or Rs 2,499 a year (UPI AutoPay, cards, netbanking).
Elsewhere: $9 a month or $79 a year.

Upgrade from your account: ${siteUrl()}/account

You are getting this one email because you asked to hear when Pro opens. We won't email you about it again.`;

export const maskEmail = email => { const [user, domain] = email.split('@'); return `${user.slice(0, 1)}•••@${domain}`; };

/** Older databases may not have the column yet if the app has not started since this release. */
async function ensureColumn(db) {
  const columns = await db.execute('PRAGMA table_info(accounts)');
  if (!columns.rows.some(row => row.name === 'pro_launch_emailed_at')) await db.execute('ALTER TABLE accounts ADD COLUMN pro_launch_emailed_at TEXT');
  if (!columns.rows.some(row => row.name === 'pro_until')) await db.execute('ALTER TABLE accounts ADD COLUMN pro_until TEXT');
}

export async function eligible(db, now = new Date()) {
  await ensureColumn(db);
  const r = await db.execute({ sql: 'SELECT id, email FROM accounts WHERE pro_waitlist_at IS NOT NULL AND pro_launch_emailed_at IS NULL AND founder_number IS NULL AND (pro_until IS NULL OR pro_until <= ?) ORDER BY pro_waitlist_at', args: [now.toISOString()] });
  return r.rows.map(row => ({ id: String(row.id), email: String(row.email) }));
}

/** Claims, sends and, on a failed send, releases the claim so a later run retries that address. */
export async function sendAll(db, send, { log = console.log, pauseMs = 600 } = {}) {
  let sent = 0, failed = 0;
  for (const account of await eligible(db)) {
    const claim = await db.execute({ sql: 'UPDATE accounts SET pro_launch_emailed_at=? WHERE id=? AND pro_launch_emailed_at IS NULL', args: [new Date().toISOString(), account.id] });
    if (!claim.rowsAffected) continue;
    if (await send(account.email, subject, body())) { sent++; log(`sent ${maskEmail(account.email)}`); }
    else {
      failed++;
      await db.execute({ sql: 'UPDATE accounts SET pro_launch_emailed_at=NULL WHERE id=?', args: [account.id] });
      log(`FAILED ${maskEmail(account.email)} (will retry on the next run)`);
    }
    // Resend allows a few requests per second.
    if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
  }
  return { sent, failed };
}

async function resend(to, subjectLine, text) {
  try {
    const res = await fetch(process.env.EMAIL_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: subjectLine, text }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch { return false; }
}

async function main() {
  const db = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:./scopefirm.db', authToken: process.env.TURSO_AUTH_TOKEN });
  const list = await eligible(db);
  if (!process.argv.includes('--send')) {
    console.log(`Dry run: ${list.length} waitlisted account(s) would get "${subject}".`);
    for (const account of list) console.log(`  ${maskEmail(account.email)}`);
    console.log('\nRun again with --send to send.');
    return;
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Set RESEND_API_KEY and EMAIL_FROM first.');
  const { sent, failed } = await sendAll(db, resend);
  console.log(`Done: ${sent} sent, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
