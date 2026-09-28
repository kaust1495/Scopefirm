import { quoteCurrencies } from '@/lib/currency';
import { regionOf, type Quote } from '@/lib/store';

/**
 * The quote form body, shared by the builder and the tracker's edit form.
 * Core scope fields stay visible; optional extras sit in collapsed sections.
 * India-only sections (GST, UPI) hide via CSS when "Elsewhere" is chosen, and the server drops their values too.
 */
export function QuoteFields({ q, defaultRegion, emailOn }: { q?: Quote; defaultRegion: 'IN' | 'OTHER'; emailOn: boolean }) {
  const region = q ? regionOf(q) : defaultRegion;
  const v = <K extends keyof Quote>(k: K) => (q?.[k] ?? '') as string | number;
  const hasDetail = Boolean(q && (q.ask || q.pages_count != null || q.forms_count != null || q.cms_needed));
  const hasPayment = Boolean(q && (q.advance_amount != null || q.payment_link || q.upi_id));
  const hasGst = Boolean(q && (q.supplier_gstin || q.client_gstin || q.gst_rate != null || q.sac_code));
  const hasBusiness = Boolean(q && (q.supplier_name || q.supplier_address));
  return <>
    <fieldset className="region">
      <legend>You are based in</legend>
      <label className="choice"><input type="radio" name="region" value="IN" defaultChecked={region === 'IN'}/> India</label>
      <label className="choice"><input type="radio" name="region" value="OTHER" defaultChecked={region === 'OTHER'}/> Elsewhere</label>
      <small>India adds GST details and UPI payments. Everything else works the same everywhere.</small>
    </fieldset>
    <div className="two">
      <label>Client name<input name="client" defaultValue={v('client')} placeholder="e.g. Riya at Studio North" required maxLength={120}/></label>
      <label>Project name<input name="project" defaultValue={v('project')} placeholder="e.g. Portfolio website" required maxLength={120}/></label>
    </div>
    <label>Deliverables <small>One item per line</small><textarea name="deliverables" defaultValue={v('deliverables')} placeholder={'5-page responsive website\nContact form\nBasic SEO setup'} rows={4} required maxLength={4000}/></label>
    <label>Exclusions <small>What is not in this price?</small><textarea name="exclusions" defaultValue={v('exclusions')} placeholder={'Copywriting\nHosting and domain fees\nNew pages beyond the five listed'} rows={3} required maxLength={3000}/></label>
    <div className="two">
      <label>Fixed price<input name="price" type="number" defaultValue={v('price')} min="0.01" max="100000000" step="0.01" placeholder="e.g. 2500" required/></label>
      <label>Currency<select name="currency" defaultValue={q?.currency ?? (region === 'IN' ? 'INR' : 'USD')} required>{quoteCurrencies.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
    </div>
    <div className="two">
      <label>Timeline <small>e.g. 3 weeks after kickoff</small><input name="timeline" defaultValue={v('timeline')} maxLength={500}/></label>
      <label>Included revision rounds <small>Rounds of feedback on the work</small><input name="revision_limit" type="number" defaultValue={q?.revision_limit ?? 2} min="0" max="99" required/></label>
    </div>
    <p className="hint">One revision round is one consolidated set of client feedback, followed by an updated version. New deliverables are extra work. Amounts are not converted between currencies.</p>

    <details className="optional" open={hasDetail}>
      <summary>More scope detail <small>optional</small></summary>
      <label>The client&apos;s original ask <small>Shown to the client as context</small><textarea name="ask" defaultValue={v('ask')} placeholder="Paste their rough brief if it helps." rows={3} maxLength={3000}/></label>
      <div className="three">
        <label>Pages<input name="pages_count" type="number" defaultValue={v('pages_count')} min="0" max="1000" step="1"/></label>
        <label>Forms<input name="forms_count" type="number" defaultValue={v('forms_count')} min="0" max="1000" step="1"/></label>
        <label>CMS setup<select name="cms_needed" defaultValue={v('cms_needed')}><option value="">Not specified</option><option value="yes">Included</option><option value="no">Not included</option></select></label>
      </div>
    </details>

    {(emailOn || q?.client_email) && <details className="optional" open={Boolean(q?.client_email)}>
      <summary>Verified approval <small>optional</small></summary>
      <label>Client email <small>The client must enter a code sent here to approve.</small><input name="client_email" type="email" defaultValue={v('client_email')} maxLength={254} autoComplete="off"/></label>
    </details>}

    <details className="optional" open={hasPayment}>
      <summary>Advance payment <small>optional</small></summary>
      <label>Advance amount <small>Due once the client accepts</small><input name="advance_amount" type="number" defaultValue={v('advance_amount')} min="0.01" max="100000000" step="0.01"/></label>
      <label>Payment link <small>Your PayPal.me, Stripe, Razorpay or Wise link. Works for clients in any country.</small><input name="payment_link" type="url" defaultValue={v('payment_link')} maxLength={500} placeholder="https://" autoComplete="off"/></label>
      <label className="india-only">Your UPI ID <small>India only, rupee quotes only. Most clients outside India cannot pay by UPI.</small><input name="upi_id" defaultValue={v('upi_id')} maxLength={130} autoComplete="off" placeholder="name@okhdfcbank"/></label>
      <p className="hint">The same payment options appear when the client accepts a change order. ScopeFirm never handles the money; you mark payments received yourself.</p>
    </details>

    <details className="optional" open={hasBusiness || hasGst}>
      <summary>Business and tax details <small>optional, for the printable quotation</small></summary>
      <div className="two">
        <label>Your business name<input name="supplier_name" defaultValue={v('supplier_name')} maxLength={120}/></label>
        <label className="india-only">Your GSTIN <small>15 characters, if registered</small><input name="supplier_gstin" defaultValue={v('supplier_gstin')} maxLength={15} autoComplete="off"/></label>
      </div>
      <label>Your business address<textarea name="supplier_address" defaultValue={v('supplier_address')} rows={2} maxLength={500}/></label>
      <div className="india-only">
        <div className="two">
          <label>Client GSTIN <small>If the client is registered</small><input name="client_gstin" defaultValue={v('client_gstin')} maxLength={15} autoComplete="off"/></label>
          <label>SAC code<input name="sac_code" defaultValue={v('sac_code')} maxLength={8} inputMode="numeric"/></label>
        </div>
        <div className="three">
          <label>GST rate %<input name="gst_rate" type="number" defaultValue={v('gst_rate')} min="0" max="28" step="0.01"/></label>
          <label>GST on price<select name="gst_treatment" defaultValue={v('gst_treatment')}><option value="">Not set</option><option value="exclusive">Added on top</option><option value="inclusive">Included</option></select></label>
          <label>Tax split<select name="gst_split" defaultValue={v('gst_split')}><option value="">Not set</option><option value="cgst_sgst">CGST + SGST</option><option value="igst">IGST</option></select></label>
        </div>
        <p className="hint">GST is shown as a breakup on the quotation. Check the details with your CA before issuing a tax invoice.</p>
      </div>
    </details>
  </>;
}
