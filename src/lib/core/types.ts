export type { RGB } from './color';

// the same shape as ImageData, so the tests can pass plain objects
export interface Frame {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
