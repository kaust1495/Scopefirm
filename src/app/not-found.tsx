import Link from 'next/link';

export default function NotFound() {
  return <main className="shell compact prose-page">
    <div className="hero small">
      <div className="eyebrow">404</div>
      <h1>This page could not be found.</h1>
      <p>The link may be old, mistyped, or a private quote link that is no longer available.</p>
      <p><Link className="primary" href="/#quote-builder">Create a quote</Link> <Link className="secondary" href="/support">Get support</Link></p>
    </div>
  </main>;
}
