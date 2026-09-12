// Optional Google Places API (New) source for business search. When an API
// key is saved in Settings, lib/business-search.js asks Places first —
// fast, structured data that doesn't break when Maps' page layout changes —
// and only falls back to reading the Maps website if Places errors (e.g.
// billing not enabled on the key's Google Cloud project).
//
// The key lives on this computer only (not synced), in
// ~/BrightSiteProjects/places-settings.json. GOOGLE_PLACES_API_KEY in the
// environment overrides it for development.
const fs = require('fs');
const path = require('path');
const storage = require('./site-storage');

const SETTINGS_FILE = path.join(storage.ROOT, 'places-settings.json');
const API = 'https://places.googleapis.com/v1';
const PHOTOS_PER_PLACE = 6;

function getKey() {
  if (process.env.GOOGLE_PLACES_API_KEY) return process.env.GOOGLE_PLACES_API_KEY;
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')).apiKey || ''; } catch { return ''; }
}

function setKey(apiKey) {
  storage.ensureRoot();
  if (apiKey) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ apiKey }, null, 2));
  else fs.rmSync(SETTINGS_FILE, { force: true });
}

async function call(url, key, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, ...(opts.headers || {}) },
    signal: AbortSignal.timeout(15000)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message || `Places API error ${res.status}`);
  return body;
}

// A one-result search to prove the key, API and billing all work.
async function testKey(key) {
  await call(`${API}/places:searchText`, key, {
    method: 'POST',
    headers: { 'X-Goog-FieldMask': 'places.id' },
    body: JSON.stringify({ textQuery: 'cafe in London', pageSize: 1 })
  });
}

const FIELDS = [
  'id', 'displayName', 'formattedAddress', 'nationalPhoneNumber', 'internationalPhoneNumber',
  'websiteUri', 'googleMapsUri', 'regularOpeningHours.weekdayDescriptions', 'rating',
  'userRatingCount', 'businessStatus', 'primaryTypeDisplayName', 'photos'
].map(f => `places.${f}`).join(',');

// "Monday: 9:00 AM – 5:00 PM" → "Mon: 9am–5pm", matching the Maps scraper.
function tidyHours(lines = []) {
  return lines.map(l => l
    .replace(/^(\w{3})\w*day:\s*/, '$1: ')
    .replace(/[  ]/g, ' ')
    .replace(/:00\b/g, '')
    .replace(/\s*(AM|PM)\b/g, (m, p) => p.toLowerCase())
    .replace(/\s*[–-]\s*/g, '–'));
}

async function photoUrls(place, key) {
  const names = (place.photos || []).slice(0, PHOTOS_PER_PLACE).map(p => p.name);
  const urls = await Promise.all(names.map(name =>
    call(`${API}/${name}/media?maxWidthPx=1200&skipHttpRedirect=true`, key)
      .then(r => r.photoUri)
      .catch(() => null)));
  return urls.filter(Boolean);
}

// Text search → raw place rows (open businesses only), up to `limit`.
async function searchText(query, key, limit) {
  const places = [];
  let pageToken;
  do {
    const body = await call(`${API}/places:searchText`, key, {
      method: 'POST',
      headers: { 'X-Goog-FieldMask': `${FIELDS},nextPageToken` },
      body: JSON.stringify({ textQuery: query, pageSize: 20, ...(pageToken ? { pageToken } : {}) })
    });
    places.push(...(body.places || []));
    pageToken = body.nextPageToken;
  } while (pageToken && places.length < limit);
  return places.filter(p => !p.businessStatus || p.businessStatus === 'OPERATIONAL');
}

module.exports = { getKey, setKey, testKey, searchText, photoUrls, tidyHours };
