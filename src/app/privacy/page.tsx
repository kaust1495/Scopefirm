import Link from 'next/link';

export const metadata = { title: 'Privacy', description: 'What ScopeFirm stores for a quote, who can act on a quote link, and how to delete a quote and its history.', alternates: { canonical: '/privacy' }, openGraph: { title: 'Privacy | ScopeFirm', url: '/privacy', type: 'website', siteName: 'ScopeFirm', images: '/opengraph-image' } };

export default function Privacy() {
  return <main className="shell compact">
    <div className="hero small">
      <div className="eyebrow">PROTOTYPE NOTICE</div>
      <h1>Privacy at ScopeFirm</h1>
      <p>ScopeFirm is a course prototype. Do not put sensitive client information in a quote.</p>
    </div>
    <div className="panel form">
      <h2>What is stored</h2>
      <p>Quotes store the client and project names, brief, deliverables, exclusions, optional pages/forms/CMS/timeline details, optional GST particulars you enter (business name and address, GSTINs, SAC code and tax rate), an optional advance amount, payment link and (India only) UPI ID, and whether you marked the advance or change-order payments received, price, revisions, responses (including the name a client types to accept) and dated history in a Turso database. If you add a client email, it is stored with the quote and used only to send that client a one-time approval code through our email provider (Resend); the client page shows it masked. To limit abuse, a hashed form of your IP address is kept for up to a day when you create a quote. The private editor key is stored with the quote; after opening an editor link, the browser keeps it in a 30-day HttpOnly cookie. Keep the original editor link safe for access on another device. A client link exposes the quote to anyone who has that link.</p>
      <h2>Campaign labels</h2><p>We keep only approved source, medium and campaign labels from the first tagged link in your browser tab, using session storage until the tab closes. When you create a quote, those labels are saved separately to count which channels lead to quotes. We do not store full URLs, referrers, client details or a device identifier for attribution. The free calculators and email templates run in your browser; their inputs are not uploaded or stored.</p>
      <h2>Who can act</h2>
      <p>Anyone with a client link can read and respond to that quote. The app does not verify client identity. Anyone with the private editor link can edit an unaccepted quote. Do not send that editor link to clients.</p>
      <h2>Current limits</h2>
      <p>This prototype does not offer an account. From the private tracker, an editor-link holder can download the quote, its history and change orders as JSON. An editor-link holder can permanently delete that quote and its history from the tracker. Its approval record is not a legal signature or proof of identity. Avoid real-client use until access and deletion controls are added.</p>
      <p><Link href="/">Back to quote builder</Link></p>
    </div>
  </main>;
}

