---
title: Competitors, feature gaps, customer asks, and monetization
date: 2026-10-15
status: research input for ce-brainstorm / ce-plan
---

# Competitors, feature gaps, customer asks, and monetization

## Method

- **Reverse engineering (REA MCP):** launched a headless Chrome scenario against the closest direct competitor (`scopedash.tarius.my.id`) and captured its network and page structure, then scraped the final landing page for copy and pricing.
- **Web research:** G2, Capterra, Plutio and Agiled comparisons (Jan–Apr 2026), Reddit threads in r/freelancing and r/freelance, and an Indie Hackers build log (Jul 2026).
- **Repo audit:** what FirmQuote already ships (README, `src/lib/store.ts`, routes).

## What REA found on the closest competitor

`scopedash.tarius.my.id` redirects through `addenly.tarius.my.id` to **wesorder.com**, so it has been rebranded twice in about three months. Stack: SvelteKit (`/_app/immutable/*`), PostHog (surveys, conversations, dead-click and exception autocapture, web vitals), Plausible, Cloudflare RUM, and a Product Hunt "featured" badge. It is a solo-founder product that has launched, and it is instrumented to learn fast.

Wesorder's product, from its live page:

- `/quick`: paste the client's chat message, set price, currency and timeline impact, and get an approval link. **No signup needed.**
- Client signs with a typed name, a checkbox, and logged IP and timestamp ("ESIGN/UETA compliant"). The client doesn't log in.
- "Master project" baseline plus a ledger of change orders, with grouped invoice PDF export and email via Resend.
- 15+ currencies.
- Pricing: Anonymous $0 (3 change orders a month, 1 a day), Free account (10 a month), Pro **$12/mo** (unlimited, custom logo, email integration).
- Launch tactic: **"Normally $12/mo, 100% free for life if claimed before 31 Oct"**, with no card required.

## Competitor landscape

| Product | Entry price | Proposal + e-sign | Change orders | Deposit before work | Client login | Notes |
|---|---|---|---|---|---|---|
| HoneyBook | $36/mo | Smart Files | No dedicated flow | Yes (payments) | No | Users say it got too expensive |
| Bonsai | $9 to $21/mo (Essentials is the real start) | Yes | No | Deposit via invoice | No | Slow support; Zoom acquisition (Dec 2025) adds uncertainty |
| Dubsado | ~$20/mo | Yes | No | Yes | Portal | Users say it's too complex to set up |
| Moxie / Plutio | ~$20/mo | Yes | No | Yes | Portal | All-in-one, heavy |
| PandaDoc / Proposify / Qwilr / Better Proposals | $19 to $35/mo | Strong, with view tracking | No | Some | No | Sales-team tools; useful features locked in upper tiers |
| Wesorder | $0 / $12 | Change orders only | **Yes** | No | No | Closest rival; USD/IDR focus |
| **FirmQuote** | Free | Quote, typed-name acceptance, optional email OTP | **Yes, with advance gate** | **Yes (UPI/link), manual mark** | No | India GST + UPI, WhatsApp share, .ics reminders |

**Where FirmQuote is already ahead:** an advance-gated change order (pay before extra work starts), UPI and GST for India, WhatsApp-ready sharing, email-OTP verified acceptance, a calendar reminder for unpaid items, and no signup for anyone.

## Feature gaps (ranked by value ÷ effort)

1. **Freelancer account and dashboard of all quotes.** Today access is a per-quote editor link or cookie, and the 2026-09-28 audit flagged "missing quote dashboard". Pricing, referrals, usage limits and notifications all need this first.
2. **Notifications.** Email the freelancer when the client views, accepts, requests changes or accepts a change order; send the client a receipt. Every competitor has this. FirmQuote only sends the OTP email.
3. **Quick change order without a full quote** (Wesorder `/quick`): paste the chat, set a price, get a link. Reddit: scope creep "is a documentation speed problem".
4. **Stronger acceptance record:** consent checkbox, IP and user-agent captured, and an acceptance certificate block on the printable PDF.
5. **Timeline impact on change orders** (+N days). Cheap to add, and both Wesorder and buyers expect it.
6. **Combined statement PDF** showing the baseline plus accepted change orders, advances and balances (the ledger exists; the printable view is quote-only).
7. **Branding:** freelancer logo and accent colour on client pages. This is the classic paid-tier lever.
8. **Saved scopes / templates** to reuse deliverables and exclusions.
9. **More currencies** (4 today vs Wesorder's 15+): add AUD, CAD, SGD, AED, JPY, IDR.
10. **Optional add-ons in the quote** that the client ticks (Quotient and Proposify praise this).

## What customers ask for (recurring themes)

- Cheaper and simpler than HoneyBook or Dubsado, roughly $15/mo or less, with "the 20% of features 80% use".
- No login or app for clients; mobile-friendly approval.
- Get paid for scope changes, and get money upfront before extra work.
- Fast written confirmation of a change ("screenshot that exchange — that IS your change order").
- Clear "not included" sections and revision limits (FirmQuote already does this).
- Weekly visibility of extra charges so clients self-regulate.
- Distrust of subscriptions; interest in pay-per-use.

## Monetization brainstorm

FirmQuote has no freelancer accounts today, so every option below except "badge" needs gap #1 first.

| Idea | How it works | Pros | Risks / notes |
|---|---|---|---|
| **Founding 50 or 100, free for life** | First N verified freelancers get Pro free forever; a public counter shows "37 of 100 left" | Real scarcity beats Wesorder's date deadline; early users become evangelists | Cap it, and require one real quote sent so bots don't grab spots |
| **Freemium with limits** | Free: 3 active quotes and unlimited change orders on them, with the "Created with FirmQuote" badge. Pro: unlimited, branding, notifications, statement PDF | Matches the market; the badge is a built-in viral loop (every client sees it) | Limits must not break a quote mid-project |
| **Pro price** | **₹299/mo or ₹2,499/yr in India; $9/mo or $79/yr elsewhere** | Undercuts Wesorder ($12), Bonsai and HoneyBook | Needs a payment provider (Razorpay subscriptions / Stripe Billing) |
| **Referral, two-sided** | You and the freelancer you invite each get 1 month of Pro when they **send their first quote** | Rewards activation, not fake signups; cheap CAC | Cap it, e.g. 12 months; dedupe by email and device |
| **Client-to-freelancer loop** | Badge on client pages links to `/?ref=quote_xxx`; the freelancer earns credit if a client signs up | Already partly built (UTM attribution exists) | Keep it subtle on client pages |
| **Share-to-unlock** | Post about FirmQuote (LinkedIn, X, a blog) and get 1 month of Pro after manual check | Content plus backlinks | **Must require an "#ad / I got a free month" disclosure** (FTC and ASCI rules). **Never reward reviews** on G2, Capterra, Product Hunt or Google, which ban incentivized reviews and can delist you |
| **Pay-per-use packs** | ₹99 for 5 extra change orders, no subscription | Fits subscription-averse Indian freelancers | Small tickets; payment fees |
| **Lifetime deal** | ₹4,999 / $99 one-time for the first 200 buyers | Early cash and validation | Caps future revenue from your best users |
| **Agency/team plan** | Multiple seats and shared templates, ₹999/mo or $29/mo | Higher ARPU | Later, once demand shows |
| **Payment take-rate** | Collect payments in-app and take 0.5–1% | Scales with usage | FirmQuote deliberately never handles money; needs a payment aggregator, KYC and compliance. Defer |

**Recommended sequence:** (1) accounts and dashboard; (2) Founding 100 free for life, plus the badge-on-free loop; (3) activation-based two-sided referral; (4) Pro at ₹299/$9 once about 100 freelancers are active, with a disclosed share-to-unlock as a side channel.
