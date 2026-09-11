// Electron-only preload. Draws the small "update ready" notice in the top bar
// when lib/app-updater.js reports a downloaded update. Kept self-contained
// (own markup + styles) so it doesn't depend on public/app.js; in a plain
// browser (colleagues on http://localhost:4173) this never runs.

const { ipcRenderer } = require('electron');

const STYLE = `
.app-update {
  display: flex; align-items: center; gap: 8px;
  font-size: 11.5px; color: var(--ink, #17181a);
  padding: 3px 3px 3px 10px; border-radius: 20px;
  background: var(--accent-tint, #eaf1fe);
  animation: app-update-in 240ms ease;
}
.app-update i { width: 7px; height: 7px; border-radius: 50%; background: var(--accent, #3B82F6); flex: none; }
.app-update button {
  font: inherit; font-weight: 600; cursor: pointer;
  border: 0; border-radius: 20px; padding: 3px 10px;
  background: var(--accent, #3B82F6); color: var(--accent-ink, #fff);
}
.app-update button:disabled { opacity: 0.6; cursor: default; }
@keyframes app-update-in { from { opacity: 0; transform: translateY(-3px); } }
`;

function showNotice() {
  if (document.getElementById('appUpdateNotice')) return;
  const actions = document.querySelector('.topbar-actions');
  if (!actions) return;

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const notice = document.createElement('span');
  notice.className = 'app-update';
  notice.id = 'appUpdateNotice';
  notice.title = 'A newer version of BrightSite Studio has been downloaded. Your projects are kept.';
  notice.innerHTML = '<i></i><span>New version ready</span><button type="button">Restart to update</button>';
  const button = notice.querySelector('button');
  button.addEventListener('click', () => {
    button.disabled = true;
    button.textContent = 'Restarting…';
    ipcRenderer.send('app-update:install');
  });
  actions.insertBefore(notice, actions.firstChild);
}

function whenReady(fn) {
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

ipcRenderer.on('app-update:ready', () => whenReady(showNotice));

// Covers reloads, or the download finishing before the page loaded.
whenReady(() => {
  ipcRenderer
    .invoke('app-update:status')
    .then((status) => status && showNotice())
    .catch(() => {});
});
