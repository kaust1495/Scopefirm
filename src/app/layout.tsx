import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import './globals.css';
import AttributionFields from './components/attribution-fields';
import Link from 'next/link';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'ScopeFirm | Fixed-price scope and quote approval for freelancers', template: '%s | ScopeFirm' },
  description: siteDescription,
  applicationName: siteName,
  keywords: ['freelance quote', 'scope of work', 'client approval', 'change order', 'scope creep', 'fixed price quote', 'web design quote', 'change order template', 'freelancer invoice India'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName, title: 'ScopeFirm | Clear scope. Confident yes.', description: siteDescription, locale: 'en_US', alternateLocale: ['en_IN', 'en_GB'] },
  // Title and description fall back to each page's Open Graph values.
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#205d43', width: 'device-width', initialScale: 1 };

export default async function RootLayout({children}:{children:React.ReactNode}){
  // Every page renders per request so Next.js can attach the CSP nonce from src/proxy.ts.
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const org = { '@context': 'https://schema.org', '@type': 'Organization', name: siteName, url: siteUrl, logo: `${siteUrl}/apple-icon`, sameAs: ['https://github.com/kaust1495/Scopefirm'] };
  const site = { '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: siteUrl, description: siteDescription };
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: siteName, url: siteUrl,
    description: siteDescription, applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return <html lang="en"><body><AttributionFields captureOnly /><script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{__html: JSON.stringify([jsonLd, org, site]).replace(/</g, '\\u003c')}}/><header className="top"><Link href="/" className="logo" aria-label="ScopeFirm home">scope<span>firm</span><i>.</i></Link><nav className="top-nav" aria-label="Main"><Link href="/how-it-works">How it works</Link><Link href="/blog">Blog</Link><Link href="/templates">Templates</Link><Link href="/faq">FAQ</Link><Link href="/support">Support</Link><Link href="/#quote-builder" className="nav-cta">Create a quote</Link></nav></header>{children}<footer><nav aria-label="Footer"><Link href="/how-it-works">How it works</Link> · <Link href="/compare">Compare</Link> · <Link href="/blog">Blog</Link> · <Link href="/templates">Templates and tools</Link> · <Link href="/faq">FAQ</Link> · <Link href="/support">Support</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></nav><p>ScopeFirm · a free scope approval prototype for freelancers</p></footer></body></html>
}

