Here is the full spec document, ready to drop into Claude Code:

---

# WatchWall — Electron App Specification

## Overview

WatchWall is a desktop application built with Electron that allows users to watch and browse multiple web views simultaneously in a structured, non-overlapping grid layout. Each view functions as a full web browser, defaulting to YouTube. The app is designed for fullscreen use on a single monitor.

---

## Technology Stack

- **Framework:** Electron
- **Renderer:** HTML/CSS/JavaScript (vanilla or React — Claude Code's discretion)
- **Persistence:** Local JSON file (via Node.js `fs`) to store session state
- **Webviews:** Electron `<webview>` tags, `BrowserView`, or `iframe` — whichever is most appropriate for stability and long-term support (implementation's discretion)

---

## Application Shell

### Title Bar
- Standard OS native title bar is shown when not in fullscreen
- Title: "WatchWall"

### App Menu Bar (always visible, below title bar)
Contains the following controls:
- **Add Box** button — adds one box using the next logical layout (see Layout Progression)
- **Layout Picker** dropdown — lists all valid layouts for the current box count; user can switch layout without changing box count
- **Overlay Toggle** button — toggles number identification overlays on/off over each box (see Box Overlays)
- **Fullscreen** button — toggles fullscreen (same as F11)

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `F11` | Toggle fullscreen |
| `Escape` | Close any open popup/modal |
| `1`–`9` | Highlight box by number (1-indexed) |
| `0` | (If needed) highlight box 10 |

> For boxes 11–16, highlighting via keyboard is not required; mouse interaction is sufficient.

**Shortcut scope:** Keyboard shortcuts are only active when **no webview has focus**. When a webview has focus (e.g., user is typing in a page's search bar), key events pass through to the webview normally.

---

## Box System

### General Rules
- All boxes are **flat, rigid, and 2D** — no floating, overlapping, or dragging
- Boxes fill the available content area below the menu bar exactly, using CSS grid or flexbox
- Each box is an Electron `<webview>` element with a default URL of `https://www.youtube.com`
- Minimum box count: **1**; maximum box count: **16**

### Box Number Overlays
When the Overlay Toggle is active:
- A small semi-transparent label (e.g., a rounded badge) appears in the top-left corner of each box
- Label shows the box's number (1–16)
- Overlay does not block interaction with the webview

### Highlighted Box
- Only one box can be highlighted at a time
- The highlighted box:
  - Has its audio **unmuted**; all other boxes are muted (unless individually overridden — see Audio Override)
  - **Moves to the primary slot** in layouts that have a defined primary slot (see Layouts). The box formerly in the primary slot **directly swaps positions** with the newly highlighted box. In equal-size layouts, position does not change, but audio still switches.
- When the app first opens (fresh session), **Box 1 is highlighted by default**, both boxes load YouTube, Box 1 is unmuted, Box 2 is muted

### Audio Override
- Each box can have its audio individually forced on, independent of highlight state
- This is toggled from the per-box hover menu (see Per-Box Menu)
- An audio override indicator (small icon) is shown on boxes with override active

---

## Hover Menus

### App-Level Hover Menu (Window Hover Menu)
- Appears when the user hovers near the **bottom edge** of the app window (not anywhere — only within a trigger zone near the bottom)
- Positioned: **bottom center** of the app window, fades in on hover, fades out on mouse leave
- Contains:
  - **Add Box** — same as the menu bar button
  - **Layout Picker** — same as the menu bar dropdown

> The App Menu Bar and Window Hover Menu are redundant by design so the user can access controls without moving to the top of the screen.

### Per-Box Hover Menu
- Appears when the user hovers over a **specific box**
- Positioned: **top center of that box**, fades in/out on hover
- Contains:
  - **Go to URL** — opens the URL popup (see URL Popup), targeted at this box
  - **Highlight** — sets this box as the highlighted box (selects it, switches audio)
  - **Audio Override** — toggles audio override for this box on/off; shows current state (e.g., "🔊 Audio: On" / "🔇 Audio: Auto")
  - **Close** — removes this box and automatically re-selects the next logical layout for the new box count. If the closed box was highlighted, the next numbered box inherits the highlight. **All remaining webview instances are preserved** (page state, scroll position, playback continue uninterrupted).

---

## URL Popup

- Triggered by: clicking "Go to URL" in the per-box hover menu
- Appears: **centered on the screen** as a modal overlay
- Contains:
  - **Search Engine Toggle** (leftmost element in the bar): a **global** icon button that toggles between **YouTube** and **Google**; clicking cycles between them, icon updates accordingly. The toggle state persists across popup opens (not per-box).
  - **Text input field** for URL or search query; auto-focused when popup opens
  - **Go / Submit button**
- Behavior:
  - If the input is a valid URL (contains a `.` and no spaces, or starts with `http`), navigate directly to it
  - Otherwise, treat as a search query:
    - YouTube mode: `https://www.youtube.com/results?search_query=QUERY`
    - Google mode: `https://www.google.com/search?q=QUERY`
- `Escape` closes the popup without navigating
- `Enter` submits

---

## Layout System

### Layout Progression (Auto-Select on "Add Box")

When a box is added, the app automatically selects the **default layout** for the new count. Default layouts prioritize equal-size grids where they exist cleanly:

| Box Count | Default Layout |
|---|---|
| 1 | Full (1×1) |
| 2 | Equal 2 (side by side) |
| 3 | Equal 3 (1 row of 3) |
| 4 | Equal Grid 2×2 |
| 5 | 1 Main + 4 Small |
| 6 | Equal Grid 3×2 |
| 7 | 1 Main + 6 Small |
| 8 | Equal Grid 4×2 |
| 9 | Equal Grid 3×3 |
| 10 | 1 Main + 9 Small |
| 11 | 1 Main + 10 Small |
| 12 | Equal Grid 4×3 |
| 13 | 1 Main + 12 Small |
| 14 | 1 Main + 13 Small |
| 15 | 1 Main + 14 Small |
| 16 | Equal Grid 4×4 |

### Layout Options Per Box Count

For each box count, the Layout Picker offers the following options. **"Primary slot"** refers to the box that the highlighted box moves to.

---

**1 Box**
- `Full` — single box fills the entire content area *(only option)*

**2 Boxes**
- `Equal — Side by Side` — two equal columns; no primary slot
- `Main + 1` — one large box (~70% width, left) + one smaller box (~30% width, right); primary slot = left box

**3 Boxes**
- `Equal — 3 Columns` — three equal columns; no primary slot
- `Main + 2 Sidebar` — one large box (left, ~65% width) + two equal boxes stacked on right; primary slot = left
- `Main + 2 Bottom` — one large box (top, ~65% height) + two equal boxes side by side on bottom; primary slot = top

**4 Boxes**
- `Equal Grid 2×2` — two rows of two equal boxes; no primary slot
- `Main + 3 Sidebar` — one large box (left, ~65% width) + three equal boxes stacked on right; primary slot = left
- `Main + 3 Bottom` — one large box (top, ~65% height) + three equal boxes in a row on bottom; primary slot = top

**5 Boxes**
- `Equal — 5 Mixed Grid` — 2 boxes top row, 3 boxes bottom row, all equal-ish; no primary slot
- `Main + 4 Sidebar` — one large box (left) + four small boxes stacked on right; primary slot = left
- `Main + 4 Bottom` — one large box (top) + four small boxes in a row on bottom; primary slot = top

**6 Boxes**
- `Equal Grid 3×2` — three columns, two rows; no primary slot
- `Main + 5 Sidebar` — one large box (left) + five small boxes stacked on right; primary slot = left
- `Main + 5 Bottom` — one large box (top) + five small boxes in a row on bottom; primary slot = top

**7 Boxes**
- `Equal — 7 Mixed Grid` — 3 top + 4 bottom (or 4+3); no primary slot
- `Main + 6 Sidebar` — one large box (left) + six small boxes stacked on right; primary slot = left
- `Main + 6 Bottom` — one large box (top) + six small boxes in a row on bottom; primary slot = top

**8 Boxes**
- `Equal Grid 4×2` — four columns, two rows; no primary slot
- `Main + 7 Sidebar` — one large box (left) + seven small boxes stacked on right; primary slot = left
- `Main + 7 Bottom` — one large box (top) + seven small boxes in a row on bottom; primary slot = top

**9 Boxes**
- `Equal Grid 3×3` — three columns, three rows; no primary slot
- `Main + 8 Sidebar` — one large box (left) + eight small boxes stacked on right; primary slot = left
- `Main + 8 Bottom` — one large box (top) + eight small boxes in a row on bottom; primary slot = top

**10 Boxes**
- `Equal — 10 Mixed Grid` — 5×2 or 4+3+3; no primary slot
- `Main + 9 Sidebar` — one large box (left) + nine small boxes stacked on right; primary slot = left
- `Main + 9 Bottom` — one large box (top) + nine small boxes in a row on bottom; primary slot = top

**11–15 Boxes**

For each count N in this range, offer:
- `Equal Mixed Grid` — best-fit near-equal grid (e.g., 11 = 4+4+3, 13 = 4+5+4, etc.); no primary slot
- `Main + (N−1) Sidebar` — one large box (left, ~60% width) + (N−1) small boxes in a scrollable or wrapped column on right; primary slot = left
- `Main + (N−1) Bottom` — one large box (top, ~60% height) + (N−1) small boxes in a scrollable or wrapped row on bottom; primary slot = top

**16 Boxes**
- `Equal Grid 4×4` — four columns, four rows; no primary slot
- `Main + 15 Sidebar` — one large box (left) + 15 small boxes on right (wrapped in a 3-column sub-grid or scrollable); primary slot = left
- `Main + 15 Bottom` — one large box (top) + 15 small boxes on bottom (wrapped in a 3-row sub-grid or scrollable); primary slot = top

---

## Session Persistence

### On Launch
- App checks for a saved session file
- If one exists, show a **startup dialog** (small centered modal):
  - "Welcome back. Would you like to restore your last session?"
  - **"Restore Session"** button — loads saved layout, box count, URLs, and audio overrides
  - **"Start Fresh"** button — opens with default 2-box layout, all boxes on YouTube
- If no saved session file exists, skip dialog and go straight to the 2-box default

### What Is Saved
- Box count
- Active layout name
- URL currently loaded in each box (use `webview.getURL()`)
- Audio override state per box
- Highlighted box index
- Overlay toggle state
- Window size and whether it was fullscreen

### When It Is Saved
- Autosave on: layout change, box add/close, URL navigation, highlight change, audio override toggle, app close
- **URL navigation autosave is debounced** (~2 seconds) to avoid excessive writes from redirects, SPA routing, and ad navigations

---

## Visual Design Guidelines

- **Color scheme:** Dark theme; near-black background (`#0f0f0f`), dark gray UI elements, white/light gray text
- **Hover menus:** Semi-transparent dark background (`rgba(0,0,0,0.75)`), white text, subtle rounded corners; appear/disappear with a short CSS opacity transition (~150ms)
- **Highlighted box:** Thin colored border (e.g., `2px solid #3ea6ff` — YouTube blue) around the active box
- **Audio override indicator:** Small speaker icon in the top-right corner of that box's webview frame
- **Box number overlays:** Small rounded badge, semi-transparent dark background, white number, top-left corner
- **URL popup modal:** Centered, dark card on a dimmed backdrop (`rgba(0,0,0,0.5)`), pill-shaped input bar, YouTube/Google toggle icon on left
- **Boxes have no gap between them** — edges are flush to create a clean grid feel. A subtle `1px` dark border between boxes is acceptable for visual separation.

---

## Notes for Implementation

- Use Electron's `<webview>` tag (or equivalent) with `nodeintegration` off for security
- Mute/unmute is controlled via `webview.setAudioMuted(true/false)`
- URL of the active page is read via `webview.getURL()` for session saving
- The layout grid should be implemented with **CSS Grid** for clean, exact sizing
- When a highlighted box "moves to primary slot," the highlighted box and the box in the primary slot **swap positions** in the data model and re-render the grid. All webview instances are preserved during the swap.
- Sidebar layouts with many boxes (10+) should allow the small-box column/row to wrap or scroll without overflowing the screen
- All hover menus should use **pointer-events none** when hidden to not block webview interaction
- On session restore, the saved layout is restored as-is regardless of current screen size