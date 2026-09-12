(() => {
  const state = {
    projects: [], current: null, found: {}, search: '',
    viewport: 'desktop', appFullscreen: false, desktopExpanded: true,
    tab: 'businesses', liveAdding: false, canDeploy: true, sideExpanded: null
  };

  const el = {
    builderView: document.getElementById('builderView'),
    liveView: document.getElementById('liveView'),
    liveTotals: document.getElementById('liveTotals'),
    liveList: document.getElementById('liveList'),
    projectList: document.getElementById('projectList'),
    projectSearch: document.getElementById('projectSearch'),
    editor: document.getElementById('editor'),
    preview: document.getElementById('preview'),
    previewFrameWrap: document.getElementById('previewFrameWrap'),
    viewportToggle: document.getElementById('viewportToggle'),
    desktopExpandIndicator: document.getElementById('desktopExpandIndicator'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    exportBtn: document.getElementById('exportBtn'),
    deployBtn: document.getElementById('deployBtn'),
    copyLiveBtn: document.getElementById('copyLiveBtn'),
    closePreviewBtn: document.getElementById('closePreviewBtn'),
    offlineBtn: document.getElementById('offlineBtn'),
    editTextBtn: document.getElementById('editTextBtn'),
    notice: document.getElementById('noticeStrip'),
    appVersion: document.getElementById('appVersion'),
    updateBtn: document.getElementById('updateBtn'),
    syncStatus: document.getElementById('syncStatus'),
    syncStatusText: document.getElementById('syncStatusText'),
    syncTooltipUrl: document.getElementById('syncTooltipUrl'),
    gearBtn: document.getElementById('gearBtn'),
    settingsDialog: document.getElementById('settingsDialog'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn')
  };

  async function api(path, opts) {
    const res = await fetch(path, opts);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  }

  // Build/Re-fetch/AI-edit/Deploy all depend on tools (Claude Code CLI,
  // Vercel CLI) that live on whoever's Mac is set up as "admin" — a
  // colleague without those installed would otherwise see a raw, technical
  // "claude-not-found"/"Vercel CLI not found, run npm install..." message.
  // Collapse that whole class of error into one plain sentence.
  function friendlyError(message) {
    const toolMissing = /claude-not-found|claude code cli|vercel-not-found|vercel cli not found/i.test(message || '');
    return toolMissing ? 'Only admin can update sites' : message;
  }

  // Shows a message in a status element and clears it again after a few
  // seconds, instead of leaving a stale error sitting there forever.
  function showTempStatus(target, message, ms = 4000) {
    target.textContent = message;
    clearTimeout(target._clearTimer);
    target._clearTimer = setTimeout(() => { if (target.textContent === message) target.textContent = ''; }, ms);
  }

  // Shared sync (see lib/supabase-sync.js) is entirely optional — when
  // it's not configured, "disabled" comes back and the indicator just
  // stays hidden, no visual change from before this feature existed.
  const SYNC_LABELS = { synced: 'Synced', syncing: 'Syncing…', offline: 'Offline — changes will sync later' };
  let syncEnabled = false;
  async function refreshSyncStatus() {
    try {
      const s = await api('/api/sync-status');
      syncEnabled = s.state !== 'disabled';
      if (s.state === 'disabled') { el.syncStatus.hidden = true; return; }
      el.syncStatus.hidden = false;
      el.syncStatus.className = `sync-status is-${s.state}`;
      el.syncStatusText.textContent = SYNC_LABELS[s.state] || s.state;
      el.syncTooltipUrl.textContent = s.projectUrl || '';
    } catch { /* status is best-effort, never block the app on it */ }
  }
  refreshSyncStatus();
  setInterval(refreshSyncStatus, 5000);

  // Live cross-device refresh: if someone else's edit (a colour, brand name,
  // etc.) lands in shared sync while this project is open here too, pull it
  // in without waiting for a manual reopen. Skipped whenever a field inside
  // the editor is focused, so it never clobbers text someone is mid-typing.
  async function refreshCurrentProjectIfChanged() {
    if (!syncEnabled || state.editingText) return;
    if (state.current && el.editor.contains(document.activeElement)) return;
    try {
      // /api/projects pulls remote and merges anything newer into local
      // storage as a side effect — reuse it so this never duplicates that
      // pull/merge logic, then just re-render from the now-fresh local copy.
      state.projects = await api('/api/projects');
      renderSidebar();
      if (!state.current) return;
      const row = state.projects.find(p => p.slug === state.current.slug);
      if (row && row.updatedAt !== state.current.updatedAt) {
        const prevError = state.current.deployError;
        replaceCurrent(await api(`/api/projects/${state.current.slug}`));
        if (state.current.deployError && state.current.deployError !== prevError) {
          notify(`Couldn’t go live: ${state.current.deployError}`, { sticky: false });
        }
        renderEditor();
        renderPreview({ seedDeployed: true });
        renderLiveActions();
      }
    } catch { /* best-effort — next tick tries again */ }
  }
  setInterval(refreshCurrentProjectIfChanged, 5000);

  let noticeTimer = null;
  function notify(text, opts = {}) {
    clearTimeout(noticeTimer);
    el.notice.textContent = text;
    el.notice.hidden = false;
    if (!opts.sticky) noticeTimer = setTimeout(() => (el.notice.hidden = true), 4500);
  }

  el.gearBtn.onclick = () => { el.settingsDialog.showModal(); refreshSignInStatus(); };
  el.closeSettingsBtn.onclick = () => el.settingsDialog.close();

  // Electron's renderer doesn't implement window.prompt()/confirm() (they
  // silently return null/false), so this dialog replaces confirm() with a
  // real, reliable UI (used for delete confirmations).
  const confirmDialog = document.getElementById('confirmDialog');
  function showConfirm(title, message, okLabel = 'Delete') {
    return new Promise(resolve => {
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message || '';
      document.getElementById('confirmOkBtn').textContent = okLabel;
      confirmDialog.showModal();
      const cleanup = value => { confirmDialog.close(); resolve(value); };
      document.getElementById('confirmOkBtn').onclick = () => cleanup(true);
      document.getElementById('confirmCancelBtn').onclick = () => cleanup(false);
    });
  }
  // While a sign-in window is open the row shows "finish signing in…" and
  // status is polled, so it flips to "Signed in" the moment it takes.
  let signIn = { google: false, facebook: false };
  let signInPoll = null;
  const accountRows = () => [...el.settingsDialog.querySelectorAll('[data-account]')];
  async function refreshSignInStatus() {
    try { signIn = await api('/api/sign-in-status'); } catch { return; }
    for (const row of accountRows()) {
      const on = Boolean(signIn[row.dataset.account]);
      if (on) delete row.dataset.waiting;
      const status = row.querySelector('.account-status');
      if (!row.dataset.waiting) status.textContent = on ? 'Signed in ✓' : 'Not signed in';
      status.classList.toggle('is-signed-in', on);
      const btn = row.querySelector('button');
      btn.textContent = on ? 'Sign out' : 'Sign in';
      btn.classList.toggle('primary', !on);
    }
    if (!accountRows().some(r => r.dataset.waiting)) { clearInterval(signInPoll); signInPoll = null; }
  }

  el.settingsDialog.addEventListener('click', async e => {
    const btn = e.target.closest('[data-account] button');
    if (!btn) return;
    const row = btn.closest('[data-account]');
    const target = row.dataset.account;
    const status = row.querySelector('.account-status');
    const post = (path) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }) });
    btn.disabled = true;
    try {
      if (signIn[target]) {
        await post('/api/sign-out');
      } else {
        await post('/api/sign-in');
        row.dataset.waiting = '1';
        status.textContent = 'Finish signing in in the new window…';
        status.classList.remove('is-signed-in');
        if (!signInPoll) signInPoll = setInterval(refreshSignInStatus, 2000);
      }
      await refreshSignInStatus();
    } catch (err) {
      status.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
  el.settingsDialog.addEventListener('close', () => {
    clearInterval(signInPoll);
    signInPoll = null;
    accountRows().forEach(r => delete r.dataset.waiting);
  });

  // ---------------- projects ----------------
  async function loadProjects() {
    state.projects = await api('/api/projects');
    renderSidebar();
    refreshSyncStatus();
  }

  // Red/yellow/green sales-stage colour, not live-deploy status (that's
  // liveStatusFor below, shown separately as a small icon on the row).
  const STAGE_COLOUR_RANK = { red: 0, yellow: 1, green: 2, grey: 3 };
  function stageColour(p) {
    const stage = stageOf(p);
    if (stage === 'uncontacted') return 'red';
    if (stage === 'interested') return 'green';
    if (stage === 'not_interested') return 'grey';
    return 'yellow'; // called, follow_up, demo_sent — waiting to hear back
  }

  function sortedProjects() {
    let list = state.projects.slice();
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter(p => (p.raw?.name || p.name || p.slug).toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const rankDiff = STAGE_COLOUR_RANK[stageColour(a)] - STAGE_COLOUR_RANK[stageColour(b)];
      return rankDiff !== 0 ? rankDiff : (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    return list;
  }

  // Live-deploy status (is the actual website online right now) — separate
  // from the sales-stage dot. The open project reuses the exact same
  // comparison as the deploy button (current render vs what's actually
  // live); for the rest we only know whether they've ever been deployed,
  // since computing their current render just for a row icon isn't worth it.
  function liveStatusFor(p) {
    if (state.current && state.current.slug === p.slug) {
      const liveUrl = state.current.liveUrl;
      const currentHtml = el.preview.dataset.lastHtml;
      const needsUpdate = Boolean(liveUrl) && currentHtml !== state.current.deployedHtml;
      return !liveUrl ? 'not-live' : needsUpdate ? 'needs-update' : 'live';
    }
    return p.liveUrl ? 'live' : 'not-live';
  }

  // Sections follow the sales Stage only (never whether a demo is live).
  // Default: the top three share the panel equally and Not interested is
  // collapsed to its title at the bottom. Clicking any title grows that
  // section to the full panel (the rest shrink to titles); clicking it
  // again goes back. Paying customers live on the Live tab instead.
  const SIDE_SECTIONS = [
    { id: 'red', label: 'Uncontacted', stages: ['uncontacted'] },
    { id: 'yellow', label: 'Waiting / ring back', stages: ['called', 'follow_up', 'interested'] },
    { id: 'green', label: 'Demo sent', stages: ['demo_sent'] },
    { id: 'grey', label: 'Not interested', stages: ['not_interested'], collapsedByDefault: true }
  ];
  const CHEVRON = '<svg class="side-chevron" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
  function renderSidebar() {
    const scrolls = Object.fromEntries([...el.projectList.querySelectorAll('.side-section')]
      .map(s => [s.dataset.section, s.querySelector('.side-section-list').scrollTop]));
    const list = sortedProjects().filter(p => !isLivePaying(p));
    const expanded = state.sideExpanded;
    el.projectList.innerHTML = '';
    SIDE_SECTIONS.forEach(section => {
      const items = list.filter(p => section.stages.includes(stageOf(p)));
      const open = expanded ? expanded === section.id : !section.collapsedByDefault;
      const box = document.createElement('section');
      box.dataset.section = section.id;
      box.className = `side-section side-${section.id}${open ? '' : ' is-collapsed'}${expanded === section.id ? ' is-expanded' : ''}`;
      box.innerHTML = `<button type="button" class="side-section-head" title="${expanded === section.id ? 'Back to all sections' : 'Show this section full height'}"><span>${section.label}</span><b>${items.length}</b>${CHEVRON}</button><div class="side-section-list"></div>`;
      const body = box.querySelector('.side-section-list');
      if (items.length) items.forEach(p => body.appendChild(projectRow(p)));
      else body.innerHTML = `<p class="side-empty">${state.search.trim() ? 'No matches' : 'None yet'}</p>`;
      el.projectList.appendChild(box);
      body.scrollTop = scrolls[section.id] || 0;
    });
  }
  el.projectList.addEventListener('click', e => {
    const head = e.target.closest('.side-section-head');
    if (!head) return;
    const id = head.closest('.side-section').dataset.section;
    state.sideExpanded = state.sideExpanded === id ? null : id;
    renderSidebar();
  });

  function projectRow(p) {
    const row = document.createElement('div');
    row.className = 'project' + (state.current && state.current.slug === p.slug ? ' active' : '');
    row.title = stageLabel(stageOf(p));
    const name = document.createElement('span');
    name.className = 'project-name';
    name.textContent = businessName(p);
    const site = websiteOf(p);
    // Live status as a small secondary icon, separate from the stage dot —
    // opens the site directly, same as the green deploy button does.
    const live = document.createElement('button');
    live.className = `project-live status-${liveStatusFor(p)}`;
    live.title = site ? { 'not-live': 'Not live', 'needs-update': 'Live — needs updating', live: 'Open live site' }[liveStatusFor(p)] : 'No website yet';
    live.textContent = '●';
    live.hidden = !site;
    live.onclick = e => { e.stopPropagation(); if (site) openExternal(site); };
    const del = document.createElement('button');
    del.className = 'project-delete';
    del.title = 'Delete this business';
    del.textContent = '✕';
    del.onclick = e => { e.stopPropagation(); deleteProject(p.slug, name.textContent); };
    row.append(name, live, del);
    // Clicking the already-open site again closes it back to the start screen.
    row.onclick = () => {
      if (state.current?.slug === p.slug) closeCurrentProject();
      else selectProject(p.slug);
    };
    return row;
  }

  el.projectSearch.oninput = () => { state.search = el.projectSearch.value; renderSidebar(); };

  async function deleteProject(slug, displayName) {
    const ok = await showConfirm(`Delete "${displayName}"?`, "This removes its files permanently and can't be undone.");
    if (!ok) return;
    try {
      await api(`/api/projects/${slug}`, { method: 'DELETE' });
      if (state.current?.slug === slug) {
        state.current = null;
        state.found = {};
        state.placementSuggestion = null;
        state.placementDismissed = null;
      }
      await loadProjects();
      if (state.tab === 'live') renderLive();
      renderEditor();
      renderPreview();
      renderLiveActions();
      notify(`Deleted "${displayName}".`);
    } catch (err) {
      notify(err.message, { sticky: false });
    }
  }

  async function selectProject(slug) {
    state.current = await api(`/api/projects/${slug}`);
    state.found = {};
    state.placementSuggestion = null;
    state.placementDismissed = null;
    if (state.current.importImages?.length) state.found.hero = state.current.importImages[0];
    renderSidebar();
    renderEditor();
    renderPreview({ seedDeployed: true });
    renderLiveActions();
    checkLive();
  }

  function closeCurrentProject() {
    if (state.editingText) setTextEditing(false);
    state.current = null;
    state.found = {};
    state.placementSuggestion = null;
    state.placementDismissed = null;
    renderSidebar();
    renderEditor();
    el.preview.srcdoc = '';
    delete el.preview.dataset.lastHtml;
    renderLiveActions();
  }

  // Shows a "copy site URL" button and switches the deploy button's label/
  // colour once a site has a live URL — the button itself always still
  // triggers a fresh deploy (pushing edits live). Colour is a simple
  // traffic light: red = never deployed, amber = live but the current
  // preview no longer matches what was last deployed, green = live and
  // matching. Comparing the actual rendered HTML (rather than a sticky
  // "has anything been touched" flag) means undoing an edit back to what's
  // already live correctly goes back to green instead of staying amber.
  function renderLiveActions() {
    const liveUrl = state.current?.liveUrl;
    const currentHtml = el.preview.dataset.lastHtml;
    const needsUpdate = Boolean(liveUrl) && currentHtml !== state.current?.deployedHtml;
    const waiting = isDeployPending(state.current);
    el.deployBtn.textContent = waiting ? 'Waiting to go live…' : !liveUrl ? 'Make live' : needsUpdate ? 'Update live site' : 'Open live site';
    el.deployBtn.title = waiting ? 'Publishes automatically from the admin’s computer' : (state.current?.deployError ? `Last attempt failed: ${state.current.deployError}` : '');
    el.deployBtn.classList.remove('status-not-live', 'status-deploying', 'status-live', 'status-needs-update');
    el.deployBtn.classList.add(waiting ? 'status-deploying' : !liveUrl ? 'status-not-live' : needsUpdate ? 'status-needs-update' : 'status-live');
    el.copyLiveBtn.hidden = !liveUrl;
    const goingOffline = isOfflinePending(state.current);
    el.offlineBtn.hidden = !liveUrl || waiting;
    el.offlineBtn.disabled = goingOffline;
    el.offlineBtn.textContent = goingOffline ? 'Going offline…' : 'Take offline';
    renderSidebar();
  }

  // `deployedHtml` is a client-only snapshot (the server has no concept of
  // it) — every time the server hands back a fresh project object it has
  // to be carried over by hand, or the "matches what's live" comparison
  // would forget it on every save and show amber even when nothing
  // actually changed.
  function replaceCurrent(updated) {
    const deployedHtml = state.current?.deployedHtml;
    state.current = updated;
    if (deployedHtml !== undefined) state.current.deployedHtml = deployedHtml;
  }

  async function persist() {
    if (!state.current) return;
    replaceCurrent(await api(`/api/projects/${state.current.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.current)
    }));
    renderLiveActions();
    // Patch the already-loaded sidebar list in place instead of calling
    // loadProjects() here — that re-fetches /api/projects, which (when
    // shared sync is on) pulls from Supabase every time, and persist()
    // fires (debounced) while typing via scheduleSave(). The PUT response
    // already has everything the sidebar needs (name, timestamps); a real
    // remote
    // refresh happens on the actions that actually warrant one (opening
    // the app, creating/deleting/importing a project).
    const idx = state.projects.findIndex(p => p.slug === state.current.slug);
    if (idx !== -1) state.projects[idx] = state.current;
    renderSidebar();
  }

  function setRaw(patch) {
    state.current.raw = { ...state.current.raw, ...patch };
  }

  function categoryOptions(selected) {
    return `<option value="">Choose…</option>` + BUSINESS_TYPES.map(t =>
      `<option value="${t.label}" ${t.label === selected ? 'selected' : ''}>${t.label}</option>`
    ).join('');
  }

  function templateOptions(selected) {
    return DEMO_LAYOUTS.map(t =>
      `<button type="button" class="template-tile${t.id === selected ? ' selected' : ''}" data-layout="${t.id}">${t.name}</button>`
    ).join('');
  }

  // Which template the preview is actually rendering right now — mirrors
  // fresh-templates.js's own fallback exactly (an explicit choice if it's
  // still a valid id, otherwise the category default), so the picker
  // shows the true active template even before anyone's clicked a tile.
  // Without this, a brand-new or freshly-imported project (raw.layout
  // unset) always rendered a fallback template but showed no tile as
  // selected, leaving no way to tell which one was actually in use.
  function effectiveLayout(raw) {
    if (DEMO_LAYOUTS.some(t => t.id === raw.layout)) return raw.layout;
    const info = typeInfo(raw.tagline) || BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
    return demoLayoutForCategory(info.cat || 'office');
  }

  // Same named colour palettes brightsite.app's own live builder offers
  // (homepage-builder.js) — duplicated here as plain data rather than
  // loading that file, since it's wired directly to the marketing site's
  // own DOM, not a reusable generator module. Grouped into the same 5
  // mood families as that builder, rather than one flat 30-swatch grid,
  // so the field stays compact — a family is a single pill until opened.
  const COLOUR_FAMILIES = {
    Soft: [['Porcelain', '#b59b94'], ['Rose', '#b77988'], ['Lavender', '#9180a5'], ['Cloud', '#8b9ca7'], ['Sand', '#b69b72'], ['Pearl', '#92918b']],
    Bold: [['Ruby', '#ac2637'], ['Cobalt', '#245bb0'], ['Forest', '#286148'], ['Ochre', '#a97618'], ['Plum', '#763d67'], ['Copper', '#a75132']],
    Natural: [['Sage', '#70836a'], ['Clay', '#a86e52'], ['Olive', '#797744'], ['Ocean', '#3d7479'], ['Oat', '#a29378'], ['Moss', '#506951']],
    Bright: [['Coral', '#cf5547'], ['Azure', '#267fba'], ['Berry', '#b33e7e'], ['Tangerine', '#c96623'], ['Teal', '#16847b'], ['Violet', '#7652b0']],
    Dark: [['Ink', '#26313e'], ['Espresso', '#4a3630'], ['Midnight', '#283958'], ['Pine', '#29473e'], ['Charcoal', '#3e4145'], ['Aubergine', '#4f354d']]
  };

  // Black or white, whichever reads clearly on a given swatch colour —
  // the palette hexes span from near-white (Pearl) to near-black (Ink),
  // so the name label needs its own contrast check per swatch rather
  // than one fixed text colour.
  function contrastTextColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#17181a' : '#ffffff';
  }

  function familyForHex(hex) {
    for (const [family, choices] of Object.entries(COLOUR_FAMILIES)) {
      if (choices.some(([, h]) => h === hex)) return family;
    }
    return null;
  }

  function nameForHex(hex) {
    for (const choices of Object.values(COLOUR_FAMILIES)) {
      const match = choices.find(([, h]) => h === hex);
      if (match) return match[0];
    }
    return null;
  }

  function colourCurrentHtml(hex) {
    return hex ? `<i style="background:${hex}"></i>${nameForHex(hex) || ''}` : '';
  }

  // The whole "Colour" field: a row of 5 family pills (each a tiny 3-dot
  // preview of its own colours) plus, when one is open, a floating panel
  // of that family's 6 swatches underneath. Picking a swatch closes the
  // panel straight back down — the compact state is always what's on
  // screen except for the moment you're actually choosing.
  function colourPickerHtml(selectedHex, openFamily) {
    const activeFamily = familyForHex(selectedHex);
    const families = Object.entries(COLOUR_FAMILIES).map(([family, choices]) => `
      <button type="button" class="colour-cat-btn${family === openFamily ? ' open' : ''}${family === activeFamily ? ' selected-fam' : ''}" data-family="${family}">
        <span class="colour-cat-dots">${choices.slice(0, 3).map(([, hex]) => `<i style="background:${hex}"></i>`).join('')}</span>
        ${family}
      </button>`).join('');
    const popover = openFamily ? `
      <div class="colour-popover">
        <div class="colour-grid">${COLOUR_FAMILIES[openFamily].map(([name, hex]) =>
          `<button type="button" class="colour-swatch${hex === selectedHex ? ' selected' : ''}" data-hex="${hex}" title="${name}" style="background:${hex};color:${contrastTextColor(hex)}">${name}</button>`
        ).join('')}</div>
      </div>` : '';
    return `<div class="colour-families">${families}</div>${popover}`;
  }

  // ---------------- start screen (no project selected) ----------------
  function renderStartScreen() {
    el.editor.innerHTML = `
      <div class="start-screen">
        <img src="/generator/img/brightsite-logo.png" alt="BrightSite" class="start-logo">
        <div class="link-bar">
          <input id="startLink" type="text" placeholder="Paste a link, type a name, or ask AI to find some…">
          <button id="startBuildBtn">Build website</button>
        </div>
        <div class="import-status" id="startStatus"></div>
      </div>
    `;
    wireBuildBar(document.getElementById('startLink'), document.getElementById('startBuildBtn'), document.getElementById('startStatus'));
  }

  function splitLinks(text) {
    const urls = (text.match(/https?:\/\/\S+/g) || []).map(u => u.trim());
    return [urls[0], urls[1]];
  }

  // What a typed request means: a link (the existing lookup flow), a short
  // name (just create it, nothing to look up), or a longer natural-language
  // request ("find hairdressers in Beverley") — search the web for several
  // real matches instead of one. The word-count cutoff is a heuristic, not
  // a parser — a very short "find X" still reads as a name, and an unusual
  // multi-word business name could misfire into search mode, but a plain
  // name is always still one Enter-press away from working via a link.
  function classifyBuildInput(text) {
    const trimmed = text.trim();
    const [url, url2] = splitLinks(trimmed);
    if (url) return { mode: 'link', url, url2 };
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (!words.length) return { mode: 'empty' };
    return words.length >= 5 ? { mode: 'search', query: trimmed } : { mode: 'name', name: trimmed };
  }

  // Shared by the sidebar's build box and the empty-state one on the start
  // screen — same three modes, same behaviour, wherever it's typed.
  function wireBuildBar(input, btn, status) {
    const bar = input.closest('.link-bar');
    const updateMode = () => {
      const mode = classifyBuildInput(input.value).mode;
      if (bar) bar.classList.toggle('ai-mode', mode === 'search');
      btn.textContent = mode === 'search' ? 'Search & add' : 'Build website';
    };
    updateMode();
    input.oninput = updateMode;
    input.onkeydown = e => { if (e.key === 'Enter') runSmartBuild(input, btn, status); };
    btn.onclick = () => runSmartBuild(input, btn, status);
  }

  // Live "what Claude is doing" feed for AI search — the server streams
  // newline-delimited JSON events (see /api/ai-search) and each one becomes
  // a step in the panel: searches run, sites read, notes, names found.
  const SEARCH_TIPS = [
    'Checking each business is real before adding it…',
    'Looking through Facebook pages and Google listings…',
    'Cross-checking names, phone numbers and addresses…',
    'Good searches take a couple of minutes — hang tight…'
  ];

  async function runAiSearch(query, anchor) {
    const panel = document.createElement('div');
    panel.className = 'ai-live';
    panel.innerHTML = `
      <div class="ai-live-head">
        <span class="ai-orb"></span>
        <span class="ai-live-phase">Starting Claude…</span>
        <span class="ai-live-time">0:00</span>
      </div>
      <div class="ai-live-query">“${escapeHtml(query)}”</div>
      <div class="ai-live-steps"></div>
      <div class="ai-live-found" hidden><div class="ai-live-label">Found so far</div><div class="ai-live-chips"></div></div>`;
    if (anchor) anchor.after(panel);
    const $ = sel => panel.querySelector(sel);
    const phase = text => { $('.ai-live-phase').textContent = text; };
    const started = Date.now();
    let lastActivity = Date.now();
    let tipIndex = 0;
    const tick = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      $('.ai-live-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      // Long quiet gaps (Claude reading results) get a rotating reassurance.
      if (Date.now() - lastActivity > 9000) {
        phase(SEARCH_TIPS[tipIndex++ % SEARCH_TIPS.length]);
        lastActivity = Date.now();
      }
    }, 1000);

    const addStep = (icon, html, cls = '') => {
      panel.querySelectorAll('.ai-step.current').forEach(s => s.classList.remove('current'));
      const row = document.createElement('div');
      row.className = `ai-step current ${cls}`;
      row.innerHTML = `<span class="ai-step-icon">${icon}</span><span class="ai-step-text">${html}</span>`;
      $('.ai-live-steps').appendChild(row);
      const steps = $('.ai-live-steps');
      while (steps.children.length > 6) steps.firstElementChild.remove();
      lastActivity = Date.now();
    };
    let searches = 0;
    let found = 0;

    const onEvent = ev => {
      if (ev.type === 'thinking') {
        phase(searches ? 'Thinking about what it found…' : 'Planning the search…');
        lastActivity = Date.now();
      } else if (ev.type === 'search') {
        searches++;
        phase(`Searching the web (${searches})…`);
        addStep('🔍', `Searching <b>${escapeHtml(ev.query)}</b>`);
      } else if (ev.type === 'sources') {
        const hosts = [...new Set(ev.sources.map(s => s.host))].slice(0, 4);
        addStep('📄', `Reading ${ev.count} results ${hosts.map(h => `<span class="ai-host">${escapeHtml(h)}</span>`).join('')}`, 'muted');
        phase('Reading the results…');
      } else if (ev.type === 'note') {
        addStep('💭', escapeHtml(ev.text), 'note');
      } else if (ev.type === 'found') {
        found++;
        phase(`Writing up the list — ${found} found…`);
        const box = $('.ai-live-found');
        box.hidden = false;
        const chip = document.createElement('span');
        chip.className = 'ai-chip';
        chip.textContent = ev.name;
        box.querySelector('.ai-live-chips').appendChild(chip);
        lastActivity = Date.now();
      } else if (ev.type === 'saving') {
        phase(`Adding ${ev.count} to your list…`);
      }
    };

    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query })
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === 'done') return ev;
          if (ev.type === 'error') throw new Error(ev.error);
          onEvent(ev);
        }
      }
      throw new Error('Search stopped unexpectedly');
    } finally {
      clearInterval(tick);
      panel.remove();
    }
  }

  async function runSmartBuild(input, btn, status) {
    const parsed = classifyBuildInput(input.value);
    if (parsed.mode === 'empty') return;
    btn.disabled = true;
    try {
      if (parsed.mode === 'link') {
        if (status) setLoading(status, 'Reading the page…');
        const project = await api('/api/quick-import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: parsed.url, url2: parsed.url2 })
        });
        await loadProjects();
        await selectProject(project.slug);
        notify(`Built a site for ${project.raw?.name || 'this business'}.`);
      } else if (parsed.mode === 'name') {
        if (status) setLoading(status, 'Adding…');
        const project = await api('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: parsed.name }) });
        await loadProjects();
        await selectProject(project.slug);
        notify(`Added ${parsed.name}.`);
      } else {
        // AI search mode: several businesses at once, so there's no single
        // one to open — just drop them into the list.
        if (status) status.textContent = '';
        const result = await runAiSearch(parsed.query, status);
        await loadProjects();
        notify(
          result.projects.length
            ? `Found ${result.projects.length} business${result.projects.length === 1 ? '' : 'es'} — added to the list.`
            : "Couldn't find any real businesses matching that.",
          { sticky: !result.projects.length }
        );
      }
      input.value = '';
      if (status) status.textContent = '';
    } catch (err) {
      if (status) showTempStatus(status, friendlyError(err.message));
      notify(friendlyError(err.message), { sticky: false });
    } finally {
      btn.disabled = false;
      // Reflect whatever's left in the box (cleared on success, still there
      // after a failure) rather than assuming it's back to empty.
      if (input.isConnected) {
        const mode = classifyBuildInput(input.value).mode;
        const bar = input.closest('.link-bar');
        if (bar) bar.classList.toggle('ai-mode', mode === 'search');
        btn.textContent = mode === 'search' ? 'Search & add' : 'Build website';
      }
    }
  }

  // ---------------- Builder editor ----------------
  function renderEditor() {
    document.querySelector('.layout').classList.toggle('no-project', !state.current);
    if (!state.current) return renderStartScreen();
    const raw = state.current.raw || {};
    const profile = raw.businessProfile || {};

    el.editor.innerHTML = `
      <div class="sales-block" id="salesBlock"></div>
      <div class="section-divider"><span>Website</span></div>
      <div class="link-bar compact">
        <input id="f_link" type="text" placeholder="Paste a Facebook or Google Maps link…" value="${escapeAttr(state.current.lastImportUrl || state.current.contact?.facebookUrl || profile.mapsUrl || '')}">
        <button id="importBtn">${state.current.lastImportUrl ? 'Re-fetch' : 'Fetch'}</button>
      </div>
      <div class="import-status" id="importStatus"></div>

      <div class="form-grid name-row">
        <div class="field"><label>Business name</label>
          <input id="f_name" value="${escapeAttr(raw.name || '')}"></div>
        <div class="field field-compact"><label>Category</label>
          <select id="f_category">${categoryOptions(raw.tagline)}</select></div>
        <div class="field"><label>Name</label>
          <input id="f_contactName" placeholder="Contact’s name" value="${escapeAttr(state.current.contact?.name || '')}"></div>
      </div>
      <div class="phone-row">
        <div class="field"><label>Phone</label>
          <input id="f_phone" value="${escapeAttr(profile.phone || '')}"></div>
        <button id="whatsappBtn" class="contact-btn whatsapp-btn" title="WhatsApp a welcome message" aria-label="Open WhatsApp">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-1-.3-.1-.5-.1-.6.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.3-.4.1-.2 0-.3 0-.5s-.6-1.5-.9-2c-.2-.5-.5-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2.1 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.6.2-1.2.2-1.3-.1-.2-.3-.2-.6-.4z"/><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>
        </button>
        <div class="field"><label>Email</label>
          <input id="f_email" type="email" value="${escapeAttr(state.current.contact?.email || '')}"></div>
        <button id="emailBtn" class="contact-btn email-btn" title="Email a welcome message" aria-label="Send email">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>
        </button>
      </div>
      <div class="field"><label>Location / address</label>
        <input id="f_location" value="${escapeAttr(profile.address || raw.location || '')}"></div>

      <div class="media-row-3">
        ${mediaSlot('logo', 'Logo')}
        ${mediaSlot('hero', 'Hero image')}
        <div class="media-slot" data-slot="gallery">
          <div class="media-head">
            <label>Gallery</label>
            <div class="media-head-actions"><button id="galleryUploadBtn">+ Add</button></div>
          </div>
          <div class="gallery-grid" id="galleryGrid">${galleryThumbs()}</div>
          <input type="file" id="galleryUpload" accept="image/*" multiple hidden>
        </div>
      </div>

      <div class="field"><label>Template</label>
        <div class="template-grid-6" id="templateGrid">${templateOptions(effectiveLayout(raw))}</div></div>

      <div class="field"><label>Colour <span class="colour-current" id="colourCurrent">${colourCurrentHtml(raw.tones?.base)}</span></label>
        <div class="colour-picker" id="colourPicker">${colourPickerHtml(raw.tones?.base, null)}</div></div>

      <div class="ai-edit-box">
        <label>Edit with AI</label>
        <div class="ai-edit-input">
          <textarea id="aiInstruction" rows="2" placeholder="e.g. Make the about section warmer and mention it's family-run"></textarea>
          <button id="aiEditBtn" title="Apply (Enter)" aria-label="Apply edit"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
        </div>
        <div class="ai-edit-status" id="aiEditStatus"></div>
        ${editLogHtml()}
      </div>
    `;

    document.getElementById('importBtn').onclick = runImport;
    const linkInput = document.getElementById('f_link');
    let linkTimer = null;
    linkInput.addEventListener('input', () => {
      clearTimeout(linkTimer);
      linkTimer = setTimeout(() => {
        const value = linkInput.value.trim();
        if (/^https?:\/\//i.test(value) && value !== (state.current.lastImportUrl || '')) runImport();
      }, 400);
    });
    document.getElementById('f_name').oninput = e => { setRaw({ name: e.target.value }); scheduleSave(); };
    document.getElementById('f_category').onchange = e => { setRaw({ tagline: e.target.value }); scheduleSave(); };
    document.getElementById('f_contactName').oninput = e => {
      state.current.contact = { ...(state.current.contact || {}), name: e.target.value };
      scheduleSave();
    };
    document.getElementById('f_phone').oninput = e => { setRaw({ businessProfile: { ...profile, phone: e.target.value } }); scheduleSave(); };
    document.getElementById('f_email').oninput = e => {
      state.current.contact = { ...(state.current.contact || {}), email: e.target.value };
      scheduleSave();
    };
    document.getElementById('whatsappBtn').onclick = () => openWhatsApp(document.getElementById('f_phone').value);
    document.getElementById('emailBtn').onclick = () => openEmail(document.getElementById('f_email').value);
    document.getElementById('f_location').oninput = e => {
      setRaw({ location: e.target.value, businessProfile: { ...profile, address: e.target.value } });
      scheduleSave();
    };
    document.getElementById('templateGrid').addEventListener('click', e => {
      const tile = e.target.closest('.template-tile');
      if (!tile) return;
      setRaw({ layout: tile.dataset.layout });
      document.querySelectorAll('.template-tile').forEach(t => t.classList.toggle('selected', t === tile));
      persist();
      schedulePreview();
    });
    (() => {
      const colourPicker = document.getElementById('colourPicker');
      const colourCurrent = document.getElementById('colourCurrent');
      let selectedColourHex = raw.tones?.base;
      let openColourFamily = null;
      const rerender = () => { colourPicker.innerHTML = colourPickerHtml(selectedColourHex, openColourFamily); };
      colourPicker.addEventListener('click', e => {
        const catBtn = e.target.closest('.colour-cat-btn');
        if (catBtn) {
          openColourFamily = openColourFamily === catBtn.dataset.family ? null : catBtn.dataset.family;
          rerender();
          return;
        }
        const swatch = e.target.closest('.colour-swatch');
        if (!swatch) return;
        selectedColourHex = swatch.dataset.hex;
        openColourFamily = null;
        setRaw({ tones: tonesFromHex(selectedColourHex) });
        rerender();
        colourCurrent.innerHTML = colourCurrentHtml(selectedColourHex);
        persist();
        schedulePreview();
      });
    })();
    document.getElementById('galleryUploadBtn').onclick = () => document.getElementById('galleryUpload').click();
    document.getElementById('galleryUpload').addEventListener('change', e => uploadGallery(e.target.files));
    document.getElementById('aiEditBtn').onclick = runAiEdit;
    document.getElementById('aiInstruction').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAiEdit(); }
    });
    document.querySelectorAll('.edit-log .undo').forEach(btn => (btn.onclick = () => undoEdit(Number(btn.dataset.i))));
    document.querySelectorAll('.gallery-grid .thumb-remove').forEach(btn => (btn.onclick = () => removeGalleryItem(Number(btn.dataset.i))));
    wireMediaSlot('logo');
    wireMediaSlot('hero');
    renderSales();
    wirePlacementSuggestion();
    maybeSuggestPlacement();
  }

  // Cold-calling details for the open business, at the top of the form.
  // Changing the stage moves it between the sidebar halves; setting it to
  // Paid moves it onto the Live & Paying tab.
  function renderSales() {
    const box = document.getElementById('salesBlock');
    if (!box || !state.current) return;
    const p = state.current;
    const options = (list, selected) => list.map(([id, label]) =>
      `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`).join('');
    box.innerHTML = `
      <div class="section-heading">Admin <span>Cold calling</span></div>
      <div class="sales-row">
        <div class="field"><label>Stage</label>
          <select id="s_stage">${options(SALES_STAGES, stageOf(p))}</select></div>
        <div class="field"><label>Monthly price</label>
          <input id="s_price" value="${escapeAttr(p.price || '')}" placeholder="e.g. 45"></div>
        <div class="field"><label>Paying?</label>
          <select id="s_payment">${options(PAYMENT_STATUSES, p.paymentStatus || 'no')}</select></div>
      </div>
      <div class="field"><label>Call notes</label>
        <textarea id="s_notes" placeholder="What happened on the call, what to do next…">${escapeHtml(p.notes || '')}</textarea></div>`;
    document.getElementById('s_stage').onchange = e => { state.current.pipelineStage = e.target.value; persist(); };
    document.getElementById('s_price').oninput = e => { state.current.price = e.target.value; scheduleSave(); };
    document.getElementById('s_notes').oninput = e => { state.current.notes = e.target.value; scheduleSave(); };
    document.getElementById('s_payment').onchange = async e => {
      state.current.paymentStatus = e.target.value;
      await persist();
      if (e.target.value === 'paid') notify(`"${businessName(state.current)}" is now on the Live tab.`);
    };
  }

  function editLogHtml() {
    const log = state.current.editLog || [];
    if (!log.length) return '';
    return `<div class="edit-log">${log.slice().reverse().map((entry, idx) => {
      const i = log.length - 1 - idx;
      return `<div class="entry"><span>"${escapeHtml(entry.instruction)}"</span><button class="undo" data-i="${i}">Undo</button></div>`;
    }).join('')}</div>`;
  }

  async function runAiEdit() {
    const input = document.getElementById('aiInstruction');
    const status = document.getElementById('aiEditStatus');
    const btn = document.getElementById('aiEditBtn');
    const instruction = input.value.trim();
    if (!instruction || btn.disabled) return;
    btn.disabled = true;
    input.disabled = true;
    setLoading(status, 'Asking Claude…');
    try {
      await flushSave();
      const updated = await api(`/api/projects/${state.current.slug}/ai-edit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instruction })
      });
      replaceCurrent(updated);
      renderEditor();
      renderPreview();
      renderLiveActions();
      document.getElementById('aiEditStatus').textContent = 'Done — undo it below if it’s not right.';
    } catch (err) {
      btn.disabled = false;
      input.disabled = false;
      showTempStatus(status, friendlyError(err.message), 8000);
    }
  }

  async function undoEdit(index) {
    const log = state.current.editLog || [];
    const entry = log[index];
    if (!entry) return;
    // Restore the exact pre-edit values captured server-side when the edit
    // was applied (see server.js /ai-edit), not just clear the fields.
    const restoredRaw = { ...state.current.raw, ...(entry.beforeFields || {}) };
    if (entry.beforeProfile && Object.keys(entry.beforeProfile).length) {
      restoredRaw.businessProfile = { ...(restoredRaw.businessProfile || {}), ...entry.beforeProfile };
    }
    state.current.raw = restoredRaw;
    state.current.editLog = log.filter((_, i) => i !== index);
    await persist();
    renderEditor();
    renderPreview();
  }

  function mediaSlot(slot, label) {
    const raw = state.current.raw || {};
    const path = slot === 'logo' ? raw.logoImage : raw.heroImage;
    const thumbStyle = path ? `style="background-image:url('/projects/${state.current.slug}/${path}')"` : '';
    const found = state.found[slot];
    const autoHeroHint = slot === 'hero' && !path
      ? `<div class="auto-hint">Auto: ${raw.logoImage ? 'your logo' : 'name'} on a 3D scene</div>`
      : '';
    // Realistic placement needs a real uploaded photo (not the procedurally
    // composited hero) plus a real logo — offer it only once both exist.
    const canPlaceLogo = slot === 'hero' && path && raw.logoImage;
    const suggestion = slot === 'hero' ? placementSuggestionHtml() : '';
    return `
      <div class="media-slot" data-slot="${slot}">
        <div class="media-head">
          <label>${label}</label>
          ${path ? `<div class="media-head-actions">
            <button data-action="upload">Replace</button>
            <button class="media-remove" data-action="remove" title="Remove" aria-label="Remove">✕</button>
          </div>` : ''}
        </div>
        <div class="thumb ${path ? '' : 'is-empty'}" data-action="pick" ${thumbStyle} title="${path ? 'Replace' : 'Upload'}">${path ? '' : '<span>+ Upload</span>'}</div>
        ${autoHeroHint}
        <div class="actions extra">
          ${found ? `<button data-action="use-found" class="found">Use found</button>` : ''}
          ${canPlaceLogo ? `<button data-action="place-logo" class="found">Place logo on photo</button>` : ''}
        </div>
        ${suggestion}
        <input type="file" accept="image/*" style="display:none">
      </div>`;
  }

  // BrightSite automatically works out the best spot for the logo on the
  // uploaded/imported hero photo as soon as both exist, and offers it here
  // rather than silently overwriting the photo — a bad auto-guess should
  // never surprise the user on the live site.
  function placementSuggestionHtml() {
    const s = state.placementSuggestion;
    const raw = state.current.raw || {};
    if (!s || s.key !== placementKey(raw) || raw.heroPlacementApplied) return '';
    if (state.placementDismissed === s.key) return '';
    return `
      <div class="placement-suggestion" id="placementSuggestion">
        <div class="thumb" style="background-image:url('${s.dataUrl}')"></div>
        <div class="ps-text">Suggested: your logo placed on this photo.</div>
        <div class="ps-actions">
          <button data-action="ps-use" class="found">Use this</button>
          <button data-action="ps-adjust">Adjust</button>
          <button data-action="ps-dismiss" class="ghost">Dismiss</button>
        </div>
      </div>`;
  }

  function wirePlacementSuggestion() {
    const box = document.getElementById('placementSuggestion');
    if (!box) return;
    const s = state.placementSuggestion;
    box.querySelector('[data-action="ps-use"]').onclick = async () => {
      const blob = await (await fetch(s.dataUrl)).blob();
      const form = new FormData();
      form.append('file', blob, 'hero-with-logo.jpg');
      const result = await api(`/api/projects/${state.current.slug}/media/hero`, { method: 'POST', body: form });
      setRaw({ heroImage: result.path, heroPlacementApplied: true });
      await persist();
      renderEditor();
      schedulePreview();
      notify('Logo placed on the hero photo.');
    };
    box.querySelector('[data-action="ps-adjust"]').onclick = () => openLogoPlacement({ quad: s.quad, strength: s.strength });
    box.querySelector('[data-action="ps-dismiss"]').onclick = () => {
      state.placementDismissed = s.key;
      renderEditor();
    };
  }

  function placementKey(raw) {
    return raw?.logoImage && raw?.heroImage ? `${state.current.slug}|${raw.logoImage}|${raw.heroImage}` : null;
  }

  // Runs the same detect-surface + warp pipeline as the manual "Place logo
  // on photo" button, but in the background against whatever hero photo and
  // logo the project currently has (typically straight off an import) and
  // stores the result as a dismissible suggestion rather than applying it.
  let placementRunKey = null;
  async function maybeSuggestPlacement() {
    const raw = state.current?.raw;
    const key = placementKey(raw);
    if (!key || raw.heroPlacementApplied || placementRunKey === key) return;
    if (state.placementSuggestion?.key === key) return;
    placementRunKey = key;
    const slug = state.current.slug;
    try {
      const [photo, logoImg] = await Promise.all([
        loadImageEl(`/projects/${slug}/${raw.heroImage}`),
        loadImageEl(`/projects/${slug}/${raw.logoImage}`)
      ]);
      const cleaned = await LogoPlacement.removeBackground(logoImg);
      const surfaces = await LogoPlacement.detectSurfaces(photo, { limit: 1 });
      if (!surfaces.length || placementKey(state.current?.raw) !== key) return; // stale by the time it resolved
      const dataUrl = await LogoPlacement.render({
        photo, logo: cleaned, quad: surfaces[0].quad, strength: 'realistic', output: 'dataURL'
      });
      if (placementKey(state.current?.raw) !== key) return;
      state.placementSuggestion = { key, dataUrl, quad: surfaces[0].quad, strength: 'realistic' };
      renderEditor();
    } catch (error) {
      console.error('Placement suggestion failed', error);
    }
  }

  function galleryThumbs() {
    const gallery = state.current.raw?.gallery || [];
    return gallery.map((g, i) => `<div class="thumb" style="background-image:url('/projects/${state.current.slug}/${g}')"><button class="thumb-remove" data-i="${i}" title="Remove">✕</button></div>`).join('')
      || '<span class="gallery-empty">No images yet</span>';
  }

  function wireMediaSlot(slot) {
    const wrap = document.querySelector(`.media-slot[data-slot="${slot}"]`);
    if (!wrap) return;
    const fileInput = wrap.querySelector('input[type=file]');
    wrap.querySelectorAll('[data-action="upload"], [data-action="pick"]').forEach(b => (b.onclick = () => fileInput.click()));
    fileInput.onchange = () => uploadMedia(slot, fileInput.files[0]);
    const useFound = wrap.querySelector('[data-action="use-found"]');
    if (useFound) useFound.onclick = () => useFoundImage(slot);
    const remove = wrap.querySelector('[data-action="remove"]');
    if (remove) remove.onclick = e => { e.stopPropagation(); removeMedia(slot); };
    const placeLogo = wrap.querySelector('[data-action="place-logo"]');
    if (placeLogo) placeLogo.onclick = () => openLogoPlacement();
  }

  // Realistic Logo Placement — warps and blends the uploaded logo onto the
  // uploaded hero photo (wall, sign, window or van panel) so it reads as
  // physically installed rather than pasted on, then saves the result as
  // the hero image. Auto-suggests a flat placement area but the user can
  // drag the four corners to fit the real surface exactly.
  async function openLogoPlacement(initial) {
    const raw = state.current.raw || {};
    if (!raw.heroImage || !raw.logoImage) return;
    const slug = state.current.slug;
    const photo = `/projects/${slug}/${raw.heroImage}`;
    let logo = `/projects/${slug}/${raw.logoImage}`;
    try {
      const cleaned = await LogoPlacement.removeBackground(await loadImageEl(logo));
      logo = cleaned.toDataURL('image/png');
    } catch (error) {
      console.error('Logo background removal skipped', error);
    }
    LogoPlacement.openEditor({
      photo, logo,
      quad: initial?.quad,
      strength: initial?.strength,
      onSave: async ({ dataUrl }) => {
        const blob = await (await fetch(dataUrl)).blob();
        const form = new FormData();
        form.append('file', blob, 'hero-with-logo.jpg');
        const result = await api(`/api/projects/${slug}/media/hero`, { method: 'POST', body: form });
        setRaw({ heroImage: result.path, heroPlacementApplied: true });
        await persist();
        renderEditor();
        schedulePreview();
        notify('Logo placed on the hero photo.');
      }
    });
  }

  function loadImageEl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image.'));
      img.src = src;
    });
  }

  async function removeMedia(slot) {
    setRaw({ [slot === 'logo' ? 'logoImage' : 'heroImage']: '' });
    await persist();
    renderEditor();
    schedulePreview();
  }

  async function removeGalleryItem(index) {
    const gallery = (state.current.raw.gallery || []).filter((_, i) => i !== index);
    setRaw({ gallery });
    await persist();
    renderEditor();
    schedulePreview();
  }

  async function uploadMedia(slot, file) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const result = await api(`/api/projects/${state.current.slug}/media/${slot}`, { method: 'POST', body: form });
    setRaw({ [slot === 'logo' ? 'logoImage' : 'heroImage']: result.path });
    await persist();
    renderEditor();
    schedulePreview();
  }

  async function uploadGallery(files) {
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      const result = await api(`/api/projects/${state.current.slug}/media/gallery`, { method: 'POST', body: form });
      const gallery = state.current.raw.gallery || [];
      setRaw({ gallery: [...gallery, result.path] });
    }
    await persist();
    renderEditor();
    schedulePreview();
  }

  async function useFoundImage(slot) {
    const url = state.found[slot];
    if (!url) return;
    const result = await api(`/api/projects/${state.current.slug}/media/${slot}/fetch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url })
    });
    setRaw({ [slot === 'logo' ? 'logoImage' : 'heroImage']: result.path });
    await persist();
    renderEditor();
    schedulePreview();
  }

  async function runImport() {
    const [url, url2] = splitLinks(document.getElementById('f_link').value.trim());
    const status = document.getElementById('importStatus');
    if (!url && !url2) return;
    setLoading(status, 'Reading the page…');
    try {
      const data = await api('/api/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, url2 })
      });
      const aiFilled = (state.current.aiFilled || []).slice();
      const raw = state.current.raw || {};
      const profile = { ...(raw.businessProfile || {}) };
      if (data.name && !raw.name) setRaw({ name: data.name });
      if (data.category && !raw.tagline) setRaw({ tagline: data.category });
      if (data.location && !raw.location) setRaw({ location: data.location });
      if (data.address) profile.address = data.address;
      if (data.phone) profile.phone = data.phone;
      if (data.about) profile.about = data.about;
      if (data.mapsUrl) profile.mapsUrl = data.mapsUrl;
      if (data.hours?.length) profile.hours = data.hours;
      if (!data.about && !aiFilled.includes('about')) aiFilled.push('about');
      setRaw({ businessProfile: profile });
      state.current.aiFilled = aiFilled;
      state.current.lastImportUrl = url || url2;
      const contact = { ...(state.current.contact || {}) };
      if (url) contact.facebookUrl = url;
      if (url2) contact.googleUrl = url2;
      state.current.contact = contact;
      if (data.images?.length) state.found.hero = data.images[0];
      await persist();
      renderEditor();
      schedulePreview();
      const source = data.method === 'claude' ? 'Claude' : (data.fallbackError ? 'partial fallback' : 'the page');
      status.textContent = `Read via ${source}. ${data.images?.length ? data.images.length + ' image(s) found — see "Use found".' : ''}`;
      notify(`Imported for ${state.current.raw.name || 'this site'}.`);
    } catch (err) {
      showTempStatus(status, friendlyError(err.message));
      notify(friendlyError(err.message), { sticky: false });
    }
  }

  // Debounces just the (CPU-bound: HTML string build + hero compositing)
  // preview re-render — renderPreview() only reads already-updated local
  // state, so it never needs to wait on a server response. Used after
  // callers that persist a change immediately themselves (media actions,
  // template picks) and just want the preview to catch up.
  let previewTimer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 150);
  }

  // Debounces the (network) save too, on top of the preview render above —
  // for continuous-typing field edits, where persisting on every single
  // keystroke would mean a PUT request (and, with shared sync on, a
  // Supabase write) per character typed.
  let saveTimer = null;
  function scheduleSave() {
    schedulePreview();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; persist(); }, 500);
  }

  // Runs a still-pending debounced save immediately. Leaving the Businesses
  // tab goes through here, so a tab switch can never drop an edit that was
  // sat waiting on its timer.
  async function flushSave() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    await persist();
  }

  function projectMediaAbsolute(raw, slug) {
    const withAbsolute = { ...raw };
    if (raw.logoImage) withAbsolute.logo = `${location.origin}/projects/${slug}/${raw.logoImage}`;
    if (raw.heroImage) withAbsolute.heroImage = `${location.origin}/projects/${slug}/${raw.heroImage}`;
    return withAbsolute;
  }

  // Auto-composited 3D hero — the same HeroBrandCompositor brightsite.app's
  // own builder uses. With a logo uploaded, it's placed into the scene
  // (wall/van/sign per category); without one, the business name itself is
  // lettered onto the scene as a procedural 3D wordmark. Only kicks in when
  // the user hasn't uploaded/picked their own hero photo (raw.heroImage) —
  // a manual choice always wins. Cached so it doesn't re-render on every
  // unrelated keystroke, only when name/location/category/template/logo
  // actually change.
  let heroCache = { key: null, dataUrl: null };
  async function composeAutoHero(raw, slug) {
    const info = typeInfo(raw.tagline) || BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
    const key = JSON.stringify([raw.name, raw.location, raw.tagline, raw.layout, raw.logoImage]);
    if (heroCache.key === key) return heroCache.dataUrl;
    try {
      const dataUrl = await HeroBrandCompositor.render({
        category: info.cat,
        businessName: raw.name || 'Your business',
        location: raw.location || '',
        logo: raw.logoImage ? `${location.origin}/projects/${slug}/${raw.logoImage}` : undefined,
        layout: raw.layout,
        output: 'dataURL'
      });
      heroCache = { key, dataUrl };
      return dataUrl;
    } catch (err) {
      console.error('Hero compositor failed', err);
      return null;
    }
  }

  // The exact page that gets deployed for any business — used for the
  // open project's preview and for publishing teammates' requests.
  async function buildSiteHtml(project) {
    const raw = projectMediaAbsolute(project.raw, project.slug);
    if (!raw.heroImage) {
      const auto = await composeAutoHero(project.raw, project.slug);
      if (auto) raw.heroImage = auto;
    }
    return applyTextOverrides(buildDemoHTML(raw), project.raw.textOverrides);
  }

  // A computer that can deploy (Vercel signed in) publishes any site a
  // teammate asked to go live, then the new live URL syncs back to them.
  const isDeployPending = p => Boolean(p?.deployRequestedAt);
  const isOfflinePending = p => Boolean(p?.offlineRequestedAt);
  let processingDeploys = false;
  async function processDeployRequests() {
    if (!state.canDeploy || !syncEnabled || processingDeploys) return;
    processingDeploys = true;
    try {
      const pending = (await api('/api/projects')).filter(p => isDeployPending(p) || isOfflinePending(p));
      for (const p of pending) {
        if (isOfflinePending(p)) {
          try {
            const saved = await api(`/api/projects/${p.slug}/offline`, { method: 'POST' });
            if (state.current?.slug === p.slug) { replaceCurrent(saved); delete state.current.deployedHtml; }
            notify(`Took “${businessName(p)}” offline for a teammate.`);
          } catch (err) {
            await saveProjectFields(p.slug, { offlineRequestedAt: '', deployError: friendlyError(err.message) }).catch(() => {});
            notify(`Couldn’t take “${businessName(p)}” offline: ${friendlyError(err.message)}`, { sticky: false });
          }
          continue;
        }
        try {
          const html = await buildSiteHtml(p);
          const result = await api(`/api/projects/${p.slug}/deploy`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html })
          });
          if (state.current?.slug === p.slug) {
            Object.assign(state.current, { liveUrl: result.url, deployRequestedAt: '', deployError: '', deployedHtml: html });
          }
          notify(`Published “${businessName(p)}” for a teammate — ${result.url}`);
        } catch (err) {
          await saveProjectFields(p.slug, { deployRequestedAt: '', deployError: friendlyError(err.message) }).catch(() => {});
          notify(`Couldn’t publish “${businessName(p)}”: ${friendlyError(err.message)}`, { sticky: false });
        }
      }
      if (pending.length) {
        state.projects = await api('/api/projects');
        renderLiveActions();
      }
    } catch { /* best-effort — next tick tries again */ } finally {
      processingDeploys = false;
    }
  }
  api('/api/can-deploy').then(r => { state.canDeploy = r.canDeploy; renderLiveActions(); }).catch(() => {});
  setInterval(processDeployRequests, 10000);

  async function renderPreview(opts = {}) {
    if (!state.current || !state.current.raw?.name) {
      // Nothing to preview yet (e.g. a brand-new blank project) — clear
      // it out rather than leaving the previously open site's preview on
      // screen looking like it belongs to this one.
      el.preview.srcdoc = '';
      delete el.preview.dataset.lastHtml;
      renderLiveActions();
      return;
    }
    const slug = state.current.slug;
    try {
      const html = await buildSiteHtml(state.current);
      if (state.current?.slug !== slug) return; // project switched mid-render
      if (!opts.keepFrame) el.preview.srcdoc = state.editingText ? html + EDIT_SCRIPT : html;
      el.preview.dataset.lastHtml = html;
      // Freshly opening a project: whatever it currently renders is assumed
      // to match what's live, until an edit changes it.
      if (opts.seedDeployed) state.current.deployedHtml = html;
      renderLiveActions();
    } catch (err) {
      el.preview.srcdoc = `<pre style="padding:20px;font:12px monospace">${err.message}</pre>`;
    }
  }

  // The preview iframe always renders at a real desktop (or mobile) pixel
  // width AND height — a fixed device viewport, same ratio as a real
  // browser window / phone screen — then gets scaled to fit the pane.
  // The site itself can be any length; the iframe's own native scrollbar
  // handles that, exactly like scrolling a real page in a real window,
  // instead of shrinking the whole page down to see it all at once. This
  // also means full screen actually pays off: a bigger pane just means a
  // bigger, closer-to-real-size device window, not more of a tiny page
  // crammed into view.
  const DEVICE_WIDTHS = { desktop: 1440, mobile: 390 };
  const DEVICE_HEIGHTS = { desktop: 900, mobile: 844 };
  let restoreScrollY = null;
  el.preview.onload = () => {
    fitPreviewFrame();
    if (restoreScrollY !== null) {
      el.preview.contentWindow?.scrollTo(0, restoreScrollY);
      restoreScrollY = null;
    }
  };

  // ---------------- Manual text editing in the preview ----------------
  // "Edit" makes every plain text element on the generated page (headings,
  // subtitles, buttons, paragraphs) directly editable in place. Only the
  // editing aid is injected into the frame — the deployed/exported HTML
  // (dataset.lastHtml) never contains it. Edits to the business name or
  // About text write straight back to those fields; anything else is kept
  // as a from→to text override applied on top of the generated template.
  const EDIT_SCRIPT = `<style>
[data-bs-edit]{outline:1.5px dashed rgba(59,130,246,.45);outline-offset:3px;border-radius:3px;cursor:text;transition:outline-color .15s,background .15s}
[data-bs-edit]:hover{outline-color:#3B82F6;background:rgba(59,130,246,.06)}
[data-bs-edit]:focus{outline:2px solid #3B82F6;background:rgba(59,130,246,.08)}
</style><script>(()=>{
const SKIP=new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','TEXTAREA','INPUT','SELECT','OPTION','TITLE']);
document.querySelectorAll('body *').forEach(el=>{
  if(SKIP.has(el.tagName)||el.closest('svg')||el.children.length)return;
  const t=el.textContent.trim();
  if(!t)return;
  el.setAttribute('data-bs-edit','');
  el.contentEditable='plaintext-only';
  el.dataset.bsFrom=t;
});
document.addEventListener('click',e=>{if(e.target.closest('a,button'))e.preventDefault();},true);
document.addEventListener('submit',e=>e.preventDefault(),true);
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.hasAttribute&&e.target.hasAttribute('data-bs-edit')){e.preventDefault();e.target.blur();}});
document.addEventListener('focusout',e=>{
  const el=e.target;
  if(!el.hasAttribute||!el.hasAttribute('data-bs-edit'))return;
  const to=el.textContent.trim(),from=el.dataset.bsFrom;
  if(!to){el.textContent=from;return;}
  if(to!==from){parent.postMessage({type:'bs-text-edit',from,to},'*');el.dataset.bsFrom=to;}
});
})();<\/script>`;

  function applyTextOverrides(html, overrides) {
    if (!overrides?.length) return html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const leaves = [...doc.body.querySelectorAll('*')].filter(n => !n.children.length);
    for (const { from, to } of overrides) {
      leaves.forEach(n => { if (n.textContent.trim() === from) n.textContent = to; });
    }
    return (/^\s*<!doctype/i.test(html) ? '<!DOCTYPE html>\n' : '') + doc.documentElement.outerHTML;
  }

  function handleTextEdit(from, to) {
    const raw = state.current.raw || {};
    const profile = raw.businessProfile || {};
    if (raw.name && from.toLowerCase() === raw.name.trim().toLowerCase()) {
      setRaw({ name: to });
    } else if (profile.about && from === profile.about.trim()) {
      setRaw({ businessProfile: { ...profile, about: to } });
    } else {
      const list = raw.textOverrides || [];
      const chained = list.some(o => o.to === from);
      const next = chained ? list.map(o => (o.to === from ? { ...o, to } : o)) : [...list, { from, to }];
      setRaw({ textOverrides: next.filter(o => o.from !== o.to) });
    }
    // The frame already shows the new text — only refresh the deployable
    // HTML and save, without reloading the frame mid-edit.
    renderPreview({ keepFrame: true });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; persist(); }, 500);
  }

  window.addEventListener('message', e => {
    if (e.source !== el.preview.contentWindow || e.data?.type !== 'bs-text-edit' || !state.current) return;
    handleTextEdit(String(e.data.from), String(e.data.to));
  });

  function setTextEditing(on) {
    state.editingText = on;
    el.editTextBtn.classList.toggle('is-editing', on);
    el.editTextBtn.innerHTML = on ? 'Done' : `${PENCIL_ICON}Edit`;
    el.editTextBtn.title = on ? 'Finish editing text' : 'Edit text on the page';
  }
  const PENCIL_ICON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  el.editTextBtn.onclick = async () => {
    if (!el.preview.dataset.lastHtml) return;
    restoreScrollY = el.preview.contentWindow?.scrollY || 0;
    const turningOff = state.editingText;
    setTextEditing(!turningOff);
    if (turningOff) {
      await flushSave();
      renderEditor();
    }
    renderPreview();
  };

  // Padding the white frame (.preview-frame-border) adds on each side —
  // kept in sync with style.css so the scale math leaves room for it
  // instead of the frame pushing the content past the pane's edges.
  // Mobile gets a thicker top/bottom bezel than left/right (see
  // .mobile-frame in style.css), hence separate X/Y values.
  const FRAME_PAD_X = { desktop: 10, mobile: 9 };
  const FRAME_PAD_Y = { desktop: 10, mobile: 26 };

  function fitPreviewFrame() {
    if (!el.preview.dataset.lastHtml) return;
    const isMobile = state.viewport === 'mobile';
    const border = document.getElementById('previewFrameBorder');
    border.classList.toggle('mobile-frame', isMobile);
    const deviceWidth = DEVICE_WIDTHS[state.viewport] || DEVICE_WIDTHS.desktop;
    const deviceHeight = DEVICE_HEIGHTS[state.viewport] || DEVICE_HEIGHTS.desktop;
    const padX = (isMobile ? FRAME_PAD_X.mobile : FRAME_PAD_X.desktop) * 2;
    const padY = (isMobile ? FRAME_PAD_Y.mobile : FRAME_PAD_Y.desktop) * 2;
    const wrapWidth = el.previewFrameWrap.clientWidth - 32 - padX;
    const wrapHeight = el.previewFrameWrap.clientHeight - 32 - padY;
    let scale, finalHeight;
    if (!isMobile && state.desktopExpanded) {
      // "Fill the preview area" — scale by width only, then stretch the
      // device viewport's height to use all the vertical room that frees
      // up, instead of stopping at the fixed 900px device height. More of
      // the real page is visible before you need to scroll it at all.
      scale = Math.max(0.2, Math.min(1, wrapWidth / deviceWidth));
      finalHeight = wrapHeight / scale;
    } else {
      scale = Math.max(0.2, Math.min(1, wrapWidth / deviceWidth, wrapHeight / deviceHeight));
      finalHeight = deviceHeight;
    }
    el.preview.style.width = `${deviceWidth}px`;
    el.preview.style.height = `${finalHeight}px`;
    el.preview.style.transform = `scale(${scale})`;
    const box = document.getElementById('previewScaleBox');
    box.style.width = `${deviceWidth * scale}px`;
    box.style.height = `${finalHeight * scale}px`;
  }

  // A small spinner + text for "this is in progress" states, instead of
  // plain status text that looked identical to a finished/error message.
  function setLoading(el, text) {
    el.innerHTML = `<span class="status-spinner"></span>${escapeHtml(text)}`;
  }

  function escapeHtml(s) { return String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function escapeAttr(s) { return String(s || '').replace(/"/g, '&quot;'); }

  // UK-first phone → WhatsApp international format: a local "07…" number
  // becomes "447…" (WhatsApp's click-to-chat API needs digits only, no
  // leading +, no spaces) — numbers already in +44/44/other-country form
  // are left as they are, just stripped of formatting.
  function toWhatsAppNumber(phone) {
    const digits = String(phone || '').replace(/[^\d+]/g, '');
    if (!digits) return '';
    if (digits.startsWith('+')) return digits.slice(1);
    if (digits.startsWith('0')) return '44' + digits.slice(1);
    return digits;
  }

  function welcomeMessage() {
    const name = businessName(state.current);
    const url = state.current?.liveUrl;
    const firstName = String(state.current?.contact?.name || '').trim().split(/\s+/)[0];
    const hi = firstName ? `Hi ${firstName}` : 'Hi';
    return url
      ? `${hi}, thanks for chatting with us today! We've put together a website for ${name} — you can take a look here: ${url}\n\nAny questions at all, just let me know.`
      : `${hi}, thanks for chatting with us today! We'd love to help ${name} with a brand new website — any questions at all, just let me know.`;
  }

  function openWhatsApp(phone) {
    const number = toWhatsAppNumber(phone);
    if (!number) return notify('Add a phone number first.', { sticky: false });
    openExternal(`https://wa.me/${number}?text=${encodeURIComponent(welcomeMessage())}`);
  }

  function openEmail(email) {
    const to = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+$/.test(to)) return notify('Add an email address first.', { sticky: false });
    const subject = `A website for ${businessName(state.current)}`;
    openExternal(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(welcomeMessage())}`);
  }

  // Electron's renderer blocks window.open() for new windows by default
  // (no window-open handler configured), so external links are opened via
  // the main process's shell.openExternal instead — same real system
  // browser a person would expect.
  function openExternal(url) {
    api('/api/open-external', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url })
    }).catch(err => notify(err.message, { sticky: false }));
  }

  // Reflects state.viewport onto the toggle buttons + expand indicator.
  // Full screen is desktop-only, so switching into it while on mobile
  // routes through here too, to force the view back to desktop.
  function setViewport(viewport) {
    state.viewport = viewport;
    el.viewportToggle.querySelectorAll('button[data-viewport]').forEach(b => b.classList.toggle('active', b.dataset.viewport === viewport));
    el.desktopExpandIndicator.classList.toggle('on-mobile', viewport !== 'desktop');
    el.desktopExpandIndicator.classList.toggle('expanded', state.desktopExpanded);
  }

  // "Full screen" expands the preview to fill the app window itself
  // (hiding the sidebar/editor) rather than taking over the whole Mac
  // display — a real OS-level fullscreen felt jarring for a quick preview.
  // It only ever shows the desktop ratio, so entering it while mobile
  // view is selected switches back to desktop first.
  const EXPAND_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  const CONTRACT_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  el.fullscreenBtn.onclick = () => {
    if (!el.preview.dataset.lastHtml) return;
    state.appFullscreen = !state.appFullscreen;
    if (state.appFullscreen && state.viewport !== 'desktop') setViewport('desktop');
    document.querySelector('.layout').classList.toggle('preview-fullscreen', state.appFullscreen);
    el.fullscreenBtn.innerHTML = state.appFullscreen ? CONTRACT_ICON : EXPAND_ICON;
    el.fullscreenBtn.title = state.appFullscreen ? 'Exit full screen' : 'Full screen';
    fitPreviewFrame();
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.appFullscreen) el.fullscreenBtn.onclick();
  });
  el.closePreviewBtn.onclick = () => closeCurrentProject();
  // The desktop button doubles as the "fill full length" toggle: clicking
  // it while desktop view is already active flips between the default
  // device ratio and filling all available vertical space, rather than
  // that living on a separate control. The chevron to its left is a
  // read-only indicator of which state you're in — only app-level full
  // screen (el.fullscreenBtn) already fills everything, so this toggle
  // is inert while that's active to avoid the two fighting each other.
  el.viewportToggle.addEventListener('click', e => {
    const btn = e.target.closest('button[data-viewport]');
    if (!btn) return;
    const clickedViewport = btn.dataset.viewport;
    const alreadyOnDesktop = state.viewport === 'desktop' && clickedViewport === 'desktop';
    if (alreadyOnDesktop) {
      if (!state.appFullscreen) state.desktopExpanded = !state.desktopExpanded;
    } else if (clickedViewport === 'desktop') {
      // Desktop view always starts expanded by default (mirrors the
      // initial state), whether that's the first switch back from mobile
      // or any later one — only an explicit second click collapses it.
      state.desktopExpanded = true;
    }
    setViewport(clickedViewport);
    fitPreviewFrame();
  });
  window.addEventListener('resize', fitPreviewFrame);
  el.exportBtn.onclick = async () => {
    if (!state.current || !el.preview.dataset.lastHtml) return alert('Nothing to export yet.');
    const result = await api(`/api/projects/${state.current.slug}/export`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: el.preview.dataset.lastHtml })
    });
    notify('Website exported and ready to send.');
    alert(`Exported to:\n${result.path}`);
  };
  el.copyLiveBtn.onclick = async () => {
    const liveUrl = state.current?.liveUrl;
    if (!liveUrl) return;
    try {
      await navigator.clipboard.writeText(liveUrl);
      notify('Live website link copied — ready to send.');
    } catch {
      notify(`Live at ${liveUrl}`, { sticky: true });
    }
  };
  el.deployBtn.onclick = async () => {
    // Green already means "live and matching what's on screen" — clicking
    // it then opens the site instead of redeploying something unchanged.
    // Red/amber (never deployed, or deployed but stale) still deploy.
    if (el.deployBtn.classList.contains('status-live') && state.current?.liveUrl) {
      return openExternal(state.current.liveUrl);
    }
    if (!state.current || !el.preview.dataset.lastHtml) return alert('Nothing to deploy yet.');
    // No Vercel on this computer: hand it to a copy that has it, via the
    // shared data (see processDeployRequests below).
    if (!state.canDeploy) {
      if (!syncEnabled) return notify('Can’t send this to go live — shared sync is off.', { sticky: false });
      if (isDeployPending(state.current)) return notify('Already waiting to go live.', { sticky: false });
      state.current.deployRequestedAt = new Date().toISOString();
      state.current.deployError = '';
      await persist();
      return notify('Sent to go live — it publishes from the admin’s computer while their app is open.');
    }
    el.deployBtn.disabled = true;
    el.deployBtn.innerHTML = `<span class="status-spinner light"></span>Deploying…`;
    el.deployBtn.classList.remove('status-not-live', 'status-live', 'status-needs-update');
    el.deployBtn.classList.add('status-deploying');
    try {
      const result = await api(`/api/projects/${state.current.slug}/deploy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: el.preview.dataset.lastHtml })
      });
      state.current.liveUrl = result.url;
      state.current.deployedHtml = el.preview.dataset.lastHtml;
      try { await navigator.clipboard.writeText(result.url); } catch { /* clipboard may be unavailable */ }
      notify(`Live at ${result.url} (copied to clipboard).`, { sticky: true });
    } catch (err) {
      notify(friendlyError(err.message), { sticky: false });
    } finally {
      el.deployBtn.disabled = false;
      renderLiveActions();
    }
  };

  // A site can go offline outside this app (removed in Vercel, or taken
  // offline from another computer) — so the open site's live URL is
  // re-checked when it's opened and every minute, and the button drops
  // back to red "Make live" if it's gone.
  async function checkLive() {
    const slug = state.current?.slug;
    if (!slug || !state.current.liveUrl || el.deployBtn.disabled) return;
    try {
      const checked = await api(`/api/projects/${slug}/check-live`, { method: 'POST' });
      if (!checked.liveUrl && state.current?.slug === slug && state.current.liveUrl) {
        replaceCurrent(checked);
        delete state.current.deployedHtml;
        renderLiveActions();
        notify('This site is offline — click Make live to put it back up.');
      }
    } catch { /* best-effort */ }
  }
  setInterval(checkLive, 60000);

  el.offlineBtn.onclick = async () => {
    if (!state.current?.liveUrl) return;
    const ok = await showConfirm(`Take “${businessName(state.current)}” offline?`,
      'The live link stops working until you make it live again — it comes back on the same link.', 'Take offline');
    if (!ok) return;
    if (!state.canDeploy) {
      if (!syncEnabled) return notify('Can’t send this — shared sync is off.', { sticky: false });
      state.current.offlineRequestedAt = new Date().toISOString();
      await persist();
      renderLiveActions();
      return notify('Sent — it goes offline from the admin’s computer while their app is open.');
    }
    el.offlineBtn.disabled = true;
    el.offlineBtn.innerHTML = '<span class="status-spinner"></span>Taking offline…';
    try {
      replaceCurrent(await api(`/api/projects/${state.current.slug}/offline`, { method: 'POST' }));
      delete state.current.deployedHtml;
      notify('Site taken offline.');
    } catch (err) {
      notify(friendlyError(err.message), { sticky: false });
    } finally {
      el.offlineBtn.disabled = false;
      renderLiveActions();
    }
  };

  // ---------------- version + app updates ----------------
  // The version shows everywhere, including colleagues on the plain browser
  // at localhost:4173. The update button only exists inside the installed
  // app, where preload.js exposes window.brightsiteUpdates.
  api('/api/app-info').then(info => {
    el.appVersion.textContent = `v${info.version}`;
    el.appVersion.hidden = false;
  }).catch(() => {});

  const updates = window.brightsiteUpdates;
  let upToDateTimer = null;
  let updateState = null;
  function renderUpdateState(s) {
    const btn = el.updateBtn;
    updateState = s;
    clearTimeout(upToDateTimer);
    btn.hidden = !s || s.status === 'dev';
    if (btn.hidden) return;
    btn.disabled = s.status === 'checking' || s.status === 'downloading';
    // 'available' = newer version out, but this build can't install it
    // itself (a Mac without a Developer ID signature) — offer the download.
    btn.classList.toggle('is-ready', s.status === 'ready' || s.status === 'available');
    btn.classList.toggle('is-error', s.status === 'error');
    btn.title = s.status === 'error' ? `Last check failed: ${s.message || 'unknown error'}`
      : s.status === 'available' ? 'Opens the download page — this Mac can’t install updates automatically yet.' : '';
    const labels = {
      idle: 'Check for updates',
      checking: 'Checking…',
      downloading: `Downloading${s.newVersion ? ` v${s.newVersion}` : ''} ${s.percent || 0}%`,
      ready: `Restart to update${s.newVersion ? ` to v${s.newVersion}` : ''}`,
      available: `Download v${s.newVersion || 'update'}`,
      'up-to-date': 'Up to date ✓',
      error: 'Update failed — retry'
    };
    btn.innerHTML = (btn.disabled ? '<span class="status-spinner"></span>' : '') + escapeHtml(labels[s.status] || labels.idle);
    // "Up to date" is a confirmation, not a resting state — fall back to
    // the check button after a moment.
    if (s.status === 'up-to-date') upToDateTimer = setTimeout(() => renderUpdateState({ ...s, status: 'idle' }), 5000);
  }
  if (updates) {
    updates.getState().then(renderUpdateState).catch(() => {});
    updates.onState(renderUpdateState);
    el.updateBtn.onclick = () => {
      const status = updateState?.status;
      if (status === 'ready') {
        el.updateBtn.disabled = true;
        el.updateBtn.textContent = 'Restarting…';
        updates.install();
      } else if (status === 'available') {
        updates.openDownload();
      } else {
        updates.check().then(renderUpdateState).catch(() => {});
      }
    };
  }

  // ---------------- Sales stages + Live & Paying ----------------
  // Both tabs are pure views over the same project records the Businesses
  // tab edits (one data.json per business, synced by lib/supabase-sync.js),
  // reading and writing the fields that already exist on them:
  // pipelineStage, contact.email, raw.businessProfile.phone, notes, price,
  // paymentStatus and liveUrl. Nothing here creates a second record.
  const SALES_STAGES = [
    ['uncontacted', 'Uncontacted'],
    ['called', 'Called'],
    ['follow_up', 'Follow-up needed'],
    ['interested', 'Interested'],
    ['demo_sent', 'Demo sent'],
    ['not_interested', 'Not interested']
  ];
  const PAYMENT_STATUSES = [['no', 'Not paying'], ['pending', 'Pending'], ['paid', 'Paid']];

  const stageLabel = id => (SALES_STAGES.find(([s]) => s === id) || [])[1] || 'Uncontacted';
  const paymentLabel = id => (PAYMENT_STATUSES.find(([s]) => s === id) || [])[1] || 'Not paying';

  // Records created before these stages existed (or with no stage at all)
  // count as uncontacted, so nothing needs migrating on disk.
  function stageOf(p) {
    const stage = p.pipelineStage;
    return SALES_STAGES.some(([id]) => id === stage) ? stage : 'uncontacted';
  }
  const businessName = p => p.raw?.name || p.name || p.slug;
  const phoneOf = p => p.raw?.businessProfile?.phone || p.contact?.phone || '';
  // Paying is what puts a business on the Live tab — with or without a site
  // built here (customers can be added straight onto that tab).
  const isLivePaying = p => p.paymentStatus === 'paid';
  const websiteOf = p => p.liveUrl || p.contact?.existingWebsite || '';

  // Only prices that are actually a number contribute to the monthly
  // total — an agreed price written as free text ("TBC", "£50 + VAT") still
  // shows on its row, it just can't be summed.
  function monthlyValue(p) {
    const amount = parseFloat(String(p.price ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(amount) ? amount : 0;
  }

  // Saves a patch against any business by slug (not just the open one, the
  // way persist() does). Goes through the same PUT the Businesses tab uses,
  // so it saves locally first and pushes through Supabase sync exactly the
  // same way.
  async function saveProjectFields(slug, patch) {
    const saved = await api(`/api/projects/${slug}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    });
    const idx = state.projects.findIndex(p => p.slug === slug);
    if (idx !== -1) state.projects[idx] = saved;
    // Keep the Businesses tab's in-memory copy in step, so its next save
    // can't overwrite what was just changed here with a stale object.
    if (state.current?.slug === slug) replaceCurrent(saved);
    return saved;
  }

  function projectBySlug(slug) {
    return state.projects.find(p => p.slug === slug) || null;
  }

  function renderLive() {
    const paying = state.projects.filter(isLivePaying);
    const total = paying.reduce((sum, p) => sum + monthlyValue(p), 0);
    el.liveTotals.innerHTML = `
      <div class="live-stat"><b>${paying.length}</b><span>paying customer${paying.length === 1 ? '' : 's'}</span></div>
      <div class="live-stat"><b>£${total.toFixed(2).replace(/\.00$/, '')}</b><span>total monthly value</span></div>
      <button type="button" class="crm-save live-add-btn" data-add-customer ${state.liveAdding ? 'hidden' : ''}>+ Add customer</button>`;
    const form = state.liveAdding ? `
      <form class="crm-row live-add-form" id="liveAddForm">
        <div class="live-add-grid">
          <div class="field"><label>Business name</label><input name="name" required></div>
          <div class="field"><label>Monthly price</label><input name="price" placeholder="e.g. 45"></div>
          <div class="field"><label>Website (optional)</label><input name="website" placeholder="https://…"></div>
        </div>
        <button type="submit" class="crm-save">Add customer</button>
        <button type="button" class="crm-move" data-cancel-add>Cancel</button>
      </form>` : '';
    el.liveList.innerHTML = form + (paying.length ? paying.map(p => `
      <div class="crm-row live-row">
        <div class="crm-row-main">
          <span class="crm-name">${escapeHtml(businessName(p))}</span>
          <span class="crm-stage stage-paid">Paying</span>
        </div>
        <div class="crm-row-meta">
          <span class="live-price">${p.price ? escapeHtml(String(p.price).replace(/^£?/, '£')) + ' /mo' : 'No price set'}</span>
          ${websiteOf(p) ? `<span class="crm-dim live-url">${escapeHtml(websiteOf(p))}</span>` : '<span class="crm-dim">No website yet</span>'}
        </div>
        ${p.notes ? `<div class="crm-row-note">${escapeHtml(p.notes.trim().replace(/\s+/g, ' '))}</div>` : ''}
        <div class="crm-row-actions">
          <button type="button" class="crm-move" data-edit="${escapeAttr(p.slug)}">Edit website</button>
          ${websiteOf(p) ? `<button type="button" class="crm-move" data-open="${escapeAttr(websiteOf(p))}">Open site ↗</button>` : ''}
          <button type="button" class="crm-move crm-move-quiet" data-unpay="${escapeAttr(p.slug)}">Not paying any more</button>
          <button type="button" class="crm-delete" data-delete="${escapeAttr(p.slug)}" title="Delete this customer">✕</button>
        </div>
      </div>`).join('')
      : (state.liveAdding ? '' : `<p class="crm-empty">No paying customers yet. Click “+ Add customer”, or set “Paying?” to Paid on a business in the Businesses tab.</p>`));
    if (state.liveAdding) el.liveList.querySelector('input[name="name"]').focus();
  }

  el.liveTotals.addEventListener('click', e => {
    if (e.target.closest('[data-add-customer]')) { state.liveAdding = true; renderLive(); }
  });

  el.liveList.addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.open) return openExternal(btn.dataset.open);
    if (btn.dataset.edit) {
      await switchTab('businesses');
      return selectProject(btn.dataset.edit);
    }
    if ('cancelAdd' in btn.dataset) { state.liveAdding = false; return renderLive(); }
    if (btn.dataset.delete) {
      const p = projectBySlug(btn.dataset.delete);
      return deleteProject(btn.dataset.delete, p ? businessName(p) : btn.dataset.delete);
    }
    if (btn.dataset.unpay) {
      btn.disabled = true;
      try {
        // Goes back to wherever it was before (database or calling list).
        await saveProjectFields(btn.dataset.unpay, { paymentStatus: 'no' });
        renderLive();
      } catch (err) {
        notify(friendlyError(err.message), { sticky: false });
        btn.disabled = false;
      }
    }
  });

  // A customer added here is an ordinary business record, just created as
  // paying — so it also shows in the Businesses tab and syncs like any other.
  // Their existing website goes in contact.existingWebsite, not liveUrl, so
  // the builder never mistakes it for a site it deployed.
  el.liveList.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    if (!name) return;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const created = await api('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
      });
      const website = String(data.get('website') || '').trim();
      await saveProjectFields(created.slug, {
        paymentStatus: 'paid',
        price: String(data.get('price') || '').trim(),
        contact: { ...(created.contact || {}), existingWebsite: website }
      });
      state.liveAdding = false;
      await loadProjects();
      renderLive();
      notify(`Added "${name}" as a paying customer.`);
    } catch (err) {
      notify(friendlyError(err.message), { sticky: false });
      submit.disabled = false;
    }
  });

  // Switching tabs only shows/hides views — the builder view keeps its DOM
  // (and so its editor state, preview iframe and scroll position) exactly
  // as it was. Any debounced edit still pending is flushed first so a tab
  // change can never drop it.
  async function switchTab(tab) {
    if (state.tab === tab) return;
    if (state.tab === 'businesses') await flushSave();
    state.tab = tab;
    document.querySelectorAll('.tab-switch button[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    el.builderView.hidden = tab !== 'businesses';
    el.liveView.hidden = tab !== 'live';
    if (tab === 'live') {
      // Pull anything teammates changed elsewhere before showing a list
      // that's all about shared status.
      await loadProjects();
      renderLive();
    } else {
      fitPreviewFrame();
    }
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.tab-switch button[data-tab]');
    if (btn) switchTab(btn.dataset.tab);
  });

  loadProjects().then(() => { renderEditor(); renderLiveActions(); });
})();
