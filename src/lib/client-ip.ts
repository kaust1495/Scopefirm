import { headers } from 'next/headers';

// Vercel sets x-real-ip itself; the first x-forwarded-for value is only a fallback for local runs.
export async function clientIp() {
  const h = await headers();
  return h.get('x-real-ip')?.trim() || h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
