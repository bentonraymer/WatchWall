const { app, BrowserWindow, ipcMain, session, components } = require('electron');
const path = require('path');
const fs = require('fs');

const SESSION_PATH   = path.join(app.getPath('userData'), 'session.json');
const SESSION_TMP    = path.join(app.getPath('userData'), 'session.tmp.json');
const PREFS_PATH     = path.join(app.getPath('userData'), 'prefs.json');
const PREFS_TMP      = path.join(app.getPath('userData'), 'prefs.tmp.json');

// Keep old name as alias so existing references compile.
const SESSION_TMP_PATH = SESSION_TMP;

const ICON_PATH = path.join(__dirname, '../watchwallicon.png');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 400,
    title: 'WatchWall',
    icon: ICON_PATH,
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

  // Configure every <webview> guest before it attaches. Setting these here (as a
  // real webPreferences object) is the reliable path — the webview element's
  // `webpreferences=""` attribute string does not dependably disable isolation.
  //
  // contextIsolation:false + sandbox:false make the webview preload run in the
  // page's MAIN world before any page script, so the Google-Chrome-brand shim in
  // webview-preload.js is in place before DRM sites (Prime Video, etc.) run their
  // browser-support check. nodeIntegration stays false, so guest pages still get
  // no access to Node/Electron APIs.
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences) => {
    webPreferences.contextIsolation = false;
    webPreferences.sandbox          = false;
    webPreferences.nodeIntegration  = false;
    webPreferences.preload          = path.join(__dirname, '../renderer/webview-preload.js');
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('window:fullscreen-changed', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('window:fullscreen-changed', false);
  });

  mainWindow.on('close', () => {
    mainWindow.webContents.send('app:before-quit');
  });
}

// IPC: session:exists
ipcMain.handle('session:exists', () => {
  return fs.existsSync(SESSION_PATH);
});

// IPC: session:load
ipcMain.handle('session:load', () => {
  try {
    const raw = fs.readFileSync(SESSION_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
});

// IPC: session:save — atomic write via tmp + rename
ipcMain.handle('session:save', (_, data) => {
  try {
    fs.writeFileSync(SESSION_TMP_PATH, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(SESSION_TMP_PATH, SESSION_PATH);
  } catch (err) {
    console.error('Failed to save session:', err);
  }
});

// IPC: window:toggle-fullscreen
ipcMain.handle('window:toggle-fullscreen', () => {
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

// IPC: window:get-bounds
ipcMain.handle('window:get-bounds', () => {
  const bounds = mainWindow.getBounds();
  return { ...bounds, isFullscreen: mainWindow.isFullScreen() };
});

// IPC: window:get-bounds-sync  (used on quit where async IPC can't be awaited)
ipcMain.on('window:get-bounds-sync', (event) => {
  event.returnValue = { ...mainWindow.getBounds(), isFullscreen: mainWindow.isFullScreen() };
});

// IPC: session:save-sync  (synchronous write used on quit)
ipcMain.on('session:save-sync', (event, data) => {
  try {
    fs.writeFileSync(SESSION_TMP_PATH, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(SESSION_TMP_PATH, SESSION_PATH);
  } catch (err) {
    console.error('Sync session save failed:', err);
  }
  event.returnValue = null;
});

// IPC: prefs:load
ipcMain.handle('prefs:load', () => {
  try {
    const raw = fs.readFileSync(PREFS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
});

// IPC: prefs:save — atomic write via tmp + rename
ipcMain.handle('prefs:save', (_, data) => {
  try {
    fs.writeFileSync(PREFS_TMP, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(PREFS_TMP, PREFS_PATH);
  } catch (err) {
    console.error('Failed to save prefs:', err);
  }
});

// IPC: window:restore-bounds  (called on session restore; size only, no position)
ipcMain.handle('window:restore-bounds', (_, bounds) => {
  if (!bounds) return;
  if (bounds.isFullscreen) {
    mainWindow.setFullScreen(true);
  } else if (bounds.width && bounds.height) {
    mainWindow.setSize(bounds.width, bounds.height, true);
  }
});

app.whenReady().then(async () => {
  // Download, verify, and load the VMP-signed Widevine CDM before opening any
  // window. Provided by the castLabs electron-releases fork (the `components`
  // module). Premium streaming sites (Prime Video, ESPN, Netflix, Disney+) gate
  // playback on a verified Widevine CDM; without this they show a black screen
  // or an "unsupported browser" page no matter how clean the user agent is.
  // Require only the Widevine CDM (whenReady() with no argument implicitly
  // requires all supported components, including the experimental Windows CDM
  // that is unavailable on macOS). This is best-effort and non-fatal: if the
  // Component Updater Service has no CDM for this OS/Chromium combination the
  // promise rejects, we log it, and the app still runs for non-DRM sites.
  try {
    await components.whenReady([components.WIDEVINE_CDM_ID]);
    console.log('Widevine CDM ready:', JSON.stringify(components.status()));
  } catch (err) {
    console.warn('Widevine CDM unavailable on this platform; DRM playback will not work:', err.message);
  }

  // Strip "Electron/x.x.x" and "WatchWall/x.x.x" from the default session user
  // agent. Many streaming sites (ESPN, Prime Video, etc.) detect these tokens and
  // either show an "unsupported browser" page or serve a broken/black experience.
  // After this, the UA looks like a standard Chrome browser on the same OS.
  const cleanUA = session.defaultSession.getUserAgent()
    .replace(/\s*WatchWall\/\S+/, '')
    .replace(/\s*Electron\/\S+/, '');
  session.defaultSession.setUserAgent(cleanUA);

  // Belt-and-suspenders: override the User-Agent header on every outgoing HTTP
  // request so the clean UA is used even if a webview's own UA wasn't patched.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = cleanUA;
    callback({ requestHeaders: details.requestHeaders });
  });

  if (app.dock) app.dock.setIcon(ICON_PATH);
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
