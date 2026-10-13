import { writable } from 'svelte/store';
import type { Mode } from '$lib/editor/tools';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export const toasts = writable<Array<{ id: string; message: string; type: ToastType }>>([]);

let toastId = 0;
export function addToast(message: string, type: ToastType = 'info', duration = 3000) {
  const id = String(++toastId);
  // the same note again replaces the one still showing, so a key held down does not stack them
  toasts.update((t) => [...t.filter((toast) => toast.message !== message), { id, message, type }]);
  if (duration > 0) {
    setTimeout(() => {
      toasts.update((t) => t.filter((toast) => toast.id !== id));
    }, duration);
  }
  return id;
}

export function dismissToast(id: string) {
  toasts.update((t) => t.filter((toast) => toast.id !== id));
}

export type PreferencesCategory = 'general' | 'layout';

export type Dialog =
  | { kind: 'preferences'; category?: PreferencesCategory }
  | { kind: 'shortcuts' }
  | { kind: 'palette' }
  | { kind: 'about' }
  | { kind: 'confirm'; title: string; message: string; confirm: string; danger?: boolean; onconfirm: () => void };

export const dialog = writable<Dialog | null>(null);

export interface MenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  checked?: boolean;
  // a small swatch in front of the label
  color?: string;
  action?: () => void;
  children?: MenuItem[];
}

// what a click and a drag on the stage do: keep a pixel or draw the area
export const activeTool = writable<Mode>('pick');

// the preview fitted into the stage, or one frame pixel per css pixel
export const zoom = writable<'fit' | 'actual'>('fit');
// what hovering shows in the color panel and the status bar, the preview image itself is always raw
export const valueMode = writable<'raw' | 'corrected'>('corrected');
