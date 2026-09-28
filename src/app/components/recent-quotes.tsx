'use client';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

// Per-device convenience list. Stores only the quote id and names, never the editor key.
type Recent = { id: string; project: string; client: string; seen: string };
const storageKey = 'scopefirm_recent_quotes';

const changed = 'scopefirm-recent-change';
function raw() { try { return localStorage.getItem(storageKey) || '[]'; } catch { return '[]'; } }
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange); window.addEventListener(changed, onChange);
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener(changed, onChange); };
}
function parse(value: string): Recent[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(r => r && /^[a-f0-9]{24}$/.test(r.id)).slice(0, 20) : [];
  } catch { return []; }
}
const read = () => parse(raw());
function write(list: Recent[]) {
  try { localStorage.setItem(storageKey, JSON.stringify(list.slice(0, 20))); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(changed));
}

export function RememberQuote({ id, project, client }: { id: string; project: string; client: string }) {
  useEffect(() => {
    write([{ id, project, client, seen: new Date().toISOString() }, ...read().filter(r => r.id !== id)]);
  }, [id, project, client]);
  return null;
}

export function ForgetQuote({ id }: { id: string }) {
  useEffect(() => { write(read().filter(r => r.id !== id)); }, [id]);
  return null;
}

export function RecentQuotes() {
  const value = useSyncExternalStore(subscribe, raw, () => '[]');
  const list = useMemo(() => parse(value), [value]);
  if (!list.length) return null;
  return <section className="panel recent" aria-labelledby="recent-quotes">
    <span className="kicker">ON THIS DEVICE</span>
    <h2 id="recent-quotes">Your recent quotes</h2>
    <ul>{list.map(r => <li key={r.id}><a href={`/quotes/${r.id}`}>{r.project}</a> <span className="hint">for {r.client}</span></li>)}</ul>
    <p className="hint">Opens while this browser is still signed in to the quote (30 days). Otherwise use the private editor link you saved.</p>
    <button type="button" className="secondary" onClick={() => write([])}>Clear this list</button>
  </section>;
}
