type NextStep = { href: string; label: string };
const nextSteps: Record<string, NextStep[]> = {
  'client-approved-then-asked-for-changes': [
    { href: '/tools/change-order-email-generator', label: 'Draft a reply to the extra request' },
    { href: '/blog/web-design-revision-clause-examples', label: 'Check what your revision clause covers' },
  ],
  'web-design-revision-clause-examples': [
    { href: '/blog/what-counts-as-a-revision-round', label: 'Define a revision round' },
    { href: '/templates', label: 'Check your scope before sending it' },
  ],
  'web-design-scope-of-work': [
    { href: '/templates', label: 'Check your scope before sending it' },
    { href: '/blog/web-design-revision-clause-examples', label: 'Write a clearer revision clause' },
  ],
  'what-counts-as-a-revision-round': [
    { href: '/blog/web-design-revision-clause-examples', label: 'See revision clause examples' },
    { href: '/tools/change-order-email-generator', label: 'Draft a reply when a request is outside scope' },
  ],
  'change-orders-for-freelancers': [
    { href: '/tools/scope-creep-calculator', label: 'Estimate the extra work at your rate' },
    { href: '/tools/change-order-email-generator', label: 'Draft a change-order email' },
  ],
  'getting-paid-by-clients-abroad': [
    { href: '/faq', label: 'Check payment and approval limits' },
    { href: '/blog/web-design-scope-of-work', label: 'Put the scope in writing first' },
  ],
  'upwork-fiverr-or-direct-clients': [
    { href: '/compare', label: 'Compare tools for direct clients' },
    { href: '/templates', label: 'Check your next fixed-price scope' },
  ],
};
export function blogNextSteps(slug: string): NextStep[] {
  return (nextSteps[slug] || [{ href: '/templates', label: 'Check your scope before sending it' }]).filter(item => item.href !== `/blog/${slug}`);
}
