import Link from 'next/link';

export const metadata = {
  title: 'Support',
  description: 'Get help with ScopeFirm: read the FAQ, report a bug or request a feature on GitHub, or report a security problem privately.',
  alternates: { canonical: '/support' },
  openGraph: { title: 'Support | ScopeFirm', url: '/support', type: 'website', siteName: 'ScopeFirm', images: '/opengraph-image' },
};

const repo = 'https://github.com/kaust1495/Scopefirm';

export default function Support() {
  return <main className="shell compact prose-page">
    <div className="hero small"><div className="eyebrow">SUPPORT</div><h1>How can we help?</h1><p>ScopeFirm is a free prototype run by a small team. We answer on GitHub, usually within a few days.</p></div>
    <div className="support-grid">
      <section className="panel"><span className="kicker">QUICK ANSWERS</span><h2>Read the FAQ</h2><p>Accounts, approvals, change orders, payments, reminders and privacy.</p><p><Link className="secondary" href="/faq">Open the FAQ</Link></p></section>
      <section className="panel"><span className="kicker">BUG OR IDEA</span><h2>Open a GitHub issue</h2><p>Describe what you did, what you expected and what happened. Include your browser and device.</p><p className="hint"><strong>Never paste your private editor link or a client link.</strong> Anyone with them can open the quote.</p><p><a className="secondary" href={`${repo}/issues/new`} target="_blank" rel="noopener noreferrer">Open an issue ↗</a></p></section>
      <section className="panel"><span className="kicker">SECURITY</span><h2>Report a vulnerability privately</h2><p>Please don’t post security problems in a public issue. Use GitHub’s private reporting, and give us a reasonable time to fix it before disclosure.</p><p><a className="secondary" href={`${repo}/security/advisories/new`} target="_blank" rel="noopener noreferrer">Report privately ↗</a></p></section>
      <section className="panel"><span className="kicker">YOUR DATA</span><h2>Download or delete a quote</h2><p>Open the quote with your private editor link, then use “Download a copy” or “Delete quote and history”. We can’t recover a lost editor link.</p><p><Link className="secondary" href="/privacy">Privacy notice</Link></p></section>
    </div>
  </main>;
}
