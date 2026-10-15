# FirmQuote

A small Next.js v1 for fixed-price freelance web quotes. Three screens: quote builder (`/`), client approval (`/q/[id]`), and private revision tracker (`/quotes/[id]`). Creating a quote signs that browser in to its tracker with a 30-day HttpOnly cookie; the tracker shows the private editor link (`/quotes/[id]/access?key=...`) to reopen it elsewhere.

Live app: https://www.firmquote.tech/

## Run locally

Requires Node.js 20.9+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Local data goes into `scopefirm.db` and is ignored by Git. Make a quote, save the private editor URL, open the client view, then accept or request a change. Editing increments the revision. An accepted quote is locked and its accepted revision and time are saved with a snapshot in the event history.

## Deploy

Connect this repo to Vercel. **Do not deploy without durable storage.** Vercel's local SQLite filesystem is ephemeral. Create a libSQL/Turso database and configure `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as Vercel environment variables, then deploy. The app refuses to access the database on Vercel without `TURSO_DATABASE_URL`.

## Boundaries

- This is a prototype, not a legal signature or a payment flow.
- The private editor link is a capability secret; anyone with it can edit. Do not send it to clients. The public link is intentionally readable by anyone who has it.
- The client link does **not** verify identity: anyone with it can accept (by typing a name) or request changes. Add authenticated client identity or email verification before treating records as strong proof.
- Quote creation is limited to 20 per hour per IP and client responses to 20 per hour per quote, stored in the same database.
- Error messages in URLs are fixed codes; arbitrary `?error=` text is never shown.
- `src/proxy.ts` sets a per-request nonce Content-Security-Policy (no inline scripts without the nonce); every page renders dynamically for this.
- The tracker offers a JSON download of the quote, history and change orders (editor cookie required; the editor key is never included).
- The home page lists recent quotes opened on this device (browser storage holds only ids and names, never editor keys).
- CI (`.github/workflows/ci.yml`) runs lint, the vitest suite (`npm test`), build and a production dependency audit on each PR; Dependabot proposes updates weekly.
- **Verified client approval (optional):** set `RESEND_API_KEY` and `EMAIL_FROM` (for example `FirmQuote <quotes@yourdomain.com>`, on a domain verified in Resend) in Vercel. The freelancer can then add a client email to a quote, and accepting it needs a 6-digit code sent to that address (10-minute expiry, 5 attempts, 3 sends per 15 minutes per quote; only a hash of the code is stored). Without these variables the field is hidden and approval stays typed-name only.
- **India or elsewhere:** each quote records where the freelancer is based (defaulted from Vercel's `x-vercel-ip-country`). India adds the GST section and UPI; elsewhere those fields are hidden and ignored by the server. Scope, approval and change orders work the same everywhere.
- **Payments:** an advance and each accepted change order show the freelancer's payment link (PayPal.me, Stripe, Razorpay, Wise… any `https://` URL) and, for India-based rupee quotes only, a UPI button. FirmQuote never handles money; the freelancer marks payments received.
- **Times** are shown in each viewer's own timezone. **Versions:** each saved edit of a quote is a version; "revision rounds" are the client-feedback rounds included in the price. The printable document is always a quotation, not a tax invoice.
- Set `NEXT_PUBLIC_SITE_URL` if the public domain changes; it drives canonical URLs, the sitemap and social previews.
- No AI quote-generation is included. The client ask is pasted and the scope is editable by the freelancer.
- The timestamp and revision snapshot are stored in SQLite. Each quote change and its history row are written in one transaction. For production audit-grade records, add authentication, tamper evidence and backups.

## Freelancer accounts, Founding 50 and referrals

- **Sign-in** is a 6-digit code emailed to the freelancer (10-minute expiry, 5 attempts, 3 sends per 15 minutes per address). Sessions last 180 days; only hashes of codes and session tokens are stored. Sign-in uses the same `RESEND_API_KEY` / `EMAIL_FROM` as client approval codes. **Without those variables in production, accounts stay off** and quote creation works anonymously, exactly as before. In development (`npm run dev`) the code is printed to the server log instead.
- **First quote free, then sign in.** A browser's first quote needs no account. The next one asks the visitor to sign in, and the first quote moves into their account. Existing editor links keep working; a signed-in freelancer can add any quote they hold the editor link for to their account.
- **My quotes** (`/account`) lists every owned quote, with archive and unarchive.
- **Founding 50.** The first 50 accounts whose client opens one of their quotes become founders: unlimited and free for life. The home page shows the spots left. The freelancer's own signed-in visit and `?preview=1` never count.
- **Free plan.** Non-founders keep up to 3 active (non-archived) quotes. Hitting the limit blocks only new quotes; existing quotes, approvals and change orders keep working. The limit page offers archiving, the invite link and Pro (or, while no payment provider is configured, a Pro waitlist stored as a timestamp on the account).
- **Referrals.** Each account has an invite link (`/invite/<code>`). When an invitee's client opens their quote, both sides get +2 active quotes permanently; an inviter is credited for at most 10 invitees.

## Pro plan (paid)

Pro is unlimited active quotes, plus the freelancer's logo and accent colour on client pages with no "Created with FirmQuote" line. Founders get every Pro feature for free. Prices: **₹299/month or ₹2,499/year** through Razorpay Subscriptions (India: UPI AutoPay, cards, netbanking), and **$9/month or $79/year** through Stripe Billing (cards, everywhere else). Both are offered on `/limit` and `/account`; the visitor's country only decides which is listed first.

- **Turning it on.** Each provider appears only when all of its variables are set; with neither, the Pro waitlist button stays.
  - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` (recurring Price ids for $9/month and $79/year).
  - Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_MONTHLY`, `RAZORPAY_PLAN_YEARLY` (Plan ids for ₹299/month and ₹2,499/year).
  - The prices shown in the app live in `src/lib/billing.ts` (`PRO_PRICES`); keep them equal to the dashboard prices.
- **Webhooks.** Stripe: `https://www.firmquote.tech/api/billing/stripe` with the events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` and `invoice.payment_failed`. Razorpay: `https://www.firmquote.tech/api/billing/razorpay` with the `subscription.*` events (activated, charged, pending, halted, cancelled, completed). A request whose signature does not verify gets HTTP 400. A valid event makes the app re-read the subscription from the provider, so duplicate or out-of-order events are harmless.
- **Checkout** uses the providers' hosted pages (Stripe Checkout and the Razorpay subscription link); card and UPI details never reach FirmQuote. Stripe sends the buyer back to `/account`, which confirms the session with Stripe at once. Razorpay's page has no return link, so `/account` re-checks a pending Razorpay subscription each time it loads.
- **Entitlement.** Pro lasts until the paid period ends plus 3 days of grace while a failed renewal is retried. If it lapses, existing quotes keep working; only new quotes need a free slot again.
- **Cancel** is on `/account`: renewal stops and Pro continues to the end of the paid period. Refunds are handled in the provider dashboards.
- **Branding.** The logo is a PNG, JPEG or WebP of up to 200 KB. Its type is checked from the file's bytes and SVG is refused. It is stored in the database and served from `/brand/<account>`.
- **Emailing the waitlist** when Pro opens: `node --env-file=.env.production.local scripts/email-waitlist.mjs` lists who would get it; add `--send` to send. It skips founders and current Pro users, never emails anyone twice, and retries failed sends on the next run.

## FirmQuote domain and rename compatibility

The public origin is https://www.firmquote.tech. The apex and legacy scopefirm.vercel.app preserve paths and queries with permanent308redirects. The GitHub repository and Vercel project retain their original names. Set NEXT_PUBLIC_SITE_URL to the canonical public origin if overriding it.

Legacy local database filename, editor cookie prefix, recent-quote localStorage key and attribution sessionStorage key intentionally remain compatible. They are not public brand copy; changing them without migration would lose local data/access. Browser storage and cookies do not transfer between domains: existing users should reopen their saved private editor links on the new domain. The redirects preserve the editor key in the query string.
