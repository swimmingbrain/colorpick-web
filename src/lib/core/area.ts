import type { NormRect } from '$lib/stores/session';
import type { Point, Size } from './frames';

// the area rectangle: kept 0 to 1 so it fits any frame, edited in whole frame pixels

export const AREA_KEY = 'brainpick:area';
// smaller than this an area says nothing a pixel does not
export const MIN_SIZE = 3;

export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type Handle = (typeof HANDLES)[number];
// what a press on the stage takes hold of
export type Hit = Handle | 'inside' | null;

// x and y are the top left pixel, w and h how many pixels it spans
export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// inside the frame and at least the minimum on each side, as far as the frame allows
export function clampRect(r: PxRect, frame: Size, min = MIN_SIZE): PxRect {
  const w = clamp(Math.round(r.w), Math.min(min, frame.width), frame.width);
  const h = clamp(Math.round(r.h), Math.min(min, frame.height), frame.height);
  return {
    x: clamp(Math.round(r.x), 0, frame.width - w),
    y: clamp(Math.round(r.y), 0, frame.height - h),
    w,
    h
  };
}

export function toNorm(r: PxRect, frame: Size): NormRect {
  return { x: r.x / frame.width, y: r.y / frame.height, w: r.w / frame.width, h: r.h / frame.height };
}

// the edges land on whole pixels of this frame, a rectangle kept for another size still fits
export function toPixels(r: NormRect, frame: Size, min = MIN_SIZE): PxRect {
  const x = Math.round(r.x * frame.width);
  const y = Math.round(r.y * frame.height);
  const right = Math.round((r.x + r.w) * frame.width);
  const bottom = Math.round((r.y + r.h) * frame.height);
  return clampRect({ x, y, w: right - x, h: bottom - y }, frame, min);
}

// one span of a drag on an axis, a short one grows from the start in the direction of the drag
function span(a: number, b: number, min: number): [number, number] {
  let lo = Math.min(a, b);
  let hi = Math.max(a, b);
  if (hi - lo < min) {
    if (b >= a) hi = lo + min;
    else lo = hi - min;
  }
  return [lo, hi];
}

// the rectangle a drag from a to b draws, with its edges between pixels
export function spanRect(a: Point, b: Point, frame: Size, min = MIN_SIZE): PxRect {
  const ax = clamp(Math.round(a.x), 0, frame.width);
  const ay = clamp(Math.round(a.y), 0, frame.height);
  const bx = clamp(Math.round(b.x), 0, frame.width);
  const by = clamp(Math.round(b.y), 0, frame.height);
  const [x0, x1] = span(ax, bx, min);
  const [y0, y1] = span(ay, by, min);
  return clampRect({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, frame, min);
}

export function moveRect(r: PxRect, dx: number, dy: number, frame: Size): PxRect {
  return clampRect({ ...r, x: r.x + Math.round(dx), y: r.y + Math.round(dy) }, frame, 1);
}

// the edges of the handle follow the point, the opposite edges stay where they are
export function resizeRect(r: PxRect, handle: Handle, p: Point, frame: Size, min = MIN_SIZE): PxRect {
  const px = clamp(Math.round(p.x), 0, frame.width);
  const py = clamp(Math.round(p.y), 0, frame.height);
  let left = r.x;
  let top = r.y;
  let right = r.x + r.w;
  let bottom = r.y + r.h;
  if (handle.includes('w')) left = Math.min(px, right - min);
  if (handle.includes('e')) right = Math.max(px, left + min);
  if (handle.includes('n')) top = Math.min(py, bottom - min);
  if (handle.includes('s')) bottom = Math.max(py, top + min);
  return clampRect({ x: left, y: top, w: right - left, h: bottom - top }, frame, min);
}

// the corners, then the middles of the sides, in frame pixels
export function handlePoints(r: PxRect): Record<Handle, Point> {
  const left = r.x;
  const top = r.y;
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  const cx = left + r.w / 2;
  const cy = top + r.h / 2;
  return {
    nw: { x: left, y: top },
    n: { x: cx, y: top },
    ne: { x: right, y: top },
    e: { x: right, y: cy },
    se: { x: right, y: bottom },
    s: { x: cx, y: bottom },
    sw: { x: left, y: bottom },
    w: { x: left, y: cy }
  };
}

// the nearest handle within the tolerance, else the inside, else nothing. the tolerance is in frame pixels
export function hitRect(r: PxRect, p: Point, tolerance: number): Hit {
  const points = handlePoints(r);
  let best: Handle | null = null;
  let bestDistance = Infinity;
  for (const h of HANDLES) {
    const d = Math.max(Math.abs(p.x - points[h].x), Math.abs(p.y - points[h].y));
    if (d <= tolerance && d < bestDistance) {
      best = h;
      bestDistance = d;
    }
  }
  if (best) return best;
  if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return 'inside';
  return null;
}

export function cursorFor(hit: Hit): string {
  switch (hit) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'inside':
      return 'move';
    default:
      return 'crosshair';
  }
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
};

// an arrow key moves the rectangle by a pixel, with shift by ten, any other key does nothing
export function nudge(r: PxRect, key: string, shift: boolean, frame: Size): PxRect | null {
  const d = ARROWS[key];
  if (!d) return null;
  const step = shift ? 10 : 1;
  return moveRect(r, d[0] * step, d[1] * step, frame);
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// a stored rectangle, or null when it is broken or reaches outside the frame
export function parseArea(v: unknown): NormRect | null {
  if (typeof v !== 'object' || v === null) return null;
  const { x, y, w, h } = v as Record<string, unknown>;
  if (!isNumber(x) || !isNumber(y) || !isNumber(w) || !isNumber(h)) return null;
  const slack = 1e-9;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 + slack || y + h > 1 + slack) return null;
  return { x, y, w, h };
}

export function loadArea(storage: Pick<Storage, 'getItem'> | null): NormRect | null {
  if (!storage) return null;
  try {
    const stored = storage.getItem(AREA_KEY);
    return stored ? parseArea(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

export function saveArea(storage: Pick<Storage, 'setItem' | 'removeItem'> | null, rect: NormRect | null) {
  if (!storage) return;
  try {
    if (rect) storage.setItem(AREA_KEY, JSON.stringify(rect));
    else storage.removeItem(AREA_KEY);
  } catch {}
}
