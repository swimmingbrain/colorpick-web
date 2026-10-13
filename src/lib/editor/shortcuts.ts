import { createKeybindingsHandler, type KeybindingsMap } from 'tinykeys';
import { preferences } from '$lib/stores/preferences';
import { COMMANDS, keysOf, type Command } from './actions';
import { toTinykeys } from './keys';

// fields keep their keys, menus and dialogs handle their own
function ignored(e: Event): boolean {
  const el = e.target instanceof HTMLElement ? e.target : null;
  if (!el) return false;
  if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
  return el.closest('[role="dialog"], [role="menu"]') !== null;
}

function insideMenu(e: Event): boolean {
  const el = e.target instanceof HTMLElement ? e.target : null;
  return !!el?.closest('[role="dialog"], [role="menu"]');
}

// text picked on the page copies as text
function pickedText(): boolean {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  return !!sel && !sel.isCollapsed && sel.toString().trim() !== '';
}

function handlerFor(cmd: Command): (e: KeyboardEvent) => void {
  return (e) => {
    if (cmd.clipboard === 'copy' && pickedText()) return;
    e.preventDefault();
    cmd.run();
  };
}

// every command on its keys, the overrides from the preferences in place of the defaults
export function bindingsFor(overrides: Record<string, string>, global = false): KeybindingsMap {
  const map: KeybindingsMap = {};
  for (const cmd of COMMANDS) {
    if (global && !cmd.global) continue;
    for (const combo of keysOf(cmd.id, overrides)) {
      const key = toTinykeys(combo);
      if (key && !map[key]) map[key] = handlerFor(cmd);
    }
  }
  return map;
}

// one keydown listener for the whole editor. the bindings are made again whenever the shortcuts in the
// preferences change
export function installShortcuts(): () => void {
  let handler: (e: KeyboardEvent) => void = () => {};
  let fromFields: (e: KeyboardEvent) => void = () => {};
  let current: Record<string, string> | null = null;
  const off = preferences.subscribe((p) => {
    if (p.shortcuts === current) return;
    current = p.shortcuts;
    handler = createKeybindingsHandler(bindingsFor(p.shortcuts), { ignore: () => false });
    fromFields = createKeybindingsHandler(bindingsFor(p.shortcuts, true), { ignore: () => false });
  });
  const onkeydown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if (ignored(e)) {
      // export works while a field has the focus too, the browser would take the key
      if (!insideMenu(e) && (e.ctrlKey || e.metaKey)) fromFields(e);
      return;
    }
    handler(e);
  };
  window.addEventListener('keydown', onkeydown);
  return () => {
    off();
    window.removeEventListener('keydown', onkeydown);
  };
}
