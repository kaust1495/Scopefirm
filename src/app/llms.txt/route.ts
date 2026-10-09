import { posts } from '@/content/blog';
import { allFaqs } from '@/content/faq';
import { siteDescription, siteUrl } from '@/lib/site';

// llms.txt: a plain-Markdown index of the public site for AI assistants (llmstxt.org convention).
export const dynamic = 'force-static';

export function GET() {
  const body = [
    '# ScopeFirm',
    '',
    `> ${siteDescription}`,
    '',
    'ScopeFirm is a free web app for freelancers who quote fixed prices to direct clients. The freelancer writes a scope (deliverables, exclusions, price, currency, timeline, revision rounds) and shares one link. The client accepts a specific version or asks for changes, with no account. After acceptance the quote locks and extra work becomes priced change orders on the same link. Clients pay the freelancer directly by payment link, or UPI for India-based rupee quotes; ScopeFirm never handles money. Freelancers can download an Excel payments sheet and calendar reminders. Quote and tracker pages are private and not indexed.',
    '',
    '## Pages',
    `- [Create a quote](${siteUrl}/): the quote builder`,
    `- [How it works](${siteUrl}/how-it-works): the five-step flow`,
    `- [FAQ](${siteUrl}/faq): accounts, approval, change orders, payments, privacy`,
    `- [Templates](${siteUrl}/templates): a pre-quote scope checklist and links to the free tools`,
    `- [Change-order email generator](${siteUrl}/tools/change-order-email-generator): drafts a priced reply to a client's extra request`,
    `- [Scope-creep calculator](${siteUrl}/tools/scope-creep-calculator): extra hours × hourly rate`,
    `- [Compare](${siteUrl}/compare): ScopeFirm vs Upwork/Fiverr, all-in-one suites, free invoicing tools, WhatsApp`,
    `- [Support](${siteUrl}/support): help, bug reports and private security reports`,
    `- [Privacy](${siteUrl}/privacy) and [Terms](${siteUrl}/terms)`,
    '',
    '## Guides',
    ...posts.map(p => `- [${p.title}](${siteUrl}/blog/${p.slug}): ${p.description}`),
    '',
    '## Key facts',
    ...allFaqs.map(f => `- ${f.q} ${f.a}`),
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
