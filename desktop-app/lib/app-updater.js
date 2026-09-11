// App auto-updates via GitHub Releases (electron-updater).
//
// Completely separate from the Supabase business-data sync: this only
// replaces the app itself. User data lives in ~/BrightSiteProjects, outside
// the install folder, so an update never touches it.
//
// Behaviour: check straight away at launch (the loading screen waits a few
// seconds for the answer, see public/launch-gate.js), again every few hours,
// and whenever someone clicks "Check for updates" in the top bar. A newer
// version downloads in the background and installs silently when either the
// loading screen or the "Restart to update" button asks for it, never on quit.
// Every state change is pushed to the renderer (see preload.js), and every
// failure (offline, GitHub down) is logged to <logs>/updates.log and shown on
// the button, never blocking the app.

const { app, ipcMain, shell } = require('electron');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

// Squirrel.Mac only installs an update signed with a real Developer ID.
// An ad-hoc signed build (no Apple Developer certificate yet) still downloads
// the update and reports it ready, then the install silently never happens.
// So a Mac only downloads and installs itself when that signature is really
// there; otherwise it points people at the download page instead.
function canInstallUpdates() {
  if (process.platform === 'win32') return true;
  if (process.platform !== 'darwin') return false;
  const bundle = path.resolve(process.execPath, '..', '..', '..');
  const res = spawnSync('codesign', ['-dv', '--verbose=2', bundle], { encoding: 'utf8', timeout: 3000 });
  return /Authority=Developer ID Application/.test(`${res.stdout || ''}${res.stderr || ''}`);
}

// Where to download the newest version by hand, read from the same
// app-update.yml electron-updater uses.
function releasesPageUrl() {
  try {
    const yml = fs.readFileSync(path.join(process.resourcesPath, 'app-update.yml'), 'utf8');
    const owner = /^owner:\s*(\S+)/m.exec(yml)?.[1];
    const repo = /^repo:\s*(\S+)/m.exec(yml)?.[1];
    return owner && repo ? `https://github.com/${owner}/${repo}/releases/latest` : null;
  } catch (_) {
    return null;
  }
}

function initAutoUpdates(getWindow) {
  let autoUpdater = null;
  let pendingVersion = null;
  const canAutoInstall = app.isPackaged ? canInstallUpdates() : false;
  const downloadUrl = app.isPackaged ? releasesPageUrl() : null;
  // status: dev | idle | checking | downloading | ready | available | up-to-date | error
  // ('available' = newer version out, but this build can't install it itself)
  let state = { version: app.getVersion(), canAutoInstall, status: app.isPackaged ? 'idle' : 'dev' };

  const setState = (next) => {
    state = { version: app.getVersion(), canAutoInstall, ...next };
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
    if (!autoUpdater || !canAutoInstall || state.status !== 'ready') return;
    log('info', `Installing ${state.newVersion} and restarting`);
    setImmediate(() => {
      try {
        // Silent (no Windows installer wizard) and relaunch afterwards.
        autoUpdater.quitAndInstall(true, true);
      } catch (err) {
        log('error', 'quitAndInstall failed', err);
      }
    });
  });
  ipcMain.on('app-update:open-download', () => {
    if (downloadUrl) shell.openExternal(downloadUrl);
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

  autoUpdater.autoDownload = canAutoInstall;
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
  if (!canAutoInstall) log('info', 'This build cannot install updates itself (no Developer ID signature) — will point to the download page');

  autoUpdater.on('checking-for-update', () => {
    if (state.status !== 'ready') setState({ status: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version;
    if (canAutoInstall) {
      log('info', `Update available: ${info.version}, downloading`);
      setState({ status: 'downloading', newVersion: pendingVersion, percent: 0 });
    } else {
      log('info', `Update available: ${info.version} — manual download`);
      setState({ status: 'available', newVersion: pendingVersion, downloadUrl });
    }
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

  // Straight away: the loading screen is waiting on this answer.
  check();
  setInterval(check, RECHECK_INTERVAL_MS).unref();
}

module.exports = { initAutoUpdates };
