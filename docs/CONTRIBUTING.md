# Contributing

There is no formal process. Fork the repo, make your change, open a pull request. Small and focused beats big and sweeping, so if you plan something larger, open an issue first and we can talk it through before you spend time on it.

## Running locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173` in Chrome, Edge or Firefox. Sharing the screen needs a browser that offers it, and the eyedropper is there in Chrome and Edge.

`pnpm check` runs the type checker and has to come back with no errors and no warnings, `pnpm test` runs the unit tests, and `pnpm build` writes the static site to `build/`.

## Where things live

- `src/lib/core` is the color math, the capture of the share, the calibration and the statistics of an area. Plain TypeScript, no Svelte in it.
- `src/lib/editor` holds the commands, the keys, the menus, the tools with what keeps them locked, and the preferences with their defaults.
- `src/lib/stores` are the small app wide stores: dialogs and toasts, the preferences, and the session with the share, the calibration, the current color, the area and the history.
- `src/lib/ui` are the Svelte components, one per file, with the dock panels in `src/lib/ui/panels` and the dialogs in `src/lib/ui/dialogs`.
- A new command goes into the list in `src/lib/editor/actions.ts` with a label, a group and its default keys. The keys, the menus, the command palette and the shortcuts dialog all read that list.

## Style

There is no linter and no formatter, so keep the style of the file you are in: two spaces, single quotes, semicolons, and lowercase comments that explain why rather than what. Frames and pixels never go into Svelte state, the stores only hold what the panels show.

Commit messages are short and lowercase with a type prefix, like `fix: the loupe stays inside the stage at the right edge` or `feat: the area keeps its place when the frame size changes`. The types in use are `feat`, `fix`, `perf`, `docs`, `test`, `refactor` and `chore`.

## License

By contributing you agree that your work is released under the MIT license, like the rest of the project.
