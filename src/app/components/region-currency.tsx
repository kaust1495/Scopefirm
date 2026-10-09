'use client';
import { useEffect, useRef } from 'react';

/**
 * Keeps a new quote's currency in step with the region radios (India → INR, Elsewhere → USD)
 * until the freelancer picks a currency themselves.
 */
export function RegionCurrency() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    const select = form?.querySelector<HTMLSelectElement>('select[name=currency]');
    if (!form || !select) return;
    let touched = false;
    const onSelect = () => { touched = true; };
    const onRegion = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.name === 'region' && !touched) select.value = t.value === 'IN' ? 'INR' : 'USD';
    };
    select.addEventListener('change', onSelect);
    form.addEventListener('change', onRegion);
    return () => { select.removeEventListener('change', onSelect); form.removeEventListener('change', onRegion); };
  }, []);
  return <span ref={ref} hidden/>;
}
