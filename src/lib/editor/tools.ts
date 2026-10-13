import type { Calibration } from '$lib/stores/session';

export const TOOL_IDS = ['pick', 'area', 'capture', 'live', 'calibrate'] as const;

export type ToolId = (typeof TOOL_IDS)[number];
// the two tools that decide what a click and a drag on the stage do
export type Mode = 'pick' | 'area';

export interface ToolInfo {
  id: ToolId;
  name: string;
  icon: string;
  // the command the button, the key and the palette share
  command: string;
  // pick and area stay on, capture and calibrate run once, live switches the preview on and off
  kind: 'mode' | 'action' | 'toggle';
  // the tool column draws a thin line where the group changes
  group: number;
}

export const TOOL_INFO: Record<ToolId, ToolInfo> = {
  pick: { id: 'pick', name: 'Pick', icon: 'eyedropper', command: 'tool.pick', kind: 'mode', group: 0 },
  area: { id: 'area', name: 'Area', icon: 'area', command: 'tool.area', kind: 'mode', group: 0 },
  capture: { id: 'capture', name: 'Capture', icon: 'capture', command: 'tool.capture', kind: 'action', group: 1 },
  live: { id: 'live', name: 'Live preview', icon: 'live', command: 'tool.live', kind: 'toggle', group: 1 },
  calibrate: { id: 'calibrate', name: 'Calibrate', icon: 'calibrate', command: 'tool.calibrate', kind: 'action', group: 2 }
};

// what the locks look at
export interface ToolState {
  sharing: boolean;
  hasArea: boolean;
}

// why a tool cannot be used now and the command that would change that
export interface Lock {
  reason: string;
  command: string;
}

// the eyedropper needs no share, everything else reads the shared screen
export function lockOf(id: ToolId, s: ToolState): Lock | null {
  if (id === 'pick') return null;
  if (!s.sharing) return { reason: 'Share your screen first', command: 'share.toggle' };
  if (id === 'capture' && !s.hasArea) return { reason: 'Draw an area first', command: 'tool.area' };
  return null;
}

// the reason with the key that fixes it, like Share your screen first (S)
export function lockText(lock: Lock, keyOf: (command: string) => string): string {
  const key = keyOf(lock.command);
  return key ? `${lock.reason} (${key})` : lock.reason;
}

// the status bar line for the active tool, lowercase like the rest of the bar
export function toolHint(mode: Mode, s: ToolState, keyOf: (command: string) => string): string {
  const key = (command: string, fallback: string) => keyOf(command) || fallback;
  if (mode === 'area') {
    if (!s.sharing) return 'share the screen to draw an area on it';
    if (!s.hasArea) return 'drag on the preview to draw an area';
    return `drag inside to move the area, drag a handle to resize it, ${key('tool.capture', 'capture')} reads it`;
  }
  if (!s.sharing) return 'the eyedropper picks any pixel on the screen, no share needed';
  return 'hover the preview to read a pixel, click to keep it';
}

export type CalibrationStatus = 'none' | 'ready' | 'other size';

// a calibration only holds for the frame size it was measured on
export function calibrationStatus(
  cal: Calibration | null,
  frame: { width: number; height: number } | null
): CalibrationStatus {
  if (!cal) return 'none';
  if (frame && (cal.frame.w !== frame.width || cal.frame.h !== frame.height)) return 'other size';
  return 'ready';
}

// ±2 or ±1.2, one decimal at most and none for a whole number
export function plusMinus(v: number): string {
  return `±${Math.round(v * 10) / 10}`;
}

// how far off the colors are after the correction, from the patches the fit never saw
export function within(cal: Pick<Calibration, 'holdout'>): string {
  return plusMinus(cal.holdout.max);
}
