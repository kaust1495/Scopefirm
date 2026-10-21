export const approvalBranding: 'normal' | 'small' | 'off' = 'normal';
export type Attribution = { utm_source: string; utm_medium: string; utm_campaign: string };
const sources = ['client_approval', 'scope_creep_calculator', 'change_order_email_generator', 'templates', 'reddit', 'quora', 'indiehackers', 'medium', 'hashnode', 'linkedin', 'youtube', 'alternativeto', 'betalist', 'uneed', 'peerlist', 'chatgpt.com', 'perplexity.ai', 'producthunt'];
const media = ['tool', 'template', 'referral', 'community', 'article', 'social', 'video', 'directory'];
const campaigns = ['week1', 'free-tools', 'referral', 'ai-search', 'launch'];
export function attribution(values: Record<string, unknown> | null): Attribution | null {
  // Product Hunt links carry its own ?ref=producthunt rather than UTM tags; explicit UTM tags still win.
  if (!values?.utm_source && String(values?.ref || '').trim().toLowerCase() === 'producthunt') values = { ...values, utm_source: 'producthunt', utm_medium: 'directory', utm_campaign: 'launch' };
  const aiSource = ['chatgpt.com', 'perplexity.ai'].includes(String(values?.utm_source || '').trim().toLowerCase());
  if (aiSource) values = { ...values, utm_medium: values?.utm_medium || 'referral', utm_campaign: values?.utm_campaign || 'ai-search' };
  const pick = (key: string, allowed: string[]) => { const value = String(values?.[key] || '').trim().toLowerCase(); return allowed.includes(value) ? value : ''; };
  const result = { utm_source: pick('utm_source', sources), utm_medium: pick('utm_medium', media), utm_campaign: pick('utm_campaign', campaigns) };
  return Object.values(result).every(Boolean) ? result : null;
}
