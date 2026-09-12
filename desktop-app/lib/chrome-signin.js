// Google refuses to sign in inside any embedded browser — Electron windows
// get "Couldn't sign you in" no matter how the UA or client hints are
// dressed up (tried Firefox UA, then a full Chrome UA + Sec-CH-UA override;
// both still blocked). So the sign-in happens in the user's REAL Chrome (or
// Edge/Brave), in a separate profile kept just for Studio, and the
// resulting Google cookies are copied into the app's import session.
//
// Google also blocks a real Chrome that has a DevTools client attached
// (even over --remote-debugging-pipe), so the visible sign-in browser is
// launched with NO automation flags at all. We watch its cookie database
// on disk for the login cookie's name (names are stored unencrypted), then
// quit it and reopen the same profile headless over --remote-debugging-pipe
// (JSON messages separated by NUL bytes on fds 3/4) purely to read the
// decrypted cookies out.
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

// Chrome has kept the cookie DB at Default/Cookies and, more recently,
// Default/Network/Cookies — check both plus their journals.
function cookieDbHas(name) {
  const base = path.join(profileDir(), 'Default');
  const needle = Buffer.from(name);
  return ['Cookies', path.join('Network', 'Cookies')]
    .flatMap(f => [f, `${f}-journal`, `${f}-wal`])
    .some(f => {
      try { return fs.readFileSync(path.join(base, f)).includes(needle); } catch { return false; }
    });
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

// Opens the profile headless with a DevTools pipe and returns every cookie
// (decrypted by the browser itself), or [] on failure.
function readCookiesHeadless(exe) {
  return new Promise(resolve => {
    const child = spawn(exe, [
      `--user-data-dir=${profileDir()}`,
      '--headless=new',
      '--remote-debugging-pipe',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
    const [, , , toBrowser, fromBrowser] = child.stdio;
    let buffer = '';
    let done = false;
    const finish = cookies => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { toBrowser.write(JSON.stringify({ id: 2, method: 'Browser.close' }) + '\0'); } catch {}
      setTimeout(() => { try { child.kill(); } catch {} }, 3000);
      resolve(cookies);
    };
    const timer = setTimeout(() => finish([]), 20000);
    fromBrowser.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let end;
      while ((end = buffer.indexOf('\0')) !== -1) {
        const raw = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        let msg;
        try { msg = JSON.parse(raw); } catch { continue; }
        if (msg.id === 1) finish((msg.result && msg.result.cookies) || []);
      }
    });
    toBrowser.on('error', () => {});
    fromBrowser.on('error', () => {});
    child.on('exit', () => finish([]));
    child.on('error', () => finish([]));
    try { toBrowser.write(JSON.stringify({ id: 1, method: 'Storage.getCookies' }) + '\0'); } catch { finish([]); }
  });
}

let running = null;

// Opens the real browser at `url`; resolves true once the Google login
// cookie has been copied into `targetSession` (the browser then closes
// itself), false if the user closes the browser without signing in.
// Returns null when no supported browser is installed, so the caller can
// fall back.
function signInWithRealBrowser({ url, targetSession, domainPattern, loggedInCookie }) {
  const exe = findBrowser();
  if (!exe) return null;
  if (running) return running;

  const child = spawn(exe, [
    `--user-data-dir=${profileDir()}`,
    '--no-first-run',
    '--no-default-browser-check',
    url
  ], { stdio: 'ignore' });

  running = new Promise(resolve => {
    // Chrome flushes cookies to disk every ~30s, so this can lag a little;
    // closing the window also works, since cookies are read after exit.
    const poll = setInterval(() => {
      if (cookieDbHas(loggedInCookie)) {
        clearInterval(poll);
        try { child.kill('SIGTERM'); } catch {}
      }
    }, 2000);

    child.once('exit', async () => {
      clearInterval(poll);
      let ok = false;
      if (cookieDbHas(loggedInCookie)) {
        const cookies = await readCookiesHeadless(exe);
        if (cookies.some(c => c.name === loggedInCookie && domainPattern.test(c.domain.replace(/^\./, '')))) {
          await importCookies(cookies, targetSession, domainPattern);
          ok = true;
        }
      }
      running = null;
      resolve(ok);
    });
    child.once('error', () => { clearInterval(poll); running = null; resolve(false); });
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
