<script lang="ts">
  let { size = 24 }: { size?: number } = $props();
</script>

<!-- two swatches being sampled lead into the drop of the picked color. plain shapes, so no ids to keep apart -->
<svg
  width={size}
  height={size}
  viewBox="0 0 64 64"
  fill="currentColor"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true">
  <rect x="2" y="26" width="13" height="13" rx="2" opacity="0.3" />
  <rect x="14" y="6" width="17" height="17" rx="3" opacity="0.55" />
  <path d="M45 12.4 59.14 33.56A17 17 0 1 1 30.86 33.56Z" />
</svg>
