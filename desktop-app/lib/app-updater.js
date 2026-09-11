// App auto-updates via GitHub Releases (electron-updater).
//
// Completely separate from the Supabase business-data sync: this only
// replaces the app itself. User data lives in ~/BrightSiteProjects, outside
// the install folder, so an update never touches it.
//
// Behaviour: check a few seconds after launch (and every few hours), or when
// someone clicks "Check for updates" in the top bar. A newer version
// downloads quietly in the background, and is only installed when the user
// clicks "Restart to update" — never on quit. Every state change is pushed to
// the renderer (see preload.js), and every failure (offline, GitHub down) is
// logged to <logs>/updates.log and shown on the button, never blocking the app.

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

// electron-updater reports "no release published yet" as an error. For
// someone clicking "Check for updates" that just means there's nothing newer.
function isNoReleaseError(err) {
  return /404|No published versions|Unable to find latest version|Cannot find latest(-mac)?\.yml/i.test(
    String((err && err.message) || err)
  );
}

function initAutoUpdates(getWindow) {
  let autoUpdater = null;
  let pendingVersion = null;
  // status: dev | idle | checking | downloading | ready | up-to-date | error
  let state = { status: app.isPackaged ? 'idle' : 'dev', version: app.getVersion() };

  const setState = (next) => {
    state = { version: app.getVersion(), ...next };
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('app-update:state', state);
  };

  // One failure reaches us twice — as the 'error' event and as the rejected
  // checkForUpdates() promise. Whichever arrives first settles the state;
  // the second finds nothing in progress and is ignored.
  const handleError = (err) => {
    if (!['checking', 'downloading'].includes(state.status)) return;
    if (isNoReleaseError(err)) {
      log('info', 'No release published yet — treating as up to date');
      setState({ status: 'up-to-date' });
      return;
    }
    log('error', 'Update check/download failed', err);
    setState({ status: 'error', message: String((err && err.message) || err).split('\n')[0].slice(0, 200) });
  };

  const check = () => {
    if (!autoUpdater || ['checking', 'downloading', 'ready'].includes(state.status)) return;
    setState({ status: 'checking' });
    autoUpdater
      .checkForUpdates()
      .then((result) => {
        // null = updater inactive (e.g. no app-update.yml), and no events
        // will follow — don't leave the button spinning.
        if (!result && state.status === 'checking') setState({ status: 'up-to-date' });
      })
      .catch(handleError);
  };

  // Registered even in dev so the renderer's requests always resolve.
  ipcMain.handle('app-update:status', () => state);
  ipcMain.handle('app-update:check', () => {
    check();
    return state;
  });
  ipcMain.on('app-update:install', () => {
    if (!autoUpdater || state.status !== 'ready') return;
    log('info', `User chose to restart and install ${state.newVersion}`);
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
    setState({ status: 'dev' });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = {
    info: (...a) => log('info', ...a),
    warn: (...a) => log('warn', ...a),
    // electron-updater logs every failure itself; handleError decides what
    // is actually an error, so "no release yet" isn't written as one.
    error: (...a) => {
      if (!a.some(isNoReleaseError)) log('error', ...a);
    },
    debug: () => {}
  };

  autoUpdater.on('checking-for-update', () => {
    if (state.status !== 'ready') setState({ status: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version;
    log('info', `Update available: ${info.version}, downloading`);
    setState({ status: 'downloading', newVersion: pendingVersion, percent: 0 });
  });
  autoUpdater.on('download-progress', (p) => {
    setState({ status: 'downloading', newVersion: pendingVersion, percent: Math.round(p.percent || 0) });
  });
  autoUpdater.on('update-not-available', () => {
    log('info', `Up to date (${app.getVersion()})`);
    setState({ status: 'up-to-date' });
  });
  autoUpdater.on('update-downloaded', (info) => {
    log('info', `Update ${info.version} downloaded and ready`);
    setState({ status: 'ready', newVersion: info.version });
  });
  autoUpdater.on('error', handleError);

  setTimeout(check, FIRST_CHECK_DELAY_MS);
  setInterval(check, RECHECK_INTERVAL_MS).unref();
}

module.exports = { initAutoUpdates };
