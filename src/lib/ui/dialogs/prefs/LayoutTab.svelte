<script lang="ts">
  import Section from './Section.svelte';
  import Field from '../../Field.svelte';
  import NumberField from '../../NumberField.svelte';
  import Slider from '../../Slider.svelte';
  import { MAX_DOCK, MIN_DOCK, preferences, resetParts, setGroup } from '$lib/stores/preferences';

  const p = $derived($preferences);
</script>

<Section title="Toolbar">
  <Field label="Side">
    <div class="seg" role="radiogroup" aria-label="Side of the toolbar">
      <button
        class:on={p.toolbar.side === 'left'}
        role="radio"
        aria-checked={p.toolbar.side === 'left'}
        onclick={() => setGroup('toolbar', { side: 'left' })}>Left</button>
      <button
        class:on={p.toolbar.side === 'right'}
        role="radio"
        aria-checked={p.toolbar.side === 'right'}
        onclick={() => setGroup('toolbar', { side: 'right' })}>Right</button>
    </div>
  </Field>
</Section>

<Section title="Panels" help="Dragging the edges of the dock sets these too. They are kept for the next visit.">
  <Field label="Dock width">
    <NumberField
      value={p.panels.dockWidth}
      min={MIN_DOCK}
      max={MAX_DOCK}
      precision={0}
      unit=" px"
      label="Dock width"
      onchange={(v) => setGroup('panels', { dockWidth: v })} />
  </Field>
  <Field label="Upper group" hint="How much of the dock the color and area panels take">
    <Slider
      value={Math.round(p.panels.dockSplit * 100)}
      min={15}
      max={85}
      precision={0}
      unit="%"
      label="Height of the upper group"
      onchange={(v) => setGroup('panels', { dockSplit: v / 100 })} />
  </Field>
  <Field label="">
    <button class="small-btn" onclick={() => resetParts(['panels'])}>Reset panels</button>
  </Field>
</Section>

<style>
  .seg {
    display: flex;
    flex: 1;
    border: 1px solid var(--border);
  }

  .seg button {
    flex: 1;
    padding: 3px 0;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .seg button + button {
    border-left: 1px solid var(--border);
  }

  .seg button:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .seg button.on {
    color: var(--accent);
    background: var(--accent-dim);
  }

  .small-btn {
    padding: 4px 10px;
    font-size: 11.5px;
    white-space: nowrap;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
  }

  .small-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
</style>
