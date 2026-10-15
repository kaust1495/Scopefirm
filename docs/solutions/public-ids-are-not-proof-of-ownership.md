---
title: Public ids are not proof of ownership
date: 2026-10-15
tags: [security, auth, cookies, accounts]
applies_when: Any cookie, form field or link that lets a browser claim, attach or open a quote or change order
---

# Public ids are not proof of ownership

**Rule:** Never grant editor access, ownership or account attachment on the strength of a quote id alone. Require the editor key (`keyMatches`) or a signed-in session that already owns the quote (`ownedQuote`).

**Why:** Quote ids appear in every client link (`/q/<id>`), so anyone the client forwards the link to knows them. While building accounts, the "one free quote" cookie first stored only the quote id. Because a visitor controls their own cookies, a forged cookie naming someone else's quote let any signed-in visitor claim that unowned quote, then open its editor through `/quotes/<id>/open`.

**How it is enforced now:**

- The free-quote cookie holds `<id>.<editor key>` (`anonQuoteValue` in `src/lib/session.ts`), and sign-in claims the quote only when `keyMatches` passes (`verifyLoginCode` in `src/app/actions/account.ts`).
- `claimQuoteAction` requires the per-quote editor cookie.
- `/quotes/[id]/open` requires the session to own the quote already.
- Regression test: "does not claim a quote named only by its public id in a forged free-quote cookie" in `src/app/actions/account.test.ts`.

**Also:** a helper that returns a quote with its `edit_key` must not live in a `'use server'` file. Every export there is callable from the browser. Keep it in `src/lib/` (see `ownedQuote`).
