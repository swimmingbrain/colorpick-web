<p align="center">
  <img src="static/brainpick-logo-readme.svg" alt="brainpick logo" width="80" />
</p>

<h1 align="center">brainPICK</h1>

<p align="center">
  A screen color picker that runs in your browser.<br/>
  Pick a pixel, then read the whole area.
</p>

<p align="center">
  <a href="https://color.swimmingbrain.dev"><strong>Try it now &rarr; color.swimmingbrain.dev</strong></a>
</p>

brainPICK is an open source app for picking colors off the screen, like Digital Color Meter and the PowerToys Color Picker, but in a browser tab. It is made for designers and developers who need the exact value of a pixel or of a whole area. There is no account and no server, everything stays in your browser.

## Features

- Pick any pixel on the screen with the eyedropper the browser has built in, no share needed
- Share a screen, a window or a tab and hover it, a loupe shows the pixels under the pointer
- Draw an area and read its mean, median, spread, darkest and brightest value and its most common color
- A histogram for red, green, blue and gray, on a log scale if you like, with the mean and the median marked
- A calibration card that measures how the share shifts colors and corrects every value after it
- A history of picks and areas in this browser, exported as JSON or CSV
- Keys for every tool and a command palette
- Works offline once it has been opened

## Shortcuts

| Key | What it does |
|-----|--------------|
| `S` | Share the screen or stop sharing |
| `F` `A` | Pick, area |
| `C` `L` `K` | Capture the area, live preview, calibrate |
| `Ctrl+C` | Copy the hex of the current color |
| `Delete` | Remove the selected history entry |
| `Ctrl+E` | Export the history as JSON |
| `Esc` | Cancel a drag or close a dialog |
| `Ctrl+K` | Command palette |
| `?` | All shortcuts |

## Running locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`. `pnpm test` runs the tests, `pnpm check` the type checks and `pnpm build` writes the static site to `build/`. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) if you want to help.

## How it works

- The screen comes in through the browser's own share dialog. The frames are read in the tab and never leave its memory.
- Hovering reads the pixel under the pointer from the latest frame. An area is cut out of a fresh frame and measured in one pass, with 256 bins per channel for the histogram.
- The calibration shows a card of known colors on the stage, reads it back through the share and fits a correction to the difference. Patches the fit never sees tell how far off the colors still are.
- The eyedropper is the one the browser has built in. It reads the screen itself, so its colors need no correction.
- The history, the calibration and the settings are kept in localStorage, nothing is sent anywhere.

## Tech stack

| Part | Library |
|------|---------|
| Framework | Svelte 5 + SvelteKit (static adapter) |
| Shortcuts | tinykeys |
| Fonts | Inter, JetBrains Mono, Instrument Serif from Fontsource (OFL) |
| Language | TypeScript |

## License

MIT, see [LICENSE](LICENSE). The libraries keep their own licenses, [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES) lists them.
