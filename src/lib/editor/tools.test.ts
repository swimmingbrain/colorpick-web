import { describe, expect, it } from 'vitest';
import { TOOL_IDS, TOOL_INFO, calibrationStatus, lockOf, lockText, toolHint, within } from './tools';
import type { Calibration } from '$lib/stores/session';

const KEYS: Record<string, string> = { 'share.toggle': 'S', 'tool.area': 'A', 'tool.capture': 'C' };
const keyOf = (id: string) => KEYS[id] ?? '';

function cal(w: number, h: number, max = 1.23): Calibration {
  return {
    version: 1,
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    residual: { mean: 0.4, max: 0.9 },
    holdout: { mean: 0.6, max },
    frame: { w, h },
    at: '2026-10-13T20:00:00.000Z'
  };
}

describe('tool locks', () => {
  it('leaves pick open without a share and locks the rest', () => {
    const none = { sharing: false, hasArea: false };
    expect(lockOf('pick', none)).toBeNull();
    for (const id of ['area', 'capture', 'live', 'calibrate'] as const) {
      expect(lockOf(id, none)).toEqual({ reason: 'Share your screen first', command: 'share.toggle' });
    }
  });

  it('opens everything with a share except capture, which waits for an area', () => {
    const shared = { sharing: true, hasArea: false };
    for (const id of ['pick', 'area', 'live', 'calibrate'] as const) expect(lockOf(id, shared)).toBeNull();
    expect(lockOf('capture', shared)).toEqual({ reason: 'Draw an area first', command: 'tool.area' });
    expect(lockOf('capture', { sharing: true, hasArea: true })).toBeNull();
  });

  it('names the key that lifts the lock, and only the reason when there is none', () => {
    expect(lockText({ reason: 'Share your screen first', command: 'share.toggle' }, keyOf)).toBe(
      'Share your screen first (S)'
    );
    expect(lockText({ reason: 'Draw an area first', command: 'tool.area' }, keyOf)).toBe('Draw an area first (A)');
    expect(lockText({ reason: 'Draw an area first', command: 'tool.area' }, () => '')).toBe('Draw an area first');
  });

  it('describes every tool with its own command', () => {
    for (const id of TOOL_IDS) {
      expect(TOOL_INFO[id].id).toBe(id);
      expect(TOOL_INFO[id].command).toBe(`tool.${id}`);
    }
  });
});

describe('toolHint', () => {
  it('says what a drag does once there is a share', () => {
    expect(toolHint('area', { sharing: true, hasArea: false }, keyOf)).toBe('drag on the preview to draw an area');
    expect(toolHint('area', { sharing: true, hasArea: true }, keyOf)).toContain('C reads it');
    expect(toolHint('area', { sharing: true, hasArea: true }, () => '')).toContain('capture reads it');
  });

  it('points to the eyedropper while nothing is shared', () => {
    expect(toolHint('pick', { sharing: false, hasArea: false }, keyOf)).toContain('eyedropper');
    expect(toolHint('area', { sharing: false, hasArea: false }, keyOf)).toContain('share the screen');
  });

  it('stays lowercase like the status bar', () => {
    for (const mode of ['pick', 'area'] as const) {
      for (const sharing of [false, true]) {
        for (const hasArea of [false, true]) {
          const hint = toolHint(mode, { sharing, hasArea }, () => '');
          expect(hint).toBe(hint.toLowerCase());
        }
      }
    }
  });
});

describe('calibrationStatus', () => {
  it('knows no calibration, one for this frame size and one for another', () => {
    expect(calibrationStatus(null, { width: 2560, height: 1440 })).toBe('none');
    expect(calibrationStatus(cal(2560, 1440), { width: 2560, height: 1440 })).toBe('ready');
    expect(calibrationStatus(cal(1920, 1080), { width: 2560, height: 1440 })).toBe('other size');
  });

  it('keeps a stored calibration while nothing is shared', () => {
    expect(calibrationStatus(cal(1920, 1080), null)).toBe('ready');
  });

  it('gives the error the fit never saw, with one decimal', () => {
    expect(within(cal(1, 1, 1.23))).toBe('±1.2');
    expect(within(cal(1, 1, 0.96))).toBe('±1.0');
    expect(within(cal(1, 1, 3))).toBe('±3.0');
  });
});
