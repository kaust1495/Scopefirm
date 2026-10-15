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
- **Free plan.** Non-founders keep up to 3 active (non-archived) quotes. Hitting the limit blocks only new quotes; existing quotes, approvals and change orders keep working. The limit page offers archiving, the invite link and a Pro waitlist (stored as a timestamp on the account).
- **Referrals.** Each account has an invite link (`/invite/<code>`). When an invitee's client opens their quote, both sides get +2 active quotes permanently; an inviter is credited for at most 10 invitees.

## FirmQuote domain and rename compatibility

The public origin is https://www.firmquote.tech. The apex and legacy scopefirm.vercel.app preserve paths and queries with permanent308redirects. The GitHub repository and Vercel project retain their original names. Set NEXT_PUBLIC_SITE_URL to the canonical public origin if overriding it.

Legacy local database filename, editor cookie prefix, recent-quote localStorage key and attribution sessionStorage key intentionally remain compatible. They are not public brand copy; changing them without migration would lose local data/access. Browser storage and cookies do not transfer between domains: existing users should reopen their saved private editor links on the new domain. The redirects preserve the editor key in the query string.
