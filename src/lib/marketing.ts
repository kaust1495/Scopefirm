export const approvalBranding: 'normal' | 'small' | 'off' = 'normal';
export type Attribution = { utm_source: string; utm_medium: string; utm_campaign: string; utm_content?: string };
// Any clean lowercase tag is kept: fixed allowlists silently dropped every new platform or campaign.
// Still never store full URLs, referrers, or arbitrary query values - one short slug per field.
const tag = (value: unknown): string => {
  const v = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9.-]{0,49}$/.test(v) ? v : '';
};
export function attribution(values: Record<string, unknown> | null): Attribution | null {
  // Product Hunt links carry its own ?ref=producthunt rather than UTM tags; explicit UTM tags still win.
  if (!values?.utm_source && String(values?.ref || '').trim().toLowerCase() === 'producthunt') values = { ...values, utm_source: 'producthunt', utm_medium: 'directory', utm_campaign: 'launch' };
  const aiSource = ['chatgpt.com', 'perplexity.ai'].includes(String(values?.utm_source || '').trim().toLowerCase());
  if (aiSource) values = { ...values, utm_medium: values?.utm_medium || 'referral', utm_campaign: values?.utm_campaign || 'ai-search' };
  const result: Attribution = { utm_source: tag(values?.utm_source), utm_medium: tag(values?.utm_medium), utm_campaign: tag(values?.utm_campaign) };
  if (!result.utm_source || !result.utm_medium || !result.utm_campaign) return null;
  const content = tag(values?.utm_content);
  if (content) result.utm_content = content;
  return result;
}
