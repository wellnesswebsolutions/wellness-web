// "Make live" — ships the exported static site with the Vercel CLI
// already installed and signed in on this Mac (confirmed: `vercel whoami`
// works). No API token stored or handled by the app itself; it just
// shells out to the same `vercel` command you'd run yourself.
//
// Each site gets its own stable Vercel project named brightsite-<slug>,
// so re-deploying after an edit updates the SAME live URL
// (https://brightsite-<slug>.vercel.app) instead of creating a new one
// every time.
const { spawn } = require('child_process');
const { spawnEnv } = require('./shell-path');

function projectNameFor(slug) {
  // Vercel project names: lowercase letters, digits, hyphens only, <= 100 chars.
  return `brightsite-${slug}`.slice(0, 100);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv() });
    let out = '';
    let err = '';
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (err += d));
    child.on('error', () => reject(new Error(`${cmd}-not-found`)));
    child.on('close', code => resolve({ code, out, err }));
  });
}

async function deployToVercel(exportDir, slug) {
  const projectName = projectNameFor(slug);

  // `vercel project add` is idempotent — succeeds the same way whether
  // the project is brand new or already exists. If this genuinely fails
  // (bad auth, no network), the deploy step below will fail too with a
  // clearer error, so no need to branch on its result here.
  await run('vercel', ['project', 'add', projectName]);

  const deployed = await run('vercel', ['deploy', exportDir, '--prod', '--yes', '--project', projectName]);
  if (deployed.code === 0) return `https://${projectName}.vercel.app`;

  const lastLine = deployed.err.trim().split('\n').filter(Boolean).pop();
  throw new Error(lastLine || `vercel deploy exited with code ${deployed.code}`);
}

// Whether this computer has the Vercel CLI installed and signed in. Copies
// without it (colleagues) send "go live" requests instead, which a copy
// that can deploy picks up — see public/app.js processDeployRequests().
let canDeployCache = null;
async function canDeploy() {
  if (canDeployCache && Date.now() - canDeployCache.at < 10 * 60 * 1000) return canDeployCache.ok;
  const result = await run('vercel', ['whoami']).catch(() => ({ code: 1 }));
  canDeployCache = { ok: result.code === 0, at: Date.now() };
  return canDeployCache.ok;
}

module.exports = { deployToVercel, projectNameFor, canDeploy };
