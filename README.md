# WatchWall
WatchWall is a desktop application built with Electron that lets you watch and browse up to 16 live web views simultaneously in a clean, non-overlapping grid. Every panel is a full browser — defaulting to YouTube — so you can monitor streams, tabs, dashboards, or anything else on the web without juggling windows.

## Example Use Cases
I built WatchWall to solve my ongoing search for a solution to viewing many streams for use cases such as:
- Multiple Sporting Events
- Breaking News Coverage
- Severe Weather Live-Streams
- Traffic Cameras

## Features

### Flexible Grid Layouts
WatchWall supports 1 to 16 panels with a full layout system for every box count. Choose from equal grids, sidebar arrangements with a dominant primary panel, or bottom-strip layouts. The app picks a sensible default as you add panels, and you can swap layouts at any time without losing what's loaded in any tab.
For every box count, you can also switch to a Main + Sidebar or Main + Bottom layout where the highlighted panel gets promoted to the large primary slot.

### Smart Audio Routing & Simple Switching
Only one panel plays audio at a time. Highlighting a panel unmutes it and mutes the rest, so you never fight for audio between tabs. Want to have one panel always audible? Per-panel audio overrides let you pin audio on as many panels as you want, independent of which one is highlighted.

### Per-Panel Menu Bar
Hover over any panel to get a quick-access menu without leaving the grid:

- **Go to URL** — navigate that panel to any URL or search query
- **Highlight** — switch audio focus to this panel
- **Audio Override** — toggle persistent audio on/off for this panel
- **Close** — remove the panel; all other panels continue uninterrupted

### URL Bar
WatchWall supports any streaming service, video platform, or website that works in a web browser. It is not just limited to videos. For example, pull up a dashboard or radar to monitor alongside your streams. Each panel has a button to open a URL bar, allowing you to navigate to any site.

### Highlighted Panel & Primary Slot Swapping
Highlighting a panel does more than just switch audio. In layouts with a defined primary slot (Main + Sidebar, Main + Bottom), the highlighted panel swaps positions with whatever was in the primary slot. All page state, scroll position, and playback continue without interruption — only the position changes.

### Box Number Overlays
Toggle numbered badges over every panel to keep track of what's where. Badges appear in the top-left corner of each panel and never block interaction with the underlying page. This also simplifies usage of hotkeys, noted below.

### Session Persistance
WatchWall remembers your session. On next launch, you're offered the option to restore exactly where you left off — layout, box count, all loaded URLs, audio override states, highlight position, and window size. Sessions autosave on every meaningful change.

### Bottom App Hover Menu
A bottom-edge hover zone gives you quick access to Add Panel, the Layout Picker, and the settings menu.

### Customizable
The settings menu allows you to:
- Disable or enable keyboard shortcuts
- Disable or change the color of the highlighted box indicator
- Modify quick-launch site options presented to you when opening a new panel

### Keyboard Shorcuts

| Key | Action |
| --- | --- |
| `F11` | Toggle fullscreen |
| `Escape` | Close popup / modal |
| `1`–`9` | Highlight panel by number |
| `0` | Highlight panel 10 |

## Installation
```bash
# Clone the repo
git clone https://github.com/bentonraymer/watchwall.git
cd watchwall

# Install dependencies
npm install

# Run in development
npm start

# Build for distribution
npm run build
```

## Development Disclaimer
WatchWall was developed primarily using Claude Code, including Claude Sonnet 4.6 and Claude Opus 4.6.
