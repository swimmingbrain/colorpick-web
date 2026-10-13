<script lang="ts">
  import Logo from './Logo.svelte';
  import Icon from '$lib/icons/Icon.svelte';
  import {
    REPO,
    calibrate,
    keyName,
    openAbout,
    openPalette,
    openPreferences,
    tip,
    toggleShare
  } from '$lib/editor/actions';
  import { lockOf, lockText } from '$lib/editor/tools';
  import { preferences } from '$lib/stores/preferences';
  import { area, share } from '$lib/stores/session';

  const keys = $derived($preferences.shortcuts);
  const calibrateLock = $derived(lockOf('calibrate', { sharing: $share !== null, hasArea: $area !== null }));
</script>

<div class="topbar">
  <div class="topbar-left">
    <div class="logo" title="brainPICK">
      <span class="logo-icon"><Logo size={20} /></span>
      <span class="logo-text">brainPICK</span>
    </div>
    <span class="separator"></span>
    <div class="share-info" title={$share ? 'The screen is shared, the frames stay in this tab' : 'Nothing is shared'}>
      <span class="share-dot" class:on={$share !== null}></span>
      <span class="share-state">{$share ? `${$share.width} x ${$share.height}` : 'not sharing'}</span>
    </div>
    <button
      class="action-btn accent"
      onclick={toggleShare}
      aria-label={$share ? 'Stop sharing' : 'Share screen'}
      title={tip($share ? 'Stop sharing' : 'Share screen', 'share.toggle', keys)}>
      <Icon name={$share ? 'stop' : 'share'} size={14} />
      <span>{$share ? 'Stop sharing' : 'Share screen'}</span>
    </button>
    <button
      class="action-btn"
      class:locked={calibrateLock !== null}
      aria-disabled={calibrateLock !== null}
      onclick={calibrate}
      aria-label="Calibrate"
      title={calibrateLock
        ? lockText(calibrateLock, (id) => keyName(id, keys))
        : tip('Calibrate', 'tool.calibrate', keys)}>
      <Icon name="calibrate" size={14} />
      <span>Calibrate</span>
    </button>
  </div>

  <div class="topbar-actions">
    <button
      class="action-btn icon-only"
      onclick={openPalette}
      title={tip('Command palette', 'edit.palette', keys)}
      aria-label="Command palette">
      <Icon name="command" size={14} />
    </button>
    <button
      class="action-btn icon-only"
      onclick={openPreferences}
      title={tip('Preferences', 'edit.preferences', keys)}
      aria-label="Preferences">
      <Icon name="settings" size={14} />
    </button>
    <a class="action-btn icon-only" href={REPO} target="_blank" rel="noopener" title="GitHub" aria-label="GitHub">
      <Icon name="github" size={14} />
    </a>
    <button class="action-btn icon-only" onclick={openAbout} title="About brainPICK" aria-label="About brainPICK">
      <Icon name="info" size={14} />
    </button>
  </div>
</div>

<style>
  .topbar {
    height: var(--topbar-h);
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    flex-shrink: 0;
    gap: 10px;
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    user-select: none;
  }

  .logo-icon {
    display: flex;
    align-items: center;
    color: var(--accent);
  }

  .logo-text {
    font-family: var(--font-brand);
    font-style: italic;
    font-size: 16px;
    color: var(--text-primary);
  }

  .share-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    margin-right: 4px;
    padding: 1px 4px;
  }

  .share-state {
    font-family: var(--font-editor);
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* green while frames come in, a hollow ring while nothing is shared */
  .share-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1px solid var(--text-muted);
  }

  .share-dot.on {
    border-color: var(--success);
    background: var(--success);
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    justify-content: flex-end;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    flex-shrink: 0;
  }

  .action-btn:hover:not(.locked) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  /* a locked button stays focusable so the tooltip can say what it waits for */
  .action-btn.locked {
    opacity: 0.35;
    cursor: default;
  }

  .action-btn.accent {
    background: var(--accent);
    color: #111;
  }

  .action-btn.accent:hover {
    background: var(--accent-hover);
    color: #111;
  }

  .action-btn.icon-only {
    padding: 5px 7px;
  }

  .separator {
    width: 1px;
    height: 16px;
    background: var(--border);
    margin: 0 3px;
    flex-shrink: 0;
  }

  /* the labels go first on a narrow window, the icons carry the meaning on their own */
  .action-btn span {
    display: none;
  }

  @media (min-width: 900px) {
    .action-btn span {
      display: inline;
    }
  }

  @media (max-width: 480px) {
    .logo-text,
    .share-info,
    .topbar-left .separator {
      display: none;
    }
  }
</style>
