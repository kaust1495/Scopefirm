// Client-page branding for Pro and founder accounts: an accent colour and a small raster logo.

export const LOGO_MAX_BYTES = 200 * 1024;
export const brandColorPattern = /^#[0-9a-f]{6}$/i;

/** Detects the image type from its first bytes; the browser-supplied MIME type is not trusted. SVG is refused (it can carry script). */
export function sniffLogo(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  const at = (i: number, ...values: number[]) => values.every((value, j) => bytes[i + j] === value);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  return null;
}

/** Readable text on the accent: white on dark colours, ink on light ones (WCAG relative luminance). */
export function textOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#1b2a22' : '#ffffff';
}
