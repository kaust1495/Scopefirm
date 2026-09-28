import Link from 'next/link';
import { JsonLd } from '@/app/components/json-ld';
import { siteUrl } from '@/lib/site';

export const metadata = {
  title: 'How it works',
  description: 'From a rough client brief to an approved, fixed-price scope, priced change orders and tracked payments, in five steps. No accounts for you or your client.',
  alternates: { canonical: '/how-it-works' },
  openGraph: { title: 'How ScopeFirm works', url: '/how-it-works', type: 'website', siteName: 'ScopeFirm', images: '/opengraph-image' },
};

const steps = [
  { title: 'Write the scope', text: 'List deliverables and exclusions, set a fixed price, currency, timeline and included revision rounds. Optionally add an advance, a payment link or UPI, GST details and a valid-until date.' },
  { title: 'Share one link', text: 'Send the client link by WhatsApp or email. Your client reads the scope and either accepts that exact version or asks for changes. No account needed. You can see when the link was opened.' },
  { title: 'Get an explicit yes', text: 'The client accepts a specific version with their typed name, or with an emailed code if you turn on verification. The quote locks, and the dated record is kept.' },
  { title: 'Price every extra', text: 'When the client asks for more, propose a change order with a price. They accept or decline it on the same link; only accepted changes add to the running total.' },
  { title: 'Get paid and keep records', text: 'The client pays the advance and accepted changes with your payment link or UPI. Mark payments received, set calendar reminders for anything unpaid, and download an Excel payments sheet.' },
];

export default function HowItWorks() {
  return <main className="shell compact prose-page">
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'HowTo', name: 'Agree a fixed-price scope and handle extra work with ScopeFirm', url: `${siteUrl}/how-it-works`, step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.text })) }}/>
    <div className="hero small"><div className="eyebrow">HOW IT WORKS</div><h1>From rough brief to <em>paid extras</em>.</h1><p>Five steps, no accounts, one link for your client.</p></div>
    <ol className="how-steps">{steps.map((s, i) => <li key={s.title} className="panel"><span className="kicker">STEP {i + 1}</span><h2>{s.title}</h2><p>{s.text}</p></li>)}</ol>
    <div className="panel"><h2>What ScopeFirm does not do</h2><ul>
      <li>It does not hold money in escrow or process payments. Clients pay you directly.</li>
      <li>An approval is a dated record, not a verified legal signature.</li>
      <li>It does not replace a contract; use one for large or risky projects.</li>
    </ul><p><Link className="primary" href="/#quote-builder">Create a quote</Link></p></div>
  </main>;
}
