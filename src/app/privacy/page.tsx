import Link from 'next/link';

export const metadata = { title: 'Privacy | ScopeFirm' };

export default function Privacy() {
  return <main className="shell compact">
    <div className="hero small">
      <div className="eyebrow">PROTOTYPE NOTICE</div>
      <h1>Privacy at ScopeFirm</h1>
      <p>ScopeFirm is a course prototype. Do not put sensitive client information in a quote.</p>
    </div>
    <div className="panel form">
      <h2>What is stored</h2>
      <p>Quotes store the client and project names, brief, deliverables, exclusions, price, revisions, responses and dated history in a Turso database. The private editor key is also stored with the quote. A client link exposes the quote to anyone who has that link.</p>
      <h2>Who can act</h2>
      <p>Anyone with a client link can read and respond to that quote. The app does not verify client identity. Anyone with the private editor link can edit an unaccepted quote. Do not send that editor link to clients.</p>
      <h2>Current limits</h2>
      <p>This prototype does not offer an account, a self-service data export or deletion control yet. Its approval record is not a legal signature or proof of identity. Avoid real-client use until access and deletion controls are added.</p>
      <p><Link href="/">Back to quote builder</Link></p>
    </div>
  </main>;
}
