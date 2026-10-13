<script lang="ts">
  import Panel from '../Panel.svelte';
  import Field from '../Field.svelte';
  import { calibrate, keyName, removeCalibration, tip } from '$lib/editor/actions';
  import { calibrationStatus, lockOf, lockText, plusMinus, within, type CalibrationStatus } from '$lib/editor/tools';
  import { preferences } from '$lib/stores/preferences';
  import { area, calibrating, calibration, share, type ErrorSummary } from '$lib/stores/session';

  const keys = $derived($preferences.shortcuts);
  const status = $derived(calibrationStatus($calibration, $share));
  const lock = $derived(lockOf('calibrate', { sharing: $share !== null, hasArea: $area !== null }));

  const LINES: Record<CalibrationStatus, string> = {
    none: 'not calibrated',
    ready: 'calibrated',
    'other size': 'stored for another frame size, calibrate again'
  };

  const line = $derived.by(() => {
    if ($calibrating) return 'calibrating, escape cancels';
    if (status === 'ready' && $calibration) return `calibrated, colors within ${within($calibration)}`;
    return LINES[status];
  });

  function when(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function errors(e: ErrorSummary): string {
    return `${plusMinus(e.max)} max, ${e.mean.toFixed(2)} mean`;
  }
</script>

<Panel>
  <div class="state" class:ready={status === 'ready'} class:stale={status === 'other size'} class:busy={$calibrating}>
    <span class="dot"></span>
    <span>{line}</span>
  </div>
  {#if $calibration}
    <Field label="Measured">
      <span class="value">{when($calibration.at)}</span>
    </Field>
    <Field label="Frame" hint="The frame size the calibration holds for">
      <span class="value">{$calibration.frame.w} x {$calibration.frame.h}</span>
    </Field>
    <Field label="Fit" hint="How far off the patches are that the correction was fitted to">
      <span class="value">{errors($calibration.residual)}</span>
    </Field>
    <Field label="Hold out" hint="How far off the patches are that the fit never saw">
      <span class="value">{errors($calibration.holdout)}</span>
    </Field>
    {#if $calibration.clipped.length > 0}
      <p class="clipped" title="Card colors this screen cannot show, the fit leaves them out">
        clipped {$calibration.clipped.join(' ')}
      </p>
    {/if}
  {/if}
  <div class="actions">
    <button
      class="small-btn primary"
      class:locked={lock !== null || $calibrating}
      aria-disabled={lock !== null || $calibrating}
      title={lock ? lockText(lock, (id) => keyName(id, keys)) : tip('Calibrate', 'tool.calibrate', keys)}
      onclick={calibrate}>{$calibrating ? 'Calibrating...' : $calibration ? 'Calibrate again' : 'Calibrate'}</button>
    <button class="small-btn" disabled={$calibration === null || $calibrating} onclick={removeCalibration}>Remove</button>
  </div>
  <p class="help">
    The card is shown on the stage for a moment and read back through the share, the difference becomes the
    correction.
  </p>
</Panel>

<style>
  .state {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px 8px;
    font-family: var(--font-editor);
    font-size: 11.5px;
    color: var(--text-secondary);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1px solid var(--text-muted);
  }

  .state.ready {
    color: var(--text-primary);
  }

  .state.ready .dot {
    border-color: var(--success);
    background: var(--success);
  }

  .state.stale .dot {
    border-color: var(--warning);
    background: var(--warning);
  }

  .state.busy .dot {
    border-color: var(--accent);
    background: var(--accent);
  }

  .value {
    font-family: var(--font-editor);
    font-size: 11.5px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .clipped {
    padding: 4px 8px 0;
    font-family: var(--font-editor);
    font-size: 10.5px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .actions {
    display: flex;
    gap: 4px;
    padding: 8px 8px 0;
  }

  .small-btn {
    padding: 4px 10px;
    font-size: 11.5px;
    white-space: nowrap;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
  }

  .small-btn:hover:not(:disabled):not(.locked) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .small-btn.primary {
    color: #111;
    background: var(--accent);
    border-color: var(--accent);
  }

  .small-btn.primary:hover:not(.locked) {
    color: #111;
    background: var(--accent-hover);
  }

  .small-btn:disabled,
  .small-btn.locked {
    opacity: 0.4;
    cursor: default;
  }

  .help {
    padding: 10px 8px 4px;
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-muted);
  }
</style>
