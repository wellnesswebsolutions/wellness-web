// Google refuses to sign in inside any embedded browser — Electron windows
// get "Couldn't sign you in" no matter how the UA or client hints are
// dressed up (tried Firefox UA, then a full Chrome UA + Sec-CH-UA override;
// both still blocked). So the sign-in happens in the user's REAL Chrome (or
// Edge/Brave), in a separate profile kept just for Studio, and the
// resulting Google cookies are copied into the app's import session.
//
// Chrome is driven over --remote-debugging-pipe (JSON messages separated by
// NUL bytes on fds 3/4) — no WebSocket client needed, and unlike
// --enable-automation it doesn't flag the browser as automated, so Google
// treats it as the normal browser it is.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const IS_WIN = process.platform === 'win32';

function findBrowser() {
  const candidates = IS_WIN
    ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
        .filter(Boolean)
        .flatMap(base => [
          path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          path.join(base, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
        ])
    : [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
      ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function profileDir() {
  return path.join(require('electron').app.getPath('userData'), 'google-signin-browser');
}

const SAME_SITE = { Strict: 'strict', Lax: 'lax', None: 'no_restriction' };

async function importCookies(cookies, targetSession, domainPattern) {
  const wanted = cookies.filter(c => !c.partitionKey && domainPattern.test(c.domain.replace(/^\./, '')));
  await Promise.all(wanted.map(c => {
    const details = {
      url: `https://${c.domain.replace(/^\./, '')}${c.path}`,
      name: c.name,
      value: c.value,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: SAME_SITE[c.sameSite] || 'unspecified'
    };
    if (c.domain.startsWith('.')) details.domain = c.domain; // else host-only
    if (!c.session && c.expires > 0) details.expirationDate = c.expires;
    return targetSession.cookies.set(details).catch(() => {});
  }));
  return wanted.length;
}

let running = null;

// Opens the real browser at `url`; resolves true once the Google login
// cookie has been copied into `targetSession` (the browser then closes
// itself), false if the user closes the browser first. Returns null when no
// supported browser is installed, so the caller can fall back.
function signInWithRealBrowser({ url, targetSession, domainPattern, loggedInCookie }) {
  const exe = findBrowser();
  if (!exe) return null;
  if (running) return running;

  const child = spawn(exe, [
    `--user-data-dir=${profileDir()}`,
    '--remote-debugging-pipe',
    '--no-first-run',
    '--no-default-browser-check',
    url
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });

  running = new Promise(resolve => {
    const [, , , toBrowser, fromBrowser] = child.stdio;
    let nextId = 1;
    let buffer = '';
    let done = false;
    const pending = new Map();

    const send = (method, params = {}) => new Promise(res => {
      const id = nextId++;
      pending.set(id, res);
      try { toBrowser.write(JSON.stringify({ id, method, params }) + '\0'); } catch { res(null); }
    });

    fromBrowser.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let end;
      while ((end = buffer.indexOf('\0')) !== -1) {
        const raw = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        let msg;
        try { msg = JSON.parse(raw); } catch { continue; }
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg.result || null);
          pending.delete(msg.id);
        }
      }
    });
    toBrowser.on('error', () => {});
    fromBrowser.on('error', () => {});

    const finish = ok => {
      if (done) return;
      done = true;
      clearInterval(poll);
      pending.forEach(res => res(null));
      running = null;
      resolve(ok);
    };

    const poll = setInterval(async () => {
      const result = await send('Storage.getCookies');
      const cookies = (result && result.cookies) || [];
      if (done || !cookies.some(c => c.name === loggedInCookie && domainPattern.test(c.domain.replace(/^\./, '')))) return;
      await importCookies(cookies, targetSession, domainPattern);
      await send('Browser.close');
      finish(true);
    }, 1500);

    child.on('exit', () => finish(false));
    child.on('error', () => finish(false));
  });
  return running;
}

// Signing out must also forget the login held by the separate browser
// profile, or the next sign-in would silently copy it straight back.
function forgetRealBrowserLogin() {
  if (running) return;
  try { fs.rmSync(profileDir(), { recursive: true, force: true }); } catch {}
}

module.exports = { signInWithRealBrowser, forgetRealBrowserLogin, findBrowser };
