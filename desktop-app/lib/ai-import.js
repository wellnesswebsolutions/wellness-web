// The real "paste a link, get a website" import — reads the page the same
// way pasting a link into a Claude conversation would: through the user's
// local Claude Code CLI (their own subscription, no API key), which has
// its own web-fetch tool and can work with whatever it actually gets back
// far better than a raw regex scraper can. Falls back to lib/scrape.js
// (plain no-API HTTP fetch + Open Graph/JSON-LD parsing) when Claude Code
// isn't installed/signed in, so the app still works either way.
const { spawn } = require('child_process');
const { spawnEnv } = require('./shell-path');

function buildPrompt(url, url2) {
  const urls = [url, url2].filter(Boolean);
  return `Look up ${urls.join(' and ')} — a business's Facebook Page and/or Google Maps/Business ` +
    `listing. Fetch the page(s) and extract what's really there. Never invent or guess facts — ` +
    `omit any field you can't actually find.\n\n` +
    `Reply with ONLY a JSON object, no prose, no markdown fences, with these fields (omit any you ` +
    `couldn't find, don't fill them with placeholders):\n` +
    `{"name": "...", "category": "one of: Hair & Beauty, Aesthetics, Health & Wellness, Fitness, ` +
    `Automotive, Trades, Home & Garden, Food & Drink, Professional Services, Creative, Pets, Other", ` +
    `"location": "town/area", "phone": "...", "address": "...", "about": "1-2 sentence description ` +
    `in the business's own voice, based on what the page actually says", "hours": ["Mon: 9am-5pm", ...], ` +
    `"mapsUrl": "...", "images": ["direct image urls if any are visible, e.g. og:image, cover photo"]}`;
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Claude response');
  return JSON.parse(match[0]);
}

function buildExtractPrompt(pageText, urls) {
  return `This is the rendered text of ${urls.join(' and ')} — a business's Facebook Page and/or ` +
    `Google Maps listing, already fetched for you (no need to fetch anything yourself). Extract what's ` +
    `really there. Never invent or guess facts — omit any field you can't actually find in the text below.\n\n` +
    `--- PAGE TEXT ---\n${pageText}\n--- END PAGE TEXT ---\n\n` +
    `Reply with ONLY a JSON object, no prose, no markdown fences, with these fields (omit any you ` +
    `couldn't find):\n` +
    `{"name": "...", "category": "one of: Hair & Beauty, Aesthetics, Health & Wellness, Fitness, ` +
    `Automotive, Trades, Home & Garden, Food & Drink, Professional Services, Creative, Pets, Other", ` +
    `"location": "town/area", "phone": "...", "address": "...", "about": "1-2 sentence description ` +
    `in the business's own voice, based on what the text actually says", "hours": ["Mon: 9am-5pm", ...]}`;
}

// Runs against already-fetched page text (see lib/browser-fetch.js) — no
// WebFetch tool needed at all, so no --allowedTools required either, and
// it works even when Claude Code's own network fetch would get blocked.
function runClaudeExtract(pageText, urls) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', [
      '-p', buildExtractPrompt(pageText, urls),
      '--output-format', 'text'
    ], { stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv() });
    let out = '';
    let err = '';
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (err += d));
    child.on('error', () => reject(new Error('claude-not-found')));
    child.on('close', code => {
      if (code !== 0) return reject(new Error(err.trim() || `Claude Code exited with code ${code}`));
      try {
        resolve(extractJson(out));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function runClaudeLookup(url, url2) {
  return new Promise((resolve, reject) => {
    // --allowedTools is required: `claude -p` (non-interactive) refuses to
    // use WebFetch at all unless it's explicitly whitelisted for the
    // invocation — scoped to just this one tool, nothing else.
    const child = spawn('claude', [
      '-p', buildPrompt(url, url2),
      '--allowedTools', 'WebFetch',
      '--output-format', 'text'
    ], { stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv() });
    let out = '';
    let err = '';
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (err += d));
    child.on('error', () => reject(new Error('claude-not-found')));
    child.on('close', code => {
      if (code !== 0) return reject(new Error(err.trim() || `Claude Code exited with code ${code}`));
      try {
        resolve(extractJson(out));
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = { runClaudeLookup, runClaudeExtract };
