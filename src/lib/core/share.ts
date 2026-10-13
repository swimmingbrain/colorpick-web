// the one place that talks to getdisplaymedia. the rest of the app sees the stream, its settings and when it ends

export type ShareSurface = 'monitor' | 'window' | 'browser';

export interface ShareSettings {
  width: number;
  height: number;
  surface: ShareSurface | null;
  fps: number;
}

// the dom library knows only audio and video, chromium reads the rest
interface ShareOptions extends DisplayMediaStreamOptions {
  video: MediaTrackConstraints & { cursor: 'never' };
  audio: false;
  selfBrowserSurface: 'exclude';
  surfaceSwitching: 'exclude';
}

let stream: MediaStream | null = null;
const endedHandlers = new Set<() => void>();

export function shareSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

// the whole screen at its real resolution, without the cursor in the frames
export function shareOptions(fps: number): ShareOptions {
  const dpr = window.devicePixelRatio || 1;
  return {
    video: {
      displaySurface: 'monitor',
      cursor: 'never',
      frameRate: { ideal: fps },
      width: { ideal: Math.round(screen.width * dpr) },
      height: { ideal: Math.round(screen.height * dpr) }
    },
    audio: false,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'exclude'
  };
}

function videoTrack(): MediaStreamTrack | null {
  return stream?.getVideoTracks()[0] ?? null;
}

// the browser's own stop button ends the track, the page hears about it here
function ended() {
  stream = null;
  for (const fn of [...endedHandlers]) fn();
}

export async function startShare(fps: number): Promise<MediaStream> {
  stopShare();
  const next = await navigator.mediaDevices.getDisplayMedia(shareOptions(fps));
  stream = next;
  next.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (stream === next) ended();
  });
  return next;
}

// stopping by hand fires no ended event, the caller resets what it showed
export function stopShare() {
  const old = stream;
  stream = null;
  old?.getTracks().forEach((t) => t.stop());
}

export function onEnded(fn: () => void): () => void {
  endedHandlers.add(fn);
  return () => endedHandlers.delete(fn);
}

export function currentStream(): MediaStream | null {
  return stream;
}

function surfaceOf(value: string | undefined): ShareSurface | null {
  return value === 'monitor' || value === 'window' || value === 'browser' ? value : null;
}

// what the browser actually delivers, the asked frame rate when it does not say
export function trackSettings(asked: number): ShareSettings | null {
  const track = videoTrack();
  if (!track) return null;
  const s = track.getSettings();
  const fps = s.frameRate && Number.isFinite(s.frameRate) && s.frameRate > 0 ? Math.round(s.frameRate) : asked;
  return {
    width: s.width ?? 0,
    height: s.height ?? 0,
    surface: surfaceOf(s.displaySurface),
    fps: Math.min(fps, asked)
  };
}
