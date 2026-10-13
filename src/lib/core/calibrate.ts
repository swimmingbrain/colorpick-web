import { parseHex } from './color';
import type { Frame, Rect, RGB } from './types';

export type { Frame, Rect, RGB } from './types';

// the calibration card: a checkered ring that can be found in any frame, 56 patches of known colors inside it, and the
// correction fitted from what the share made of them

export interface PatchSpec {
  hex: string;
  fit: boolean;
}

const F = true;
const H = false;

// 7 rows of 8. fit patches span the gamut, saturated ones both on and inside the srgb boundary, hold out patches
// sit between them
const PATCHES: readonly PatchSpec[] = (
  [
    ['#FFFFFF', F], ['#E6E6E6', F], ['#F5F5F5', H], ['#CCCCCC', F], ['#A6A6A6', F], ['#808080', F], ['#2B2B2B', H], ['#5C5C5C', F],
    ['#404040', F], ['#1A1A1A', F], ['#0A0A0A', H], ['#000000', F], ['#FF0000', F], ['#00FF00', F], ['#FF6347', H], ['#0000FF', F],
    ['#00FFFF', F], ['#FF00FF', F], ['#C04040', H], ['#FFFF00', F], ['#E04646', F], ['#46C846', F], ['#40C040', H], ['#4664E0', F],
    ['#D2C846', F], ['#4040C0', H], ['#46C8D2', F], ['#C846C8', F], ['#A03232', F], ['#336699', H], ['#32A03C', F], ['#3246A0', F],
    ['#A09632', F], ['#996633', H], ['#32969E', F], ['#963296', F], ['#669933', H], ['#6E1414', F], ['#146E28', F], ['#14286E', F],
    ['#6E5014', F], ['#4682B4', H], ['#FAC8C8', F], ['#C8F0C8', F], ['#DDA0DD', H], ['#C8D2FA', F], ['#F5F0BE', F], ['#20B2AA', H],
    ['#F0D2AF', F], ['#F5DEB3', H], ['#E0AC69', F], ['#8D5524', F], ['#C68642', H], ['#F08C32', F], ['#8C50D2', F], ['#F1C27D', H]
  ] as Array<[string, boolean]>
).map(([hex, fit]) => ({ hex, fit }));

const COLS = 8;
const ROWS = 7;
const PATCH = 32;
const GAP = 8;
const MARGIN = 8;
const CELL = 8;
const RING = 2;

// all sizes in css px. the ring is a checkerboard of CELL squares, RING cells thick, the top left cell is dark
export const CARD = {
  version: 1,
  cols: COLS,
  rows: ROWS,
  patch: PATCH,
  gap: GAP,
  margin: MARGIN,
  cell: CELL,
  ring: RING,
  dark: '#000000',
  light: '#FFFFFF',
  background: '#767676',
  width: 2 * (RING * CELL + MARGIN) + COLS * PATCH + (COLS - 1) * GAP,
  height: 2 * (RING * CELL + MARGIN) + ROWS * PATCH + (ROWS - 1) * GAP,
  patches: PATCHES
} as const;

const CELLS_X = CARD.width / CELL;
const CELLS_Y = CARD.height / CELL;
const INNER = RING * CELL;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface PatchBox extends Box {
  index: number;
  fit: boolean;
  rgb: RGB;
}

export interface CardLayout {
  width: number;
  height: number;
  light: string;
  inner: Box;
  dark: Box[];
  patches: PatchBox[];
}

function rgbOf(hex: string): RGB {
  const c = parseHex(hex);
  if (!c) throw new Error(`not a color: ${hex}`);
  return c;
}

export function patchOrigin(index: number): { x: number; y: number } {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return { x: INNER + MARGIN + col * (PATCH + GAP), y: INNER + MARGIN + row * (PATCH + GAP) };
}

const isRing = (i: number, j: number) => i < RING || j < RING || i >= CELLS_X - RING || j >= CELLS_Y - RING;
const isDark = (i: number, j: number) => (i + j) % 2 === 0;

// everything the page has to draw, in css px from the card corner
export function cardLayout(): CardLayout {
  const dark: Box[] = [];
  for (let j = 0; j < CELLS_Y; j++) {
    for (let i = 0; i < CELLS_X; i++) {
      if (isRing(i, j) && isDark(i, j)) dark.push({ x: i * CELL, y: j * CELL, w: CELL, h: CELL, color: CARD.dark });
    }
  }
  const patches = CARD.patches.map((p, index) => ({
    ...patchOrigin(index),
    w: PATCH,
    h: PATCH,
    color: p.hex,
    index,
    fit: p.fit,
    rgb: rgbOf(p.hex)
  }));
  const inner = { x: INNER, y: INNER, w: CARD.width - 2 * INNER, h: CARD.height - 2 * INNER, color: CARD.background };
  return { width: CARD.width, height: CARD.height, light: CARD.light, inner, dark, patches };
}

// the card as plain divs, shown at 100 percent page zoom without css transforms or filters
export function buildCard(doc: Document = document): HTMLElement {
  const layout = cardLayout();
  const box = (b: Box) => {
    const el = doc.createElement('div');
    const at = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
    el.style.cssText = `position:absolute;${at};background:${b.color}`;
    return el;
  };
  const card = doc.createElement('div');
  const size = `width:${layout.width}px;height:${layout.height}px`;
  card.style.cssText = `position:relative;flex:none;${size};background:${layout.light}`;
  card.append(box(layout.inner), ...layout.dark.map(box), ...layout.patches.map(box));
  return card;
}

export interface CardRect extends Rect {
  scaleX: number;
  scaleY: number;
  contrast: number;
}

interface Cell {
  i: number;
  j: number;
  dark: boolean;
}

const RING_CELLS: Cell[] = [];
for (let j = 0; j < CELLS_Y; j++) {
  for (let i = 0; i < CELLS_X; i++) if (isRing(i, j)) RING_CELLS.push({ i, j, dark: isDark(i, j) });
}

// each corner cell with its two neighbors along the ring, a cheap first test for every candidate position
const CORNERS: Cell[] = [];
const CORNER_STEPS = [
  [0, 0, 1, 1],
  [CELLS_X - 1, 0, -1, 1],
  [0, CELLS_Y - 1, 1, -1],
  [CELLS_X - 1, CELLS_Y - 1, -1, -1]
];
for (const [ci, cj, di, dj] of CORNER_STEPS) {
  const cells = [[ci, cj], [ci + di, cj], [ci, cj + dj]];
  for (const [i, j] of cells) CORNERS.push({ i, j, dark: isDark(i, j) });
}

function luma(f: Frame, x: number, y: number): number {
  const xi = Math.min(f.width - 1, Math.max(0, Math.floor(x)));
  const yi = Math.min(f.height - 1, Math.max(0, Math.floor(y)));
  const k = (yi * f.width + xi) * 4;
  const d = f.data;
  return (d[k] + 2 * d[k + 1] + d[k + 2]) / 4;
}

function ringScore(f: Frame, x: number, y: number, sx: number, sy: number): { contrast: number; agree: number } {
  let light = 0;
  let dark = 0;
  let nl = 0;
  let nd = 0;
  const v = new Float64Array(RING_CELLS.length);
  RING_CELLS.forEach((c, n) => {
    const l = luma(f, x + (c.i + 0.5) * sx, y + (c.j + 0.5) * sy);
    v[n] = l;
    if (c.dark) {
      dark += l;
      nd++;
    } else {
      light += l;
      nl++;
    }
  });
  const mid = (light / nl + dark / nd) / 2;
  let agree = 0;
  RING_CELLS.forEach((c, n) => {
    if (v[n] < mid === c.dark) agree++;
  });
  return { contrast: light / nl - dark / nd, agree: agree / RING_CELLS.length };
}

const MIN_CONTRAST = 48;

function coarse(f: Frame, scale: number, region: Rect): { x: number; y: number } | null {
  const cp = CELL * scale;
  const w = CARD.width * scale;
  const h = CARD.height * scale;
  const step = Math.max(1, Math.floor(cp / 2));
  const x0 = Math.max(0, Math.floor(region.x));
  const y0 = Math.max(0, Math.floor(region.y));
  const x1 = Math.min(f.width - w, region.x + region.w - w);
  const y1 = Math.min(f.height - h, region.y + region.h - h);
  let best: { x: number; y: number; score: number } | null = null;
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      let lo = 255;
      let hi = 0;
      for (const c of CORNERS) {
        const l = luma(f, x + (c.i + 0.5) * cp, y + (c.j + 0.5) * cp);
        if (c.dark) hi = Math.max(hi, l);
        else lo = Math.min(lo, l);
      }
      if (lo - hi < MIN_CONTRAST) continue;
      const s = ringScore(f, x, y, cp, cp);
      if (s.agree < 0.92 || s.contrast < MIN_CONTRAST) continue;
      const score = s.contrast * s.agree;
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  return best;
}

// the sub pixel position where the profile crosses the half level between two cell centers
function crossing(at: (u: number) => number, ua: number, ub: number, expect: number): number | null {
  const la = at(ua);
  const lb = at(ub);
  if (Math.abs(la - lb) < MIN_CONTRAST) return null;
  const mid = (la + lb) / 2;
  let best: number | null = null;
  for (let u = Math.floor(ua); u < Math.ceil(ub); u++) {
    const p = at(u + 0.5) - mid;
    const q = at(u + 1.5) - mid;
    if (p === 0 || p < 0 === q < 0) continue;
    const pos = u + 0.5 + p / (p - q);
    if (best === null || Math.abs(pos - expect) < Math.abs(best - expect)) best = pos;
  }
  return best;
}

// a least squares line y = a + b x, fitted again without the outliers
function line(points: Array<[number, number]>): { a: number; b: number } | null {
  let pts = points;
  for (let pass = 0; pass < 2; pass++) {
    const n = pts.length;
    if (n < 4) return null;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const [x, y] of pts) {
      sx += x;
      sy += y;
      sxx += x * x;
      sxy += x * y;
    }
    const den = n * sxx - sx * sx;
    if (!den) return null;
    const b = (n * sxy - sx * sy) / den;
    const a = (sy - b * sx) / n;
    const keep = pts.filter(([x, y]) => Math.abs(a + b * x - y) <= Math.max(0.75, 0.1 * b));
    if (keep.length === n || pass === 2) return { a, b };
    pts = keep;
  }
  return null;
}

// the cell edges of the four ring rows or columns, fitted as card edge plus n times the cell size
function edges(f: Frame, x: number, y: number, cp: number, horizontal: boolean): { a: number; b: number } | null {
  const along = horizontal ? CELLS_X : CELLS_Y;
  const across = horizontal ? CELLS_Y : CELLS_X;
  const origin = horizontal ? x : y;
  const other = horizontal ? y : x;
  const points: Array<[number, number]> = [];
  for (const k of [0, 1, across - 2, across - 1]) {
    const vs = [0.3, 0.5, 0.7].map((t) => other + (k + t) * cp);
    const at = (u: number) => vs.reduce((s, v) => s + (horizontal ? luma(f, u, v) : luma(f, v, u)), 0) / vs.length;
    for (let n = 1; n < along; n++) {
      const e = origin + n * cp;
      const pos = crossing(at, e - 0.5 * cp, e + 0.5 * cp, e);
      if (pos !== null) points.push([n, pos]);
    }
  }
  return line(points);
}

function correlation(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    ab += da * db;
    aa += da * da;
    bb += db * db;
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

function refine(f: Frame, x: number, y: number, scale: number): CardRect | null {
  const cp = CELL * scale;
  const ex = edges(f, x, y, cp, true);
  const ey = edges(f, x, y, cp, false);
  if (!ex || !ey) return null;
  const rect: CardRect = {
    x: ex.a,
    y: ey.a,
    w: ex.b * CELLS_X,
    h: ey.b * CELLS_Y,
    scaleX: ex.b / CELL,
    scaleY: ey.b / CELL,
    contrast: 0
  };
  if (Math.abs(rect.scaleX / scale - 1) > 0.08 || Math.abs(rect.scaleY / scale - 1) > 0.08) return null;
  if (rect.x < -0.5 || rect.y < -0.5) return null;
  if (rect.x + rect.w > f.width + 0.5 || rect.y + rect.h > f.height + 0.5) return null;
  const s = ringScore(f, rect.x, rect.y, ex.b, ey.b);
  if (s.agree < 0.98 || s.contrast < MIN_CONTRAST) return null;
  rect.contrast = Math.round(s.contrast * 10) / 10;
  const samples = sampleCard(f, rect);
  const seen = samples.map((p) => (p.mean[0] + 2 * p.mean[1] + p.mean[2]) / 4);
  const want = samples.map((p) => (p.expected.r + 2 * p.expected.g + p.expected.b) / 4);
  return correlation(seen, want) > 0.95 ? rect : null;
}

// the card anywhere in the frame, or null when it is not fully visible. expectedScale is frame pixels per css
// pixel (frame.width / screen.width for a monitor share), the hint is a rectangle in frame pixels searched first
export function locateCard(frame: Frame, expectedScale: number, hint?: Rect): CardRect | null {
  if (!(expectedScale > 0) || frame.width < CARD.width * expectedScale * 0.9) return null;
  const regions: Rect[] = [];
  if (hint) {
    const pad = 2 * CELL * expectedScale;
    regions.push({ x: hint.x - pad, y: hint.y - pad, w: hint.w + 2 * pad, h: hint.h + 2 * pad });
  }
  regions.push({ x: 0, y: 0, w: frame.width, h: frame.height });
  for (const region of regions) {
    for (const k of [1, 0.97, 1.03, 0.94, 1.06]) {
      const scale = expectedScale * k;
      const c = coarse(frame, scale, region);
      const rect = c && refine(frame, c.x, c.y, scale);
      if (rect) return rect;
    }
  }
  return null;
}

type Triple = [number, number, number];

export interface PatchSample {
  index: number;
  hex: string;
  fit: boolean;
  expected: RGB;
  mean: Triple;
  std: Triple;
  min: Triple;
  max: Triple;
  n: number;
  region: Rect;
}

// the pixels of the inner half of every patch, so edge smear and rounded borders stay out
export function sampleCard(frame: Frame, card: CardRect): PatchSample[] {
  const { data, width } = frame;
  return CARD.patches.map((p, index) => {
    const o = patchOrigin(index);
    const px = card.x + o.x * card.scaleX;
    const py = card.y + o.y * card.scaleY;
    const pw = PATCH * card.scaleX;
    const ph = PATCH * card.scaleY;
    const ix = Math.max(2, 0.25 * pw);
    const iy = Math.max(2, 0.25 * ph);
    const x0 = Math.max(0, Math.ceil(px + ix));
    const x1 = Math.min(frame.width, Math.floor(px + pw - ix));
    const y0 = Math.max(0, Math.ceil(py + iy));
    const y1 = Math.min(frame.height, Math.floor(py + ph - iy));
    const sum = [0, 0, 0];
    const sq = [0, 0, 0];
    const lo: Triple = [255, 255, 255];
    const hi: Triple = [0, 0, 0];
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const k = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const v = data[k + c];
          sum[c] += v;
          sq[c] += v * v;
          if (v < lo[c]) lo[c] = v;
          if (v > hi[c]) hi[c] = v;
        }
        n++;
      }
    }
    const mean = sum.map((s) => (n ? s / n : 0)) as Triple;
    const std = sq.map((s, c) => (n ? Math.sqrt(Math.max(0, s / n - mean[c] ** 2)) : 0)) as Triple;
    const region = { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
    return { index, hex: p.hex, fit: p.fit, expected: rgbOf(p.hex), mean, std, min: lo, max: hi, n, region };
  });
}

// the largest change of any patch mean between two frames at the same card position. fit only when two frames in
// a row agree within about 1, a window that is still fading in or a moving overlay shows up here
export function cardDifference(a: Frame, b: Frame, card: CardRect): number {
  const sa = sampleCard(a, card);
  const sb = sampleCard(b, card);
  let max = 0;
  sa.forEach((p, i) => {
    for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs(p.mean[c] - sb[i].mean[c]));
  });
  return Math.round(max * 100) / 100;
}

// the srgb transfer curve, 0 to 255 code values against linear light 0 to 1
export function toLinear(v: number): number {
  const c = Math.min(1, Math.max(0, v / 255));
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function fromLinear(l: number): number {
  const c = Math.min(1, Math.max(0, l));
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
}

export interface Curve {
  x: number[];
  y: number[];
}

export interface ErrorSummary {
  mean: number;
  max: number;
}

export interface Calibration {
  version: 1;
  // per channel input curves from the gray patches, captured value to true value. exact gray pixels use only these
  curves: [Curve, Curve, Curve];
  // 3x4 row major, applied in linear light between the curves and the srgb encoding, for every other pixel
  matrix: number[];
  // how far off the fit patches are after the correction, and the hold out patches the fit never saw
  residual: ErrorSummary;
  holdout: ErrorSummary;
  // fit patches left out because the screen clipped them, they lie outside the display gamut
  clipped: string[];
  frame: { w: number; h: number };
  // iso time
  at: string;
}

const IDENTITY_CURVE: Curve = { x: [0, 255], y: [0, 255] };

export function curveAt(c: Curve, v: number): number {
  const { x, y } = c;
  const n = x.length;
  let i = 0;
  while (i < n - 2 && v > x[i + 1]) i++;
  const x0 = x[i];
  const x1 = x[i + 1];
  const y0 = y[i];
  const y1 = y[i + 1];
  const out = x1 === x0 ? y0 : y0 + ((v - x0) * (y1 - y0)) / (x1 - x0);
  return Math.min(255, Math.max(0, out));
}

// the gray patches give the tone curve of the whole chain per channel, identity when the points do not rise strictly
function grayCurve(pairs: Array<[number, number]>): Curve {
  const pts = [...pairs].sort((a, b) => a[0] - b[0]);
  if (pts.length < 3) return IDENTITY_CURVE;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] <= pts[i - 1][0] || pts[i][1] <= pts[i - 1][1]) return IDENTITY_CURVE;
  }
  return { x: pts.map((p) => Math.round(p[0] * 100) / 100), y: pts.map((p) => p[1]) };
}

// weighted least squares pulled gently toward the prior, normal equations solved by gaussian elimination
function solve(rows: number[][], t: number[], w: number[], prior: number[], ridge: number): number[] | null {
  const k = rows[0].length;
  const a = Array.from({ length: k }, () => new Array<number>(k + 1).fill(0));
  rows.forEach((r, n) => {
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) a[i][j] += w[n] * r[i] * r[j];
      a[i][k] += w[n] * r[i] * t[n];
    }
  });
  const lambda = (ridge * w.reduce((s, v) => s + v, 0)) / Math.max(1, w.length);
  for (let i = 0; i < k; i++) {
    a[i][i] += lambda;
    a[i][k] += lambda * prior[i];
  }
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let j = c; j <= k; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map((row, i) => row[k] / row[i]);
}

// the slope of the srgb encoding, so a linear light fit weighs every code value alike
const slope = (l: number) => (l <= 0.0031308 ? 12.92 * 255 : 255 * (1.055 / 2.4) * l ** (1 / 2.4 - 1));

interface Pair {
  seen: Triple;
  want: Triple;
  gray: boolean;
}

function linearFeatures(curves: Curve[], v: Triple): number[] {
  return [
    toLinear(curveAt(curves[0], v[0])),
    toLinear(curveAt(curves[1], v[1])),
    toLinear(curveAt(curves[2], v[2])),
    1
  ];
}

// pull of the matrix toward identity, it would remove cross terms at the noise level of the capture
const RIDGE = 0;
const atBoundary = (s: Triple) => s.some((v) => v <= 2 || v >= 253);
const MAX_PATCH_STD = 8;
const CONSENSUS = 3;

function fitLinear(curves: Curve[], pairs: Pair[]): number[] | null {
  const rows = pairs.map((p) => linearFeatures(curves, p.seen));
  const out: number[] = [];
  for (let c = 0; c < 3; c++) {
    const t = pairs.map((p) => toLinear(p.want[c]));
    const prior = [0, 0, 0, 0];
    prior[c] = 1;
    const sol = solve(rows, t, t.map((l) => slope(Math.max(l, 0.002)) ** 2), prior, RIDGE);
    if (!sol) return null;
    out.push(...sol);
  }
  return out;
}

// grays within one code everywhere are capture rounding and not a tone curve, exact grays then pass unchanged
const grayIdentity = (curves: Curve[]) => curves.every((c) => c.x.every((x, i) => Math.abs(x - c.y[i]) <= 1));

// exact gray pixels only pass the gray curves: the capture never truncates zero chroma, so they carry no bias
function grayOut(curves: Curve[], c: number, v: number): number {
  return grayIdentity(curves) ? v : curveAt(curves[c], v);
}

function correctFloat(curves: Curve[], m: number[], v: Triple): Triple {
  const g = Math.round(v[0]);
  if (g === Math.round(v[1]) && g === Math.round(v[2])) {
    return [grayOut(curves, 0, g), grayOut(curves, 1, g), grayOut(curves, 2, g)];
  }
  const f = linearFeatures(curves, v);
  const row = (c: number) => m[4 * c] * f[0] + m[4 * c + 1] * f[1] + m[4 * c + 2] * f[2] + m[4 * c + 3];
  return [fromLinear(row(0)), fromLinear(row(1)), fromLinear(row(2))];
}

function summary(curves: Curve[], m: number[], pairs: Pair[]): ErrorSummary {
  let sum = 0;
  let max = 0;
  for (const p of pairs) {
    correctFloat(curves, m, p.seen).forEach((v, c) => {
      const e = Math.abs(Math.min(255, Math.max(0, Math.round(v))) - p.want[c]);
      sum += e;
      max = Math.max(max, e);
    });
  }
  return { mean: pairs.length ? Math.round((sum / (3 * pairs.length)) * 100) / 100 : 0, max };
}

// the correction from a frame that shows the card at cardRect: the gray patches give per channel tone curves, then a
// 3x4 matrix in linear light. saturated fit patches the screen clipped are left out. throws when the card is covered
export function fitCalibration(frame: Frame, cardRect: CardRect): Calibration {
  const samples = sampleCard(frame, cardRect).filter((s) => s.n > 0 && Math.max(...s.std) <= MAX_PATCH_STD);
  const toPair = (s: PatchSample): Pair => {
    const want: Triple = [s.expected.r, s.expected.g, s.expected.b];
    return { seen: s.mean, want, gray: want[0] === want[1] && want[1] === want[2] };
  };
  const fitSet = samples.filter((s) => s.fit);
  const hold = samples.filter((s) => !s.fit).map(toPair);
  const pairs = fitSet.map(toPair);
  if (pairs.length < 20) throw new Error(`only ${pairs.length} clean fit patches, the card is covered or blurred`);
  // a dialog scrim or a fading window keeps the pattern but not the levels
  const level = (hex: string) => {
    const s = fitSet.find((p) => p.hex === hex);
    return s ? (s.mean[0] + 2 * s.mean[1] + s.mean[2]) / 4 : NaN;
  };
  const white = level('#FFFFFF');
  const black = level('#000000');
  if (!(white >= 160 && black <= 96 && white - black >= 128)) {
    throw new Error('the card looks dimmed or washed out, something covers it');
  }
  const grays = pairs.filter((p) => p.gray);
  const curves = [0, 1, 2].map((c) => grayCurve(grays.map((p) => [p.seen[c], p.want[c]]))) as [Curve, Curve, Curve];
  const inner = pairs.filter((p) => p.gray || !atBoundary(p.seen));
  const first = fitLinear(curves, inner);
  if (!first) throw new Error('the fit patches do not span the color space');
  let m = first;
  let keep = inner;
  for (let pass = 0; pass < 2; pass++) {
    const fitM = m;
    keep = pairs.filter((p) => p.gray || !atBoundary(p.seen) || summary(curves, fitM, [p]).max <= CONSENSUS);
    m = fitLinear(curves, keep) ?? m;
  }
  const matrix = m.map((v) => Math.round(v * 1e6) / 1e6);
  return {
    version: 1,
    curves,
    matrix,
    residual: summary(curves, matrix, keep),
    holdout: summary(curves, matrix, hold),
    clipped: fitSet.filter((_, i) => !keep.includes(pairs[i])).map((s) => s.hex),
    frame: { w: frame.width, h: frame.height },
    at: new Date().toISOString()
  };
}

interface Tables {
  lin: Float64Array[];
  gray: Uint8Array[];
  m: number[];
  // a direct mapped cache of packed rgb results, screens repeat few colors
  keys: Int32Array;
  values: Int32Array;
}

const CACHE_BITS = 16;

// a calibration is never changed after the fit, so its tables can be kept per object
const tables = new WeakMap<Calibration, Tables>();

// output code k covers linear light from EDGES[k] to EDGES[k + 1], so rounding is exact without pow per pixel
const EDGES = new Float64Array(257);
for (let k = 0; k <= 256; k++) EDGES[k] = k === 0 ? -Infinity : k === 256 ? Infinity : toLinear(k - 0.5);
const COARSE = 4096;
const START = new Uint8Array(COARSE + 1);
for (let i = 0, k = 0; i <= COARSE; i++) {
  while (k < 255 && EDGES[k + 1] <= i / COARSE) k++;
  START[i] = k;
}

function encode(l: number): number {
  if (!(l > 0)) return 0;
  if (l >= 1) return 255;
  let k = START[Math.floor(l * COARSE)];
  while (k < 255 && l >= EDGES[k + 1]) k++;
  return k;
}

function tablesOf(cal: Calibration): Tables {
  let t = tables.get(cal);
  if (!t) {
    const lin = cal.curves.map((c) => Float64Array.from({ length: 256 }, (_, v) => toLinear(curveAt(c, v))));
    const gray = [0, 1, 2].map((c) => Uint8Array.from({ length: 256 }, (_, v) => Math.round(grayOut(cal.curves, c, v))));
    const keys = new Int32Array(1 << CACHE_BITS).fill(-1);
    t = { lin, gray, m: cal.matrix, keys, values: new Int32Array(1 << CACHE_BITS) };
    tables.set(cal, t);
  }
  return t;
}

const byte = (v: number) => (v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v));

function compute(t: Tables, r: number, g: number, b: number): number {
  if (r === g && g === b) return (t.gray[0][r] << 16) | (t.gray[1][r] << 8) | t.gray[2][r];
  const { lin, m } = t;
  const lr = lin[0][r];
  const lg = lin[1][g];
  const lb = lin[2][b];
  const red = encode(m[0] * lr + m[1] * lg + m[2] * lb + m[3]);
  const green = encode(m[4] * lr + m[5] * lg + m[6] * lb + m[7]);
  const blue = encode(m[8] * lr + m[9] * lg + m[10] * lb + m[11]);
  return (red << 16) | (green << 8) | blue;
}

export function correctPixel(cal: Calibration, r: number, g: number, b: number): RGB {
  const v = compute(tablesOf(cal), byte(r), byte(g), byte(b));
  return { r: v >> 16, g: (v >> 8) & 255, b: v & 255 };
}

// rgba bytes in place, alpha untouched
export function applyCalibration(cal: Calibration, data: Uint8ClampedArray): void {
  const t = tablesOf(cal);
  const { keys, values } = t;
  const shift = 32 - CACHE_BITS;
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    const slot = Math.imul(key, 0x9e3779b1) >>> shift;
    let v: number;
    if (keys[slot] === key) {
      v = values[slot];
    } else {
      v = compute(t, data[i], data[i + 1], data[i + 2]);
      keys[slot] = key;
      values[slot] = v;
    }
    data[i] = v >> 16;
    data[i + 1] = (v >> 8) & 255;
    data[i + 2] = v & 255;
  }
}

export function toJSON(cal: Calibration): string {
  return JSON.stringify(cal);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isByte = (v: unknown): v is number => isNum(v) && v >= 0 && v <= 255;

function isSummary(v: unknown): v is ErrorSummary {
  return !!v && typeof v === 'object' && isNum((v as ErrorSummary).mean) && isNum((v as ErrorSummary).max);
}

// at least two points, both coordinates within 0 to 255 and rising
function isCurve(v: unknown): v is Curve {
  const c = v as Curve;
  if (!c || !Array.isArray(c.x) || !Array.isArray(c.y)) return false;
  if (c.x.length < 2 || c.x.length !== c.y.length || c.x.length > 64) return false;
  return c.x.every((x, i) => isByte(x) && isByte(c.y[i]) && (i === 0 || (x > c.x[i - 1] && c.y[i] > c.y[i - 1])));
}

// null for anything that is not a sane version 1 calibration, a string or an object parsed already
export function fromJSON(input: unknown): Calibration | null {
  let v: unknown = input;
  if (typeof input === 'string') {
    try {
      v = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object') return null;
  const c = v as Partial<Calibration>;
  if (c.version !== 1 || !Array.isArray(c.matrix) || c.matrix.length !== 12) return null;
  if (!c.matrix.every(isNum) || c.matrix.some((x) => Math.abs(x) > 100)) return null;
  if (!Array.isArray(c.curves) || c.curves.length !== 3 || !c.curves.every(isCurve)) return null;
  if (!isSummary(c.residual) || !isSummary(c.holdout)) return null;
  if (!Array.isArray(c.clipped) || !c.clipped.every((h) => typeof h === 'string' && /^#[0-9A-F]{6}$/i.test(h))) {
    return null;
  }
  const f = c.frame;
  if (!f || !Number.isInteger(f.w) || !Number.isInteger(f.h) || f.w <= 0 || f.h <= 0) return null;
  if (typeof c.at !== 'string' || Number.isNaN(Date.parse(c.at))) return null;
  return {
    version: 1,
    curves: c.curves.map((k) => ({ x: [...k.x], y: [...k.y] })) as [Curve, Curve, Curve],
    matrix: [...c.matrix],
    residual: { mean: c.residual.mean, max: c.residual.max },
    holdout: { mean: c.holdout.mean, max: c.holdout.max },
    clipped: [...c.clipped],
    frame: { w: f.w, h: f.h },
    at: c.at
  };
}

export const CALIBRATION_KEY = 'brainpick:calibration';

// a private window or a broken entry gives no calibration
export function loadCalibration(storage: Pick<Storage, 'getItem'> | null): Calibration | null {
  if (!storage) return null;
  try {
    return fromJSON(storage.getItem(CALIBRATION_KEY));
  } catch {
    return null;
  }
}

export function saveCalibration(storage: Pick<Storage, 'setItem' | 'removeItem'> | null, cal: Calibration | null) {
  if (!storage) return;
  try {
    if (cal) storage.setItem(CALIBRATION_KEY, toJSON(cal));
    else storage.removeItem(CALIBRATION_KEY);
  } catch {}
}
