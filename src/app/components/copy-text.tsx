'use client';
import { useState } from 'react';

/** Copies an absolute URL for a site path, such as an invite link. */
export function CopyText({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(window.location.origin + path); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    catch { setCopied(false); }
  }
  return <button className="secondary" type="button" onClick={copy}>{copied ? 'Copied' : label}</button>;
}
