import Link from 'next/link';

export const metadata = { title: 'Privacy', description: 'What FirmQuote stores for a quote, who can act on a quote link, and how to delete a quote and its history.', alternates: { canonical: '/privacy' }, openGraph: { title: 'Privacy | FirmQuote', url: '/privacy', type: 'website', siteName: 'FirmQuote', images: '/opengraph-image' } };

export default function Privacy() {
  return <main className="shell compact">
    <div className="hero small">
      <div className="eyebrow">PROTOTYPE NOTICE</div>
      <h1>Privacy at FirmQuote</h1>
      <p>FirmQuote is a course prototype. Do not put sensitive client information in a quote.</p>
    </div>
    <div className="panel form">
      <h2>What is stored</h2>
      <p>Quotes store the client and project names, brief, deliverables, exclusions, optional pages/forms/CMS/timeline details, optional GST particulars you enter (business name and address, GSTINs, SAC code and tax rate), an optional advance amount, payment link and (India only) UPI ID, and whether you marked the advance or change-order payments received, price, revisions, responses (including the name a client types to accept) and dated history in a Turso database. If you add a client email, it is stored with the quote and used only to send that client a one-time approval code through our email provider (Resend); the client page shows it masked. To limit abuse, a hashed form of your IP address is kept for up to a day when you create a quote. The private editor key is stored with the quote; after opening an editor link, the browser keeps it in a 30-day HttpOnly cookie. Keep the original editor link safe for access on another device. A client link exposes the quote to anyone who has that link.</p>
      <h2>Freelancer accounts</h2><p>If you sign in, we store your email address, when your account was created and first activated, your founder number if you have one, who invited you, your referral bonus and whether you joined the Pro waitlist. Sign-in codes and session tokens are stored only as one-way hashes, and so are the network (IP) address each sign-in came from (kept with your account after you sign out) and the address of the first visit to each client link; we use those hashes only to tell your own visits from your client&apos;s. Sign-in uses HttpOnly cookies: a session cookie (up to 180 days), a short-lived cookie holding the address awaiting its code (10 minutes), a cookie remembering this browser&apos;s free quote (up to a year), and an invite cookie (up to 30 days). We use your email only to send sign-in codes and, if you join it, to tell you when Pro opens.</p><h2>Pro subscriptions and branding</h2><p>If you subscribe to Pro, payment happens on Stripe&apos;s or Razorpay&apos;s own page; FirmQuote never sees or stores card, bank or UPI details. We store which provider you used, the subscription id, its status, the date Pro is paid until, and whether you cancelled. Your email and an internal account id are passed to the provider to create the subscription. If you add branding, we store your accent colour and logo image and show them on your client pages. Removing the logo deletes it.</p>
      <h2>Campaign labels</h2><p>We keep only approved source, medium and campaign labels from the first tagged link in your browser tab, using session storage until the tab closes. When you create a quote, those labels are saved separately to count which channels lead to quotes. We do not store full URLs, referrers, client details or a device identifier for attribution. The free calculators and email templates run in your browser; their inputs are not uploaded or stored.</p>
      <h2>Visit recordings</h2><p>To see where the site confuses people we use Microsoft Clarity. It records how a visit goes - pages opened, clicks and scrolling - and sets its own analytics cookies for this. Whatever is typed into a form stays hidden from these recordings, so quote details, names and tax particulars are not captured. Visit recordings are processed by Microsoft.</p>
      <h2>Who can act</h2>
      <p>Anyone with a client link can read and respond to that quote. The app does not verify client identity. Anyone with the private editor link can edit an unaccepted quote. Do not send that editor link to clients.</p>
      <h2>Current limits</h2>
      <p>Signing in is optional for your first quote; an account lists your quotes but does not replace the editor link, which still grants edit access on its own. From the private tracker, an editor-link holder can download the quote, its history and change orders as JSON. An editor-link holder can permanently delete that quote and its history from the tracker. Its approval record is not a legal signature or proof of identity. Avoid real-client use until access and deletion controls are added.</p>
      <p><Link href="/">Back to quote builder</Link></p>
    </div>
  </main>;
}
