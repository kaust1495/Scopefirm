# FirmQuote autopilot decision log

The owner asked (2026-10-15) for the build to run on autopilot: decide, debate briefly, record here. Correct anything below and the next run will follow your correction.

Format: **Decision** · options weighed · why · how to reverse.

## 2026-10-15

### Decided with you (before autopilot)
- **Build focus: accounts + monetization base.** Weighed against notifications, quick change order, paid Pro. Accounts unlock every monetization path. See `docs/plans/2026-10-15-1535-feat-freelancer-accounts-monetization-base-plan.md`.
- **First quote with no signup, then sign-in.** Weighed against always-sign-in and unlimited anonymous use.
- **First 50 activated freelancers free for life; others get 3 active quotes.** Weighed against 100 spots and 12-month founders.
- **Referral: +2 active slots each, max 10 per inviter.** Weighed against a month of unlimited use, or no referrals.

### Decided on autopilot
1. **Skipped the separate `ce-doc-review` pass on the plan.** Option: run the multi-agent document review. Why skipped: the plan was checked against the Ready-for-Planning and final-review checklists inline, and code review plus browser tests later will catch real defects more cheaply. Reverse: run `ce-doc-review docs/plans/2026-10-15-1535-feat-freelancer-accounts-monetization-base-plan.md`.
2. **Sign-in by emailed 6-digit code, not Google or passwords.** Debate: Google sign-in converts better but needs OAuth app setup and verification; passwords need reset flows and storage risk. The code reuses the existing Resend setup. Reverse: add Google as a follow-up; accounts are keyed by email, so they would merge cleanly.
3. **If Resend isn't configured in production, the sign-in gate turns off** (anonymous unlimited, as today) instead of blocking quote creation. Debate: blocking would make limits real but would break the product for everyone if the keys are missing. **Action for you:** set `RESEND_API_KEY` and `EMAIL_FROM` on Vercel to turn accounts on.
4. **"One free quote" is tracked by a cookie,** not device fingerprinting. Debate: fingerprinting is harder to bypass but invasive and unreliable. The IP create limit (20/hour) stays as the backstop.
5. **Activation = a real client opening the link,** never the owner's own visit, even without `?preview`. Prevents self-activation to grab founder spots.
6. **Add `npm test` to CI.** CI ran only lint and build, so the new auth code would be unguarded.
7. **Advance-gated change orders (already in the working tree) ship in the same PR** as accounts. Debate: a separate PR is cleaner to review, but the work was already done, tested, and touches the same files (store, actions); splitting would add merge risk.
8. **Share-to-unlock (free use for posting about FirmQuote) not built.** It needs a disclosure rule (#ad / ASCI and FTC) and manual verification, and must never reward reviews on G2, Capterra, Product Hunt or Google. Recorded as a follow-up in the research doc.
