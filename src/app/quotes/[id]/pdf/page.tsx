import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getQuote, keyMatches } from '@/lib/store';
import { editorCookie } from '@/lib/editor-cookie';
import { formatQuotePrice } from '@/lib/currency';
import { gstBreakup, isTaxInvoice } from '@/lib/gst';
import { regionOf } from '@/lib/store';
import { LocalTime } from '@/app/components/local-time';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Printable quotation', robots: { index: false, follow: false, nocache: true } };

/**
 * Editor-only printable quotation. Always headed "Quotation": a quote issued before the work is not a tax invoice.
 * With a complete GST set (India) it shows the tax breakup the invoice would carry.
 */
export default async function QuotePdf({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await getQuote(id);
  const key = (await cookies()).get(editorCookie(id))?.value;
  if (!q || !keyMatches(q, key)) notFound();
  const withGst = regionOf(q) === 'IN' && isTaxInvoice(q);
  const tax = withGst ? gstBreakup(q.price, q.gst_rate!, q.gst_treatment!, q.gst_split!) : null;
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
          <h1>Quotation</h1>
          <p>{q.project} · Version {q.revision}</p>
        </div>
        <dl className="doc-meta">
          <div><dt>Document no.</dt><dd className="mono">{q.id}</dd></div>
          <div><dt>Date of issue</dt><dd><LocalTime iso={q.created_at} style="date"/></dd></div>
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
        {q.ask && <><h3>The brief</h3><p className="pre">{q.ask}</p></>}
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
      {q.status === 'accepted' && q.accepted_at && <p className="doc-accepted">Accepted on <LocalTime iso={q.accepted_at}/>, version {q.accepted_revision}.</p>}
      <footer className="doc-foot">
        <p>This is a quotation, not a tax invoice.{withGst ? ' GST particulars were entered by the supplier; verify them before invoicing.' : ''}</p>
        <p>Generated from the ScopeFirm quote tracker. Quote {q.id}, version {q.revision}.</p>
      </footer>
    </article>
  </main>;
}
