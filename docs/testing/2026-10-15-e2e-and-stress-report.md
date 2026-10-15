# End-to-end and stress test report: 2026-10-15

**Build tested:** `main` at `78b4779` plus the fix below, as a production build (`next start`) on a throwaway SQLite database, with email sent to a local mock of Resend's API. Nothing ran against www.firmquote.tech.

## Result

| Suite | Result |
|---|---|
| Unit and action tests (`npm test`) | **91/91** (90 before, plus 1 regression test for the bug below) |
| Type-check, lint, production build | Pass |
| Production dependency audit | 0 known vulnerabilities |
| Functional end-to-end (`e2e/functional.mjs`) | **41/41** |
| Stress and concurrency (`e2e/stress.mjs`) | **11/11** |
| Real-browser checks (production CSP) | No console errors; branding renders; no horizontal overflow at 375 px on home, sign-in, client pages and compare |

## Bug found and fixed

**Founder spots could still be self-claimed after signing out.** The guard against a freelancer activating their own account (by opening their own client link) compared the visitor's network with the owner's *sessions*, but signing out deletes the session, so "sign out, open my own link" still activated the account and took a founder spot. Each account's sign-in networks are now kept (as one-way hashes) in `account_networks`, which survives sign-out, and existing sessions are backfilled on start-up. A regression test covers it, and the privacy page says these hashes are kept.

## Stress numbers (local machine, single Node process)

| Test | Result |
|---|---|
| 2,000 mixed page loads, 50 concurrent | 0 errors; 162 req/s; p50 241 ms, p95 654 ms, p99 955 ms, max 1,256 ms |
| 300 quote creations, 30 concurrent | 300/300 saved; p50 479 ms, p95 630 ms |
| 30 simultaneous acceptances of one quote | Exactly 1 recorded |
| 20 simultaneous decisions on one change order | Exactly 1 recorded |
| 20 duplicate "payment received" clicks; 20 duplicate "advance received" clicks | Exactly 1 record each |
| 25 parallel wrong sign-in codes, then the right one | Locked after 5; right code refused; no session |
| 10 parallel creates with 1 free slot left | Limit held: 3 active |
| 70 accounts activated at once | Exactly 50 founders, numbers 1 to 50, no duplicates |
| 25 creates from one IP | 20 created, 5 rate-limited |

## Not covered, and why

- **Real Pro checkout.** The Stripe and Razorpay API addresses are fixed and no provider test keys exist; billing is also moving to Dodo Payments. Pro behaviour (unlimited quotes, branding, lapse) was tested end to end by marking an account Pro in the test database; the checkout and webhook path is covered by unit tests that simulate the providers.
- **Real email delivery.** Codes were captured from a mock of Resend's API. Production sending needs `firmquote.tech` verified in Resend and `RESEND_API_KEY` / `EMAIL_FROM` set on Vercel.
- **Production-scale concurrency.** Locally one process serialises database writes. On Vercel with Turso, the free-limit check and the insert are separate steps, so a burst of simultaneous creates could add an extra quote or two beyond the limit (low harm). The once-only state changes (acceptance, decisions, payments, founder numbers) are guarded inside the database statements themselves and do not depend on this.

## Re-running

See `e2e/README.md`.
