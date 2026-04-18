// app.js — renderer process

const gridArea  = document.getElementById('grid-area');
const gridStage = document.getElementById('grid-stage');

// ── Layout Configuration ──────────────────────────────────
// Every layout letterboxes the stage so each cell is exactly 16:9.
// Each def carries a `ratio` (stage W/H) computed from the grid fractions:
//
//   Equal grid:  ratio = (16*cols) / (9*rows)
//   Sidebar:     primary col = nRows fr, secondary cols = 1fr each
//                ratio = 16*(nRows+rightCols) / (9*nRows)
//   Bottom:      primary row = nCols fr, secondary rows = 1fr each
//                ratio = 16*nCols / (9*(nCols+bottomRows))
//
// With these fractions, setting the stage to this ratio makes every cell
// — primary and secondary — exactly 16:9.

function equalDef(label, cols, rows) {
  return {
    label,
    hasPrimarySlot: false,
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows:    `repeat(${rows}, 1fr)`,
    ratio: (16 * cols) / (9 * rows),
  };
}

const LAYOUT_DEFS = {
  'full':      equalDef('Full',                 1, 1),
  'equal-2':   equalDef('Equal — Side by Side', 2, 1),
  'equal-3':   equalDef('Equal — 3 Columns',    3, 1),
  'equal-2x2': equalDef('Equal Grid 2×2',       2, 2),
  'equal-3x2': equalDef('Equal Grid 3×2',       3, 2),
  'equal-4x2': equalDef('Equal Grid 4×2',       4, 2),
  'equal-5x2': equalDef('Equal Grid 5×2',       5, 2),
  'equal-3x3': equalDef('Equal Grid 3×3',       3, 3),
  'equal-4x3': equalDef('Equal Grid 4×3',       4, 3),
  'equal-5x3': equalDef('Equal Grid 5×3',       5, 3),
  'equal-4x4': equalDef('Equal Grid 4×4',       4, 4),
};

// Sidebar (left-primary): primary column = nRows fr so the primary cell is
// also 16:9; secondary boxes stack top-to-bottom in 1fr columns on the right.
function makeSidebarDef(n) {
  // n = number of secondary boxes (total boxes = n+1)
  let rightCols, nRows;
  if (n <= 6)       { rightCols = 1; nRows = n; }
  else if (n <= 14) { rightCols = 2; nRows = Math.ceil(n / 2); }
  else              { rightCols = 3; nRows = Math.ceil(n / 3); }

  const gridTemplateColumns = [`${nRows}fr`, ...Array(rightCols).fill('1fr')].join(' ');
  const gridTemplateRows    = `repeat(${nRows}, 1fr)`;
  const ratio               = 16 * (nRows + rightCols) / (9 * nRows);

  // placements[i] → state.boxes[i]:
  //   0 = primary (spans all rows in col 1)
  //   1..n = secondary boxes fill right column(s) top-to-bottom
  const placements = [{ col: '1', row: `1 / span ${nRows}` }];
  for (let i = 0; i < n; i++) {
    placements.push({
      col: String(Math.floor(i / nRows) + 2),
      row: String((i % nRows) + 1),
    });
  }

  // hasPrimarySlot only when primary is actually larger (n=1 gives 1fr:1fr — equal cells, no swap).
  return { label: `Main + ${n} Sidebar`, hasPrimarySlot: n > 1, gridTemplateColumns, gridTemplateRows, ratio, placements };
}

// Bottom (top-primary): primary row = nCols fr so the primary cell is also
// 16:9; secondary boxes fill left-to-right in 1fr rows below.
function makeBottomDef(n) {
  let bottomRows, nCols;
  if (n <= 6)       { bottomRows = 1; nCols = n; }
  else if (n <= 14) { bottomRows = 2; nCols = Math.ceil(n / 2); }
  else              { bottomRows = 3; nCols = Math.ceil(n / 3); }

  const gridTemplateRows    = [`${nCols}fr`, ...Array(bottomRows).fill('1fr')].join(' ');
  const gridTemplateColumns = `repeat(${nCols}, 1fr)`;
  const ratio               = 16 * nCols / (9 * (nCols + bottomRows));

  // primary spans all columns in row 1; secondaries fill cols left-to-right
  const placements = [{ col: `1 / span ${nCols}`, row: '1' }];
  for (let i = 0; i < n; i++) {
    placements.push({
      col: String((i % nCols) + 1),
      row: String(Math.floor(i / nCols) + 2),
    });
  }

  // hasPrimarySlot only when primary is actually larger (n=1 gives 1fr:1fr — equal cells, no swap).
  return { label: `Main + ${n} Bottom`, hasPrimarySlot: n > 1, gridTemplateColumns, gridTemplateRows, ratio, placements };
}

// Register all Main+N variants (N = 1 to 15).
for (let n = 1; n <= 15; n++) {
  LAYOUT_DEFS[`sidebar-${n}`] = makeSidebarDef(n);
  LAYOUT_DEFS[`bottom-${n}`]  = makeBottomDef(n);
}

// ── Mixed Grid Layouts ──────────────────────────────────
// Rows of unequal cell counts; the stage fills the available area (cells
// are not guaranteed to be exactly 16:9 but the full viewport is used).
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function lcmTwo(a, b) { return (a * b) / gcd(a, b); }

function makeMixedDef(label, rows) {
  const totalCols = rows.reduce(lcmTwo);
  const gridTemplateColumns = `repeat(${totalCols}, 1fr)`;
  const gridTemplateRows    = rows.map(() => '1fr').join(' ');
  const placements = [];
  rows.forEach((n, rowIdx) => {
    const span = totalCols / n;
    for (let i = 0; i < n; i++) {
      placements.push({
        col: `${i * span + 1} / span ${span}`,
        row: String(rowIdx + 1),
      });
    }
  });
  return { label, hasPrimarySlot: false, fillArea: true, gridTemplateColumns, gridTemplateRows, placements };
}

LAYOUT_DEFS['mixed-5']  = makeMixedDef('Mixed Grid 2+3',   [2, 3]);
LAYOUT_DEFS['mixed-7']  = makeMixedDef('Mixed Grid 3+4',   [3, 4]);
LAYOUT_DEFS['mixed-11'] = makeMixedDef('Mixed Grid 4+4+3', [4, 4, 3]);
LAYOUT_DEFS['mixed-13'] = makeMixedDef('Mixed Grid 4+5+4', [4, 5, 4]);
LAYOUT_DEFS['mixed-14'] = makeMixedDef('Mixed Grid 5+5+4', [5, 5, 4]);

// Layout Picker options per box count.
const COUNT_LAYOUTS = {
  1:  ['full'],
  2:  ['equal-2',   'sidebar-1'],
  3:  ['equal-3',   'sidebar-2',  'bottom-2'],
  4:  ['equal-2x2', 'sidebar-3',  'bottom-3'],
  5:  ['equal-3x2', 'mixed-5',    'sidebar-4',  'bottom-4'],
  6:  ['equal-3x2', 'sidebar-5',  'bottom-5'],
  7:  ['equal-4x2', 'mixed-7',    'sidebar-6',  'bottom-6'],
  8:  ['equal-4x2', 'sidebar-7',  'bottom-7'],
  9:  ['equal-3x3', 'sidebar-8',  'bottom-8'],
  10: ['equal-4x3', 'equal-5x2',  'sidebar-9',  'bottom-9'],
  11: ['equal-4x3', 'mixed-11',   'sidebar-10', 'bottom-10'],
  12: ['equal-4x3', 'sidebar-11', 'bottom-11'],
  13: ['equal-4x4', 'mixed-13',   'sidebar-12', 'bottom-12'],
  14: ['equal-4x4', 'mixed-14',   'sidebar-13', 'bottom-13'],
  15: ['equal-4x4', 'equal-5x3',  'sidebar-14', 'bottom-14'],
  16: ['equal-4x4', 'sidebar-15', 'bottom-15'],
};

// Default layout applied when a box count is first reached (per spec table).
const DEFAULT_LAYOUT_FOR_COUNT = {
  1:  'full',
  2:  'equal-2',
  3:  'equal-3',
  4:  'equal-2x2',
  5:  'sidebar-4',
  6:  'equal-3x2',
  7:  'sidebar-6',
  8:  'equal-4x2',
  9:  'equal-3x3',
  10: 'sidebar-9',
  11: 'sidebar-10',
  12: 'equal-4x3',
  13: 'sidebar-12',
  14: 'sidebar-13',
  15: 'sidebar-14',
  16: 'equal-4x4',
};

// ── Session Persistence ───────────────────────────────────

// Collect serialisable state plus current window bounds into one object.
function buildSessionData(bounds) {
  return {
    boxes: state.boxes.map((b) => {
      const wv = webviewMap.get(b.id);
      let url = b.url;
      try { url = wv?.getURL() || b.url; } catch {}
      return { id: b.id, url, audioOverride: b.audioOverride };
    }),
    highlightedBoxId: state.highlightedBoxId,
    layout: state.layout,
    nextBoxId: state.nextBoxId,
    overlayActive: state.overlayActive,
    hotkeysEnabled: state.hotkeysEnabled,
    window: bounds,
  };
}

// Async autosave — used for all triggers except app quit.
async function saveSession() {
  try {
    const bounds = await window.api.getWindowBounds();
    await window.api.saveSession(buildSessionData(bounds));
  } catch (e) {
    console.error('[session] autosave failed:', e);
  }
}

// Debounced wrapper for URL-navigation triggers (2 s delay per spec).
let _urlSaveTimer = null;
function scheduleUrlSave() {
  clearTimeout(_urlSaveTimer);
  _urlSaveTimer = setTimeout(saveSession, 2000);
}

// ── Startup ───────────────────────────────────────────────

function startFresh() {
  renderGrid();
  requestAnimationFrame(resizeStage);
}

function startWithSession(data) {
  if (!data || !Array.isArray(data.boxes) || data.boxes.length === 0) {
    startFresh();
    return;
  }

  state.boxes           = data.boxes.map((b) => ({ id: b.id, url: b.url || 'https://www.youtube.com', audioOverride: !!b.audioOverride }));
  state.highlightedBoxId = data.highlightedBoxId ?? state.boxes[0].id;
  state.layout          = LAYOUT_DEFS[data.layout] ? data.layout : DEFAULT_LAYOUT_FOR_COUNT[state.boxes.length];
  state.nextBoxId       = data.nextBoxId ?? (Math.max(...state.boxes.map((b) => b.id)) + 1);
  state.overlayActive   = !!data.overlayActive;
  state.hotkeysEnabled  = data.hotkeysEnabled !== false; // default true if absent

  renderGrid();
  requestAnimationFrame(resizeStage);

  // Sync overlay visual state.
  gridStage.classList.toggle('overlays-active', state.overlayActive);
  document.getElementById('btn-overlay-toggle').setAttribute('aria-pressed', String(state.overlayActive));

  // Sync settings UI.
  const _hkBox = document.getElementById('setting-hotkeys');
  if (_hkBox) _hkBox.checked = state.hotkeysEnabled;

  // Restore window size / fullscreen (best-effort).
  if (data.window) window.api.restoreWindowBounds(data.window).catch(() => {});
}

function showRestoreDialog() {
  document.getElementById('restore-backdrop').classList.add('visible');
}
function hideRestoreDialog() {
  document.getElementById('restore-backdrop').classList.remove('visible');
}

function openSettings() {
  document.getElementById('settings-backdrop').classList.add('visible');
}
function closeSettings() {
  document.getElementById('settings-backdrop').classList.remove('visible');
}

// Rebuilds the sites list inside the Settings dialog.
function renderSettingsSites() {
  const list = document.getElementById('settings-sites-list');
  if (!list) return;
  list.innerHTML = '';

  if (prefs.sites.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:8px 18px;font-size:12px;color:#484848';
    empty.textContent = 'No sites added yet.';
    list.appendChild(empty);
    return;
  }

  prefs.sites.forEach((site, i) => {
    const row = document.createElement('div');
    row.className = 'settings-site-row';

    const favicon = document.createElement('img');
    favicon.className = 'settings-site-favicon';
    favicon.src = faviconUrl(site.url);
    favicon.alt = '';
    favicon.onerror = () => { favicon.style.visibility = 'hidden'; };

    const label = document.createElement('span');
    label.className = 'settings-site-label';
    label.textContent = hostOf(site.url);
    label.title = site.url;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'settings-site-remove';
    removeBtn.title = 'Remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      prefs.sites.splice(i, 1);
      savePrefs();
      renderSettingsSites();
    });

    row.append(favicon, label, removeBtn);
    list.appendChild(row);
  });
}

// ── URL Popup State ───────────────────────────────────────
// engine persists across popup opens (global, not per-box).
const urlPopup = { engine: 'youtube', targetBoxId: null };

function resolveUrl(raw, engine) {
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (!raw.includes(' ') && raw.includes('.')) return 'https://' + raw;
  const q = encodeURIComponent(raw);
  return engine === 'youtube'
    ? `https://www.youtube.com/results?search_query=${q}`
    : `https://www.google.com/search?q=${q}`;
}

function openUrlPopup(boxId) {
  // boxId === null means "new box" mode: submitting creates a box instead of navigating.
  urlPopup.targetBoxId = boxId;
  const input = document.getElementById('url-input');
  if (boxId === null) {
    input.value = '';
  } else {
    const wv = webviewMap.get(boxId);
    try { input.value = wv ? (wv.getURL() || wv.src || '') : ''; } catch { input.value = ''; }
  }
  input.select();
  document.getElementById('url-popup-backdrop').classList.add('visible');
  input.focus();
  syncEngineToggle();
}

function closeUrlPopup() {
  document.getElementById('url-popup-backdrop').classList.remove('visible');
  urlPopup.targetBoxId = null;
}

function submitUrl() {
  const raw = document.getElementById('url-input').value.trim();
  if (raw) {
    const resolved = resolveUrl(raw, urlPopup.engine);
    if (urlPopup.targetBoxId === null) {
      // New-box mode: create a box with the entered URL.
      addBox(resolved);
    } else {
      const wv = webviewMap.get(urlPopup.targetBoxId);
      if (wv) wv.src = resolved;
    }
  }
  closeUrlPopup();
}

function syncEngineToggle() {
  const btn = document.getElementById('url-engine-toggle');
  if (!btn) return;
  if (urlPopup.engine === 'youtube') {
    btn.textContent = 'YT';
    btn.style.color  = '#ff4e45';
    btn.title = 'YouTube — click to switch to Google';
  } else {
    btn.textContent = 'G';
    btn.style.color  = '#4d8df5';
    btn.title = 'Google — click to switch to YouTube';
  }
}

// ── Preferences ──────────────────────────────────────────
// Persisted independently of session so sites survive "Start Fresh".
const DEFAULT_SITES = [
  { url: 'https://www.youtube.com' },
  { url: 'https://www.twitch.tv' },
  { url: 'https://www.netflix.com' },
  { url: 'https://www.disneyplus.com' },
  { url: 'https://www.espn.com' },
];

const prefs = {
  sites: DEFAULT_SITES.map((s) => ({ ...s })),
  highlightColor:   '#3ea6ff',
  highlightEnabled: true,
  menuPosition: 'bottom',   // 'bottom' | 'top' | 'left' | 'right'
  menuPinned:   false,      // true = always visible, false = hover to reveal
};

async function savePrefs() {
  try {
    await window.api.savePrefs({
      sites:            prefs.sites,
      highlightColor:   prefs.highlightColor,
      highlightEnabled: prefs.highlightEnabled,
      menuPosition:     prefs.menuPosition,
      menuPinned:       prefs.menuPinned,
    });
  } catch {}
}

// Applies the current highlight preference to the CSS custom property.
// Setting --highlight-color to 'transparent' effectively disables the border
// without needing extra CSS rules.
function applyHighlightStyle() {
  const color = prefs.highlightEnabled ? prefs.highlightColor : 'transparent';
  document.documentElement.style.setProperty('--highlight-color', color);
}

// Apply defaults immediately (before prefs file is loaded) so the first
// render uses the right color.
applyHighlightStyle();

// Applies the menu position and pin preference to the DOM.
// Sets data-menu-pos on <body> (drives all CSS position rules) and the
// menu-pinned class (drives always-visible override).
// When pinned, measures the menu's rendered size and adds matching padding
// to #grid-area so the grid never slides under the menu.
function applyMenuSettings() {
  const pos    = prefs.menuPosition || 'bottom';
  const pinned = !!prefs.menuPinned;

  document.body.dataset.menuPos = pos;
  document.body.classList.toggle('menu-pinned', pinned);

  // Clear any previously applied padding first.
  gridArea.style.paddingTop    = '';
  gridArea.style.paddingBottom = '';
  gridArea.style.paddingLeft   = '';
  gridArea.style.paddingRight  = '';

  if (pinned) {
    // Measure after the browser has applied the pinned styles (next frame).
    requestAnimationFrame(() => {
      const menu = document.getElementById('window-hover-menu');
      const rect = menu.getBoundingClientRect();
      if      (pos === 'bottom') gridArea.style.paddingBottom = rect.height + 'px';
      else if (pos === 'top')    gridArea.style.paddingTop    = rect.height + 'px';
      else if (pos === 'left')   gridArea.style.paddingLeft   = rect.width  + 'px';
      else if (pos === 'right')  gridArea.style.paddingRight  = rect.width  + 'px';
      resizeStage();
    });
  } else {
    resizeStage();
  }
}

// Apply the position attribute immediately so CSS is correct from first paint.
// The full applyMenuSettings() (which calls resizeStage and needs state) runs
// later in DOMContentLoaded once state is initialised.
document.body.dataset.menuPos = prefs.menuPosition || 'bottom';

// Returns the hostname without "www." for display labels.
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// Google's favicon CDN — reliable 64 px PNGs for any domain.
function faviconUrl(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch { return ''; }
}

// ── State ────────────────────────────────────────────────
const state = {
  boxes: [
    { id: 1, url: 'https://www.youtube.com', audioOverride: false },
    { id: 2, url: 'https://www.youtube.com', audioOverride: false },
  ],
  highlightedBoxId: 1,
  layout: 'equal-2',
  nextBoxId: 3,
  overlayActive: false,
  hotkeysEnabled: true,
};

// Webview DOM nodes keyed by box ID — stored separately from state
// so they can be reparented without being destroyed.
const webviewMap = new Map(); // Map<boxId, HTMLWebViewElement>

// ── Stage Sizing ──────────────────────────────────────────
const MENU_BAR_HEIGHT = 0; // top bar removed; grid-area fills the full window

function resizeStage() {
  const def = LAYOUT_DEFS[state.layout];
  // Subtract any padding reserved for a pinned menu bar so the stage never
  // slides underneath it.  getComputedStyle reads back whatever was set by
  // applyMenuSettings() (or 0 when unpinned).
  const cs     = getComputedStyle(gridArea);
  const availW = (gridArea.clientWidth  - parseFloat(cs.paddingLeft)  - parseFloat(cs.paddingRight))
                 || window.innerWidth;
  const availH = (gridArea.clientHeight - parseFloat(cs.paddingTop)   - parseFloat(cs.paddingBottom))
                 || (window.innerHeight - MENU_BAR_HEIGHT);
  if (!availW || !availH) return;

  if (def.fillArea) {
    // Mixed grids fill the entire available area; cells won't all be 16:9
    // but the full viewport is used.
    gridStage.style.width  = `${availW}px`;
    gridStage.style.height = `${availH}px`;
  } else {
    // Letterbox: fit the largest rectangle with the layout's aspect ratio.
    // Every equal-grid and Main+N layout goes through this path, leaving
    // unused space rather than distorting any cell.
    const { ratio } = def;
    let w, h;
    if (availW / availH >= ratio) { h = availH; w = h * ratio; }
    else                          { w = availW; h = w / ratio; }
    gridStage.style.width  = `${Math.floor(w)}px`;
    gridStage.style.height = `${Math.floor(h)}px`;
  }
}

new ResizeObserver(resizeStage).observe(gridArea);

// ── Grid Layout ───────────────────────────────────────────
// Sets CSS grid template and assigns grid-column / grid-row per box.
// DOM nodes are NEVER moved — only CSS properties change — so webviews
// never reload, lose fullscreen, or flash when the layout changes.
function applyGridLayout() {
  const def = LAYOUT_DEFS[state.layout];

  gridStage.style.gridTemplateColumns = def.gridTemplateColumns;
  gridStage.style.gridTemplateRows    = def.gridTemplateRows;

  if (def.placements) {
    // Assign explicit grid positions based on current state.boxes order.
    // Sidebar/bottom: placements[0] = primary cell, placements[i>0] = secondary.
    // Mixed grids: placements cover every cell in row-by-row order.
    state.boxes.forEach((box, i) => {
      const el = gridStage.querySelector(`.box[data-box-id="${box.id}"]`);
      if (!el) return;
      const p = def.placements[i];
      el.style.gridColumn = p ? p.col : '';
      el.style.gridRow    = p ? p.row : '';
    });
  } else {
    // Equal grids: clear explicit placement so auto-placement (DOM order) applies.
    gridStage.querySelectorAll('.box').forEach((el) => {
      el.style.gridColumn = '';
      el.style.gridRow    = '';
    });
  }
}

// ── Layout Picker ─────────────────────────────────────────
// Rebuilds the bottom-bar layout picker to match the current box count.
function updateLayoutPicker() {
  const validIds = COUNT_LAYOUTS[state.boxes.length] ?? ['full'];
  const html = validIds
    .map((id) => `<option value="${id}">${LAYOUT_DEFS[id].label}</option>`)
    .join('');

  const picker = document.getElementById('layout-picker');
  picker.innerHTML = html;
  picker.value = state.layout;
}

// ── Set Layout ────────────────────────────────────────────
// Switches to a new layout without changing box count.
// If switching to a Main+N layout, moves the highlighted box to slot 0.
function setLayout(layoutId) {
  if (!LAYOUT_DEFS[layoutId]) return;
  state.layout = layoutId;
  ensurePrimarySlot();
  applyGridLayout();
  resizeStage();
  updateLayoutPicker();
  saveSession();
}

// If the current layout has a primary slot, swap state.boxes[0] with
// the highlighted box so it occupies the primary position.
function ensurePrimarySlot() {
  const def = LAYOUT_DEFS[state.layout];
  if (!def.hasPrimarySlot) return;
  const idx = state.boxes.findIndex((b) => b.id === state.highlightedBoxId);
  if (idx > 0) {
    [state.boxes[0], state.boxes[idx]] = [state.boxes[idx], state.boxes[0]];
  }
}

// ── Fullscreen Override (injected into each webview) ──────
// Runs in the page's main JS world via executeJavaScript, bypassing
// contextIsolation. Overrides requestFullscreen so videos fill the box
// viewport instead of triggering OS-level window fullscreen.
const FULLSCREEN_OVERRIDE = `(function() {
  if (window.__mvFullscreenPatched) return;
  window.__mvFullscreenPatched = true;

  let fakeEl = null, savedStyle = '';

  // Force-hide every .ytp-chat-section element with an inline style so it
  // wins over any stylesheet or YouTube inline style YouTube may have set.
  function hideChatNow() {
    document.querySelectorAll('.ytp-chat-section').forEach(function(c) {
      c.style.setProperty('display', 'none', 'important');
      c.style.setProperty('width',   '0',    'important');
    });
  }

  function enter(el) {
    if (fakeEl === el) return;
    if (fakeEl) exit();
    fakeEl = el;
    savedStyle = el.style.cssText;
    el.style.cssText = savedStyle +
      ';position:fixed!important;top:0!important;left:0!important' +
      ';width:100%!important;height:100%!important' +
      ';z-index:2147483647!important;background:#000!important';

    // Suppress YouTube's live-chat overlay during fake fullscreen.
    // hideChatNow() covers elements already in the DOM; the MutationObserver
    // catches any YouTube adds lazily after the fullscreenchange event fires.
    hideChatNow();
    if (!window.__mvChatObs) {
      window.__mvChatObs = new MutationObserver(function() {
        if (fakeEl) hideChatNow();
      });
    }
    window.__mvChatObs.observe(document.documentElement, { childList: true, subtree: true });

    for (const p of ['fullscreenElement','webkitFullscreenElement','mozFullScreenElement'])
      Object.defineProperty(document, p, { get: () => el, configurable: true });
    document.dispatchEvent(new Event('fullscreenchange'));
    document.dispatchEvent(new Event('webkitfullscreenchange'));
  }

  function exit() {
    if (!fakeEl) return;
    fakeEl.style.cssText = savedStyle;
    fakeEl = null; savedStyle = '';

    // Stop watching and restore chat visibility.
    if (window.__mvChatObs) { window.__mvChatObs.disconnect(); window.__mvChatObs = null; }
    document.querySelectorAll('.ytp-chat-section').forEach(function(c) {
      c.style.removeProperty('display');
      c.style.removeProperty('width');
    });

    for (const p of ['fullscreenElement','webkitFullscreenElement','mozFullScreenElement'])
      Object.defineProperty(document, p, { get: () => null, configurable: true });
    document.dispatchEvent(new Event('fullscreenchange'));
    document.dispatchEvent(new Event('webkitfullscreenchange'));
  }

  Element.prototype.requestFullscreen       = function() { enter(this); return Promise.resolve(); };
  Element.prototype.webkitRequestFullscreen = function() { enter(this); };
  Element.prototype.mozRequestFullScreen    = function() { enter(this); };
  document.exitFullscreen       = function() { exit(); return Promise.resolve(); };
  document.webkitExitFullscreen = function() { exit(); };
  document.mozCancelFullScreen  = function() { exit(); };

  for (const p of ['fullscreenEnabled','webkitFullscreenEnabled'])
    Object.defineProperty(document, p, { get: () => true, configurable: true });
  for (const p of ['fullscreenElement','webkitFullscreenElement','mozFullScreenElement'])
    Object.defineProperty(document, p, { get: () => null, configurable: true });
})();`;

// ── Box Creation ─────────────────────────────────────────
function createBox(box) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('box');
  wrapper.dataset.boxId = box.id;

  const wv = document.createElement('webview');
  wv.src = box.url;

  wv.addEventListener('dom-ready', () => {
    wv.executeJavaScript(FULLSCREEN_OVERRIDE).catch(() => {});
    wv.setAudioMuted(box.id !== state.highlightedBoxId && !box.audioOverride);
  });

  // Debounced URL autosave on every navigation (full-page and SPA).
  wv.addEventListener('did-navigate',         scheduleUrlSave);
  wv.addEventListener('did-navigate-in-page', scheduleUrlSave);

  // Click guard: transparent overlay on unhighlighted boxes captures the
  // click so YouTube doesn't see it (and won't pause). CSS sets
  // pointer-events:none on the highlighted box so its clicks pass through.
  const guard = document.createElement('div');
  guard.classList.add('box-click-guard');
  guard.addEventListener('click', () => highlightBox(box.id));

  // Per-box hover menu (top-center, fades in on hover via CSS).
  const menu = document.createElement('div');
  menu.classList.add('box-menu');

  const btnGoToUrl = document.createElement('button');
  btnGoToUrl.classList.add('box-menu-btn');
  btnGoToUrl.textContent = 'Go to URL';
  btnGoToUrl.addEventListener('click', (e) => { e.stopPropagation(); openUrlPopup(box.id); });

  const btnHighlight = document.createElement('button');
  btnHighlight.classList.add('box-menu-btn', 'box-menu-btn--highlight');
  btnHighlight.textContent = box.id === state.highlightedBoxId ? 'Highlighted' : 'Highlight';
  btnHighlight.disabled = box.id === state.highlightedBoxId;
  btnHighlight.addEventListener('click', (e) => { e.stopPropagation(); highlightBox(box.id); });

  const btnAudio = document.createElement('button');
  btnAudio.classList.add('box-menu-btn', 'box-menu-btn--audio');
  btnAudio.dataset.boxId = String(box.id);
  btnAudio.textContent = box.audioOverride ? 'Audio: On' : 'Audio: Auto';
  btnAudio.addEventListener('click', (e) => { e.stopPropagation(); toggleAudioOverride(box.id); });

  const btnClose = document.createElement('button');
  btnClose.classList.add('box-menu-btn', 'box-menu-btn--close');
  btnClose.textContent = 'Close';
  btnClose.disabled = state.boxes.length <= 1;
  btnClose.addEventListener('click', (e) => { e.stopPropagation(); closeBox(box.id); });

  menu.append(btnGoToUrl, btnHighlight, btnAudio, btnClose);

  const overlay = document.createElement('div');
  overlay.classList.add('box-overlay');
  overlay.textContent = String(box.id);

  // Audio-override indicator: speaker icon, top-right, only visible when active.
  const audioIndicator = document.createElement('div');
  audioIndicator.classList.add('box-audio-indicator');
  if (box.audioOverride) audioIndicator.classList.add('active');
  audioIndicator.innerHTML =
    '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M1 3.5v4h2l2.5 2.5V1L3 3.5H1z" fill="currentColor"/>' +
    '<path d="M7.5 2.5a4 4 0 010 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '</svg>';

  webviewMap.set(box.id, wv);
  wrapper.appendChild(wv);
  wrapper.appendChild(guard);
  wrapper.appendChild(overlay);
  wrapper.appendChild(audioIndicator);
  wrapper.appendChild(menu);
  return wrapper;
}

// ── New Box Picker ────────────────────────────────────────
function openNewBoxPicker() {
  if (state.boxes.length >= 16) return;
  renderNewBoxPicker();
  document.getElementById('newbox-backdrop').classList.add('visible');
}

function closeNewBoxPicker() {
  document.getElementById('newbox-backdrop').classList.remove('visible');
}

function renderNewBoxPicker() {
  const grid = document.getElementById('newbox-grid');
  grid.innerHTML = '';

  if (prefs.sites.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'newbox-empty';
    msg.textContent = 'No sites configured — add some in Settings.';
    grid.appendChild(msg);
    return;
  }

  prefs.sites.forEach((site) => {
    const btn = document.createElement('button');
    btn.className = 'site-btn';

    const img = document.createElement('img');
    img.className = 'site-btn-icon';
    img.src = faviconUrl(site.url);
    img.alt = hostOf(site.url);
    img.onerror = () => {
      // Replace broken img with a simple SVG globe placeholder
      const ph = document.createElement('span');
      ph.className = 'site-btn-icon-fallback';
      ph.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.4"/><path d="M10 2c0 0-4 3-4 8s4 8 4 8M10 2c0 0 4 3 4 8s-4 8-4 8M2 10h16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
      img.replaceWith(ph);
    };

    const label = document.createElement('span');
    label.className = 'site-btn-label';
    label.textContent = hostOf(site.url);

    btn.append(img, label);
    btn.addEventListener('click', () => {
      addBox(site.url);
      closeNewBoxPicker();
    });

    grid.appendChild(btn);
  });

  // "Go to URL" — opens the URL popup in new-box mode.
  const urlBtn = document.createElement('button');
  urlBtn.className = 'site-btn site-btn--custom';

  const linkIcon = document.createElement('span');
  linkIcon.className = 'site-btn-icon-fallback';
  linkIcon.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M8.5 11.5a4 4 0 005.66 0l2-2a4 4 0 00-5.66-5.66l-1 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M11.5 8.5a4 4 0 00-5.66 0l-2 2a4 4 0 005.66 5.66l1-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>';

  const urlLabel = document.createElement('span');
  urlLabel.className = 'site-btn-label';
  urlLabel.textContent = 'Go to URL';

  urlBtn.append(linkIcon, urlLabel);
  urlBtn.addEventListener('click', () => {
    closeNewBoxPicker();
    openUrlPopup(null);
  });

  grid.appendChild(urlBtn);
}

// ── Add Box ───────────────────────────────────────────────
function addBox(url) {
  if (state.boxes.length >= 16) return;

  const box = { id: state.nextBoxId++, url: url || 'https://www.youtube.com', audioOverride: false };
  state.boxes.push(box);
  state.layout = DEFAULT_LAYOUT_FOR_COUNT[state.boxes.length];

  // If the new default has a primary slot, put the highlighted box there.
  ensurePrimarySlot();

  if (!gridStage.querySelector(`.box[data-box-id="${box.id}"]`)) {
    gridStage.appendChild(createBox(box));
  }

  applyGridLayout();
  resizeStage();
  updateLayoutPicker();
  updateAddBoxButton();
  applyHighlight();
  saveSession();
}

// ── Highlight ─────────────────────────────────────────────
// In Main+N layouts: swaps the clicked box into the primary slot (index 0).
// In equal grids: only updates audio and the highlight ring.
function highlightBox(id) {
  if (state.highlightedBoxId === id) return;
  state.highlightedBoxId = id;

  const def = LAYOUT_DEFS[state.layout];
  if (def.hasPrimarySlot && state.boxes[0].id !== id) {
    const idx = state.boxes.findIndex((b) => b.id === id);
    if (idx > 0) {
      [state.boxes[0], state.boxes[idx]] = [state.boxes[idx], state.boxes[0]];
      applyGridLayout(); // reorders DOM and updates grid-column/grid-row
    }
  }

  applyHighlight();
  applyMuteStates();
  saveSession();
}

// ── Renumber Boxes ────────────────────────────────────────
// After any box removal, compact ids to 1..n so hotkeys, overlay badges,
// and session data stay consistent.  All DOM attributes and the webviewMap
// are updated in a single pass before any box.id value is mutated, so
// querySelector lookups (which use the old id) still work during the pass.
function renumberBoxes() {
  // Snapshot old ids in order so we can look up DOM nodes by their current id.
  const oldIds = state.boxes.map((b) => b.id);

  // Update highlighted reference using the new sequential position.
  const highlightIdx = state.boxes.findIndex((b) => b.id === state.highlightedBoxId);
  if (highlightIdx !== -1) state.highlightedBoxId = highlightIdx + 1;

  // Rebuild webviewMap and patch every DOM node that carries an id.
  const newWebviewMap = new Map();
  oldIds.forEach((oldId, i) => {
    const newId = i + 1;

    const el = gridStage.querySelector(`.box[data-box-id="${oldId}"]`);
    if (el) {
      el.dataset.boxId = String(newId);
      const overlay  = el.querySelector('.box-overlay');
      if (overlay)  overlay.textContent = String(newId);
      const audioBtn = el.querySelector('.box-menu-btn--audio');
      if (audioBtn) audioBtn.dataset.boxId = String(newId);
    }

    const wv = webviewMap.get(oldId);
    if (wv) newWebviewMap.set(newId, wv);

    // Mutate state object last — closures in createBox() reference the same
    // object, so they will automatically use the updated id going forward.
    state.boxes[i].id = newId;
  });

  webviewMap.clear();
  newWebviewMap.forEach((wv, id) => webviewMap.set(id, wv));

  state.nextBoxId = state.boxes.length + 1;
}

// ── Close Box ─────────────────────────────────────────────
function closeBox(id) {
  if (state.boxes.length <= 1) return;

  // Transfer highlight to the next-higher-id box before removing.
  if (state.highlightedBoxId === id) {
    const others = state.boxes.filter((b) => b.id !== id).sort((a, b) => a.id - b.id);
    const next = others.find((b) => b.id > id) ?? others[others.length - 1];
    state.highlightedBoxId = next.id;
  }

  state.boxes.splice(state.boxes.findIndex((b) => b.id === id), 1);
  webviewMap.delete(id);

  const el = gridStage.querySelector(`.box[data-box-id="${id}"]`);
  if (el) el.remove();

  // Compact remaining ids to 1..n (updates DOM, webviewMap, and state).
  renumberBoxes();

  state.layout = DEFAULT_LAYOUT_FOR_COUNT[state.boxes.length];
  ensurePrimarySlot();
  applyGridLayout();
  resizeStage();
  updateLayoutPicker();
  updateAddBoxButton();
  applyHighlight();
  applyMuteStates();
  saveSession();
}

// ── Audio Override ────────────────────────────────────────
function toggleAudioOverride(id) {
  const box = state.boxes.find((b) => b.id === id);
  if (!box) return;
  box.audioOverride = !box.audioOverride;
  applyMuteStates();
  const btn = gridStage.querySelector(`.box-menu-btn--audio[data-box-id="${id}"]`);
  if (btn) btn.textContent = box.audioOverride ? 'Audio: On' : 'Audio: Auto';
  const indicator = gridStage.querySelector(`.box[data-box-id="${id}"] .box-audio-indicator`);
  if (indicator) indicator.classList.toggle('active', box.audioOverride);
  saveSession();
}

// ── DOM Updaters ──────────────────────────────────────────
function applyHighlight() {
  gridStage.querySelectorAll('.box').forEach((el) => {
    const id = Number(el.dataset.boxId);
    const isHighlighted = id === state.highlightedBoxId;
    el.classList.toggle('box--highlighted', isHighlighted);
    const btn = el.querySelector('.box-menu-btn--highlight');
    if (btn) {
      btn.textContent = isHighlighted ? 'Highlighted' : 'Highlight';
      btn.disabled = isHighlighted;
    }
  });
}

function applyMuteStates() {
  state.boxes.forEach((box) => {
    const wv = webviewMap.get(box.id);
    if (!wv) return;
    wv.setAudioMuted(box.id !== state.highlightedBoxId && !box.audioOverride);
  });
}

function updateAddBoxButton() {
  const atMax = state.boxes.length >= 16;
  const atMin = state.boxes.length <= 1;

  document.getElementById('btn-add-box').disabled = atMax;

  // Disable Close on all box menus when only one box remains.
  gridStage.querySelectorAll('.box-menu-btn--close').forEach((btn) => {
    btn.disabled = atMin;
  });
}

// ── Render ────────────────────────────────────────────────
// Idempotent: creates only missing box DOM nodes; existing ones are preserved.
function renderGrid() {
  state.boxes.forEach((box) => {
    if (!gridStage.querySelector(`.box[data-box-id="${box.id}"]`)) {
      gridStage.appendChild(createBox(box));
    }
  });

  applyGridLayout();
  resizeStage();
  updateLayoutPicker();
  updateAddBoxButton();
  applyHighlight();
}

// ── Menu Bar ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Fullscreen
  const btnFullscreen = document.getElementById('btn-fullscreen');
  btnFullscreen.addEventListener('click', () => window.api.toggleFullscreen());
  window.api.onFullscreenChange((isFullscreen) => {
    btnFullscreen.title = isFullscreen ? 'Exit Fullscreen (F11)' : 'Toggle Fullscreen (F11)';
  });

  // Add Box — opens site picker instead of adding directly
  document.getElementById('btn-add-box').addEventListener('click', openNewBoxPicker);

  // Layout Picker
  document.getElementById('layout-picker').addEventListener('change', (e) => {
    setLayout(e.target.value);
  });

  // ── Bottom Hover Menu ─────────────────────────────────
  // #bottom-trigger (z-index 1000) always intercepts the cursor, even over
  // webviews. The menu is docked to the same bottom edge so the cursor is
  // already on the menu the moment it appears — no gap to cross.
  const bottomTrigger  = document.getElementById('bottom-trigger');
  const windowMenuEl   = document.getElementById('window-hover-menu');
  let wmHideTimer = null;

  function showWindowMenu() {
    clearTimeout(wmHideTimer);
    windowMenuEl.classList.add('visible');
  }
  function scheduleHideWindowMenu() {
    // In pinned mode the CSS keeps the menu visible regardless of the class,
    // but skip the timer to avoid unnecessary DOM churn.
    if (prefs.menuPinned) return;
    wmHideTimer = setTimeout(() => windowMenuEl.classList.remove('visible'), 120);
  }

  bottomTrigger.addEventListener('mouseenter', showWindowMenu);
  bottomTrigger.addEventListener('mouseleave', scheduleHideWindowMenu);
  windowMenuEl.addEventListener('mouseenter', showWindowMenu);
  windowMenuEl.addEventListener('mouseleave', scheduleHideWindowMenu);

  // Overlay toggle
  const btnOverlayToggle = document.getElementById('btn-overlay-toggle');
  btnOverlayToggle.addEventListener('click', () => {
    state.overlayActive = !state.overlayActive;
    btnOverlayToggle.setAttribute('aria-pressed', String(state.overlayActive));
    gridStage.classList.toggle('overlays-active', state.overlayActive);
    saveSession();
  });

  // ── New Box Picker ───────────────────────────────────
  document.getElementById('newbox-close').addEventListener('click', closeNewBoxPicker);
  document.getElementById('newbox-backdrop').addEventListener('click', (e) => {
    if (e.target === document.getElementById('newbox-backdrop')) closeNewBoxPicker();
  });

  // ── Settings popup ───────────────────────────────────
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('settings-backdrop').addEventListener('click', (e) => {
    if (e.target === document.getElementById('settings-backdrop')) closeSettings();
  });
  document.getElementById('setting-hotkeys').addEventListener('change', (e) => {
    state.hotkeysEnabled = e.target.checked;
    saveSession();
  });

  const highlightColorInput   = document.getElementById('setting-highlight-color');
  const highlightEnabledInput = document.getElementById('setting-highlight-enabled');

  highlightEnabledInput.addEventListener('change', (e) => {
    prefs.highlightEnabled = e.target.checked;
    highlightColorInput.disabled = !prefs.highlightEnabled;
    applyHighlightStyle();
    savePrefs();
  });

  highlightColorInput.addEventListener('input', (e) => {
    prefs.highlightColor = e.target.value;
    applyHighlightStyle();
    savePrefs();
  });

  // ── Settings — sites management ───────────────────────
  const siteInput  = document.getElementById('settings-site-input');
  const siteAddBtn = document.getElementById('settings-site-add-btn');

  function addSiteFromInput() {
    let url = siteInput.value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      new URL(url); // validate
    } catch {
      siteInput.style.borderColor = '#ff7070';
      setTimeout(() => { siteInput.style.borderColor = ''; }, 1200);
      return;
    }
    prefs.sites.push({ url });
    savePrefs();
    renderSettingsSites();
    siteInput.value = '';
    siteInput.focus();
  }

  siteAddBtn.addEventListener('click', addSiteFromInput);
  siteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSiteFromInput(); }
  });

  // ── Settings — menu bar position & pin ───────────────────
  const menuPositionSelect = document.getElementById('setting-menu-position');
  const menuPinnedInput    = document.getElementById('setting-menu-pinned');

  menuPositionSelect.addEventListener('change', (e) => {
    prefs.menuPosition = e.target.value;
    applyMenuSettings();
    savePrefs();
  });

  menuPinnedInput.addEventListener('change', (e) => {
    prefs.menuPinned = e.target.checked;
    applyMenuSettings();
    savePrefs();
  });

  // ── URL Popup controls ───────────────────────────────
  const urlInput    = document.getElementById('url-input');
  const urlBackdrop = document.getElementById('url-popup-backdrop');

  document.getElementById('url-engine-toggle').addEventListener('click', () => {
    urlPopup.engine = urlPopup.engine === 'youtube' ? 'google' : 'youtube';
    syncEngineToggle();
  });

  document.getElementById('url-submit').addEventListener('click', submitUrl);

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); submitUrl(); }
    if (e.key === 'Escape') { e.preventDefault(); closeUrlPopup(); }
  });

  // Click backdrop (outside popup card) to dismiss.
  urlBackdrop.addEventListener('click', (e) => {
    if (e.target === urlBackdrop) closeUrlPopup();
  });

  // ── Keyboard shortcuts ────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      window.api.toggleFullscreen();
      return;
    }

    // Escape closes any open popup or dialog.
    if (e.key === 'Escape') { closeUrlPopup(); hideRestoreDialog(); closeSettings(); closeNewBoxPicker(); return; }

    if (document.activeElement?.tagName === 'WEBVIEW') return;

    if (state.hotkeysEnabled) {
      const boxIndex = e.key === '0' ? 10 : parseInt(e.key, 10);
      if (!isNaN(boxIndex) && boxIndex >= 1) {
        const box = state.boxes.find((b) => b.id === boxIndex);
        if (box) highlightBox(boxIndex);
      }
    }
  });

  // ── Session restore dialog ────────────────────────────
  document.getElementById('btn-restore').addEventListener('click', async () => {
    hideRestoreDialog();
    const data = await window.api.loadSession();
    startWithSession(data);
  });

  document.getElementById('btn-fresh').addEventListener('click', () => {
    hideRestoreDialog();
    startFresh();
  });

  // ── Save on quit (synchronous so it completes before the process exits) ──
  window.api.onBeforeQuit(() => {
    try {
      const bounds = window.api.getWindowBoundsSync();
      window.api.saveSessionSync(buildSessionData(bounds));
    } catch (e) {
      console.error('[session] quit-save failed:', e);
    }
  });

  // ── Load prefs (independent of session — survives "Start Fresh") ──
  window.api.loadPrefs().then((data) => {
    if (data) {
      if (Array.isArray(data.sites) && data.sites.length > 0) prefs.sites = data.sites;
      if (typeof data.highlightColor   === 'string')  prefs.highlightColor   = data.highlightColor;
      if (typeof data.highlightEnabled === 'boolean') prefs.highlightEnabled = data.highlightEnabled;
      if (typeof data.menuPosition     === 'string')  prefs.menuPosition     = data.menuPosition;
      if (typeof data.menuPinned       === 'boolean') prefs.menuPinned       = data.menuPinned;
    }
    // Sync settings UI to loaded values.
    highlightColorInput.value     = prefs.highlightColor;
    highlightColorInput.disabled  = !prefs.highlightEnabled;
    highlightEnabledInput.checked = prefs.highlightEnabled;
    menuPositionSelect.value      = prefs.menuPosition;
    menuPinnedInput.checked       = prefs.menuPinned;
    applyHighlightStyle();
    applyMenuSettings();
    renderSettingsSites();
  }).catch(() => { applyHighlightStyle(); applyMenuSettings(); renderSettingsSites(); });

  // ── Session check — show restore dialog or start fresh ──
  window.api.sessionExists().then((has) => {
    if (has) showRestoreDialog();
    else     startFresh();
  });
});
