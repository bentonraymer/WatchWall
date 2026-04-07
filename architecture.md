# WatchWall — Architecture

## Process Responsibilities

### Main Process (`main/main.js`)

The main process owns the application lifecycle, native OS integration, and all file I/O. It never touches DOM or layout logic.

| Responsibility | Details |
|---|---|
| **Window management** | Create `BrowserWindow`, handle fullscreen toggle, track window bounds |
| **Session persistence** | Read/write `session.json` via `fs`. All file I/O happens here — the renderer requests saves/loads over IPC |
| **Session file check on launch** | On `app.ready`, check if `session.json` exists and send the result to the renderer so it can show the restore dialog or skip it |
| **Fullscreen control** | Respond to renderer requests to toggle fullscreen; also handle the native F11 accelerator |
| **App lifecycle** | `before-quit`: tell renderer to gather final state, write session, then exit. `window-all-closed`: quit on macOS too (single-window app) |
| **Webview permissions** | Configure `webPreferences` for the main window and set up `webviewTag: true`. Handle any permission requests from webview contents (camera, mic, notifications — deny all by default) |

### Preload Script (`main/preload.js`)

A thin bridge that exposes a safe `window.api` object via `contextBridge.exposeInMainWorld`. No business logic lives here — it only declares which IPC channels the renderer is allowed to call.

```js
window.api = {
  // Session
  loadSession: () => ipcRenderer.invoke('session:load'),
  saveSession: (data) => ipcRenderer.invoke('session:save', data),
  hasSession: () => ipcRenderer.invoke('session:exists'),

  // Window
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  onFullscreenChange: (cb) => ipcRenderer.on('window:fullscreen-changed', (_, val) => cb(val)),
  getWindowBounds: () => ipcRenderer.invoke('window:get-bounds'),

  // App lifecycle
  onBeforeQuit: (cb) => ipcRenderer.on('app:before-quit', () => cb()),
}
```

### Renderer Process (`renderer/`)

The renderer owns all UI: DOM, CSS Grid layout, webview elements, hover menus, overlays, popups, and the entire app state model. It communicates with main only for file I/O and window control.

| Responsibility | Details |
|---|---|
| **State management** | Single state object, mutated through action functions, triggers re-render of affected DOM |
| **Layout engine** | Computes CSS Grid template strings from layout definitions; applies them to the grid container |
| **Webview lifecycle** | Creates/destroys `<webview>` elements, controls `src`, calls `setAudioMuted()` |
| **Box management** | Add, remove, reorder (swap) boxes. Preserves webview DOM nodes on layout changes |
| **Hover menus & URL popup** | Pure DOM/CSS — no IPC needed |
| **Keyboard shortcuts** | Listener on the renderer `document`; only fires when no webview has focus |
| **Session autosave** | Collects current state, sends it to main via `window.api.saveSession()` on relevant triggers (debounced for URL navigation) |

---

## IPC Channel Naming Conventions

Channels follow a `domain:action` pattern. All channels are listed exhaustively below — no other channels exist.

### `invoke` channels (renderer calls main, awaits response)

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `session:exists` | renderer → main | — | `boolean` |
| `session:load` | renderer → main | — | `SessionData \| null` |
| `session:save` | renderer → main | `SessionData` | `void` |
| `window:toggle-fullscreen` | renderer → main | — | `boolean` (new state) |
| `window:get-bounds` | renderer → main | — | `{ width, height, x, y }` |

### `on` channels (main pushes to renderer)

| Channel | Direction | Payload |
|---|---|---|
| `window:fullscreen-changed` | main → renderer | `boolean` |
| `app:before-quit` | main → renderer | — |

### Why this is small

Most of the app's work (webview control, layout switching, audio muting, hover menus) happens entirely within the renderer process using the webview DOM API. IPC is only needed for things the renderer can't do: file system access and window-level operations.

---

## State Management

### Approach: Single State Object + Mutation Functions

No framework, no store library. One plain object holds the entire app state. Named action functions mutate it and call targeted DOM update functions. This is sufficient because:
- The state is small (under 20 fields)
- Updates are infrequent (user actions, not 60fps)
- There are no deeply nested component trees to reconcile

### State Shape

```js
const state = {
  // Box data — the source of truth. Array index = box identity.
  boxes: [
    {
      id: 1,              // Permanent ID, never reused
      url: 'https://www.youtube.com',
      audioOverride: false,
      // The <webview> DOM node is NOT in state — it's tracked separately
      // in a Map<id, HTMLElement> so we can reparent without destroying it
    },
    // ... up to 16
  ],

  // Which box ID is highlighted (not an index — an ID, so it survives reordering)
  highlightedBoxId: 1,

  // Layout
  layout: 'equal-side-by-side',  // current layout key
  boxCount: 2,                   // derived from boxes.length, kept for convenience

  // UI state
  overlaysVisible: false,
  isFullscreen: false,
  searchEngine: 'youtube',       // global: 'youtube' | 'google'

  // Internal
  nextBoxId: 3,                  // monotonically increasing ID counter
};
```

### Webview DOM Node Tracking

Webview elements are **not** stored in the state object. They're tracked in a parallel `Map<boxId, HTMLWebviewElement>`. This separation is critical:
- When boxes swap positions or the layout changes, we reparent the existing DOM nodes into new grid slots instead of destroying and recreating them
- This preserves page state, scroll position, and video playback
- The state object stays serializable (for session save)

### Update Flow

```
User action (click, keypress)
  → action function (e.g., highlightBox(id))
    → mutates state
    → calls targeted DOM updater (e.g., renderGrid(), updateMuteStates())
    → triggers autosave if relevant
```

No diffing, no virtual DOM, no pub/sub. Each action function knows exactly which DOM updaters to call.

### Autosave

A `saveSession()` function collects the serializable parts of state (plus current webview URLs via `getURL()`) and sends it over IPC. It is called:
- Immediately on: layout change, box add/close, highlight change, audio override toggle
- Debounced (2s) on: webview URL navigation (via `did-navigate` / `did-navigate-in-page` events)
- On: `app:before-quit` signal from main

---

## Data & Config Storage

### Session File

| | |
|---|---|
| **Path** | `{userData}/session.json` where `userData` = `app.getPath('userData')` |
| **macOS** | `~/Library/Application Support/WatchWall/session.json` |
| **Windows** | `%APPDATA%/WatchWall/session.json` |
| **Linux** | `~/.config/WatchWall/session.json` |

Using Electron's standard `userData` directory means the file lives alongside Electron's own cache and is cleaned up if the app is uninstalled.

### Session File Schema

```json
{
  "version": 1,
  "boxes": [
    { "id": 1, "url": "https://www.youtube.com/watch?v=...", "audioOverride": false },
    { "id": 2, "url": "https://www.google.com", "audioOverride": true }
  ],
  "highlightedBoxId": 1,
  "layout": "equal-side-by-side",
  "overlaysVisible": false,
  "searchEngine": "youtube",
  "window": {
    "width": 1920,
    "height": 1080,
    "x": 0,
    "y": 0,
    "isFullscreen": true
  }
}
```

The `version` field allows future migration if the schema changes.

### Write Safety

Session writes use an atomic write pattern: write to `session.tmp.json`, then rename to `session.json`. This prevents corruption if the app crashes mid-write.

### No Other Config Files

There are no user-facing settings, preferences, or config files beyond the session. The app has no settings screen — all configuration is implicit (layout choice, URLs, audio state) and captured in the session file.
