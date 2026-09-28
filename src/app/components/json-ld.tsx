import { headers } from 'next/headers';

/** Structured data for search and AI answers, tagged with the request's CSP nonce. */
export async function JsonLd({ data }: { data: object }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}/>;
}
