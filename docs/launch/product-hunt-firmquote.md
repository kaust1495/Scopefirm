# FirmQuote: Product Hunt listing

Every claim below is checked against the live site (2026-10-21) and `src/content/faq.ts`. **Accounts, the Founding 50 offer and Pro are not live yet** (sign-in shows "not switched on yet" until `RESEND_API_KEY` and `EMAIL_FROM` are set on Vercel), so the main copy does not mention them. If you switch accounts on before launch, use the "Founding 50" variants at the end.

**Tracking:** Product Hunt adds `?ref=producthunt` to the website link, which FirmQuote records as source `producthunt`, medium `directory`, campaign `launch` on quotes created from that visit. Keep the listing link plain (`https://www.firmquote.tech`). To tag your own launch-day posts, use `?utm_source=producthunt&utm_medium=directory&utm_campaign=launch`.

## Basics

| Field | Value | Limit |
|---|---|---|
| Name | FirmQuote | |
| Website | https://www.firmquote.tech | |
| Tagline | Fixed-price quotes clients approve. Extras get priced. | 53 / 60 |
| Pricing | Free | |
| Topics | Freelance · Productivity · Invoicing (fallback: Sales) | up to 3 |
| Thumbnail | `docs/launch/ph-gallery/00-thumbnail-512.png` (512×512) | |
| Gallery | `docs/launch/ph-gallery/01-…` to `05-…` (2540×1520, i.e. 1270×760 at 2×) | |

### Tagline alternatives
- Stop doing free extra work: priced change orders for freelancers (60)
- One link for scope approval, change orders and getting paid (58)

## Description (under 260 characters)

Write a fixed-price quote, send one link, and your client approves that exact version. Every extra becomes a priced change order with an optional advance. Payments go straight to you via UPI or your link. No client accounts, no cut of payments.

(246 characters)

## Maker's first comment

Hi Product Hunt! 👋 I'm Kaustubh, and I built FirmQuote because I kept losing money the same way: a client agrees to "a 5-page site", then asks for "just one more page" and another round of edits. Without a written yes on the scope, the extra work ends up free.

**How FirmQuote works**
1. **Write the scope:** deliverables, what's *not* included, price, timeline and how many revision rounds are included.
2. **Send one link** (WhatsApp-ready). Your client reads it and accepts that exact version, or asks for changes. No account needed. You can optionally require a 6-digit code emailed to the client.
3. **The accepted quote locks.** When the client asks for more, you send a **priced change order** on the same link. You can ask for an advance before the extra work starts.
4. **Track the money:** the client pays you directly (payment link, or UPI in India); you mark it received. Download an Excel payments sheet, set calendar reminders for unpaid items, and print a PDF quotation.

**Made for India and everywhere else.** GST fields and UPI for Indian freelancers; INR, USD, EUR and GBP for everyone.

**What it's not:** it doesn't process payments or take a cut, and an approval is a dated record of agreement, not a legal e-signature.

It's free. I'd love your feedback, especially from freelancers who've been burned by scope creep. What would make you send your next quote with it?

## Gallery captions (if the form asks)
1. `01-hero.png`: Your client approves the exact scope. Extras get priced.
2. `02-write-the-scope.png`: Write deliverables, exclusions, price and revision rounds
3. `03-client-approves.png`: Your client reviews and accepts the exact version on one link, with no account
4. `04-change-orders.png`: Extra requests become priced change orders, with an advance before work starts
5. `05-private-tracker.png`: Your private tracker: share by WhatsApp, see when the link was opened

Screenshots come from a local production build with a sample project (Asha Iyer Design → Riya Mehta, Studio North). No data was added to the live site.

## Founding 50 variants (only if accounts are live on launch day)
- **Tagline:** Fixed-price quotes clients approve. First 50 free for life. (58)
- **Add to the first comment, before the last paragraph:** "Launch offer: the first 50 freelancers whose client opens their quote get FirmQuote free for life. After that the free plan keeps 3 active quotes, and you earn 2 more for every freelancer you invite."
- **Pricing:** Free options (freemium)
