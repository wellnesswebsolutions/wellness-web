const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const storage = require('./lib/site-storage');
const { scrapeFacebook, parseGoogleMapsUrl } = require('./lib/scrape');
const { runClaudeEdit } = require('./lib/ai-edit');
const { runClaudeLookup, runClaudeExtract } = require('./lib/ai-import');
const browserFetch = require('./lib/browser-fetch');
const sync = require('./lib/supabase-sync');
const { deployToVercel } = require('./lib/deploy');

const PORT = process.env.PORT || 4173;
const GENERATOR_DIR = fs.existsSync(path.join(__dirname, '..', 'demo-generator.js'))
  ? path.join(__dirname, '..')
  : path.join(process.resourcesPath || __dirname, 'generator');

function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/generator', express.static(GENERATOR_DIR));
  app.use('/projects', express.static(storage.ROOT));

  const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

  // If Supabase sync is configured (see lib/supabase-sync.js), merge in
  // any remote records newer than what's on disk — e.g. from another Mac
  // — before listing. Purely additive: local-only stays fully functional
  // when sync isn't configured (pullAll resolves to []).
  app.get('/api/projects', async (req, res) => {
    if (sync.enabled()) {
      const remote = await sync.pullAll();
      remote.forEach(row => {
        const local = storage.readProject(row.id);
        if (!local || new Date(row.updated_at) > new Date(local.updatedAt || 0)) {
          storage.upsertProject(row.id, row.data);
        }
      });
    }
    res.json(storage.listProjects());
  });

  app.post('/api/projects', (req, res) => {
    const project = storage.createProject(req.body?.name || '', { pipelineStage: req.body?.pipelineStage });
    sync.pushOne(project);
    res.json(project);
  });

  app.get('/api/projects/:slug', (req, res) => {
    const project = storage.readProject(req.params.slug);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  });

  app.put('/api/projects/:slug', (req, res) => {
    try {
      const project = storage.saveProject(req.params.slug, req.body || {});
      sync.pushOne(project);
      res.json(project);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  app.delete('/api/projects/:slug', (req, res) => {
    try {
      storage.deleteProject(req.params.slug);
      res.json({ ok: true });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // Natural-language edit, run through the user's local Claude Code CLI —
  // see lib/ai-edit.js for why (their own subscription, no API key, one
  // focused single-shot call, never invents facts).
  app.post('/api/projects/:slug/ai-edit', async (req, res) => {
    const instruction = String(req.body?.instruction || '').trim();
    if (!instruction) return res.status(400).json({ error: 'Instruction is required' });
    const project = storage.readProject(req.params.slug);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    try {
      const { fieldPatch, profilePatch } = await runClaudeEdit(project, instruction);
      // Capture the exact previous values for every touched field so an
      // undo can restore them precisely, not just clear them.
      const beforeFields = {};
      Object.keys(fieldPatch).forEach(k => (beforeFields[k] = project.raw[k]));
      const beforeProfile = {};
      Object.keys(profilePatch).forEach(k => (beforeProfile[k] = project.raw.businessProfile?.[k]));

      const nextRaw = { ...project.raw, ...fieldPatch };
      if (Object.keys(profilePatch).length) {
        nextRaw.businessProfile = { ...(project.raw.businessProfile || {}), ...profilePatch };
      }
      const editLog = [...(project.editLog || []), { instruction, fieldPatch, profilePatch, beforeFields, beforeProfile, at: new Date().toISOString() }].slice(-20);
      const saved = storage.saveProject(req.params.slug, { raw: nextRaw, editLog });
      sync.pushOne(saved);
      res.json(saved);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  const isGoogleUrl = url => /google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(url);

  // "Paste a link, get a website" — three layers, each falling back to
  // the next:
  //  1. Render the page in a real (hidden) Electron browser window (see
  //     lib/browser-fetch.js) — this is what actually gets past
  //     Facebook's bot-blocking, unlike a bare fetch() or even Claude
  //     Code's own WebFetch tool (both confirmed blocked in testing).
  //     Feed the rendered text to Claude Code to structure into JSON —
  //     no WebFetch tool needed here since the content's already in hand.
  //  2. If Electron isn't running (e.g. `npm run server` standalone) or
  //     step 1's render came back empty, fall back to Claude Code
  //     fetching the URL itself (lib/ai-import.js's runClaudeLookup).
  //  3. If Claude Code isn't installed/signed in at all, fall back to a
  //     plain no-API HTTP fetch + Open Graph/JSON-LD parse (lib/scrape.js).
  async function lookupBusiness(url, url2) {
    const urls = [url, url2].filter(Boolean);

    if (browserFetch.isElectronMain() && urls.length) {
      try {
        const rendered = await Promise.all(urls.map(u => browserFetch.renderPage(u).catch(e => {
          console.error('[browser-fetch] render failed for', u, e.message);
          return null;
        })));
        const ok = rendered.filter(Boolean);
        const combinedText = ok.map((r, i) => `--- ${urls[i]} (${r.title}) ---\n${r.text}`).join('\n\n');
        const images = ok.flatMap(r => r.images);
        if (combinedText.trim().length > 40) {
          try {
            const data = await runClaudeExtract(combinedText, urls);
            return { ...data, images: data.images?.length ? data.images : images, method: 'browser+claude' };
          } catch (err) {
            if (err.message !== 'claude-not-found') console.error('[ai-import] extract-from-render failed:', err.message);
            // Claude unavailable, but we still rendered real content —
            // hand it straight back with no structuring, better than
            // nothing, UI can still show the images at least.
            if (images.length) return { method: 'browser-only', images };
          }
        }
      } catch (err) {
        console.error('[browser-fetch] pipeline failed, falling back:', err.message);
      }
    }

    try {
      const data = await runClaudeLookup(url, url2);
      return { ...data, method: 'claude' };
    } catch (err) {
      if (err.message !== 'claude-not-found') console.error('[ai-import] Claude lookup failed, falling back:', err.message);
      const fbUrl = urls.find(u => !isGoogleUrl(u));
      const gUrl = urls.find(u => isGoogleUrl(u));
      const [fb, g] = await Promise.all([
        fbUrl ? scrapeFacebook(fbUrl).catch(e => ({ error: e.message })) : null,
        gUrl ? Promise.resolve(parseGoogleMapsUrl(gUrl)) : null
      ]);
      return {
        method: 'fallback',
        name: fb?.name || g?.name,
        about: fb?.about,
        phone: fb?.phone,
        address: fb?.address,
        hours: fb?.hours,
        images: fb?.images,
        mapsUrl: g?.mapsUrl,
        fallbackError: fb?.error
      };
    }
  }

  // Opens a real, visible sign-in window (Facebook or Google) so future
  // imports benefit from being logged in — dramatically more data is
  // visible to a logged-in visitor than a logged-out one. The session
  // persists across app restarts (see lib/browser-fetch.js).
  app.post('/api/sign-in', (req, res) => {
    if (!browserFetch.isElectronMain()) return res.status(400).json({ error: 'Sign-in windows only work inside the app, not browser mode' });
    const target = req.body?.target === 'google' ? 'https://accounts.google.com' : 'https://www.facebook.com/login';
    browserFetch.openSignInWindow(target);
    res.json({ ok: true });
  });

  app.post('/api/import', async (req, res) => {
    const url = String(req.body?.url || '').trim();
    const url2 = String(req.body?.url2 || '').trim();
    if (!url && !url2) return res.status(400).json({ error: 'A Facebook or Google Maps link is required' });
    try {
      res.json(await lookupBusiness(url || undefined, url2 || undefined));
    } catch (err) {
      res.status(502).json({ error: `Could not read that page: ${err.message}` });
    }
  });

  // Create a site and import into it in one step — the primary "paste a
  // link, get a website" action.
  app.post('/api/quick-import', async (req, res) => {
    const url = String(req.body?.url || '').trim();
    const url2 = String(req.body?.url2 || '').trim();
    if (!url && !url2) return res.status(400).json({ error: 'A Facebook or Google Maps link is required' });
    try {
      const data = await lookupBusiness(url || undefined, url2 || undefined);
      const project = storage.createProject(data.name || 'New site');
      const businessProfile = {};
      if (data.address) businessProfile.address = data.address;
      if (data.phone) businessProfile.phone = data.phone;
      if (data.about) businessProfile.about = data.about;
      if (data.mapsUrl) businessProfile.mapsUrl = data.mapsUrl;
      if (data.hours?.length) businessProfile.hours = data.hours;
      const raw = { name: data.name || project.name, tagline: data.category, location: data.location, businessProfile };
      const aiFilled = data.about ? [] : ['about'];
      const saved = storage.saveProject(project.slug, { raw, aiFilled, lastImportUrl: url || url2, importImages: data.images || [] });
      sync.pushOne(saved);
      res.json(saved);
    } catch (err) {
      res.status(502).json({ error: `Could not read that page: ${err.message}` });
    }
  });

  // Save an uploaded file (logo / hero / gallery) into the project folder.
  app.post('/api/projects/:slug/media/:slot', upload.single('file'), (req, res) => {
    const { slug, slot } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const dir = storage.mediaDir(slug, slot);
      const ext = (path.extname(req.file.originalname) || '.jpg').toLowerCase();
      const filename = slot === 'gallery' ? `${Date.now()}${ext}` : `${slot}${ext}`;
      fs.writeFileSync(path.join(dir, filename), req.file.buffer);
      const relPath = slot === 'gallery' ? `img/gallery/${filename}` : `img/${filename}`;
      res.json({ path: relPath, url: `/projects/${slug}/${relPath}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Pull an image found during import (a remote URL) into the project
  // folder, so it becomes a normal local media file like any upload.
  app.post('/api/projects/:slug/media/:slot/fetch', async (req, res) => {
    const { slug, slot } = req.params;
    const url = String(req.body?.url || '').trim();
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try {
      const remote = await fetch(url);
      if (!remote.ok) throw new Error(`Image fetch failed: ${remote.status}`);
      const buffer = Buffer.from(await remote.arrayBuffer());
      const contentType = remote.headers.get('content-type') || '';
      const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
      const dir = storage.mediaDir(slug, slot);
      const filename = slot === 'gallery' ? `${Date.now()}${ext}` : `${slot}${ext}`;
      fs.writeFileSync(path.join(dir, filename), buffer);
      const relPath = slot === 'gallery' ? `img/gallery/${filename}` : `img/${filename}`;
      res.json({ path: relPath, url: `/projects/${slug}/${relPath}` });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  // Write the generated HTML the browser already built (client-side,
  // via the same generator scripts used for the live preview) out to a
  // sendable static folder.
  function writeExport(slug, html) {
    const dir = storage.projectDir(slug);
    const outDir = path.join(dir, 'export');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
    const srcImg = path.join(dir, 'img');
    const outImg = path.join(outDir, 'img');
    if (fs.existsSync(srcImg)) fs.cpSync(srcImg, outImg, { recursive: true });
    return outDir;
  }

  app.post('/api/projects/:slug/export', (req, res) => {
    const html = req.body?.html;
    if (!html) return res.status(400).json({ error: 'html is required' });
    try {
      res.json({ path: writeExport(req.params.slug, html) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Ships the exported site with the Vercel CLI already signed in on this
  // Mac (see lib/deploy.js) — no API token handled by the app itself.
  app.post('/api/projects/:slug/deploy', async (req, res) => {
    const html = req.body?.html;
    if (!html) return res.status(400).json({ error: 'html is required' });
    try {
      const outDir = writeExport(req.params.slug, html);
      const url = await deployToVercel(outDir, req.params.slug);
      const saved = storage.saveProject(req.params.slug, { liveUrl: url });
      sync.pushOne(saved);
      res.json({ url });
    } catch (err) {
      const message = err.message === 'vercel-not-found'
        ? 'Vercel CLI not found — install it with `npm install -g vercel` and run `vercel login` once.'
        : err.message;
      res.status(502).json({ error: message });
    }
  });

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, () => console.log(`BrightSite Studio server on http://localhost:${PORT}`));
}

module.exports = { createApp, PORT };
