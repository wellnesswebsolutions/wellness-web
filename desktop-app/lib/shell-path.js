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
// spawning anything, rather than trusting whatever the OS handed the
// process. Windows uses ';' between entries and names the variable "Path".
const os = require('os');
const path = require('path');

const EXTRA_PATHS = process.platform === 'win32'
  ? [
      path.join(os.homedir(), '.local', 'bin'), // Claude Code native installer
      process.env.APPDATA && path.join(process.env.APPDATA, 'npm')
    ].filter(Boolean)
  : [
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      `${os.homedir()}/.local/bin`,
      `${os.homedir()}/.local/share/supabase` // supabase CLI installs here on this machine's setup
    ];

function spawnEnv() {
  const key = Object.keys(process.env).find(k => k.toUpperCase() === 'PATH') || 'PATH';
  const entries = (process.env[key] || '').split(path.delimiter).filter(Boolean);
  const extra = EXTRA_PATHS.filter(p => !entries.includes(p));
  return { ...process.env, [key]: [...entries, ...extra].join(path.delimiter) };
}

module.exports = { spawnEnv };
