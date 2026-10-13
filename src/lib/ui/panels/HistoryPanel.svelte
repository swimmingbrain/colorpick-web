<script lang="ts">
  import Panel from '../Panel.svelte';
  import Icon from '$lib/icons/Icon.svelte';
  import { hex } from '$lib/core/color';
  import { clearHistory, exportCsv, exportJson } from '$lib/editor/actions';
  import { history, removeEntry, selectEntry, selection, type HistoryEntry } from '$lib/stores/session';

  function label(e: HistoryEntry): string {
    if (e.kind === 'area' && e.area) return `area ${e.area.stats.width} x ${e.area.stats.height}`;
    return e.kind;
  }

  function time(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  const empty = $derived($history.length === 0);
</script>

<Panel icon="history" empty={empty ? 'Colors and areas you keep show up here.' : undefined}>
  {#if !empty}
    <ul class="list" aria-label="History">
      {#each $history as entry (entry.id)}
        <li class="item" class:selected={$selection === entry.id}>
          <button
            class="row"
            aria-pressed={$selection === entry.id}
            onclick={() => selectEntry($selection === entry.id ? null : entry.id)}>
            {#if entry.area}
              <img class="thumb" src={entry.area.thumbnail} alt="" />
            {:else}
              <span class="swatch" style="background: {hex(entry.rgb)}"></span>
            {/if}
            <span class="text">
              <span class="hex">{hex(entry.rgb)}</span>
              <span class="label">{label(entry)}</span>
            </span>
            <span class="meta">
              <span class="time">{time(entry.time)}</span>
              <span class="badge" class:corrected={entry.source === 'screen corrected'}>{entry.source}</span>
            </span>
          </button>
          <button
            class="icon-btn remove"
            title="Delete from the history"
            aria-label="Delete {hex(entry.rgb)} from the history"
            onclick={() => removeEntry(entry.id)}>
            <Icon name="trash" size={12} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</Panel>
<div class="foot">
  <button class="small-btn" disabled={empty} onclick={exportJson}>Export JSON</button>
  <button class="small-btn" disabled={empty} onclick={exportCsv}>Export CSV</button>
  <span class="grow"></span>
  <button class="small-btn danger" disabled={empty} onclick={clearHistory}>Clear</button>
</div>

<style>
  .list {
    list-style: none;
  }

  .item {
    position: relative;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
  }

  .item:hover {
    background: var(--bg-hover);
  }

  .item.selected {
    background: var(--accent-dim);
  }

  .row {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 30px 5px 8px;
    text-align: left;
  }

  .swatch,
  .thumb {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    outline: 1px solid var(--border);
    box-shadow: inset 0 0 0 1px var(--bg-deep);
  }

  .thumb {
    object-fit: cover;
    image-rendering: pixelated;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .hex {
    font-family: var(--font-editor);
    font-size: 11.5px;
    color: var(--text-primary);
  }

  .label {
    font-size: 10.5px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }

  .time {
    font-family: var(--font-editor);
    font-size: 10px;
    color: var(--text-muted);
  }

  .badge {
    padding: 0 5px;
    font-family: var(--font-editor);
    font-size: 9px;
    line-height: 14px;
    color: var(--text-muted);
    border: 1px solid var(--border);
    background: var(--bg-deep);
    white-space: nowrap;
  }

  .badge.corrected {
    color: var(--accent);
    border-color: rgba(209, 154, 102, 0.4);
  }

  /* the delete button shows on hover and is always there for the keyboard */
  .remove {
    position: absolute;
    right: 4px;
    top: 50%;
    margin-top: -11px;
    opacity: 0;
  }

  .item:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }

  .icon-btn {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .icon-btn:hover {
    color: var(--text-primary);
    background: var(--bg-elevated);
  }

  .foot {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-top: 1px solid var(--border);
    background: var(--bg-surface);
    flex-shrink: 0;
  }

  .grow {
    flex: 1;
  }

  .small-btn {
    padding: 4px 10px;
    font-size: 11.5px;
    white-space: nowrap;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
  }

  .small-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .small-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .small-btn.danger {
    color: var(--error);
    border-color: rgba(224, 108, 117, 0.5);
  }
</style>
