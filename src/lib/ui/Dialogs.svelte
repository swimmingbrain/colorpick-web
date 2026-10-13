<script lang="ts">
  import Preferences from './dialogs/Preferences.svelte';
  import Shortcuts from './dialogs/Shortcuts.svelte';
  import About from './dialogs/About.svelte';
  import Confirm from './dialogs/Confirm.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import { dialog } from '$lib/stores/app';

  function close() {
    dialog.set(null);
  }
</script>

{#if $dialog}
  {#key $dialog}
    {#if $dialog.kind === 'preferences'}
      <Preferences category={$dialog.category} onclose={close} />
    {:else if $dialog.kind === 'shortcuts'}
      <Shortcuts onclose={close} />
    {:else if $dialog.kind === 'palette'}
      <CommandPalette onclose={close} />
    {:else if $dialog.kind === 'about'}
      <About onclose={close} />
    {:else if $dialog.kind === 'confirm'}
      <Confirm
        title={$dialog.title}
        message={$dialog.message}
        confirm={$dialog.confirm}
        danger={$dialog.danger}
        onconfirm={$dialog.onconfirm}
        onclose={close} />
    {/if}
  {/key}
{/if}
