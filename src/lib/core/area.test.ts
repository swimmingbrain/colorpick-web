import { describe, expect, it } from 'vitest';
import {
  AREA_KEY,
  HANDLES,
  clampRect,
  cursorFor,
  handlePoints,
  hitRect,
  loadArea,
  moveRect,
  nudge,
  parseArea,
  resizeRect,
  saveArea,
  spanRect,
  toNorm,
  toPixels
} from './area';

const FRAME = { width: 1920, height: 1080 };

function memory() {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    }
  };
}

describe('drawing an area', () => {
  it('spans the pixels between the press and the release, whichever way the drag goes', () => {
    expect(spanRect({ x: 100.4, y: 50.6 }, { x: 340.2, y: 250.4 }, FRAME)).toEqual({ x: 100, y: 51, w: 240, h: 199 });
    expect(spanRect({ x: 340, y: 250 }, { x: 100, y: 51 }, FRAME)).toEqual({ x: 100, y: 51, w: 240, h: 199 });
  });

  it('keeps at least 3 by 3 pixels, grown in the direction of the drag', () => {
    expect(spanRect({ x: 10, y: 10 }, { x: 11, y: 10 }, FRAME)).toEqual({ x: 10, y: 10, w: 3, h: 3 });
    expect(spanRect({ x: 10, y: 10 }, { x: 9, y: 9 }, FRAME)).toEqual({ x: 7, y: 7, w: 3, h: 3 });
  });

  it('stays inside the frame when the drag leaves it', () => {
    expect(spanRect({ x: 1800, y: 1000 }, { x: 2500, y: 1400 }, FRAME)).toEqual({ x: 1800, y: 1000, w: 120, h: 80 });
    expect(spanRect({ x: 100, y: 100 }, { x: -50, y: -20 }, FRAME)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(spanRect({ x: 1919.8, y: 5 }, { x: 1920, y: 5 }, FRAME)).toEqual({ x: 1917, y: 5, w: 3, h: 3 });
  });
});

describe('moving and resizing an area', () => {
  const r = { x: 100, y: 100, w: 200, h: 100 };

  it('moves by whole pixels and stops at the edges of the frame', () => {
    expect(moveRect(r, 10.4, -20.6, FRAME)).toEqual({ x: 110, y: 79, w: 200, h: 100 });
    expect(moveRect(r, -500, -500, FRAME)).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    expect(moveRect(r, 5000, 5000, FRAME)).toEqual({ x: 1720, y: 980, w: 200, h: 100 });
  });

  it('moves the edges of each handle and leaves the opposite ones', () => {
    expect(resizeRect(r, 'se', { x: 400, y: 260 }, FRAME)).toEqual({ x: 100, y: 100, w: 300, h: 160 });
    expect(resizeRect(r, 'nw', { x: 50, y: 40 }, FRAME)).toEqual({ x: 50, y: 40, w: 250, h: 160 });
    expect(resizeRect(r, 'ne', { x: 350, y: 90 }, FRAME)).toEqual({ x: 100, y: 90, w: 250, h: 110 });
    expect(resizeRect(r, 'sw', { x: 90, y: 250 }, FRAME)).toEqual({ x: 90, y: 100, w: 210, h: 150 });
    expect(resizeRect(r, 'n', { x: 999, y: 80 }, FRAME)).toEqual({ x: 100, y: 80, w: 200, h: 120 });
    expect(resizeRect(r, 's', { x: -999, y: 240 }, FRAME)).toEqual({ x: 100, y: 100, w: 200, h: 140 });
    expect(resizeRect(r, 'e', { x: 150, y: 999 }, FRAME)).toEqual({ x: 100, y: 100, w: 50, h: 100 });
    expect(resizeRect(r, 'w', { x: 280, y: -999 }, FRAME)).toEqual({ x: 280, y: 100, w: 20, h: 100 });
  });

  it('never shrinks below 3 pixels or past the opposite edge', () => {
    expect(resizeRect(r, 'e', { x: 20, y: 0 }, FRAME)).toEqual({ x: 100, y: 100, w: 3, h: 100 });
    expect(resizeRect(r, 'nw', { x: 900, y: 900 }, FRAME)).toEqual({ x: 297, y: 197, w: 3, h: 3 });
  });

  it('stops a handle at the edge of the frame', () => {
    expect(resizeRect(r, 'se', { x: 4000, y: 4000 }, FRAME)).toEqual({ x: 100, y: 100, w: 1820, h: 980 });
    expect(resizeRect(r, 'nw', { x: -40, y: -40 }, FRAME)).toEqual({ x: 0, y: 0, w: 300, h: 200 });
  });

  it('nudges by one pixel with the arrows and by ten with shift', () => {
    expect(nudge(r, 'ArrowRight', false, FRAME)).toEqual({ x: 101, y: 100, w: 200, h: 100 });
    expect(nudge(r, 'ArrowUp', true, FRAME)).toEqual({ x: 100, y: 90, w: 200, h: 100 });
    expect(nudge({ x: 0, y: 0, w: 10, h: 10 }, 'ArrowLeft', true, FRAME)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(nudge(r, 'Enter', false, FRAME)).toBeNull();
  });
});

describe('handles', () => {
  const r = { x: 100, y: 100, w: 200, h: 100 };

  it('sit on the corners and the middles of the sides', () => {
    const p = handlePoints(r);
    expect(HANDLES).toHaveLength(8);
    expect(p.nw).toEqual({ x: 100, y: 100 });
    expect(p.n).toEqual({ x: 200, y: 100 });
    expect(p.e).toEqual({ x: 300, y: 150 });
    expect(p.se).toEqual({ x: 300, y: 200 });
    expect(p.w).toEqual({ x: 100, y: 150 });
  });

  it('are hit within the tolerance, the inside moves and the outside draws anew', () => {
    expect(hitRect(r, { x: 103, y: 98 }, 5)).toBe('nw');
    expect(hitRect(r, { x: 296, y: 151 }, 5)).toBe('e');
    expect(hitRect(r, { x: 200, y: 204 }, 5)).toBe('s');
    expect(hitRect(r, { x: 150, y: 130 }, 5)).toBe('inside');
    expect(hitRect(r, { x: 50, y: 50 }, 5)).toBeNull();
    expect(hitRect(r, { x: 110, y: 100 }, 5)).toBe('inside');
  });

  it('give the nearest handle when two are in reach', () => {
    const small = { x: 10, y: 10, w: 4, h: 4 };
    expect(hitRect(small, { x: 13.5, y: 13.5 }, 5)).toBe('se');
    expect(hitRect(small, { x: 10.2, y: 10.4 }, 5)).toBe('nw');
  });

  it('name the cursor for what they move', () => {
    expect(cursorFor('nw')).toBe('nwse-resize');
    expect(cursorFor('se')).toBe('nwse-resize');
    expect(cursorFor('ne')).toBe('nesw-resize');
    expect(cursorFor('n')).toBe('ns-resize');
    expect(cursorFor('w')).toBe('ew-resize');
    expect(cursorFor('inside')).toBe('move');
    expect(cursorFor(null)).toBe('crosshair');
  });
});

describe('normalized areas', () => {
  it('go to pixels and back without drifting', () => {
    const px = { x: 333, y: 101, w: 240, h: 200 };
    expect(toPixels(toNorm(px, FRAME), FRAME)).toEqual(px);
  });

  it('fit a frame of another size', () => {
    const norm = toNorm({ x: 960, y: 540, w: 480, h: 270 }, FRAME);
    expect(toPixels(norm, { width: 2560, height: 1440 })).toEqual({ x: 1280, y: 720, w: 640, h: 360 });
    expect(toPixels({ x: 0.5, y: 0.5, w: 0.0001, h: 0.0001 }, FRAME)).toEqual({ x: 960, y: 540, w: 3, h: 3 });
  });

  it('are kept in their own key and read back', () => {
    const storage = memory();
    saveArea(storage, { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
    expect(Object.keys(storage.data)).toEqual([AREA_KEY]);
    expect(loadArea(storage)).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
    saveArea(storage, null);
    expect(loadArea(storage)).toBeNull();
  });

  it('turn away broken or outside rectangles', () => {
    expect(parseArea(null)).toBeNull();
    expect(parseArea({ x: 0.1, y: 0.1, w: 0.2 })).toBeNull();
    expect(parseArea({ x: -0.1, y: 0.1, w: 0.2, h: 0.2 })).toBeNull();
    expect(parseArea({ x: 0.9, y: 0.1, w: 0.2, h: 0.2 })).toBeNull();
    expect(parseArea({ x: 0.1, y: 0.1, w: 0, h: 0.2 })).toBeNull();
    expect(parseArea({ x: 0, y: 0, w: 1, h: 1 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(loadArea({ getItem: () => 'not json' })).toBeNull();
    expect(loadArea(null)).toBeNull();
  });

  it('clamp into a frame that is smaller than the minimum', () => {
    expect(clampRect({ x: 5, y: 5, w: 10, h: 10 }, { width: 2, height: 2 })).toEqual({ x: 0, y: 0, w: 2, h: 2 });
  });
});
