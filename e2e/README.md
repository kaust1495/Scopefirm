# End-to-end and stress tests

These drive a **running production build** over HTTP, the way a browser with JavaScript off does. They read each page's server-action forms, submit them with a per-visitor cookie jar and IP, and check both the response and the database. They never touch the live site: use a throwaway local database.

## Run

1. Start a mock email endpoint that records messages (any server that accepts `POST` and appends `{to, subject, text}` as JSON lines to a file works; Resend's request shape is used).
2. Build and start the app against a fresh database, with email pointed at the mock:

   ```bash
   npm run build
   ```

   ```bash
   TURSO_DATABASE_URL=file:./e2e-prod.db RESEND_API_KEY=re_test EMAIL_FROM="FirmQuote <quotes@example.com>" EMAIL_API_URL=http://127.0.0.1:4010/emails npm run start -- -p 3200
   ```

3. Run the suites (they read sign-in and approval codes from the mock's file):

   ```bash
   E2E_EMAILS=/path/to/emails.jsonl node e2e/functional.mjs
   ```

   ```bash
   E2E_EMAILS=/path/to/emails.jsonl node e2e/stress.mjs
   ```

`E2E_BASE` (default `http://localhost:3200`) and `E2E_DB` (default `file:./e2e-prod.db`) point the harness at another server or database. Results are written to `e2e/*-results.json` (ignored by git).

## What they cover

- `functional.mjs`: public pages and headers; the full quote lifecycle (create, validate, edit, change request, stale-version refusal, emailed approval code, lock, advance, change orders with and without an advance, decline, payments, history, PDF, export, reminder, duplicate, delete); accounts (free quote then sign-in, code lockout, dashboard, owner-only open, founder activation and self-activation guard, sign-out, invite and referral credit, free limit, archive and unarchive, forged-cookie claim, Pro waitlist, webhook refusal); and Pro features (unlimited quotes, branding upload and serving, SVG refusal, lapse).
- `stress.mjs`: 2,000 mixed page loads at 50 concurrent; 300 concurrent quote creations; races that must happen exactly once (acceptance, change-order decision, payment and advance marks); parallel code guessing; the free limit under parallel creates; a 70-account Founding 50 stampede; the per-IP create rate limit.

Pro checkout itself is covered by the unit tests in `src/lib/billing-flow.test.ts`, which simulate the providers; a real checkout needs provider test keys.
