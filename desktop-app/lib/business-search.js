// "hairdressers in Beverley" → a list of real businesses, built in layers
// that each fill what the previous one couldn't:
//
//  1. Google Maps (primary) — the search results list, then each listing's
//     own page for phone, full address, website, hours and photos. Rendered
//     in hidden windows on the import session (lib/browser-fetch.js), so a
//     Google sign-in carries over and the EU/UK consent wall is handled.
//  2. Facebook (gap-filler) — the business's own website usually links its
//     Facebook page (plus Instagram/email); if you're signed into Facebook
//     in Studio, Facebook's page search is tried for the rest. Each page
//     found is then read for a phone/email Google didn't have.
//  3. Claude (backup) — lib/ai-import.js's web search, told what's already
//     known, fills the remaining gaps and adds any businesses Google missed.
//     server.js runs it after 1–2 are saved, so a slow or missing Claude
//     never loses what Google and Facebook found.
//
// With a Google Places API key saved (lib/places.js), step 1 uses Places
// instead and only falls back to the Maps website if Places fails.
const browserFetch = require('./browser-fetch');
const places = require('./places');

const RESULT_CAP = 15;
const WORKERS = 3;
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- shared helpers ----------

function normName(name) {
  return String(name || '').toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(ltd|limited|the|uk)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function sameBusiness(a, b) {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x)));
}

// "find me hairdressers in Beverley please" → "hairdressers in Beverley"
function cleanQuery(query) {
  return String(query || '').trim()
    .replace(/^(please\s+)?(can you\s+)?(find|search( for)?|look( for)?|get|show)( me)?\s+/i, '')
    .replace(/\s+(please|thanks)\.?$/i, '')
    .trim();
}

function locationOf(query) {
  const m = cleanQuery(query).match(/\b(?:in|near|around)\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

const CATEGORY_RULES = [
  ['Aesthetics', /aesthetic|botox|filler|skin clinic|cosmetic/],
  ['Hair & Beauty', /hair|barber|nail|beauty|salon|lash|brow|tann|\bspa\b|wax|make-?up/],
  ['Fitness', /gym|fitness|personal trainer|pilates|crossfit|boxing|martial/],
  ['Health & Wellness', /physio|chiro|osteo|massage|therap|dentist|dental|clinic|wellness|yoga|podiat|optician|acupunct/],
  ['Automotive', /garage|\bcars?\b|\bmot\b|tyre|auto|mechanic|vehicle|body ?shop|valet/],
  ['Trades', /plumb|electric|builder|roof|joiner|carpent|plaster|decorat|heating|\bgas\b|locksmith|glaz/],
  ['Home & Garden', /garden|landscap|clean|window|removal|carpet|kitchen|bathroom|furniture/],
  ['Food & Drink', /cafe|café|restaurant|bakery|\bpub\b|\bbar\b|takeaway|coffee|food|deli|butcher|catering/],
  ['Professional Services', /solicitor|account|estate agent|insurance|consult|lawyer|mortgage|financial/],
  ['Pets', /\bdog|\bpet|\bvet|groom|cattery|kennel/],
  ['Creative', /photograph|design|tattoo|florist|print|studio|\bart\b/]
];

function toAppCategory(googleCategory) {
  const c = String(googleCategory || '').toLowerCase();
  if (!c) return undefined;
  const hit = CATEGORY_RULES.find(([, re]) => re.test(c));
  return hit ? hit[0] : 'Other';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Runs fn over items with `workers` hidden windows, one per worker.
async function withWindows(items, workers, fn) {
  const windows = Array.from({ length: Math.min(workers, items.length) }, openHiddenWindow);
  let next = 0;
  try {
    await Promise.all(windows.map(async win => {
      while (next < items.length) {
        const i = next++;
        try { await fn(items[i], win); } catch (err) { console.error('[business-search]', err.message); }
      }
    }));
  } finally {
    windows.forEach(w => { if (!w.isDestroyed()) w.destroy(); });
  }
}

function openHiddenWindow() {
  const { BrowserWindow, session } = require('electron');
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1000,
    webPreferences: { session: session.fromPartition(browserFetch.SESSION_PARTITION) }
  });
  win.webContents.setUserAgent(browserFetch.CHROME_UA);
  return win;
}

// Maps keeps streaming tiles, so loadURL can take ages to resolve — cap it
// and read whatever has rendered.
async function go(win, url, settleMs = 1500) {
  await Promise.race([win.loadURL(url).catch(() => {}), wait(15000)]);
  await wait(settleMs);
}

const js = (win, code, fallback = null) => win.webContents.executeJavaScript(code).catch(() => fallback);

async function waitFor(win, code, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await js(win, code);
    if (v) return v;
    await wait(400);
  }
  return null;
}

// UK/EU visitors get consent.google.com first. "Reject all" is the
// privacy-preserving choice and still shows Maps normally.
async function passGoogleConsent(win) {
  if (!win.webContents.getURL().includes('consent.google')) return;
  await js(win, `[...document.querySelectorAll('button')].find(b => /reject all/i.test(b.innerText))?.click()`);
  await waitFor(win, `!location.host.startsWith('consent.')`, 8000);
  await wait(1500);
}

// ---------- 1. Google Maps ----------

const READ_RESULTS = `(() => [...document.querySelectorAll('a[href*="/maps/place/"]')].map(a => {
  const card = a.closest('[role=feed] > div') || a.parentElement;
  const text = card.innerText || '';
  const lines = text.split('\\n').map(s => s.trim()).filter(Boolean);
  const catLine = lines.find(l => l.includes(' · ')) || '';
  const rating = text.match(/(\\d\\.\\d)\\s*\\(([\\d,]+)\\)/) || [];
  return {
    name: a.getAttribute('aria-label') || lines[0],
    mapsUrl: a.href.split('?')[0],
    category: catLine.split(' · ')[0],
    closed: /permanently closed|temporarily closed/i.test(text),
    rating: rating[1] ? Number(rating[1]) : undefined,
    reviews: rating[2] ? Number(rating[2].replace(/,/g, '')) : undefined
  };
}))()`;

const READ_PLACE = `(() => {
  const q = s => document.querySelector(s);
  const strip = (s, p) => (s || '').replace(p, '').trim();
  // The hours table is collapsed (so innerText is empty), but each day's
  // row carries an aria-label like "Tuesday, 9 am to 5 pm, Copy open hours".
  const DAY = /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\\s*/;
  const hours = [...new Set([...document.querySelectorAll('[aria-label]')]
    .map(e => e.getAttribute('aria-label'))
    .filter(l => DAY.test(l)))]
    .map(l => l.replace(/,?\\s*Copy open hours.*$/i, '').replace(DAY, (m, d) => d.slice(0, 3) + ': ')
      .replace(/\\s+/g, ' ').replace(/ ?(am|pm)\\b/g, '$1').replace(/ to /g, '–'))
    .slice(0, 7)
    // Maps lists today first — show Mon→Sun like a normal opening-times list.
    .sort((a, b) => 'MonTueWedThuFriSatSun'.indexOf(a.slice(0, 3)) - 'MonTueWedThuFriSatSun'.indexOf(b.slice(0, 3)));
  const images = [...document.querySelectorAll('img')].map(i => i.src)
    .filter(s => /googleusercontent\\.com\\/(gps-|p\\/)/.test(s) && !/=w\\d{2}-h\\d{2}-/.test(s))
    .map(s => s.replace(/=w\\d+-h\\d+[^/]*$/, '=w1200-h900-k-no'));
  return {
    name: q('h1')?.innerText?.trim(),
    phone: strip(q('button[data-item-id^="phone:tel:"]')?.getAttribute('aria-label'), /^Phone:\\s*/i),
    address: strip(q('button[data-item-id="address"]')?.getAttribute('aria-label'), /^Address:\\s*/i),
    website: q('a[data-item-id="authority"]')?.href || '',
    category: q('button[jsaction*="category"]')?.innerText?.trim() || '',
    closed: /permanently closed/i.test(document.body.innerText.slice(0, 3000)),
    hours,
    images: [...new Set(images)].slice(0, 6)
  };
})()`;

async function listGoogleResults(query, onEvent, cap) {
  const win = openHiddenWindow();
  try {
    await go(win, `https://www.google.com/maps/search/${encodeURIComponent(query).replace(/%20/g, '+')}`, 2000);
    await passGoogleConsent(win);
    // A very specific query can jump straight to one listing instead of a list.
    const state = await waitFor(win,
      `document.querySelectorAll('[role=feed] a[href*="/maps/place/"]').length || (location.pathname.includes('/place/') && document.querySelector('h1') ? -1 : 0)`,
      12000);
    if (state === -1) return [{ mapsUrl: win.webContents.getURL() }];
    if (!state) return [];
    let results = [];
    let last = -1;
    for (let i = 0; i < 8; i++) {
      results = (await js(win, READ_RESULTS, [])) || [];
      if (results.length >= cap * 1.5 || results.length === last) break;
      last = results.length;
      onEvent({ type: 'progress', text: `Google Maps: ${results.length} listings so far…` });
      await js(win, `document.querySelector('[role=feed]')?.scrollBy(0, 4000)`);
      await wait(1500);
    }
    const seen = new Set();
    return results.filter(r => {
      const key = normName(r.name) || r.mapsUrl;
      if (r.closed || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } finally {
    win.destroy();
  }
}

// With a Places API key saved, Places answers the search directly; any
// failure (bad key, billing off, quota) drops back to the Maps website.
async function searchGooglePlaces(q, query, onEvent, { cap, skip }) {
  const key = places.getKey();
  onEvent({ type: 'stage', stage: 'google', text: `Searching Google Places for <b>${escapeHtml(q)}</b>` });
  const found = await places.searchText(q, key, cap * 1.5);
  const fresh = found.filter(p => !skip(p.displayName?.text || ''));
  const skipped = found.length - fresh.length;
  const picked = fresh.slice(0, cap);
  if (!picked.length) {
    onEvent({ type: 'stage', stage: 'google', muted: true,
      text: skipped ? `Everything Google Places listed is already in your list (${skipped})` : 'Google Places found nothing for that' });
    return { businesses: [], skipped };
  }
  onEvent({ type: 'stage', stage: 'google', muted: true,
    text: `Google Places listed ${picked.length}${skipped ? ` new (${skipped} already in your list)` : ''} — fetching photos` });
  const location = locationOf(query);
  const businesses = await Promise.all(picked.map(async p => {
    const googleCategory = p.primaryTypeDisplayName?.text || '';
    const biz = {
      name: p.displayName?.text || '',
      category: toAppCategory(googleCategory),
      googleCategory,
      location,
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
      address: p.formattedAddress || '',
      website: p.websiteUri || '',
      mapsUrl: p.googleMapsUri || '',
      hours: places.tidyHours(p.regularOpeningHours?.weekdayDescriptions),
      images: await places.photoUrls(p, key),
      rating: p.rating,
      reviews: p.userRatingCount,
      sources: ['google']
    };
    onEvent({ type: 'found', name: biz.name, source: 'google' });
    return biz;
  }));
  return { businesses: businesses.filter(b => b.name), skipped };
}

async function searchGoogleMaps(query, onEvent, { cap = RESULT_CAP, skip = () => false } = {}) {
  const q = cleanQuery(query);
  if (places.getKey()) {
    try {
      return await searchGooglePlaces(q, query, onEvent, { cap, skip });
    } catch (err) {
      console.error('[business-search] Places failed:', err.message);
      onEvent({ type: 'stage', stage: 'google', muted: true,
        text: `Google Places didn't work (${escapeHtml(err.message)}) — reading the Maps website instead` });
    }
  }
  onEvent({ type: 'stage', stage: 'google', text: `Searching Google Maps for <b>${escapeHtml(q)}</b>` });
  const listed = await listGoogleResults(q, onEvent, cap);
  const fresh = listed.filter(r => !r.name || !skip(r.name));
  const skipped = listed.length - fresh.length;
  const picked = fresh.slice(0, cap);
  if (!picked.length) {
    onEvent({ type: 'stage', stage: 'google', muted: true,
      text: skipped ? `Everything Google Maps listed is already in your list (${skipped})` : 'Google Maps found nothing for that' });
    return { businesses: [], skipped };
  }
  onEvent({ type: 'stage', stage: 'google', muted: true,
    text: `Google Maps listed ${picked.length}${skipped ? ` new (${skipped} already in your list)` : ''} — reading each listing` });

  const location = locationOf(query);
  const businesses = [];
  await withWindows(picked, WORKERS, async (row, win) => {
    await go(win, row.mapsUrl, 500);
    await passGoogleConsent(win);
    await waitFor(win, `document.querySelector('h1')?.innerText && (document.querySelector('button[data-item-id="address"]') || document.querySelector('button[data-item-id^="phone:tel:"]'))`, 7000);
    const place = (await js(win, READ_PLACE, {})) || {};
    const name = place.name || row.name;
    if (!name || place.closed || (row.name ? false : skip(name))) return;
    const biz = {
      name,
      category: toAppCategory(place.category || row.category),
      googleCategory: place.category || row.category || '',
      location,
      phone: place.phone || '',
      address: place.address || '',
      website: place.website && !/google\.com/.test(place.website) ? place.website : '',
      mapsUrl: row.mapsUrl,
      hours: place.hours || [],
      images: place.images || [],
      rating: row.rating,
      reviews: row.reviews,
      sources: ['google']
    };
    businesses.push(biz);
    onEvent({ type: 'found', name, source: 'google' });
  });
  // Keep Google's own ranking order rather than whichever page loaded first.
  const order = new Map(picked.map((r, i) => [r.mapsUrl, i]));
  businesses.sort((a, b) => (order.get(a.mapsUrl) ?? 99) - (order.get(b.mapsUrl) ?? 99));
  return { businesses, skipped };
}

// ---------- 2. Facebook ----------

// Page URLs come as /slug, /p/Name-12345 (newer pages) or /profile.php?id=.
const FB_PAGE = /^https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?!sharer|share|plugins|dialog|policies|privacy|help|login|groups\/|events\/|watch|hashtag|tr\b|l\.php)(p\/[A-Za-z0-9.\-_%]+|profile\.php\?id=\d+|[A-Za-z0-9.\-_]+)/i;

function cleanFacebookUrl(url) {
  const raw = String(url || '').replace(/&amp;/g, '&');
  // Old sites still carry the "facebook.com/2008/fbml" XML namespace —
  // not a page. Real numeric page ids are long (10+ digits).
  if (/\/fbml\b/i.test(raw)) return '';
  const m = raw.match(FB_PAGE);
  if (!m) return '';
  const slug = m[1].replace(/\/$/, '');
  if (/^\d{1,9}$/.test(slug)) return '';
  return `https://www.facebook.com/${slug}`;
}

const PHONE_RE = /(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s-]?){9,10}\b/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

async function fetchText(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': browserFetch.CHROME_UA, 'Accept-Language': 'en-GB,en;q=0.9' }
    });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

// The business's own website — the most reliable pointer to its real
// Facebook page, and often its Instagram and email too.
async function readWebsite(biz) {
  if (!biz.website) return;
  const html = await fetchText(biz.website);
  if (!html) return;
  if (!biz.facebookUrl) {
    const fb = (html.match(/https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/[^"'\s<>)]+/gi) || []).map(cleanFacebookUrl).find(Boolean);
    if (fb) biz.facebookUrl = fb;
  }
  if (!biz.instagram) {
    const ig = (html.match(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/i) || [])[1];
    if (ig && !/^(p|explore|accounts|reel)$/i.test(ig)) biz.instagram = `https://www.instagram.com/${ig}`;
  }
  if (!biz.email) {
    const mail = (html.match(/mailto:([^"'?\s>]+)/i) || [])[1];
    if (mail && EMAIL_RE.test(mail) && !/example|wix|sentry|domain\./i.test(mail)) biz.email = decodeURIComponent(mail);
  }
  if (!biz.phone) {
    const tel = (html.match(/href=["']tel:([^"']+)/i) || [])[1];
    if (tel) biz.phone = decodeURIComponent(tel).trim();
  }
}

// Only when signed into Facebook in Studio — logged-out search is blocked.
async function searchFacebookPage(biz, win) {
  const q = [biz.name, biz.location].filter(Boolean).join(' ');
  await go(win, `https://www.facebook.com/search/pages/?q=${encodeURIComponent(q)}`, 2500);
  const candidates = (await js(win, `[...document.querySelectorAll('[role=main] a[href*="facebook.com/"]')]
    .map(a => ({ href: a.href, text: (a.innerText || a.getAttribute('aria-label') || '').trim() }))
    .filter(c => c.text)`, [])) || [];
  const hit = candidates.find(c => sameBusiness(c.text, biz.name) && cleanFacebookUrl(c.href));
  if (hit) biz.facebookUrl = cleanFacebookUrl(hit.href);
}

async function readFacebookPage(biz, win) {
  await go(win, biz.facebookUrl, 2500);
  const text = (await js(win, `document.body ? document.body.innerText.slice(0, 8000) : ''`, '')) || '';
  if (/log in|log into facebook|content isn't available/i.test(text.slice(0, 400)) && text.length < 800) return;
  if (!biz.phone) {
    const phone = (text.match(PHONE_RE) || [])[0];
    if (phone) biz.phone = phone.trim();
  }
  if (!biz.email) {
    const email = (text.match(EMAIL_RE) || [])[0];
    if (email) biz.email = email;
  }
}

async function fillFromFacebook(businesses, onEvent) {
  if (!businesses.length) return;
  onEvent({ type: 'stage', stage: 'facebook', text: 'Checking websites and Facebook to fill the gaps' });
  const before = new Map(businesses.map(b => [b, snapshot(b)]));

  await Promise.all(businesses.map(readWebsite));

  const signedIn = (await browserFetch.signInStatus().catch(() => ({}))).facebook;
  const noPage = businesses.filter(b => !b.facebookUrl);
  if (signedIn && noPage.length) {
    onEvent({ type: 'progress', text: `Searching Facebook for ${noPage.length} more…` });
    await withWindows(noPage, WORKERS, searchFacebookPage);
  }

  const needDetails = businesses.filter(b => b.facebookUrl && (!b.phone || !b.email));
  if (needDetails.length) {
    onEvent({ type: 'progress', text: `Reading ${needDetails.length} Facebook page${needDetails.length === 1 ? '' : 's'}…` });
    await withWindows(needDetails, WORKERS, readFacebookPage);
  }

  let filled = 0;
  for (const b of businesses) {
    const gained = diff(before.get(b), snapshot(b));
    if (!gained.length) continue;
    filled++;
    if (!b.sources.includes('facebook')) b.sources.push('facebook');
    onEvent({ type: 'filled', name: b.name, fields: gained, source: 'facebook' });
  }
  onEvent({ type: 'stage', stage: 'facebook', muted: true,
    text: filled ? `Filled gaps for ${filled} from websites & Facebook` : 'Nothing extra on websites or Facebook' });
}

const GAP_FIELDS = ['phone', 'facebookUrl', 'email', 'instagram', 'website', 'address'];
const snapshot = b => Object.fromEntries(GAP_FIELDS.map(f => [f, b[f] || '']));
const diff = (a, b) => GAP_FIELDS.filter(f => !a[f] && b[f]);
const FIELD_LABELS = { phone: 'phone', facebookUrl: 'Facebook page', email: 'email', instagram: 'Instagram', website: 'website', address: 'address' };

function missingFields(b) {
  return ['phone', 'facebookUrl', 'address'].filter(f => !b[f]).map(f => FIELD_LABELS[f]);
}

// ---------- 3. Claude merge ----------

// Folds Claude's answer into the list: details for known businesses fill
// only empty fields (Google/Facebook data wins), unknown names are new.
function mergeAiResults(businesses, aiResults, { cap = RESULT_CAP, skip = () => false, location = '' } = {}) {
  const updated = [];
  const added = [];
  for (const r of aiResults || []) {
    if (!r?.name) continue;
    const match = businesses.find(b => sameBusiness(b.name, r.name));
    if (match) {
      const before = snapshot(match);
      for (const f of GAP_FIELDS) {
        const v = f === 'facebookUrl' ? cleanFacebookUrl(r[f]) : r[f];
        if (!match[f] && v) match[f] = v;
      }
      const gained = diff(before, snapshot(match));
      if (gained.length) {
        if (!match.sources.includes('ai')) match.sources.push('ai');
        updated.push({ biz: match, fields: gained });
      }
    } else if (businesses.length + added.length < cap && !skip(r.name)) {
      added.push({
        name: r.name,
        category: r.category,
        location: r.location || location,
        phone: r.phone || '',
        address: r.address || '',
        facebookUrl: cleanFacebookUrl(r.facebookUrl),
        instagram: r.instagram || '',
        email: r.email || '',
        website: r.website || '',
        mapsUrl: r.mapsUrl || '',
        hours: [],
        images: [],
        sources: ['ai']
      });
    }
  }
  return { updated, added };
}

module.exports = {
  searchGoogleMaps, fillFromFacebook, mergeAiResults, missingFields,
  sameBusiness, cleanQuery, locationOf, FIELD_LABELS, RESULT_CAP
};
