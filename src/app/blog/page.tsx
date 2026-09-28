import Link from 'next/link';
import { posts } from '@/content/blog';

export const metadata = {
  title: 'Blog',
  description: 'Guides for freelance web designers and developers: scopes of work, revision rounds, change orders and getting paid by clients in India and abroad.',
  alternates: { canonical: '/blog' },
  openGraph: { title: 'Blog | ScopeFirm', url: '/blog', type: 'website', siteName: 'ScopeFirm', images: '/opengraph-image' },
};

export default function Blog() {
  return <main className="shell compact prose-page">
    <div className="hero small"><div className="eyebrow">BLOG</div><h1>Guides for fixed-price freelancers</h1><p>Scope, revisions, change orders and getting paid. Written by the ScopeFirm team.</p></div>
    <ul className="post-list">{posts.map(p => <li key={p.slug} className="panel">
      <span className="kicker">{new Date(`${p.date}T00:00:00Z`).toLocaleDateString('en-GB', { dateStyle: 'long', timeZone: 'UTC' })} · {p.minutes} MIN READ</span>
      <h2><Link href={`/blog/${p.slug}`}>{p.title}</Link></h2>
      <p>{p.description}</p>
    </li>)}</ul>
  </main>;
}
