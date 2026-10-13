import type { RGB } from './color';

// frame access for the stage, plus the geometry between the stage in css pixels and the frame in its own pixels

// rgba bytes like the canvas hands them out, a plain shape so the helpers run without a browser
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type Zoom = 'fit' | 'actual';

// the pasteboard shows around the frame when it is fitted
export const STAGE_MARGIN = 16;
// more reads a second only cost power, the eye does not see them
export const MAX_READS = 10;
export const LOUPE_PIXELS = 11;
export const LOUPE_SCALE = 8;

let source: HTMLVideoElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;

// the stage hands over its video element, null when it goes
export function attachVideo(video: HTMLVideoElement | null) {
  source = video;
}

// the latest frame of the share at full size, null before the first one. the only function that reads the
// video, a measured frame reader can take its place without the stage noticing
export async function grabFrame(): Promise<ImageData | null> {
  const video = source;
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
  const w = video.videoWidth;
  const h = video.videoHeight;
  canvas ??= document.createElement('canvas');
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  context ??= canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
  if (!context) return null;
  context.drawImage(video, 0, 0, w, h);
  return context.getImageData(0, 0, w, h);
}

// how long to wait between two frame reads, the share rate but never more than ten a second
export function readInterval(fps: number): number {
  const rate = Number.isFinite(fps) && fps > 0 ? Math.min(MAX_READS, fps) : MAX_READS;
  return 1000 / rate;
}

export function pixelAt(img: Pixels, x: number, y: number): RGB | null {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null;
  const i = (y * img.width + x) * 4;
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] };
}

// a square of pixels around one, what lies outside the frame stays transparent
export function block(img: Pixels, cx: number, cy: number, size = LOUPE_PIXELS): Pixels {
  const data = new Uint8ClampedArray(size * size * 4);
  const half = Math.floor(size / 2);
  for (let row = 0; row < size; row++) {
    const y = cy - half + row;
    if (y < 0 || y >= img.height) continue;
    for (let col = 0; col < size; col++) {
      const x = cx - half + col;
      if (x < 0 || x >= img.width) continue;
      const from = (y * img.width + x) * 4;
      const to = (row * size + col) * 4;
      data[to] = img.data[from];
      data[to + 1] = img.data[from + 1];
      data[to + 2] = img.data[from + 2];
      data[to + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

// where the frame sits on the stage in css pixels. the content grows past the stage at 100% so it can scroll
export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
  // css pixels per frame pixel
  scale: number;
  contentW: number;
  contentH: number;
}

// fit puts the whole frame on the stage, actual gives every frame pixel one device pixel
export function fitView(frame: Size, stage: Size, zoom: Zoom, dpr = 1, margin = STAGE_MARGIN): View {
  if (frame.width <= 0 || frame.height <= 0 || stage.width <= 0 || stage.height <= 0) {
    return { x: 0, y: 0, w: 0, h: 0, scale: 1, contentW: Math.max(0, stage.width), contentH: Math.max(0, stage.height) };
  }
  let scale: number;
  if (zoom === 'actual') {
    scale = 1 / (dpr > 0 ? dpr : 1);
  } else {
    const room = { w: Math.max(1, stage.width - 2 * margin), h: Math.max(1, stage.height - 2 * margin) };
    scale = Math.min(room.w / frame.width, room.h / frame.height);
  }
  const w = frame.width * scale;
  const h = frame.height * scale;
  const contentW = Math.max(stage.width, w + 2 * margin);
  const contentH = Math.max(stage.height, h + 2 * margin);
  return { x: Math.round((contentW - w) / 2), y: Math.round((contentH - h) / 2), w, h, scale, contentW, contentH };
}

// a point given in css pixels from the top left of the frame box, in frame pixels
export function framePoint(view: View, px: number, py: number): Point {
  return { x: px / view.scale, y: py / view.scale };
}

// the whole pixel under a point of the frame, null outside it
export function pixelUnder(p: Point, frame: Size): Point | null {
  const x = Math.floor(p.x);
  const y = Math.floor(p.y);
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return null;
  return { x, y };
}

// the loupe sits below right of the pointer and flips to the other side where the stage ends
export function loupeSpot(pointer: Point, box: { w: number; h: number }, bounds: { w: number; h: number }, gap = 18): Point {
  const pad = 4;
  let x = pointer.x + gap;
  let y = pointer.y + gap;
  if (x + box.w > bounds.w - pad) x = pointer.x - gap - box.w;
  if (y + box.h > bounds.h - pad) y = pointer.y - gap - box.h;
  x = Math.max(pad, Math.min(x, bounds.w - box.w - pad));
  y = Math.max(pad, Math.min(y, bounds.h - box.h - pad));
  return { x: Math.round(x), y: Math.round(y) };
}
