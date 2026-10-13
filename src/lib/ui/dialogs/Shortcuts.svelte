<script lang="ts">
  import Dialog from '../Dialog.svelte';
  import { COMMANDS, keysOf } from '$lib/editor/actions';
  import { keyLabel } from '$lib/editor/keys';
  import { preferences } from '$lib/stores/preferences';

  let { onclose }: { onclose: () => void } = $props();

  interface Shortcut {
    keys: string[];
    what: string;
  }

  // what the pointer does on the stage, and the keys the preview and the histogram take while they have the focus.
  // these have no command of their own
  const POINTER: Shortcut[] = [
    { keys: ['Click'], what: 'Keep the pixel under the pointer, with Pick' },
    { keys: ['Drag'], what: 'Draw an area on the preview, with Area' },
    { keys: ['Drag inside'], what: 'Move the area' },
    { keys: ['Drag a handle'], what: 'Resize the area' }
  ];

  const FOCUSED: Shortcut[] = [
    { keys: ['Enter'], what: 'Keep the pixel under the crosshair' },
    { keys: ['Arrows'], what: 'Move the area a frame pixel, ten with Shift' },
    { keys: ['Left', 'Right'], what: 'Move the cursor bin of the histogram, ten with Shift' },
    { keys: ['Home', 'End'], what: 'Jump to the first or the last bin' }
  ];

  // the commands that have a key, in the groups of the command list, the keys in use
  const groups = $derived.by(() => {
    const out: { name: string; items: Shortcut[] }[] = [];
    for (const cmd of COMMANDS) {
      const keys = keysOf(cmd.id, $preferences.shortcuts);
      if (keys.length === 0) continue;
      let group = out.find((g) => g.name === cmd.group);
      if (!group) {
        group = { name: cmd.group, items: [] };
        out.push(group);
      }
      group.items.push({ keys: keys.map(keyLabel), what: cmd.label });
    }
    out.push({ name: 'Pointer', items: POINTER });
    out.push({ name: 'Preview and histogram', items: FOCUSED });
    return out;
  });
</script>

<Dialog
  title="Keyboard shortcuts"
  description="The keys the editor listens to, as they are set now."
  width={760}
  {onclose}>
  <div class="columns">
    {#each groups as group (group.name)}
      <section class="group">
        <h3 class="group-name">{group.name}</h3>
        {#each group.items as item, n (n)}
          <div class="row">
            <span class="keys">
              {#each item.keys as combo, k (k)}
                {#if k > 0}<span class="or">or</span>{/if}
                {#each combo.split(/\+(?=.)/) as key, i (i)}
                  {#if i > 0}<span class="plus">+</span>{/if}<kbd>{key}</kbd>
                {/each}
              {/each}
            </span>
            <span class="what">{item.what}</span>
          </div>
        {/each}
      </section>
    {/each}
  </div>
  {#snippet footer()}
    <button class="dialog-btn" onclick={onclose}>Close</button>
  {/snippet}
</Dialog>

<style>
  .columns {
    columns: 2;
    column-gap: 28px;
  }

  .group {
    break-inside: avoid;
    margin-bottom: 14px;
  }

  .group-name {
    font-family: var(--font-editor);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;
    margin-bottom: 4px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 24px;
    padding: 2px 0;
  }

  .keys {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 0 0 150px;
    flex-wrap: wrap;
  }

  .plus,
  .or {
    font-size: 10px;
    color: var(--text-muted);
  }

  .or {
    margin: 0 3px;
  }

  .what {
    font-size: 11.5px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .dialog-btn {
    padding: 6px 14px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
  }

  .dialog-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  @media (max-width: 560px) {
    .columns {
      columns: 1;
    }
  }
</style>
