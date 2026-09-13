// Fast checks for the flows most likely to break a release: reading a
// business page, parsing Claude's replies and saving projects/snapshots.
// Run before every release with: npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Point storage at a throwaway folder before it's loaded (ROOT uses HOME).
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-test-'));
process.env.HOME = tmpHome;
const storage = require('../lib/site-storage');
const { parseFacebookHtml, parseGoogleMapsUrl } = require('../lib/scrape');
const { extractJson, extractJsonArray } = require('../lib/ai-import');

test('Facebook page: Open Graph and JSON-LD become business fields', () => {
  const html = `<html><head>
    <meta property="og:title" content="Glow &amp; Co Salon | Facebook">
    <meta property="og:description" content="Family-run salon in Beverley">
    <meta property="og:image" content="https://example.com/cover.jpg">
    <script type="application/ld+json">{"@type":"BeautySalon","telephone":"01482 000000",
      "address":{"streetAddress":"1 High St","addressLocality":"Beverley","postalCode":"HU17 0AA"},
      "openingHours":["Mo-Fr 09:00-17:00"]}</script></head></html>`;
  const biz = parseFacebookHtml(html, 'https://facebook.com/glow');
  assert.strictEqual(biz.name, 'Glow & Co Salon');
  assert.strictEqual(biz.about, 'Family-run salon in Beverley');
  assert.strictEqual(biz.phone, '01482 000000');
  assert.strictEqual(biz.address, '1 High St, Beverley, HU17 0AA');
  assert.deepStrictEqual(biz.hours, ['Mo-Fr 09:00-17:00']);
  assert.deepStrictEqual(biz.images, ['https://example.com/cover.jpg']);
});

test('Facebook page with nothing useful returns blanks, never throws', () => {
  const biz = parseFacebookHtml('<html></html>', 'https://facebook.com/x');
  assert.strictEqual(biz.name, '');
  assert.deepStrictEqual(biz.images, []);
});

test('Google Maps link: name comes from the place path', () => {
  const g = parseGoogleMapsUrl('https://www.google.com/maps/place/Glow+%26+Co+Salon/@53.8,-0.4,17z');
  assert.strictEqual(g.name, 'Glow & Co Salon');
  assert.strictEqual(parseGoogleMapsUrl('not a url').name, '');
});

test("Claude replies: JSON is found even with chatter around it", () => {
  assert.deepStrictEqual(extractJson('Sure! Here it is:\n{"name":"Glow"}\nHope that helps'), { name: 'Glow' });
  assert.deepStrictEqual(extractJsonArray('Results: [{"name":"A"},{"name":"B"}]').length, 2);
  assert.throws(() => extractJson('no json here'));
});

test('projects: create, save, list and delete', () => {
  const p = storage.createProject('Glow & Co Salon');
  assert.strictEqual(p.slug, 'glow-co-salon');
  assert.strictEqual(storage.createProject('Glow & Co Salon').slug, 'glow-co-salon-2');
  const saved = storage.saveProject(p.slug, { notes: 'call back Tuesday' });
  assert.strictEqual(saved.notes, 'call back Tuesday');
  assert.strictEqual(saved.name, 'Glow & Co Salon');
  assert.ok(storage.listProjects().some(x => x.slug === p.slug));
  storage.deleteProject(p.slug);
  assert.strictEqual(storage.readProject(p.slug), null);
  assert.throws(() => storage.deleteProject('../etc'));
});

test('import snapshots are saved and capped at 10', () => {
  const p = storage.createProject('Snapshot Test');
  for (let i = 0; i < 12; i++) storage.saveImportSnapshot(p.slug, ['https://facebook.com/x'], { name: `run ${i}` });
  const dir = path.join(storage.projectDir(p.slug), 'imports');
  const files = fs.readdirSync(dir);
  assert.ok(files.length <= 10 && files.length > 0);
  const latest = JSON.parse(fs.readFileSync(path.join(dir, files.sort().pop()), 'utf8'));
  assert.deepStrictEqual(latest.urls, ['https://facebook.com/x']);
});

test('follow-up reminders: due 2 days after an unanswered demo open', () => {
  const { followUpDue } = require('../public/follow-ups');
  const now = Date.parse('2026-09-13T12:00:00Z');
  const views = (...opens) => ({ count: opens.length, last: opens[0], opens });
  const sent = { pipelineStage: 'demo_sent', paymentStatus: 'no' };
  assert.strictEqual(followUpDue(sent, views('2026-09-10T12:00:00Z'), now), true);
  assert.strictEqual(followUpDue(sent, views('2026-09-12T12:00:00Z'), now), false, 'opened only a day ago');
  assert.strictEqual(followUpDue(sent, views('2026-09-13T09:00:00Z', '2026-09-12T09:00:00Z', '2026-09-10T09:00:00Z'), now), true, 'keeps reopening: clock runs from the first open');
  assert.strictEqual(followUpDue(sent, null, now), false, 'never opened');
  assert.strictEqual(followUpDue({ ...sent, pipelineStage: 'interested' }, views('2026-09-10T12:00:00Z'), now), false, 'they replied');
  assert.strictEqual(followUpDue({ ...sent, paymentStatus: 'pending' }, views('2026-09-10T12:00:00Z'), now), false, 'already a customer');
  assert.strictEqual(followUpDue({ ...sent, followedUpAt: '2026-09-11T09:00:00Z' }, views('2026-09-10T12:00:00Z'), now), false, 'followed up since');
  assert.strictEqual(followUpDue({ ...sent, followedUpAt: '2026-09-11T09:00:00Z' }, views('2026-09-12T12:00:00Z', '2026-09-10T12:00:00Z'), now), false, 'opened again after the follow-up, only a day ago');
  assert.strictEqual(followUpDue({ ...sent, followedUpAt: '2026-09-09T09:00:00Z' }, views('2026-09-10T12:00:00Z'), now), true, 'opened again after an older follow-up');
  assert.strictEqual(followUpDue(sent, { count: 1, last: '2026-09-10T12:00:00Z' }, now), true, 'older view data with only a last open');
});

test.after(() => fs.rmSync(tmpHome, { recursive: true, force: true }));
