import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import localFont from 'next/font/local';
import './globals.css';
import AttributionFields from './components/attribution-fields';
import Clarity from '@/components/clarity';
import Link from 'next/link';
import { siteDescription, siteName, siteUrl } from '@/lib/site';
import { accountsEnabled, currentAccount } from '@/lib/session';

// Font files ship with the app (from @fontsource via next/font/local): no requests to Google, no network at build time.
const newsreader = localFont({ variable: '--font-serif', display: 'swap', preload: false, src: [
  { path: '../../node_modules/@fontsource/newsreader/files/newsreader-latin-400-normal.woff2', weight: '400', style: 'normal' },
  { path: '../../node_modules/@fontsource/newsreader/files/newsreader-latin-400-italic.woff2', weight: '400', style: 'italic' },
  { path: '../../node_modules/@fontsource/newsreader/files/newsreader-latin-600-normal.woff2', weight: '600', style: 'normal' },
] });
const plexSans = localFont({ variable: '--font-sans', display: 'swap', src: [
  { path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
  { path: '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
] });
const plexMono = localFont({ variable: '--font-mono', display: 'swap', preload: false, src: [
  { path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
  { path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2', weight: '600', style: 'normal' },
] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'FirmQuote | Fixed-price scope and quote approval for freelancers', template: '%s | FirmQuote' },
  description: siteDescription,
  applicationName: siteName,
  keywords: ['freelance quote', 'scope of work', 'client approval', 'change order', 'scope creep', 'fixed price quote', 'web design quote', 'change order template', 'freelancer invoice India'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName, title: 'FirmQuote | Clear scope. Confident yes.', description: siteDescription, locale: 'en_US', alternateLocale: ['en_IN', 'en_GB'] },
  // Title and description fall back to each page's Open Graph values.
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#1f5a41', width: 'device-width', initialScale: 1 };

export default async function RootLayout({children}:{children:React.ReactNode}){
  // Every page renders per request so Next.js can attach the CSP nonce from src/proxy.ts.
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const signedIn = Boolean(await currentAccount());
  const accountLink = signedIn ? <Link href="/account">My quotes</Link> : accountsEnabled() ? <Link href="/signin">Sign in</Link> : null;
  const org = { '@context': 'https://schema.org', '@type': 'Organization', name: siteName, url: siteUrl, logo: `${siteUrl}/apple-icon`, sameAs: ['https://github.com/kaust1495/Scopefirm'] };
  const site = { '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: siteUrl, description: siteDescription };
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: siteName, url: siteUrl,
    description: siteDescription, applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
  };
  return <html lang="en" className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}><body><AttributionFields captureOnly /><Clarity /><script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{__html: JSON.stringify([jsonLd, org, site]).replace(/</g, '\\u003c')}}/><header className="top"><Link href="/" className="logo" aria-label="FirmQuote home"><svg viewBox="0 0 512 512" aria-hidden="true" className="logo-mark"><rect width="512" height="512" rx="104" fill="#1f5a41"/><rect x="90" y="105" width="68" height="300" rx="23" fill="#f5f2ea"/><rect x="90" y="105" width="222" height="68" rx="23" fill="#f5f2ea"/><rect x="90" y="229" width="194" height="62" rx="22" fill="#f5f2ea"/><circle cx="320" cy="224" r="112" fill="none" stroke="#f5f2ea" strokeWidth="56"/><path d="M351 316L446 411" fill="none" stroke="#cf7145" strokeWidth="54" strokeLinecap="round"/></svg><span className="logo-word">firm<span>quote</span></span></Link><nav className="top-nav" aria-label="Main"><Link href="/how-it-works">How it works</Link><Link href="/blog">Blog</Link><Link href="/templates">Templates</Link><Link href="/faq">FAQ</Link><Link href="/support">Support</Link>{accountLink}<Link href="/#quote-builder" className="nav-cta">Create a quote</Link></nav></header>{children}<footer><nav aria-label="Footer"><Link href="/how-it-works">How it works</Link> · <Link href="/compare">Compare</Link> · <Link href="/blog">Blog</Link> · <Link href="/templates">Templates and tools</Link> · <Link href="/faq">FAQ</Link> · <Link href="/support">Support</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></nav><p>FirmQuote · scope approval for freelancers · free for initial users</p></footer></body></html>
}
