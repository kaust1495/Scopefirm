import Link from 'next/link';

export const metadata = {
  title: 'Compare',
  description: 'How ScopeFirm compares with Upwork and Fiverr, all-in-one freelancer suites, free invoicing tools and doing it over WhatsApp: when each is the better choice.',
  alternates: { canonical: '/compare' },
  openGraph: { title: 'ScopeFirm compared | ScopeFirm', url: '/compare', type: 'website', siteName: 'ScopeFirm', images: '/opengraph-image' },
};

const rows = [
  { name: 'ScopeFirm', cost: 'Free, no cut of payments', client: 'No account', scope: 'Scope approval by version, locked after acceptance, priced change orders on the same link', money: 'Payment link or UPI straight to you; no escrow', best: 'Direct clients, fixed-price web work, India and abroad' },
  { name: 'Upwork / Fiverr', cost: 'Platform fees on each job', client: 'Platform account', scope: 'Milestones (Upwork), revisions and paid extras (Fiverr) inside the order', money: 'Escrow held by the platform', best: 'Clients you met on the platform (moving them off it breaks the rules)' },
  { name: 'Upwork Direct Contracts', cost: '5% freelancer fee, plus a client fee', client: 'Upwork account', scope: 'Milestones for clients met outside Upwork', money: 'Escrow', best: 'Direct clients when escrow matters more than fees' },
  { name: 'All-in-one suites (e.g. Bonsai)', cost: 'Monthly subscription', client: 'Usually no account', scope: 'Proposals, contracts, e-approval, deposits, reminders, CRM', money: 'Built-in payments', best: 'Freelancers who want contracts, invoicing and CRM in one paid tool' },
  { name: 'Free invoicing (e.g. Zoho Invoice, Refrens)', cost: 'Free tiers', client: 'Portal access for approval', scope: 'Quotes the client can accept, then invoices', money: 'Online payments incl. UPI', best: 'Indian businesses that mainly need GST invoicing' },
  { name: 'WhatsApp + a Google Doc', cost: 'Free', client: 'None', scope: '“Reply OK to confirm”; no versions or change tracking', money: 'Whatever you arrange', best: 'Tiny, low-risk jobs with clients you trust' },
];

export default function Compare() {
  return <main className="shell compact prose-page">
    <div className="hero small"><div className="eyebrow">COMPARE</div><h1>Pick the right tool, even if it isn’t us.</h1><p>An honest comparison, checked on each vendor’s own pages on 28 September 2026. Features and prices change; check before you decide.</p></div>
    <div className="table-scroll" role="region" aria-label="Comparison table" tabIndex={0}>
      <table className="compare-table">
        <thead><tr><th scope="col">Option</th><th scope="col">Cost</th><th scope="col">Client needs</th><th scope="col">Scope and extras</th><th scope="col">Money</th><th scope="col">Best for</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.name}><th scope="row">{r.name}</th><td>{r.cost}</td><td>{r.client}</td><td>{r.scope}</td><td>{r.money}</td><td>{r.best}</td></tr>)}</tbody>
      </table>
    </div>
    <div className="support-grid">
      <section className="panel"><h2>Where ScopeFirm is better</h2><ul>
        <li>Free, with no percentage taken from your payments.</li>
        <li>Your client needs no account: one link to read, accept or ask for changes.</li>
        <li>Built around the moment scope creep happens: extras become priced change orders with their own payment button.</li>
        <li>Works for India (GST, UPI, INR) and for clients abroad (payment links, their own timezone).</li>
        <li>An Excel payments sheet and calendar reminders, with no subscription.</li>
      </ul></section>
      <section className="panel"><h2>Where it is weaker</h2><ul>
        <li>No escrow: if you need guaranteed payment from an unknown client, a marketplace or escrow service is safer.</li>
        <li>No contracts, invoicing or CRM like the all-in-one suites.</li>
        <li>No automatic email reminders to clients; reminders go to your own calendar.</li>
        <li>An approval is a dated record, not a verified electronic signature.</li>
      </ul></section>
    </div>
    <p className="hint">Sources: <a href="https://support.upwork.com/hc/en-us/articles/360025040794-Direct-Contracts-bring-a-client-to-Upwork" rel="noopener noreferrer" target="_blank">Upwork Direct Contracts</a> · <a href="https://support.upwork.com/hc/en-us/articles/360052511133-Circumvention-and-why-it-s-against-the-rules" rel="noopener noreferrer" target="_blank">Upwork circumvention policy</a> · <a href="https://help.fiverr.com/hc/en-us/articles/360010791778-Offering-extra-services-within-an-active-order" rel="noopener noreferrer" target="_blank">Fiverr extras</a> · <a href="https://www.hellobonsai.com/proposals" rel="noopener noreferrer" target="_blank">Bonsai proposals</a> · <a href="https://www.zoho.com/in/invoice/pricing" rel="noopener noreferrer" target="_blank">Zoho Invoice India</a> · <a href="https://www.refrens.com/pricing" rel="noopener noreferrer" target="_blank">Refrens pricing</a>. Product names are trademarks of their owners; ScopeFirm is not affiliated with them.</p>
    <p><Link className="primary" href="/#quote-builder">Try ScopeFirm free</Link></p>
  </main>;
}
