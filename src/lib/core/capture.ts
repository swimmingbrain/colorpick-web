import type { Rect } from './types';

export type { Rect } from './types';

// reading the shared screen: the newest frame of a track processor drawn 1:1 into a gpu backed canvas, with
// image capture and a hidden video element behind it when the browser lacks one

export type ReadPath = 'processor' | 'imagecapture' | 'video';

export interface Share {
  readonly stream: MediaStream;
  readonly track: MediaStreamTrack;
  // size of the latest frame in pixels, the native monitor size unless the browser scales
  readonly width: number;
  readonly height: number;
  // the read path in use, it moves to a fallback when one fails
  readonly path: ReadPath;
  readonly ended: boolean;
  // called once, when the user stops sharing or after stop
  onended: (() => void) | null;
  stop(): void;
}

export interface ShareOptions {
  surface?: 'monitor' | 'window' | 'browser';
  frameRate?: number;
}

export interface GrabOptions {
  // wait for a frame that arrives after the call, for example right after the page drew the card
  fresh?: boolean;
  timeoutMs?: number;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Source = CanvasImageSource | VideoFrame;

interface ProcessorCtor {
  new (init: { track: MediaStreamTrack; maxBufferSize?: number }): { readable: ReadableStream<VideoFrame> };
}

interface GrabbingCapture {
  grabFrame(): Promise<ImageBitmap>;
}

// everything the module takes from the browser, the tests hand in their own
export interface CaptureEnv {
  getDisplayMedia(c: DisplayMediaStreamOptions): Promise<MediaStream>;
  Processor?: ProcessorCtor;
  ImageCapture?: new (track: MediaStreamTrack) => GrabbingCapture;
  context(w: number, h: number): Ctx;
  video(stream: MediaStream): HTMLVideoElement | null;
  screen: { width: number; height: number; dpr: number };
}

// the dom library has neither the track processor nor image capture, chromium has both
interface CaptureGlobals {
  MediaStreamTrackProcessor?: ProcessorCtor;
  ImageCapture?: new (t: MediaStreamTrack) => GrabbingCapture;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function browserEnv(): CaptureEnv {
  const g = globalThis as unknown as CaptureGlobals;
  const IC = g.ImageCapture && 'grabFrame' in g.ImageCapture.prototype ? g.ImageCapture : undefined;
  return {
    getDisplayMedia: (c) => navigator.mediaDevices.getDisplayMedia(c),
    Processor: g.MediaStreamTrackProcessor,
    ImageCapture: IC,
    // a gpu backed canvas, its yuv conversion matched the screen best in every measured case
    context: (w, h) => {
      const opts: CanvasRenderingContext2DSettings = { willReadFrequently: false, colorSpace: 'srgb' };
      let c: Ctx | null;
      if (typeof document !== 'undefined') {
        const el = document.createElement('canvas');
        el.width = w;
        el.height = h;
        c = el.getContext('2d', opts);
      } else {
        c = new OffscreenCanvas(w, h).getContext('2d', opts);
      }
      if (!c) throw new Error('no 2d canvas');
      c.imageSmoothingEnabled = false;
      return c;
    },
    video: (stream) => {
      if (typeof document === 'undefined') return null;
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none';
      v.srcObject = stream;
      document.body.append(v);
      void v.play().catch(() => undefined);
      return v;
    },
    screen: { width: screen.width, height: screen.height, dpr: devicePixelRatio || 1 }
  };
}

// the monitor at its native size, the cursor off where the browser honors it, a low frame rate
export function shareConstraints(o: ShareOptions, s: CaptureEnv['screen']): DisplayMediaStreamOptions {
  const fps = o.frameRate ?? 5;
  const video = {
    displaySurface: o.surface ?? 'monitor',
    cursor: 'never',
    width: { ideal: Math.round(s.width * s.dpr) },
    height: { ideal: Math.round(s.height * s.dpr) },
    frameRate: { ideal: fps, max: Math.max(15, fps) }
  } as MediaTrackConstraints;
  // the dom library knows only audio and video, chromium reads the rest
  return {
    video,
    audio: false,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'exclude',
    monitorTypeSurfaces: 'include'
  } as DisplayMediaStreamOptions;
}

// a whole pixel rectangle inside the frame, or null when nothing is left
export function clampRect(r: Rect, w: number, h: number): Rect | null {
  if (![r.x, r.y, r.w, r.h].every(Number.isFinite)) return null;
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(w, Math.ceil(r.x + r.w));
  const y1 = Math.min(h, Math.ceil(r.y + r.h));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

const ORDER: ReadPath[] = ['processor', 'imagecapture', 'video'];

class ScreenShare implements Share {
  readonly stream: MediaStream;
  readonly track: MediaStreamTrack;
  path: ReadPath;
  ended = false;
  onended: (() => void) | null = null;
  width: number;
  height: number;
  private latest: VideoFrame | null = null;
  private count = 0;
  private waiters: Array<() => void> = [];
  private pumpTrack: MediaStreamTrack | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private contexts = new Map<string, Ctx>();

  constructor(
    private env: CaptureEnv,
    stream: MediaStream
  ) {
    this.stream = stream;
    this.track = stream.getVideoTracks()[0];
    const s = this.track.getSettings();
    this.width = s.width ?? 0;
    this.height = s.height ?? 0;
    this.path = env.Processor ? 'processor' : env.ImageCapture ? 'imagecapture' : 'video';
    this.track.addEventListener('ended', () => this.finish());
    if (this.path === 'processor') this.pump();
  }

  // only the newest frame is kept, the one before is closed so the capturer never runs out of buffers
  private pump() {
    const P = this.env.Processor!;
    this.pumpTrack = this.track.clone();
    const reader = new P({ track: this.pumpTrack }).readable.getReader();
    void (async () => {
      for (;;) {
        let r: ReadableStreamReadResult<VideoFrame>;
        try {
          r = await reader.read();
        } catch {
          break;
        }
        if (r.done || !r.value) break;
        if (this.ended) {
          r.value.close();
          break;
        }
        this.latest?.close();
        this.latest = r.value;
        this.width = r.value.displayWidth;
        this.height = r.value.displayHeight;
        this.count++;
        for (const w of this.waiters.splice(0)) w();
      }
    })();
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.latest?.close();
    this.latest = null;
    this.pumpTrack?.stop();
    this.videoEl?.remove();
    for (const w of this.waiters.splice(0)) w();
    this.onended?.();
  }

  stop() {
    this.stream.getTracks().forEach((t) => t.stop());
    this.finish();
  }

  private context(key: string, w: number, h: number): Ctx {
    let c = this.contexts.get(key);
    if (!c || c.canvas.width !== w || c.canvas.height !== h) {
      c = this.env.context(w, h);
      this.contexts.set(key, c);
    }
    return c;
  }

  private async frame(o: GrabOptions): Promise<VideoFrame> {
    const timeout = o.timeoutMs ?? 1500;
    const seen = this.count;
    const ready = () => (o.fresh ? this.count > seen : this.count > 0);
    if (!ready()) await Promise.race([new Promise<void>((r) => this.waiters.push(r)), sleep(timeout)]);
    // a static screen sends no new frames, then the latest one is still current
    if (!this.latest) throw new Error('no frame from the track processor');
    return this.latest;
  }

  private async videoReady(timeout: number): Promise<HTMLVideoElement> {
    if (!this.videoEl) this.videoEl = this.env.video(this.stream);
    const v = this.videoEl;
    if (!v) throw new Error('no video element');
    const t0 = Date.now();
    while (v.readyState < 2 || !v.videoWidth) {
      if (Date.now() - t0 > timeout) throw new Error('the video element shows no frames');
      await sleep(30);
    }
    return v;
  }

  // the whole frame, or the rectangle of it, through one read path
  private async read(path: ReadPath, rect: Rect | null, o: GrabOptions): Promise<ImageData> {
    const timeout = o.timeoutMs ?? 1500;
    const draw = (src: Source, w: number, h: number) => {
      const r = rect ? clampRect(rect, w, h) : { x: 0, y: 0, w, h };
      if (!r) throw new Error('the rectangle lies outside the frame');
      const c = this.context(rect ? 'region' : 'frame', r.w, r.h);
      c.drawImage(src as CanvasImageSource, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      return c.getImageData(0, 0, r.w, r.h, { colorSpace: 'srgb' });
    };
    if (path === 'processor') {
      if (!this.env.Processor) throw new Error('no track processor');
      const f = await this.frame(o);
      return draw(f, f.displayWidth, f.displayHeight);
    }
    if (path === 'imagecapture') {
      if (!this.env.ImageCapture) throw new Error('no image capture');
      const bmp = await new this.env.ImageCapture(this.track).grabFrame();
      try {
        return draw(bmp, bmp.width, bmp.height);
      } finally {
        bmp.close();
      }
    }
    const v = await this.videoReady(timeout);
    if (o.fresh && 'requestVideoFrameCallback' in v) {
      await Promise.race([new Promise<void>((r) => v.requestVideoFrameCallback(() => r())), sleep(timeout)]);
    }
    return draw(v, v.videoWidth, v.videoHeight);
  }

  async grab(rect: Rect | null, o: GrabOptions): Promise<ImageData> {
    if (this.ended) throw new Error('the screen share has ended');
    let last: unknown = null;
    for (const path of ORDER.slice(ORDER.indexOf(this.path))) {
      try {
        const img = await this.read(path, rect, o);
        if (path !== this.path) this.path = path;
        return img;
      } catch (e) {
        if (this.ended) throw new Error('the screen share has ended');
        last = e;
      }
    }
    throw last instanceof Error ? last : new Error('no read path delivered a frame');
  }
}

export async function startShare(options: ShareOptions = {}, env: CaptureEnv = browserEnv()): Promise<Share> {
  const stream = await env.getDisplayMedia(shareConstraints(options, env.screen));
  if (!stream.getVideoTracks()[0]) throw new Error('the share has no video track');
  return new ScreenShare(env, stream);
}

function impl(share: Share): ScreenShare {
  if (!(share instanceof ScreenShare)) throw new Error('not a share from startShare');
  return share;
}

// the whole frame as srgb pixels through the best read path there is
export async function grabFrame(share: Share, options: GrabOptions = {}): Promise<ImageData> {
  return impl(share).grab(null, options);
}

// a rectangle of the frame in frame pixels, clamped to the frame
export async function grabRegion(share: Share, rect: Rect, options: GrabOptions = {}): Promise<ImageData> {
  return impl(share).grab(rect, options);
}
