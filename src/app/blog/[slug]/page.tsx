import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { posts, postBySlug, type Block } from '@/content/blog';
import { JsonLd } from '@/app/components/json-ld';
import { siteName, siteUrl } from '@/lib/site';

export function generateStaticParams() { return posts.map(p => ({ slug: p.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = postBySlug((await params).slug);
  if (!post) return {};
  return {
    title: post.title, description: post.description, alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: 'article', title: post.title, description: post.description, url: `/blog/${post.slug}`, siteName, publishedTime: post.date, authors: [post.author || 'ScopeFirm team'], images: '/opengraph-image' },
  };
}

function Render({ b }: { b: Block }) {
  if ('h' in b) return <h2>{b.h}</h2>;
  if ('p' in b) return <p>{b.p}</p>;
  if ('ul' in b) return <ul>{b.ul.map(i => <li key={i}>{i}</li>)}</ul>;
  if ('ol' in b) return <ol>{b.ol.map(i => <li key={i}>{i}</li>)}</ol>;
  return <blockquote className="clause" style={{ whiteSpace: 'pre-line' }}>{b.clause}</blockquote>;
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  const url = `${siteUrl}/blog/${post.slug}`;
  return <main className="shell compact prose-page">
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description: post.description, datePublished: post.date, dateModified: post.date, author: post.author ? { '@type': 'Person', name: post.author } : { '@type': 'Organization', name: 'ScopeFirm team', url: siteUrl }, publisher: { '@type': 'Organization', name: siteName, url: siteUrl }, mainEntityOfPage: url, image: `${siteUrl}/opengraph-image` }}/>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Blog', item: `${siteUrl}/blog` }, { '@type': 'ListItem', position: 2, name: post.title, item: url }] }}/>
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/blog">← All posts</Link></nav>
    <article className="post">
      <header className="hero small"><div className="eyebrow">{new Date(`${post.date}T00:00:00Z`).toLocaleDateString('en-GB', { dateStyle: 'long', timeZone: 'UTC' })} · {post.minutes} MIN READ · {post.author ? `BY ${post.author.toUpperCase()}` : 'SCOPEFIRM TEAM'}</div><h1>{post.title}</h1><p>{post.description}</p></header>
      <div className="panel post-body">{post.body.map((b, i) => <Render key={i} b={b}/>)}
        {post.sources && <><h2>Sources</h2><ul>{post.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul></>}
      </div>
    </article>
    <div className="panel"><h2>Put it into practice</h2><p>Write your next scope in ScopeFirm and send your client one link to approve.</p><p><Link className="primary" href="/#quote-builder">Create a quote</Link></p></div>
  </main>;
}

