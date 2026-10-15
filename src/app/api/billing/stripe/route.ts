import { handleWebhook } from '@/lib/billing-webhooks';

// Stripe Billing webhook. The signature covers the exact raw body, so read it as text before parsing.
export async function POST(request: Request) {
  return handleWebhook('stripe', await request.text(), request.headers.get('stripe-signature'));
}
