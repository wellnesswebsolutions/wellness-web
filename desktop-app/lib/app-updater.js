// App auto-updates via GitHub Releases (electron-updater).
//
// Completely separate from the Supabase business-data sync: this only
// replaces the app itself. User data lives in ~/BrightSiteProjects, outside
// the install folder, so an update never touches it.
//
// Behaviour: check a few seconds after launch (and every few hours), download
// quietly in the background, then tell the renderer an update is ready. It is
// only installed when the user clicks "Restart to update" — never on quit.
// Every failure (offline, no release yet, GitHub down) is logged to
// <logs>/updates.log and otherwise ignored, so it can never block the app.

const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const FIRST_CHECK_DELAY_MS = 8 * 1000;
const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let logFile;
function log(level, ...parts) {
  const line = `[${new Date().toISOString()}] ${level}: ${parts
    .map((p) => (p instanceof Error ? p.stack || p.message : typeof p === 'string' ? p : JSON.stringify(p)))
    .join(' ')}`;
  console.log(`[updater] ${line}`);
  try {
    if (!logFile) logFile = path.join(app.getPath('logs'), 'updates.log');
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, line + '\n');
  } catch (_) {
    // Logging must never break anything.
  }
}

function initAutoUpdates(getWindow) {
  let readyVersion = null;
  let autoUpdater = null;

  // Registered even in dev so the preload's status request always resolves.
  ipcMain.handle('app-update:status', () => (readyVersion ? { version: readyVersion } : null));
  ipcMain.on('app-update:install', () => {
    if (!autoUpdater || !readyVersion) return;
    log('info', `User chose to restart and install ${readyVersion}`);
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (err) {
        log('error', 'quitAndInstall failed', err);
      }
    });
  });

  if (!app.isPackaged) {
    log('info', 'Development mode — update checks disabled');
    return;
  }

  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    log('error', 'electron-updater unavailable', err);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = {
    info: (...a) => log('info', ...a),
    warn: (...a) => log('warn', ...a),
    error: (...a) => log('error', ...a),
    debug: () => {}
  };

  autoUpdater.on('update-available', (info) => log('info', `Update available: ${info.version}, downloading`));
  autoUpdater.on('update-not-available', () => log('info', `Up to date (${app.getVersion()})`));
  autoUpdater.on('error', (err) => log('error', 'Update check/download failed', err));
  autoUpdater.on('update-downloaded', (info) => {
    readyVersion = info.version;
    log('info', `Update ${info.version} downloaded and ready`);
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('app-update:ready', { version: readyVersion });
  });

  const check = () => {
    if (readyVersion) return;
    autoUpdater.checkForUpdates().catch((err) => log('error', 'checkForUpdates rejected', err));
  };
  setTimeout(check, FIRST_CHECK_DELAY_MS);
  setInterval(check, RECHECK_INTERVAL_MS).unref();
}

module.exports = { initAutoUpdates };
