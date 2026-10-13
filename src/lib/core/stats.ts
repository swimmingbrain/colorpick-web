import type { Frame, RGB } from './types';

export type { Frame, RGB } from './types';

export type Channel = 'r' | 'g' | 'b' | 'gray';

export const CHANNELS: readonly Channel[] = ['r', 'g', 'b', 'gray'];

export type PerChannel = Record<Channel, number>;

export interface Stats {
  width: number;
  height: number;
  count: number;
  // 256 bins per channel
  hist: Record<Channel, Uint32Array>;
  mean: PerChannel;
  median: PerChannel;
  std: PerChannel;
  min: PerChannel;
  max: PerChannel;
  // the most common color, rounded to 8 steps per channel
  dominant: RGB;
}

// the same with plain arrays, ready for json and local storage
export interface PlainStats extends Omit<Stats, 'hist'> {
  hist: Record<Channel, number[]>;
}

interface ChannelStats {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
}

function channelStats(h: Uint32Array): ChannelStats {
  let total = 0;
  let sum = 0;
  let min = -1;
  let max = 0;
  for (let v = 0; v < 256; v++) {
    const n = h[v];
    if (!n) continue;
    if (min < 0) min = v;
    max = v;
    total += n;
    sum += v * n;
  }
  if (!total) return { mean: 0, median: 0, std: 0, min: 0, max: 0 };
  const mean = sum / total;
  const half = Math.ceil(total / 2);
  let sq = 0;
  let cum = 0;
  let median = -1;
  for (let v = min; v <= max; v++) {
    const n = h[v];
    if (!n) continue;
    sq += n * (v - mean) * (v - mean);
    cum += n;
    if (median < 0 && cum >= half) median = v;
  }
  const std = Math.round(Math.sqrt(sq / total) * 10) / 10;
  return { mean: Math.round(mean), median, std, min, max };
}

// histograms and statistics of rgba pixels, alpha is ignored. the mean is rounded to an integer, the std to one
// decimal, the median is the lower median, the dominant color is the most common 5 bit bin refined by its low bits
export function analyze(imageData: Frame): Stats {
  const { data, width, height } = imageData;
  const count = width * height;
  const hr = new Uint32Array(256);
  const hg = new Uint32Array(256);
  const hb = new Uint32Array(256);
  const hy = new Uint32Array(256);
  // per 5 bit bin: count and the sums of the 3 low bits of r, g, b, interleaved
  const bins = new Uint32Array(32768 * 4);
  const len = Math.min(data.length, count * 4);
  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    hr[r]++;
    hg[g]++;
    hb[b]++;
    hy[(0.299 * r + 0.587 * g + 0.114 * b + 0.5) | 0]++;
    const k = (((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)) << 2;
    bins[k]++;
    bins[k + 1] += r & 7;
    bins[k + 2] += g & 7;
    bins[k + 3] += b & 7;
  }
  const hist = { r: hr, g: hg, b: hb, gray: hy };
  const per = () => ({ r: 0, g: 0, b: 0, gray: 0 });
  const out: Stats = {
    width,
    height,
    count,
    hist,
    mean: per(),
    median: per(),
    std: per(),
    min: per(),
    max: per(),
    dominant: { r: 0, g: 0, b: 0 }
  };
  for (const key of CHANNELS) {
    const s = channelStats(hist[key]);
    out.mean[key] = s.mean;
    out.median[key] = s.median;
    out.std[key] = s.std;
    out.min[key] = s.min;
    out.max[key] = s.max;
  }
  let top = 0;
  for (let k = 4; k < bins.length; k += 4) if (bins[k] > bins[top]) top = k;
  const n = bins[top];
  const q = top >> 2;
  if (n) {
    out.dominant = {
      r: ((q >> 10) << 3) + Math.round(bins[top + 1] / n),
      g: (((q >> 5) & 31) << 3) + Math.round(bins[top + 2] / n),
      b: ((q & 31) << 3) + Math.round(bins[top + 3] / n)
    };
  }
  return out;
}

export function toPlain(stats: Stats): PlainStats {
  const { r, g, b, gray } = stats.hist;
  return {
    width: stats.width,
    height: stats.height,
    count: stats.count,
    hist: { r: Array.from(r), g: Array.from(g), b: Array.from(b), gray: Array.from(gray) },
    mean: { ...stats.mean },
    median: { ...stats.median },
    std: { ...stats.std },
    min: { ...stats.min },
    max: { ...stats.max },
    dominant: { ...stats.dominant }
  };
}

const isInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isReal = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isPer = (v: unknown) => !!v && typeof v === 'object' && CHANNELS.every((k) => isReal((v as PerChannel)[k]));
const isBins = (v: unknown) => Array.isArray(v) && v.length === 256 && v.every(isInt);

// back to typed histograms, null when the stored object is not a valid plain form
export function fromPlain(input: unknown): Stats | null {
  const p = input as PlainStats;
  if (!p || typeof p !== 'object' || !isInt(p.width) || !isInt(p.height) || !isInt(p.count)) return null;
  if (!p.hist || !CHANNELS.every((k) => isBins(p.hist[k]))) return null;
  if (![p.mean, p.median, p.std, p.min, p.max].every(isPer)) return null;
  if (!p.dominant || ![p.dominant.r, p.dominant.g, p.dominant.b].every(isInt)) return null;
  const { r, g, b, gray } = p.hist;
  return {
    width: p.width,
    height: p.height,
    count: p.count,
    hist: { r: Uint32Array.from(r), g: Uint32Array.from(g), b: Uint32Array.from(b), gray: Uint32Array.from(gray) },
    mean: { ...p.mean },
    median: { ...p.median },
    std: { ...p.std },
    min: { ...p.min },
    max: { ...p.max },
    dominant: { ...p.dominant }
  };
}
