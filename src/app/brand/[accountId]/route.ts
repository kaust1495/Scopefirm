import { getAccount, getBrandLogo, hasProFeatures } from '@/lib/store';

// A Pro or founder freelancer's logo, served from our own origin with a fixed, sniffed image type.
export async function GET(_request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  if (!/^[a-f0-9]{24}$/.test(accountId)) return new Response('Not found', { status: 404 });
  const account = await getAccount(accountId);
  const logo = account && hasProFeatures(account) ? await getBrandLogo(accountId) : null;
  if (!logo) return new Response('Not found', { status: 404 });
  return new Response(logo.data as BodyInit, { headers: {
    'Content-Type': logo.type,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    // The URL carries the upload time (?v=), so a changed logo is a new URL.
    'Cache-Control': 'public, max-age=86400',
  } });
}
