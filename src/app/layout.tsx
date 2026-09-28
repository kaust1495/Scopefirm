import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import './globals.css';
import Link from 'next/link';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'ScopeFirm | Fixed-price scope and quote approval for freelancers', template: '%s | ScopeFirm' },
  description: siteDescription,
  applicationName: siteName,
  keywords: ['freelance quote', 'scope of work', 'client approval', 'change order', 'scope creep', 'fixed price quote', 'web design quote', 'freelancer India'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName, url: '/', title: 'ScopeFirm | Clear scope. Confident yes.', description: siteDescription, locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title: 'ScopeFirm | Clear scope. Confident yes.', description: siteDescription },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#205d43', width: 'device-width', initialScale: 1 };

export default async function RootLayout({children}:{children:React.ReactNode}){
  // Every page renders per request so Next.js can attach the CSP nonce from src/proxy.ts.
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: siteName, url: siteUrl,
    description: siteDescription, applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  };
  return <html lang="en"><body><script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd).replace(/</g, '\\u003c')}}/><header className="top"><Link href="/" className="logo" aria-label="ScopeFirm home">scope<span>firm</span><i>.</i></Link><span className="top-note">Fixed scope. Fewer surprises.</span></header>{children}<footer>ScopeFirm · A lightweight scope approval prototype · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></footer></body></html>
}
