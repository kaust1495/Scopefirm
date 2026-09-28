'use client';
import { useSyncExternalStore } from 'react';

// The server renders UTC; once in the browser the time switches to the viewer's own timezone.
const noop = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const styles = {
  datetime: { dateStyle: 'medium', timeStyle: 'short' },
  full: { dateStyle: 'full', timeStyle: 'short' },
  date: { dateStyle: 'medium' },
} as const;

export function LocalTime({ iso, style = 'datetime' }: { iso: string; style?: keyof typeof styles }) {
  const zone = useSyncExternalStore(noop, browserZone, () => null);
  const date = new Date(iso);
  const text = zone
    ? new Intl.DateTimeFormat(undefined, { ...styles[style], timeZone: zone }).format(date) + (style === 'date' ? '' : ` ${shortZone(date, zone)}`)
    : new Intl.DateTimeFormat('en-GB', { ...styles[style], timeZone: 'UTC' }).format(date) + (style === 'date' ? '' : ' UTC');
  return <time dateTime={iso}>{text}</time>;
}

function shortZone(date: Date, zone: string) {
  return new Intl.DateTimeFormat(undefined, { timeZone: zone, timeZoneName: 'short' }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value ?? zone;
}
