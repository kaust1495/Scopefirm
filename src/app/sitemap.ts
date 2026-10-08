import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';
import { posts } from '@/content/blog';

// Only public pages. Quote and tracker links are private and excluded (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: 'weekly' | 'monthly' | 'yearly') => ({ url: `${siteUrl}${path}`, changeFrequency, priority });
  return [
    page('/', 1, 'weekly'),
    page('/how-it-works', 0.8, 'monthly'),
    page('/faq', 0.7, 'monthly'),
    page('/compare', 0.7, 'monthly'),
    page('/blog', 0.7, 'weekly'),
    page('/templates', 0.7, 'monthly'),
    page('/tools/scope-creep-calculator', 0.7, 'monthly'),
    page('/tools/change-order-email-generator', 0.7, 'monthly'),
    ...posts.map(p => ({ url: `${siteUrl}/blog/${p.slug}`, lastModified: p.date, changeFrequency: 'yearly' as const, priority: 0.6 })),
    page('/support', 0.5, 'yearly'),
    page('/privacy', 0.3, 'yearly'),
    page('/terms', 0.3, 'yearly'),
  ];
}

