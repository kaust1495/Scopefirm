import { formatQuotePrice } from '@/lib/currency';
import { regionOf, type Quote } from '@/lib/store';

/** How a client can pay an amount due: a UPI button (India, rupees), the freelancer's payment link (any country), or neither. */
export function PaymentOptions({ q, amount, purpose }: { q: Quote; amount: number; purpose: string }) {
  const upi = regionOf(q) === 'IN' && q.currency === 'INR' && q.upi_id ? q.upi_id : null;
  const link = q.payment_link;
  const upiHref = upi ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(q.supplier_name || q.project)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`${purpose}: ${q.project}`)}` : null;
  let linkHost = '';
  try { linkHost = link ? new URL(link).hostname : ''; } catch { linkHost = ''; }
  if (!upiHref && !link) return <p className="hint">Ask the freelancer how to pay {formatQuotePrice(amount, q.currency)}. ScopeFirm does not process or verify payments.</p>;
  return <div className="pay-options">
    <div className="order-actions">
      {upiHref && <a className="primary" href={upiHref}>Pay {formatQuotePrice(amount, q.currency)} via UPI</a>}
      {link && <a className={upiHref ? 'secondary' : 'primary'} href={link} target="_blank" rel="noopener noreferrer nofollow">Pay {formatQuotePrice(amount, q.currency)} online ({linkHost}) ↗</a>}
    </div>
    {upi && <p className="hint mono share-url">UPI ID: {upi}{link ? ' · Outside India? Use the online payment link.' : ''}</p>}
    <p className="hint">You pay the freelancer directly. ScopeFirm does not process or verify payments; the freelancer marks it received.</p>
  </div>;
}
