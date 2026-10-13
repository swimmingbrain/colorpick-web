import { describe, expect, it } from 'vitest';
import { clampRect, grabFrame, grabRegion, shareConstraints, startShare, type CaptureEnv } from './capture';

interface Draw {
  src: unknown;
  args: number[];
}

class FakeTrack extends EventTarget {
  stopped = false;
  clones: FakeTrack[] = [];
  constructor(private settings: MediaTrackSettings) {
    super();
  }
  getSettings() {
    return this.settings;
  }
  clone() {
    const t = new FakeTrack(this.settings);
    this.clones.push(t);
    return t;
  }
  stop() {
    this.stopped = true;
  }
  end() {
    this.dispatchEvent(new Event('ended'));
  }
}

function fakeFrame(w: number, h: number, id: number) {
  return {
    displayWidth: w,
    displayHeight: h,
    id,
    closed: false,
    close() {
      this.closed = true;
    }
  };
}

type FakeFrame = ReturnType<typeof fakeFrame>;

// a stand in for the browser: the test pushes the frames, every draw is written down
function fakeEnv(o: { processor?: boolean; imageCapture?: boolean; video?: boolean } = {}) {
  const track = new FakeTrack({ width: 1920, height: 1080, displaySurface: 'monitor' });
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
  const draws: Draw[] = [];
  const requests: DisplayMediaStreamOptions[] = [];
  let push: (f: FakeFrame) => void = () => undefined;
  const video = { readyState: 4, videoWidth: 1920, videoHeight: 1080, remove() {} } as unknown as HTMLVideoElement;
  const env: CaptureEnv = {
    getDisplayMedia: async (c) => {
      requests.push(c);
      return stream;
    },
    screen: { width: 1536, height: 864, dpr: 1.25 },
    context: (w, h) =>
      ({
        canvas: { width: w, height: h },
        imageSmoothingEnabled: true,
        drawImage: (src: unknown, ...args: number[]) => {
          draws.push({ src, args });
        },
        getImageData: (x: number, y: number, gw: number, gh: number) => ({
          data: new Uint8ClampedArray(gw * gh * 4),
          width: gw,
          height: gh,
          colorSpace: 'srgb'
        })
      }) as unknown as CanvasRenderingContext2D,
    video: () => (o.video === false ? null : video)
  };
  if (o.processor !== false) {
    env.Processor = class {
      readable = new ReadableStream<VideoFrame>({
        start: (c) => {
          push = (f) => c.enqueue(f as unknown as VideoFrame);
        }
      });
      constructor(public init: { track: MediaStreamTrack }) {}
    };
  }
  if (o.imageCapture) {
    env.ImageCapture = class {
      async grabFrame() {
        return { width: 1920, height: 1080, close() {} } as unknown as ImageBitmap;
      }
    };
  }
  return { env, track, draws, requests, push: (f: FakeFrame) => push(f) };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const drawn = (d: Draw) => (d.src as { id: number }).id;

describe('shareConstraints', () => {
  it('asks for the monitor at native pixels, the cursor off and a low frame rate', () => {
    const c = shareConstraints({}, { width: 1536, height: 864, dpr: 1.25 });
    const v = c.video as MediaTrackConstraints & { cursor: string };
    expect(v.displaySurface).toBe('monitor');
    expect(v.cursor).toBe('never');
    expect(v.width).toEqual({ ideal: 1920 });
    expect(v.height).toEqual({ ideal: 1080 });
    expect(v.frameRate).toEqual({ ideal: 5, max: 15 });
    expect(c.audio).toBe(false);
  });

  it('takes another surface and frame rate', () => {
    const c = shareConstraints({ surface: 'browser', frameRate: 30 }, { width: 800, height: 600, dpr: 1 });
    const v = c.video as MediaTrackConstraints;
    expect(v.displaySurface).toBe('browser');
    expect(v.frameRate).toEqual({ ideal: 30, max: 30 });
  });
});

describe('clampRect', () => {
  it('snaps to whole pixels inside the frame', () => {
    expect(clampRect({ x: -5.5, y: 10.2, w: 20, h: 5.1 }, 100, 50)).toEqual({ x: 0, y: 10, w: 15, h: 6 });
    expect(clampRect({ x: 90, y: 40, w: 50, h: 50 }, 100, 50)).toEqual({ x: 90, y: 40, w: 10, h: 10 });
  });

  it('returns null when nothing is left', () => {
    expect(clampRect({ x: 200, y: 0, w: 10, h: 10 }, 100, 50)).toBeNull();
    expect(clampRect({ x: 0, y: 0, w: Number.NaN, h: 10 }, 100, 50)).toBeNull();
  });
});

describe('startShare and grabFrame', () => {
  it('reads the latest track processor frame into a full size image', async () => {
    const f = fakeEnv();
    const share = await startShare({}, f.env);
    expect(share.path).toBe('processor');
    expect(f.requests).toHaveLength(1);
    f.push(fakeFrame(1920, 1080, 1));
    f.push(fakeFrame(1920, 1080, 2));
    await tick();
    const img = await grabFrame(share);
    expect([img.width, img.height]).toEqual([1920, 1080]);
    expect(drawn(f.draws[0])).toBe(2);
    expect(f.draws[0].args).toEqual([0, 0, 1920, 1080, 0, 0, 1920, 1080]);
    expect([share.width, share.height]).toEqual([1920, 1080]);
  });

  it('closes the frames it no longer needs', async () => {
    const f = fakeEnv();
    const share = await startShare({}, f.env);
    const a = fakeFrame(10, 10, 1);
    const b = fakeFrame(10, 10, 2);
    f.push(a);
    f.push(b);
    await tick();
    expect(a.closed).toBe(true);
    expect(b.closed).toBe(false);
    share.stop();
    expect(b.closed).toBe(true);
    expect(f.track.stopped).toBe(true);
    expect(f.track.clones[0].stopped).toBe(true);
  });

  it('waits for a newer frame when asked for a fresh one', async () => {
    const f = fakeEnv();
    const share = await startShare({}, f.env);
    f.push(fakeFrame(800, 600, 1));
    await tick();
    const pending = grabFrame(share, { fresh: true, timeoutMs: 1000 });
    await tick();
    expect(f.draws).toHaveLength(0);
    f.push(fakeFrame(800, 600, 2));
    await pending;
    expect(drawn(f.draws[0])).toBe(2);
  });

  it('uses the latest frame of a static screen after the fresh timeout', async () => {
    const f = fakeEnv();
    const share = await startShare({}, f.env);
    f.push(fakeFrame(800, 600, 7));
    await tick();
    await grabFrame(share, { fresh: true, timeoutMs: 30 });
    expect(drawn(f.draws[0])).toBe(7);
  });

  it('falls back to image capture when the processor gives nothing', async () => {
    const f = fakeEnv({ imageCapture: true });
    const share = await startShare({}, f.env);
    const img = await grabFrame(share, { timeoutMs: 20 });
    expect(img.width).toBe(1920);
    expect(share.path).toBe('imagecapture');
  });

  it('starts on image capture without a processor and on the video element without both', async () => {
    const a = fakeEnv({ processor: false, imageCapture: true });
    expect((await startShare({}, a.env)).path).toBe('imagecapture');
    const b = fakeEnv({ processor: false });
    const share = await startShare({}, b.env);
    expect(share.path).toBe('video');
    const img = await grabFrame(share);
    expect([img.width, img.height]).toEqual([1920, 1080]);
  });

  it('rejects when no read path works', async () => {
    const f = fakeEnv({ processor: false, video: false });
    const share = await startShare({}, f.env);
    await expect(grabFrame(share, { timeoutMs: 20 })).rejects.toThrow();
  });
});

describe('grabRegion', () => {
  it('draws only the clamped rectangle', async () => {
    const f = fakeEnv();
    const share = await startShare({}, f.env);
    f.push(fakeFrame(1920, 1080, 1));
    await tick();
    const img = await grabRegion(share, { x: 1900.4, y: 1000, w: 100, h: 50 });
    expect([img.width, img.height]).toEqual([20, 50]);
    expect(f.draws[0].args).toEqual([1900, 1000, 20, 50, 0, 0, 20, 50]);
  });

  it('rejects a rectangle outside the frame', async () => {
    const f = fakeEnv({ video: false });
    const share = await startShare({}, f.env);
    f.push(fakeFrame(100, 100, 1));
    await tick();
    await expect(grabRegion(share, { x: 500, y: 500, w: 10, h: 10 }, { timeoutMs: 20 })).rejects.toThrow();
  });
});

describe('the end of a share', () => {
  it('calls onended once when the user stops sharing and refuses further grabs', async () => {
    const f = fakeEnv();
    const share = await startShare({}, f.env);
    let calls = 0;
    share.onended = () => {
      calls++;
    };
    f.track.end();
    f.track.end();
    expect(calls).toBe(1);
    expect(share.ended).toBe(true);
    await expect(grabFrame(share)).rejects.toThrow(/ended/);
  });

  it('refuses shares it did not create', async () => {
    await expect(grabFrame({} as never)).rejects.toThrow(/startShare/);
  });
});
