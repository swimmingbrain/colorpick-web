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
  import { activeTool, zoom } from '$lib/stores/app';
  import { preferences } from '$lib/stores/preferences';
  import { current, frame, livePreview, pointer, share } from '$lib/stores/session';

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

  // canvases cannot read css variables, the tokens are read once
  let colors = { area: '#d19a66', fill: 'rgba(209, 154, 102, 0.08)', crosshair: 'rgba(255, 255, 255, 0.55)' };

  onMount(() => {
    dpr = window.devicePixelRatio || 1;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    colors = {
      area: token('--area', colors.area),
      fill: token('--area-fill', colors.fill),
      crosshair: token('--crosshair', colors.crosshair)
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
  }

  // the color panel keeps the last value, it is just not live anymore
  // a fresh frame for the pixel that is kept, the one read for hovering may be a moment old
  async function keepPixel(at: Point) {
    const img = (await grabFrame()) ?? latest;
    if (!img) return;
    latest = img;
    const px = pixelUnder(at, img);
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

  function onpointerleave() {
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
    if (cross && $activeTool === 'pick') drawCross(ctx, cross, view.scale);
  });
</script>

<svelte:window onresize={() => (dpr = window.devicePixelRatio || 1)} />

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
            class:picking={$activeTool === 'pick'}
            bind:this={overlay}
            tabindex="0"
            aria-label="Shared screen, click to keep the pixel under the pointer"
            {onclick}
            {onkeydown}
            {onpointermove}
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

  /* the drawn cross is the pointer while picking */
  .overlay.picking {
    cursor: none;
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
