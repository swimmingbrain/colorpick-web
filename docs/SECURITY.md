# Security

Everything in brainPICK runs in your browser. No server of mine sees your screen or your colors. Nothing is uploaded. The app asks no other server for anything, the fonts come with it. The site itself is served by GitHub Pages, and an open tab asks it about once a minute whether a new version is out. There is no backend, no API, no account, no telemetry and no error reporting.

The screen is shared through the browser's own dialog, only after you pick what to share, and the browser shows that it is being shared. The frames are read in the tab and stay in its memory, they are never stored, recorded or sent. The eyedropper is the one the browser has built in. Exports are written in the tab and downloaded. There are no shell commands, no `exec`, nothing that runs outside the tab.

## What stays on your machine

Everything the app keeps is in your browser's storage for this origin, and clearing the site's data removes all of it:

- **localStorage**: three keys. `brainpick:preferences` holds the settings, `brainpick:history` the colors and areas you keep, up to 500 of them with small pictures of the areas, and `brainpick:calibration` the correction measured from the calibration card.
- **Cache Storage**: the app's own files and its fonts, so it works offline.

## Reporting

If you find a security problem, please don't open a public issue. Use the private vulnerability reporting under the Security tab of this repository and I'll get back to you as soon as I can.
