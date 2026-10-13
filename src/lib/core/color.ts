// the ways a color is written in the panels and the exports, from 8 bit rgb

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  // degrees, 0 to 359
  h: number;
  // percent, 0 to 100
  s: number;
  l: number;
}

function channel(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

// whole numbers from 0 to 255, whatever came in
export function clampRgb(c: RGB): RGB {
  return { r: channel(c.r), g: channel(c.g), b: channel(c.b) };
}

// "#RRGGBB" in upper case, like the hex the browser's eyedropper hands back
export function hex(c: RGB): string {
  const { r, g, b } = clampRgb(c);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// "#rgb", "#rrggbb" or the same without the hash, null for anything else
export function parseHex(text: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  if (!m) return null;
  const digits = m[1].length === 3 ? [...m[1]].map((d) => d + d).join('') : m[1];
  const v = parseInt(digits, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

// "225 137 122", how the panels and the status bar show rgb
export function rgbText(c: RGB): string {
  const { r, g, b } = clampRgb(c);
  return `${r} ${g} ${b}`;
}

// "rgb(225, 137, 122)", what copy rgb puts on the clipboard
export function rgbCss(c: RGB): string {
  const { r, g, b } = clampRgb(c);
  return `rgb(${r}, ${g}, ${b})`;
}

export function hsl(c: RGB): HSL {
  const { r, g, b } = clampRgb(c);
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: Math.round(l * 100) };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rf) h = ((gf - bf) / d) % 6;
  else if (max === gf) h = (bf - rf) / d + 2;
  else h = (rf - gf) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return { h: h % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

// "9° 63% 68%"
export function hslText(c: RGB): string {
  const { h, s, l } = hsl(c);
  return `${h}° ${s}% ${l}%`;
}

// rec 601 luma, rounded, the same gray the histogram counts
export function gray(c: RGB): number {
  const { r, g, b } = clampRgb(c);
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

function linear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

// relative luminance of srgb, 0 for black and 1 for white
export function luminance(c: RGB): number {
  const { r, g, b } = clampRgb(c);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

// the contrast ratio of two colors, from 1 to 21
export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const BLACK: RGB = { r: 17, g: 17, b: 17 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };

// the text color that reads better on a swatch, the near black of the theme or white
export function textOn(c: RGB): string {
  return contrast(c, BLACK) >= contrast(c, WHITE) ? '#111' : '#fff';
}
