export const approvalBranding: 'normal' | 'small' | 'off' = 'normal';
export type Attribution = { utm_source: string; utm_medium: string; utm_campaign: string };
const sources = ['client_approval', 'scope_creep_calculator', 'change_order_email_generator', 'templates', 'reddit', 'quora', 'indiehackers', 'medium', 'hashnode', 'linkedin', 'youtube', 'alternativeto', 'betalist', 'uneed', 'peerlist'];
const media = ['tool', 'template', 'referral', 'community', 'article', 'social', 'video', 'directory'];
const campaigns = ['week1', 'free-tools', 'referral'];
export function attribution(values: Record<string, unknown> | null): Attribution | null {
  const pick = (key: string, allowed: string[]) => { const value = String(values?.[key] || '').trim().toLowerCase(); return allowed.includes(value) ? value : ''; };
  const result = { utm_source: pick('utm_source', sources), utm_medium: pick('utm_medium', media), utm_campaign: pick('utm_campaign', campaigns) };
  return Object.values(result).every(Boolean) ? result : null;
}
