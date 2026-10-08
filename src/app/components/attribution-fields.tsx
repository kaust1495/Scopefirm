"use client";
import { useEffect, useState } from "react";
import { attribution } from "@/lib/marketing";
const KEY = "scopefirm-first-touch-v1";
export default function AttributionFields({ captureOnly = false }: { captureOnly?: boolean }) {
  const [labels, setLabels] = useState<import("@/lib/marketing").Attribution | null>(null);
  useEffect(() => {
    let first = null;
    try { first = attribution(JSON.parse(sessionStorage.getItem(KEY) || "null")); } catch {}
    if (!first) {
      first = attribution(Object.fromEntries(new URLSearchParams(window.location.search)));
      if (first) { try { sessionStorage.setItem(KEY, JSON.stringify(first)); } catch {} }
    }
    setLabels(first);
  }, []);
  if (captureOnly || !labels) return null;
  return Object.entries(labels).map(([name, value]) => <input type="hidden" key={name} name={name} value={value} />);
}
