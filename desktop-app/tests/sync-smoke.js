// Focused smoke test for lib/supabase-sync.js. Runs two modes:
//
//  - No Supabase configured (the default, empty lib/shared-config.js and
//    no env vars): verifies the module is a true no-op and never throws
//    — this is what every "no setup done yet" install of the app relies on.
//  - Configured (SUPABASE_URL + SUPABASE_ANON_KEY env vars set, e.g. for
//    testing against a real project before distributing the app): does a
//    real round trip — push a project row, pull it back, upload a small
//    test image to Storage, download it back and compare bytes — then
//    deletes both so no test data is left in the shared project.
//
// Run with: node desktop-app/tests/sync-smoke.js
const assert = require('assert');
const path = require('path');

async function main() {
  const sync = require(path.join(__dirname, '..', 'lib', 'supabase-sync'));
  const configured = sync.enabled();
  console.log(`[sync-smoke] Supabase configured: ${configured}`);

  if (!configured) {
    console.log('[sync-smoke] Running no-op mode checks (default, unconfigured state)...');
    assert.strictEqual(sync.getStatus().state, 'disabled', 'status should be "disabled" when unconfigured');
    const pulled = await sync.pullAll();
    assert.deepStrictEqual(pulled, [], 'pullAll() must resolve to [] when unconfigured, never throw');
    await sync.pushOne({ slug: 'smoke-test-noop', raw: { name: 'Smoke Test' }, updatedAt: new Date().toISOString() });
    const media = await sync.downloadMedia('smoke-test-noop', 'img/hero.jpg');
    assert.strictEqual(media, null, 'downloadMedia() must resolve to null when unconfigured, never throw');
    await sync.uploadMedia('smoke-test-noop', 'img/hero.jpg', Buffer.from('not a real image'));
    console.log('[sync-smoke] PASS — safe no-op with no Supabase configured.');
    return;
  }

  console.log('[sync-smoke] Running live round-trip against the configured project...');
  const testSlug = `smoke-test-${Date.now()}`;
  const project = {
    slug: testSlug,
    name: 'Sync Smoke Test',
    raw: { name: 'Sync Smoke Test' },
    updatedAt: new Date().toISOString()
  };

  try {
    await sync.pushOne(project);
    assert.strictEqual(sync.getStatus().state, 'synced', 'status should be "synced" after a successful push');

    const rows = await sync.pullAll();
    const found = rows.find(r => r.id === testSlug);
    assert.ok(found, 'pushed project should be readable via pullAll()');
    assert.strictEqual(found.data.raw.name, 'Sync Smoke Test', 'pulled row should contain the pushed data');

    // A 1x1 red PNG pixel — small, deterministic, easy to compare byte-for-byte.
    const testImage = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108020000009077' +
      '3df40000000c4944415408d763f8cfc0c0c00000030101008cca4b7d0000000049454e44ae426082',
      'hex'
    );
    await sync.uploadMedia(testSlug, 'img/hero.jpg', testImage);
    const downloaded = await sync.downloadMedia(testSlug, 'img/hero.jpg');
    assert.ok(downloaded, 'uploaded test image should be downloadable');
    assert.ok(downloaded.equals(testImage), 'downloaded image bytes should match what was uploaded');

    console.log('[sync-smoke] PASS — project + media round-trip both work end-to-end.');
  } finally {
    // Clean up so no test data is left in the shared project.
    const { url, key } = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    await fetch(`${url}/rest/v1/businesses?id=eq.${testSlug}`, { method: 'DELETE', headers }).catch(() => {});
    await fetch(`${url}/storage/v1/object/business-media/${testSlug}/img/hero.jpg`, { method: 'DELETE', headers }).catch(() => {});
    console.log('[sync-smoke] Cleaned up test row + test media.');
  }
}

main().catch(err => {
  console.error('[sync-smoke] FAIL:', err.message);
  process.exit(1);
});
