import { get } from 'svelte/store';
import { activeTool, addToast, dialog, zoom } from '$lib/stores/app';
import { preferences, resetParts, setGroup } from '$lib/stores/preferences';
import {
  addEntry,
  area,
  clearEntries,
  current,
  frame,
  history,
  livePreview,
  pointer,
  removeEntry,
  selection,
  share,
  shown,
  type HistoryEntry,
  type Source
} from '$lib/stores/session';
import { hex, parseHex, rgbCss, type RGB } from '$lib/core/color';
import { onEnded, shareSupported, startShare, stopShare, trackSettings } from '$lib/core/share';
import { entryId, historyCsv, historyJson } from '$lib/core/history';
import { lockOf, lockText, type ToolId } from './tools';
import { keyLabel } from './keys';
import type { ToolbarSide } from './settings';

export const REPO = 'https://github.com/swimmingbrain/colorpick-web';

// one thing the app can do, for the keys, the menus, the palette and the shortcuts dialog
export interface Command {
  id: string;
  label: string;
  group: string;
  // the default combos, the first one is shown in menus
  keys: string[];
  run: () => void;
  // the browser would take these while a field has the focus, so they work from fields too
  global?: boolean;
  // text picked on the page keeps the browser's own copy, the command only runs without it
  clipboard?: 'copy';
}

// how the key a command answers to now reads, empty when it has none
export function keyName(id: string, overrides = get(preferences).shortcuts): string {
  const key = keysOf(id, overrides)[0];
  return key ? keyLabel(key) : '';
}

// a tool that cannot run says why instead of staying silent
function unlocked(id: ToolId): boolean {
  const lock = lockOf(id, { sharing: get(share) !== null, hasArea: get(area) !== null });
  if (!lock) return true;
  addToast(lockText(lock, (command) => keyName(command)), 'info');
  return false;
}

// the color the panel shows
function shownColor(): RGB | null {
  return get(shown)?.rgb ?? null;
}

function copyText(text: string) {
  if (!navigator.clipboard?.writeText) {
    addToast('This browser does not let the page write to the clipboard', 'warning', 4000);
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => addToast(`Copied ${text}`, 'success', 2000))
    .catch(() => addToast('The clipboard could not be written', 'error', 4000));
}

// the session forgets the share and what was under the pointer, the history and the area stay
function endSession() {
  share.set(null);
  frame.set(null);
  pointer.set(null);
  current.update((c) => (c?.live ? { ...c, live: false } : c));
  activeTool.set('pick');
}

onEnded(() => {
  endSession();
  addToast('Sharing ended');
});

let starting = false;

export function stopSharing() {
  if (!get(share)) return;
  stopShare();
  endSession();
}

export async function toggleShare() {
  if (get(share)) {
    stopSharing();
    return;
  }
  if (!shareSupported()) {
    addToast('This browser cannot share the screen, the eyedropper still works', 'warning', 5000);
    return;
  }
  // a second key press while the browser's picker is open would ask twice
  if (starting) return;
  starting = true;
  const fps = get(preferences).share.fps;
  try {
    await startShare(fps);
    share.set(trackSettings(fps) ?? { width: 0, height: 0, surface: null, fps });
  } catch (err) {
    // closing the browser's picker rejects too, that is no error
    if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
      addToast('The screen was not shared');
    } else {
      addToast('The screen could not be shared', 'error', 5000);
    }
  } finally {
    starting = false;
  }
}

// the dom library has no eyedropper yet, chromium browsers do
interface EyeDropperApi {
  open(): Promise<{ sRGBHex: string }>;
}

function eyedropper(): (new () => EyeDropperApi) | null {
  return (window as unknown as { EyeDropper?: new () => EyeDropperApi }).EyeDropper ?? null;
}

// a kept color shows in the color panel, goes first in the history and is the picked entry there
export function keepColor(rgb: RGB, source: Source, corrected = false, residual: number | null = null) {
  const entry: HistoryEntry = { id: entryId(), kind: 'pixel', time: new Date().toISOString(), rgb, source, corrected, residual };
  addEntry(entry);
  selection.set(entry.id);
  current.set({ rgb, raw: null, source, live: false });
  addToast(`Kept ${hex(rgb)}`, 'success', 2000);
}

let dropping = false;

export async function pick() {
  activeTool.set('pick');
  const Dropper = eyedropper();
  if (!Dropper) {
    const instead = get(share) ? 'click the preview to keep a pixel' : 'share the screen and click the preview instead';
    addToast(`This browser has no eyedropper, ${instead}`, 'info', 5000);
    return;
  }
  if (dropping) return;
  dropping = true;
  try {
    const rgb = parseHex((await new Dropper().open()).sRGBHex);
    if (rgb) keepColor(rgb, 'eyedropper');
  } catch {
    // escape closes the eyedropper without a color, there is nothing to say
  } finally {
    dropping = false;
  }
}

export function drawArea() {
  if (unlocked('area')) activeTool.set('area');
}

export function captureArea() {
  unlocked('capture');
}

export function toggleLive() {
  if (unlocked('live')) livePreview.update((on) => !on);
}

export function calibrate() {
  unlocked('calibrate');
}

function historyEmpty(): boolean {
  if (get(history).length > 0) return false;
  addToast('The history is empty, keep a color first');
  return true;
}

// the file is made in the tab and handed to the browser's downloads, nothing goes anywhere else
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  addToast(`Saved ${name}`, 'success', 2000);
}

export function exportJson() {
  if (!historyEmpty()) download('brainpick.json', historyJson(get(history)), 'application/json');
}

export function exportCsv() {
  if (!historyEmpty()) download('brainpick.csv', historyCsv(get(history)), 'text/csv;charset=utf-8');
}

export function clearHistory() {
  if (historyEmpty()) return;
  const count = get(history).length;
  dialog.set({
    kind: 'confirm',
    title: 'Clear history',
    message: `${count === 1 ? 'The entry leaves' : `All ${count} entries leave`} this browser. Export the history first if you want to keep it.`,
    confirm: 'Clear history',
    danger: true,
    onconfirm: clearEntries
  });
}

export function copyHex() {
  const c = shownColor();
  if (!c) addToast('Pick a color first');
  else copyText(hex(c));
}

export function copyRgb() {
  const c = shownColor();
  if (!c) addToast('Pick a color first');
  else copyText(rgbCss(c));
}

export function deleteEntry() {
  const id = get(selection);
  if (id === null) addToast('Select an entry in the history first');
  else removeEntry(id);
}

// escape lets go of one thing at a time: a dialog, then the picked history entry
export function escape() {
  if (get(dialog)) {
    dialog.set(null);
    return;
  }
  selection.set(null);
}

export function toggleLoupe() {
  setGroup('stage', { loupe: !get(preferences).stage.loupe });
}

export function toggleLog() {
  setGroup('histogram', { log: !get(preferences).histogram.log });
}

export function setToolbarSide(side: ToolbarSide) {
  setGroup('toolbar', { side });
}

export function resetPanels() {
  resetParts(['panels']);
}

export function openShortcuts() {
  dialog.set({ kind: 'shortcuts' });
}

export function openPreferences() {
  dialog.set({ kind: 'preferences' });
}

export function openPalette() {
  dialog.set({ kind: 'palette' });
}

export function openAbout() {
  dialog.set({ kind: 'about' });
}

export function openGithub() {
  window.open(REPO, '_blank', 'noopener');
}

function build(): Command[] {
  return [
    { id: 'share.toggle', label: 'Share screen or stop sharing', group: 'Share', keys: ['S'], run: toggleShare },

    { id: 'tool.pick', label: 'Pick a color', group: 'Tools', keys: ['F'], run: pick },
    { id: 'tool.area', label: 'Draw or move the area', group: 'Tools', keys: ['A'], run: drawArea },
    { id: 'tool.capture', label: 'Capture the area', group: 'Tools', keys: ['C'], run: captureArea },
    { id: 'tool.live', label: 'Live preview', group: 'Tools', keys: ['L'], run: toggleLive },
    { id: 'tool.calibrate', label: 'Calibrate', group: 'Tools', keys: ['K'], run: calibrate },

    { id: 'file.export-json', label: 'Export JSON', group: 'File', keys: ['Ctrl+E'], run: exportJson, global: true },
    { id: 'file.export-csv', label: 'Export CSV', group: 'File', keys: [], run: exportCsv },
    { id: 'file.clear', label: 'Clear history', group: 'File', keys: [], run: clearHistory },

    { id: 'edit.copy-hex', label: 'Copy hex', group: 'Edit', keys: ['Ctrl+C'], run: copyHex, clipboard: 'copy' },
    { id: 'edit.copy-rgb', label: 'Copy rgb', group: 'Edit', keys: [], run: copyRgb },
    { id: 'edit.delete', label: 'Delete entry', group: 'Edit', keys: ['Delete'], run: deleteEntry },
    { id: 'edit.escape', label: 'Cancel or close', group: 'Edit', keys: ['Escape'], run: escape },
    { id: 'edit.palette', label: 'Command palette', group: 'Edit', keys: ['Ctrl+K'], run: openPalette },
    { id: 'edit.preferences', label: 'Preferences', group: 'Edit', keys: ['Ctrl+,'], run: openPreferences },

    { id: 'view.fit', label: 'Fit in window', group: 'View', keys: [], run: () => zoom.set('fit') },
    { id: 'view.actual', label: 'Actual size', group: 'View', keys: [], run: () => zoom.set('actual') },
    { id: 'view.loupe', label: 'Loupe', group: 'View', keys: [], run: toggleLoupe },
    { id: 'view.log', label: 'Log histogram', group: 'View', keys: [], run: toggleLog },
    { id: 'view.toolbar-left', label: 'Toolbar on the left', group: 'View', keys: [], run: () => setToolbarSide('left') },
    { id: 'view.toolbar-right', label: 'Toolbar on the right', group: 'View', keys: [], run: () => setToolbarSide('right') },
    { id: 'view.reset-panels', label: 'Reset panels', group: 'View', keys: [], run: resetPanels },

    { id: 'help.shortcuts', label: 'Keyboard shortcuts', group: 'Help', keys: ['Shift+/'], run: openShortcuts },
    { id: 'help.about', label: 'About brainPICK', group: 'Help', keys: [], run: openAbout },
    { id: 'help.github', label: 'GitHub', group: 'Help', keys: [], run: openGithub }
  ];
}

export const COMMANDS: Command[] = build();

const byId = new Map(COMMANDS.map((c) => [c.id, c]));

export function commandById(id: string): Command | null {
  return byId.get(id) ?? null;
}

// the keys a command answers to: its own override, an empty one for none, or its defaults
export function keysOf(id: string, overrides: Record<string, string>): string[] {
  const cmd = byId.get(id);
  if (!cmd) return [];
  if (id in overrides) return overrides[id] ? [overrides[id]] : [];
  return cmd.keys;
}

// the combo menus and tooltips show for a command, empty when it has none
export function shortcutOf(id: string, overrides = get(preferences).shortcuts): string {
  return keysOf(id, overrides)[0] ?? '';
}

// a tooltip with the key a command answers to now, like Pick (F)
export function tip(name: string, id: string, overrides: Record<string, string>): string {
  const key = keysOf(id, overrides)[0];
  return key ? `${name} (${keyLabel(key)})` : name;
}
