// Electron-only preload. Exposes the app-update controls (lib/app-updater.js)
// to the page as window.brightsiteUpdates, which public/app.js turns into the
// version/update button in the top bar. In a plain browser (colleagues on
// http://localhost:4173) this never runs, so the button simply isn't shown.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('brightsiteUpdates', {
  getState: () => ipcRenderer.invoke('app-update:status'),
  check: () => ipcRenderer.invoke('app-update:check'),
  install: () => ipcRenderer.send('app-update:install'),
  onState: (fn) => {
    ipcRenderer.on('app-update:state', (_event, state) => fn(state));
  }
});
