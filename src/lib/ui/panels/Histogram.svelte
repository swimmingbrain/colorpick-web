<script lang="ts">
  import { onMount } from 'svelte';
  import {
    BINS,
    CHANNEL_NAMES,
    GRID,
    barHeight,
    binAt,
    binSpan,
    describeChannels,
    markers,
    moveBin,
    normalizeChannels,
    peakOf,
    readout,
    toggleChannel
  } from '$lib/core/histogram';
  import type { Channel } from '$lib/core/stats';
  import { preferences, setGroup } from '$lib/stores/preferences';
  import type { AreaStats } from '$lib/stores/session';

  let { stats }: { stats: AreaStats } = $props();

  const HEIGHT = 96;
  // room above the highest bar so a peak never touches the edge
  const HEADROOM = 4;
  const CHIPS: Channel[] = ['r', 'g', 'b', 'gray'];

  const channels = $derived(normalizeChannels($preferences.histogram.channels));
  const log = $derived($preferences.histogram.log);

  let canvas: HTMLCanvasElement | undefined = $state();
  let width = $state(0);
  let dpr = $state(1);
  let hover: number | null = $state(null);
  let cursor: number | null = $state(null);

  const active = $derived(hover ?? cursor);
  const line = $derived(
    active === null
      ? markers(stats.mean, stats.median, channels)
      : readout(stats.hist, channels, active, stats.count)
  );
  const label = $derived(describeChannels(stats, channels));

  // canvases cannot read css variables, the tokens are read once
  let colors = $state({
    deep: '#111113',
    grid: '#2e2e33',
    highlight: 'rgba(255, 255, 255, 0.12)',
    cursor: '#d4d4d8',
    fill: { r: '#5b2c30', g: '#2a5341', b: '#2c4664', gray: '#3b3b45' } as Record<Channel, string>,
    edge: { r: '#d9666e', g: '#5fb98a', b: '#5b8fd9', gray: '#a1a1aa' } as Record<Channel, string>
  });

  const TOKENS: Record<Channel, string> = { r: 'red', g: 'green', b: 'blue', gray: 'gray' };

  onMount(() => {
    dpr = window.devicePixelRatio || 1;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const fill = { ...colors.fill };
    const edge = { ...colors.edge };
    for (const c of CHIPS) {
      fill[c] = token(`--channel-${TOKENS[c]}`, fill[c]);
      edge[c] = token(`--channel-${TOKENS[c]}-edge`, edge[c]);
    }
    colors = {
      ...colors,
      deep: token('--bg-deep', colors.deep),
      grid: token('--border', colors.grid),
      cursor: token('--text-primary', colors.cursor),
      fill,
      edge
    };
  });

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = colors.deep;
    ctx.fillRect(0, 0, w, h);
    const px = Math.max(1, Math.round(dpr));
    const base = h - px;
    const room = base - Math.round(HEADROOM * dpr);

    ctx.fillStyle = colors.grid;
    for (const v of GRID) ctx.fillRect(Math.round((v / BINS) * w), 0, px, base);

    const peak = peakOf(stats.hist, channels, log);
    const tops = (c: Channel) => stats.hist[c].map((n) => base - barHeight(n, peak, log, room));
    // overlapping color channels add up like light, so where all three meet it turns pale
    ctx.globalCompositeOperation = channels.length > 1 ? 'screen' : 'source-over';
    for (const c of channels) {
      const top = tops(c);
      ctx.fillStyle = colors.fill[c];
      for (let i = 0; i < BINS; i++) {
        if (top[i] >= base) continue;
        const s = binSpan(i, w);
        ctx.fillRect(s.x, top[i], s.w, base - top[i]);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // a lighter edge along the tops, the shape reads even where the fills overlap
    ctx.lineWidth = px;
    for (const c of channels) {
      const top = tops(c);
      ctx.strokeStyle = colors.edge[c];
      ctx.beginPath();
      for (let i = 0; i < BINS; i++) {
        const s = binSpan(i, w);
        const y = Math.min(base, Math.round(top[i])) + px / 2;
        if (i === 0) ctx.moveTo(s.x, y);
        else ctx.lineTo(s.x, y);
        ctx.lineTo(s.x + s.w, y);
      }
      ctx.stroke();
    }

    // the mean is a solid line, the median a dashed one, in the color of the channel
    for (const c of channels) {
      ctx.strokeStyle = colors.edge[c];
      const marks: Array<[number, number[]]> = [
        [stats.mean[c], []],
        [stats.median[c], [3 * dpr, 3 * dpr]]
      ];
      for (const [value, dash] of marks) {
        const s = binSpan(Math.round(value), w);
        const x = s.x + Math.floor(s.w / 2) + px / 2;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, base);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // a bin is a pixel or two wide, the highlight is wider and has a light line in its middle so it can be found
    if (active !== null) {
      const s = binSpan(active, w);
      const pad = Math.max(2 * px, Math.round(3 * dpr) - Math.floor(s.w / 2));
      ctx.fillStyle = colors.highlight;
      ctx.fillRect(s.x - pad, 0, s.w + 2 * pad, base);
      ctx.fillStyle = colors.cursor;
      ctx.fillRect(s.x + Math.floor((s.w - px) / 2), 0, px, base);
    }

    ctx.fillStyle = colors.grid;
    ctx.fillRect(0, base, w, px);
  }

  // the canvas draws in device pixels and again whenever its width, the scale or what it shows changes
  $effect(() => {
    if (!canvas || width <= 0) return;
    const w = Math.round(width * dpr);
    const h = Math.round(HEIGHT * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) draw(ctx, w, h);
  });

  function onpointermove(e: PointerEvent) {
    if (!canvas) return;
    hover = binAt(e.offsetX, canvas.clientWidth);
  }

  // the arrows walk the bins so the readout works without a mouse
  function onkeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const next = moveBin(cursor, e.key, e.shiftKey, Math.round(stats.mean[channels[0]]));
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    cursor = next;
  }

  function toggle(c: Channel) {
    setGroup('histogram', { channels: toggleChannel(channels, c) });
  }
</script>

<svelte:window onresize={() => (dpr = window.devicePixelRatio || 1)} />

<div class="histogram">
  <div class="chips">
    <div class="group" role="group" aria-label="Channels">
      {#each CHIPS as c (c)}
        <button
          class="chip"
          class:on={channels.includes(c)}
          aria-pressed={channels.includes(c)}
          title={c === 'gray' ? 'Gray alone, or the three colors' : `Show ${CHANNEL_NAMES[c]}`}
          onclick={() => toggle(c)}>
          <span class="dot" style="background: {colors.edge[c]}"></span>
          {CHANNEL_NAMES[c]}
        </button>
      {/each}
    </div>
    <button
      class="chip"
      class:on={log}
      aria-pressed={log}
      title="Log scale, a few pixels still show next to a large flat area"
      onclick={() => setGroup('histogram', { log: !log })}>log</button>
  </div>
  <div class="plot" bind:clientWidth={width}>
    <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
    <canvas
      bind:this={canvas}
      role="img"
      tabindex="0"
      aria-label={label}
      style="height: {HEIGHT}px"
      {onpointermove}
      onpointerleave={() => (hover = null)}
      {onkeydown}
      onblur={() => (cursor = null)}></canvas>
  </div>
  <p class="readout" class:active={active !== null} aria-live="polite">{line}</p>
</div>

<style>
  .histogram {
    padding: 2px 8px 6px;
  }

  .chips {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 6px;
  }

  .group {
    display: flex;
    gap: 3px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    font-family: var(--font-editor);
    font-size: 10px;
    line-height: 16px;
    color: var(--text-muted);
    background: var(--bg-deep);
    border: 1px solid var(--border);
  }

  .chip:hover {
    color: var(--text-primary);
  }

  .chip.on {
    color: var(--accent);
    background: var(--accent-dim);
    border-color: rgba(209, 154, 102, 0.4);
  }

  .dot {
    width: 6px;
    height: 6px;
    flex-shrink: 0;
    opacity: 0.45;
  }

  .chip.on .dot {
    opacity: 1;
  }

  .plot {
    position: relative;
  }

  canvas {
    display: block;
    width: 100%;
    outline: 1px solid var(--border);
    touch-action: none;
  }

  canvas:focus-visible {
    outline-color: var(--accent);
  }

  .readout {
    margin-top: 5px;
    font-family: var(--font-editor);
    font-size: 10.5px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .readout.active {
    color: var(--text-primary);
  }
</style>
