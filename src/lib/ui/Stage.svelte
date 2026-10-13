<script lang="ts">
  import { onMount } from 'svelte';
  import Logo from './Logo.svelte';
  import Loupe from './Loupe.svelte';
  import Icon from '$lib/icons/Icon.svelte';
  import { keepColor, keyName, tip, toggleShare } from '$lib/editor/actions';
  import {
    attachVideo,
    block,
    fitView,
    framePoint,
    grabFrame,
    pixelAt,
    pixelUnder,
    readInterval,
    type Pixels,
    type Point
  } from '$lib/core/frames';
  import { currentStream } from '$lib/core/share';
  import { hex } from '$lib/core/color';
  import {
    HANDLES,
    cursorFor,
    handlePoints,
    hitRect,
    moveRect,
    resizeRect,
    spanRect,
    toNorm,
    toPixels,
    type Handle,
    type Hit,
    type PxRect
  } from '$lib/core/area';
  import { activeTool, zoom } from '$lib/stores/app';
  import { preferences } from '$lib/stores/preferences';
  import { area, current, frame, livePreview, pointer, share } from '$lib/stores/session';

  const keys = $derived($preferences.shortcuts);
  const pickKey = $derived(keyName('tool.pick', keys));
  const liveKey = $derived(keyName('tool.live', keys));

  let stageW = $state(0);
  let stageH = $state(0);
  let dpr = $state(1);
  let video: HTMLVideoElement | undefined = $state();
  let overlay: HTMLCanvasElement | undefined = $state();

  const size = $derived($share && $share.width > 0 && $share.height > 0 ? $share : null);
  const view = $derived(size ? fitView(size, { width: stageW, height: stageH }, $zoom, dpr) : null);

  // a handle is drawn this big and can be taken a little outside it, in css pixels
  const HANDLE = 7;
  const REACH = 6;
  // a press that moves less than this is a click, it draws no area
  const DRAG_START = 3;

  type Drag =
    | { kind: 'draw'; start: Point; from: Point; moved: boolean }
    | { kind: 'move'; start: Point; rect: PxRect }
    | { kind: 'resize'; handle: Handle; rect: PxRect };

  let drag: Drag | null = $state.raw(null);
  // the rectangle while it is dragged, the store takes it on release
  let draft: PxRect | null = $state(null);
  // what the pointer would take hold of in area mode, for the cursor
  let hit: Hit = $state(null);
  let dragging = $state(false);

  const editing = $derived($activeTool === 'area');
  const rect = $derived(size && $area ? toPixels($area, size) : null);
  const shownRect = $derived(draft ?? rect);
  const cursor = $derived.by(() => {
    if (!editing) return 'none';
    if (drag?.kind === 'resize') return cursorFor(drag.handle);
    if (drag?.kind === 'move') return 'move';
    return dragging ? 'crosshair' : cursorFor(hit);
  });

  // canvases cannot read css variables, the tokens are read once
  let colors = {
    area: '#d19a66',
    fill: 'rgba(209, 154, 102, 0.08)',
    crosshair: 'rgba(255, 255, 255, 0.55)',
    deep: '#111113'
  };

  onMount(() => {
    dpr = window.devicePixelRatio || 1;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    colors = {
      area: token('--area', colors.area),
      fill: token('--area-fill', colors.fill),
      crosshair: token('--crosshair', colors.crosshair),
      deep: token('--bg-deep', colors.deep)
    };
    return () => {
      stopReading();
      attachVideo(null);
    };
  });

  // the latest frame stays out of svelte state, only what was read from it goes into the stores
  let latest: ImageData | null = null;
  // the pointer in frame pixels while it is over the frame
  let hover: Point | null = null;
  // the whole pixel under the pointer, the crosshair marks it
  let cross: Point | null = $state(null);
  // the loupe follows the pointer in stage pixels and shows the pixels around it
  let at: Point | null = $state(null);
  let lens: Pixels | null = $state.raw(null);
  let stageEl: HTMLElement | undefined = $state();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let raf = 0;
  let grabbing = false;
  let lastGrab = 0;

  function local(e: MouseEvent): Point {
    const r = overlay!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // frames are read at the share rate while the pointer is over the stage, so a still pointer sees the screen change
  function schedule() {
    if (timer || grabbing || !$share) return;
    const wait = Math.max(0, lastGrab + readInterval($share.fps) - performance.now());
    timer = setTimeout(grab, wait);
  }

  async function grab() {
    timer = null;
    if (!hover) return;
    grabbing = true;
    lastGrab = performance.now();
    try {
      const img = await grabFrame();
      if (img) {
        latest = img;
        frame.set({ width: img.width, height: img.height, time: Date.now() });
      }
    } finally {
      grabbing = false;
    }
    read();
    if (hover) schedule();
  }

  // one read per animation frame at most, however fast the pointer moves
  function requestRead() {
    if (!raf) raf = requestAnimationFrame(read);
  }

  function read() {
    raf = 0;
    if (!hover || !latest) return;
    const px = pixelUnder(hover, latest);
    const rgb = px ? pixelAt(latest, px.x, px.y) : null;
    if (!px || !rgb) return;
    lens = block(latest, px.x, px.y);
    const was = $pointer;
    const same = was && was.x === px.x && was.y === px.y && was.rgb.r === rgb.r && was.rgb.g === rgb.g && was.rgb.b === rgb.b;
    if (same && $current?.live) return;
    pointer.set({ x: px.x, y: px.y, rgb });
    current.set({ rgb, raw: null, source: 'screen', live: true });
  }

  function stopReading() {
    if (timer) clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
    timer = null;
    raf = 0;
    hover = null;
    cross = null;
    at = null;
    lens = null;
  }

  function onpointermove(e: PointerEvent) {
    if (!view || !size) return;
    const p = local(e);
    hover = framePoint(view, p.x, p.y);
    cross = pixelUnder(hover, size);
    const s = stageEl!.getBoundingClientRect();
    at = { x: e.clientX - s.left, y: e.clientY - s.top };
    requestRead();
    schedule();
    if (drag) follow(drag, hover, p);
    else hit = editing && rect ? hitRect(rect, hover, REACH / view.scale) : null;
  }

  function follow(d: Drag, p: Point, css: Point) {
    if (!size) return;
    if (d.kind === 'draw') {
      if (!d.moved && Math.hypot(css.x - d.from.x, css.y - d.from.y) < DRAG_START) return;
      d.moved = true;
      dragging = true;
      draft = spanRect(d.start, p, size);
    } else if (d.kind === 'move') {
      draft = moveRect(d.rect, p.x - d.start.x, p.y - d.start.y, size);
    } else {
      draft = resizeRect(d.rect, d.handle, p, size);
    }
  }

  // pointer events and not mouse events, so a pen or a finger can draw the area too
  function onpointerdown(e: PointerEvent) {
    if (!editing || e.button !== 0 || !view || !size) return;
    const css = local(e);
    const p = framePoint(view, css.x, css.y);
    const h = rect ? hitRect(rect, p, REACH / view.scale) : null;
    if (rect && h) drag = h === 'inside' ? { kind: 'move', start: p, rect } : { kind: 'resize', handle: h, rect };
    else drag = { kind: 'draw', start: p, from: css, moved: false };
    overlay?.setPointerCapture(e.pointerId);
  }

  function endDrag(e: PointerEvent | null, keep: boolean) {
    if (keep && draft && size) area.set(toNorm(draft, size));
    drag = null;
    draft = null;
    dragging = false;
    if (e && overlay?.hasPointerCapture(e.pointerId)) overlay.releasePointerCapture(e.pointerId);
  }

  function onpointerup(e: PointerEvent) {
    if (drag) endDrag(e, true);
  }

  function onpointercancel(e: PointerEvent) {
    if (drag) endDrag(e, false);
  }

  // escape lets go of a drag before it closes anything else, the area stays as it was
  function onwindowkey(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !drag) return;
    e.preventDefault();
    e.stopPropagation();
    endDrag(null, false);
  }

  $effect(() => {
    if (!editing && drag) endDrag(null, false);
  });

  // a fresh frame for the pixel that is kept, the one read for hovering may be a moment old
  async function keepPixel(p: Point) {
    const img = (await grabFrame()) ?? latest;
    if (!img) return;
    latest = img;
    const px = pixelUnder(p, img);
    const rgb = px ? pixelAt(img, px.x, px.y) : null;
    if (rgb) keepColor(rgb, 'screen');
  }

  function onclick(e: MouseEvent) {
    if ($activeTool !== 'pick' || !view) return;
    const p = local(e);
    keepPixel(framePoint(view, p.x, p.y));
  }

  function onkeydown(e: KeyboardEvent) {
    if ($activeTool === 'pick' && e.key === 'Enter' && cross) {
      e.preventDefault();
      keepPixel({ x: cross.x + 0.5, y: cross.y + 0.5 });
    }
  }

  // the color panel keeps the last value, it is just not live anymore
  function onpointerleave() {
    if (drag) return;
    stopReading();
    pointer.set(null);
    current.update((c) => (c?.live ? { ...c, live: false } : c));
  }

  $effect(() => {
    if (!$share) {
      stopReading();
      latest = null;
    }
  });

  // the video plays the stream of the share and is the source the frames are read from
  $effect(() => {
    if (!video) return;
    const stream = $share ? currentStream() : null;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      if (stream) video.play().catch(() => {});
    }
    attachVideo(stream ? video : null);
  });

  // the frame size comes from the video itself, the track settings can be off before the first frame
  function measure() {
    if (!video?.videoWidth || !video.videoHeight) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    share.update((s) => (s && (s.width !== w || s.height !== h) ? { ...s, width: w, height: h } : s));
  }

  function drawCross(ctx: CanvasRenderingContext2D, px: Point, scale: number) {
    // the middle of the pixel in device pixels, on a half pixel so the lines stay one pixel wide
    const cx = Math.round((px.x + 0.5) * scale * dpr) + 0.5;
    const cy = Math.round((px.y + 0.5) * scale * dpr) + 0.5;
    const gap = Math.round(Math.max(4, (scale * dpr) / 2 + 3));
    const arm = Math.round(12 * dpr);
    const lines = () => {
      ctx.beginPath();
      ctx.moveTo(cx - gap - arm, cy);
      ctx.lineTo(cx - gap, cy);
      ctx.moveTo(cx + gap, cy);
      ctx.lineTo(cx + gap + arm, cy);
      ctx.moveTo(cx, cy - gap - arm);
      ctx.lineTo(cx, cy - gap);
      ctx.moveTo(cx, cy + gap);
      ctx.lineTo(cx, cy + gap + arm);
      ctx.stroke();
    };
    // a dark line under the light one, so the cross shows on white and on black
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    lines();
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.crosshair;
    lines();
  }

  // the size label sits above the rectangle, inside it when there is no room above
  function drawLabel(ctx: CanvasRenderingContext2D, r: PxRect, x0: number, y0: number, width: number) {
    const text = `${r.w} x ${r.h}`;
    ctx.font = `500 ${Math.round(10.5 * dpr)}px 'JetBrains Mono', monospace`;
    const padX = Math.round(5 * dpr);
    const h = Math.round(16 * dpr);
    const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
    const gap = Math.round(4 * dpr);
    let y = y0 - gap - h;
    if (y < 0) y = y0 + gap;
    const x = Math.max(0, Math.min(x0, width - w));
    ctx.fillStyle = colors.area;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#111';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + padX, y + h / 2 + 0.5);
  }

  // the rectangle with its handles while it can be edited, a quiet outline while picking
  function drawArea(ctx: CanvasRenderingContext2D, r: PxRect, scale: number, width: number) {
    const k = scale * dpr;
    const x0 = Math.round(r.x * k);
    const y0 = Math.round(r.y * k);
    const x1 = Math.round((r.x + r.w) * k);
    const y1 = Math.round((r.y + r.h) * k);
    const line = Math.max(1, Math.round(dpr));
    const half = line / 2;
    ctx.save();
    if (editing) {
      ctx.fillStyle = colors.fill;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    } else {
      ctx.globalAlpha = 0.5;
    }
    // a dark rim outside the accent line, so the edge shows on a light screen too
    ctx.lineWidth = line;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeRect(x0 - line - half, y0 - line - half, x1 - x0 + line * 3, y1 - y0 + line * 3);
    ctx.strokeStyle = colors.area;
    ctx.strokeRect(x0 - half, y0 - half, x1 - x0 + line, y1 - y0 + line);
    ctx.restore();
    if (!editing) return;
    const side = Math.round(HANDLE * dpr);
    const points = handlePoints(r);
    for (const h of HANDLES) {
      const hx = Math.round(points[h].x * k - side / 2);
      const hy = Math.round(points[h].y * k - side / 2);
      ctx.fillStyle = colors.deep;
      ctx.fillRect(hx, hy, side, side);
      ctx.lineWidth = line;
      ctx.strokeStyle = colors.area;
      ctx.strokeRect(hx + half, hy + half, side - line, side - line);
    }
    drawLabel(ctx, r, x0, y0, width);
  }

  // the overlay draws in device pixels so its lines stay sharp
  $effect(() => {
    if (!overlay || !view) return;
    const w = Math.max(1, Math.round(view.w * dpr));
    const h = Math.max(1, Math.round(view.h * dpr));
    if (overlay.width !== w) overlay.width = w;
    if (overlay.height !== h) overlay.height = h;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (shownRect) drawArea(ctx, shownRect, view.scale, w);
    if (cross && !editing) drawCross(ctx, cross, view.scale);
  });
</script>

<svelte:window onresize={() => (dpr = window.devicePixelRatio || 1)} onkeydowncapture={onwindowkey} />

<section class="stage" aria-label="Stage" bind:this={stageEl} bind:clientWidth={stageW} bind:clientHeight={stageH}>
  {#if $share}
    <div class="scroller" class:actual={$zoom === 'actual'}>
      <div class="content" style="width: {view?.contentW ?? 0}px; height: {view?.contentH ?? 0}px">
        <div
          class="frame"
          style="left: {view?.x ?? 0}px; top: {view?.y ?? 0}px; width: {view?.w ?? 0}px; height: {view?.h ?? 0}px">
          <!-- a hidden preview is clipped, not removed, so the frames keep coming -->
          <video
            class="video"
            class:hidden={!$livePreview}
            bind:this={video}
            muted
            playsinline
            autoplay
            onloadedmetadata={measure}
            onresize={measure}></video>
          {#if !$livePreview}
            <p class="off">Live preview is off, the screen is still read{liveKey ? ` (${liveKey})` : ''}</p>
          {/if}
          <canvas
            class="overlay"
            style:cursor
            bind:this={overlay}
            tabindex="0"
            aria-label={editing
              ? 'Shared screen, drag to draw the area, drag a handle to resize it'
              : 'Shared screen, click to keep the pixel under the pointer'}
            {onclick}
            {onkeydown}
            {onpointerdown}
            {onpointermove}
            {onpointerup}
            {onpointercancel}
            {onpointerleave}></canvas>
        </div>
      </div>
    </div>
    {#if $preferences.stage.loupe && at && lens && $current}
      <Loupe pixels={lens} hex={hex($current.rgb)} {at} bounds={{ w: stageW, h: stageH }} />
    {/if}
  {:else}
    <div class="empty">
      <span class="mark"><Logo size={40} /></span>
      <p class="lead">Share your screen to read any pixel or area of it.</p>
      <button class="share-btn" onclick={toggleShare} title={tip('Share screen', 'share.toggle', keys)}>
        <Icon name="share" size={14} />
        Share screen
      </button>
      <p class="aside">Pick with the eyedropper works without sharing{pickKey ? ` (${pickKey})` : ''}</p>
    </div>
  {/if}
</section>

<style>
  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: var(--pasteboard);
  }

  .scroller {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  /* at 100% a large frame does not fit, the stage scrolls */
  .scroller.actual {
    overflow: auto;
  }

  .content {
    position: relative;
  }

  .frame {
    position: absolute;
    background: var(--bg-surface);
    box-shadow: 0 2px 16px var(--stage-shadow);
  }

  .video {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
  }

  .video.hidden {
    clip-path: inset(50%);
  }

  .off {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
  }

  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
    will-change: transform;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    text-align: center;
  }

  .mark {
    display: flex;
    color: var(--accent);
    margin-bottom: 4px;
  }

  .lead {
    font-size: 13px;
    color: var(--text-secondary);
    max-width: 320px;
    line-height: 1.5;
  }

  .share-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    font-size: 12.5px;
    font-weight: 500;
    color: #111;
    background: var(--accent);
    border: 1px solid var(--accent);
  }

  .share-btn:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  .aside {
    font-size: 11.5px;
    color: var(--text-muted);
  }
</style>
