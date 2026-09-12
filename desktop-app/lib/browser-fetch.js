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
const { signInWithRealBrowser, forgetRealBrowserLogin } = require('./chrome-signin');

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
const SIGN_IN = {
  google: {
    url: 'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fwww.google.com%2Fmaps',
    userAgent: CHROME_UA,
    loggedInCookie: 'SAPISID',
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
  // Google blocks sign-in inside any embedded browser, so it happens in the
  // user's real Chrome/Edge instead — see lib/chrome-signin.js. Only if none
  // is installed do we fall back to an in-app window (which Google may block).
  if (target === 'google') {
    const viaBrowser = signInWithRealBrowser({
      url: cfg.url,
      targetSession: session.fromPartition(SESSION_PARTITION),
      domainPattern: cfg.cookieDomain,
      loggedInCookie: cfg.loggedInCookie
    });
    if (viaBrowser) return null;
  }
  const win = new BrowserWindow({
    show: true,
    width: 960,
    height: 820,
    title: `Sign in to ${target === 'google' ? 'Google' : 'Facebook'} — closes by itself once you're in`,
    webPreferences: { session: session.fromPartition(SESSION_PARTITION) }
  });
  win.webContents.setUserAgent(cfg.userAgent);
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
  if (target === 'google') forgetRealBrowserLogin();
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
