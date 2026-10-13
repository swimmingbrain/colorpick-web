import { clampRgb, hex, type RGB } from './color';
import type { AreaStats, HistoryEntry, NormRect, Source } from '$lib/stores/session';

// the kept colors and areas: newest first, a limit, local storage that may run full, and the two exports

export const HISTORY_KEY = 'brainpick:history';
export const HISTORY_LIMIT = 500;

export const CSV_COLUMNS = [
  'id',
  'kind',
  'time',
  'hex',
  'r',
  'g',
  'b',
  'source',
  'corrected',
  'residual',
  'area_w',
  'area_h',
  'mean_hex'
];

const SOURCES: Source[] = ['eyedropper', 'screen', 'screen corrected'];
const CHANNELS = ['r', 'g', 'b', 'gray'] as const;

let counter = 0;

// short ids that grow with the time, two in the same millisecond still differ
export function entryId(now = Date.now()): string {
  counter = (counter + 1) % 1296;
  return now.toString(36) + counter.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6);
}

// a new entry goes in front, past the limit the oldest leave
export function withEntry(list: HistoryEntry[], entry: HistoryEntry, limit = HISTORY_LIMIT): HistoryEntry[] {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, limit);
}

// the longer side of an area thumbnail, in pixels
export const THUMB_MAX = 160;

// the thumbnail keeps the shape of the area, a small area keeps its size
export function thumbSize(w: number, h: number, max = THUMB_MAX): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 1, h: 1 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export interface AreaCapture {
  rect: NormRect;
  frame: { w: number; h: number };
  thumbnail: string;
  stats: AreaStats;
}

// a captured area as a history entry, its color is the mean. with a calibration applied the entry keeps how far
// off the colors were at that time, the hold out error of the fit
export function areaEntry(capture: AreaCapture, cal: { holdout: { max: number } } | null, now = new Date()): HistoryEntry {
  const { mean } = capture.stats;
  return {
    id: entryId(now.getTime()),
    kind: 'area',
    time: now.toISOString(),
    rgb: clampRgb({ r: mean.r, g: mean.g, b: mean.b }),
    source: cal ? 'screen corrected' : 'screen',
    corrected: cal !== null,
    residual: cal ? cal.holdout.max : null,
    area: {
      rect: { ...capture.rect },
      frame: { ...capture.frame },
      thumbnail: capture.thumbnail,
      stats: capture.stats
    }
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isRgb(v: unknown): v is RGB {
  return isObject(v) && isNumber(v.r) && isNumber(v.g) && isNumber(v.b);
}

function isRect(v: unknown): v is NormRect {
  return isObject(v) && isNumber(v.x) && isNumber(v.y) && isNumber(v.w) && isNumber(v.h);
}

function isChannels(v: unknown): boolean {
  return isObject(v) && CHANNELS.every((c) => isNumber(v[c]));
}

function isStats(v: unknown): v is AreaStats {
  if (!isObject(v) || !isNumber(v.width) || !isNumber(v.height) || !isNumber(v.count)) return false;
  const hist = v.hist;
  if (!isObject(hist) || !CHANNELS.every((c) => Array.isArray(hist[c]) && (hist[c] as unknown[]).length === 256)) {
    return false;
  }
  return ['mean', 'median', 'std', 'min', 'max'].every((k) => isChannels(v[k])) && isRgb(v.dominant);
}

// an entry as it was stored, or null when a part is missing or of the wrong kind
export function parseEntry(v: unknown): HistoryEntry | null {
  if (!isObject(v)) return null;
  if (typeof v.id !== 'string' || !v.id) return null;
  if (v.kind !== 'pixel' && v.kind !== 'area') return null;
  if (typeof v.time !== 'string' || Number.isNaN(Date.parse(v.time))) return null;
  if (!isRgb(v.rgb) || !SOURCES.includes(v.source as Source)) return null;
  if (typeof v.corrected !== 'boolean') return null;
  if (v.residual !== null && !isNumber(v.residual)) return null;
  const entry: HistoryEntry = {
    id: v.id,
    kind: v.kind,
    time: v.time,
    rgb: clampRgb(v.rgb),
    source: v.source as Source,
    corrected: v.corrected,
    residual: v.residual
  };
  if (v.kind === 'area') {
    const a = v.area;
    if (!isObject(a) || !isRect(a.rect) || !isObject(a.frame) || typeof a.thumbnail !== 'string' || !isStats(a.stats)) {
      return null;
    }
    if (!isNumber(a.frame.w) || !isNumber(a.frame.h)) return null;
    entry.area = { rect: a.rect, frame: { w: a.frame.w, h: a.frame.h }, thumbnail: a.thumbnail, stats: a.stats };
  }
  return entry;
}

// what can be read back from storage, newest first, every id once, within the limit
export function parseHistory(raw: unknown, limit = HISTORY_LIMIT): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: HistoryEntry[] = [];
  for (const item of raw) {
    const entry = parseEntry(item);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  out.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  return out.slice(0, limit);
}

// a private window or a broken entry gives an empty history
export function loadHistory(storage: Pick<Storage, 'getItem'> | null): HistoryEntry[] {
  if (!storage) return [];
  try {
    const stored = storage.getItem(HISTORY_KEY);
    return stored ? parseHistory(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

function isQuota(err: unknown): boolean {
  const name = isObject(err) ? err.name : undefined;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

// writes the history and gives back what fit. a full storage costs the oldest entries, a few at a time
export function saveHistory(storage: Pick<Storage, 'setItem'> | null, list: HistoryEntry[]): HistoryEntry[] {
  let kept = list.slice(0, HISTORY_LIMIT);
  if (!storage) return kept;
  for (;;) {
    try {
      storage.setItem(HISTORY_KEY, JSON.stringify(kept));
      return kept;
    } catch (err) {
      if (!isQuota(err) || kept.length === 0) return kept;
      kept = kept.slice(0, kept.length - Math.max(1, Math.ceil(kept.length / 20)));
    }
  }
}

// the json export keeps every field, so a later version could read it back
export function historyJson(list: HistoryEntry[], now = new Date()): string {
  return JSON.stringify({ app: 'brainPICK', format: 1, exported: now.toISOString(), entries: list }, null, 2) + '\n';
}

function cell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// one row per entry for a spreadsheet, the area columns stay empty for a pixel
export function historyCsv(list: HistoryEntry[]): string {
  const rows = list.map((e) => {
    const c = clampRgb(e.rgb);
    const stats = e.area?.stats;
    return [
      e.id,
      e.kind,
      e.time,
      hex(c),
      c.r,
      c.g,
      c.b,
      e.source,
      e.corrected,
      e.residual,
      stats?.width,
      stats?.height,
      stats ? hex(stats.mean) : ''
    ]
      .map(cell)
      .join(',');
  });
  return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n';
}
