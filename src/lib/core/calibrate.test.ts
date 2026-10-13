import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_KEY,
  CARD,
  applyCalibration,
  buildCard,
  cardDifference,
  cardLayout,
  correctPixel,
  fitCalibration,
  fromJSON,
  fromLinear,
  loadCalibration,
  locateCard,
  sampleCard,
  saveCalibration,
  toJSON,
  toLinear,
  type Calibration,
  type CardRect
} from './calibrate';
import { parseHex } from './color';

type Triple = [number, number, number];

interface Render {
  w: number;
  h: number;
  scale: number;
  x: number;
  y: number;
  show?: (c: Triple) => Triple;
  bg?: (x: number, y: number) => Triple;
}

// the card at css resolution, every box sits on whole css pixels
const CSS = (() => {
  const l = cardLayout();
  const map = new Uint8ClampedArray(l.width * l.height * 3).fill(255);
  const paint = (b: { x: number; y: number; w: number; h: number; color: string }) => {
    const c = parseHex(b.color)!;
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) map.set([c.r, c.g, c.b], (y * l.width + x) * 3);
    }
  };
  paint(l.inner);
  l.dark.forEach(paint);
  l.patches.forEach(paint);
  return map;
})();

// the card drawn into a frame at a scale and an offset, nearest sampling, through a color transform
function render(o: Render) {
  const data = new Uint8ClampedArray(o.w * o.h * 4);
  const cache = new Map<number, Triple>();
  const show = (c: Triple) => {
    if (!o.show) return c;
    const key = (c[0] << 16) | (c[1] << 8) | c[2];
    let v = cache.get(key);
    if (!v) {
      v = o.show(c);
      cache.set(key, v);
    }
    return v;
  };
  for (let y = 0; y < o.h; y++) {
    for (let x = 0; x < o.w; x++) {
      const u = Math.floor((x + 0.5 - o.x) / o.scale);
      const v = Math.floor((y + 0.5 - o.y) / o.scale);
      let c: Triple;
      if (u >= 0 && v >= 0 && u < CARD.width && v < CARD.height) {
        const k = (v * CARD.width + u) * 3;
        c = show([CSS[k], CSS[k + 1], CSS[k + 2]]);
      } else {
        c = o.bg ? o.bg(x, y) : [40, 44, 52];
      }
      data.set([c[0], c[1], c[2], 255], (y * o.w + x) * 4);
    }
  }
  return { data, width: o.w, height: o.h };
}

function near(r: CardRect | null, x: number, y: number, scale: number, tol = 0.6) {
  expect(r).not.toBeNull();
  const c = r!;
  expect(Math.abs(c.x - x)).toBeLessThanOrEqual(tol);
  expect(Math.abs(c.y - y)).toBeLessThanOrEqual(tol);
  expect(Math.abs(c.scaleX / scale - 1)).toBeLessThan(0.01);
  expect(Math.abs(c.scaleY / scale - 1)).toBeLessThan(0.01);
}

// a color managed browser on a monitor with other primaries, then a capture with a small bias
const SRGB_D50 = [0.4361, 0.3851, 0.1431, 0.2225, 0.7169, 0.0606, 0.0139, 0.0971, 0.7141];
const MONITOR = [0.4851, 0.3489, 0.1302, 0.2501, 0.6978, 0.0521, 0.0227, 0.1163, 0.6859];

function inv3(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const adj = [
    A, -(b * i - c * h), b * f - c * e,
    B, a * i - c * g, -(a * f - c * d),
    C, -(a * h - b * g), a * e - b * d
  ];
  return adj.map((v) => v / det);
}

function mul3(m: number[], v: Triple): Triple {
  return [0, 1, 2].map((r) => m[3 * r] * v[0] + m[3 * r + 1] * v[1] + m[3 * r + 2] * v[2]) as Triple;
}

const TO_MONITOR = (() => {
  const a = inv3(MONITOR);
  const at = (r: number, c: number) =>
    a[3 * r] * SRGB_D50[c] + a[3 * r + 1] * SRGB_D50[3 + c] + a[3 * r + 2] * SRGB_D50[6 + c];
  return [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => at(r, c)));
})();

const BIAS = [-0.6, 0.4, -0.5];
const linear = (c: Triple) => c.map(toLinear) as Triple;
const monitor = (c: Triple) => mul3(TO_MONITOR, linear(c)).map((l) => Math.round(fromLinear(l))) as Triple;
const captured = (c: Triple) => monitor(c).map((v, i) => Math.min(255, Math.max(0, Math.round(v + BIAS[i])))) as Triple;
const inGamut = (c: Triple) => mul3(TO_MONITOR, linear(c)).every((l) => l >= -1e-3 && l <= 1.001);

function noise(f: { data: Uint8ClampedArray; width: number }, r: { x: number; y: number; w: number; h: number }) {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) f.data.set([(x * 37) & 255, (y * 91) & 255, 0], (y * f.width + x) * 4);
  }
}

describe('the card', () => {
  it('has whole checker cells and 40 fit plus 16 hold out patches', () => {
    expect(CARD.width % CARD.cell).toBe(0);
    expect(CARD.height % CARD.cell).toBe(0);
    expect(CARD.patches).toHaveLength(CARD.cols * CARD.rows);
    expect(CARD.patches.filter((p) => p.fit)).toHaveLength(40);
    expect(CARD.patches.filter((p) => !p.fit)).toHaveLength(16);
    expect(new Set(CARD.patches.map((p) => p.hex)).size).toBe(CARD.patches.length);
  });

  it('keeps every patch inside the gray field, clear of the ring', () => {
    const l = cardLayout();
    expect([l.width, l.height]).toEqual([360, 320]);
    for (const p of l.patches) {
      expect(p.x).toBeGreaterThanOrEqual(l.inner.x + CARD.margin);
      expect(p.y).toBeGreaterThanOrEqual(l.inner.y + CARD.margin);
      expect(p.x + p.w).toBeLessThanOrEqual(l.inner.x + l.inner.w - CARD.margin);
      expect(p.y + p.h).toBeLessThanOrEqual(l.inner.y + l.inner.h - CARD.margin);
    }
    expect(l.dark[0]).toMatchObject({ x: 0, y: 0, w: CARD.cell, h: CARD.cell });
  });

  it('builds the same boxes as plain dom', () => {
    interface El {
      style: { cssText: string };
      children: El[];
      append(...c: El[]): void;
    }
    const doc = {
      createElement: (): El => ({
        style: { cssText: '' },
        children: [],
        append(...c: El[]) {
          this.children.push(...c);
        }
      })
    } as unknown as Document;
    const card = buildCard(doc) as unknown as El;
    const l = cardLayout();
    expect(card.children).toHaveLength(1 + l.dark.length + l.patches.length);
    expect(card.style.cssText).toContain(`width:${CARD.width}px`);
    expect(card.children.at(-1)?.style.cssText).toContain(`background:${l.patches.at(-1)?.color}`);
  });
});

describe('locateCard', () => {
  it('finds the card at scale 1 with sub pixel accuracy', () => {
    const f = render({ w: 900, h: 600, scale: 1, x: 211, y: 87 });
    near(locateCard(f, 1), 211, 87, 1, 0.1);
  });

  it('finds the card at fractional scales and offsets', () => {
    const cases = [
      [1.25, 333.5, 120.25],
      [1.5, 40.7, 300.2],
      [2, 13, 17]
    ];
    for (const [scale, x, y] of cases) {
      const f = render({
        w: Math.ceil(CARD.width * scale + 400),
        h: Math.ceil(CARD.height * scale + 380),
        scale,
        x,
        y
      });
      near(locateCard(f, scale), x, y, scale);
    }
  });

  it('tolerates a few percent of error in the expected scale', () => {
    const f = render({ w: 800, h: 600, scale: 1.25, x: 100, y: 50 });
    near(locateCard(f, 1.25 * 1.03), 100, 50, 1.25);
  });

  it('uses a hint and still finds the card without one', () => {
    const f = render({ w: 1200, h: 800, scale: 1, x: 700, y: 400 });
    near(locateCard(f, 1, { x: 690, y: 390, w: 380, h: 340 }), 700, 400, 1, 0.1);
    near(locateCard(f, 1, { x: 0, y: 0, w: 300, h: 300 }), 700, 400, 1, 0.1);
  });

  it('finds the card on a busy checkered background', () => {
    const bg = (x: number, y: number): Triple =>
      (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? [250, 250, 250] : [5, 5, 5];
    const f = render({ w: 900, h: 700, scale: 1, x: 300, y: 200, bg });
    near(locateCard(f, 1), 300, 200, 1, 0.1);
  });

  it('returns null when the card is cut off or missing', () => {
    expect(locateCard(render({ w: 600, h: 500, scale: 1, x: 300, y: 60 }), 1)).toBeNull();
    expect(locateCard(render({ w: 600, h: 500, scale: 1, x: 40, y: -20 }), 1)).toBeNull();
    expect(locateCard(render({ w: 600, h: 500, scale: 1, x: 5000, y: 5000 }), 1)).toBeNull();
  });

  it('returns null for the wrong scale', () => {
    expect(locateCard(render({ w: 1000, h: 800, scale: 2, x: 10, y: 10 }), 1)).toBeNull();
  });
});

describe('sampleCard', () => {
  it('reads the exact patch colors from a clean render', () => {
    const f = render({ w: 700, h: 500, scale: 1.25, x: 21.5, y: 33 });
    const s = sampleCard(f, locateCard(f, 1.25)!);
    for (const p of s) {
      expect(p.mean).toEqual([p.expected.r, p.expected.g, p.expected.b]);
      expect(Math.max(...p.std)).toBe(0);
      expect(p.n).toBeGreaterThan(200);
    }
  });
});

describe('cardDifference', () => {
  it('is zero for the same screen and large while the card fades in', () => {
    const at = { w: 600, h: 500, scale: 1, x: 50, y: 60 };
    const a = render({ ...at, show: captured });
    const b = render({ ...at, show: captured });
    const fading = render({ ...at, show: (c) => captured(c).map((v) => Math.round(v * 0.9 + 4)) as Triple });
    const rect = locateCard(a, 1)!;
    expect(cardDifference(a, b, rect)).toBe(0);
    expect(cardDifference(a, fading, rect)).toBeGreaterThan(10);
  });
});

describe('fitCalibration', () => {
  it('stays at identity for a perfect screen and capture', () => {
    const f = render({ w: 600, h: 500, scale: 1, x: 50, y: 60 });
    const cal = fitCalibration(f, locateCard(f, 1)!);
    expect(cal.residual).toEqual({ mean: 0, max: 0 });
    expect(cal.holdout).toEqual({ mean: 0, max: 0 });
    expect(cal.clipped).toEqual([]);
    for (let v = 0; v < 256; v += 17) expect(correctPixel(cal, v, 255 - v, v)).toEqual({ r: v, g: 255 - v, b: v });
  });

  it('undoes a color managed monitor for colors inside its gamut', () => {
    const f = render({ w: 700, h: 560, scale: 1.25, x: 80, y: 70, show: captured });
    const cal = fitCalibration(f, locateCard(f, 1.25)!);
    expect(cal.holdout.max).toBeLessThanOrEqual(2);
    expect(cal.residual.max).toBeLessThanOrEqual(3);
    expect(cal.clipped).toContain('#00FF00');
    let seed = 3;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return Math.floor((seed / 0x7fffffff) * 256);
    };
    let worst = 0;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 3000; i++) {
      const c: Triple = [rand(), rand(), rand()];
      if (!inGamut(c)) continue;
      const got = correctPixel(cal, ...captured(c));
      const e = Math.max(Math.abs(got.r - c[0]), Math.abs(got.g - c[1]), Math.abs(got.b - c[2]));
      worst = Math.max(worst, e);
      sum += e;
      n++;
    }
    const before = (c: Triple) => Math.max(...captured(c).map((v, k) => Math.abs(v - c[k])));
    expect(before([0, 255, 0])).toBeGreaterThan(60);
    expect(sum / n).toBeLessThan(1.6);
    expect(worst).toBeLessThanOrEqual(14);
  });

  it('keeps exact grays on the gray curves and fixes a tone curve between the knots', () => {
    // a display that darkens the mid tones the same way in every channel
    const tone = (c: Triple): Triple => c.map((v) => Math.round(255 * (v / 255) ** 1.15)) as Triple;
    const f = render({ w: 600, h: 500, scale: 1, x: 30, y: 30, show: tone });
    const cal = fitCalibration(f, locateCard(f, 1)!);
    expect(cal.curves[0].x.length).toBeGreaterThan(2);
    let worst = 0;
    for (let v = 0; v < 256; v++) {
      const [d] = tone([v, v, v]);
      const got = correctPixel(cal, d, d, d);
      expect(got.r === got.g && got.g === got.b).toBe(true);
      worst = Math.max(worst, Math.abs(got.r - v));
    }
    expect(worst).toBeLessThanOrEqual(3);
  });

  it('passes grays through unchanged when every gray patch is within one code', () => {
    const f = render({ w: 600, h: 500, scale: 1, x: 30, y: 30, show: captured });
    const cal = fitCalibration(f, locateCard(f, 1)!);
    expect(cal.curves.every((c) => c.x.every((x, i) => Math.abs(x - c.y[i]) <= 1))).toBe(true);
    for (let v = 0; v < 256; v++) expect(correctPixel(cal, v, v, v)).toEqual({ r: v, g: v, b: v });
  });

  it('refuses a card seen through a dimming overlay', () => {
    const dim = (c: Triple) => c.map((v) => Math.round(v * 0.4)) as Triple;
    const f = render({ w: 600, h: 500, scale: 1, x: 30, y: 30, show: dim });
    const rect = locateCard(f, 1);
    expect(rect).not.toBeNull();
    expect(() => fitCalibration(f, rect!)).toThrow(/dimmed/);
  });

  it('skips patches covered by something and fails when too few are left', () => {
    const f = render({ w: 600, h: 500, scale: 1, x: 50, y: 60 });
    const rect = locateCard(f, 1)!;
    const s = sampleCard(f, rect);
    // a cursor sized blob of noise over one patch
    noise(f, { ...s[13].region, w: 8, h: 8 });
    expect(fitCalibration(f, rect).residual.max).toBe(0);
    for (const p of s.slice(0, 30)) noise(f, p.region);
    expect(() => fitCalibration(f, rect)).toThrow(/clean fit patches/);
  });
});

describe('applying a calibration', () => {
  const f = render({ w: 700, h: 560, scale: 1, x: 40, y: 40, show: captured });
  const cal = fitCalibration(f, locateCard(f, 1)!);

  it('gives the same pixels as correctPixel and leaves alpha alone', () => {
    const data = new Uint8ClampedArray(256 * 4 * 3);
    for (let i = 0; i < 768; i++) data.set([i & 255, (i * 7) & 255, (i * 13) & 255, i % 200], i * 4);
    const copy = data.slice();
    applyCalibration(cal, data);
    for (let i = 0; i < 768; i++) {
      const want = correctPixel(cal, copy[i * 4], copy[i * 4 + 1], copy[i * 4 + 2]);
      expect([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]).toEqual([want.r, want.g, want.b]);
      expect(data[i * 4 + 3]).toBe(copy[i * 4 + 3]);
    }
  });

  it('rounds exactly like the srgb formula', () => {
    const curves = [0, 1, 2].map(() => ({ x: [0, 255], y: [0, 255] })) as Calibration['curves'];
    const identity: Calibration = { ...cal, curves, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0] };
    for (let v = 0; v < 256; v++) expect(correctPixel(identity, v, v, v)).toEqual({ r: v, g: v, b: v });
    for (let v = 0; v < 256; v++) expect(correctPixel(identity, v, 255 - v, 7)).toEqual({ r: v, g: 255 - v, b: 7 });
    const half: Calibration = { ...identity, matrix: [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0] };
    for (let v = 0; v < 256; v++) {
      expect(correctPixel(half, v, 0, 0).r).toBe(Math.round(fromLinear(0.5 * toLinear(v))));
    }
  });

  it('clamps out of range inputs', () => {
    expect(correctPixel(cal, -20, 300, 128.4)).toEqual(correctPixel(cal, 0, 255, 128));
  });
});

describe('json', () => {
  const f = render({ w: 600, h: 500, scale: 1, x: 30, y: 30, show: captured });
  const cal = fitCalibration(f, locateCard(f, 1)!);

  it('round trips through a string', () => {
    const back = fromJSON(toJSON(cal));
    expect(back).toEqual(cal);
    expect(correctPixel(back!, 12, 200, 99)).toEqual(correctPixel(cal, 12, 200, 99));
  });

  it('accepts an object parsed already', () => {
    expect(fromJSON(JSON.parse(toJSON(cal)))).toEqual(cal);
  });

  it('rejects anything else', () => {
    const plain = JSON.parse(toJSON(cal));
    const backwards = { x: [0, 200, 100], y: [0, 100, 255] };
    expect(fromJSON('not json')).toBeNull();
    expect(fromJSON(null)).toBeNull();
    expect(fromJSON({ ...plain, version: 2 })).toBeNull();
    expect(fromJSON({ ...plain, matrix: plain.matrix.slice(1) })).toBeNull();
    expect(fromJSON({ ...plain, matrix: [...plain.matrix.slice(1), 'x'] })).toBeNull();
    expect(fromJSON({ ...plain, curves: [plain.curves[0], plain.curves[1], backwards] })).toBeNull();
    expect(fromJSON({ ...plain, frame: { w: 0, h: 10 } })).toBeNull();
    expect(fromJSON({ ...plain, at: 'yesterday' })).toBeNull();
    expect(fromJSON({ ...plain, clipped: ['red'] })).toBeNull();
  });
});

describe('the stored calibration', () => {
  const f = render({ w: 600, h: 500, scale: 1, x: 30, y: 30, show: captured });
  const cal = fitCalibration(f, locateCard(f, 1)!);

  function memory() {
    const items = new Map<string, string>();
    return {
      items,
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key)
    };
  }

  it('comes back the same and corrects the same', () => {
    const storage = memory();
    saveCalibration(storage, cal);
    expect(storage.items.has(CALIBRATION_KEY)).toBe(true);
    const back = loadCalibration(storage);
    expect(back).toEqual(cal);
    expect(correctPixel(back!, 40, 180, 90)).toEqual(correctPixel(cal, 40, 180, 90));
  });

  it('is gone after a remove', () => {
    const storage = memory();
    saveCalibration(storage, cal);
    saveCalibration(storage, null);
    expect(storage.items.size).toBe(0);
    expect(loadCalibration(storage)).toBeNull();
  });

  it('gives nothing for a broken entry, a full storage or no storage at all', () => {
    const storage = memory();
    storage.items.set(CALIBRATION_KEY, '{"version": 1');
    expect(loadCalibration(storage)).toBeNull();
    storage.items.set(CALIBRATION_KEY, JSON.stringify({ ...cal, version: 2 }));
    expect(loadCalibration(storage)).toBeNull();
    expect(loadCalibration(null)).toBeNull();
    const full = {
      ...memory(),
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      }
    };
    expect(() => saveCalibration(full, cal)).not.toThrow();
    const blocked = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      }
    };
    expect(loadCalibration(blocked)).toBeNull();
  });
});
