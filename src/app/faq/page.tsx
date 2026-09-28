import Link from 'next/link';
import { faqs, allFaqs } from '@/content/faq';
import { JsonLd } from '@/app/components/json-ld';

export const metadata = {
  title: 'FAQ',
  description: 'Answers about ScopeFirm: accounts, client approval, change orders, payments by UPI or payment link, reminders, the Excel payments sheet, privacy and deleting data.',
  alternates: { canonical: '/faq' },
  openGraph: { title: 'FAQ | ScopeFirm', url: '/faq', type: 'website', siteName: 'ScopeFirm', images: '/opengraph-image' },
};

export default function Faq() {
  return <main className="shell compact prose-page">
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: allFaqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }}/>
    <div className="hero small"><div className="eyebrow">HELP</div><h1>Frequently asked questions</h1><p>Can’t find your answer? <Link href="/support">Ask on the support page</Link>.</p></div>
    {faqs.map(g => <section key={g.group} className="faq" aria-labelledby={`g-${g.group}`}>
      <h2 id={`g-${g.group}`}>{g.group}</h2>
      {g.items.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
    </section>)}
  </main>;
}
