(() => {
  const state = { projects: [], current: null, found: {} };

  const el = {
    projectList: document.getElementById('projectList'),
    newProjectBtn: document.getElementById('newProjectBtn'),
    editor: document.getElementById('editor'),
    preview: document.getElementById('preview'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    exportBtn: document.getElementById('exportBtn'),
    deployBtn: document.getElementById('deployBtn'),
    browserLinkBtn: document.getElementById('browserLinkBtn'),
    notice: document.getElementById('noticeStrip'),
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

  let noticeTimer = null;
  function notify(text, opts = {}) {
    clearTimeout(noticeTimer);
    el.notice.textContent = text;
    el.notice.hidden = false;
    if (!opts.sticky) noticeTimer = setTimeout(() => (el.notice.hidden = true), 4500);
  }

  el.gearBtn.onclick = () => el.settingsDialog.showModal();
  el.closeSettingsBtn.onclick = () => el.settingsDialog.close();
  document.getElementById('signInFacebookBtn').onclick = () => api('/api/sign-in', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'facebook' })
  }).catch(err => notify(err.message, { sticky: false }));
  document.getElementById('signInGoogleBtn').onclick = () => api('/api/sign-in', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'google' })
  }).catch(err => notify(err.message, { sticky: false }));

  // ---------------- projects ----------------
  async function loadProjects() {
    state.projects = await api('/api/projects');
    renderSidebar();
  }

  function renderSidebar() {
    el.projectList.innerHTML = '';
    state.projects.forEach(p => {
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
      row.onclick = () => selectProject(p.slug);
      el.projectList.appendChild(row);
    });
  }

  async function deleteProject(slug, displayName) {
    if (!confirm(`Delete "${displayName}"? This removes its files permanently and can't be undone.`)) return;
    try {
      await api(`/api/projects/${slug}`, { method: 'DELETE' });
      if (state.current?.slug === slug) {
        state.current = null;
        state.found = {};
      }
      await loadProjects();
      renderEditor();
      renderPreview();
      el.preview.srcdoc = state.current ? el.preview.srcdoc : '';
      notify(`Deleted "${displayName}".`);
    } catch (err) {
      notify(err.message, { sticky: false });
    }
  }

  async function selectProject(slug) {
    state.current = await api(`/api/projects/${slug}`);
    state.found = {};
    if (state.current.importImages?.length) state.found.hero = state.current.importImages[0];
    renderSidebar();
    renderEditor();
    renderPreview();
  }

  async function persist() {
    if (!state.current) return;
    state.current = await api(`/api/projects/${state.current.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.current)
    });
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
    return DEMO_LAYOUTS.map(t => `
      <label class="${t.id === selected ? 'selected' : ''}">
        <input type="radio" name="layout" value="${t.id}" ${t.id === selected ? 'checked' : ''}>
        ${t.name}
      </label>`).join('');
  }

  // ---------------- start screen (no project selected) ----------------
  function renderStartScreen() {
    el.editor.innerHTML = `
      <div class="link-bar">
        <input id="startLink" type="text" placeholder="Paste a Facebook or Google Maps link…">
        <button id="startBuildBtn">Build website</button>
      </div>
      <div class="import-status" id="startStatus"></div>
      <p style="font-size:12px;color:var(--muted);margin-top:20px">
        Or <a href="#" id="startBlankLink">start a blank site</a> and fill it in by hand.
      </p>
    `;
    document.getElementById('startBuildBtn').onclick = runQuickImport;
    document.getElementById('startLink').onkeydown = e => { if (e.key === 'Enter') runQuickImport(); };
    document.getElementById('startBlankLink').onclick = async e => {
      e.preventDefault();
      const name = prompt('Business name?');
      if (!name) return;
      const project = await api('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      await loadProjects();
      await selectProject(project.slug);
    };
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
    status.textContent = 'Reading the page…';
    try {
      const project = await api('/api/quick-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, url2 })
      });
      await loadProjects();
      await selectProject(project.slug);
      notify(`Built a site for ${project.raw?.name || 'this business'}.`);
    } catch (err) {
      status.textContent = err.message;
      notify(err.message, { sticky: false });
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------- Builder editor ----------------
  function renderEditor() {
    if (!state.current) return renderStartScreen();
    const raw = state.current.raw || {};
    const profile = raw.businessProfile || {};

    el.editor.innerHTML = `
      <h2>Import</h2>
      <div class="link-bar">
        <input id="f_link" type="text" placeholder="Paste a Facebook or Google Maps link…" value="${escapeAttr(state.current.lastImportUrl || state.current.contact?.facebookUrl || profile.mapsUrl || '')}">
        <button id="importBtn">Re-fetch</button>
      </div>
      <div class="import-status" id="importStatus"></div>

      <h2>Business</h2>
      <div class="field"><label>Name</label>
        <input id="f_name" value="${escapeAttr(raw.name || '')}"></div>
      <div class="field"><label>Category</label>
        <select id="f_category">${categoryOptions(raw.tagline)}</select></div>
      <div class="field"><label>Location / area</label>
        <input id="f_location" value="${escapeAttr(raw.location || '')}"></div>
      <div class="field"><label>Phone</label>
        <input id="f_phone" value="${escapeAttr(profile.phone || '')}"></div>
      <div class="field"><label>Address</label>
        <input id="f_address" value="${escapeAttr(profile.address || '')}"></div>
      <div class="field"><label>About ${aiBadge('about')}</label>
        <textarea id="f_about">${escapeHtml(profile.about || '')}</textarea></div>

      <h2>Media</h2>
      <div class="media-row">
        ${mediaSlot('logo', 'Logo')}
        ${mediaSlot('hero', 'Hero image')}
      </div>
      <div class="field"><label>Gallery</label></div>
      <div class="gallery-grid" id="galleryGrid">${galleryThumbs()}</div>
      <input type="file" id="galleryUpload" accept="image/*" multiple style="font-size:12px">

      <h2>Template</h2>
      <div class="template-grid" id="templateGrid">${templateOptions(raw.layout)}</div>

      <h2>Edit with AI</h2>
      <div class="ai-edit-box">
        <textarea id="aiInstruction" placeholder="e.g. Make the about section warmer and mention it's family-run"></textarea>
        <button id="aiEditBtn">Apply edit</button>
        <div class="ai-edit-status" id="aiEditStatus"></div>
        ${editLogHtml()}
      </div>
    `;

    document.getElementById('importBtn').onclick = runImport;
    document.getElementById('f_name').oninput = e => { setRaw({ name: e.target.value }); schedulePreview(); };
    document.getElementById('f_category').onchange = e => { setRaw({ tagline: e.target.value }); schedulePreview(); };
    document.getElementById('f_location').oninput = e => { setRaw({ location: e.target.value }); schedulePreview(); };
    document.getElementById('f_phone').oninput = e => { setRaw({ businessProfile: { ...profile, phone: e.target.value } }); schedulePreview(); };
    document.getElementById('f_address').oninput = e => { setRaw({ businessProfile: { ...profile, address: e.target.value } }); schedulePreview(); };
    document.getElementById('f_about').oninput = e => { setRaw({ businessProfile: { ...profile, about: e.target.value } }); schedulePreview(); };
    document.getElementById('templateGrid').addEventListener('change', e => {
      setRaw({ layout: e.target.value });
      document.querySelectorAll('#templateGrid label').forEach(l => l.classList.toggle('selected', l.querySelector('input').checked));
      schedulePreview();
    });
    document.getElementById('galleryUpload').addEventListener('change', e => uploadGallery(e.target.files));
    document.getElementById('aiEditBtn').onclick = runAiEdit;
    document.querySelectorAll('.edit-log .undo').forEach(btn => (btn.onclick = () => undoEdit(Number(btn.dataset.i))));
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
    status.textContent = 'Asking Claude Code…';
    try {
      const updated = await api(`/api/projects/${state.current.slug}/ai-edit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instruction })
      });
      state.current = updated;
      status.textContent = 'Edit applied — you can undo it below if it\'s not right.';
      renderEditor();
      renderPreview();
    } catch (err) {
      status.textContent = err.message.includes('not found')
        ? 'Claude Code isn\'t available on this Mac right now — the rest of the app still works fine.'
        : err.message;
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
      ? `<div style="font-size:10px;color:var(--muted);margin-top:4px">Auto: ${raw.logoImage ? 'your logo' : 'name'} on a 3D scene — see preview</div>`
      : '';
    return `
      <div class="media-slot" data-slot="${slot}">
        <label>${label}</label>
        <div class="thumb" ${thumbStyle}></div>
        ${autoHeroHint}
        <div class="actions">
          <button data-action="upload">Upload</button>
          ${found ? `<button data-action="use-found" class="found">Use found</button>` : ''}
        </div>
        <input type="file" accept="image/*" style="display:none">
      </div>`;
  }

  function galleryThumbs() {
    const gallery = state.current.raw?.gallery || [];
    return gallery.map(g => `<div class="thumb" style="background-image:url('/projects/${state.current.slug}/${g}')"></div>`).join('')
      || '<span style="font-size:12px;color:#8a8d93">No gallery images yet.</span>';
  }

  function wireMediaSlot(slot) {
    const wrap = document.querySelector(`.media-slot[data-slot="${slot}"]`);
    if (!wrap) return;
    const fileInput = wrap.querySelector('input[type=file]');
    wrap.querySelector('[data-action="upload"]').onclick = () => fileInput.click();
    fileInput.onchange = () => uploadMedia(slot, fileInput.files[0]);
    const useFound = wrap.querySelector('[data-action="use-found"]');
    if (useFound) useFound.onclick = () => useFoundImage(slot);
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
    status.textContent = 'Reading the page…';
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
      status.textContent = err.message;
      notify(err.message, { sticky: false });
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

  function escapeHtml(s) { return String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function escapeAttr(s) { return String(s || '').replace(/"/g, '&quot;'); }

  el.newProjectBtn.onclick = async () => {
    const name = prompt('Business name?');
    if (!name) return;
    const project = await api('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    await loadProjects();
    await selectProject(project.slug);
  };
  el.fullscreenBtn.onclick = () => {
    if (!el.preview.dataset.lastHtml) return;
    el.preview.requestFullscreen().catch(() => notify('Full screen isn\'t available right now.', { sticky: false }));
  };
  el.browserLinkBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); el.browserLinkBtn.textContent = 'Copied!'; }
    catch { el.browserLinkBtn.textContent = location.href; }
    setTimeout(() => (el.browserLinkBtn.textContent = 'Copy browser link'), 1500);
  };
  el.exportBtn.onclick = async () => {
    if (!state.current || !el.preview.dataset.lastHtml) return alert('Nothing to export yet.');
    const result = await api(`/api/projects/${state.current.slug}/export`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: el.preview.dataset.lastHtml })
    });
    notify('Website exported and ready to send.');
    alert(`Exported to:\n${result.path}`);
  };
  el.deployBtn.onclick = async () => {
    if (!state.current || !el.preview.dataset.lastHtml) return alert('Nothing to deploy yet.');
    el.deployBtn.disabled = true;
    el.deployBtn.textContent = 'Deploying…';
    try {
      const result = await api(`/api/projects/${state.current.slug}/deploy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: el.preview.dataset.lastHtml })
      });
      try { await navigator.clipboard.writeText(result.url); } catch { /* clipboard may be unavailable */ }
      notify(`Live at ${result.url} (copied to clipboard).`, { sticky: true });
    } catch (err) {
      notify(err.message, { sticky: true });
    } finally {
      el.deployBtn.disabled = false;
      el.deployBtn.textContent = 'Make live';
    }
  };

  loadProjects().then(() => renderEditor());
})();
