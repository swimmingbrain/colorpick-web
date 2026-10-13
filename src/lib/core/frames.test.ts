import { describe, expect, it } from 'vitest';
import { block, fitView, framePoint, loupeSpot, pixelAt, pixelUnder, readInterval, type Pixels } from './frames';

// a frame where every pixel says where it is: red is x, green is y
function frame(width: number, height: number): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = x;
      data[i + 1] = y;
      data[i + 2] = 7;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('frame pixels', () => {
  it('reads the pixel at a place and nothing outside the frame', () => {
    const img = frame(20, 10);
    expect(pixelAt(img, 3, 4)).toEqual({ r: 3, g: 4, b: 7 });
    expect(pixelAt(img, 19, 9)).toEqual({ r: 19, g: 9, b: 7 });
    expect(pixelAt(img, 20, 0)).toBeNull();
    expect(pixelAt(img, -1, 0)).toBeNull();
    expect(pixelAt(img, 1.5, 0)).toBeNull();
  });

  it('cuts a square around a pixel with the pixel in the middle', () => {
    const img = frame(30, 30);
    const b = block(img, 10, 12, 11);
    expect(b.width).toBe(11);
    expect(b.height).toBe(11);
    expect(pixelAt(b, 5, 5)).toEqual({ r: 10, g: 12, b: 7 });
    expect(pixelAt(b, 0, 0)).toEqual({ r: 5, g: 7, b: 7 });
    expect(pixelAt(b, 10, 10)).toEqual({ r: 15, g: 17, b: 7 });
  });

  it('leaves what lies past the edge transparent', () => {
    const b = block(frame(8, 8), 0, 0, 11);
    expect(b.data[3]).toBe(0);
    const middle = (5 * 11 + 5) * 4;
    expect(b.data[middle + 3]).toBe(255);
    const outside = (5 * 11 + 4) * 4;
    expect(b.data[outside + 3]).toBe(0);
  });
});

describe('fitView', () => {
  it('fits a wide frame into the stage with the margin and centers it', () => {
    const v = fitView({ width: 2560, height: 1440 }, { width: 1032, height: 600 }, 'fit', 1, 16);
    expect(v.scale).toBeCloseTo(1000 / 2560);
    expect(v.w).toBeCloseTo(1000);
    expect(v.h).toBeCloseTo(562.5);
    expect(v.x).toBe(16);
    expect(v.y).toBe(19);
    expect(v.contentW).toBe(1032);
    expect(v.contentH).toBe(600);
  });

  it('gives one frame pixel per device pixel at 100% and lets the content grow', () => {
    const v = fitView({ width: 2560, height: 1440 }, { width: 1000, height: 600 }, 'actual', 2, 16);
    expect(v.scale).toBe(0.5);
    expect(v.w).toBe(1280);
    expect(v.h).toBe(720);
    expect(v.contentW).toBe(1312);
    expect(v.contentH).toBe(752);
    expect(v.x).toBe(16);
    expect(v.y).toBe(16);
  });

  it('centers a small frame at 100%', () => {
    const v = fitView({ width: 400, height: 300 }, { width: 1000, height: 600 }, 'actual', 1);
    expect(v.x).toBe(300);
    expect(v.y).toBe(150);
  });

  it('draws nothing before there is a frame or a stage', () => {
    expect(fitView({ width: 0, height: 0 }, { width: 800, height: 600 }, 'fit').w).toBe(0);
    expect(fitView({ width: 800, height: 600 }, { width: 0, height: 0 }, 'fit').w).toBe(0);
  });
});

describe('stage points', () => {
  it('maps css pixels on the box to frame pixels and finds the pixel under them', () => {
    const v = fitView({ width: 2000, height: 1000 }, { width: 1032, height: 532 }, 'fit', 1, 16);
    const p = framePoint(v, 250, 100);
    expect(p.x).toBeCloseTo(500);
    expect(p.y).toBeCloseTo(200);
    expect(pixelUnder({ x: 499.7, y: 200.2 }, { width: 2000, height: 1000 })).toEqual({ x: 499, y: 200 });
    expect(pixelUnder({ x: 2000, y: 10 }, { width: 2000, height: 1000 })).toBeNull();
    expect(pixelUnder({ x: -0.2, y: 10 }, { width: 2000, height: 1000 })).toBeNull();
  });

  it('puts the loupe below right of the pointer and flips it at the edges', () => {
    const box = { w: 90, h: 110 };
    const bounds = { w: 800, h: 600 };
    expect(loupeSpot({ x: 100, y: 100 }, box, bounds, 18)).toEqual({ x: 118, y: 118 });
    expect(loupeSpot({ x: 760, y: 100 }, box, bounds, 18)).toEqual({ x: 652, y: 118 });
    expect(loupeSpot({ x: 100, y: 560 }, box, bounds, 18)).toEqual({ x: 118, y: 432 });
    expect(loupeSpot({ x: 790, y: 590 }, box, bounds, 18)).toEqual({ x: 682, y: 462 });
  });

  it('keeps the loupe inside a stage that is too small for a flip', () => {
    const spot = loupeSpot({ x: 50, y: 50 }, { w: 90, h: 110 }, { w: 120, h: 130 }, 18);
    expect(spot.x).toBeGreaterThanOrEqual(4);
    expect(spot.y).toBeGreaterThanOrEqual(4);
  });
});

describe('readInterval', () => {
  it('follows the share rate up to ten reads a second', () => {
    expect(readInterval(2)).toBe(500);
    expect(readInterval(5)).toBe(200);
    expect(readInterval(10)).toBe(100);
    expect(readInterval(60)).toBe(100);
    expect(readInterval(0)).toBe(100);
    expect(readInterval(Number.NaN)).toBe(100);
  });
});
