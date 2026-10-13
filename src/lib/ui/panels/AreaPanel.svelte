<script lang="ts">
  import Panel from '../Panel.svelte';
  import { hex, type RGB } from '$lib/core/color';
  import { keyName } from '$lib/editor/actions';
  import { preferences } from '$lib/stores/preferences';
  import { capture, selectedEntry, type AreaStats, type PerChannel } from '$lib/stores/session';

  // the entry picked in the history wins, otherwise the latest capture
  const shown = $derived.by(() => {
    const entry = $selectedEntry;
    if (entry?.area) return { thumbnail: entry.area.thumbnail, stats: entry.area.stats, corrected: entry.corrected };
    if ($capture) return { thumbnail: $capture.thumbnail, stats: $capture.stats, corrected: $capture.corrected };
    return null;
  });
  const keys = $derived($preferences.shortcuts);
  const areaKey = $derived(keyName('tool.area', keys));
  const captureKey = $derived(keyName('tool.capture', keys));

  function rgb(c: PerChannel): RGB {
    return { r: c.r, g: c.g, b: c.b };
  }

  // 48 000, the thousands apart like the readouts on the stage
  function count(n: number): string {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function rows(s: AreaStats) {
    return [
      { label: 'Mean', title: 'The average of all pixels', color: rgb(s.mean), text: '' },
      { label: 'Median', title: 'The middle value, a few odd pixels do not move it', color: rgb(s.median), text: '' },
      {
        label: 'Std',
        title: 'How far the pixels spread, 0 is a flat color',
        color: null,
        text: `${s.std.r.toFixed(1)} ${s.std.g.toFixed(1)} ${s.std.b.toFixed(1)}`
      },
      { label: 'Min', title: 'The darkest value per channel', color: rgb(s.min), text: '' },
      { label: 'Max', title: 'The brightest value per channel', color: rgb(s.max), text: '' },
      { label: 'Dominant', title: 'The most common color, rounded to 8 steps per channel', color: s.dominant, text: '' },
      { label: 'Pixels', title: 'How many pixels the area holds', color: null, text: count(s.count) }
    ];
  }
</script>

<Panel
  icon="area"
  empty={shown
    ? undefined
    : `Draw an area on the shared screen${areaKey ? ` (${areaKey})` : ''} and capture it${captureKey ? ` (${captureKey})` : ''} to read its colors.`}>
  {#if shown}
    <div class="head">
      <img class="thumb" src={shown.thumbnail} alt="The captured area" />
      <div class="size">
        <span class="dims">{shown.stats.width} x {shown.stats.height} px</span>
        <span class="badge" class:corrected={shown.corrected}>{shown.corrected ? 'screen corrected' : 'screen'}</span>
      </div>
    </div>
    <h3 class="section">Statistics</h3>
    <ul class="rows">
      {#each rows(shown.stats) as row (row.label)}
        <li class="row">
          <span class="label" title={row.title}>{row.label}</span>
          {#if row.color}
            <span class="chip" style="background: {hex(row.color)}"></span>
            <span class="value">{hex(row.color)}</span>
            <span class="value muted">{Math.round(row.color.r)} {Math.round(row.color.g)} {Math.round(row.color.b)}</span>
          {:else}
            <span class="value">{row.text}</span>
          {/if}
        </li>
      {/each}
    </ul>
    <!-- the histogram of the capture goes under the rows -->
  {/if}
</Panel>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 8px 6px;
  }

  .thumb {
    width: 64px;
    height: 48px;
    object-fit: contain;
    background: var(--bg-deep);
    outline: 1px solid var(--border);
    image-rendering: pixelated;
  }

  .size {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
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
