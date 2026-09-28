import { ImageResponse } from 'next/og';

export const alt = 'ScopeFirm: make the scope clear before the work begins';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f7f7f1', padding: 72, color: '#14251e', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', fontSize: 44, fontWeight: 800 }}>scope<span style={{ color: '#205d43' }}>firm</span><span style={{ color: '#a6c56b' }}>.</span></div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3 }}>Make the scope clear before the work begins.</div>
        <div style={{ fontSize: 32, color: '#5e6b62', marginTop: 28 }}>Fixed-price quotes · one approval link · dated revisions and change orders</div>
      </div>
      <div style={{ display: 'flex', fontSize: 24, color: '#205d43', fontWeight: 700 }}>FOR FREELANCE WEB BUILDERS</div>
    </div>,
    size,
  );
}
