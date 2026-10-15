// HTTP-level end-to-end harness: drives a running FirmQuote server the way a browser with JavaScript off does.
// It reads each page's server-action forms, submits them with a per-visitor cookie jar, and records results.
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@libsql/client';

export const BASE = process.env.E2E_BASE || 'http://localhost:3200';
export const EMAILS = process.env.E2E_EMAILS;
export const db = createClient({ url: process.env.E2E_DB || 'file:./e2e-prod.db' });

const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attr = (tag, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag); return m ? decode(m[1]) : null; };

/** One browser: a cookie jar (path-scoped, Max-Age=0 deletes) and a fixed client IP. */
export class Visitor {
  constructor(ip = `10.${rnd()}.${rnd()}.${rnd()}`) { this.ip = ip; this.jar = new Map(); }
  cookieHeader(path) {
    return [...this.jar.values()].filter(c => path.startsWith(c.path)).map(c => `${c.name}=${c.value}`).join('; ');
  }
  absorb(res) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const eq = pair.indexOf('='), name = pair.slice(0, eq).trim(), value = pair.slice(eq + 1).trim();
      const opts = Object.fromEntries(attrs.map(a => { const [k, v] = a.trim().split('='); return [k.toLowerCase(), v ?? true]; }));
      const path = opts.path || '/';
      if (opts['max-age'] === '0' || value === '') this.jar.delete(`${name}|${path}`);
      else this.jar.set(`${name}|${path}`, { name, value, path });
    }
  }
  cookie(name) { return [...this.jar.values()].find(c => c.name === name)?.value; }
  async request(path, init = {}) {
    const url = new URL(path, BASE);
    const headers = { 'x-real-ip': this.ip, 'user-agent': 'Mozilla/5.0 FirmQuoteE2E', ...(init.headers || {}) };
    const cookie = this.cookieHeader(url.pathname);
    if (cookie) headers.cookie = cookie;
    const res = await fetch(url, { ...init, headers, redirect: 'manual' });
    this.absorb(res);
    const body = await res.text();
    return { status: res.status, location: res.headers.get('location'), body, headers: res.headers };
  }
  get(path) { return this.request(path); }
  /** Follows redirects (GETs) and returns the final page. */
  async follow(path, max = 5) {
    let r = await this.get(path);
    for (let i = 0; i < max && r.status >= 300 && r.status < 400 && r.location; i++) r = await this.get(r.location);
    return r;
  }
  /**
   * Submits the server-action form on `page` whose HTML matches `pick` (string or RegExp), with `fields`
   * overriding its defaults. Returns the raw response (303 + Location for every FirmQuote action).
   */
  async submit(page, pick, fields = {}) {
    const html = typeof page === 'string' ? (await this.get(page)).body : page.body;
    const path = typeof page === 'string' ? page : page.path;
    const forms = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(m => m[0]).filter(f => f.includes('$ACTION_ID_'));
    const form = forms.find(f => typeof pick === 'string' ? f.includes(pick) : pick.test(f));
    if (!form) throw new Error(`No form matching ${pick} on ${path} (forms: ${forms.length})`);
    const data = new FormData();
    for (const tag of form.match(/<input\b[^>]*>/g) || []) {
      const name = attr(tag, 'name'); if (!name) continue;
      const type = (attr(tag, 'type') || 'text').toLowerCase();
      if ((type === 'checkbox' || type === 'radio') && !/\schecked(=|\s|>|\/)/.test(tag)) continue;
      if (type === 'file') continue;
      data.set(name, attr(tag, 'value') ?? '');
    }
    for (const m of form.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) { const name = attr(m[1], 'name'); if (name) data.set(name, decode(m[2])); }
    for (const m of form.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
      const name = attr(m[1], 'name'); if (!name) continue;
      const sel = /<option\b[^>]*\sselected[^>]*>/.exec(m[2]) || /<option\b[^>]*>/.exec(m[2]);
      if (sel) data.set(name, attr(sel[0], 'value') ?? '');
    }
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      if (v === null) data.delete(k); else data.set(k, v);
    }
    return this.request(path, { method: 'POST', body: data });
  }
}

function rnd() { return 1 + Math.floor(Math.random() * 250); }

/** The newest code emailed to `to` whose subject matches `kind` ('sign-in' | 'approval'). */
export function lastCode(to, kind) {
  if (!EMAILS || !existsSync(EMAILS)) throw new Error('E2E_EMAILS not set');
  const lines = readFileSync(EMAILS, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  const hit = lines.reverse().find(l => l.to?.includes(to) && l.subject.includes(kind));
  return hit ? /(\d{6})/.exec(hit.subject)[1] : null;
}

export const quoteId = loc => /\/quotes\/([a-f0-9]{24})/.exec(loc || '')?.[1] ?? null;

// ---- Tiny test runner ------------------------------------------------------------------------------
export const results = [];
export async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log(`  PASS  ${name}`); }
  catch (e) { results.push({ name, ok: false, ms: Date.now() - t0, error: String(e.message || e) }); console.log(`  FAIL  ${name}\n        ${String(e.message || e).split('\n')[0]}`); }
}
export function expect(cond, msg) { if (!cond) throw new Error(msg); }
export function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
export function summary(title) {
  const pass = results.filter(r => r.ok).length;
  console.log(`\n${title}: ${pass}/${results.length} passed`);
  return { pass, total: results.length, failures: results.filter(r => !r.ok) };
}
