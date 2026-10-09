import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'ScopeFirm: your client approves the exact scope; extras get priced';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The site's own fonts (Satori reads .woff, not .woff2), so the image matches the pages.
const font = (file: string) => readFile(join(process.cwd(), 'node_modules/@fontsource', file));

export default async function OpengraphImage() {
  const [serif, serifBold, sans, mono] = await Promise.all([
    font('newsreader/files/newsreader-latin-400-normal.woff'),
    font('newsreader/files/newsreader-latin-600-normal.woff'),
    font('ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff'),
    font('ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff'),
  ]);
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f5f2ea', padding: 72, color: '#1b2a22', fontFamily: 'Plex Sans' }}>
      {/* Two spans lose the e–f kerning; pull "firm" back 1px so it reads as one word, like the site logo. */}
      <div style={{ display: 'flex', fontFamily: 'Newsreader', fontWeight: 600, fontSize: 48 }}><span>scope</span><span style={{ color: '#1f5a41', marginLeft: -1 }}>firm</span></div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Newsreader', fontSize: 68, lineHeight: 1.1, letterSpacing: -1.2 }}><span>Your client approves the exact scope.</span><span style={{ color: '#1f5a41' }}>Extras get priced.</span></div>
        <div style={{ fontSize: 30, color: '#5c6a60', marginTop: 28 }}>Fixed-price quotes · one approval link · dated revisions and change orders</div>
      </div>
      <div style={{ display: 'flex', fontFamily: 'Plex Mono', fontWeight: 600, fontSize: 22, letterSpacing: 2.5, color: '#1f5a41' }}>FOR FREELANCE WEB BUILDERS</div>
    </div>,
    { ...size, fonts: [
      { name: 'Newsreader', data: serif, weight: 400, style: 'normal' },
      { name: 'Newsreader', data: serifBold, weight: 600, style: 'normal' },
      { name: 'Plex Sans', data: sans, weight: 400, style: 'normal' },
      { name: 'Plex Mono', data: mono, weight: 600, style: 'normal' },
    ] },
  );
}
