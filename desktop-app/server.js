const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const storage = require('./lib/site-storage');
const { scrapeFacebook, parseGoogleMapsUrl } = require('./lib/scrape');
const { runClaudeEdit } = require('./lib/ai-edit');

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

  app.get('/api/projects', (req, res) => {
    res.json(storage.listProjects());
  });

  app.post('/api/projects', (req, res) => {
    const project = storage.createProject(req.body?.name || '', { pipelineStage: req.body?.pipelineStage });
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
      res.json(project);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  app.get('/api/pipeline-stages', (req, res) => res.json(storage.PIPELINE_STAGES));

  app.post('/api/projects/:slug/stage', (req, res) => {
    const stage = String(req.body?.stage || '');
    if (!storage.PIPELINE_STAGES.includes(stage)) return res.status(400).json({ error: 'Unknown stage' });
    try {
      res.json(storage.saveProject(req.params.slug, { pipelineStage: stage }));
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
      const nextRaw = { ...project.raw, ...fieldPatch };
      if (Object.keys(profilePatch).length) {
        nextRaw.businessProfile = { ...(project.raw.businessProfile || {}), ...profilePatch };
      }
      const editLog = [...(project.editLog || []), { instruction, fieldPatch, profilePatch, at: new Date().toISOString() }].slice(-20);
      const saved = storage.saveProject(req.params.slug, { raw: nextRaw, editLog });
      res.json(saved);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  // One fetch, best-effort, no API key. See lib/scrape.js for what this
  // can and can't reliably find.
  app.post('/api/import', async (req, res) => {
    const url = String(req.body?.url || '').trim();
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try {
      const isGoogle = /google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(url);
      const result = isGoogle ? parseGoogleMapsUrl(url) : await scrapeFacebook(url);
      res.json(result);
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
  app.post('/api/projects/:slug/export', (req, res) => {
    const { slug } = req.params;
    const html = req.body?.html;
    if (!html) return res.status(400).json({ error: 'html is required' });
    try {
      const dir = storage.projectDir(slug);
      const outDir = path.join(dir, 'export');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'index.html'), html);
      const srcImg = path.join(dir, 'img');
      const outImg = path.join(outDir, 'img');
      if (fs.existsSync(srcImg)) fs.cpSync(srcImg, outImg, { recursive: true });
      res.json({ path: outDir });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, () => console.log(`BrightSite Studio server on http://localhost:${PORT}`));
}

module.exports = { createApp, PORT };
