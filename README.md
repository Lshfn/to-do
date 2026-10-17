# Daily

A small, responsive to-do app with no build step or runtime dependencies beyond a static web server.

## Run

From this directory, run:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Open the served page in a browser. Add tasks, mark them complete, delete unfinished tasks, and review completed tasks in history. Tasks are stored in this browser’s local storage, scoped to the site address. They do not sync between devices. If browser storage is unavailable, the app shows a warning and keeps tasks in memory for the current page session.

## Validate

```sh
node --check app.js
```

For a functional smoke test, add a task, mark it complete, reload to confirm persistence, then find it in history. Uncheck it in history to restore it to the active list.

## Appearance

Open **Customize appearance** to choose any background, text and accent color, upload your own background image (PNG, JPEG or WebP, up to 10 MB), and upload your own font (WOFF, WOFF2, TTF or OTF, up to 5 MB). Built-in color and font presets are also available. Remove uploads individually or reset all appearance settings without changing your tasks.

Images and fonts stay on this device in IndexedDB; they are not uploaded to a server. Task data and preset choices use localStorage. Browser storage restrictions or clearing site data can remove saved settings. The app reports storage failures.

## Install and use offline

Serve the app over HTTPS (localhost also works for development). Use your browser’s **Install app** menu, or **Add to Home Screen** on mobile. Browser installation support varies. After the first online visit finishes caching, the app works offline, including tasks and appearance. Installation, tasks and settings belong to this site address; use the same address consistently. This is an installable web app, not a native app-store package.

When changing offline assets, increment the cache version in `sw.js`. New service workers activate after older app windows close.

## macOS menu bar app (macOS 12 or later)

On your Mac, install Xcode Command Line Tools if needed (`xcode-select --install`), then run from this checkout:

```sh
bash macos/build.sh
open macos/build/Daily.app
```

Move `macos/build/Daily.app` to Applications to keep it installed. Click its checklist icon in the top-right menu bar to open or hide the panel. Press Escape or click outside to hide it. Right-click the icon for **Quit Daily**. Hold Command and drag the menu bar icon to reposition it; macOS controls placement relative to the clock. The app has no Dock icon. To open it automatically, add Daily under System Settings → General → Login Items.

The native app works offline with bundled assets and native file pickers for background images and font files. It saves tasks, completion dates and appearance under `~/Library/Application Support/Daily/`. Browser data is separate and does not automatically transfer. Completed tasks stay in **Completed history** across launches; unchecking a history entry restores it to the active list. Existing completed tasks without dates appear as “Completed earlier.”

The build script produces `macos/build/Daily-macOS.zip` and an app signed locally for development. Public distribution requires your Apple Developer signing identity and notarization, which are not configured here. The GitHub Actions workflow builds and uploads the ZIP when run on macOS; it has not been run in this Linux workspace.

### Native acceptance check

On macOS: build and launch, open/hide from the menu bar, add and complete a task, quit and relaunch to check history, upload an image and font using the native file picker, change colors, quit and relaunch to check appearance, restore a completed task, and verify that Reset appearance preserves tasks. Test on your target macOS version before distributing.

History regression tests live in `tests/history.cjs` and run in the macOS CI workflow with jsdom installed in a temporary folder; jsdom is only a test dependency, not part of the app.
