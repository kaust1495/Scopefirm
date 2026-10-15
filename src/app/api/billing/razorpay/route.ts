import { handleWebhook } from '@/lib/billing-webhooks';

// Razorpay Subscriptions webhook. The signature covers the exact raw body, so read it as text before parsing.
export async function POST(request: Request) {
  return handleWebhook('razorpay', await request.text(), request.headers.get('x-razorpay-signature'));
}
