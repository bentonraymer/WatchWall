# WatchWall — Developer Documentation

**Version:** 0.11
**Stack:** Electron 29, vanilla JS (renderer), vanilla CSS
**Entry point:** `main/main.js`
**Start command:** `npm start` (runs `electron .`)
**Build command:** `npm run build` (runs `electron-builder`, outputs to `dist/`)

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Architecture Overview](#2-architecture-overview)
3. [Main Process — `main/main.js`](#3-main-process--mainmainjs)
4. [Preload Bridge — `main/preload.js`](#4-preload-bridge--mainpreloadjs)
5. [Renderer — `renderer/index.html`](#5-renderer--rendererindexhtml)
6. [Renderer Logic — `renderer/app.js`](#6-renderer-logic--rendererappjs)
7. [Styles — `renderer/styles.css`](#7-styles--rendererStylescss)
8. [Layout System](#8-layout-system)
9. [Box Lifecycle](#9-box-lifecycle)
10. [Session Persistence](#10-session-persistence)
11. [Preferences Persistence](#11-preferences-persistence)
12. [Fullscreen Override & YouTube Chat Hide](#12-fullscreen-override--youtube-chat-hide)
13. [Bottom Hover Bar](#13-bottom-hover-bar)
14. [New Box Picker](#14-new-box-picker)
15. [URL Popup](#15-url-popup)
16. [Settings Dialog](#16-settings-dialog)
17. [Highlight System](#17-highlight-system)
18. [Audio System](#18-audio-system)
19. [Box Renumbering](#19-box-renumbering)
20. [Keyboard Shortcuts](#20-keyboard-shortcuts)
21. [Critical Gotchas & Known Constraints](#21-critical-gotchas--known-constraints)
22. [IPC Channel Reference](#22-ipc-channel-reference)
23. [CSS Z-Index Map](#23-css-z-index-map)
24. [Assets](#24-assets)

---

## 1. Project Structure

```
WatchWall/
├── main/
│   ├── main.js          # Electron main process
│   └── preload.js       # contextBridge API exposed to renderer
├── renderer/
│   ├── index.html       # App shell — all static HTML structure
│   ├── app.js           # All renderer logic (layout, state, IPC calls, UI)
│   └── styles.css       # All styles
├── watchwall.png        # Wide banner logo (used in bottom bar + settings)
├── watchwallicon.png    # Square app icon (Electron window/dock icon)
├── watchwallblack.png   # Logo variant (not currently used in UI)
├── watchwallwhite.png   # Logo variant (not currently used in UI)
├── package.json
└── node_modules/
```

---

## 2. Architecture Overview

WatchWall is a standard Electron app with `contextIsolation: true` and `nodeIntegration: false`.

```
┌─────────────────────────────────────────────────────┐
│  Electron Main Process (main.js)                    │
│  - BrowserWindow creation                           │
│  - File I/O (session.json, prefs.json)              │
│  - IPC handlers (ipcMain.handle / ipcMain.on)       │
└──────────────────┬──────────────────────────────────┘
                   │  contextBridge (window.api)
┌──────────────────▼──────────────────────────────────┐
│  Renderer Process (index.html + app.js)             │
│  - Grid layout, state management                    │
│  - <webview> tags for each browser box              │
│  - UI: bottom bar, settings, dialogs                │
└──────────────────┬──────────────────────────────────┘
                   │  executeJavaScript()
┌──────────────────▼──────────────────────────────────┐
│  Each <webview> (sandboxed page context)            │
│  - FULLSCREEN_OVERRIDE injected on dom-ready        │
│  - Spoof Fullscreen API, hide YouTube chat          │
└─────────────────────────────────────────────────────┘
```

**Key constraints:**
- `webviewTag: true` is required in `webPreferences` for `<webview>` to work.
- `<webview>` elements run in a sandboxed renderer process; `require()` is unavailable inside them. Use `executeJavaScript()` to inject code into their page context.
- DOM nodes for webviews are **never moved** (reparented). Moving a `<webview>` in the DOM causes it to reload. Layout changes are achieved by changing CSS `grid-column`/`grid-row` properties only.

---

## 3. Main Process — `main/main.js`

### Constants

```js
const SESSION_PATH   = path.join(app.getPath('userData'), 'session.json');
const SESSION_TMP    = path.join(app.getPath('userData'), 'session.tmp.json');
const PREFS_PATH     = path.join(app.getPath('userData'), 'prefs.json');
const PREFS_TMP      = path.join(app.getPath('userData'), 'prefs.tmp.json');
const ICON_PATH      = path.join(__dirname, '../watchwallicon.png');
```

`app.getPath('userData')` resolves to the OS user data directory (e.g. `~/Library/Application Support/WatchWall` on macOS).

### BrowserWindow

```js
mainWindow = new BrowserWindow({
  width: 1280, height: 720,
  minWidth: 640, minHeight: 400,
  title: 'WatchWall',
  icon: ICON_PATH,           // sets window icon on Windows/Linux
  backgroundColor: '#0f0f0f',
  frame: true,
  fullscreenable: true,
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    webviewTag: true,
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

### App Icon (macOS dock)

```js
app.whenReady().then(() => {
  if (app.dock) app.dock.setIcon(ICON_PATH); // macOS only; guarded with app.dock check
  createWindow();
});
```

### Atomic File Writes

All persistence uses a write-to-tmp then rename pattern to prevent corruption:

```js
fs.writeFileSync(SESSION_TMP, JSON.stringify(data, null, 2), 'utf-8');
fs.renameSync(SESSION_TMP, SESSION_PATH);
```

### IPC Handlers

| Channel | Type | Direction | Description |
|---|---|---|---|
| `session:exists` | `handle` | renderer→main | Returns `true` if `session.json` exists |
| `session:load` | `handle` | renderer→main | Reads and parses `session.json` |
| `session:save` | `handle` | renderer→main | Atomically writes session data |
| `session:save-sync` | `on` (sync) | renderer→main | Synchronous write used at quit time |
| `window:toggle-fullscreen` | `handle` | renderer→main | Toggles BrowserWindow fullscreen |
| `window:get-bounds` | `handle` | renderer→main | Returns `{width, height, x, y, isFullscreen}` |
| `window:get-bounds-sync` | `on` (sync) | renderer→main | Synchronous bounds read at quit time |
| `window:restore-bounds` | `handle` | renderer→main | Restores window size/fullscreen on session load |
| `prefs:load` | `handle` | renderer→main | Reads and parses `prefs.json` |
| `prefs:save` | `handle` | renderer→main | Atomically writes prefs data |
| `app:before-quit` | send (main→renderer) | main→renderer | Fired on `mainWindow.on('close')` so renderer can do a synchronous save |
| `window:fullscreen-changed` | send (main→renderer) | main→renderer | Sent when fullscreen state changes |

---

## 4. Preload Bridge — `main/preload.js`

Exposes `window.api` to the renderer via `contextBridge.exposeInMainWorld`. All renderer-to-main communication goes through this object.

```js
window.api = {
  // Session
  sessionExists(),           // → Promise<boolean>
  loadSession(),             // → Promise<object|null>
  saveSession(data),         // → Promise<void>
  saveSessionSync(data),     // synchronous (IPC sendSync)
  restoreWindowBounds(bounds),

  // Window
  toggleFullscreen(),        // → Promise<boolean>
  getWindowBounds(),         // → Promise<{width, height, x, y, isFullscreen}>
  getWindowBoundsSync(),     // synchronous (IPC sendSync)

  // Events (main → renderer)
  onFullscreenChange(cb),    // cb(isFullscreen: boolean)
  onBeforeQuit(cb),          // cb()

  // Prefs
  loadPrefs(),               // → Promise<object|null>
  savePrefs(data),           // → Promise<void>
}
```

---

## 5. Renderer — `renderer/index.html`

### DOM Structure (top level)

```
<body>
  <main id="grid-area">           ← flex centering shell, fills viewport
    <div id="grid-stage">         ← CSS grid, sized in px by JS
      <!-- .box elements injected by app.js -->
    </div>
  </main>

  <div id="restore-backdrop">     ← Session restore dialog (z-index 4000)
  <div id="newbox-backdrop">      ← New Box picker dialog (z-index 3200)
  <div id="settings-backdrop">    ← Settings dialog (z-index 3500)
  <div id="url-popup-backdrop">   ← URL entry popup (z-index 3000)

  <div id="bottom-hover-zone">    ← Fixed, bottom of screen (z-index 1000)
    <div id="bottom-trigger">     ← Invisible hover target strip (40px tall)
    <div id="window-hover-menu">  ← The actual visible menu bar

  <script src="app.js"></script>
</body>
```

### Critical DOM Order: Bottom Hover Zone

**`#bottom-trigger` MUST come before `#window-hover-menu` in the HTML.**

Because both are siblings in `#bottom-hover-zone`, later siblings render on top (higher effective stacking). If the trigger came after the menu, the trigger would be the topmost element and would intercept all click events meant for the menu buttons, making them unclickable.

### Each `.box` structure (created by JS)

```
.box[data-box-id="N"]
  └── webview          ← the browser pane (absolute, fills box)
  └── .box-click-guard ← transparent click interceptor (z-index 10)
  └── .box-overlay     ← number badge top-left (z-index 20)
  └── .box-audio-indicator ← speaker badge top-right (z-index 20)
  └── .box-menu        ← hover menu top-center (z-index 30)
        └── "Go to URL" button
        └── "Highlight" button (.box-menu-btn--highlight)
        └── "Audio: Auto/On" button (.box-menu-btn--audio, data-box-id)
        └── "Close" button (.box-menu-btn--close)
```

---

## 6. Renderer Logic — `renderer/app.js`

### State Object

```js
const state = {
  boxes: [              // Array of box descriptors; ORDER matters for layout
    { id: 1, url: 'https://www.youtube.com', audioOverride: false },
    ...
  ],
  highlightedBoxId: 1,  // id of the currently highlighted (active) box
  layout: 'equal-2',    // key into LAYOUT_DEFS
  nextBoxId: 3,         // incremented on each addBox(); reset by renumberBoxes()
  overlayActive: false, // whether number badges are visible
  hotkeysEnabled: true, // whether 1-9/0 hotkeys are active
};

const webviewMap = new Map(); // Map<boxId (number), HTMLWebViewElement>
```

`state.boxes` order determines which box gets which layout slot. In `Main+N` layouts, `state.boxes[0]` always occupies the primary (large) slot. Reordering boxes in the array changes their visual position without touching the DOM.

### Preferences Object

```js
const prefs = {
  sites: [                           // Quick Launch Sites
    { url: 'https://www.youtube.com' },
    { url: 'https://www.twitch.tv' },
    { url: 'https://www.netflix.com' },
    { url: 'https://www.disneyplus.com' },
    { url: 'https://www.espn.com' },
  ],
  highlightColor:   '#3ea6ff',       // CSS color string
  highlightEnabled: true,            // if false, highlight border is transparent
};
```

Prefs are loaded from `prefs.json` independently of session (they survive "Start Fresh").

### Key Functions

| Function | Purpose |
|---|---|
| `addBox(url)` | Creates a new box, picks default layout for new count, appends DOM node |
| `closeBox(id)` | Removes box, transfers highlight, calls `renumberBoxes()`, resets layout |
| `highlightBox(id)` | Updates highlight, swaps box to primary slot in Main+N layouts |
| `renumberBoxes()` | Compacts box ids to 1..n after a close (see §19) |
| `createBox(box)` | Builds and returns the `.box` DOM subtree; registers webview in webviewMap |
| `renderGrid()` | Idempotent: creates missing box DOMs, applies layout, highlight, mute states |
| `applyGridLayout()` | Sets CSS grid template and explicit `grid-column`/`grid-row` per box |
| `resizeStage()` | Sizes `#grid-stage` in pixels to letterbox or fill the available area |
| `setLayout(layoutId)` | Switches layout; swaps highlighted box to primary slot if needed |
| `ensurePrimarySlot()` | Swaps `state.boxes[0]` with highlighted box when layout has a primary slot |
| `applyHighlight()` | Adds/removes `.box--highlighted` class; updates highlight button text |
| `applyMuteStates()` | Mutes all non-highlighted webviews unless `audioOverride` is set |
| `toggleAudioOverride(id)` | Toggles persistent audio for a box regardless of highlight state |
| `openNewBoxPicker()` | Shows the site picker dialog |
| `renderNewBoxPicker()` | Rebuilds the site button grid from `prefs.sites` |
| `openUrlPopup(boxId)` | Opens URL entry; `boxId === null` means new-box mode |
| `submitUrl()` | Resolves input; navigates box or creates new box depending on mode |
| `resolveUrl(raw, engine)` | Converts plain text / bare domains / search terms to a full URL |
| `saveSession()` | Async autosave (debounced 2 s for URL navigation) |
| `buildSessionData(bounds)` | Assembles session object from current state |
| `savePrefs()` | Saves `prefs` to `prefs.json` via IPC |
| `applyHighlightStyle()` | Updates `--highlight-color` CSS variable; sets `transparent` when disabled |
| `renderSettingsSites()` | Rebuilds the sites list inside the Settings dialog |
| `startFresh()` | Initializes default 2-box YouTube grid |
| `startWithSession(data)` | Restores state from saved session object |
| `faviconUrl(url)` | Returns Google favicon CDN URL for a given site URL |
| `hostOf(url)` | Returns hostname with `www.` stripped |

---

## 7. Styles — `renderer/styles.css`

### CSS Custom Properties

```css
:root {
  --highlight-color: #3ea6ff; /* Updated by JS via applyHighlightStyle() */
}
```

Setting `--highlight-color` to `transparent` disables highlight borders without extra CSS rules.

### Key Selectors

| Selector | Purpose |
|---|---|
| `#grid-area` | Flex centering container; fills the full window height (no top menu bar) |
| `#grid-stage` | The CSS grid; `width`/`height` set in px by JS |
| `.box` | Individual browser pane wrapper; `position: relative`, `overflow: hidden` |
| `.box--highlighted` | Active box; `outline: 2px solid var(--highlight-color)` |
| `.box-click-guard` | Transparent click interceptor; `pointer-events: none` when highlighted |
| `.box--highlighted .box-click-guard` | Inset box-shadow shows highlight ring above webview |
| `.box-overlay` | Number badge; only visible when `#grid-stage.overlays-active` |
| `.box-audio-indicator` | Speaker icon; only visible when `.active` |
| `.box-menu` | Per-box hover menu; `opacity: 0`, `pointer-events: none` until `.box:hover` |
| `#bottom-hover-zone` | `position: fixed; bottom: 0; pointer-events: none` (children re-enable) |
| `#bottom-trigger` | 40px strip at very bottom; `pointer-events: auto` |
| `#window-hover-menu` | Bottom bar; `bottom: 0`, `opacity: 0` → `.visible` |
| `#restore-backdrop` | `display: none` → `.visible` (`display: flex`) |
| `#settings-backdrop` | `display: none` → `.visible` (`display: flex`) |
| `#newbox-backdrop` | `display: none` → `.visible` (`display: flex`) |
| `#url-popup-backdrop` | `display: none` → `.visible` (`display: flex`) |
| `.site-btn` | Favicon button in New Box picker |
| `.site-btn--custom` | "Go to URL" variant; dashed border, blue hover |
| `.settings-color-input` | Custom color picker with webkit swatch overrides |
| `.toggle-switch` | CSS-only toggle; hidden checkbox drives the track pseudo-element |

---

## 8. Layout System

### Layout Definition Object

Every layout is a plain object with these fields:

```ts
{
  label: string,               // shown in the Layout picker dropdown
  hasPrimarySlot: boolean,     // true if layout has a large primary cell
  fillArea?: boolean,          // true for mixed grids (fills viewport, no letterbox)
  gridTemplateColumns: string, // CSS value
  gridTemplateRows: string,    // CSS value
  ratio?: number,              // stage W/H ratio for letterboxing (absent if fillArea)
  placements?: Array<{         // explicit grid positions per box (index matches state.boxes)
    col: string,               // CSS grid-column value
    row: string,               // CSS grid-row value
  }>,
}
```

### Layout Families

**Equal grids** (`equalDef`): No `placements`, no `hasPrimarySlot`. Auto-placement via DOM order. Every cell is 16:9.

```
ratio = (16 * cols) / (9 * rows)
```

**Sidebar layouts** (`makeSidebarDef(n)`): Primary (large) cell is column 1 spanning all rows. `n` secondary cells fill the remaining column(s) top-to-bottom. `hasPrimarySlot: true` when `n > 1`.

**Bottom layouts** (`makeBottomDef(n)`): Primary cell is row 1 spanning all columns. `n` secondary cells fill the row(s) below left-to-right. `hasPrimarySlot: true` when `n > 1`.

**Mixed grids** (`makeMixedDef(label, rows)`): Rows of unequal cell counts (e.g., `[2, 3]` = 2 cells on top row, 3 on bottom). Uses LCM of cell counts as `totalCols` so each cell's `grid-column` span works out evenly. `fillArea: true` — stage fills the full viewport rather than letterboxing. Cells are not guaranteed to be 16:9.

```js
LAYOUT_DEFS['mixed-5']  = makeMixedDef('Mixed Grid 2+3',   [2, 3]);
LAYOUT_DEFS['mixed-7']  = makeMixedDef('Mixed Grid 3+4',   [3, 4]);
LAYOUT_DEFS['mixed-11'] = makeMixedDef('Mixed Grid 4+4+3', [4, 4, 3]);
LAYOUT_DEFS['mixed-13'] = makeMixedDef('Mixed Grid 4+5+4', [4, 5, 4]);
LAYOUT_DEFS['mixed-14'] = makeMixedDef('Mixed Grid 5+5+4', [5, 5, 4]);
```

### `applyGridLayout()`

```js
if (def.placements) {
  // Sidebar, bottom, and mixed: assign explicit grid-column / grid-row per box
  // using state.boxes index to pick from def.placements array.
} else {
  // Equal grids: clear explicit placement so CSS auto-placement (DOM order) applies.
}
```

**Important:** The check is `def.placements` (not `def.hasPrimarySlot`) because mixed grids have `placements` but not `hasPrimarySlot`.

### `resizeStage()`

```js
if (def.fillArea) {
  gridStage.style.width  = `${availW}px`;
  gridStage.style.height = `${availH}px`;
} else {
  // Letterbox: largest rectangle fitting ratio within available area
  if (availW / availH >= ratio) { h = availH; w = h * ratio; }
  else                          { w = availW; h = w / ratio; }
}
```

`MENU_BAR_HEIGHT = 0` (the top bar was removed; grid-area fills the full window).

### Layout Per Box Count

```js
const COUNT_LAYOUTS = {
  1:  ['full'],
  2:  ['equal-2',   'sidebar-1'],
  3:  ['equal-3',   'sidebar-2',  'bottom-2'],
  4:  ['equal-2x2', 'sidebar-3',  'bottom-3'],
  5:  ['equal-3x2', 'mixed-5',    'sidebar-4',  'bottom-4'],
  // ... up to 16
};
```

`DEFAULT_LAYOUT_FOR_COUNT` maps each count to the first/preferred layout for that count. Used when adding or removing boxes.

---

## 9. Box Lifecycle

### Add Box

1. `openNewBoxPicker()` — shows site picker dialog
2. User clicks a site button → `addBox(url)`, or "Go to URL" → `openUrlPopup(null)` → `submitUrl()` → `addBox(url)`
3. `addBox(url)`:
   - Pushes new box descriptor to `state.boxes`
   - Sets `state.layout = DEFAULT_LAYOUT_FOR_COUNT[count]`
   - Calls `ensurePrimarySlot()` (swaps highlighted box to index 0 if needed)
   - Creates DOM via `createBox(box)` and appends to `#grid-stage`
   - Calls `applyGridLayout()`, `resizeStage()`, `updateLayoutPicker()`, `updateAddBoxButton()`, `applyHighlight()`, `saveSession()`
   - Maximum: **16 boxes**

### Remove Box (Close)

1. User clicks "Close" in a box's hover menu → `closeBox(id)`
2. Transfers highlight to adjacent box if closing the highlighted one
3. Removes from `state.boxes`, `webviewMap`, and DOM
4. Calls `renumberBoxes()` (compacts IDs to 1..n)
5. Resets layout, re-applies everything, saves session
6. Minimum: **1 box** (Close button disabled at min)

---

## 10. Session Persistence

Session = current grid state (boxes, URLs, layout, highlight, overlays, hotkeys, window bounds).

**File:** `<userData>/session.json`

**Session object shape:**

```json
{
  "boxes": [
    { "id": 1, "url": "https://...", "audioOverride": false },
    ...
  ],
  "highlightedBoxId": 1,
  "layout": "equal-2",
  "nextBoxId": 3,
  "overlayActive": false,
  "hotkeysEnabled": true,
  "window": { "width": 1280, "height": 720, "x": 0, "y": 0, "isFullscreen": false }
}
```

**Save triggers:**
- Any box highlight change → `saveSession()` (async)
- Any box URL navigation → `scheduleUrlSave()` (debounced 2 s)
- Layout change → `saveSession()`
- Box add/close/audio toggle → `saveSession()`
- App quit → `saveSessionSync()` (synchronous IPC, fired by `app:before-quit` event)

**On startup:** `session:exists` IPC call. If true, show restore dialog. User either restores (`startWithSession`) or starts fresh (`startFresh`).

---

## 11. Preferences Persistence

Prefs = data that should survive "Start Fresh" (sites list, highlight color/enabled).

**File:** `<userData>/prefs.json`

**Prefs object shape:**

```json
{
  "sites": [
    { "url": "https://www.youtube.com" },
    ...
  ],
  "highlightColor": "#3ea6ff",
  "highlightEnabled": true
}
```

**Save triggers:** Any change to prefs (site add/remove, color change, toggle).

**Load timing:** Loaded immediately on `DOMContentLoaded` via `window.api.loadPrefs()`. Prefs load is independent of the session restore dialog — both can happen in parallel.

**Defaults:** If no prefs file exists (first launch or data cleared), `prefs` object initializes with `DEFAULT_SITES` and blue highlight.

---

## 12. Fullscreen Override & YouTube Chat Hide

### The Problem

Electron `<webview>` elements are sandboxed frames. When a video inside requests native fullscreen (`Element.requestFullscreen()`), it would try to fullscreen the OS window rather than expand within the box. Additionally, YouTube live streams show a chat panel during fullscreen that takes up significant space.

### The Solution

`FULLSCREEN_OVERRIDE` is a self-executing JS string injected into every webview via `wv.executeJavaScript(FULLSCREEN_OVERRIDE)` on its `dom-ready` event. It runs in the page's main JS world (bypasses contextIsolation — this is intentional and necessary).

### What It Does

```
1. Patches Element.prototype.requestFullscreen (and webkit/moz variants)
   → Instead of real fullscreen, expands the element to position:fixed,
     filling the entire webview viewport via inline styles.

2. Patches document.exitFullscreen (and variants)
   → Restores the element's original inline style.

3. Spoofs document.fullscreenElement, document.fullscreenEnabled
   → YouTube checks these to show/hide its fullscreen UI correctly.

4. Dispatches fullscreenchange and webkitfullscreenchange events
   → So YouTube's player JS thinks fullscreen actually happened.

5. On enter: calls hideChatNow() + sets up a MutationObserver on
   document.documentElement to re-call hideChatNow() on any DOM change.
   → hideChatNow() does:
     element.style.setProperty('display', 'none', 'important')
     element.style.setProperty('width', '0', 'important')
     on every .ytp-chat-section element.
   → Using inline style.setProperty wins over any stylesheet rule,
     including YouTube's own inline styles set dynamically.

6. On exit: disconnects the observer, removes the inline display/width
   overrides, dispatches exit events.
```

### Why CSS-Only Doesn't Work

YouTube sets `display: block` as an inline style on `.ytp-chat-section` after the `fullscreenchange` event fires. A stylesheet rule (even `!important`) loses to an inline style. Only `element.style.setProperty(..., 'important')` wins, because it sets the inline style with `!important`, which overrides other inline styles.

### Guard Flag

```js
if (window.__mvFullscreenPatched) return;
window.__mvFullscreenPatched = true;
```

Prevents double-patching if `executeJavaScript` is called more than once on the same page (e.g., after a navigation).

---

## 13. Bottom Hover Bar

### Mechanism

`#bottom-hover-zone` is `position: fixed; bottom: 0; pointer-events: none`. Its children re-enable pointer events selectively.

`#bottom-trigger` is a 40 px tall invisible strip at the very bottom. It has `pointer-events: auto`, so it captures cursor events even when the cursor is over a webview (webviews eat pointer events normally).

`#window-hover-menu` is the visible bar, also `bottom: 0`. When the cursor enters the trigger, JS adds `.visible` to the menu (opacity 1, pointer-events auto). When the cursor leaves either element, a 120 ms timer removes `.visible`.

The menu and trigger are at the same bottom edge, so the cursor is already on the menu the instant it appears — no gap to cross to keep it visible.

### DOM Order Rule (Critical)

`#bottom-trigger` MUST appear **before** `#window-hover-menu` in the HTML. Later siblings paint on top. If the trigger came last, it would sit on top of the menu and steal all click events.

### Menu Contents (in order)

1. WatchWall banner logo (`#bottom-bar-logo`, 20 px height, 0.7 opacity)
2. Separator
3. Add Box button
4. Separator + Layout label + Layout `<select>`
5. Separator + Overlays toggle button
6. Separator + Fullscreen button
7. Separator + Settings button

---

## 14. New Box Picker

Opened by "Add Box" button → `openNewBoxPicker()`. Disabled when `state.boxes.length >= 16`.

### Dialog Structure

```
#newbox-backdrop (fixed overlay)
  └── #newbox-dialog
        └── #newbox-header ("New Box" title + close button)
        └── #newbox-grid (CSS grid of site buttons)
```

### Site Buttons

`renderNewBoxPicker()` builds one `.site-btn` per `prefs.sites` entry:
- Favicon from `https://www.google.com/s2/favicons?domain=${host}&sz=64`
- `onerror` fallback: inline SVG globe icon (`.site-btn-icon-fallback`)
- Label: `hostOf(url)` (hostname without www.)
- Clicking: calls `addBox(site.url)` then `closeNewBoxPicker()`

At the end of the grid, a "Go to URL" button (`.site-btn--custom`) is always appended:
- Dashed border, link icon
- Clicking: `closeNewBoxPicker()` then `openUrlPopup(null)` (new-box mode)

### Empty State

If `prefs.sites` is empty, shows a message: "No sites configured — add some in Settings."

---

## 15. URL Popup

A centered search-bar dialog for entering URLs or search queries.

### Modes

- **Navigate mode** (`urlPopup.targetBoxId = <number>`): Submitting navigates that box's webview.
- **New-box mode** (`urlPopup.targetBoxId = null`): Submitting calls `addBox(resolvedUrl)`.

Opened by:
- "Go to URL" in a box's hover menu → `openUrlPopup(box.id)` (navigate mode)
- "Go to URL" in the New Box picker → `openUrlPopup(null)` (new-box mode)

### URL Resolution (`resolveUrl`)

| Input | Result |
|---|---|
| Starts with `http://` or `https://` | Used as-is |
| No spaces, contains `.` | Prepends `https://` |
| Otherwise | Searched via YouTube or Google depending on `urlPopup.engine` |

### Engine Toggle

YT (red) ↔ G (blue). Persists across popup opens for the session. Displayed as a small circle button to the left of the input.

---

## 16. Settings Dialog

Opened by Settings button → `openSettings()`. Closed by close button, backdrop click, or Escape.

### Structure

```
#settings-backdrop (fixed overlay, z-index 3500)
  └── #settings-dialog
        └── #settings-logo-section
              └── #settings-logo (watchwall.png, 88% width, centered)
        └── #settings-header ("Settings" title + close button)
        └── #settings-body
              └── Box Hotkeys row (toggle)
              └── Highlight Border row (color picker + toggle)
              └── "Quick Launch Sites" section label
              └── #settings-sites-list (populated by renderSettingsSites())
              └── .settings-add-site-row (URL input + Add button)
        └── #settings-footer ("v0.11")
```

### Box Hotkeys Toggle

Bound to `state.hotkeysEnabled`. Saved to session (not prefs).

### Highlight Border

- Color `<input type="color">`: updates `prefs.highlightColor`, calls `applyHighlightStyle()`, saves prefs.
- Enabled toggle: updates `prefs.highlightEnabled`, disables/enables the color picker, calls `applyHighlightStyle()`, saves prefs.

### Quick Launch Sites

- `renderSettingsSites()` builds a row per site with favicon, domain label, and × remove button.
- Adding: input validates URL (prepends `https://` if missing, rejects invalid), pushes to `prefs.sites`, saves prefs, re-renders list.
- Removing: splices from `prefs.sites`, saves prefs, re-renders list.
- Changes take effect immediately in the New Box picker the next time it's opened.

---

## 17. Highlight System

The "highlighted" box is the active box: it receives unmuted audio and user can interact with it (click-guard disabled).

### Visual Indicator

Two layers cooperate:
1. `.box--highlighted` → `outline: 2px solid var(--highlight-color)` on the wrapper (visible for the brief moment before webview renders)
2. `.box--highlighted .box-click-guard` → `box-shadow: inset 0 0 0 2px var(--highlight-color)` (persistent, sits above the webview at z-index 10)

Setting `--highlight-color: transparent` disables both without any conditional CSS.

### Behavior in Main+N Layouts

When a box is highlighted in a sidebar/bottom layout with `hasPrimarySlot: true`:
- That box is swapped to `state.boxes[0]`
- `applyGridLayout()` re-applies placement so it visually moves to the large primary slot
- This is a pure state/CSS operation; the webview DOM node does **not** move

---

## 18. Audio System

### Default Behavior

Only the highlighted box is unmuted. All others are muted via `webview.setAudioMuted(true)`.

### Audio Override

Per-box toggle accessible from the per-box hover menu. When `box.audioOverride = true`, that box is never muted regardless of highlight status.

```js
wv.setAudioMuted(box.id !== state.highlightedBoxId && !box.audioOverride);
```

### Visual Indicator

`.box-audio-indicator` (speaker SVG, top-right corner) has `opacity: 0` by default, `opacity: 1` when `.active` class is present. `.active` is added/removed in sync with `box.audioOverride`.

---

## 19. Box Renumbering

After any box is closed, `renumberBoxes()` compacts all box IDs to `1..n`.

### Why Order Matters

JS closures in `createBox()` capture the `box` object **by reference**, not by value. This means the event listeners (click guard, audio button, close button, etc.) always read `box.id` at call time from the live object. So mutating `state.boxes[i].id` automatically updates what those closures will use — but DOM lookups must happen **before** the mutation.

### Algorithm

```
1. Snapshot oldIds = state.boxes.map(b => b.id)  // IDs before any mutation
2. Update highlightedBoxId to new sequential value
3. For each (oldId, newIndex):
   a. querySelector .box[data-box-id="${oldId}"]  // uses old id — still valid
   b. Update el.dataset.boxId, overlay text, audio btn data-box-id
   c. Rebuild webviewMap entry with newId
   d. state.boxes[i].id = i + 1                  // mutate state LAST
4. Replace webviewMap with rebuilt map
5. state.nextBoxId = state.boxes.length + 1
```

---

## 20. Keyboard Shortcuts

All hotkeys are in the `DOMContentLoaded` keydown listener.

| Key | Action | Guard |
|---|---|---|
| `F11` | Toggle window fullscreen | Always active |
| `Escape` | Close URL popup / restore dialog / settings / new box picker | Always active |
| `1`–`9` | Highlight box with that number | `state.hotkeysEnabled` must be true |
| `0` | Highlight box 10 | `state.hotkeysEnabled` must be true |

Box hotkeys are skipped if `document.activeElement?.tagName === 'WEBVIEW'` (i.e., user is interacting with a webview directly).

---

## 21. Critical Gotchas & Known Constraints

### Never Move Webview DOM Nodes

Moving a `<webview>` in the DOM (reparenting or reordering) destroys and recreates the renderer process, causing a full reload. **All layout changes must use CSS only** (`grid-column`, `grid-row`). The `state.boxes` array order is what changes logically; DOM order is fixed after creation.

### Bottom Bar Click-Through

`#bottom-hover-zone` has `pointer-events: none`. `#bottom-trigger` re-enables it. **The trigger must be before the menu in DOM order** or the trigger will sit on top and block menu clicks.

### Inline Style Wins Over Stylesheets for YouTube Chat

YouTube sets `display: block` inline on `.ytp-chat-section` dynamically. A `<style>` block with `!important` loses. The only winning approach is `element.style.setProperty('display', 'none', 'important')` (inline `!important`) combined with a `MutationObserver` to catch elements added after the fact.

### `executeJavaScript` vs Webview Preload

Webview preload scripts run in a sandboxed context (no `require`). `executeJavaScript()` runs code in the page's main JS world with full DOM access. The fullscreen override is injected this way because it needs to prototype-patch global DOM APIs.

### Synchronous IPC at Quit Time

`app:before-quit` is sent from the `close` event on the BrowserWindow. By that point, async IPC may not complete before the process exits. The renderer uses `ipcRenderer.sendSync` for the quit-time save to guarantee it finishes.

### Prefs vs Session

- **Session** (`session.json`): everything about the current grid (boxes, URLs, layout, highlight, overlays, hotkeys, window size). Cleared/ignored when user clicks "Start Fresh."
- **Prefs** (`prefs.json`): sites list, highlight color, highlight enabled. Always loaded, never cleared by "Start Fresh."

### Box ID Stability in Closures

Event listeners created in `createBox()` reference `box.id` via the live `box` object. After `renumberBoxes()` mutates `box.id`, those listeners automatically use the new ID. But DOM lookups by old ID must complete **before** the mutation.

### `hasPrimarySlot` vs `placements`

- `hasPrimarySlot: true` → `ensurePrimarySlot()` runs (swaps highlighted box to index 0 on layout switch or highlight change). Only `true` when `n > 1` in sidebar/bottom layouts — at `n=1` both cells are equal size so no swap is needed.
- `placements` present → `applyGridLayout()` assigns explicit `grid-column`/`grid-row`. Mixed grids have `placements` but `hasPrimarySlot: false`.

---

## 22. IPC Channel Reference

| Channel | `ipcMain.handle` or `.on` | Description |
|---|---|---|
| `session:exists` | `handle` | `fs.existsSync(SESSION_PATH)` → boolean |
| `session:load` | `handle` | Parse `session.json` → object or null |
| `session:save` | `handle` | Atomic write session data |
| `session:save-sync` | `on` (sync) | Synchronous session write at quit |
| `window:toggle-fullscreen` | `handle` | Toggle BrowserWindow fullscreen |
| `window:get-bounds` | `handle` | `{ width, height, x, y, isFullscreen }` |
| `window:get-bounds-sync` | `on` (sync) | Same, synchronous |
| `window:restore-bounds` | `handle` | Set window size/fullscreen from saved bounds |
| `prefs:load` | `handle` | Parse `prefs.json` → object or null |
| `prefs:save` | `handle` | Atomic write prefs data |
| `window:fullscreen-changed` | send (main→renderer) | Boolean payload |
| `app:before-quit` | send (main→renderer) | No payload; triggers synchronous quit-save |

---

## 23. CSS Z-Index Map

| z-index | Element |
|---|---|
| 10 | `.box-click-guard` |
| 20 | `.box-overlay`, `.box-audio-indicator` |
| 30 | `.box-menu` |
| 1000 | `#bottom-hover-zone` (and its children: trigger + menu) |
| 3000 | `#url-popup-backdrop` |
| 3200 | `#newbox-backdrop` |
| 3500 | `#settings-backdrop` |
| 4000 | `#restore-backdrop` |

---

## 24. Assets

| File | Usage |
|---|---|
| `watchwall.png` | Wide horizontal banner logo. Used in: bottom bar (`#bottom-bar-logo`, 20 px height) and settings dialog (`#settings-logo`, 88% width). Referenced as `../watchwall.png` from the renderer. |
| `watchwallicon.png` | Square app icon. Used in: `BrowserWindow` constructor (`icon:`) and `app.dock.setIcon()` on macOS. Referenced from main process as `path.join(__dirname, '../watchwallicon.png')`. |
| `watchwallblack.png` | Not currently used in UI. |
| `watchwallwhite.png` | Not currently used in UI. |

### Favicon Loading

Site favicons in the New Box picker and Settings sites list are fetched from Google's favicon CDN:

```
https://www.google.com/s2/favicons?domain=${hostname}&sz=64
```

This is a public, no-auth CDN. On failure, a fallback inline SVG (globe or link icon) is shown.

---

## Appendix: Adding a New Feature Checklist

When adding a new persistent setting:
1. Add a field to the `prefs` object with a sensible default
2. Add UI in the settings dialog (HTML + CSS)
3. Wire the change event to update `prefs` and call `savePrefs()`
4. In the `loadPrefs()` `.then()` block, read the field and sync the UI
5. Apply the setting immediately after `applyHighlightStyle()` at top level (before prefs load, so first render is correct)

When adding a new layout:
1. Create the def via `equalDef`, `makeSidebarDef`, `makeBottomDef`, or `makeMixedDef` and add to `LAYOUT_DEFS`
2. Add to `COUNT_LAYOUTS[n]` for the appropriate box count(s)
3. If it should be a default, add to `DEFAULT_LAYOUT_FOR_COUNT`

When adding a new IPC channel:
1. Add `ipcMain.handle(...)` or `ipcMain.on(...)` in `main.js`
2. Expose it in `preload.js` via `contextBridge.exposeInMainWorld`
3. Call `window.api.yourMethod()` in `app.js`
