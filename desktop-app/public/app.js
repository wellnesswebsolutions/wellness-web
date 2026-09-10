(() => {
  const state = { projects: [], current: null, found: {}, dirty: false, sort: 'newest', viewport: 'desktop', appFullscreen: false };

  const el = {
    projectList: document.getElementById('projectList'),
    newProjectBtn: document.getElementById('newProjectBtn'),
    sortSelect: document.getElementById('sortSelect'),
    editor: document.getElementById('editor'),
    preview: document.getElementById('preview'),
    previewFrameWrap: document.getElementById('previewFrameWrap'),
    viewportToggle: document.getElementById('viewportToggle'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    exportBtn: document.getElementById('exportBtn'),
    deployBtn: document.getElementById('deployBtn'),
    copyLiveBtn: document.getElementById('copyLiveBtn'),
    closePreviewBtn: document.getElementById('closePreviewBtn'),
    notice: document.getElementById('noticeStrip'),
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
  async function refreshSyncStatus() {
    try {
      const s = await api('/api/sync-status');
      if (s.state === 'disabled') { el.syncStatus.hidden = true; return; }
      el.syncStatus.hidden = false;
      el.syncStatus.className = `sync-status is-${s.state}`;
      el.syncStatusText.textContent = SYNC_LABELS[s.state] || s.state;
      el.syncTooltipUrl.textContent = s.projectUrl || '';
    } catch { /* status is best-effort, never block the app on it */ }
  }
  refreshSyncStatus();
  setInterval(refreshSyncStatus, 5000);

  let noticeTimer = null;
  function notify(text, opts = {}) {
    clearTimeout(noticeTimer);
    el.notice.textContent = text;
    el.notice.hidden = false;
    if (!opts.sticky) noticeTimer = setTimeout(() => (el.notice.hidden = true), 4500);
  }

  el.gearBtn.onclick = () => { el.settingsDialog.showModal(); refreshSignInStatus(); };
  el.closeSettingsBtn.onclick = () => el.settingsDialog.close();

  // Electron's renderer doesn't implement window.prompt() (it silently
  // returns null), so a plain `prompt()` call does nothing when clicked —
  // these two dialogs replace prompt()/confirm() with real, reliable UI.
  const promptDialog = document.getElementById('promptDialog');
  const promptInput = document.getElementById('promptInput');
  function showPrompt(title, placeholder) {
    return new Promise(resolve => {
      document.getElementById('promptTitle').textContent = title;
      promptInput.placeholder = placeholder || '';
      promptInput.value = '';
      promptDialog.showModal();
      setTimeout(() => promptInput.focus(), 50);
      const cleanup = value => { promptDialog.close(); resolve(value); };
      document.getElementById('promptOkBtn').onclick = () => cleanup(promptInput.value.trim() || null);
      document.getElementById('promptCancelBtn').onclick = () => cleanup(null);
      promptInput.onkeydown = e => { if (e.key === 'Enter') cleanup(promptInput.value.trim() || null); };
    });
  }

  const confirmDialog = document.getElementById('confirmDialog');
  function showConfirm(title, message) {
    return new Promise(resolve => {
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message || '';
      confirmDialog.showModal();
      const cleanup = value => { confirmDialog.close(); resolve(value); };
      document.getElementById('confirmOkBtn').onclick = () => cleanup(true);
      document.getElementById('confirmCancelBtn').onclick = () => cleanup(false);
    });
  }
  async function refreshSignInStatus() {
    try {
      const status = await api('/api/sign-in-status');
      const fb = document.getElementById('fbSignInStatus');
      const google = document.getElementById('googleSignInStatus');
      fb.textContent = status.facebook ? '✓ Signed in' : 'Not signed in';
      fb.classList.toggle('is-signed-in', status.facebook);
      google.textContent = status.google ? '✓ Signed in' : 'Not signed in';
      google.classList.toggle('is-signed-in', status.google);
    } catch { /* status is best-effort */ }
  }

  document.getElementById('signInFacebookBtn').onclick = async () => {
    await api('/api/sign-in', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'facebook' })
    }).catch(err => notify(err.message, { sticky: false }));
    setTimeout(refreshSignInStatus, 4000);
  };
  document.getElementById('signInGoogleBtn').onclick = async () => {
    await api('/api/sign-in', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'google' })
    }).catch(err => notify(err.message, { sticky: false }));
    setTimeout(refreshSignInStatus, 4000);
  };

  // ---------------- projects ----------------
  async function loadProjects() {
    state.projects = await api('/api/projects');
    renderSidebar();
    refreshSyncStatus();
  }

  function sortedProjects() {
    const list = state.projects.slice();
    if (state.sort === 'name') {
      list.sort((a, b) => (a.raw?.name || a.name || '').localeCompare(b.raw?.name || b.name || ''));
    } else if (state.sort === 'oldest') {
      list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    } else {
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
    return list;
  }

  function renderSidebar() {
    el.projectList.innerHTML = '';
    sortedProjects().forEach(p => {
      const row = document.createElement('div');
      row.className = 'project' + (state.current && state.current.slug === p.slug ? ' active' : '');
      const name = document.createElement('span');
      name.className = 'project-name';
      name.textContent = p.raw?.name || p.name || p.slug;
      const del = document.createElement('button');
      del.className = 'project-delete';
      del.title = 'Delete this site';
      del.textContent = '✕';
      del.onclick = e => { e.stopPropagation(); deleteProject(p.slug, name.textContent); };
      row.append(name, del);
      // Clicking the already-open site again closes it back to the start screen.
      row.onclick = () => {
        if (state.current?.slug === p.slug) closeCurrentProject();
        else selectProject(p.slug);
      };
      el.projectList.appendChild(row);
    });
  }

  el.sortSelect.onchange = () => { state.sort = el.sortSelect.value; renderSidebar(); };

  async function deleteProject(slug, displayName) {
    const ok = await showConfirm(`Delete "${displayName}"?`, "This removes its files permanently and can't be undone.");
    if (!ok) return;
    try {
      await api(`/api/projects/${slug}`, { method: 'DELETE' });
      if (state.current?.slug === slug) {
        state.current = null;
        state.found = {};
      }
      await loadProjects();
      renderEditor();
      renderPreview();
      renderLiveActions();
      el.preview.srcdoc = state.current ? el.preview.srcdoc : '';
      notify(`Deleted "${displayName}".`);
    } catch (err) {
      notify(err.message, { sticky: false });
    }
  }

  async function selectProject(slug) {
    state.current = await api(`/api/projects/${slug}`);
    state.found = {};
    state.dirty = false;
    if (state.current.importImages?.length) state.found.hero = state.current.importImages[0];
    renderSidebar();
    renderEditor();
    renderPreview();
    renderLiveActions();
  }

  function closeCurrentProject() {
    state.current = null;
    state.found = {};
    state.dirty = false;
    renderSidebar();
    renderEditor();
    el.preview.srcdoc = '';
    delete el.preview.dataset.lastHtml;
    renderLiveActions();
  }

  // Shows a "copy site URL" button and switches the deploy button's label/
  // colour once a site has a live URL — the button itself always still
  // triggers a fresh deploy (pushing edits live). Colour is a simple
  // traffic light: red = never deployed, amber = live but edited since
  // (needs updating), green = live and matches what's currently shown.
  function renderLiveActions() {
    const liveUrl = state.current?.liveUrl;
    const needsUpdate = Boolean(liveUrl) && state.dirty;
    el.deployBtn.textContent = liveUrl ? 'Update live site' : 'Make live';
    el.deployBtn.classList.remove('status-not-live', 'status-deploying', 'status-live', 'status-needs-update');
    el.deployBtn.classList.add(!liveUrl ? 'status-not-live' : needsUpdate ? 'status-needs-update' : 'status-live');
    el.copyLiveBtn.hidden = !liveUrl;
  }

  async function persist() {
    if (!state.current) return;
    state.dirty = true;
    state.current = await api(`/api/projects/${state.current.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.current)
    });
    renderLiveActions();
    loadProjects();
  }

  function setRaw(patch) {
    state.current.raw = { ...state.current.raw, ...patch };
  }

  function aiBadge(field) {
    return state.current.aiFilled?.includes(field) ? '<span class="badge-ai">AI</span>' : '';
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

  // ---------------- start screen (no project selected) ----------------
  function renderStartScreen() {
    el.editor.innerHTML = `
      <div class="start-screen">
        <img src="/generator/img/brightsite-logo.png" alt="BrightSite" class="start-logo">
        <div class="link-bar">
          <input id="startLink" type="text" placeholder="Paste a Facebook or Google Maps link…">
          <button id="startBuildBtn">Build website</button>
        </div>
        <div class="import-status" id="startStatus"></div>
      </div>
    `;
    document.getElementById('startBuildBtn').onclick = runQuickImport;
    document.getElementById('startLink').onkeydown = e => { if (e.key === 'Enter') runQuickImport(); };
  }

  function splitLinks(text) {
    const urls = (text.match(/https?:\/\/\S+/g) || []).map(u => u.trim());
    return [urls[0], urls[1]];
  }

  async function runQuickImport() {
    const [url, url2] = splitLinks(document.getElementById('startLink').value.trim());
    const status = document.getElementById('startStatus');
    const btn = document.getElementById('startBuildBtn');
    if (!url && !url2) return;
    btn.disabled = true;
    setLoading(status, 'Reading the page…');
    try {
      const project = await api('/api/quick-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, url2 })
      });
      await loadProjects();
      await selectProject(project.slug);
      notify(`Built a site for ${project.raw?.name || 'this business'}.`);
    } catch (err) {
      showTempStatus(status, friendlyError(err.message));
      notify(friendlyError(err.message), { sticky: false });
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------- Builder editor ----------------
  function renderEditor() {
    document.querySelector('.layout').classList.toggle('no-project', !state.current);
    if (!state.current) return renderStartScreen();
    const raw = state.current.raw || {};
    const profile = raw.businessProfile || {};

    el.editor.innerHTML = `
      <div class="link-bar compact">
        <input id="f_link" type="text" placeholder="Paste a Facebook or Google Maps link…" value="${escapeAttr(state.current.lastImportUrl || state.current.contact?.facebookUrl || profile.mapsUrl || '')}">
        <button id="importBtn">Re-fetch</button>
      </div>
      <div class="import-status" id="importStatus"></div>

      <div class="form-grid">
        <div class="field"><label>Name</label>
          <input id="f_name" value="${escapeAttr(raw.name || '')}"></div>
        <div class="field"><label>Category</label>
          <select id="f_category">${categoryOptions(raw.tagline)}</select></div>
      </div>
      <div class="phone-row">
        <div class="field"><label>Phone</label>
          <input id="f_phone" value="${escapeAttr(profile.phone || '')}"></div>
        <div class="field"><label>Email</label>
          <input id="f_email" type="email" value="${escapeAttr(state.current.contact?.email || '')}"></div>
        <button id="whatsappBtn" class="whatsapp-btn" title="Open WhatsApp chat with this number" aria-label="Open WhatsApp">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-1-.3-.1-.5-.1-.6.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.3-.4.1-.2 0-.3 0-.5s-.6-1.5-.9-2c-.2-.5-.5-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2.1 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.6.2-1.2.2-1.3-.1-.2-.3-.2-.6-.4z"/><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>
        </button>
      </div>
      <div class="field"><label>Location / address</label>
        <input id="f_location" value="${escapeAttr(profile.address || raw.location || '')}"></div>
      <div class="field"><label>About ${aiBadge('about')}</label>
        <textarea id="f_about">${escapeHtml(profile.about || '')}</textarea></div>

      <div class="media-row-3">
        ${mediaSlot('logo', 'Logo')}
        ${mediaSlot('hero', 'Hero image')}
        <div class="media-slot" data-slot="gallery">
          <label>Gallery</label>
          <div class="gallery-grid" id="galleryGrid">${galleryThumbs()}</div>
          <div class="actions"><button id="galleryUploadBtn">+ Add</button></div>
          <input type="file" id="galleryUpload" accept="image/*" multiple hidden>
        </div>
      </div>

      <div class="field"><label>Template</label>
        <div class="template-grid-6" id="templateGrid">${templateOptions(raw.layout)}</div></div>

      <div class="ai-edit-box">
        <label>Edit with AI</label>
        <textarea id="aiInstruction" placeholder="e.g. Make the about section warmer and mention it's family-run"></textarea>
        <button id="aiEditBtn">Apply edit</button>
        <div class="ai-edit-status" id="aiEditStatus"></div>
        ${editLogHtml()}
      </div>
    `;

    document.getElementById('importBtn').onclick = runImport;
    document.getElementById('f_name').oninput = e => { setRaw({ name: e.target.value }); schedulePreview(); };
    document.getElementById('f_category').onchange = e => { setRaw({ tagline: e.target.value }); schedulePreview(); };
    document.getElementById('f_phone').oninput = e => { setRaw({ businessProfile: { ...profile, phone: e.target.value } }); schedulePreview(); };
    document.getElementById('f_email').oninput = e => {
      state.current.contact = { ...(state.current.contact || {}), email: e.target.value };
      persist();
    };
    document.getElementById('whatsappBtn').onclick = () => openWhatsApp(document.getElementById('f_phone').value);
    document.getElementById('f_location').oninput = e => {
      setRaw({ location: e.target.value, businessProfile: { ...profile, address: e.target.value } });
      schedulePreview();
    };
    document.getElementById('f_about').oninput = e => { setRaw({ businessProfile: { ...profile, about: e.target.value } }); schedulePreview(); };
    document.getElementById('templateGrid').addEventListener('click', e => {
      const tile = e.target.closest('.template-tile');
      if (!tile) return;
      setRaw({ layout: tile.dataset.layout });
      document.querySelectorAll('.template-tile').forEach(t => t.classList.toggle('selected', t === tile));
      schedulePreview();
    });
    document.getElementById('galleryUploadBtn').onclick = () => document.getElementById('galleryUpload').click();
    document.getElementById('galleryUpload').addEventListener('change', e => uploadGallery(e.target.files));
    document.getElementById('aiEditBtn').onclick = runAiEdit;
    document.querySelectorAll('.edit-log .undo').forEach(btn => (btn.onclick = () => undoEdit(Number(btn.dataset.i))));
    document.querySelectorAll('.gallery-grid .thumb-remove').forEach(btn => (btn.onclick = () => removeGalleryItem(Number(btn.dataset.i))));
    wireMediaSlot('logo');
    wireMediaSlot('hero');
  }

  function editLogHtml() {
    const log = state.current.editLog || [];
    if (!log.length) return '';
    return `<div class="edit-log">${log.slice().reverse().map((entry, idx) => {
      const i = log.length - 1 - idx;
      return `<div class="entry">"${escapeHtml(entry.instruction)}" <button class="undo" data-i="${i}">Undo</button></div>`;
    }).join('')}</div>`;
  }

  async function runAiEdit() {
    const instruction = document.getElementById('aiInstruction').value.trim();
    const status = document.getElementById('aiEditStatus');
    const btn = document.getElementById('aiEditBtn');
    if (!instruction) return;
    btn.disabled = true;
    setLoading(status, 'Asking Claude Code…');
    try {
      const updated = await api(`/api/projects/${state.current.slug}/ai-edit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instruction })
      });
      state.current = updated;
      state.dirty = true;
      status.textContent = 'Edit applied — you can undo it below if it\'s not right.';
      renderEditor();
      renderPreview();
      renderLiveActions();
    } catch (err) {
      showTempStatus(status, friendlyError(err.message));
    } finally {
      btn.disabled = false;
    }
  }

  async function undoEdit(index) {
    const log = state.current.editLog || [];
    const entry = log[index];
    if (!entry) return;
    // Restore the exact pre-edit values captured server-side when the
    // edit was applied (see server.js /ai-edit), rather than just
    // clearing the touched fields.
    const restoredRaw = { ...state.current.raw, ...(entry.beforeFields || {}) };
    if (entry.beforeProfile && Object.keys(entry.beforeProfile).length) {
      restoredRaw.businessProfile = { ...(restoredRaw.businessProfile || {}), ...entry.beforeProfile };
    }
    const newLog = log.filter((_, i) => i !== index);
    state.current.raw = restoredRaw;
    state.current.editLog = newLog;
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
    return `
      <div class="media-slot" data-slot="${slot}">
        <label>${label}</label>
        <div class="thumb" ${thumbStyle}>${path ? `<button class="thumb-remove" data-action="remove" title="Remove">✕</button>` : ''}</div>
        ${autoHeroHint}
        <div class="actions">
          <button data-action="upload">${path ? 'Replace' : 'Upload'}</button>
          ${found ? `<button data-action="use-found" class="found">Use found</button>` : ''}
        </div>
        <input type="file" accept="image/*" style="display:none">
      </div>`;
  }

  function galleryThumbs() {
    const gallery = state.current.raw?.gallery || [];
    return gallery.map((g, i) => `<div class="thumb" style="background-image:url('/projects/${state.current.slug}/${g}')"><button class="thumb-remove" data-i="${i}" title="Remove">✕</button></div>`).join('')
      || '<span class="gallery-empty">No gallery images yet.</span>';
  }

  function wireMediaSlot(slot) {
    const wrap = document.querySelector(`.media-slot[data-slot="${slot}"]`);
    if (!wrap) return;
    const fileInput = wrap.querySelector('input[type=file]');
    wrap.querySelector('[data-action="upload"]').onclick = () => fileInput.click();
    fileInput.onchange = () => uploadMedia(slot, fileInput.files[0]);
    const useFound = wrap.querySelector('[data-action="use-found"]');
    if (useFound) useFound.onclick = () => useFoundImage(slot);
    const remove = wrap.querySelector('[data-action="remove"]');
    if (remove) remove.onclick = e => { e.stopPropagation(); removeMedia(slot); };
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

  let previewTimer = null;
  function schedulePreview() {
    persist();
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 150);
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

  async function renderPreview() {
    if (!state.current || !state.current.raw?.name) return;
    const raw = projectMediaAbsolute(state.current.raw, state.current.slug);
    if (!raw.heroImage) {
      const auto = await composeAutoHero(state.current.raw, state.current.slug);
      if (auto) raw.heroImage = auto;
    }
    if (state.current !== null && raw.name !== state.current.raw?.name) return; // project switched mid-render
    try {
      const html = buildDemoHTML(raw);
      el.preview.srcdoc = html;
      el.preview.dataset.lastHtml = html;
    } catch (err) {
      el.preview.srcdoc = `<pre style="padding:20px;font:12px monospace">${err.message}</pre>`;
    }
  }

  // The preview iframe always renders at a real desktop (or mobile) pixel
  // width — same as a real visitor would see — then gets scaled down to
  // fit the pane. Without this, a narrow pane would trigger the generated
  // site's own mobile CSS breakpoint regardless of which view you picked,
  // since an iframe's viewport is simply however wide it's laid out.
  const DEVICE_WIDTHS = { desktop: 1440, mobile: 390 };
  el.preview.onload = () => {
    let contentHeight = 900;
    try { contentHeight = el.preview.contentDocument.documentElement.scrollHeight || 900; } catch { /* cross-origin — won't happen for srcdoc */ }
    el.preview.dataset.contentHeight = contentHeight;
    fitPreviewFrame();
  };

  // Horizontal padding the white frame (.preview-frame-border) adds on each
  // side — kept in sync with style.css so the scale math leaves room for
  // it instead of the frame pushing the content wider than the pane.
  const FRAME_PAD_X = { desktop: 10, mobile: 9 };

  function fitPreviewFrame() {
    if (!el.preview.dataset.lastHtml) return;
    const isMobile = state.viewport === 'mobile';
    const border = document.getElementById('previewFrameBorder');
    border.classList.toggle('mobile-frame', isMobile);
    const deviceWidth = DEVICE_WIDTHS[state.viewport] || DEVICE_WIDTHS.desktop;
    const contentHeight = Number(el.preview.dataset.contentHeight) || 900;
    const padX = (isMobile ? FRAME_PAD_X.mobile : FRAME_PAD_X.desktop) * 2;
    const wrapWidth = el.previewFrameWrap.clientWidth - 32 - padX;
    const scale = Math.max(0.2, Math.min(1, wrapWidth / deviceWidth));
    el.preview.style.width = `${deviceWidth}px`;
    el.preview.style.height = `${contentHeight}px`;
    el.preview.style.transform = `scale(${scale})`;
    const box = document.getElementById('previewScaleBox');
    box.style.width = `${deviceWidth * scale}px`;
    box.style.height = `${contentHeight * scale}px`;
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

  function openWhatsApp(phone) {
    const number = toWhatsAppNumber(phone);
    if (!number) return notify('Add a phone number first.', { sticky: false });
    openExternal(`https://wa.me/${number}`);
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

  // Straight into the blank builder form — no "what's it called?" prompt
  // first. The Name field is right there at the top of the form for them
  // to fill in themselves, same as every other field.
  el.newProjectBtn.onclick = async () => {
    const project = await api('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '' }) });
    await loadProjects();
    await selectProject(project.slug);
  };
  // "Full screen" expands the preview to fill the app window itself
  // (hiding the sidebar/editor) rather than taking over the whole Mac
  // display — a real OS-level fullscreen felt jarring for a quick preview.
  el.fullscreenBtn.onclick = () => {
    if (!el.preview.dataset.lastHtml) return;
    state.appFullscreen = !state.appFullscreen;
    document.querySelector('.layout').classList.toggle('preview-fullscreen', state.appFullscreen);
    // Keep this a single icon glyph, not a text label — the button is a
    // fixed-size icon-only square (see .icon-only), and swapping in a full
    // sentence here used to overflow/clip it, making it hard to click a
    // second time to exit full screen.
    el.fullscreenBtn.textContent = state.appFullscreen ? '⤡' : '⤢';
    el.fullscreenBtn.title = state.appFullscreen ? 'Exit full screen' : 'Full screen';
    fitPreviewFrame();
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.appFullscreen) el.fullscreenBtn.onclick();
  });
  el.closePreviewBtn.onclick = () => closeCurrentProject();
  el.viewportToggle.addEventListener('click', e => {
    const btn = e.target.closest('button[data-viewport]');
    if (!btn) return;
    state.viewport = btn.dataset.viewport;
    el.viewportToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
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
    if (!state.current || !el.preview.dataset.lastHtml) return alert('Nothing to deploy yet.');
    el.deployBtn.disabled = true;
    el.deployBtn.innerHTML = `<span class="status-spinner light"></span>Deploying…`;
    el.deployBtn.classList.remove('status-not-live', 'status-live', 'status-needs-update');
    el.deployBtn.classList.add('status-deploying');
    try {
      const result = await api(`/api/projects/${state.current.slug}/deploy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: el.preview.dataset.lastHtml })
      });
      state.current.liveUrl = result.url;
      state.dirty = false;
      try { await navigator.clipboard.writeText(result.url); } catch { /* clipboard may be unavailable */ }
      notify(`Live at ${result.url} (copied to clipboard).`, { sticky: true });
    } catch (err) {
      notify(friendlyError(err.message), { sticky: false });
    } finally {
      el.deployBtn.disabled = false;
      renderLiveActions();
    }
  };

  loadProjects().then(() => { renderEditor(); renderLiveActions(); });
})();
