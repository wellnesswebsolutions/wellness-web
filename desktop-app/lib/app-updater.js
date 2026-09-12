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

//
// Unsigned Macs: Squirrel.Mac refuses to install without a Developer ID,
// so instead the app downloads the release's Mac zip itself, checks its
// sha512 against latest-mac.yml, unpacks it, and on "install" hands off to
// a tiny detached script that waits for the app to quit, swaps the .app in
// place and relaunches it. Same loading-screen flow as Windows.

const { app, ipcMain, shell } = require('electron');
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
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
const appBundlePath = () => path.resolve(process.execPath, '..', '..', '..');

function canInstallUpdates() {
  if (process.platform === 'win32') return true;
  if (process.platform !== 'darwin') return false;
  const res = spawnSync('codesign', ['-dv', '--verbose=2', appBundlePath()], { encoding: 'utf8', timeout: 3000 });
  return /Authority=Developer ID Application/.test(`${res.stdout || ''}${res.stderr || ''}`);
}

// An unsigned Mac can still replace its own .app if it's allowed to write
// where it's installed (e.g. /Applications for an admin user).
function canSelfReplaceMac() {
  if (process.platform !== 'darwin') return false;
  const bundle = appBundlePath();
  if (!bundle.endsWith('.app')) return false;
  try {
    fs.accessSync(path.dirname(bundle), fs.constants.W_OK);
    fs.accessSync(bundle, fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

// owner/repo from the same app-update.yml electron-updater uses.
function releaseRepo() {
  try {
    const yml = fs.readFileSync(path.join(process.resourcesPath, 'app-update.yml'), 'utf8');
    const owner = /^owner:\s*(\S+)/m.exec(yml)?.[1];
    const repo = /^repo:\s*(\S+)/m.exec(yml)?.[1];
    return owner && repo ? { owner, repo } : null;
  } catch (_) {
    return null;
  }
}

// Where to download the newest version by hand.
function releasesPageUrl() {
  const r = releaseRepo();
  return r ? `https://github.com/${r.owner}/${r.repo}/releases/latest` : null;
}

async function downloadMacUpdate(info, onProgress) {
  const r = releaseRepo();
  const file = (info.files || []).find(f => /\.zip$/.test(f.url));
  if (!r || !file) throw new Error('No Mac download found in the release');
  const url = /^https:\/\//.test(file.url) ? file.url : `https://github.com/${r.owner}/${r.repo}/releases/download/v${info.version}/${file.url}`;
  const dir = path.join(app.getPath('temp'), `brightsite-update-${info.version}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const zipPath = path.join(dir, 'update.zip');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Update download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || file.size || 0;
  const hash = crypto.createHash('sha512');
  const out = fs.createWriteStream(zipPath);
  let received = 0;
  for await (const chunk of res.body) {
    hash.update(chunk);
    received += chunk.length;
    if (!out.write(chunk)) await new Promise(resolve => out.once('drain', resolve));
    if (total) onProgress(Math.min(100, Math.round((received / total) * 100)));
  }
  await new Promise((resolve, reject) => out.end(err => (err ? reject(err) : resolve())));
  if (file.sha512 && hash.digest('base64') !== file.sha512) throw new Error('Downloaded update failed its integrity check');

  const unzip = spawnSync('ditto', ['-x', '-k', zipPath, dir], { encoding: 'utf8' });
  if (unzip.status !== 0) throw new Error('Could not unpack the update');
  const newApp = fs.readdirSync(dir).map(n => path.join(dir, n)).find(p => p.endsWith('.app'));
  if (!newApp) throw new Error('Update didn’t contain the app');
  return newApp;
}

// Runs detached after the app quits: swap the .app in place (restoring the
// old one if the move fails), clear quarantine, relaunch. Paths arrive as
// arguments, never interpolated into the script.
const MAC_SWAP_SCRIPT = `
pid="$1"; old="$2"; new="$3"
while kill -0 "$pid" 2>/dev/null; do sleep 0.3; done
rm -rf "$old.previous"
if mv "$old" "$old.previous"; then
  if mv "$new" "$old"; then rm -rf "$old.previous"; else mv "$old.previous" "$old"; fi
fi
xattr -dr com.apple.quarantine "$old" 2>/dev/null
open "$old"
`;

function installMacUpdate(newApp) {
  spawn('/bin/bash', ['-c', MAC_SWAP_SCRIPT, 'brightsite-swap', String(process.pid), appBundlePath(), newApp], {
    detached: true,
    stdio: 'ignore'
  }).unref();
  app.quit();
}

function initAutoUpdates(getWindow) {
  let autoUpdater = null;
  let pendingVersion = null;
  let macNewApp = null;
  const signedInstall = app.isPackaged ? canInstallUpdates() : false;
  const macSelfUpdate = app.isPackaged && !signedInstall && canSelfReplaceMac();
  const canAutoInstall = signedInstall || macSelfUpdate;
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
      if (macSelfUpdate) {
        try {
          installMacUpdate(macNewApp);
        } catch (err) {
          log('error', 'Mac self-update install failed', err);
        }
        return;
      }
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

  // Unsigned Macs download the zip themselves (downloadMacUpdate) —
  // letting Squirrel.Mac do it would fail its signature check.
  autoUpdater.autoDownload = signedInstall;
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
  if (macSelfUpdate) log('info', 'Unsigned Mac build — will download and swap in updates itself');
  else if (!canAutoInstall) log('info', 'This build cannot install updates itself — will point to the download page');

  autoUpdater.on('checking-for-update', () => {
    if (state.status !== 'ready') setState({ status: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version;
    if (signedInstall) {
      log('info', `Update available: ${info.version}, downloading`);
      setState({ status: 'downloading', newVersion: pendingVersion, percent: 0 });
    } else if (macSelfUpdate) {
      log('info', `Update available: ${info.version}, downloading Mac zip`);
      setState({ status: 'downloading', newVersion: pendingVersion, percent: 0 });
      downloadMacUpdate(info, percent => setState({ status: 'downloading', newVersion: pendingVersion, percent }))
        .then(newApp => {
          macNewApp = newApp;
          log('info', `Update ${info.version} downloaded and ready`);
          setState({ status: 'ready', newVersion: info.version });
        })
        .catch(err => {
          log('error', 'Mac update download failed', err);
          setState({ status: 'error', message: String(err.message || err).slice(0, 200) });
        });
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
