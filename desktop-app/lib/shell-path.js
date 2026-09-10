// Electron apps launched from Finder/Dock (as opposed to a terminal) get
// a minimal PATH from macOS's LaunchServices — typically just
// /usr/bin:/bin:/usr/sbin:/sbin — which doesn't include where Homebrew,
// nvm, or a user's own local bin installs things. That's why `vercel`
// (and `claude`) can work fine when this app is run from a terminal
// during development, then report "not found" once packaged and opened
// normally — confirmed directly: the same spawn call that works via
// `node server.js` in a terminal fails in the installed .app.
//
// Fix: explicitly extend PATH with the common install locations before
// spawning anything, rather than trusting whatever LaunchServices handed
// the process.
const os = require('os');

const EXTRA_PATHS = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  `${os.homedir()}/.local/bin`,
  `${os.homedir()}/.local/share/supabase` // supabase CLI installs here on this machine's setup
];

function spawnEnv() {
  const current = process.env.PATH || '';
  const extra = EXTRA_PATHS.filter(p => !current.includes(p));
  return { ...process.env, PATH: extra.length ? `${current}:${extra.join(':')}` : current };
}

module.exports = { spawnEnv };
