import { startShare as begin, type Share } from './capture';

// the share of this session. the capture module talks to getdisplaymedia and reads the frames, the rest of the app
// sees the stream, its settings and when it ends

export type ShareSurface = 'monitor' | 'window' | 'browser';

export interface ShareSettings {
  width: number;
  height: number;
  surface: ShareSurface | null;
  fps: number;
}

let active: Share | null = null;
const endedHandlers = new Set<() => void>();

export function shareSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

// the whole screen at its real resolution and the asked frame rate, without the cursor where the browser allows
export async function startShare(fps: number): Promise<Share> {
  stopShare();
  const next = await begin({ frameRate: fps });
  active = next;
  // the browser's own stop button ends the track, the page hears about it here
  next.onended = () => {
    if (active !== next) return;
    active = null;
    for (const fn of [...endedHandlers]) fn();
  };
  return next;
}

// stopping by hand tells nobody, the caller resets what it showed
export function stopShare() {
  const old = active;
  active = null;
  old?.stop();
}

export function onEnded(fn: () => void): () => void {
  endedHandlers.add(fn);
  return () => endedHandlers.delete(fn);
}

export function currentShare(): Share | null {
  return active && !active.ended ? active : null;
}

export function currentStream(): MediaStream | null {
  return currentShare()?.stream ?? null;
}

function surfaceOf(value: string | undefined): ShareSurface | null {
  return value === 'monitor' || value === 'window' || value === 'browser' ? value : null;
}

// what the browser actually delivers, the asked frame rate when it does not say
export function trackSettings(asked: number): ShareSettings | null {
  const s = currentShare();
  if (!s) return null;
  const t = s.track.getSettings();
  const fps = t.frameRate && Number.isFinite(t.frameRate) && t.frameRate > 0 ? Math.round(t.frameRate) : asked;
  return {
    width: s.width || (t.width ?? 0),
    height: s.height || (t.height ?? 0),
    surface: surfaceOf(t.displaySurface),
    fps: Math.min(fps, asked)
  };
}
