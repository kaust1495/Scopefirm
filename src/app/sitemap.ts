import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

// Only public pages. Quote and tracker links are private and excluded (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
