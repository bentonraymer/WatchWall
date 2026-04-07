const { app, BrowserWindow, ipcMain } = require('electron');
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

app.whenReady().then(() => {
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
