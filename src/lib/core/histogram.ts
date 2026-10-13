import { CHANNELS, type Channel, type PerChannel } from './stats';

// what the histogram panel works out before it draws: which channels show, the bar heights, the bin under the
// pointer and the lines it reads out

export const BINS = 256;
export const COLOR_CHANNELS: Channel[] = ['r', 'g', 'b'];
// faint lines at the quarters, the only grid the histogram has
export const GRID = [64, 128, 192];

export const CHANNEL_NAMES: Record<Channel, string> = { r: 'red', g: 'green', b: 'blue', gray: 'gray' };

type Bins = ArrayLike<number>;

// gray shows alone, the color channels show together or a few of them, never mixed with gray
export function normalizeChannels(v: unknown): Channel[] {
  if (!Array.isArray(v)) return ['gray'];
  const picked = CHANNELS.filter((c) => v.includes(c));
  if (picked.includes('gray') || picked.length === 0) return ['gray'];
  return picked;
}

// a chip turns its channel on or off. gray swaps between itself and the three colors, a color chip while gray
// shows brings all three, the last color going off brings gray back
export function toggleChannel(list: Channel[], c: Channel): Channel[] {
  const now = normalizeChannels(list);
  const gray = now.includes('gray');
  if (c === 'gray') return gray ? [...COLOR_CHANNELS] : ['gray'];
  if (gray) return [...COLOR_CHANNELS];
  const next = now.includes(c) ? now.filter((k) => k !== c) : COLOR_CHANNELS.filter((k) => k === c || now.includes(k));
  return next.length ? next : ['gray'];
}

// the highest bin of the shown channels on the scale in use
export function peakOf(hist: Partial<Record<Channel, Bins>>, channels: Channel[], log: boolean): number {
  let peak = 0;
  for (const c of channels) {
    const bins = hist[c];
    if (!bins) continue;
    for (let i = 0; i < BINS; i++) peak = Math.max(peak, log ? Math.log1p(bins[i] || 0) : bins[i] || 0);
  }
  return peak;
}

// how tall a bin is drawn, 0 to height. a log scale lets a few pixels show next to a large flat area
export function barHeight(n: number, peak: number, log: boolean, height: number): number {
  if (!(peak > 0) || !(n > 0)) return 0;
  return ((log ? Math.log1p(n) : n) / peak) * height;
}

// the bin under a point of the canvas, in the same units as the width
export function binAt(x: number, width: number): number {
  if (!(width > 0) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(BINS - 1, Math.floor((x / width) * BINS)));
}

// where a bin starts and how wide it is on a canvas of the given width
export function binSpan(bin: number, width: number): { x: number; w: number } {
  const x0 = Math.round((bin / BINS) * width);
  const x1 = Math.round(((bin + 1) / BINS) * width);
  return { x: x0, w: Math.max(1, x1 - x0) };
}

// the arrows move the cursor bin by one, with shift by ten, home and end jump to the ends. without a cursor yet
// the first arrow puts it at the start
export function moveBin(bin: number | null, key: string, shift: boolean, start = 128): number | null {
  const from = bin ?? start;
  const step = shift ? 10 : 1;
  let next: number;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      next = bin === null ? from : from - step;
      break;
    case 'ArrowRight':
    case 'ArrowUp':
      next = bin === null ? from : from + step;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = BINS - 1;
      break;
    default:
      return null;
  }
  return Math.max(0, Math.min(BINS - 1, next));
}

// 2 340, the thousands apart like the other readouts
export function thousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function percent(n: number, count: number): string {
  return `${count > 0 ? ((n / count) * 100).toFixed(1) : '0.0'} %`;
}

// value 128, 2 340 px, 4.1 % for one channel, the share of each channel for several
export function readout(hist: Partial<Record<Channel, Bins>>, channels: Channel[], bin: number, count: number): string {
  const shown = channels.filter((c) => hist[c]);
  const n = (c: Channel) => hist[c]![bin] || 0;
  if (shown.length === 1) return `value ${bin}, ${thousands(n(shown[0]))} px, ${percent(n(shown[0]), count)}`;
  return [`value ${bin}`, ...shown.map((c) => `${c} ${percent(n(c), count)}`)].join(', ');
}

// mean 128, median 126 for one channel, three numbers each for the colors, it names the two markers
export function markers(mean: PerChannel, median: PerChannel, channels: Channel[]): string {
  const list = (p: PerChannel) => channels.map((c) => Math.round(p[c])).join(' ');
  return `mean ${list(mean)}, median ${list(median)}`;
}

// the most common value of a channel, the lower one on a tie
export function modeOf(bins: Bins): number {
  let top = 0;
  for (let i = 1; i < BINS; i++) if ((bins[i] || 0) > (bins[top] || 0)) top = i;
  return top;
}

export interface Summary {
  hist: Partial<Record<Channel, Bins>>;
  mean: PerChannel;
  median: PerChannel;
  min: PerChannel;
  max: PerChannel;
}

// red, green and blue
export function names(channels: Channel[]): string {
  const words = channels.map((c) => CHANNEL_NAMES[c]);
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : (words[0] ?? '');
}

// what a screen reader hears for the canvas, one sentence per channel
export function describeChannels(s: Summary, channels: Channel[]): string {
  const parts = channels.map((c) => {
    const most = s.hist[c] ? `, most pixels at ${modeOf(s.hist[c]!)}` : '';
    return `${CHANNEL_NAMES[c]} from ${s.min[c]} to ${s.max[c]}, mean ${s.mean[c]}, median ${s.median[c]}${most}`;
  });
  return `Histogram of ${names(channels)}. ${parts.join('. ')}.`;
}
