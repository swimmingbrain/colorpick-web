import { normalizeChannels } from '$lib/core/histogram';
import type { Channel } from '$lib/core/stats';

// the preferences: their defaults, how a stored copy is read back and where it is kept

export const STORAGE_KEY = 'brainpick:preferences';

export type DockTab = 'color' | 'area' | 'history' | 'calibration';
export type ToolbarSide = 'left' | 'right';
// frames per second the share is asked for, more costs more power
export type FrameRate = 2 | 5 | 10;

export const DOCK_TOP: DockTab[] = ['color', 'area'];
export const DOCK_BOTTOM: DockTab[] = ['history', 'calibration'];
export const FRAME_RATES: FrameRate[] = [2, 5, 10];

export const RECENT_COMMANDS = 8;
export const MIN_DOCK = 220;
export const MAX_DOCK = 520;

export interface Preferences {
  toolbar: {
    side: ToolbarSide;
  };
  stage: {
    // the magnified pixels next to the pointer
    loupe: boolean;
  };
  histogram: {
    // gray alone or some of the color channels, the chips above the histogram change both
    channels: Channel[];
    log: boolean;
  };
  share: {
    fps: FrameRate;
  };
  panels: {
    dockWidth: number;
    // the share of the dock height the upper group takes
    dockSplit: number;
    topTab: DockTab;
    bottomTab: DockTab;
  };
  // only the keys that differ from the defaults, an empty string takes a key away
  shortcuts: Record<string, string>;
  recentCommands: string[];
}

export function defaultPreferences(): Preferences {
  return {
    toolbar: { side: 'left' },
    stage: { loupe: true },
    histogram: { channels: ['gray'], log: false },
    share: { fps: 5 },
    panels: { dockWidth: 280, dockSplit: 0.55, topTab: 'color', bottomTab: 'history' },
    shortcuts: {},
    recentCommands: []
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// walks the defaults, so a key added later gets its default and a stored value of the wrong type is dropped
function merge<T>(base: T, stored: unknown): T {
  if (isObject(base)) {
    if (!isObject(stored)) return base;
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(base)) out[key] = merge(base[key], stored[key]);
    return out as T;
  }
  if (Array.isArray(base)) return (Array.isArray(stored) ? stored : base) as T;
  return (typeof stored === typeof base && stored !== null ? stored : base) as T;
}

function oneOf<T extends string | number>(value: T, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function mergePreferences(stored: unknown): Preferences {
  const defaults = defaultPreferences();
  const p = merge(defaults, stored);
  const raw = isObject(stored) ? stored : {};

  p.toolbar.side = oneOf(p.toolbar.side, ['left', 'right'], 'left');
  p.share.fps = oneOf(p.share.fps, FRAME_RATES, defaults.share.fps);
  p.histogram.channels = normalizeChannels(p.histogram.channels);

  const panels = p.panels;
  panels.dockWidth = clamp(panels.dockWidth, MIN_DOCK, MAX_DOCK);
  panels.dockSplit = clamp(panels.dockSplit, 0.15, 0.85);
  // a tab stays in its own group
  panels.topTab = oneOf(panels.topTab, DOCK_TOP, defaults.panels.topTab);
  panels.bottomTab = oneOf(panels.bottomTab, DOCK_BOTTOM, defaults.panels.bottomTab);

  p.recentCommands = p.recentCommands
    .filter((c, i, list) => typeof c === 'string' && list.indexOf(c) === i)
    .slice(0, RECENT_COMMANDS);

  // the defaults hold no shortcuts, so the walk above cannot keep them
  p.shortcuts = {};
  if (isObject(raw.shortcuts)) {
    for (const [id, keys] of Object.entries(raw.shortcuts)) {
      if (typeof keys === 'string') p.shortcuts[id] = keys;
    }
  }
  return p;
}

// a private window or a broken entry gives the defaults
export function loadPreferences(storage: Pick<Storage, 'getItem'> | null): Preferences {
  if (!storage) return defaultPreferences();
  try {
    const stored = storage.getItem(STORAGE_KEY);
    return stored ? mergePreferences(JSON.parse(stored)) : defaultPreferences();
  } catch {
    return defaultPreferences();
  }
}

export function savePreferences(storage: Pick<Storage, 'setItem'> | null, value: Preferences) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {}
}
