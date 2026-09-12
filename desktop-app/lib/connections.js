// The command-line tools this app shells out to, for Settings' "Connected
// services": Claude Code (Edit with AI, imports, search) and Vercel (Make
// live, domains). Signing in is interactive, so it opens a Terminal window
// running the tool's own login; signing out runs its logout directly.
const { spawn } = require('child_process');
const { spawnEnv } = require('./shell-path');

const CLIS = {
  claude: { cmd: 'claude', status: ['auth', 'status'], login: 'claude auth login', logout: ['auth', 'logout'] },
  vercel: { cmd: 'vercel', status: ['whoami'], login: 'vercel login', logout: ['logout'] }
};

function cliFor(target) {
  const cli = CLIS[target];
  if (!cli) throw new Error('Unknown service');
  return cli;
}

function run(cmd, args) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv() });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill(), 20000);
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (err += d));
    child.on('error', () => { clearTimeout(timer); resolve({ code: -1, out, err }); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, out, err }); });
  });
}

async function status(target) {
  const cli = cliFor(target);
  const result = await run(cli.cmd, cli.status);
  if (result.code === -1) return { installed: false, signedIn: false };
  if (target === 'claude') {
    try {
      const info = JSON.parse(result.out);
      return { installed: true, signedIn: Boolean(info.loggedIn), account: info.loggedIn ? info.email || info.account?.email || info.authMethod || '' : '' };
    } catch {
      return { installed: true, signedIn: result.code === 0 };
    }
  }
  const user = result.out.trim().split('\n').pop() || '';
  return { installed: true, signedIn: result.code === 0 && Boolean(user), account: result.code === 0 ? user : '' };
}

function openTerminal(command) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', 'cmd', '/k', command], { env: spawnEnv(), detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('osascript', ['-e', 'tell application "Terminal" to activate', '-e', `tell application "Terminal" to do script "${command}"`], { stdio: 'ignore' });
  }
}

function signIn(target) {
  openTerminal(cliFor(target).login);
}

async function signOut(target) {
  const cli = cliFor(target);
  await run(cli.cmd, cli.logout);
  return status(target);
}

module.exports = { status, signIn, signOut };
