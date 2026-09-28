# ScopeFirm

A small Next.js v1 for fixed-price freelance web quotes. Three screens: quote builder (`/`), client approval (`/q/[id]`), and private revision tracker (`/quotes/[id]`). Creating a quote signs that browser in to its tracker with a 30-day HttpOnly cookie; the tracker shows the private editor link (`/quotes/[id]/access?key=...`) to reopen it elsewhere.

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
- No AI quote-generation is included. The client ask is pasted and the scope is editable by the freelancer.
- The timestamp and revision snapshot are stored in SQLite. Each quote change and its history row are written in one transaction. For production audit-grade records, add authentication, tamper evidence and backups.
