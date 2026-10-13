<script lang="ts">
  import Logo from './Logo.svelte';
  import Icon from '$lib/icons/Icon.svelte';
  import { keyName, tip, toggleShare } from '$lib/editor/actions';
  import { preferences } from '$lib/stores/preferences';
  import { share } from '$lib/stores/session';

  const pickKey = $derived(keyName('tool.pick', $preferences.shortcuts));
</script>

<!-- the live preview and the overlay for the area, the crosshair and the loupe come in here while sharing -->
<section class="stage" aria-label="Stage">
  {#if !$share}
    <div class="empty">
      <span class="mark"><Logo size={40} /></span>
      <p class="lead">Share your screen to read any pixel or area of it.</p>
      <button class="share-btn" onclick={toggleShare} title={tip('Share screen', 'share.toggle', $preferences.shortcuts)}>
        <Icon name="share" size={14} />
        Share screen
      </button>
      <p class="aside">Pick with the eyedropper works without sharing{pickKey ? ` (${pickKey})` : ''}</p>
    </div>
  {/if}
</section>

<style>
  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: var(--pasteboard);
  }

  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    text-align: center;
  }

  .mark {
    display: flex;
    color: var(--accent);
    margin-bottom: 4px;
  }

  .lead {
    font-size: 13px;
    color: var(--text-secondary);
    max-width: 320px;
    line-height: 1.5;
  }

  .share-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    font-size: 12.5px;
    font-weight: 500;
    color: #111;
    background: var(--accent);
    border: 1px solid var(--accent);
  }

  .share-btn:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  .aside {
    font-size: 11.5px;
    color: var(--text-muted);
  }
</style>
