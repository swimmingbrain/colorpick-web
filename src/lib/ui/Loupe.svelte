<script lang="ts">
  import { LOUPE_PIXELS, LOUPE_SCALE, loupeSpot, type Pixels, type Point } from '$lib/core/frames';

  // the pixels around the pointer, magnified without smoothing so every pixel is a square
  let {
    pixels,
    hex,
    at,
    bounds
  }: {
    pixels: Pixels;
    hex: string;
    // the pointer in css pixels from the top left of the stage
    at: Point;
    bounds: { w: number; h: number };
  } = $props();

  const SIDE = LOUPE_PIXELS * LOUPE_SCALE;
  // the canvas with its border and the hex line under it
  const BOX = { w: SIDE + 2, h: SIDE + 2 + 20 };

  let canvas: HTMLCanvasElement | undefined = $state();
  let small: HTMLCanvasElement | null = null;
  let dpr = $state(1);

  const spot = $derived(loupeSpot(at, BOX, bounds));

  $effect(() => {
    dpr = window.devicePixelRatio || 1;
  });

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    small ??= document.createElement('canvas');
    small.width = pixels.width;
    small.height = pixels.height;
    const img = new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
    small.getContext('2d')?.putImageData(img, 0, 0);

    const side = Math.round(SIDE * dpr);
    if (canvas.width !== side) canvas.width = side;
    if (canvas.height !== side) canvas.height = side;
    const cell = side / LOUPE_PIXELS;
    ctx.imageSmoothingEnabled = false;
    // pixels past the edge of the frame show the pasteboard
    ctx.fillStyle = '#111113';
    ctx.fillRect(0, 0, side, side);
    ctx.drawImage(small, 0, 0, side, side);

    // a faint grid so single pixels can be counted
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < LOUPE_PIXELS; i++) {
      const v = Math.round(i * cell) + 0.5;
      ctx.moveTo(v, 0);
      ctx.lineTo(v, side);
      ctx.moveTo(0, v);
      ctx.lineTo(side, v);
    }
    ctx.stroke();

    // the middle pixel is the one that is read, dark and light rings so it shows on any color
    const mid = Math.floor(LOUPE_PIXELS / 2);
    const x = Math.round(mid * cell);
    const w = Math.round((mid + 1) * cell) - x;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeRect(x - 0.5, x - 0.5, w + 1, w + 1);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x + 0.5, x + 0.5, w - 1, w - 1);
  });
</script>

<div class="loupe" style="left: {spot.x}px; top: {spot.y}px" aria-hidden="true">
  <canvas bind:this={canvas} style="width: {SIDE}px; height: {SIDE}px"></canvas>
  <span class="hex">{hex}</span>
</div>

<style>
  .loupe {
    position: absolute;
    z-index: 5;
    display: flex;
    flex-direction: column;
    pointer-events: none;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  canvas {
    display: block;
    image-rendering: pixelated;
  }

  .hex {
    height: 20px;
    line-height: 20px;
    font-family: var(--font-editor);
    font-size: 10.5px;
    color: var(--text-primary);
    text-align: center;
    border-top: 1px solid var(--border);
  }
</style>
