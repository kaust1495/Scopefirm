import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

// Public pages are open to search engines and AI assistants, so ScopeFirm can be found and cited.
// Quote and tracker pages are private capability links and stay out of every index.
const privatePaths = ['/q/', '/quotes/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: privatePaths },
      { userAgent: ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended'], allow: '/', disallow: privatePaths },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
