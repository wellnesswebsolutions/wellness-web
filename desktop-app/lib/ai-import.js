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

const SEARCH_RESULT_CAP = 15;

// With `known` (businesses Google Maps/Facebook already found — see
// lib/business-search.js), Claude's job becomes filling their missing
// details and adding only what they missed, not starting from scratch.
function buildSearchPrompt(query, known = [], room = SEARCH_RESULT_CAP) {
  if (known.length) {
    const list = known.map(k =>
      `- ${k.name}${k.address ? ` (${k.address})` : ''}${k.missing.length ? ` — missing: ${k.missing.join(', ')}` : ''}`
    ).join('\n');
    return `These real businesses matching "${query}" were already found on Google Maps and Facebook:\n${list}\n\n` +
      `Search the web to:\n` +
      `1. Fill in the missing details for the businesses above (only details you actually confirm — ` +
      `a Facebook Page URL must be that exact business's page).\n` +
      (room > 0
        ? `2. Find up to ${room} OTHER real, currently-trading businesses matching "${query}" that aren't in ` +
          `the list above. Never invent one.\n\n`
        : `Don't add any other businesses.\n\n`) +
      `Reply with ONLY a JSON array, no prose, no markdown fences. For a business from the list, use its name ` +
      `exactly as written above and include only the fields you found. Each item:\n` +
      `{"name": "...", "category": "one of: Hair & Beauty, Aesthetics, Health & Wellness, Fitness, ` +
      `Automotive, Trades, Home & Garden, Food & Drink, Professional Services, Creative, Pets, Other", ` +
      `"location": "town/area", "phone": "...", "address": "...", "facebookUrl": "...", "instagram": "...", ` +
      `"email": "...", "website": "...", "mapsUrl": "..."}\n` +
      `Omit any field you couldn't find — don't fill it with a placeholder. If you find nothing, reply with [].`;
  }
  return `Search the web to find real, currently-trading local businesses matching this request: ` +
    `"${query}". Only include businesses you can actually confirm exist — never invent one. Find up ` +
    `to ${SEARCH_RESULT_CAP} of them. For each, include a Facebook Page or Google Maps/Business URL ` +
    `if you found one, but still include the business if you only found its name and roughly where it is.\n\n` +
    `Reply with ONLY a JSON array, no prose, no markdown fences. Each item:\n` +
    `{"name": "...", "category": "one of: Hair & Beauty, Aesthetics, Health & Wellness, Fitness, ` +
    `Automotive, Trades, Home & Garden, Food & Drink, Professional Services, Creative, Pets, Other", ` +
    `"location": "town/area", "phone": "...", "address": "...", "facebookUrl": "...", "mapsUrl": "..."}\n` +
    `Omit any field you couldn't find — don't fill it with a placeholder. If you find nothing real, reply with [].`;
}

function extractJsonArray(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in Claude response');
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array');
  // Room for gap-fill entries for every known business plus new ones.
  return parsed.slice(0, SEARCH_RESULT_CAP * 2);
}

const SEARCH_TIMEOUT_MS = 6 * 60 * 1000;

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// Pulls the result links out of a WebSearch tool_result so the UI can show
// which sites Claude is reading ("fresha.com, facebook.com, …").
function sourcesFromToolResult(content) {
  const text = Array.isArray(content) ? content.map(c => c.text || '').join('\n') : String(content || '');
  const match = text.match(/Links:\s*(\[[\s\S]*?\])\s*\n/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]).map(l => ({ title: l.title, host: hostOf(l.url) })).filter(l => l.host);
  } catch { return []; }
}

// The bulk-add counterpart to runClaudeLookup: given a free-text request
// ("hairdressers in Beverley"), searches the web and returns a list rather
// than reading one specific page. Same non-interactive `claude -p` CLI, with
// WebSearch (not WebFetch) whitelisted for this invocation. Runs in
// stream-json mode so `onEvent` can report each step live — searches run,
// sites read, and business names as Claude writes its answer.
function runClaudeSearch(query, onEvent = () => {}, { known = [], room = SEARCH_RESULT_CAP } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', [
      '-p', buildSearchPrompt(query, known, room),
      '--allowedTools', 'WebSearch',
      '--output-format', 'stream-json', '--verbose', '--include-partial-messages'
    ], { stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv() });
    let buf = '';
    let err = '';
    let finalText = '';
    let lastText = '';
    let partial = '';
    const seenNames = new Set();
    let thinking = false;

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('the search took too long — try a shorter, more specific request'));
    }, SEARCH_TIMEOUT_MS);

    const handle = ev => {
      if (ev.type === 'system' && ev.subtype === 'thinking_tokens') {
        if (!thinking) { thinking = true; onEvent({ type: 'thinking' }); }
      } else if (ev.type === 'stream_event') {
        const e = ev.event || {};
        if (e.type === 'message_start') partial = '';
        if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
          partial += e.delta.text;
          const start = partial.indexOf('[');
          if (start === -1) return;
          for (const [, name] of partial.slice(start).matchAll(/"name"\s*:\s*"((?:[^"\\]|\\.)+)"/g)) {
            if (seenNames.has(name)) continue;
            seenNames.add(name);
            onEvent({ type: 'found', name });
          }
        }
      } else if (ev.type === 'assistant') {
        thinking = false;
        for (const block of ev.message?.content || []) {
          if (block.type === 'tool_use' && block.name === 'WebSearch') {
            onEvent({ type: 'search', query: block.input?.query || '' });
          } else if (block.type === 'text' && block.text.trim()) {
            lastText = block.text;
            // Commentary between searches ("Found a few on Fresha, checking
            // Facebook next") — but not the final JSON answer itself.
            if (!/^\s*\[/.test(block.text)) onEvent({ type: 'note', text: block.text.trim().slice(0, 240) });
          }
        }
      } else if (ev.type === 'user') {
        for (const block of ev.message?.content || []) {
          if (block.type === 'tool_result') {
            const sources = sourcesFromToolResult(block.content);
            if (sources.length) onEvent({ type: 'sources', sources: sources.slice(0, 6), count: sources.length });
          }
        }
      } else if (ev.type === 'result') {
        if (typeof ev.result === 'string') finalText = ev.result;
      }
    };

    child.stdout.on('data', d => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try { handle(JSON.parse(line)); } catch { /* non-JSON noise */ }
      }
    });
    child.stderr.on('data', d => (err += d));
    child.on('error', () => { clearTimeout(timer); reject(new Error('claude-not-found')); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim() || `Claude Code exited with code ${code}`));
      try {
        resolve(extractJsonArray(finalText || lastText));
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

module.exports = { runClaudeLookup, runClaudeExtract, runClaudeSearch };
