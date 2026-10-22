import Link from 'next/link';

export const metadata = { title: 'Terms', description: 'Terms for using FirmQuote: what an approval does and does not prove, acceptable use, Pro billing, cancellation and refunds, and limits of liability.', alternates: { canonical: '/terms' }, openGraph: { title: 'Terms | FirmQuote', url: '/terms', type: 'website', siteName: 'FirmQuote', images: '/opengraph-image' } };

export default function Terms() {
  return <main className="shell compact">
    <div className="hero small">
      <div className="eyebrow">TERMS</div>
      <h1>Terms of use</h1>
      <p>Plain-language terms. By creating or responding to a quote, or subscribing to Pro, you agree to them.</p>
    </div>
    <div className="panel form">
      <h2>What FirmQuote is</h2>
      <p>FirmQuote lets a freelancer write a fixed-price scope, share a link, and keep a dated record of revisions, client responses and change orders. The quote tools are free to use; Pro is an optional paid plan (see below). The service is offered as is, without uptime or support commitments.</p>
      <h2>What an approval means</h2>
      <p>An approval records that someone with the client link accepted a specific revision at a specific time, with the name they typed. It is not a verified electronic signature, not a contract by itself, and not a payment or proof of payment. FirmQuote does not check who holds a link. Agree your contract and payment terms directly with each other.</p>
      <h2>Your responsibilities</h2>
      <p>Keep your private editor link to yourself; anyone with it can edit or delete the quote. Only enter information you are allowed to share, and do not enter passwords, bank details, ID numbers or other sensitive personal data. Do not use FirmQuote to mislead, defraud or harass anyone, or to overload or probe the service.</p>
      <h2 id="pro">Pro billing, cancellation and refunds</h2>
      <p>Pro is a monthly or yearly subscription. Payment is handled by Dodo Payments, which acts as the merchant of record: it sells the subscription to you, charges you, handles sales tax or GST, and issues your invoice. Your price and currency are shown at checkout before you pay. FirmQuote never sees your card, bank or UPI details.</p>
      <p><strong>Renewal.</strong> Pro renews automatically at the end of each month or year and is charged to the payment method you used, until you cancel. If a renewal payment fails, Pro stays on for 3 more days, then ends unless the payment goes through.</p>
      <p><strong>Cancelling.</strong> You can cancel any time from your <Link href="/account">account page</Link>. Cancelling stops the next renewal; Pro stays on until the end of the period you already paid for, and you are not charged again. Your quotes stay yours after Pro ends; the free plan&apos;s limits apply again.</p>
      <p><strong>Refunds.</strong> Payments are non-refundable, including for partly used periods, except where the law requires a refund. If you think you were charged in error, contact us through <Link href="/support">support</Link> or Dodo Payments.</p>
      <h2>Data and deletion</h2>
      <p>What is stored, and for how long, is described in the <Link href="/privacy">privacy notice</Link>. An editor-link holder can download or permanently delete a quote and its history at any time. We may remove quotes that break these terms, and the prototype may be reset or shut down.</p>
      <h2>Liability</h2>
      <p>To the extent the law allows, FirmQuote is not liable for lost work, lost payment, disputes between freelancers and clients, or loss of data. Keep your own copy of anything important; use the download on your tracker.</p>
      <h2>Changes</h2>
      <p>These terms may change as FirmQuote changes. The version on this page applies; changes to Pro pricing apply from your next renewal, not to a period already paid for.</p>
      <p><Link href="/">Back to quote builder</Link></p>
    </div>
  </main>;
}
