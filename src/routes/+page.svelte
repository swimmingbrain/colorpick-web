<script lang="ts">
  import { base } from '$app/paths';
  import Logo from '$lib/ui/Logo.svelte';

  const features = [
    { title: 'Any pixel on the screen', text: 'Hover the shared screen and a loupe shows the pixels under the pointer, magnified, with the hex under it.' },
    { title: 'The eyedropper too', text: 'Pick works without sharing anything, through the eyedropper the browser has built in.' },
    { title: 'Areas, measured', text: 'Draw a rectangle and read its mean, median, spread, darkest and brightest value and its most common color.' },
    { title: 'Histograms', text: 'Red, green, blue and gray in 256 bins, on a log scale if you like, with the mean and the median marked.' },
    { title: 'Calibrated colors', text: 'A screen share shifts colors by a few steps. One calibration measures by how much, then every value read from the share is corrected.' },
    { title: 'A history to keep', text: 'Every pick and every area stays in this browser, ready to copy or to export as JSON or CSV.' },
    { title: 'Stays on your machine', text: 'No account and no upload. The app works offline once it has loaded.' },
    { title: 'Keys for everything', text: 'Every tool has a key, the command palette finds the rest and the histogram works without a mouse.' },
    { title: 'Open source', text: 'MIT licensed, on GitHub. Read how it works, file a problem or send a fix.' }
  ];

  const steps = [
    { title: 'Share', text: 'Share a screen, a window or a tab. The frames are read in this tab and never sent anywhere.' },
    { title: 'Calibrate', text: 'A card of known colors shows for a moment and is read back, the difference becomes the correction.' },
    { title: 'Point or draw', text: 'Hover to read a pixel through the loupe, or draw an area for its mean, median and histogram.' },
    { title: 'Keep it', text: 'Click to keep a color in the history, copy the hex or export everything as JSON or CSV.' }
  ];

  // the pixels under the loupe of the demo: sky above the ridge, the hill below it
  const SKY = ['#e9937a', '#e8917a', '#e78f7b'];
  const loupe = Array.from({ length: 49 }, (_, i) => {
    const x = i % 7;
    const y = Math.floor(i / 7);
    // the ridge runs down to the right through the middle cell
    return y > x * 0.6 + 1.2 ? (y - x * 0.6 > 3.4 ? '#2f3a4f' : '#3c4660') : SKY[(x + y) % 3];
  });
</script>

<svelte:head>
  <title>brainPICK | Screen Color Picker in Your Browser</title>
  <meta name="description" content="Pick any pixel of your screen and measure the colors of an area, right in your browser. Loupe, histograms, calibration, JSON and CSV export. No account, nothing uploaded." />
  <link rel="canonical" href="https://color.swimmingbrain.dev/" />
  <meta property="og:title" content="brainPICK | Screen Color Picker in Your Browser" />
  <meta property="og:description" content="Pick any pixel of your screen and measure the colors of an area, right in your browser. No account, nothing uploaded." />
  <meta property="og:url" content="https://color.swimmingbrain.dev/" />
  <meta name="twitter:title" content="brainPICK | Screen Color Picker in Your Browser" />
  <meta name="twitter:description" content="Pick any pixel of your screen and measure the colors of an area, right in your browser. No account, nothing uploaded." />
  {@html `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'brainPICK',
    url: 'https://color.swimmingbrain.dev',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: 'A screen color picker in the browser. Pick pixels, measure areas with statistics and histograms, calibrate the share so colors come out exact.',
    author: { '@type': 'Person', name: 'Braian Plaku', url: 'https://swimmingbrain.dev' },
    license: 'https://opensource.org/licenses/MIT'
  })}<\/script>`}
</svelte:head>

<div class="landing">
  <nav class="nav">
    <div class="nav-inner">
      <a href="{base}/" class="logo">
        <span class="logo-mark"><Logo size={24} /></span>
        <span class="logo-name">brainPICK</span>
      </a>
      <div class="nav-actions">
        <a
          href="https://github.com/swimmingbrain/colorpick-web"
          target="_blank"
          rel="noopener"
          class="github-link"
          title="GitHub"
          aria-label="GitHub">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        </a>
        <a href="{base}/editor" class="nav-cta">Open the editor</a>
      </div>
    </div>
  </nav>

  <div class="content">
    <div class="split">
      <div class="left">
        <h1 class="hero-title">
          Pick a pixel.<br />
          <span class="hero-accent">Then read the area.</span>
        </h1>
        <p class="hero-desc">
          A color picker for the whole screen that runs in your browser, for designers and developers who need
          the exact value. Nothing to install, nothing uploaded.
        </p>
        <a href="{base}/editor" class="hero-cta">
          Open the editor
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </a>
        <div class="feature-pills">
          <span class="pill">eyedropper</span>
          <span class="pill">loupe</span>
          <span class="pill">area statistics</span>
          <span class="pill">histograms</span>
          <span class="pill">calibration</span>
          <span class="pill">works offline</span>
        </div>
      </div>

      <div class="right">
        <div class="demo-window" aria-hidden="true">
          <div class="demo-bar">
            <div class="demo-dots">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
            <span class="demo-filename">entire screen</span>
            <div style="flex:1"></div>
            <span class="demo-label">calibrated &plusmn;2</span>
          </div>
          <div class="demo-content">
            <div class="demo-stage">
              <div class="demo-screen">
                <span class="sun"></span>
                <span class="hill back"></span>
                <span class="hill front"></span>
                <span class="area">
                  <span class="area-size">560 x 400</span>
                  <span class="handle" style="left: 0; top: 0"></span>
                  <span class="handle" style="left: 50%; top: 0"></span>
                  <span class="handle" style="left: 100%; top: 0"></span>
                  <span class="handle" style="left: 0; top: 50%"></span>
                  <span class="handle" style="left: 100%; top: 50%"></span>
                  <span class="handle" style="left: 0; top: 100%"></span>
                  <span class="handle" style="left: 50%; top: 100%"></span>
                  <span class="handle" style="left: 100%; top: 100%"></span>
                </span>
                <span class="pointer"></span>
                <span class="loupe">
                  <span class="cells">
                    {#each loupe as color, i (i)}
                      <span class="cell" class:center={i === 24} style="background: {color}"></span>
                    {/each}
                  </span>
                  <span class="loupe-hex">#3C4660</span>
                </span>
              </div>
            </div>
            <div class="demo-readout">
              <div class="readout-color">
                <span class="readout-swatch"></span>
                <span class="readout-text">
                  <span class="readout-hex">#E1897A</span>
                  <span class="readout-sub">mean of 224 000 px</span>
                </span>
              </div>
              <svg class="readout-hist" viewBox="0 0 256 48" preserveAspectRatio="none">
                <path class="grid" d="M64 0V48M128 0V48M192 0V48" />
                <path class="ch blue" d="M70 48C96 48 104 14 120 14S146 48 170 48Z" />
                <path class="ch green" d="M92 48C118 48 126 8 142 8S166 48 190 48Z" />
                <path class="ch red" d="M176 48C200 48 210 4 225 4S244 48 252 48Z" />
                <path class="ch gray" d="M118 48C142 48 150 10 162 10S182 48 206 48" />
                <path class="mean" d="M162 0V48" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <section class="how">
    <div class="features-inner">
      <h2 class="features-heading">How it works</h2>
      <ol class="how-list">
        {#each steps as step, i (step.title)}
          <li class="how-step">
            <span class="how-num">{i + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        {/each}
      </ol>
    </div>
  </section>

  <section class="features">
    <div class="features-inner">
      <h2 class="features-heading">What it does</h2>
      <div class="features-grid">
        {#each features as feature (feature.title)}
          <div class="feature">
            <h3>{feature.title}</h3>
            <p>{feature.text}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <span class="logo-mark"><Logo size={16} /></span>
        <span class="footer-name">brainPICK</span>
      </div>
      <div class="footer-links">
        <a href="{base}/privacy">Privacy</a>
        <a href="{base}/terms">Terms</a>
        <a href="{base}/imprint">Imprint</a>
        <a href="https://github.com/swimmingbrain/colorpick-web" target="_blank" rel="noopener">GitHub</a>
      </div>
      <p class="footer-credit">
        made with <span class="heart">&hearts;</span> by
        <a href="https://swimmingbrain.dev" target="_blank" rel="noopener">Braian Plaku</a>
      </p>
    </div>
  </footer>
</div>

<style>
  /* the app shell pins html and body to the viewport and hides the overflow.
     the public pages are documents, so they hand the scrolling back. the two
     selectors are deliberately heavier than app.css's plain `html, body`,
     because which of the two stylesheets loads last is not fixed */
  :global(html:root), :global(html body) {
    height: auto;
    overflow: auto;
  }

  .landing {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-deep);
  }

  .nav {
    flex-shrink: 0;
    background: var(--bg-deep);
    border-bottom: 1px solid var(--border);
  }

  .nav-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 32px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .nav-cta {
    padding: 5px 14px;
    font-size: 12px;
    font-weight: 500;
    color: #111;
    background: var(--accent);
    border-radius: var(--radius-sm);
    text-decoration: none;
    transition: background 0.15s;
  }

  .nav-cta:hover {
    background: var(--accent-hover);
    color: #111;
  }

  .content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: 56px 32px;
  }

  .split {
    max-width: 1200px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 56px;
  }

  .left {
    flex: 0 0 400px;
  }

  .hero-title {
    font-size: 42px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin-bottom: 16px;
  }

  .hero-accent {
    color: var(--accent);
  }

  .hero-desc {
    font-size: 15px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin-bottom: 24px;
  }

  .hero-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    font-size: 14px;
    font-weight: 600;
    color: #111;
    background: var(--accent);
    border-radius: var(--radius-sm);
    text-decoration: none;
    transition: background 0.15s, transform 0.1s;
  }

  .hero-cta:hover {
    background: var(--accent-hover);
    color: #111;
    transform: translateY(-1px);
  }

  .feature-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 24px;
  }

  .pill {
    font-size: 10px;
    font-weight: 500;
    font-family: var(--font-editor);
    color: var(--text-muted);
    padding: 3px 8px;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    letter-spacing: 0.02em;
  }

  .right {
    flex: 1;
    min-width: 0;
  }

  .demo-window {
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .demo-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 32px;
    padding: 0 12px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
  }

  .demo-dots {
    display: flex;
    gap: 5px;
  }

  .demo-dots .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border);
  }

  .demo-filename {
    font-size: 11px;
    font-family: var(--font-editor);
    color: var(--text-primary);
  }

  .demo-label {
    font-size: 10px;
    font-family: var(--font-editor);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .demo-content {
    display: flex;
    flex-direction: column;
    background: var(--bg-surface);
  }

  .demo-stage {
    padding: 22px 28px;
    background: var(--pasteboard);
  }

  /* the shared screen: an evening sky over two hills, an area drawn on the sky and the loupe on the ridge */
  .demo-screen {
    position: relative;
    aspect-ratio: 16 / 8;
    background: linear-gradient(180deg, #6a5f96 0%, #b9768f 38%, #e1897a 62%, #f3b88a 100%);
    box-shadow: 0 4px 24px var(--stage-shadow);
    overflow: hidden;
  }

  .sun {
    position: absolute;
    left: 66%;
    top: 46%;
    width: 11%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #fbdca6;
  }

  .hill {
    position: absolute;
    border-radius: 50% 50% 0 0;
  }

  .hill.back {
    left: 34%;
    right: -20%;
    top: 62%;
    bottom: -30%;
    background: #6b5674;
  }

  .hill.front {
    left: -25%;
    right: 30%;
    top: 55%;
    bottom: -40%;
    background: #2f3a4f;
  }

  .area {
    position: absolute;
    left: 54%;
    top: 12%;
    width: 22%;
    height: 28%;
    border: 1px solid var(--area);
    background: var(--area-fill);
  }

  .area-size {
    position: absolute;
    left: -1px;
    bottom: calc(100% + 4px);
    padding: 1px 4px;
    font-family: var(--font-editor);
    font-size: 8px;
    color: #111;
    background: var(--area);
    white-space: nowrap;
  }

  .handle {
    position: absolute;
    width: 5px;
    height: 5px;
    margin: -3px 0 0 -3px;
    background: var(--bg-deep);
    border: 1px solid var(--area);
  }

  .pointer {
    position: absolute;
    left: 34%;
    top: 56.4%;
    width: 13px;
    height: 13px;
    margin: -6px 0 0 -6px;
    background:
      linear-gradient(var(--crosshair), var(--crosshair)) center / 1px 100% no-repeat,
      linear-gradient(var(--crosshair), var(--crosshair)) center / 100% 1px no-repeat;
  }

  /* the loupe sits just above the pointer, like on the stage */
  .loupe {
    position: absolute;
    left: 35.5%;
    top: 26%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 3px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .cells {
    display: grid;
    grid-template-columns: repeat(7, 9px);
    grid-auto-rows: 9px;
  }

  .cell.center {
    outline: 1px solid #fff;
    outline-offset: -1px;
    box-shadow: 0 0 0 1px #111;
    position: relative;
  }

  .loupe-hex {
    font-family: var(--font-editor);
    font-size: 8px;
    color: var(--text-primary);
  }

  .demo-readout {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 8px 12px;
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
  }

  .readout-color {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .readout-swatch {
    width: 26px;
    height: 26px;
    background: #e1897a;
    box-shadow: inset 0 0 0 1px var(--bg-deep);
    outline: 1px solid var(--border);
  }

  .readout-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: var(--font-editor);
  }

  .readout-hex {
    font-size: 11px;
    color: var(--text-primary);
  }

  .readout-sub {
    font-size: 8px;
    color: var(--text-muted);
  }

  .readout-hist {
    flex: 1;
    min-width: 0;
    height: 34px;
    background: var(--bg-deep);
  }

  .readout-hist .grid {
    stroke: var(--hist-grid);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .readout-hist .ch {
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    fill-opacity: 0.7;
  }

  .readout-hist .red {
    fill: var(--channel-red);
    stroke: var(--channel-red-edge);
  }

  .readout-hist .green {
    fill: var(--channel-green);
    stroke: var(--channel-green-edge);
  }

  .readout-hist .blue {
    fill: var(--channel-blue);
    stroke: var(--channel-blue-edge);
  }

  .readout-hist .gray {
    fill: none;
    stroke: var(--channel-gray-edge);
  }

  .readout-hist .mean {
    stroke: var(--accent);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .features,
  .how {
    border-top: 1px solid var(--border);
    padding: 64px 32px;
  }

  .how-list {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 32px;
  }

  .how-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    margin-bottom: 12px;
    font-family: var(--font-editor);
    font-size: 12px;
    color: #111;
    background: var(--accent);
  }

  .how-step h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .how-step p {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .features-inner {
    max-width: 1200px;
    margin: 0 auto;
  }

  .features-heading {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 40px;
    letter-spacing: -0.02em;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
  }

  .feature h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .feature p {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .footer {
    flex-shrink: 0;
    border-top: 1px solid var(--border);
    padding: 12px 32px;
  }

  .footer-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .footer-brand {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .footer-name {
    font-family: var(--font-brand);
    font-style: italic;
    font-size: 14px;
    color: var(--text-primary);
  }

  .footer-credit {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-editor);
  }

  .footer-credit a {
    color: var(--accent);
    text-decoration: none;
  }

  .footer-credit a:hover {
    color: var(--accent-hover);
  }

  .github-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    transition: color 0.15s;
  }

  .github-link:hover {
    color: var(--text-secondary);
  }

  .footer-links {
    display: flex;
    gap: 16px;
    font-size: 11px;
    font-family: var(--font-editor);
  }

  .footer-links a {
    color: var(--text-muted);
    text-decoration: none;
  }

  .footer-links a:hover {
    color: var(--accent);
  }

  .heart {
    color: var(--error);
    font-size: 12px;
  }

  @media (max-width: 900px) {
    .content {
      padding: 40px 20px;
    }

    .split {
      flex-direction: column;
      gap: 32px;
    }

    .left {
      flex: none;
      text-align: center;
    }

    .hero-title {
      font-size: 34px;
    }

    .hero-desc {
      font-size: 14px;
    }

    .feature-pills {
      justify-content: center;
    }

    .right {
      width: 100%;
    }

    .features,
    .how {
      padding: 48px 20px;
    }

    .features-grid,
    .how-list {
      grid-template-columns: 1fr;
      gap: 24px;
    }

    .footer {
      padding: 16px 20px;
    }
  }

  @media (max-width: 560px) {
    .footer-inner {
      flex-direction: column;
      gap: 10px;
      text-align: center;
    }
  }

  @media (max-width: 480px) {
    .hero-title {
      font-size: 28px;
    }

    .content {
      padding: 32px 16px;
    }

    .nav-inner {
      padding: 0 16px;
    }
  }
</style>
