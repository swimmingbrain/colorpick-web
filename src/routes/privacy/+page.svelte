<script lang="ts">
  import Logo from '$lib/ui/Logo.svelte';
</script>

<svelte:head>
  <title>Privacy Policy | brainPICK</title>
  <meta name="description" content="brainPICK privacy policy. The screen you share is read in your browser, your colors stay in your browser, nothing is uploaded to any server." />
  <link rel="canonical" href="https://color.swimmingbrain.dev/privacy" />
  <meta property="og:title" content="Privacy Policy | brainPICK" />
  <meta property="og:url" content="https://color.swimmingbrain.dev/privacy" />
</svelte:head>

<div class="legal">
  <nav class="nav">
    <div class="nav-inner">
      <a href="/" class="logo" data-sveltekit-reload>
        <span class="logo-mark"><Logo size={24} /></span>
        <span class="logo-name">brainPICK</span>
      </a>
    </div>
  </nav>

  <div class="content">
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: October 2026</p>

    <h2>Overview</h2>
    <p>
      brainPICK is a color picker for the screen that runs in your browser. The screen you share is read there, and
      the colors you keep are stored in your browser on your device. We do not collect, store, or transmit your
      screen, your colors or personal data to any server.
    </p>

    <h2>Screen Sharing</h2>
    <p>
      The app only sees a screen, a window or a tab after you pick it in your browser's own share dialog, and the
      browser shows that it is being shared. The frames are read right in the tab and never leave the memory of
      the tab. They are not recorded and not uploaded to external servers, only the small picture of an area you
      capture is kept in the history. Sharing ends with the Stop sharing button in the app or the one your browser
      shows.
    </p>
    <p>
      The eyedropper reads one pixel through the picker your browser has built in and needs no share at all.
      Exports of the history as JSON or CSV are made in the tab as well and downloaded the usual way.
    </p>

    <h2>Data Storage</h2>
    <p>
      brainPICK uses your browser's own storage and nothing else. None of it leaves your browser, and all of it
      can be cleared at any time through your browser settings. This is everything the app writes:
    </p>
    <p>
      <strong>localStorage</strong> holds four keys. <code>brainpick:preferences</code> keeps your settings: the
      side of the toolbar, the panel sizes and tabs, the loupe, the values of the area statistics, the channels
      and the scale of the histogram, the frame rate of the share and the commands you ran last in the palette.
      <code>brainpick:history</code> keeps the colors and areas you choose to keep, up to 500 of them, each with
      its value, the time, where it came from, and for an area a small picture and its statistics.
      <code>brainpick:calibration</code> keeps the correction measured from the calibration card, the frame size
      it was measured for and the date. <code>brainpick:area</code> keeps where the area rectangle sits on the
      frame, so it is back after a reload.
    </p>
    <p>
      <strong>Cache Storage</strong> holds the app itself, so it works offline: the files of the build you loaded,
      the fonts that come with it and the last good copy of everything else from this site.
    </p>

    <h2>Analytics</h2>
    <p>
      We do not use tracking scripts, analytics services, or advertising networks.
    </p>

    <h2>Third Party Services</h2>
    <p>
      <strong>Fonts.</strong> The fonts of the interface are part of the app and are served with it from the same
      site. No font service is contacted.
    </p>
    <p>
      <strong>Hosting.</strong> The site is served by GitHub Pages. Like any web server, GitHub receives the
      usual request data when your browser loads the app, such as your IP address and browser, and GitHub's
      privacy statement applies. While a tab is open, the app asks the same server about once a minute whether a
      new version has been published. Nothing about you, your screen or your colors goes with it.
    </p>
    <p>
      That is the complete list. There is no backend, no account, no error reporting and no upload. Once the
      page has loaded, the app works with the network switched off.
    </p>

    <h2>Cookies</h2>
    <p>
      brainPICK does not use cookies, and there is no account to sign in to. The settings, the history, the
      calibration and the area listed above are stored in localStorage.
    </p>

    <h2>Changes</h2>
    <p>
      We may update this policy from time to time. Changes will be reflected on this page with an updated date.
    </p>

    <h2>Contact</h2>
    <p>
      For questions about this policy, contact us via
      <a href="https://github.com/swimmingbrain/colorpick-web" target="_blank" rel="noopener">GitHub</a>.
    </p>
  </div>

  <footer class="footer">
    <a href="/" data-sveltekit-reload>&larr; Back to brainPICK</a>
  </footer>
</div>

<style>
  /* the app shell pins html and body to the viewport and hides the overflow.
     the legal pages are documents, so they hand the scrolling back. the two
     selectors are deliberately heavier than app.css's plain `html, body`,
     because which of the two stylesheets loads last is not fixed */
  :global(html:root), :global(html body) {
    height: auto;
    overflow: auto;
  }

  .legal {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-deep);
  }

  .nav {
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
  }

  .nav-inner {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 32px;
    height: 48px;
    display: flex;
    align-items: center;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
  }

  .logo-mark {
    display: flex;
    align-items: center;
    color: var(--accent);
  }

  .logo-name {
    font-family: var(--font-brand);
    font-style: italic;
    font-size: 18px;
    color: var(--text-primary);
  }

  .content {
    flex: 1;
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 32px;
    width: 100%;
  }

  h1 {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .updated {
    font-size: 12px;
    color: var(--text-muted);
    font-family: var(--font-editor);
    margin-bottom: 32px;
  }

  h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 24px 0 8px;
  }

  p {
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  /* only the headings space the sections, so paragraphs need their own gap */
  p + p {
    margin-top: 12px;
  }

  p a {
    color: var(--accent);
    text-decoration: none;
  }

  p a:hover {
    color: var(--accent-hover);
  }

  /* the storage keys are named exactly, so they are set in the mono face */
  p :global(code) {
    font-family: var(--font-editor);
    font-size: 12px;
    color: var(--text-primary);
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 1px 5px;
    white-space: nowrap;
  }

  .footer {
    border-top: 1px solid var(--border);
    padding: 16px 32px;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
  }

  .footer a {
    font-size: 12px;
    font-family: var(--font-editor);
    color: var(--text-muted);
    text-decoration: none;
  }

  .footer a:hover {
    color: var(--accent);
  }
</style>
