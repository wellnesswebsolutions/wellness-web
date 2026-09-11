// Electron-only preload. Exposes the app-update controls (lib/app-updater.js)
// to the page as window.brightsiteUpdates. public/launch-gate.js uses it to
// hold the loading screen while updating, and public/app.js turns it into the
// version/update button in the top bar. In a plain browser (colleagues on
// http://localhost:4173) this never runs, so neither appears.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('brightsiteUpdates', {
  getState: () => ipcRenderer.invoke('app-update:status'),
  check: () => ipcRenderer.invoke('app-update:check'),
  install: () => ipcRenderer.send('app-update:install'),
  openDownload: () => ipcRenderer.send('app-update:open-download'),
  onState: (fn) => {
    ipcRenderer.on('app-update:state', (_event, state) => fn(state));
  }
});
