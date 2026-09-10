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

const REAL_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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
    await win.loadURL(url, { userAgent: REAL_USER_AGENT });
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
// import benefits from it automatically, invisibly.
function openSignInWindow(url) {
  const { BrowserWindow, session } = require('electron');
  const win = new BrowserWindow({
    show: true,
    width: 960,
    height: 820,
    title: 'Sign in — closes automatically when done',
    webPreferences: { session: session.fromPartition(SESSION_PARTITION) }
  });
  win.loadURL(url, { userAgent: REAL_USER_AGENT });
  return win;
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

module.exports = { isElectronMain, renderPage, openSignInWindow, signInStatus, SESSION_PARTITION };
