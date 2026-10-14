import { derived, writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { RGB } from '$lib/core/color';
import { loadHistory, saveHistory, withEntry } from '$lib/core/history';
import { loadArea, saveArea } from '$lib/core/area';
import { loadCalibration, saveCalibration, type Calibration } from '$lib/core/calibrate';
import type { PlainStats } from '$lib/core/stats';
import { valueMode } from './app';

// what the app knows about the share and what was read from it. frames stay in the capture module,
// pixels never go into svelte state

export type Surface = 'monitor' | 'window' | 'browser';

export interface ShareInfo {
  // size of the latest frame in pixels
  width: number;
  height: number;
  surface: Surface | null;
  // frames per second the share was asked for
  fps: number;
}

export const share = writable<ShareInfo | null>(null);

// the newest frame, its size and when it came
export interface FrameInfo {
  width: number;
  height: number;
  time: number;
}

export const frame = writable<FrameInfo | null>(null);

// the preview runs while sharing unless it is switched off, area and capture work without it
export const livePreview = writable(true);

export type { Calibration, ErrorSummary } from '$lib/core/calibrate';

// the correction measured from the card, kept in this browser until it is removed or measured again
function createCalibration() {
  const store = writable<Calibration | null>(loadCalibration(storage()));
  return {
    subscribe: store.subscribe,
    set(cal: Calibration | null) {
      store.set(cal);
      saveCalibration(storage(), cal);
    }
  };
}

export const calibration = createCalibration();

// the calibration that applies now, only while the share has the frame size it was measured on
export const activeCalibration = derived([calibration, share], ([$cal, $share]) =>
  $cal && $share && $cal.frame.w === $share.width && $cal.frame.h === $share.height ? $cal : null
);

// the card is on the stage while this is true
export const calibrating = writable(false);

export type Source = 'eyedropper' | 'screen' | 'screen corrected';

export interface CurrentColor {
  rgb: RGB;
  // what the share delivered before the correction, only when one was applied
  raw: RGB | null;
  source: Source;
  // read under the pointer right now and not kept yet
  live: boolean;
  // the history entry it was kept as
  id?: string;
}

// what the color panel shows big, with the other value of a corrected pair muted under it
export interface ShownColor {
  rgb: RGB;
  alt: { label: 'raw' | 'corrected'; rgb: RGB } | null;
  source: Source;
  live: boolean;
}

// the color the color panel shows, under the pointer while hovering, else the last pick
export const current = writable<CurrentColor | null>(null);

// 0 to 1 on each axis of the frame, so the rectangle still fits after the frame size changes
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// kept in this browser, the rectangle is back after a reload and on the next share
function createArea() {
  const store = writable<NormRect | null>(loadArea(storage()));
  return {
    subscribe: store.subscribe,
    set(rect: NormRect | null) {
      store.set(rect);
      saveArea(storage(), rect);
    },
    update(fn: (rect: NormRect | null) => NormRect | null) {
      store.update((rect) => {
        const next = fn(rect);
        saveArea(storage(), next);
        return next;
      });
    }
  };
}

export const area = createArea();

export type { Channel, PerChannel } from '$lib/core/stats';

// the statistics of an area with plain arrays, ready for json and local storage
export type AreaStats = PlainStats;

export interface Capture {
  // the history entry it was kept as
  id: string;
  // a png of the area at its size, up to 1024 px on the longer side, only in memory
  preview: string;
  // a small jpeg of the area as a data url, what the history keeps
  thumbnail: string;
  stats: AreaStats;
  corrected: boolean;
  time: string;
}

// the latest capture of the area, the area panel shows it
export const capture = writable<Capture | null>(null);

export interface HistoryEntry {
  id: string;
  kind: 'pixel' | 'area';
  // iso time
  time: string;
  // the pixel, or the mean of the area
  rgb: RGB;
  source: Source;
  // whether the calibration was applied and how far off it was then
  corrected: boolean;
  residual: number | null;
  area?: {
    rect: NormRect;
    frame: { w: number; h: number };
    thumbnail: string;
    stats: AreaStats;
  };
}

// the server and the tests have no local storage
function storage(): Storage | null {
  if (!browser) return null;
  try {
    return localStorage;
  } catch {
    return null;
  }
}

// newest first and kept in this browser, what did not fit into the storage is not kept in memory either
function createHistory() {
  const store = writable<HistoryEntry[]>(loadHistory(storage()));
  return {
    subscribe: store.subscribe,
    set(list: HistoryEntry[]) {
      store.set(saveHistory(storage(), list));
    },
    update(fn: (list: HistoryEntry[]) => HistoryEntry[]) {
      store.update((list) => saveHistory(storage(), fn(list)));
    }
  };
}

export const history = createHistory();
// the id of the entry picked in the history panel
export const selection = writable<string | null>(null);

export const selectedEntry = derived([history, selection], ([$history, $selection]) =>
  $selection === null ? null : ($history.find((e) => e.id === $selection) ?? null)
);

// what the color panel shows: the pointer while it reads, else the entry picked in the history, else the last color.
// in raw mode a corrected pair shows the raw value first
export const shown = derived([current, selectedEntry, valueMode], ([$current, $entry, $mode]): ShownColor | null => {
  let c: CurrentColor | null = $current;
  if (!$current?.live && $entry && $current?.id !== $entry.id) {
    c = { rgb: $entry.rgb, raw: null, source: $entry.source, live: false };
  }
  if (!c) return null;
  if (!c.raw) return { rgb: c.rgb, alt: null, source: c.source, live: c.live };
  if ($mode === 'raw') return { rgb: c.raw, alt: { label: 'corrected', rgb: c.rgb }, source: 'screen', live: c.live };
  return { rgb: c.rgb, alt: { label: 'raw', rgb: c.raw }, source: c.source, live: c.live };
});

// the pointer over the preview in frame pixels, with the raw rgb under it
export interface PointerInfo {
  x: number;
  y: number;
  rgb: RGB;
}

export const pointer = writable<PointerInfo | null>(null);

export function selectEntry(id: string | null) {
  selection.set(id);
}

export function addEntry(entry: HistoryEntry) {
  history.update((list) => withEntry(list, entry));
}

export function removeEntry(id: string) {
  history.update((list) => list.filter((e) => e.id !== id));
  selection.update((s) => (s === id ? null : s));
}

export function clearEntries() {
  history.set([]);
  selection.set(null);
}
