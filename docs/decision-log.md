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
9. **Your uncommitted change-order work was committed first, as its own commit** on branch `feat/accounts-monetization`, so the accounts work stays separate and reviewable. Git had no author identity on this machine, so commits use the name and email from this repo's own history (`Kaustubh Anil Jain`, GitHub noreply address), set per command; your global git config was not changed.
10. **End-to-end tests run against a local build only,** never https://www.firmquote.tech, so no test accounts or quotes land in the production database. After merge, a read-only look at the live site is safe.
11. **No email in URLs.** The address waiting for its sign-in code lives in a 10-minute HttpOnly cookie, not `?email=`, so it stays out of logs and browser history.
12. **Home page shows "Sign in to continue" (or the limit) in place of the quote builder** when the gate applies, so nobody types a whole quote only to lose it at a sign-in redirect. The server still enforces the gate.
13. **Code review ran as one thorough inline pass, not the plugin's full multi-agent + cross-model review** (that path dispatches 5+ subagents and an external model). Coverage limit: run `/code-review` on the PR for a second opinion before merging.
14. **Review found and fixed a critical bug:** the free-quote cookie held only the (public) quote id, so a forged cookie could claim someone else's unowned quote and open its editor. The cookie now carries the secret editor key, verified before claiming. A regression test covers it.
15. **Left for you to decide (in the PR body):** (a) founder spots can be self-claimed by opening your own client link while signed out; a stricter signal would be client *acceptance*. (b) Someone can delay another person's sign-in by spending their 3-per-15-minutes code requests.
16. **Learning recorded** in `docs/solutions/` instead of running the separate `ce-compound` skill (same output, written directly).

17. **Browser tests (F1–F4) passed locally** on a throwaway `e2e.db` (deleted afterwards). Two fixes came out of them: the freelancer's own signed-in visit to their client link no longer inflates "Client link opened N times"; and My quotes no longer promises founder spots once all 50 are taken.
18. **PR opened from the app,** because the GitHub CLI isn't installed on this machine; the branch was pushed with plain `git push`.

8. **Share-to-unlock (free use for posting about FirmQuote) not built.** It needs a disclosure rule (#ad / ASCI and FTC) and manual verification, and must never reward reviews on G2, Capterra, Product Hunt or Google. Recorded as a follow-up in the research doc.

## 2026-10-15 — End-to-end and stress testing
- **Tested against a local production build with a mock email API, never the live site** (load testing production would hit the real database and real users). Report: `docs/testing/2026-10-15-e2e-and-stress-report.md`; suites in `e2e/`.
- **Fixed a founder self-claim that survived sign-out:** sign-in networks are now kept in `account_networks` (hashed) instead of only on sessions.
- **Left as-is: the free-limit check-then-insert gap under bursty parallel creates on Vercel/Turso.** Worst case is an extra quote or two; a guarded insert would add complexity for little harm. Revisit if abuse shows up.

## 2026-10-15 — Paid Pro plan (branch `feat/pro-billing`, stacked on `feat/accounts-monetization`)
Full rationale: `docs/plans/2026-10-15-1720-feat-pro-plan-billing-plan.md` (Key decisions).
19. **Both providers are offered, ordered by country:** Razorpay ₹ first in India, otherwise Stripe $ first. Strict geo-routing would strand VPN users and people who travel.
20. **Hosted pages (Stripe Checkout, Razorpay subscription link) and no SDK packages.** Both are called over plain `fetch`, and signatures are checked with `node:crypto`. Razorpay's link can't send people back to FirmQuote, so `/account` re-checks a pending subscription on load.
21. **Webhooks re-fetch the subscription** from the provider; Pro means `pro_until > now` (paid period + 3 days grace). Stale or out-of-order events are harmless.
22. **Founders get every Pro feature.** The logo is stored in the database (PNG/JPEG/WebP up to 200 KB, file type checked from its bytes, no SVG).
23. **The waitlist email is a script** (`npm run waitlist:email`, dry run unless `--send`), not an admin endpoint.
24. **Deleted 5 unused remote branches (owner asked, 2026-10-15),** each checked against `main` first. Restore any with `git push origin <sha>:refs/heads/<name>`: `claude/happy-mayer-j6u1e2` @ `cbdff5c` (fully merged); `claude/practical-faraday-fck6iq` @ `39e1837` (pre-rewrite history, its only change `.claude/settings.json` already in main); `firmquote-rename-oct11` @ `2c72a24` (identical to merged #40); `firmquote-brand-assets-oct11` @ `b44acd4` (content in main via #41); `fix/firmquote-team-byline-oct13` @ `da73bab` (content in main via #42). Kept: the dependabot branch (live PR), `feat/accounts-monetization` (PR #44), `feat/pro-billing`.
25. **Payments will go through Dodo Payments once its approval arrives (owner, 2026-10-15),** not Stripe or Razorpay. No Stripe or Razorpay dashboard setup will be done. Until Dodo is wired in, no billing variables are set, so `/limit` and `/account` keep the Pro waitlist button and the waitlist email is held back. Follow-up: add Dodo as a provider (checkout, signed webhook, cancel) behind the same Pro-until entitlement, then drop or keep the Stripe and Razorpay code.
26. **Founder self-claim closed (review finding 15a):** a view only activates an account if it comes from an IP address none of the owner's sign-ins used; a no-signup quote claimed at sign-in is checked against its first view's address. Weighed: activating on client *acceptance* (also self-doable in a private window, and it would change the "client opens it" promise everywhere). Limit: someone on a different network (say, mobile data) can still do it; acceptance from a verified client email would be the next step. Only hashes of IPs are stored.
27. **Sign-in lockout eased (review finding 15b):** 3 codes per 15 minutes per address *per network*, with a ceiling of 10 per address per 15 minutes and 30 a day. A stranger now has to spend requests from four networks to block someone for 15 minutes.
28. **Resume a cancelled Pro (Stripe only).** Razorpay's API cannot undo a cancel-at-cycle-end, so the page says to subscribe again after the period. The logo `<img>` moved into one small component, which clears the lint warnings.
29. **Merging #44 and Dependabot #43 is left to you.** A local merge-and-push to `main` was blocked by this machine's safety rules (no merging without review), and there is no GitHub CLI. Merge both from the GitHub web page. #44 now also contains Pro (#45) and the fixes in 26–28.
