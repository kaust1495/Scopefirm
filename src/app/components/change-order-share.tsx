'use client';
import { useState } from 'react';

/** Copies a WhatsApp-ready message for one proposed change order. Carries the public client link only — never the editor key. */
export function ChangeOrderShare({ project, title, price, advance, path }: { project: string; title: string; price: string; advance: string | null; path: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const message = () => `Extra work for ${project}: ${title} — ${price}${advance ? ` (advance ${advance} due now)` : ''}. Please review and approve here: ${window.location.origin}${path}`;
  async function copy() {
    try { await navigator.clipboard.writeText(message()); setCopied(true); setFailed(false); setTimeout(() => setCopied(false), 2200); }
    catch { setFailed(true); }
  }
  return <><button className="secondary" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy WhatsApp message'}</button>{failed && <p role="alert" className="error">Could not copy. Open the client view and copy the link instead.</p>}</>;
}
