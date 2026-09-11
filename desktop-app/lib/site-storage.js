const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(os.homedir(), 'BrightSiteProjects');

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function slugify(name) {
  return String(name || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
}

function uniqueSlug(base) {
  ensureRoot();
  let slug = base;
  let n = 2;
  while (fs.existsSync(path.join(ROOT, slug))) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function projectDir(slug) {
  return path.join(ROOT, slug);
}

function listProjects() {
  ensureRoot();
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => readProject(entry.name))
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

function readProject(slug) {
  const file = path.join(projectDir(slug), 'data.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// One record per business, shared by every tab — Businesses, Cold Calling
// and Live & Paying just render different views/filters over the same
// file, so nothing is ever duplicated between them.
//
// 'uncontacted' is the entry point for a newly added business; every
// other value means it's in the cold-calling list. Anything not in this
// list (older records predating these stages) is treated as uncontacted
// by the UI, so no migration is needed.
const PIPELINE_STAGES = [
  'uncontacted', 'called', 'follow_up', 'interested', 'demo_sent', 'not_interested'
];

function createProject(name, opts = {}) {
  ensureRoot();
  const slug = uniqueSlug(slugify(name));
  const dir = projectDir(slug);
  fs.mkdirSync(path.join(dir, 'img', 'gallery'), { recursive: true });
  const data = {
    slug,
    name: name || 'Untitled business',
    raw: { name: name || '' },
    pipelineStage: opts.pipelineStage || 'uncontacted',
    contact: { phone: '', whatsapp: '', email: '', instagram: '', facebookUrl: '', googleUrl: '', existingWebsite: '' },
    paymentStatus: 'no',
    price: '',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(data, null, 2));
  return data;
}

function saveProject(slug, patch) {
  const dir = projectDir(slug);
  if (!fs.existsSync(dir)) throw new Error('Project not found');
  const current = readProject(slug) || {};
  const next = { ...current, ...patch, slug, updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(next, null, 2));
  return next;
}

// Used only by Supabase sync (server.js) to write a record pulled from
// another device that doesn't have a local folder yet.
function upsertProject(slug, data) {
  ensureRoot();
  const dir = projectDir(slug);
  fs.mkdirSync(path.join(dir, 'img', 'gallery'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ ...data, slug }, null, 2));
}

function deleteProject(slug) {
  if (!slug || /[./\\]/.test(slug)) throw new Error('Invalid project');
  const dir = projectDir(slug);
  if (!fs.existsSync(dir)) throw new Error('Project not found');
  fs.rmSync(dir, { recursive: true, force: true });
}

function mediaDir(slug, slot) {
  const dir = slot === 'gallery'
    ? path.join(projectDir(slug), 'img', 'gallery')
    : path.join(projectDir(slug), 'img');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { ROOT, ensureRoot, slugify, projectDir, listProjects, readProject, createProject, saveProject, upsertProject, deleteProject, mediaDir, PIPELINE_STAGES };
