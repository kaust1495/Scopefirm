// Public origin used for canonical URLs, the sitemap and social previews. Override per deployment if the domain changes.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.firmquote.tech').replace(/\/$/, '');
export const siteName = 'FirmQuote';
export const siteDescription = 'Fixed-price quotes for freelance web designers and developers: clear deliverables, one client approval link, and a dated record of every change. Free for initial users.';
