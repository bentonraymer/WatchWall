const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // --- Session ---
  sessionExists: () => ipcRenderer.invoke('session:exists'),
  loadSession:   () => ipcRenderer.invoke('session:load'),
  saveSession:   (data) => ipcRenderer.invoke('session:save', data),

  // --- Window ---
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  getWindowBounds:  () => ipcRenderer.invoke('window:get-bounds'),

  // --- Main → Renderer events ---
  onFullscreenChange: (cb) => {
    ipcRenderer.on('window:fullscreen-changed', (_, isFullscreen) => cb(isFullscreen));
  },
  onBeforeQuit: (cb) => {
    ipcRenderer.on('app:before-quit', () => cb());
  },

  // Synchronous variants used on quit (async IPC cannot be awaited there).
  getWindowBoundsSync: () => ipcRenderer.sendSync('window:get-bounds-sync'),
  saveSessionSync:     (data) => ipcRenderer.sendSync('session:save-sync', data),

  // Restore window size / fullscreen on session load.
  restoreWindowBounds: (bounds) => ipcRenderer.invoke('window:restore-bounds', bounds),

  // --- Preferences (sites list; persists independently of session) ---
  loadPrefs: ()       => ipcRenderer.invoke('prefs:load'),
  savePrefs: (data)   => ipcRenderer.invoke('prefs:save', data),
});
