import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getQuote, keyMatches } from '@/lib/store';
import { editorCookie } from '@/lib/editor-cookie';
import { formatQuotePrice } from '@/lib/currency';
import { gstBreakup, isTaxInvoice } from '@/lib/gst';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Printable quote', robots: { index: false, follow: false, nocache: true } };

const ist = { timeZone: 'Asia/Kolkata' } as const;

/** Editor-only printable document. Headed "Tax Invoice" only when the freelancer entered a GSTIN and the full GST set; otherwise plainly a quote. */
export default async function QuotePdf({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await getQuote(id);
  const key = (await cookies()).get(editorCookie(id))?.value;
  if (!q || !keyMatches(q, key)) notFound();
  const taxInvoice = isTaxInvoice(q);
  const tax = taxInvoice ? gstBreakup(q.price, q.gst_rate!, q.gst_treatment!, q.gst_split!) : null;
  const issued = new Date(q.created_at).toLocaleDateString('en-IN', { ...ist, dateStyle: 'medium' });
  const details = [
    q.pages_count != null ? `Pages included: ${q.pages_count}` : null,
    q.forms_count != null ? `Forms included: ${q.forms_count}` : null,
    q.cms_needed != null ? `CMS setup: ${q.cms_needed === 'yes' ? 'Included' : 'Not included'}` : null,
    q.timeline ? `Timeline: ${q.timeline}` : null,
  ].filter(Boolean).join(' · ');
  return <main className="shell compact">
    <div className="no-print doc-actions">
      <Link href={`/quotes/${id}`}>← Back to tracker</Link>
      <PrintButton />
    </div>
    <article className="doc">
      <header className="doc-head">
        <div>
          <h1>{taxInvoice ? 'Tax Invoice' : 'Quote'}</h1>
          <p>{q.project} · Revision {q.revision}</p>
        </div>
        <dl className="doc-meta">
          <div><dt>Document no.</dt><dd className="mono">{q.id}</dd></div>
          <div><dt>Date of issue</dt><dd>{issued}</dd></div>
          <div><dt>Status</dt><dd>{q.status.replace('_', ' ')}</dd></div>
        </dl>
      </header>
      <section className="doc-parties">
        <div>
          <h2>From (supplier)</h2>
          {q.supplier_name || q.supplier_address || q.supplier_gstin ? <>
            {q.supplier_name && <p><strong>{q.supplier_name}</strong></p>}
            {q.supplier_address && <p className="pre">{q.supplier_address}</p>}
            {q.supplier_gstin && <p>GSTIN: {q.supplier_gstin}</p>}
          </> : <p>Not specified</p>}
        </div>
        <div>
          <h2>To (recipient)</h2>
          <p><strong>{q.client}</strong></p>
          {q.client_gstin && <p>GSTIN: {q.client_gstin}</p>}
        </div>
      </section>
      <section>
        <h2>Scope</h2>
        <h3>The brief</h3>
        <p className="pre">{q.ask}</p>
        <h3>What is included</h3>
        <p className="pre">{q.deliverables}</p>
        <h3>Not included</h3>
        <p className="pre">{q.exclusions}</p>
        {details && <p>{details}</p>}
        <p>Included revision rounds: {q.revision_limit}. One revision round is one consolidated set of feedback on the quoted scope, followed by an updated version. New deliverables are extra work.</p>
      </section>
      <table className="doc-table">
        <tbody>
          {tax ? <>
            <tr><td>{q.sac_code ? `Services as scoped above (SAC ${q.sac_code})` : 'Services as scoped above'}</td><td>{formatQuotePrice(tax.taxable, q.currency)}</td></tr>
            {tax.split === 'igst'
              ? <tr><td>IGST @ {tax.rate}%{q.gst_treatment === 'inclusive' ? ' (included in price)' : ''}</td><td>{formatQuotePrice(tax.igst!, q.currency)}</td></tr>
              : <>
                <tr><td>CGST @ {tax.rate / 2}%{q.gst_treatment === 'inclusive' ? ' (included in price)' : ''}</td><td>{formatQuotePrice(tax.cgst!, q.currency)}</td></tr>
                <tr><td>SGST @ {tax.rate / 2}%{q.gst_treatment === 'inclusive' ? ' (included in price)' : ''}</td><td>{formatQuotePrice(tax.sgst!, q.currency)}</td></tr>
              </>}
            <tr className="doc-total"><td>Total</td><td>{formatQuotePrice(tax.total, q.currency)}</td></tr>
          </> : <>
            {q.sac_code && <tr><td>SAC code</td><td>{q.sac_code}</td></tr>}
            <tr className="doc-total"><td>Fixed price</td><td>{formatQuotePrice(q.price, q.currency)}</td></tr>
          </>}
        </tbody>
      </table>
      {q.status === 'accepted' && q.accepted_at && <p className="doc-accepted">Accepted on {new Date(q.accepted_at).toLocaleString('en-IN', { ...ist, dateStyle: 'medium', timeStyle: 'short' })} IST, revision {q.accepted_revision}.</p>}
      <footer className="doc-foot">
        {taxInvoice
          ? <p>Tax particulars above are entered by the supplier. Verify them before issuing this document.</p>
          : <p>This document is a quote, not a tax invoice. GST particulars are optional: the freelancer can add a GSTIN, tax rate, treatment and split on the private tracker to head this document as a tax invoice.</p>}
        <p>Generated from the ScopeFirm revision tracker. Quote {q.id}, revision {q.revision}.</p>
      </footer>
    </article>
  </main>;
}
