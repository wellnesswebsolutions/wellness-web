const { app, BrowserWindow, shell, Menu } = require('electron');
const { createApp, PORT } = require('./server');

let server;

function start() {
  server = createApp().listen(PORT, () => {
    createWindow();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    title: 'BrightSite Studio',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.loadURL(`http://localhost:${PORT}`);

  const menu = Menu.buildFromTemplate([
    {
      label: 'BrightSite Studio',
      submenu: [
        {
          label: 'Open in Browser (for colleagues)',
          click: () => shell.openExternal(`http://localhost:${PORT}`)
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(start);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
