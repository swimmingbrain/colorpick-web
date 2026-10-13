<script lang="ts">
  import { onMount } from 'svelte';
  import Logo from './Logo.svelte';
  import Icon from '$lib/icons/Icon.svelte';
  import { keyName, tip, toggleShare } from '$lib/editor/actions';
  import { attachVideo, fitView } from '$lib/core/frames';
  import { currentStream } from '$lib/core/share';
  import { zoom } from '$lib/stores/app';
  import { preferences } from '$lib/stores/preferences';
  import { livePreview, share } from '$lib/stores/session';

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

  onMount(() => {
    dpr = window.devicePixelRatio || 1;
    return () => attachVideo(null);
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

  // the overlay draws in device pixels so its lines stay sharp
  $effect(() => {
    if (!overlay || !view) return;
    const w = Math.max(1, Math.round(view.w * dpr));
    const h = Math.max(1, Math.round(view.h * dpr));
    if (overlay.width !== w) overlay.width = w;
    if (overlay.height !== h) overlay.height = h;
  });
</script>

<svelte:window onresize={() => (dpr = window.devicePixelRatio || 1)} />

<section class="stage" aria-label="Stage" bind:clientWidth={stageW} bind:clientHeight={stageH}>
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
          <canvas class="overlay" bind:this={overlay}></canvas>
        </div>
      </div>
    </div>
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
