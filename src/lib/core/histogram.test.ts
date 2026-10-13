import { describe, expect, it } from 'vitest';
import {
  barHeight,
  binAt,
  binSpan,
  describeChannels,
  markers,
  modeOf,
  moveBin,
  names,
  normalizeChannels,
  peakOf,
  readout,
  thousands,
  toggleChannel
} from './histogram';
import { analyze, toPlain } from './stats';

function bins(at: Record<number, number>): number[] {
  const out = new Array(256).fill(0);
  for (const [k, v] of Object.entries(at)) out[Number(k)] = v;
  return out;
}

describe('channel chips', () => {
  it('start on gray alone and drop anything that is not a channel', () => {
    expect(normalizeChannels(undefined)).toEqual(['gray']);
    expect(normalizeChannels([])).toEqual(['gray']);
    expect(normalizeChannels(['x', 3])).toEqual(['gray']);
    expect(normalizeChannels(['b', 'r', 'b'])).toEqual(['r', 'b']);
    expect(normalizeChannels(['r', 'gray'])).toEqual(['gray']);
  });

  it('swap gray for the three colors and back', () => {
    expect(toggleChannel(['gray'], 'gray')).toEqual(['r', 'g', 'b']);
    expect(toggleChannel(['r', 'g', 'b'], 'gray')).toEqual(['gray']);
    expect(toggleChannel(['g'], 'gray')).toEqual(['gray']);
  });

  it('bring all three colors when a color chip is pressed while gray shows', () => {
    expect(toggleChannel(['gray'], 'g')).toEqual(['r', 'g', 'b']);
  });

  it('turn single colors off and on in their order, the last one off brings gray back', () => {
    expect(toggleChannel(['r', 'g', 'b'], 'g')).toEqual(['r', 'b']);
    expect(toggleChannel(['r', 'b'], 'g')).toEqual(['r', 'g', 'b']);
    expect(toggleChannel(['b'], 'r')).toEqual(['r', 'b']);
    expect(toggleChannel(['b'], 'b')).toEqual(['gray']);
  });
});

describe('bar heights', () => {
  const hist = { r: bins({ 10: 400, 20: 100 }), g: bins({ 30: 800 }), gray: bins({ 5: 3 }) };

  it('scale to the highest bin of the channels on show', () => {
    expect(peakOf(hist, ['r'], false)).toBe(400);
    expect(peakOf(hist, ['r', 'g'], false)).toBe(800);
    expect(peakOf(hist, ['b'], false)).toBe(0);
    expect(barHeight(400, 400, false, 80)).toBe(80);
    expect(barHeight(100, 400, false, 80)).toBe(20);
    expect(barHeight(0, 400, false, 80)).toBe(0);
  });

  it('lift small bins on a log scale', () => {
    const peak = peakOf(hist, ['r'], true);
    expect(peak).toBeCloseTo(Math.log1p(400));
    expect(barHeight(400, peak, true, 80)).toBeCloseTo(80);
    expect(barHeight(100, peak, true, 80)).toBeGreaterThan(60);
    expect(barHeight(1, peak, true, 80)).toBeGreaterThan(5);
  });

  it('draw nothing without a peak', () => {
    expect(barHeight(10, 0, false, 80)).toBe(0);
    expect(barHeight(Number.NaN, 10, false, 80)).toBe(0);
  });
});

describe('bins on the canvas', () => {
  it('finds the bin under a point and stays inside 0 to 255', () => {
    expect(binAt(0, 512)).toBe(0);
    expect(binAt(1.9, 512)).toBe(0);
    expect(binAt(2, 512)).toBe(1);
    expect(binAt(256, 512)).toBe(128);
    expect(binAt(511.9, 512)).toBe(255);
    expect(binAt(600, 512)).toBe(255);
    expect(binAt(-4, 512)).toBe(0);
    expect(binAt(10, 0)).toBe(0);
  });

  it('gives every bin a whole pixel span that tiles the width', () => {
    expect(binSpan(0, 512)).toEqual({ x: 0, w: 2 });
    expect(binSpan(255, 512)).toEqual({ x: 510, w: 2 });
    let x = 0;
    for (let b = 0; b < 256; b++) {
      const s = binSpan(b, 300);
      expect(s.x).toBe(x);
      x = s.x + s.w;
    }
    expect(x).toBe(300);
    expect(binSpan(10, 100).w).toBe(1);
  });

  it('moves the cursor with the arrows, ten with shift, and jumps with home and end', () => {
    expect(moveBin(100, 'ArrowRight', false)).toBe(101);
    expect(moveBin(100, 'ArrowLeft', true)).toBe(90);
    expect(moveBin(100, 'ArrowUp', false)).toBe(101);
    expect(moveBin(3, 'ArrowLeft', true)).toBe(0);
    expect(moveBin(250, 'ArrowRight', true)).toBe(255);
    expect(moveBin(100, 'Home', false)).toBe(0);
    expect(moveBin(100, 'End', false)).toBe(255);
    expect(moveBin(100, 'a', false)).toBeNull();
  });

  it('puts a missing cursor at the start on the first arrow', () => {
    expect(moveBin(null, 'ArrowRight', false)).toBe(128);
    expect(moveBin(null, 'ArrowLeft', false, 40)).toBe(40);
    expect(moveBin(null, 'End', false, 40)).toBe(255);
  });
});

describe('readouts', () => {
  const s = toPlain(analyze({ data: new Uint8ClampedArray(4 * 1000).fill(255), width: 1000, height: 1 }));
  s.hist.gray = bins({ 128: 2340, 200: 54726 });
  s.hist.r = bins({ 128: 41 });
  s.hist.g = bins({ 128: 0 });
  s.hist.b = bins({ 128: 57066 });

  it('says the value, the pixels and the share of one channel', () => {
    expect(readout(s.hist, ['gray'], 128, 57066)).toBe('value 128, 2 340 px, 4.1 %');
    expect(readout(s.hist, ['gray'], 3, 57066)).toBe('value 3, 0 px, 0.0 %');
    expect(readout(s.hist, ['gray'], 3, 0)).toBe('value 3, 0 px, 0.0 %');
  });

  it('gives the share of every color channel', () => {
    expect(readout(s.hist, ['r', 'g', 'b'], 128, 57066)).toBe('value 128, r 0.1 %, g 0.0 %, b 100.0 %');
  });

  it('names the marker values per channel', () => {
    const mean = { r: 12, g: 20, b: 30, gray: 18 };
    const median = { r: 11, g: 21, b: 29, gray: 17 };
    expect(markers(mean, median, ['gray'])).toBe('mean 18, median 17');
    expect(markers(mean, median, ['r', 'g', 'b'])).toBe('mean 12 20 30, median 11 21 29');
  });

  it('writes thousands apart', () => {
    expect(thousands(7)).toBe('7');
    expect(thousands(2340)).toBe('2 340');
    expect(thousands(2073600)).toBe('2 073 600');
  });

  it('sums up the channels for a screen reader', () => {
    expect(modeOf(s.hist.gray)).toBe(200);
    expect(names(['r', 'g', 'b'])).toBe('red, green and blue');
    expect(names(['gray'])).toBe('gray');
    expect(describeChannels(s, ['gray'])).toBe(
      'Histogram of gray. gray from 255 to 255, mean 255, median 255, most pixels at 200.'
    );
    expect(describeChannels(s, ['r', 'b'])).toContain('Histogram of red and blue. red from 255 to 255');
  });
});
