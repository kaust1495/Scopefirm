import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
export const metadata:Metadata={title:'ScopeFirm | Clear scope. Confident yes.',description:'Build a fixed-price scope and get a dated client approval.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><header className="top"><Link href="/" className="logo">scope<span>firm</span><i>.</i></Link><span className="top-note">Fixed scope. Fewer surprises.</span></header>{children}<footer>ScopeFirm · A lightweight scope approval prototype</footer></body></html>}
