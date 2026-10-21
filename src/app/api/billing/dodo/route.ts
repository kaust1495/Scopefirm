import { handleWebhook } from '@/lib/billing-webhooks';

// Dodo Payments webhook (Standard Webhooks). The signature covers the exact raw body, so read it as text before parsing.
export async function POST(request: Request) {
  return handleWebhook('dodo', await request.text(), {
    id: request.headers.get('webhook-id'),
    timestamp: request.headers.get('webhook-timestamp'),
    signature: request.headers.get('webhook-signature'),
  });
}
