"use client";
import { useEffect, useRef } from "react";
import { attribution } from "@/lib/marketing";
const KEY = "scopefirm-first-touch-v1";
export default function AttributionFields({ captureOnly = false }: { captureOnly?: boolean }) {
  const fields = useRef<Record<string, HTMLInputElement | null>>({});
  useEffect(() => {
    let first = null;
    try { first = attribution(JSON.parse(sessionStorage.getItem(KEY) || "null")); } catch {}
    if (!first) {
      first = attribution(Object.fromEntries(new URLSearchParams(window.location.search)));
      if (first) { try { sessionStorage.setItem(KEY, JSON.stringify(first)); } catch {} }
    }
    for (const name of ["utm_source", "utm_medium", "utm_campaign"]) {
      const field = fields.current[name];
      if (field) field.value = first?.[name as keyof typeof first] || "";
    }
  }, []);
  if (captureOnly) return null;
  return ["utm_source", "utm_medium", "utm_campaign"].map(name => <input type="hidden" key={name} name={name} defaultValue="" ref={node => { fields.current[name] = node; }} />);
}
