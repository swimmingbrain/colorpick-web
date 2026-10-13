<script lang="ts">
  // the fonts come with the build, the page asks no other server for anything
  import '@fontsource/inter/latin-400.css';
  import '@fontsource/inter/latin-500.css';
  import '@fontsource/inter/latin-600.css';
  import '@fontsource/inter/latin-700.css';
  import '@fontsource/jetbrains-mono/latin-400.css';
  import '@fontsource/jetbrains-mono/latin-500.css';
  import '@fontsource/instrument-serif/latin-400-italic.css';
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser, dev } from '$app/environment';
  import { beforeNavigate } from '$app/navigation';
  import { updated } from '$app/state';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  // after a deploy the old chunks are gone, a full load picks up the new build
  beforeNavigate(({ willUnload, to }) => {
    if (updated.current && !willUnload && to?.url) {
      location.href = to.url.href;
    }
  });

  // the dev server rebuilds the worker on every change, it only runs in a real build
  onMount(() => {
    if (!browser || dev || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    // a hard reload skips the worker, it is asked to take the page back
    navigator.serviceWorker.ready
      .then((reg) => {
        if (!navigator.serviceWorker.controller) reg.active?.postMessage({ type: 'claim' });
      })
      .catch(() => {});
  });
</script>

{@render children()}
