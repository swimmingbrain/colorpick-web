<script lang="ts">
  import type { Component } from 'svelte';
  import PanelTabs from './PanelTabs.svelte';
  import Resizer from './Resizer.svelte';
  import ColorPanel from './panels/ColorPanel.svelte';
  import AreaPanel from './panels/AreaPanel.svelte';
  import HistoryPanel from './panels/HistoryPanel.svelte';
  import CalibrationPanel from './panels/CalibrationPanel.svelte';
  import { DOCK_BOTTOM, DOCK_TOP, preferences, setGroup, type DockTab } from '$lib/stores/preferences';
  import { history } from '$lib/stores/session';

  const PANELS: Record<DockTab, Component> = {
    color: ColorPanel,
    area: AreaPanel,
    history: HistoryPanel,
    calibration: CalibrationPanel
  };

  const LABELS: Record<DockTab, string> = {
    color: 'Color',
    area: 'Area',
    history: 'History',
    calibration: 'Calibration'
  };

  let height = $state(0);

  const panels = $derived($preferences.panels);

  function tabsOf(ids: DockTab[]) {
    return ids.map((id) => ({ id, label: LABELS[id], badge: id === 'history' ? $history.length : undefined }));
  }

  function resize(delta: number) {
    if (height <= 0) return;
    setGroup('panels', { dockSplit: Math.max(0.15, Math.min(0.85, panels.dockSplit + delta / height)) });
  }

  const TopPanel = $derived(PANELS[panels.topTab]);
  const BottomPanel = $derived(PANELS[panels.bottomTab]);
</script>

<aside class="dock" bind:clientHeight={height}>
  <section class="group" style="flex: 0 0 {panels.dockSplit * 100}%">
    <PanelTabs
      tabs={tabsOf(DOCK_TOP)}
      active={panels.topTab}
      onchange={(id) => setGroup('panels', { topTab: id as DockTab })} />
    <TopPanel />
  </section>
  <Resizer direction="horizontal" onresize={resize} />
  <section class="group grow">
    <PanelTabs
      tabs={tabsOf(DOCK_BOTTOM)}
      active={panels.bottomTab}
      onchange={(id) => setGroup('panels', { bottomTab: id as DockTab })} />
    <BottomPanel />
  </section>
</aside>

<style>
  .dock {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--bg-surface);
  }

  .group {
    display: flex;
    flex-direction: column;
    min-height: 64px;
    overflow: hidden;
  }

  .group.grow {
    flex: 1;
  }
</style>
