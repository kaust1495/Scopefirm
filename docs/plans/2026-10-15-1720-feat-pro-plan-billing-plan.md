---
title: Paid Pro plan (Razorpay + Stripe subscriptions)
type: feat
date: 2026-10-15
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
status: active
---

# Paid Pro plan

## Goal Capsule

**Objective:** a signed-in, non-founder freelancer can subscribe to FirmQuote Pro (₹299/mo or ₹2,499/yr through Razorpay; $9/mo or $79/yr through Stripe), immediately gets unlimited active quotes and branding on client pages, can cancel, and the owner can email everyone on the Pro waitlist that Pro is open.

**Builds on:** `feat/accounts-monetization` (accounts, Founding 50, 3-active-quote free plan, referrals, `pro_waitlist_at`). Pricing comes from `docs/research/2026-10-15-competitors-gaps-monetization.md`.

**Not in scope:** taxes/GST invoices (handled in the provider dashboards), coupons, team plans, lifetime deals, pay-per-use packs, resuming a cancelled subscription, plan switching (monthly to yearly) inside the app.

## Product Contract

### Actors
- **Free freelancer**: signed in, not a founder, 3 + referral bonus active quotes.
- **Pro freelancer**: has a paid, current subscription.
- **Founder**: one of the first 50 activated accounts. Already free for life; gets every Pro feature and never sees checkout.
- **Client**: opens `/q/<id>`; sees the freelancer's branding when the freelancer is Pro or a founder.
- **Owner**: runs FirmQuote; configures provider keys; emails the waitlist.

### Requirements
- **R1 Checkout.** On `/limit` and `/account`, a free freelancer sees Pro with both prices: India (₹, Razorpay: UPI, cards, netbanking) and international ($, Stripe: cards). The visitor's country (Vercel `x-vercel-ip-country`) decides which is listed first; both are always offered so nobody is stuck with the wrong currency. Monthly and yearly for each.
- **R2 Only configured providers show.** A provider appears only when its keys and plan IDs are set. With neither configured, the existing "Join the Pro waitlist" button stays, so production keeps working before the owner sets keys.
- **R3 Becoming Pro.** Pro turns on when the provider confirms a successful payment: by a signed webhook, or when the freelancer returns and the app re-reads the subscription from the provider. Never from the browser's word alone.
- **R4 Unlimited.** A Pro account has no active-quote limit. If Pro lapses, nothing breaks: existing quotes, approvals and change orders keep working, and only new quotes need a free slot again (same rule as today).
- **R5 Branding.** Pro (and founder) accounts can set an accent colour and upload a logo (PNG, JPEG or WebP, up to 200 KB). Their client pages show the logo and accent and drop the "Created with FirmQuote" badge. Free accounts see a locked branding panel that points to Pro.
- **R6 Cancel.** A Pro freelancer can cancel from `/account` (with a confirm step). Pro stays on until the end of the paid period; the page shows that date and that it will not renew. No refunds in-app.
- **R7 Founders.** Founders never see checkout, keep unlimited quotes and get branding. If a founder somehow has a subscription, the account page still shows "Free for life" and the cancel control.
- **R8 Webhook safety.** Webhooks are rejected (HTTP 400) unless the signature verifies with the provider's webhook secret (Stripe: HMAC-SHA256 over `t.payload`, 5-minute tolerance; Razorpay: HMAC-SHA256 of the raw body). Duplicate and out-of-order events are harmless.
- **R9 Waitlist email.** The owner can send a one-time "Pro is open" email to every waitlisted account that is not a founder and not already Pro, with a dry run first, and nobody is emailed twice.
- **R10 Privacy page and README** describe what billing data is stored (provider, subscription id, status, paid-until date, branding) and that card/UPI details never touch FirmQuote.

### Acceptance examples
- **AE1** Free user at 3/3 opens `/limit`, picks "₹299/month", pays on Razorpay's page, comes back to `/account`: the plan panel shows "Pro · renews <date>", and the home page lets them create a 4th quote.
- **AE2** Same with Stripe: after paying they land on `/account?checkout=done…` and are Pro without waiting for the webhook.
- **AE3** A forged webhook (wrong secret or a Stripe timestamp older than 5 minutes) returns 400 and changes nothing.
- **AE4** Pro user cancels: still Pro until the period end, then the provider's final event (or the next sync) turns Pro off; quote 4 and 5 still work for clients, but quote 6 hits `/limit`.
- **AE5** Founder visits `/limit?waitlist=1` or `/account`: no checkout; branding panel unlocked.
- **AE6** A Pro user's client opens `/q/<id>`: the freelancer's logo and accent show; no "Created with FirmQuote".

### Key decisions (autopilot; also in `docs/decision-log.md`)
- **Both providers, chosen by the buyer, defaulted by country.** Weighed: pick provider strictly by IP country (VPN and travel misroutes people; wrong currency is a hard blocker), or Stripe only (Stripe India subscriptions need extra RBI e-mandate setup and no UPI Autopay).
- **Hosted payment pages, no client SDKs.** Stripe Checkout and the Razorpay subscription `short_url`. Weighed: Razorpay Checkout.js modal (smoother, but loads a third-party script that our nonce CSP blocks, and needs a client component). Cost: Razorpay's hosted page has no return redirect, so the account page re-syncs the subscription on load.
- **No provider SDK dependencies.** Both APIs are called with `fetch`, and signatures are checked with `node:crypto`, matching how `email.ts` calls Resend. Weighed: `stripe` and `razorpay` npm packages (bigger surface, the Razorpay one is loosely maintained).
- **Webhooks re-fetch the subscription** from the provider instead of trusting the event body. Out-of-order or duplicate events then cannot leave a stale state, and no event log table is needed.
- **Entitlement is a "Pro until" date** (paid period end + 3 days grace for renewal retries), not a status flag. Pro is simply `pro_until > now`.
- **Founders get Pro features too** (research doc: "first N get Pro free forever").
- **Logo stored in the database** (≤ 200 KB, magic-byte checked, no SVG), served from our own origin. Weighed: logo URL (hotlinked third-party image on every client page, tracking risk) or blob storage (new service).
- **Waitlist email is a script the owner runs** (`npm run waitlist:email`, dry run by default). Weighed: an admin HTTP endpoint (new attack surface for a one-off send).

## Implementation Units

### U1. Billing data and entitlement (`src/lib/store.ts`)
- New `accounts` columns: `billing_provider`, `subscription_id`, `subscription_status`, `pro_until`, `cancel_at_period_end`, `brand_color`, `brand_logo` (base64), `brand_logo_type`, `pro_launch_emailed_at`.
- `isPro(account, now)`, `hasProFeatures(account)` (Pro or founder). `quoteAllowance` returns `limit: null` for these.
- `applySubscription(accountId, state)`: writes provider state; ignores a non-entitled state for a different subscription than the stored one, so a stale old subscription cannot cancel a newer one.
- `setBranding(accountId, …)`, `accountBranding(accountId)`.
- Tests: entitlement edge cases, apply ordering, allowance for Pro.

### U2. Provider clients and signature checks (`src/lib/billing.ts`)
- Config readers: `stripeEnabled()`, `razorpayEnabled()` (keys + both plan/price IDs + webhook secret).
- `verifyStripeSignature(raw, header, secret, now)`, `verifyRazorpaySignature(raw, header, secret)`: constant-time compare.
- Stripe: `createStripeCheckout`, `getStripeSubscription`, `getStripeCheckoutSession`, `cancelStripe` (cancel at period end). Razorpay: `createRazorpaySubscription`, `getRazorpaySubscription`, `cancelRazorpay` (cancel at cycle end).
- Pure mappers `stripeState(sub)` / `razorpayState(sub)` to `{provider, subscriptionId, accountId, status, entitled, periodEnd, cancelAtPeriodEnd}`.
- Tests: signatures (valid, tampered body, wrong secret, stale timestamp, malformed header, multiple v1), mappers (both Stripe period-end shapes), HTTP calls with mocked `fetch`.

### U3. Checkout, return, sync and cancel (`src/app/actions/billing.ts`, `src/lib/billing-sync.ts`)
- `startCheckout(form)`: requires sign-in; refuses founders and current Pro; creates the Stripe session or Razorpay subscription with the account id in metadata/notes; stores the pending Razorpay subscription id; redirects to the hosted page.
- `/account?checkout=stripe&session_id=…` re-reads the session (must match the account) and applies it.
- Account page syncs a pending or active subscription from the provider on load (throttled to once a minute).
- `cancelSubscription(form)`: confirm checkbox; cancels at period end; re-syncs.

### U4. Webhooks (`src/app/api/billing/stripe/route.ts`, `…/razorpay/route.ts`)
- Read the raw body, verify the signature, extract the subscription id, re-fetch and apply. 400 on bad signature, 200 on ignored event types, 500 on provider fetch failure (so the provider retries).

### U5. UI
- `ProOffer` server component used on `/limit` and `/account` (replaces the waitlist button when any provider is enabled).
- `/account` plan panel: Free / Pro (renews or ends on date, cancel) / Founder.
- Branding panel on `/account`; logo served by `/brand/[accountId]` with `nosniff` and a strict content type.
- `/q/[id]`: owner's branding applied; badge hidden for Pro/founder.

### U6. Waitlist email (`scripts/email-waitlist.mjs`)
- Reads the database and Resend config from env; lists eligible accounts; `--send` sends and stamps `pro_launch_emailed_at`.

### U7. Docs
- README billing section with env vars and webhook URLs/events; privacy page; decision log; `.env` example in README.

## Verification
- `npm test`, `npm run lint`, `npm run build`.
- Browser check on a local build with a throwaway DB: offer renders on `/limit` and `/account` with fake provider config; branding panel; client page branding and badge removal; cancel flow with a simulated Pro account. Real payments are not made from this session; the owner tests with provider test keys (steps in the PR).
