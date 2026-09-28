import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Private quote tracker', robots: { index: false, follow: false, nocache: true }, alternates: { canonical: null } };
export default function TrackerLayout({ children }: { children: React.ReactNode }) { return children; }
