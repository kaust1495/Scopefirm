# FirmQuote: Product Hunt listing

Every claim below is checked against the live site (2026-10-22) and `src/content/faq.ts`. **Accounts are live** (email sign-in works on www.firmquote.tech). The public offer wording matches the site: "Free for initial users", with no spot count and no for-life promise (founder spots stay internal). Pro checkout through Dodo is configured on Vercel; the copy does not promise a paid plan. The original free-only copy is kept at the end as a fallback.

**Tracking:** Product Hunt adds `?ref=producthunt` to the website link, which FirmQuote records as source `producthunt`, medium `directory`, campaign `launch` on quotes created from that visit. Keep the listing link plain (`https://www.firmquote.tech`). To tag your own launch-day posts, use `?utm_source=producthunt&utm_medium=directory&utm_campaign=launch`.

## Basics

| Field | Value | Limit |
|---|---|---|
| Name | FirmQuote | |
| Website | https://www.firmquote.tech | |
| Tagline | Fixed-price quotes clients approve. Free for initial users. | 59 / 60 |
| Pricing | Paid (with a free trial or plan) | |
| Topics | Productivity · Freelance · Sales (Product Hunt has no Invoicing tag) | up to 3 |
| Thumbnail | `docs/launch/ph-gallery/00-thumbnail-512.png` (512×512) | |
| Gallery | `docs/launch/ph-gallery/01-…` to `05-…` (2540×1520, i.e. 1270×760 at 2×) | |

### Tagline alternatives
- Stop doing free extra work: priced change orders for freelancers (60)
- One link for scope approval, change orders and getting paid (58)

## Description (under 500 characters)

Write a fixed-price quote, send one link, and your client approves that exact version, with no account needed. When they ask for more, send a priced change order on the same link, with an optional advance before the extra work starts. Payments go straight to you by UPI or your own payment link; FirmQuote never takes a cut. Built for freelancers in India and everywhere: GST fields, UPI, INR/USD/EUR/GBP, Excel payments sheet, PDF quotes. Free for initial users.

(463 characters)

## Maker's first comment

Posted and pinned on the launch page (edited 2026-10-22 to add the launch offer); it goes live with the launch.

Hi Product Hunt! 👋 I'm Kaustubh, and I built FirmQuote because I kept losing money the same way: a client agrees to "a 5-page site", then asks for "just one more page" and another round of edits. Without a written yes on the scope, the extra work ends up free.

**How FirmQuote works**
1. **Write the scope:** deliverables, what's *not* included, price, timeline and how many revision rounds are included.
2. **Send one link** (WhatsApp-ready). Your client reads it and accepts that exact version, or asks for changes. No account needed. You can optionally require a 6-digit code emailed to the client.
3. **The accepted quote locks.** When the client asks for more, you send a **priced change order** on the same link. You can ask for an advance before the extra work starts.
4. **Track the money:** the client pays you directly (payment link, or UPI in India); you mark it received. Download an Excel payments sheet, set calendar reminders for unpaid items, and print a PDF quotation.

**Made for India and everywhere else.** GST fields and UPI for Indian freelancers; INR, USD, EUR and GBP for everyone.

**What it's not:** it doesn't process payments or take a cut, and an approval is a dated record of agreement, not a legal e-signature.

**Launch offer:** FirmQuote is free for initial users: early accounts get unlimited quotes once a client opens their first one. After that the free plan keeps 3 active quotes, and you earn 2 more for every freelancer you invite.

Your first quote needs no account. I'd love your feedback, especially from freelancers who've been burned by scope creep. What would make you send your next quote with it?

## Shoutouts (saved on the draft)
- **Vercel:** FirmQuote deploys from every push to main, and preview builds, environment variables and the custom domain with its www redirect all live in one place. For a solo maker, that meant zero time spent on servers.
- **Claude Code:** I built FirmQuote solo with Claude Code. It planned features, wrote the code and the tests, ran end-to-end and stress tests against a production build, and kept a log of every product decision. It made shipping a full SaaS as one person realistic.
- **Resend:** FirmQuote's passwordless sign-in codes and client approval codes go out through Resend. A simple API, quick domain verification and fast delivery, so a 6-digit code reaches the inbox while the person is still on the page.

## Demo video
`docs/launch/firmquote-demo.webm` (1:27, 1280×720, captioned; not committed, kept locally). Recorded from a local production build with a sample project: write the scope, the client accepts, a change order with an advance, the tracker. Product Hunt takes a YouTube or Loom link: upload it as Unlisted and paste the link into "Video / Loom".

## Gallery captions (if the form asks)
1. `01-hero.png`: Your client approves the exact scope. Extras get priced.
2. `02-write-the-scope.png`: Write deliverables, exclusions, price and revision rounds
3. `03-client-approves.png`: Your client reviews and accepts the exact version on one link, with no account
4. `04-change-orders.png`: Extra requests become priced change orders, with an advance before work starts
5. `05-private-tracker.png`: Your private tracker: share by WhatsApp, see when the link was opened

Screenshots come from a local production build with a sample project (Asha Iyer Design → Riya Mehta, Studio North). No data was added to the live site.

## Fallback: free-only copy (if accounts are switched off)
- **Tagline:** Fixed-price quotes clients approve. Extras get priced. (53)
- **First comment:** drop the "Launch offer" paragraph and end with "It's free. I'd love your feedback…"
- **Pricing:** Free
