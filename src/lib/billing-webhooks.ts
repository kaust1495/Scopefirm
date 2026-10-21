// Webhook handling shared by the route files (and their tests): verify, find the subscription, re-read it, store it.
import { dodoEnabled, razorpayEnabled, stripeEnabled, verifyDodoSignature, verifyRazorpaySignature, verifyStripeSignature } from './billing';
import { syncSubscription } from './billing-sync';
import type { BillingProvider } from './store';

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => (value && typeof value === 'object' ? value as Json : {});
const str = (value: unknown) => (typeof value === 'string' && value ? value : null);

/** The subscription a Stripe event is about, or null for events that do not change Pro. */
export function stripeSubscriptionId(event: unknown) {
  const type = str(obj(event).type) ?? '', object = obj(obj(obj(event).data).object);
  if (type.startsWith('customer.subscription.')) return str(object.id);
  if (type === 'checkout.session.completed') return str(object.subscription);
  // Newer API versions move an invoice's subscription under parent.subscription_details.
  if (type.startsWith('invoice.')) return str(object.subscription) ?? str(obj(obj(object.parent).subscription_details).subscription);
  return null;
}

/** The subscription a Razorpay event is about; only subscription.* events change Pro. */
export function razorpaySubscriptionId(event: unknown) {
  const type = str(obj(event).event) ?? '';
  return type.startsWith('subscription.') ? str(obj(obj(obj(obj(event).payload).subscription).entity).id) : null;
}

/** The subscription a Dodo event is about; only subscription.* events change Pro. */
export function dodoSubscriptionId(event: unknown) {
  const type = str(obj(event).type) ?? '';
  return type.startsWith('subscription.') ? str(obj(obj(event).data).subscription_id) : null;
}

/** Dodo signs with three Standard Webhooks headers; Stripe and Razorpay with one. */
export type DodoSignature = { id: string | null; timestamp: string | null; signature: string | null };

/**
 * 400 for a bad signature or body (never retried usefully), 200 once stored or deliberately ignored,
 * 503 when the provider is off or could not be reached, so the provider retries later.
 */
export async function handleWebhook(provider: BillingProvider, rawBody: string, signature: string | null | DodoSignature) {
  const enabled = provider === 'dodo' ? dodoEnabled() : provider === 'stripe' ? stripeEnabled() : razorpayEnabled();
  if (!enabled) return new Response('Billing is not configured', { status: 503 });
  const single = typeof signature === 'string' ? signature : null;
  const valid = provider === 'dodo'
    ? typeof signature === 'object' && signature != null && verifyDodoSignature(rawBody, signature, process.env.DODO_WEBHOOK_SECRET!.trim())
    : provider === 'stripe'
      ? verifyStripeSignature(rawBody, single, process.env.STRIPE_WEBHOOK_SECRET!.trim())
      : verifyRazorpaySignature(rawBody, single, process.env.RAZORPAY_WEBHOOK_SECRET!.trim());
  if (!valid) return new Response('Invalid signature', { status: 400 });
  let event: unknown;
  try { event = JSON.parse(rawBody); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const subscriptionId = provider === 'dodo' ? dodoSubscriptionId(event) : provider === 'stripe' ? stripeSubscriptionId(event) : razorpaySubscriptionId(event);
  if (!subscriptionId) return new Response('Ignored', { status: 200 });
  try {
    await syncSubscription(provider, subscriptionId);
  } catch (error) {
    console.error(`[billing] ${provider} webhook sync failed`, String(error));
    return new Response('Sync failed', { status: 503 });
  }
  return new Response('OK', { status: 200 });
}
