import Link from 'next/link';

export const metadata = { title: 'Privacy', description: 'What ScopeFirm stores for a quote, who can act on a quote link, and how to delete a quote and its history.', alternates: { canonical: '/privacy' } };

export default function Privacy() {
  return <main className="shell compact">
    <div className="hero small">
      <div className="eyebrow">PROTOTYPE NOTICE</div>
      <h1>Privacy at ScopeFirm</h1>
      <p>ScopeFirm is a course prototype. Do not put sensitive client information in a quote.</p>
    </div>
    <div className="panel form">
      <h2>What is stored</h2>
      <p>Quotes store the client and project names, brief, deliverables, exclusions, price, revisions, responses (including the name a client types to accept) and dated history in a Turso database. To limit abuse, a hashed form of your IP address is kept for up to a day when you create a quote. The private editor key is stored with the quote; after opening an editor link, the browser keeps it in a 30-day HttpOnly cookie. Keep the original editor link safe for access on another device. A client link exposes the quote to anyone who has that link.</p>
      <h2>Who can act</h2>
      <p>Anyone with a client link can read and respond to that quote. The app does not verify client identity. Anyone with the private editor link can edit an unaccepted quote. Do not send that editor link to clients.</p>
      <h2>Current limits</h2>
      <p>This prototype does not offer an account. From the private tracker, an editor-link holder can download the quote, its history and change orders as JSON. An editor-link holder can permanently delete that quote and its history from the tracker. Its approval record is not a legal signature or proof of identity. Avoid real-client use until access and deletion controls are added.</p>
      <p><Link href="/">Back to quote builder</Link></p>
    </div>
  </main>;
}
