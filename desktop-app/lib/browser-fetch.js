// Facebook (and, to a lesser extent, Google Maps) blocks plain HTTP
// requests — no user-agent spoofing gets past it, confirmed repeatedly
// (see lib/scrape.js and lib/ai-import.js's WebFetch attempts, both
// blocked). What actually works: Electron itself IS a real Chromium
// browser. Loading the page in a real (hidden) browser window — same as
// a person visiting the page — renders it properly and lets us read the
// real DOM: photos, about text, reviews, follower counts, all the things
// a bare fetch() never sees.
//
// Only usable inside the Electron main process (`require('electron')`
// returns a path string, not the API, when run under plain `node`) —
// isElectronMain() guards every caller so the server still works
// (with reduced import quality) when run standalone via `npm run server`.
const SESSION_PARTITION = 'persist:brightsite-import';

function isElectronMain() {
  try {
    const electron = require('electron');
    return typeof electron.BrowserWindow === 'function';
  } catch {
    return false;
  }
}

// Set on the webContents (not just the first loadURL) so every redirect
// and follow-up page keeps it — otherwise Electron's default UA, which
// contains "Electron/…", leaks on the second page and Google refuses the
// sign-in as an "insecure embedded browser".
const IS_WIN = process.platform === 'win32';
const CHROME_UA = IS_WIN
  ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
// Google's sign-in cross-checks the UA string against the Sec-CH-UA client
// hint headers AND navigator.userAgentData. Electron's hints list only
// "Chromium" (no "Google Chrome" brand), so any UA — even a Firefox one,
// which then contradicts the Chromium hints — gets "Couldn't sign you in".
// Fix: override all three consistently via the DevTools protocol so the
// window presents as real Google Chrome of the same engine version.
const CHROME_MAJOR = (process.versions.chrome || '128').split('.')[0];
const GOOGLE_SIGNIN_UA = CHROME_UA.replace(/Chrome\/[\d.]+/, `Chrome/${CHROME_MAJOR}.0.0.0`);
const CHROME_UA_METADATA = {
  brands: [
    { brand: 'Chromium', version: CHROME_MAJOR },
    { brand: 'Google Chrome', version: CHROME_MAJOR },
    { brand: 'Not;A=Brand', version: '24' }
  ],
  fullVersionList: [
    { brand: 'Chromium', version: `${CHROME_MAJOR}.0.0.0` },
    { brand: 'Google Chrome', version: `${CHROME_MAJOR}.0.0.0` },
    { brand: 'Not;A=Brand', version: '24.0.0.0' }
  ],
  fullVersion: `${CHROME_MAJOR}.0.0.0`,
  platform: IS_WIN ? 'Windows' : 'macOS',
  platformVersion: IS_WIN ? '10.0.0' : '14.0.0',
  architecture: process.arch === 'arm64' ? 'arm' : 'x86',
  model: '',
  mobile: false,
  bitness: '64',
  wow64: false
};

function spoofRealChrome(webContents) {
  try {
    webContents.debugger.attach('1.3');
  } catch {
    return; // already attached — nothing more we can do
  }
  webContents.debugger.sendCommand('Network.setUserAgentOverride', {
    userAgent: GOOGLE_SIGNIN_UA,
    platform: IS_WIN ? 'Win32' : 'MacIntel',
    userAgentMetadata: CHROME_UA_METADATA
  }).catch(() => {});
}

const SIGN_IN = {
  google: {
    url: 'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fwww.google.com%2Fmaps',
    userAgent: GOOGLE_SIGNIN_UA,
    spoofChrome: true,
    cookieDomain: /(^|\.)google\.[a-z.]+$/
  },
  facebook: {
    url: 'https://www.facebook.com/login',
    userAgent: CHROME_UA,
    cookieDomain: /(^|\.)facebook\.com$/
  }
};

// scontent* hosts real uploaded photos (profile/cover/posts); static.xx.fbcdn
// is Facebook's own UI chrome (icons, emoji, decorative webp) — deliberately
// excluded so "images found" means real content, not interface noise.
const IMAGE_HOST_PATTERN = /^https:\/\/(scontent[.\-]|lh3\.googleusercontent|lh5\.googleusercontent|streetviewpixels)/;

// Renders a page in a hidden browser window using a persistent session —
// if the user has ever signed in via openSignInWindow(), that login
// carries over here automatically, getting far richer (non-public) data.
// Without a sign-in, this still gets everything a normal logged-out
// visitor would see, which is already much more than a bare fetch gets.
async function renderPage(url) {
  const { BrowserWindow, session } = require('electron');
  const win = new BrowserWindow({
    show: false,
    width: 1000,
    height: 1000,
    webPreferences: { session: session.fromPartition(SESSION_PARTITION), images: true }
  });
  try {
    win.webContents.setUserAgent(CHROME_UA);
    await win.loadURL(url);
    // let lazy-loaded photos/reviews settle in
    await new Promise(resolve => setTimeout(resolve, 1800));
    const [text, images, title] = await Promise.all([
      win.webContents.executeJavaScript('document.body ? document.body.innerText : ""').catch(() => ''),
      win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('img')).map(i => i.src)`
      ).catch(() => []),
      win.webContents.executeJavaScript('document.title').catch(() => '')
    ]);
    const images_ = [...new Set((images || []).filter(src => IMAGE_HOST_PATTERN.test(src)))].slice(0, 8);
    return { text: (text || '').slice(0, 6000), images: images_, title: title || '' };
  } finally {
    win.destroy();
  }
}

// Opens a real, visible window so the user can log into Facebook/Google
// once — the session persists (see SESSION_PARTITION) so every later
// import benefits from it automatically, invisibly. Closes itself as soon
// as the platform's logged-in cookie appears.
function openSignInWindow(target) {
  const { BrowserWindow, session } = require('electron');
  const cfg = SIGN_IN[target];
  const win = new BrowserWindow({
    show: true,
    width: 960,
    height: 820,
    title: `Sign in to ${target === 'google' ? 'Google' : 'Facebook'} — closes by itself once you're in`,
    webPreferences: { session: session.fromPartition(SESSION_PARTITION) }
  });
  win.webContents.setUserAgent(cfg.userAgent);
  if (cfg.spoofChrome) spoofRealChrome(win.webContents);
  win.loadURL(cfg.url);
  const poll = setInterval(async () => {
    const status = await signInStatus().catch(() => ({}));
    if (status[target] && !win.isDestroyed()) win.close();
  }, 1500);
  win.on('closed', () => clearInterval(poll));
  return win;
}

async function signOut(target) {
  const { session } = require('electron');
  const sess = session.fromPartition(SESSION_PARTITION);
  const cookies = await sess.cookies.get({});
  await Promise.all(cookies
    .filter(c => SIGN_IN[target].cookieDomain.test(c.domain.replace(/^\./, '')))
    .map(c => sess.cookies.remove(`https://${c.domain.replace(/^\./, '')}${c.path}`, c.name).catch(() => {})));
}

// Checks the persistent session's cookies for each platform's own
// logged-in-user cookie, so Settings can show whether a prior sign-in
// actually took (rather than just assuming it did once the window closed).
async function signInStatus() {
  const { session } = require('electron');
  const sess = session.fromPartition(SESSION_PARTITION);
  const [fbCookies, googleCookies] = await Promise.all([
    sess.cookies.get({ domain: 'facebook.com', name: 'c_user' }),
    sess.cookies.get({ domain: 'google.com', name: 'SAPISID' })
  ]);
  return { facebook: fbCookies.length > 0, google: googleCookies.length > 0 };
}

module.exports = { isElectronMain, renderPage, openSignInWindow, signInStatus, signOut, SESSION_PARTITION };
