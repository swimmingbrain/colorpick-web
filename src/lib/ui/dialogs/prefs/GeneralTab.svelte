<script lang="ts">
  import { onMount } from 'svelte';
  import Section from './Section.svelte';
  import Field from '../../Field.svelte';
  import SelectField from '../../SelectField.svelte';
  import ToggleField from '../../ToggleField.svelte';
  import { preferences, setGroup } from '$lib/stores/preferences';
  import { FRAME_RATES, type FrameRate } from '$lib/editor/settings';

  const RATES = FRAME_RATES.map((fps) => ({ value: String(fps), label: `${fps} frames a second` }));

  const p = $derived($preferences);

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

<Section title="Share" help="Frames are only read in this tab. More of them make hovering smoother and cost more power.">
  <Field label="Frame rate">
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

<Section title="Histogram" help="The log chip next to a histogram changes it for the capture you are looking at.">
  <Field label="Log scale" hint="A new capture starts on a log scale">
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
