// Public origin used for canonical URLs, the sitemap and social previews. Override per deployment if the domain changes.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://scopefirm.vercel.app').replace(/\/$/, '');
export const siteName = 'ScopeFirm';
export const siteDescription = 'Free fixed-price quotes for freelance web designers and developers: clear deliverables, one client approval link, and a dated record of every change.';
