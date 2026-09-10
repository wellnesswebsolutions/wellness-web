// Natural-language site edits, run through the user's own local Claude
// Code CLI (their existing subscription) — never an API key, never a
// remote call we make ourselves. One focused, single-shot invocation per
// edit: we hand it only the current site's data (not the whole repo) and
// ask for one JSON object back. If `claude` isn't installed or the call
// fails, the caller gets a clear error and the rest of the app keeps
// working — this feature is additive, never load-bearing.
const { spawn } = require('child_process');

const EDITABLE_FIELDS = ['name', 'location', 'tagline', 'layout'];
const PROFILE_FIELDS = ['about'];

function buildPrompt(project, instruction) {
  const raw = project.raw || {};
  const profile = raw.businessProfile || {};
  const current = {
    name: raw.name, location: raw.location, tagline: raw.tagline, layout: raw.layout,
    about: profile.about
  };
  return `You are editing website copy/settings for a local business demo site. ` +
    `Only change what the instruction asks for. Never invent facts (prices, reviews, ` +
    `qualifications, addresses, phone numbers, hours, guarantees) — if the instruction ` +
    `implies adding a fact you don't have, leave that field unchanged instead of guessing.\n\n` +
    `Current fields (JSON): ${JSON.stringify(current)}\n\n` +
    `Instruction: ${instruction}\n\n` +
    `Reply with ONLY a JSON object containing just the fields you changed, from this set: ` +
    `${[...EDITABLE_FIELDS, ...PROFILE_FIELDS].join(', ')}. No prose, no markdown fences.`;
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Claude response');
  return JSON.parse(match[0]);
}

async function runClaudeEdit(project, instruction) {
  const prompt = buildPrompt(project, instruction);
  const output = await new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', prompt, '--output-format', 'text'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (err += d));
    child.on('error', () => reject(new Error('Claude Code CLI ("claude") was not found. Install/sign in to Claude Code to use natural-language editing.')));
    child.on('close', code => {
      if (code !== 0) return reject(new Error(err.trim() || `Claude Code exited with code ${code}`));
      resolve(out);
    });
  });

  const patch = extractJson(output);
  const fieldPatch = {};
  const profilePatch = {};
  for (const [key, value] of Object.entries(patch)) {
    if (EDITABLE_FIELDS.includes(key)) fieldPatch[key] = value;
    else if (PROFILE_FIELDS.includes(key)) profilePatch[key] = value;
  }
  return { fieldPatch, profilePatch, raw: output };
}

module.exports = { runClaudeEdit };
