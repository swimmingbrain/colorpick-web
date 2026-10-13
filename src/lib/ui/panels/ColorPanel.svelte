<script lang="ts">
  import Panel from '../Panel.svelte';
  import Field from '../Field.svelte';
  import { gray, hex, hslText, rgbText, textOn } from '$lib/core/color';
  import { copyHex, keyName, tip } from '$lib/editor/actions';
  import { preferences } from '$lib/stores/preferences';
  import { shown } from '$lib/stores/session';

  const keys = $derived($preferences.shortcuts);
  const pickKey = $derived(keyName('tool.pick', keys));
</script>

<Panel
  icon="eyedropper"
  empty={$shown
    ? undefined
    : `Hover the shared screen or pick with the eyedropper${pickKey ? ` (${pickKey})` : ''} to see a color here.`}>
  {#if $shown}
    <div class="swatch" style="background: {hex($shown.rgb)}; color: {textOn($shown.rgb)}">
      {#if $shown.live}<span class="tag">live</span>{/if}
    </div>
    <div class="hex-row">
      <button class="hex" title={tip('Copy the hex', 'edit.copy-hex', keys)} onclick={copyHex}>{hex($shown.rgb)}</button>
      <span class="badge" class:corrected={$shown.source === 'screen corrected'}>{$shown.source}</span>
    </div>
    {#if $shown.raw}
      <p class="raw" title="What the share delivered before the calibration">raw {hex($shown.raw)}, {rgbText($shown.raw)}</p>
    {/if}
    <h3 class="section">Values</h3>
    <Field label="RGB" hint="Red, green and blue from 0 to 255">
      <span class="value">{rgbText($shown.rgb)}</span>
    </Field>
    <Field label="HSL" hint="Hue in degrees, saturation and lightness in percent">
      <span class="value">{hslText($shown.rgb)}</span>
    </Field>
    <Field label="Gray" hint="The brightness as one number from 0 to 255, the rec 601 luma">
      <span class="value">{gray($shown.rgb)}</span>
    </Field>
  {/if}
</Panel>

<style>
  .swatch {
    position: relative;
    height: 72px;
    margin: 2px 8px 8px;
    box-shadow: inset 0 0 0 1px var(--bg-deep);
    outline: 1px solid var(--border);
  }

  .tag {
    position: absolute;
    right: 6px;
    top: 5px;
    font-family: var(--font-editor);
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.8;
  }

  .hex-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 8px 2px;
  }

  .hex {
    padding: 2px 4px;
    margin-left: -4px;
    font-family: var(--font-editor);
    font-size: 15px;
    color: var(--text-primary);
    user-select: text;
  }

  .hex:hover {
    background: var(--bg-hover);
  }

  .badge {
    padding: 1px 6px;
    font-family: var(--font-editor);
    font-size: 10px;
    color: var(--text-muted);
    border: 1px solid var(--border);
    background: var(--bg-deep);
    white-space: nowrap;
  }

  .badge.corrected {
    color: var(--accent);
    border-color: rgba(209, 154, 102, 0.4);
  }

  .raw {
    padding: 0 8px;
    font-family: var(--font-editor);
    font-size: 10.5px;
    color: var(--text-muted);
  }

  .section {
    margin: 10px 8px 4px;
    padding-bottom: 4px;
    font-family: var(--font-editor);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }

  .value {
    font-family: var(--font-editor);
    font-size: 11.5px;
    color: var(--text-primary);
    user-select: text;
  }
</style>
