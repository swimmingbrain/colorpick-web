<script lang="ts">
  import Dialog from '../Dialog.svelte';
  import Logo from '../Logo.svelte';
  import Icon from '$lib/icons/Icon.svelte';
  import { version } from '$lib/version';

  let { onclose }: { onclose: () => void } = $props();

  const libraries: { name: string; what: string; url: string }[] = [
    { name: 'SvelteKit', what: 'the app', url: 'https://svelte.dev' },
    { name: 'tinykeys', what: 'keyboard shortcuts', url: 'https://github.com/jamiebuilds/tinykeys' },
    { name: 'Fontsource', what: 'the bundled fonts, under the OFL', url: 'https://fontsource.org' },
    { name: 'Tailwind CSS', what: 'the reset under the theme', url: 'https://tailwindcss.com' }
  ];
</script>

<Dialog title="About brainPICK" description="A screen color picker in your browser." {onclose}>
  <div class="about">
    <div class="brand">
      <span class="brand-logo"><Logo size={40} /></span>
      <div class="brand-text">
        <span class="brand-name">brainPICK</span>
        <span class="brand-version">version {version}</span>
      </div>
    </div>
    <p class="pitch">
      Pick any pixel on the screen, measure an area with its histogram and calibrate the share so the colors come
      out exact. Everything happens on this machine, nothing is uploaded.
    </p>
    <div class="links">
      <a href="https://color.swimmingbrain.dev" target="_blank" rel="noopener">color.swimmingbrain.dev</a>
      <a href="https://github.com/swimmingbrain/colorpick-web" target="_blank" rel="noopener" class="with-icon">
        <Icon name="github" size={12} /> GitHub
      </a>
      <a href="https://github.com/swimmingbrain/colorpick-web/blob/main/LICENSE" target="_blank" rel="noopener">
        MIT license
      </a>
    </div>
    <h3 class="section">Stands on</h3>
    <ul class="libs">
      {#each libraries as lib (lib.name)}
        <li>
          <a href={lib.url} target="_blank" rel="noopener">{lib.name}</a>
          <span class="what">{lib.what}</span>
        </li>
      {/each}
    </ul>
    <p class="made">
      made with &hearts; by <a href="https://swimmingbrain.dev" target="_blank" rel="noopener">Braian Plaku</a>
    </p>
  </div>
  {#snippet footer()}
    <button class="dialog-btn" onclick={onclose}>Close</button>
  {/snippet}
</Dialog>

<style>
  .about {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-logo {
    display: flex;
    color: var(--accent);
  }

  .brand-text {
    display: flex;
    flex-direction: column;
  }

  .brand-name {
    font-family: var(--font-brand);
    font-style: italic;
    font-size: 24px;
    line-height: 1.1;
    color: var(--text-primary);
  }

  .brand-version {
    font-family: var(--font-editor);
    font-size: 10.5px;
    color: var(--text-muted);
  }

  .pitch {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 11.5px;
  }

  .with-icon {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .section {
    margin-top: 4px;
    font-family: var(--font-editor);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;
  }

  .libs {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11.5px;
  }

  .libs li {
    display: flex;
    gap: 6px;
    min-width: 0;
  }

  .libs li a {
    white-space: nowrap;
  }

  .what {
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .made {
    margin-top: 6px;
    font-family: var(--font-editor);
    font-size: 10.5px;
    color: var(--text-muted);
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
</style>
