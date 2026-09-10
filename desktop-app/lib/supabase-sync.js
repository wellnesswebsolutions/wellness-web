// Optional cross-device sync. Off by default — everything works purely
// on local JSON files (see site-storage.js) unless both SUPABASE_URL and
// SUPABASE_ANON_KEY are set as environment variables. Nothing here ever
// runs, and no network call is ever made to Supabase, until you opt in.
// See ../supabase/businesses_schema.sql for the one-time table setup —
// deliberately not run automatically, since it changes your Supabase
// project and that's your call to make, not the app's.
const TABLE = 'businesses';

function enabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

function headers() {
  const key = process.env.SUPABASE_ANON_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function pullAll() {
  if (!enabled()) return [];
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}?select=*`, { headers: headers() });
    if (!res.ok) throw new Error(`Sync pull failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[supabase-sync] pull failed, continuing local-only:', err.message);
    return [];
  }
}

async function pushOne(project) {
  if (!enabled()) return;
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        id: project.slug,
        name: project.raw?.name || project.name,
        data: project,
        updated_at: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error('[supabase-sync] push failed, local copy is still saved:', err.message);
  }
}

module.exports = { enabled, pullAll, pushOne };
