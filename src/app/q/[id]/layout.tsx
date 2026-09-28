import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Quote for review', robots: { index: false, follow: false, nocache: true }, alternates: { canonical: null } };
export default function QuoteLayout({ children }: { children: React.ReactNode }) { return children; }
