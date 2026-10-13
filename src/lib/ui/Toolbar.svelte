<script lang="ts">
  import Icon from '$lib/icons/Icon.svelte';
  import { commandById, copyHex, keyName, tip } from '$lib/editor/actions';
  import { TOOL_IDS, TOOL_INFO, lockOf, lockText, type ToolInfo } from '$lib/editor/tools';
  import { hex } from '$lib/core/color';
  import { activeTool } from '$lib/stores/app';
  import { preferences } from '$lib/stores/preferences';
  import { area, calibrating, livePreview, share, shown as color } from '$lib/stores/session';

  const tools = TOOL_IDS.map((id) => TOOL_INFO[id]);
  const keys = $derived($preferences.shortcuts);
  const right = $derived($preferences.toolbar.side === 'right');
  const gate = $derived({ sharing: $share !== null, hasArea: $area !== null });
  // the color the panel shows, the chip at the bottom keeps it in view
  const shown = $derived($color?.rgb ?? null);

  function pressed(tool: ToolInfo): boolean | undefined {
    if (tool.kind === 'mode') return $activeTool === tool.id;
    if (tool.kind === 'toggle') return gate.sharing && $livePreview;
    // calibrate stays lit while the card is on the stage
    if (tool.id === 'calibrate') return $calibrating;
    return undefined;
  }

  function title(tool: ToolInfo): string {
    const lock = lockOf(tool.id, gate);
    return lock ? lockText(lock, (id) => keyName(id, keys)) : tip(tool.name, tool.command, keys);
  }
</script>

<div class="toolbar" class:right role="toolbar" aria-label="Tools" aria-orientation="vertical">
  <div class="tools">
    {#each tools as tool, i (tool.id)}
      {@const locked = lockOf(tool.id, gate) !== null}
      {#if i > 0 && tools[i - 1].group !== tool.group}
        <span class="sep"></span>
      {/if}
      <button
        class="tool-btn"
        class:active={pressed(tool) === true}
        class:locked
        title={title(tool)}
        aria-label={tool.name}
        aria-pressed={pressed(tool)}
        aria-disabled={locked}
        onclick={() => commandById(tool.command)?.run()}>
        <Icon name={tool.icon} size={15} />
      </button>
    {/each}
  </div>

  <div class="colors">
    <button
      class="chip"
      class:none={shown === null}
      style={shown ? `--c: ${hex(shown)}` : ''}
      title={shown ? `${hex(shown)}, ${tip('click to copy', 'edit.copy-hex', keys)}` : 'No color yet'}
      aria-label={shown ? `Copy ${hex(shown)}` : 'No color yet'}
      onclick={copyHex}></button>
  </div>
</div>

<style>
  .toolbar {
    width: var(--toolbar-h);
    height: 100%;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
    overflow: hidden;
  }

  /* the tools scroll on a short window, the color chip stays in view */
  .tools {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 4px 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .tools::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .tool-btn:hover:not(.locked) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .tool-btn.active {
    background: var(--accent-dim);
    color: var(--accent);
  }

  /* a locked tool stays focusable, its tooltip says what it waits for */
  .tool-btn.locked {
    opacity: 0.35;
    cursor: default;
  }

  .toolbar.right {
    border-right: none;
    border-left: 1px solid var(--border);
  }

  .sep {
    width: 18px;
    height: 1px;
    margin: 3px 0;
    background: var(--border);
    flex-shrink: 0;
  }

  .colors {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }

  .chip {
    position: relative;
    width: 18px;
    height: 18px;
    outline: 1px solid var(--text-muted);
    background: var(--checker);
    background-size: 6px 6px;
  }

  .chip::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--c, #fff);
  }

  /* no color yet: white with the red slash of none */
  .chip.none {
    cursor: default;
    outline-color: var(--border);
  }

  .chip.none::after {
    content: '';
    position: absolute;
    inset: -3px auto -3px 50%;
    width: 1.5px;
    margin-left: -0.75px;
    background: var(--error);
    transform: rotate(45deg);
  }

  @media (max-width: 900px) {
    .toolbar,
    .toolbar.right {
      width: 100%;
      border-left: none;
      height: var(--toolbar-h);
      flex-direction: row;
      border-right: none;
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
      overflow-y: hidden;
    }

    .tools {
      flex-direction: row;
      padding: 0 4px;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .sep {
      width: 1px;
      height: 18px;
      margin: 0 3px;
    }

    .colors {
      flex-direction: row;
      padding: 0 8px;
      border-top: none;
      border-left: 1px solid var(--border);
    }
  }
</style>
