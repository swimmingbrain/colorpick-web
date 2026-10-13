import { describe, expect, it } from 'vitest';
import { clampRgb, contrast, gray, hex, hsl, hslText, luminance, parseHex, rgbCss, rgbText, textOn } from './color';

describe('color', () => {
  it('writes hex in upper case with two digits per channel', () => {
    expect(hex({ r: 225, g: 137, b: 122 })).toBe('#E1897A');
    expect(hex({ r: 0, g: 10, b: 255 })).toBe('#000AFF');
  });

  it('rounds and clamps channels before writing them', () => {
    expect(hex({ r: 300, g: -4, b: 127.6 })).toBe('#FF0080');
    expect(clampRgb({ r: Number.NaN, g: 1.4, b: 254.5 })).toEqual({ r: 0, g: 1, b: 255 });
  });

  it('reads short and long hex, with or without the hash', () => {
    expect(parseHex('#E1897A')).toEqual({ r: 225, g: 137, b: 122 });
    expect(parseHex('e1897a')).toEqual({ r: 225, g: 137, b: 122 });
    expect(parseHex('#0af')).toEqual({ r: 0, g: 170, b: 255 });
    expect(parseHex(' #FFF ')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('gives null for text that is no hex color', () => {
    expect(parseHex('')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
    expect(parseHex('red')).toBeNull();
    expect(parseHex('#ggg')).toBeNull();
  });

  it('turns hex and rgb into each other without loss', () => {
    for (const text of ['#000000', '#FFFFFF', '#E1897A', '#2F3A4F', '#7F7F80']) {
      expect(hex(parseHex(text)!)).toBe(text);
    }
  });

  it('writes rgb for the panels and for the clipboard', () => {
    expect(rgbText({ r: 225, g: 137, b: 122 })).toBe('225 137 122');
    expect(rgbCss({ r: 225, g: 137, b: 122 })).toBe('rgb(225, 137, 122)');
  });

  it('finds hue, saturation and lightness', () => {
    expect(hsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
    expect(hsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50 });
    expect(hsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
    expect(hsl({ r: 255, g: 0, b: 128 })).toEqual({ h: 330, s: 100, l: 50 });
    expect(hsl({ r: 225, g: 137, b: 122 })).toEqual({ h: 9, s: 63, l: 68 });
    expect(hslText({ r: 225, g: 137, b: 122 })).toBe('9° 63% 68%');
  });

  it('gives grays no hue and no saturation', () => {
    expect(hsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
    expect(hsl({ r: 128, g: 128, b: 128 })).toEqual({ h: 0, s: 0, l: 50 });
    expect(hsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 });
  });

  it('counts gray as rec 601 luma', () => {
    expect(gray({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(gray({ r: 255, g: 255, b: 255 })).toBe(255);
    expect(gray({ r: 255, g: 0, b: 0 })).toBe(76);
    expect(gray({ r: 0, g: 255, b: 0 })).toBe(150);
    expect(gray({ r: 0, g: 0, b: 255 })).toBe(29);
  });

  it('measures luminance and contrast like the web guidelines', () => {
    expect(luminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 6);
    expect(contrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 6);
    expect(contrast({ r: 119, g: 119, b: 119 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(4.48, 2);
    expect(contrast({ r: 40, g: 40, b: 40 }, { r: 40, g: 40, b: 40 })).toBe(1);
  });

  it('picks dark text on light swatches and white on dark ones', () => {
    expect(textOn({ r: 255, g: 255, b: 255 })).toBe('#111');
    expect(textOn({ r: 225, g: 137, b: 122 })).toBe('#111');
    expect(textOn({ r: 47, g: 58, b: 79 })).toBe('#fff');
    expect(textOn({ r: 0, g: 0, b: 0 })).toBe('#fff');
  });
});
