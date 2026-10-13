<script lang="ts">
  import { keyName } from '$lib/editor/actions';
  import { TOOL_INFO, calibrationStatus, toolHint, within } from '$lib/editor/tools';
  import { rgbText } from '$lib/core/color';
  import { activeTool } from '$lib/stores/app';
  import { preferences } from '$lib/stores/preferences';
  import { area, calibration, pointer, share } from '$lib/stores/session';

  const gate = $derived({ sharing: $share !== null, hasArea: $area !== null });
  const hint = $derived(toolHint($activeTool, gate, (id) => keyName(id, $preferences.shortcuts)));
  const status = $derived(calibrationStatus($calibration, $share));
  const calibrated = $derived(
    status === 'none' ? 'not calibrated' : status === 'other size' ? 'calibrate again' : `calibrated ${within($calibration!)}`
  );
</script>

<div class="status-bar">
  <div class="left">
    <span class="status-item tool">{TOOL_INFO[$activeTool].name.toLowerCase()}</span>
    <span class="sep"></span>
    <span class="status-item hint" title={hint}>{hint}</span>
  </div>

  <div class="right">
    <span class="status-item" class:live={$share !== null}>{$share ? `${$share.width} x ${$share.height}` : 'not sharing'}</span>
    <span class="sep"></span>
    <span class="status-item" title={status === 'other size' ? 'The stored calibration is for another frame size' : undefined}>
      {calibrated}
    </span>
    {#if $pointer}
      <span class="sep"></span>
      <span class="status-item">x {$pointer.x} y {$pointer.y}</span>
      <span class="sep"></span>
      <span class="status-item" title="The raw value under the pointer">rgb {rgbText($pointer.rgb)}</span>
    {/if}
    <span class="sep credit-sep"></span>
    <span class="status-item credit">
      made with <span class="heart">&hearts;</span> by
      <a href="https://swimmingbrain.dev" target="_blank" rel="noopener">Braian Plaku</a>
    </span>
  </div>
</div>

<style>
  .status-bar {
    height: var(--statusbar-h);
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    font-size: 10.5px;
    color: var(--text-muted);
    flex-shrink: 0;
    user-select: none;
    font-family: var(--font-editor);
  }

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 3px;
    min-width: 0;
  }

  .left {
    flex: 1;
    overflow: hidden;
  }

  .right {
    flex-shrink: 0;
  }

  .hint {
    display: block;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .tool {
    color: var(--text-secondary);
  }

  .live {
    color: var(--accent);
  }

  .sep {
    width: 1px;
    height: 10px;
    background: var(--border);
    margin: 0 4px;
  }

  .credit a {
    color: var(--accent);
    text-decoration: none;
  }

  .credit a:hover {
    color: var(--accent-hover);
  }

  .heart {
    color: var(--error);
    font-size: 11px;
  }

  @media (max-width: 900px) {
    .credit,
    .credit-sep {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .hint {
      display: none;
    }
  }
</style>
