<script lang="ts">
  import Panel from '../Panel.svelte';
  import Histogram from './Histogram.svelte';
  import { gray, hex, type RGB } from '$lib/core/color';
  import { thousands } from '$lib/core/histogram';
  import { keyName } from '$lib/editor/actions';
  import { STAT_VALUES } from '$lib/editor/settings';
  import { preferences, setGroup } from '$lib/stores/preferences';
  import { capture, selectedEntry, type AreaStats, type PerChannel } from '$lib/stores/session';

  // an entry picked in the history shows its stored thumbnail, the latest capture its full size picture, also
  // while its own entry is the picked one
  const shown = $derived.by(() => {
    const entry = $selectedEntry;
    if (entry?.area && entry.id !== $capture?.id) {
      return { picture: entry.area.thumbnail, stats: entry.area.stats, corrected: entry.corrected, time: entry.time };
    }
    if ($capture) {
      const { preview, stats, corrected, time } = $capture;
      return { picture: preview, stats, corrected, time };
    }
    return null;
  });

  const MAX_HEIGHT = 260;
  let frameWidth = $state(0);
  let natural = $state({ w: 0, h: 0 });
  // an enlarged picture shows whole pixels, a shrunk one is smoothed
  const pixels = $derived(natural.w > 0 && Math.min(frameWidth / natural.w, MAX_HEIGHT / natural.h) > 1);

  function loaded(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    natural = { w: img.naturalWidth, h: img.naturalHeight };
  }
  const keys = $derived($preferences.shortcuts);
  const values = $derived($preferences.area.values);
  const areaKey = $derived(keyName('tool.area', keys));
  const captureKey = $derived(keyName('tool.capture', keys));

  function rgb(c: PerChannel): RGB {
    return { r: c.r, g: c.g, b: c.b };
  }

  // the gray value as a swatch
  function level(v: number): RGB {
    return { r: v, g: v, b: v };
  }

  function when(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `captured ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }

  // a color row shows its rgb or its gray value, the chips next to the heading choose
  function rows(s: AreaStats) {
    const color = (label: string, title: string, c: RGB, g: number) => ({ label, title, color: c, gray: g, text: '' });
    const plain = (label: string, title: string, text: string) => ({ label, title, color: null, gray: null, text });
    const std =
      values === 'gray' ? s.std.gray.toFixed(1) : `${s.std.r.toFixed(1)} ${s.std.g.toFixed(1)} ${s.std.b.toFixed(1)}`;
    return [
      color('Mean', 'The average of all pixels', rgb(s.mean), s.mean.gray),
      color('Median', 'The middle value, a few odd pixels do not move it', rgb(s.median), s.median.gray),
      plain('Std', 'How far the pixels spread, 0 is a flat color', std),
      color('Min', 'The darkest value per channel', rgb(s.min), s.min.gray),
      color('Max', 'The brightest value per channel', rgb(s.max), s.max.gray),
      color('Dominant', 'The most common color, rounded to 8 steps per channel', s.dominant, gray(s.dominant)),
      plain('Pixels', 'How many pixels the area holds', thousands(s.count)),
      plain('Size', 'The width and height of the area in frame pixels', `${s.width} x ${s.height}`)
    ];
  }
</script>

<Panel
  icon="area"
  empty={shown
    ? undefined
    : `Draw an area on the shared screen${areaKey ? ` (${areaKey})` : ''} and capture it` +
      `${captureKey ? ` (${captureKey})` : ''} to read its colors.`}>
  {#if shown}
    <div class="head">
      <div class="frame" bind:clientWidth={frameWidth}>
        <img class="preview" class:pixels src={shown.picture} alt="The captured area" onload={loaded} />
      </div>
      <div class="meta">
        <span class="dims">{when(shown.time)}</span>
        <span class="badge" class:corrected={shown.corrected}>{shown.corrected ? 'screen corrected' : 'screen'}</span>
      </div>
    </div>
    <div class="heading">
      <h3 class="title">Statistics</h3>
      <div class="group" role="group" aria-label="Values">
        {#each STAT_VALUES as v (v)}
          <button
            class="choice"
            class:on={values === v}
            aria-pressed={values === v}
            title={v === 'gray' ? 'The gray value of each row' : 'Red, green and blue of each row'}
            onclick={() => setGroup('area', { values: v })}>{v}</button>
        {/each}
      </div>
    </div>
    <ul class="rows">
      {#each rows(shown.stats) as row (row.label)}
        <li class="row">
          <span class="label" title={row.title}>{row.label}</span>
          {#if row.color && row.gray !== null && values === 'gray'}
            <span class="chip" style="background: {hex(level(row.gray))}"></span>
            <span class="value">{row.gray}</span>
          {:else if row.color}
            <span class="chip" style="background: {hex(row.color)}"></span>
            <span class="value">{hex(row.color)}</span>
            <span class="value muted">{Math.round(row.color.r)} {Math.round(row.color.g)} {Math.round(row.color.b)}</span>
          {:else}
            <span class="value">{row.text}</span>
          {/if}
        </li>
      {/each}
    </ul>
    <h3 class="section">Histogram</h3>
    <Histogram stats={shown.stats} />
  {/if}
</Panel>

<style>
  .head {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 2px 8px 6px;
  }

  .frame {
    line-height: 0;
    background: var(--bg-deep);
    outline: 1px solid var(--border);
  }

  .preview {
    display: block;
    width: 100%;
    max-height: 260px;
    object-fit: contain;
  }

  .preview.pixels {
    image-rendering: pixelated;
  }

  .meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .dims {
    font-family: var(--font-editor);
    font-size: 12px;
    color: var(--text-primary);
  }

  .badge {
    padding: 1px 6px;
    font-family: var(--font-editor);
    font-size: 10px;
    color: var(--text-muted);
    border: 1px solid var(--border);
    background: var(--bg-deep);
  }

  .badge.corrected {
    color: var(--accent);
    border-color: rgba(209, 154, 102, 0.4);
  }

  .section {
    margin: 8px 8px 4px;
    padding-bottom: 4px;
    font-family: var(--font-editor);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }

  .heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 6px;
    margin: 8px 8px 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
  }

  .title {
    font-family: var(--font-editor);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .group {
    display: flex;
    gap: 3px;
  }

  .choice {
    padding: 0 6px;
    font-family: var(--font-editor);
    font-size: 10px;
    line-height: 15px;
    color: var(--text-muted);
    background: var(--bg-deep);
    border: 1px solid var(--border);
  }

  .choice:hover {
    color: var(--text-primary);
  }

  .choice.on {
    color: var(--accent);
    background: var(--accent-dim);
    border-color: rgba(209, 154, 102, 0.4);
  }

  .rows {
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 24px;
    padding: 2px 8px;
  }

  .label {
    flex: 0 0 70px;
    font-size: 11.5px;
    color: var(--text-secondary);
    cursor: help;
  }

  .chip {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    outline: 1px solid var(--border);
  }

  .value {
    font-family: var(--font-editor);
    font-size: 11.5px;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .value.muted {
    margin-left: auto;
    color: var(--text-muted);
  }
</style>
