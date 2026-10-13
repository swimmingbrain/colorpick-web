<script lang="ts">
  import Icon from '$lib/icons/Icon.svelte';
  import { TOOL_INFO } from '$lib/editor/tools';
  import { activeTool, valueMode, zoom } from '$lib/stores/app';
  import { activeCalibration, frame, share, type Surface } from '$lib/stores/session';

  const SURFACES: Record<Surface, string> = { monitor: 'Entire screen', window: 'Window', browser: 'Tab' };

  const sharing = $derived($share !== null);
  const source = $derived($share ? ($share.surface ? SURFACES[$share.surface] : 'Shared screen') : 'Nothing shared');
  const size = $derived($frame ?? $share);
  // without a calibration for this frame size there is nothing to correct, the values are raw
  const values = $derived($activeCalibration ? $valueMode : 'raw');
</script>

<div class="stagebar">
  <div class="crumbs">
    <span class="crumb" class:current={sharing}>
      <Icon name="share" size={13} />
      {source}
    </span>
  </div>

  <div class="options">
    <span class="tool-name">{TOOL_INFO[$activeTool].name}</span>
  </div>

  <div class="controls">
    <div class="seg" role="radiogroup" aria-label="Zoom">
      <button
        role="radio"
        class:on={$zoom === 'fit'}
        aria-checked={$zoom === 'fit'}
        disabled={!sharing}
        title="Fit the frame into the stage"
        onclick={() => zoom.set('fit')}>Fit</button>
      <button
        role="radio"
        class:on={$zoom === 'actual'}
        aria-checked={$zoom === 'actual'}
        disabled={!sharing}
        title="One frame pixel per screen pixel"
        onclick={() => zoom.set('actual')}>100%</button>
    </div>
    {#if sharing && size}
      <span class="sep"></span>
      <span class="readout" title="Size of the frame in pixels">{size.width} x {size.height}</span>
    {/if}
    <span class="sep"></span>
    <div class="seg" role="radiogroup" aria-label="Values while hovering">
      <button
        role="radio"
        class:on={values === 'raw'}
        aria-checked={values === 'raw'}
        disabled={!sharing}
        title="Hover values as the share delivers them"
        onclick={() => valueMode.set('raw')}>Raw</button>
      <button
        role="radio"
        class:on={values === 'corrected'}
        aria-checked={values === 'corrected'}
        disabled={!sharing || $activeCalibration === null}
        title={$activeCalibration ? 'Hover values with the calibration applied' : 'Calibrate first to correct the values'}
        onclick={() => valueMode.set('corrected')}>Corrected</button>
    </div>
    {#if sharing && $share}
      <span class="sep"></span>
      <span class="readout" title="Frames a second the share delivers">{$share.fps} fps</span>
    {/if}
  </div>
</div>

<style>
  .stagebar {
    height: var(--stagebar-h);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 6px 0 10px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    min-width: 0;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .crumb {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    color: var(--text-secondary);
  }

  .crumb :global(svg) {
    color: var(--text-muted);
  }

  .crumb.current {
    color: var(--text-primary);
  }

  .crumb.current :global(svg) {
    color: var(--accent);
  }

  .options {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 10px;
    border-left: 1px solid var(--border);
    height: 26px;
    overflow: hidden;
  }

  .tool-name {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .seg {
    display: flex;
    border: 1px solid var(--border);
  }

  .seg button {
    padding: 2px 9px;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .seg button + button {
    border-left: 1px solid var(--border);
  }

  .seg button:hover:not(:disabled) {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .seg button.on {
    color: var(--accent);
    background: var(--accent-dim);
  }

  .seg button:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .readout {
    font-family: var(--font-editor);
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    padding: 0 2px;
  }

  .sep {
    width: 1px;
    height: 16px;
    margin: 0 6px;
    background: var(--border);
  }

  @media (max-width: 600px) {
    .options {
      display: none;
    }
  }
</style>
