// Server-only glue between provider state and accounts. Kept out of 'use server' files, whose exports are callable from the browser.
import { fetchSubscription, getStripeCheckoutSession, getStripeSubscription, providerEnabled } from './billing';
import { accountForSubscription, applySubscription, getAccount, markBillingSynced, type Account, type BillingProvider } from './store';

/**
 * Re-reads one subscription from its provider and stores it on the owning account. The account comes from the
 * id FirmQuote put in the subscription's metadata/notes, else from the subscription id already on file.
 */
export async function syncSubscription(provider: BillingProvider, subscriptionId: string) {
  const state = await fetchSubscription(provider, subscriptionId);
  if (!state) return false;
  const accountId = state.accountId ?? (await accountForSubscription(subscriptionId))?.id;
  return accountId ? applySubscription(accountId, state) : false;
}

/** Statuses of a checkout that was started but not yet confirmed by a webhook. */
const awaiting = new Set(['created', 'authenticated', 'incomplete']);
const SYNC_EVERY_MS = 30 * 1000;

/**
 * Razorpay's hosted page has no return redirect, so the account page asks the provider directly while a
 * checkout is still waiting for its webhook. Throttled, and never fatal: the webhook remains the main path.
 */
export async function refreshPendingBilling(account: Account): Promise<Account> {
  const { billing_provider: provider, subscription_id: subscriptionId } = account;
  if (!provider || !subscriptionId || !providerEnabled(provider) || !awaiting.has(account.subscription_status ?? '')) return account;
  if (account.billing_synced_at && Date.now() - Date.parse(account.billing_synced_at) < SYNC_EVERY_MS) return account;
  try {
    await markBillingSynced(account.id);
    await syncSubscription(provider, subscriptionId);
  } catch (error) {
    console.error('[billing] sync failed', String(error));
  }
  return (await getAccount(account.id)) ?? account;
}

/** Stripe's success page carries the Checkout Session id; it counts only if Stripe says it belongs to this account. */
export async function completeStripeReturn(account: Account, sessionId: string) {
  if (!providerEnabled('stripe')) return account;
  try {
    const session = await getStripeCheckoutSession(sessionId);
    if (!session?.complete || session.accountId !== account.id || !session.subscriptionId) return account;
    const state = await getStripeSubscription(session.subscriptionId);
    if (state) await applySubscription(account.id, state);
  } catch (error) {
    console.error('[billing] checkout return failed', String(error));
  }
  return (await getAccount(account.id)) ?? account;
}
