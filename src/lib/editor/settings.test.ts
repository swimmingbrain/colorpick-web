import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, defaultPreferences, loadPreferences, mergePreferences, savePreferences } from './settings';

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    }
  };
}

describe('mergePreferences', () => {
  it('gives the defaults for nothing stored', () => {
    expect(mergePreferences(null)).toEqual(defaultPreferences());
    expect(mergePreferences('not an object')).toEqual(defaultPreferences());
    expect(mergePreferences([1, 2])).toEqual(defaultPreferences());
  });

  it('keeps stored values and fills in keys added later', () => {
    const merged = mergePreferences({ toolbar: { side: 'right' }, stage: { loupe: false } });
    expect(merged.toolbar.side).toBe('right');
    expect(merged.stage.loupe).toBe(false);
    expect(merged.share).toEqual(defaultPreferences().share);
    expect(merged.panels).toEqual(defaultPreferences().panels);
  });

  it('drops values of the wrong type or outside the allowed set', () => {
    const merged = mergePreferences({
      toolbar: { side: 'top' },
      stage: { loupe: 'yes' },
      histogram: { log: 1 },
      share: { fps: 30 },
      panels: { dockWidth: 5000, dockSplit: -1, topTab: 'history', bottomTab: 'swatches' }
    });
    expect(merged.toolbar.side).toBe('left');
    expect(merged.stage.loupe).toBe(true);
    expect(merged.histogram.log).toBe(false);
    expect(merged.share.fps).toBe(5);
    expect(merged.panels.dockWidth).toBe(520);
    expect(merged.panels.dockSplit).toBe(0.15);
    expect(merged.panels.topTab).toBe('color');
    expect(merged.panels.bottomTab).toBe('history');
  });

  it('keeps every frame rate the share offers', () => {
    for (const fps of [2, 5, 10]) expect(mergePreferences({ share: { fps } }).share.fps).toBe(fps);
  });

  it('puts a narrow dock back to the least width and keeps the tab of each group', () => {
    const merged = mergePreferences({ panels: { dockWidth: 40, dockSplit: 0.4, topTab: 'area', bottomTab: 'calibration' } });
    expect(merged.panels.dockWidth).toBe(220);
    expect(merged.panels.dockSplit).toBe(0.4);
    expect(merged.panels.topTab).toBe('area');
    expect(merged.panels.bottomTab).toBe('calibration');
  });

  it('keeps shortcut overrides that are strings, an empty one takes a key away', () => {
    const merged = mergePreferences({ shortcuts: { 'tool.pick': 'I', 'tool.area': 4, 'tool.live': '' } });
    expect(merged.shortcuts).toEqual({ 'tool.pick': 'I', 'tool.live': '' });
  });

  it('keeps recent commands once each and only so many', () => {
    const merged = mergePreferences({
      recentCommands: ['tool.pick', 'tool.pick', 3, 'help.about', 'a', 'b', 'c', 'd', 'e', 'f', 'g']
    });
    expect(merged.recentCommands).toEqual(['tool.pick', 'help.about', 'a', 'b', 'c', 'd', 'e', 'f']);
  });
});

describe('preferences in storage', () => {
  it('reads what was saved', () => {
    const storage = memory();
    const p = { ...defaultPreferences(), toolbar: { side: 'right' as const } };
    savePreferences(storage, p);
    expect(JSON.parse(storage.data[STORAGE_KEY]).toolbar.side).toBe('right');
    expect(loadPreferences(storage)).toEqual(p);
  });

  it('gives the defaults for a broken entry, no storage or a storage that throws', () => {
    expect(loadPreferences(memory({ [STORAGE_KEY]: '{not json' }))).toEqual(defaultPreferences());
    expect(loadPreferences(null)).toEqual(defaultPreferences());
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      }
    };
    expect(loadPreferences(broken)).toEqual(defaultPreferences());
    expect(() => savePreferences(broken, defaultPreferences())).not.toThrow();
  });
});
