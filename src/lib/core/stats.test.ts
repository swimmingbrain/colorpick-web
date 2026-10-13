import { describe, expect, it } from 'vitest';
import { CHANNELS, analyze, fromPlain, toPlain, type Channel } from './stats';

type Pixel = [number, number, number, number?];

function image(w: number, h: number, px: (i: number) => Pixel) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b, a = 255] = px(i);
    data.set([r, g, b, a], i * 4);
  }
  return { data, width: w, height: h };
}

let seed = 7;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

const byte = () => Math.floor(rand() * 256);

// a plain reference with sorted arrays instead of histograms
function reference(img: { data: Uint8ClampedArray; width: number; height: number }) {
  const n = img.width * img.height;
  const rgbAt = (i: number) => [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]];
  const vals: Record<Channel, number[]> = { r: [], g: [], b: [], gray: [] };
  for (let i = 0; i < n; i++) {
    const [r, g, b] = rgbAt(i);
    vals.r.push(r);
    vals.g.push(g);
    vals.b.push(b);
    vals.gray.push(Math.round(0.299 * r + 0.587 * g + 0.114 * b));
  }
  const blank = () => ({ r: 0, g: 0, b: 0, gray: 0 });
  const out = { mean: blank(), median: blank(), std: blank(), min: blank(), max: blank() };
  for (const k of CHANNELS) {
    const v = [...vals[k]].sort((a, b) => a - b);
    const mean = v.reduce((s, x) => s + x, 0) / n;
    out.mean[k] = Math.round(mean);
    out.median[k] = v[Math.ceil(n / 2) - 1];
    out.std[k] = Math.round(Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / n) * 10) / 10;
    out.min[k] = v[0];
    out.max[k] = v[n - 1];
  }
  const bins = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const [r, g, b] = rgbAt(i);
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key)!.push(i);
  }
  let best = -1;
  let bestN = 0;
  for (const [key, list] of bins) {
    if (list.length > bestN || (list.length === bestN && key < best)) {
      best = key;
      bestN = list.length;
    }
  }
  const low = (c: number) => Math.round(bins.get(best)!.reduce((s, i) => s + (img.data[i * 4 + c] & 7), 0) / bestN);
  const dominant = {
    r: ((best >> 10) << 3) + low(0),
    g: (((best >> 5) & 31) << 3) + low(1),
    b: ((best & 31) << 3) + low(2)
  };
  return { ...out, dominant, hist: vals };
}

describe('analyze', () => {
  it('returns exact values for a flat image', () => {
    const s = analyze(image(7, 5, () => [10, 20, 30]));
    expect(s.count).toBe(35);
    expect(s.mean).toEqual({ r: 10, g: 20, b: 30, gray: 18 });
    expect(s.median).toEqual({ r: 10, g: 20, b: 30, gray: 18 });
    expect(s.std).toEqual({ r: 0, g: 0, b: 0, gray: 0 });
    expect(s.min).toEqual(s.max);
    expect(s.dominant).toEqual({ r: 10, g: 20, b: 30 });
    expect(s.hist.r[10]).toBe(35);
    expect(s.hist.gray[18]).toBe(35);
  });

  it('takes the lower median and rounds the mean of a black and white split', () => {
    const s = analyze(image(4, 2, (i) => (i < 4 ? [0, 0, 0] : [255, 255, 255])));
    expect(s.mean.r).toBe(128);
    expect(s.median.r).toBe(0);
    expect(s.std.r).toBe(127.5);
    expect(s.min.gray).toBe(0);
    expect(s.max.gray).toBe(255);
  });

  it('matches the closed form for a full ramp', () => {
    const s = analyze(image(256, 1, (i) => [i, 255 - i, 128]));
    expect(s.mean.r).toBe(128);
    expect(s.median.r).toBe(127);
    expect(s.std.r).toBe(Math.round(Math.sqrt((256 * 256 - 1) / 12) * 10) / 10);
    expect(s.std.b).toBe(0);
    expect(Array.from(s.hist.r).every((n) => n === 1)).toBe(true);
  });

  it('agrees with a brute force reference on random pixels', () => {
    for (let round = 0; round < 5; round++) {
      const w = 37 + round * 11;
      const h = 23 + round * 5;
      // a few repeated colors so the dominant bin is unique
      const img = image(w, h, (i) => (i % 5 === 0 ? [200, 100, 50] : [byte(), byte(), byte()]));
      const s = analyze(img);
      const ref = reference(img);
      expect(s.mean).toEqual(ref.mean);
      expect(s.median).toEqual(ref.median);
      expect(s.std).toEqual(ref.std);
      expect(s.min).toEqual(ref.min);
      expect(s.max).toEqual(ref.max);
      expect(s.dominant).toEqual(ref.dominant);
      for (const k of CHANNELS) {
        const counts = new Array(256).fill(0);
        for (const v of ref.hist[k]) counts[v]++;
        expect(Array.from(s.hist[k])).toEqual(counts);
      }
    }
  });

  it('refines the dominant color inside its 5 bit bin', () => {
    // 6 pixels in bin (8, 8, 8) with low bits 1, 2 and 3, 4 pixels elsewhere
    const s = analyze(
      image(10, 1, (i) => (i < 2 ? [65, 66, 67] : i < 4 ? [66, 67, 68] : i < 6 ? [67, 68, 69] : [200, 10, 10]))
    );
    expect(s.dominant).toEqual({ r: 66, g: 67, b: 68 });
  });

  it('ignores alpha and bytes past width times height', () => {
    const img = image(2, 2, (i) => [i * 10, 0, 0, i * 60]);
    const longer = { data: new Uint8ClampedArray([...img.data, 255, 255, 255, 255]), width: 2, height: 2 };
    expect(analyze(longer).hist.r[255]).toBe(0);
    expect(analyze(longer).mean).toEqual(analyze(img).mean);
  });

  it('returns zeros for an empty image', () => {
    const s = analyze({ data: new Uint8ClampedArray(0), width: 0, height: 0 });
    expect(s.count).toBe(0);
    expect(s.mean).toEqual({ r: 0, g: 0, b: 0, gray: 0 });
    expect(s.dominant).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('the plain form', () => {
  it('survives json and comes back with typed histograms', () => {
    const s = analyze(image(9, 9, (i) => [i, i * 2, 255 - i]));
    const plain = JSON.parse(JSON.stringify(toPlain(s)));
    expect(Array.isArray(plain.hist.r)).toBe(true);
    const back = fromPlain(plain);
    expect(back).not.toBeNull();
    expect(back?.hist.g).toBeInstanceOf(Uint32Array);
    expect(back).toEqual(s);
  });

  it('rejects broken stored objects', () => {
    const plain = toPlain(analyze(image(2, 2, () => [1, 2, 3])));
    expect(fromPlain(null)).toBeNull();
    expect(fromPlain({ ...plain, hist: { ...plain.hist, r: [1, 2] } })).toBeNull();
    expect(fromPlain({ ...plain, mean: { r: 1, g: 2, b: 3 } })).toBeNull();
    expect(fromPlain({ ...plain, dominant: { r: -1, g: 0, b: 0 } })).toBeNull();
  });
});
