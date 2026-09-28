import Link from 'next/link';

export const metadata = { title: 'Terms', description: 'Terms for using the ScopeFirm quote approval prototype: what an approval does and does not prove, acceptable use, and limits of liability.', alternates: { canonical: '/terms' } };

export default function Terms() {
  return <main className="shell compact">
    <div className="hero small">
      <div className="eyebrow">PROTOTYPE TERMS</div>
      <h1>Terms of use</h1>
      <p>Plain-language terms for a free prototype. By creating or responding to a quote you agree to them.</p>
    </div>
    <div className="panel form">
      <h2>What ScopeFirm is</h2>
      <p>ScopeFirm lets a freelancer write a fixed-price scope, share a link, and keep a dated record of revisions, client responses and change orders. It is a free prototype, offered as is, without uptime or support commitments.</p>
      <h2>What an approval means</h2>
      <p>An approval records that someone with the client link accepted a specific revision at a specific time, with the name they typed. It is not a verified electronic signature, not a contract by itself, and not a payment or proof of payment. ScopeFirm does not check who holds a link. Agree your contract and payment terms directly with each other.</p>
      <h2>Your responsibilities</h2>
      <p>Keep your private editor link to yourself; anyone with it can edit or delete the quote. Only enter information you are allowed to share, and do not enter passwords, bank details, ID numbers or other sensitive personal data. Do not use ScopeFirm to mislead, defraud or harass anyone, or to overload or probe the service.</p>
      <h2>Data and deletion</h2>
      <p>What is stored, and for how long, is described in the <Link href="/privacy">privacy notice</Link>. An editor-link holder can download or permanently delete a quote and its history at any time. We may remove quotes that break these terms, and the prototype may be reset or shut down.</p>
      <h2>Liability</h2>
      <p>To the extent the law allows, ScopeFirm is not liable for lost work, lost payment, disputes between freelancers and clients, or loss of data. Keep your own copy of anything important; use the download on your tracker.</p>
      <h2>Changes</h2>
      <p>These terms may change as the prototype changes. The version on this page applies.</p>
      <p><Link href="/">Back to quote builder</Link></p>
    </div>
  </main>;
}
