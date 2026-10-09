import { ImageResponse } from 'next/og';

export const alt = 'ScopeFirm: your client approves the exact scope; extras get priced';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f5f2ea', padding: 72, color: '#1b2a22', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', fontSize: 44, fontWeight: 800 }}>scope<span style={{ color: '#1f5a41' }}>firm</span><span style={{ color: '#a44d27' }}>.</span></div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3 }}>Your client approves the exact scope. Extras get priced.</div>
        <div style={{ fontSize: 32, color: '#5c6a60', marginTop: 28 }}>Fixed-price quotes · one approval link · dated revisions and change orders</div>
      </div>
      <div style={{ display: 'flex', fontSize: 24, color: '#1f5a41', fontWeight: 700 }}>FOR FREELANCE WEB BUILDERS</div>
    </div>,
    size,
  );
}
