import { describe, expect, it } from 'vitest';
import {
  CSV_COLUMNS,
  HISTORY_KEY,
  HISTORY_LIMIT,
  entryId,
  historyCsv,
  historyJson,
  loadHistory,
  parseEntry,
  parseHistory,
  saveHistory,
  withEntry
} from './history';
import type { AreaStats, HistoryEntry } from '$lib/stores/session';

function pixel(id: string, minute = 0, extra: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id,
    kind: 'pixel',
    time: new Date(Date.UTC(2026, 9, 13, 18, minute)).toISOString(),
    rgb: { r: 225, g: 137, b: 122 },
    source: 'screen',
    corrected: false,
    residual: null,
    ...extra
  };
}

function stats(): AreaStats {
  const flat = Array.from({ length: 256 }, () => 0);
  return {
    width: 240,
    height: 200,
    count: 48000,
    hist: { r: flat, g: flat, b: flat, gray: flat },
    mean: { r: 47.4, g: 58, b: 79, gray: 56 },
    median: { r: 47, g: 58, b: 79, gray: 56 },
    std: { r: 1, g: 1, b: 1, gray: 1 },
    min: { r: 40, g: 50, b: 70, gray: 50 },
    max: { r: 60, g: 70, b: 90, gray: 66 },
    dominant: { r: 48, g: 56, b: 80 }
  };
}

function area(id: string, minute = 0): HistoryEntry {
  return {
    ...pixel(id, minute),
    kind: 'area',
    rgb: { r: 47, g: 58, b: 79 },
    source: 'screen corrected',
    corrected: true,
    residual: 1.2,
    area: { rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, frame: { w: 1920, h: 1080 }, thumbnail: 'data:image/png;base64,AA', stats: stats() }
  };
}

function memory(limit = Infinity) {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      if (value.length > limit) {
        const err = new Error('full');
        err.name = 'QuotaExceededError';
        throw err;
      }
      data[key] = value;
    }
  };
}

describe('history entries', () => {
  it('puts a new entry first and drops the oldest past the limit', () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 3; i++) list = withEntry(list, pixel(`e${i}`));
    expect(list).toHaveLength(HISTORY_LIMIT);
    expect(list[0].id).toBe(`e${HISTORY_LIMIT + 2}`);
    expect(list.at(-1)!.id).toBe('e3');
  });

  it('keeps an id only once', () => {
    const list = withEntry([pixel('a'), pixel('b')], pixel('a', 5));
    expect(list.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('makes ids that differ within the same millisecond', () => {
    const ids = new Set(Array.from({ length: 50 }, () => entryId(1000)));
    expect(ids.size).toBe(50);
  });

  it('reads back a pixel and an area as they were kept', () => {
    expect(parseEntry(pixel('a'))).toEqual(pixel('a'));
    expect(parseEntry(area('b'))).toEqual(area('b'));
  });

  it('turns away entries with missing or wrong parts', () => {
    expect(parseEntry(null)).toBeNull();
    expect(parseEntry({ ...pixel('a'), kind: 'swatch' })).toBeNull();
    expect(parseEntry({ ...pixel('a'), source: 'camera' })).toBeNull();
    expect(parseEntry({ ...pixel('a'), time: 'yesterday' })).toBeNull();
    expect(parseEntry({ ...pixel('a'), rgb: { r: 1, g: 2 } })).toBeNull();
    expect(parseEntry({ ...pixel('a'), residual: 'small' })).toBeNull();
    expect(parseEntry({ ...area('a'), area: undefined })).toBeNull();
    const bad = area('a');
    bad.area!.stats.hist.r = [1, 2, 3];
    expect(parseEntry(bad)).toBeNull();
  });

  it('sorts what it reads newest first and skips doubles and junk', () => {
    const list = parseHistory([pixel('old', 1), 'junk', pixel('new', 9), pixel('old', 4), area('mid', 5)]);
    expect(list.map((e) => e.id)).toEqual(['new', 'mid', 'old']);
    expect(parseHistory({ not: 'a list' })).toEqual([]);
  });
});

describe('history storage', () => {
  it('saves and loads under its own key', () => {
    const storage = memory();
    const list = [pixel('b', 2), area('a', 1)];
    expect(saveHistory(storage, list)).toEqual(list);
    expect(Object.keys(storage.data)).toEqual([HISTORY_KEY]);
    expect(loadHistory(storage)).toEqual(list);
  });

  it('gives an empty history for nothing, a broken entry or no storage', () => {
    expect(loadHistory(memory())).toEqual([]);
    expect(loadHistory({ getItem: () => '{not json' })).toEqual([]);
    expect(loadHistory(null)).toEqual([]);
    expect(saveHistory(null, [pixel('a')])).toHaveLength(1);
  });

  it('drops the oldest entries until the history fits a full storage', () => {
    const list = Array.from({ length: 10 }, (_, i) => pixel(`e${i}`, 10 - i));
    const one = JSON.stringify([list[0]]).length;
    const storage = memory(one * 6);
    const kept = saveHistory(storage, list);
    expect(kept.length).toBeLessThan(10);
    expect(kept.length).toBeGreaterThan(3);
    expect(kept.map((e) => e.id)).toEqual(list.slice(0, kept.length).map((e) => e.id));
    expect(loadHistory(storage)).toEqual(kept);
  });

  it('keeps everything in memory when the storage fails for another reason', () => {
    const storage = {
      setItem: () => {
        throw new Error('blocked');
      }
    };
    expect(saveHistory(storage, [pixel('a'), pixel('b')])).toHaveLength(2);
  });
});

describe('history exports', () => {
  it('writes json with every entry and when it was made', () => {
    const list = [area('a', 2), pixel('b', 1)];
    const parsed = JSON.parse(historyJson(list, new Date('2026-10-13T20:00:00.000Z')));
    expect(parsed.app).toBe('brainPICK');
    expect(parsed.exported).toBe('2026-10-13T20:00:00.000Z');
    expect(parsed.entries).toEqual(list);
    expect(parseHistory(parsed.entries)).toEqual(list);
  });

  it('writes one csv row per entry with the area columns empty for a pixel', () => {
    const lines = historyCsv([area('a', 2), pixel('b', 1, { residual: 0.8, corrected: true, source: 'screen corrected' })])
      .trimEnd()
      .split('\n');
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
    expect(lines[0]).toBe('id,kind,time,hex,r,g,b,source,corrected,residual,area_w,area_h,mean_hex');
    expect(lines[1]).toBe('a,area,2026-10-13T18:02:00.000Z,#2F3A4F,47,58,79,screen corrected,true,1.2,240,200,#2F3A4F');
    expect(lines[2]).toBe('b,pixel,2026-10-13T18:01:00.000Z,#E1897A,225,137,122,screen corrected,true,0.8,,,');
    expect(lines).toHaveLength(3);
  });

  it('quotes a field that holds a comma or a quote', () => {
    const csv = historyCsv([pixel('a,"b"')]);
    expect(csv.split('\n')[1].startsWith('"a,""b""",pixel')).toBe(true);
  });

  it('writes only the header for an empty history', () => {
    expect(historyCsv([])).toBe(CSV_COLUMNS.join(',') + '\n');
  });
});
