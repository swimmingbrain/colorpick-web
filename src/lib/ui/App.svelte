<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from './TopBar.svelte';
  import MenuBar from './MenuBar.svelte';
  import Toolbar from './Toolbar.svelte';
  import StageBar from './StageBar.svelte';
  import Stage from './Stage.svelte';
  import Dock from './Dock.svelte';
  import Resizer from './Resizer.svelte';
  import StatusBar from './StatusBar.svelte';
  import Dialogs from './Dialogs.svelte';
  import { MAX_DOCK, MIN_DOCK, preferences, setGroup } from '$lib/stores/preferences';
  import { installShortcuts } from '$lib/editor/shortcuts';
  import { stopSharing } from '$lib/editor/actions';

  // what the stage keeps at the least when the dock grows
  const MIN_STAGE_W = 320;

  let mainWidth = $state(0);

  const dockWidth = $derived($preferences.panels.dockWidth);
  const right = $derived($preferences.toolbar.side === 'right');
  // the tool column sits left or right of the stage, the dock stays on the right
  const grid = $derived(
    right
      ? `grid-template-columns: minmax(0, 1fr) var(--toolbar-h) 3px ${dockWidth}px`
      : `grid-template-columns: var(--toolbar-h) minmax(0, 1fr) 3px ${dockWidth}px`
  );

  function resizeDock(delta: number) {
    const limit = Math.min(MAX_DOCK, mainWidth - MIN_STAGE_W);
    setGroup('panels', { dockWidth: Math.max(MIN_DOCK, Math.min(dockWidth - delta, limit)) });
  }

  onMount(() => {
    const off = installShortcuts();
    // leaving the editor ends the share, the browser would go on showing the screen as shared
    return () => {
      off();
      stopSharing();
    };
  });
</script>

<div class="editor-app">
  <TopBar />
  <MenuBar />

  <main class="main-area" class:right bind:clientWidth={mainWidth} style={grid}>
    <div class="toolbar-area">
      <Toolbar />
    </div>

    <section class="stage-area" data-panel="stage">
      <StageBar />
      <Stage />
    </section>

    <div class="rz">
      <Resizer onresize={resizeDock} />
    </div>

    <div class="dock-area" data-panel="dock">
      <Dock />
    </div>
  </main>

  <StatusBar />
</div>

<Dialogs />

<style>
  .editor-app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-deep);
    overflow: hidden;
  }

  .main-area {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    overflow: hidden;
  }

  .toolbar-area {
    grid-column: 1;
    grid-row: 1;
    min-height: 0;
  }

  .stage-area {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .rz {
    grid-column: 3;
    grid-row: 1;
    display: flex;
  }

  .dock-area {
    grid-column: 4;
    grid-row: 1;
    min-width: 0;
    min-height: 0;
  }

  /* the toolbar on the right: the stage takes the first column */
  .main-area.right .toolbar-area {
    grid-column: 2;
  }

  .main-area.right .stage-area {
    grid-column: 1;
  }

  /* one column on a narrow window: tools, stage, then the panels. nothing is dropped and the side of
     the toolbar does not matter here */
  @media (max-width: 900px) {
    .main-area {
      grid-template-columns: minmax(0, 1fr) !important;
      grid-template-rows: var(--toolbar-h) minmax(300px, 1fr) 420px;
      overflow-y: auto;
    }

    .rz {
      display: none;
    }

    .main-area .toolbar-area,
    .main-area.right .toolbar-area {
      grid-column: 1;
      grid-row: 1;
    }

    .main-area .stage-area,
    .main-area.right .stage-area {
      grid-column: 1;
      grid-row: 2;
    }

    .main-area .dock-area {
      grid-column: 1;
      grid-row: 3;
      border-top: 1px solid var(--border);
    }
  }
</style>
