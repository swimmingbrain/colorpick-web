import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import {
  RECENT_COMMANDS,
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type Preferences
} from '$lib/editor/settings';

export { DOCK_BOTTOM, DOCK_TOP, MAX_DOCK, MIN_DOCK, type DockTab, type Preferences } from '$lib/editor/settings';

// the server and the tests have no local storage, the store keeps the defaults there
function storage(): Storage | null {
  if (!browser) return null;
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function createPreferencesStore() {
  const { subscribe, set, update } = writable<Preferences>(loadPreferences(storage()));

  return {
    subscribe,
    set(value: Preferences) {
      set(value);
      savePreferences(storage(), value);
    },
    update(fn: (prefs: Preferences) => Preferences) {
      update((current) => {
        const next = fn(current);
        savePreferences(storage(), next);
        return next;
      });
    }
  };
}

export const preferences = createPreferencesStore();

type Group = {
  [K in keyof Preferences]: Preferences[K] extends unknown[] ? never : Preferences[K] extends object ? K : never;
}[keyof Preferences];

// changes one group, like setGroup('stage', { loupe: false })
export function setGroup<K extends Group>(key: K, patch: Partial<Preferences[K]>) {
  preferences.update((p) => ({ ...p, [key]: { ...(p[key] as object), ...patch } }));
}

export function resetPreferences() {
  preferences.set(defaultPreferences());
}

// puts the given parts back to their defaults, the rest stays
export function resetParts(keys: (keyof Preferences)[]) {
  const defaults = defaultPreferences();
  preferences.update((p) => {
    const next = { ...p } as Record<string, unknown>;
    for (const key of keys) next[key] = defaults[key];
    return next as unknown as Preferences;
  });
}

export function rememberCommand(id: string) {
  preferences.update((p) => {
    if (p.recentCommands[0] === id) return p;
    return { ...p, recentCommands: [id, ...p.recentCommands.filter((r) => r !== id)].slice(0, RECENT_COMMANDS) };
  });
}
