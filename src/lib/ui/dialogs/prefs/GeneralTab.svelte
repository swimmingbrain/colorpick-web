<script lang="ts">
  import { onMount } from 'svelte';
  import Section from './Section.svelte';
  import Field from '../../Field.svelte';
  import SelectField from '../../SelectField.svelte';
  import ToggleField from '../../ToggleField.svelte';
  import { preferences, setGroup } from '$lib/stores/preferences';
  import { FRAME_RATES, type FrameRate } from '$lib/editor/settings';
  import { COLOR_CHANNELS, names, normalizeChannels } from '$lib/core/histogram';
  import type { Channel } from '$lib/core/stats';

  const RATES = FRAME_RATES.map((fps) => ({ value: String(fps), label: `${fps} frames a second` }));

  const p = $derived($preferences);

  const channels = $derived(normalizeChannels(p.histogram.channels));
  // gray or all three colors, and the few colors the chips picked when that is what is set
  const CHANNEL_SETS: Record<string, Channel[]> = { gray: ['gray'], rgb: [...COLOR_CHANNELS] };
  const channelValue = $derived(channels.join(' '));
  const channelOptions = $derived.by(() => {
    const sets = Object.values(CHANNEL_SETS);
    if (!sets.some((s) => s.join(' ') === channelValue)) sets.push(channels);
    return sets.map((s) => ({ value: s.join(' '), label: capital(names(s)) }));
  });

  function capital(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // the system decides, the page only says what it decided
  let reduced = $state(false);
  onMount(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    reduced = query.matches;
    const change = (e: MediaQueryListEvent) => (reduced = e.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  });
</script>

<Section
  title="Share"
  help="Frames are only read in this tab. More of them make hovering smoother and cost more power. A new rate applies to the next share.">
  <Field label="Frame rate" hint="Frames a second the share is asked for, a change applies to the next share">
    <SelectField
      value={String(p.share.fps)}
      options={RATES}
      label="Frames a second the share is asked for"
      onchange={(v) => setGroup('share', { fps: Number(v) as FrameRate })} />
  </Field>
</Section>

<Section title="Stage">
  <Field label="Loupe" hint="The magnified pixels next to the pointer">
    <ToggleField value={p.stage.loupe} label="Loupe" onchange={(v) => setGroup('stage', { loupe: v })} />
  </Field>
</Section>

<Section title="Histogram" help="The chips above the histogram change the same settings.">
  <Field label="Channels" hint="Gray alone or the color channels">
    <SelectField
      value={channelValue}
      options={channelOptions}
      label="Channels the histogram shows"
      onchange={(v) => setGroup('histogram', { channels: normalizeChannels(v.split(' ')) })} />
  </Field>
  <Field label="Log scale" hint="A few pixels still show next to a large flat area">
    <ToggleField value={p.histogram.log} label="Log scale" onchange={(v) => setGroup('histogram', { log: v })} />
  </Field>
</Section>

<Section title="Motion" help="Fades and slides follow the reduced motion setting of the system.">
  <Field label="Reduced motion">
    <span class="value">{reduced ? 'on in the system' : 'off in the system'}</span>
  </Field>
</Section>

<style>
  .value {
    font-size: 11.5px;
    color: var(--text-muted);
  }
</style>
