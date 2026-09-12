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

// Removes the site's deployments but keeps its Vercel project, so making
// it live again later comes back on the same brightsite-<slug> URL.
async function takeOffline(slug) {
  const result = await run('vercel', ['remove', projectNameFor(slug), '--yes']);
  const output = `${result.err}\n${result.out}`;
  if (result.code === 0 || /could not find|no deployments/i.test(output)) return;
  const lastLine = output.trim().split('\n').filter(Boolean).pop();
  throw new Error(lastLine || `vercel remove exited with code ${result.code}`);
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

// After signing in/out of Vercel from Settings.
function resetCanDeploy() {
  canDeployCache = null;
}

// Points a domain the customer owns at their site's Vercel project (plus
// www. for a root domain — best effort). Re-adding a domain that's already
// on this project is fine; the DNS records still have to be set at the
// registrar, which the Live tab's domain panel shows.
async function addDomain(slug, domain, withWww) {
  const project = projectNameFor(slug);
  await run('vercel', ['project', 'add', project]);
  for (const name of withWww ? [domain, `www.${domain}`] : [domain]) {
    const result = await run('vercel', ['domains', 'add', name, project]);
    const output = `${result.err}\n${result.out}`;
    if (result.code === 0 || output.includes(project) || name !== domain) continue;
    const lastLine = output.trim().split('\n').filter(Boolean).pop();
    throw new Error(lastLine || `vercel domains add exited with code ${result.code}`);
  }
}

async function removeDomain(domain) {
  for (const name of [domain, `www.${domain}`]) await run('vercel', ['domains', 'rm', name, '--yes']);
}

module.exports = { deployToVercel, projectNameFor, canDeploy, resetCanDeploy, takeOffline, addDomain, removeDomain };
