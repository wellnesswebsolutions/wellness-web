// Shared, no-sign-in cross-device sync. Local JSON files (site-storage.js)
// are always the source of truth and always work offline — this module
// only mirrors project data and media to one shared Supabase project so
// every install of the app (this college's whole team) sees the same
// businesses and gets each other's edits automatically.
//
// Config comes from lib/shared-config.js (bundled into the packaged app —
// fill it in once before distributing, see README "Shared sync setup"),
// with SUPABASE_URL / SUPABASE_ANON_KEY env vars as a dev-time override.
// If neither is set, every function below is a safe no-op and the app is
// purely local, exactly as before this feature existed.
const fs = require('fs');
const path = require('path');
const bundled = require('./shared-config');

const TABLE = 'businesses';
const BUCKET = 'business-media';

function config() {
  return {
    url: process.env.SUPABASE_URL || bundled.SUPABASE_URL || '',
    key: process.env.SUPABASE_ANON_KEY || bundled.SUPABASE_ANON_KEY || ''
  };
}

function enabled() {
  const { url, key } = config();
  return !!(url && key);
}

function headers(extra) {
  const { key } = config();
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

// ---------------- status, for the UI's sync indicator ----------------
// 'disabled' — sync not configured, app is local-only (not shown as an
// error state, just doesn't render an indicator at all).
// 'synced' | 'syncing' | 'offline' (last attempt failed — network down,
// project unreachable, etc; local edits are still saved regardless).
const status = { state: enabled() ? 'synced' : 'disabled', lastError: null, lastSyncedAt: null };

function setStatus(state, err) {
  status.state = state;
  status.lastError = err ? err.message : null;
  if (state === 'synced') status.lastSyncedAt = new Date().toISOString();
}

function getStatus() {
  return { ...status };
}

// Projects whose last push failed while offline — retried the next time
// something proves connectivity is back (a successful pull, or the next
// app launch), per "retain local changes and retry" requirement.
const pendingPushes = new Set();

async function pullAll() {
  if (!enabled()) return [];
  setStatus('syncing');
  try {
    const { url } = config();
    const res = await fetch(`${url}/rest/v1/${TABLE}?select=*`, { headers: headers() });
    if (!res.ok) throw new Error(`Sync pull failed: ${res.status}`);
    const rows = await res.json();
    setStatus('synced');
    return rows;
  } catch (err) {
    setStatus('offline', err);
    console.error('[supabase-sync] pull failed, continuing local-only:', err.message);
    return [];
  }
}

// Fetches just one remote row's updated_at, to guard against an older
// local copy (e.g. a laptop that's been offline for a while) overwriting
// a newer shared version on push — the safe direction is always to pull
// the newer remote version down instead, never push a stale one up.
async function remoteUpdatedAt(slug) {
  const { url } = config();
  const res = await fetch(`${url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(slug)}&select=updated_at`, { headers: headers() });
  if (!res.ok) throw new Error(`Sync check failed: ${res.status}`);
  const rows = await res.json();
  return rows[0]?.updated_at || null;
}

async function pushOne(project) {
  if (!enabled() || !project?.slug) return;
  setStatus('syncing');
  try {
    const remoteAt = await remoteUpdatedAt(project.slug).catch(() => null);
    if (remoteAt && project.updatedAt && new Date(remoteAt) > new Date(project.updatedAt)) {
      // Remote is newer than what we're about to push (this local copy is
      // stale) — skip the push; the next pullAll() will bring the newer
      // shared version down instead of us clobbering it.
      setStatus('synced');
      return;
    }
    const { url } = config();
    const res = await fetch(`${url}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({
        id: project.slug,
        name: project.raw?.name || project.name,
        data: project,
        updated_at: project.updatedAt || new Date().toISOString()
      })
    });
    if (!res.ok) throw new Error(`Sync push failed: ${res.status}`);
    pendingPushes.delete(project.slug);
    setStatus('synced');
  } catch (err) {
    pendingPushes.add(project.slug);
    setStatus('offline', err);
    console.error('[supabase-sync] push failed, local copy is still saved:', err.message);
  }
}

// Call after anything that proves connectivity is back (a successful
// pullAll, or on a timer) to retry pushes that failed while offline.
async function flushPending(readProjectFn) {
  if (!enabled() || !pendingPushes.size) return;
  const slugs = [...pendingPushes];
  for (const slug of slugs) {
    const project = readProjectFn(slug);
    if (project) await pushOne(project);
    else pendingPushes.delete(slug); // project was deleted locally in the meantime
  }
}

// ---------------- media (logo / hero / gallery) ----------------
// Uploaded/downloaded under the same relative path used locally
// (img/hero.jpg, img/gallery/169...jpg) inside a per-project folder in
// the shared bucket, so the local file layout and the bucket layout
// always match slug-for-slug, path-for-path.
function contentTypeFor(ext) {
  return { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[ext.toLowerCase()] || 'application/octet-stream';
}

async function uploadMedia(slug, relPath, buffer) {
  if (!enabled()) return;
  try {
    const { url } = config();
    const objectPath = `${slug}/${relPath}`;
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': contentTypeFor(path.extname(relPath)), 'x-upsert': 'true' }),
      body: buffer
    });
    if (!res.ok && res.status !== 409) throw new Error(`Media upload failed: ${res.status}`);
  } catch (err) {
    console.error('[supabase-sync] media upload failed, local copy is still saved:', err.message);
  }
}

async function downloadMedia(slug, relPath) {
  if (!enabled()) return null;
  try {
    const { url } = config();
    const objectPath = `${slug}/${relPath}`;
    const res = await fetch(`${url}/storage/v1/object/public/${BUCKET}/${objectPath}`);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error('[supabase-sync] media download failed:', err.message);
    return null;
  }
}

// After pulling a project record that's new to this machine (or that
// references media this machine doesn't have on disk yet), download each
// referenced photo from the shared bucket so it displays here too.
async function syncMediaForProject(projectDir, data) {
  if (!enabled()) return;
  const raw = data.raw || {};
  const paths = [raw.logoImage, raw.heroImage, ...(raw.gallery || [])].filter(Boolean);
  for (const relPath of paths) {
    const localFile = path.join(projectDir, relPath);
    if (fs.existsSync(localFile)) continue;
    const buffer = await downloadMedia(data.slug, relPath);
    if (!buffer) continue;
    fs.mkdirSync(path.dirname(localFile), { recursive: true });
    fs.writeFileSync(localFile, buffer);
  }
}

module.exports = {
  enabled, pullAll, pushOne, flushPending, getStatus,
  uploadMedia, downloadMedia, syncMediaForProject
};
