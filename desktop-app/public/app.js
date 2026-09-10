(() => {
  const state = { projects: [], current: null, found: {} }; // found: images turned up by the last import

  const el = {
    projectList: document.getElementById('projectList'),
    newProjectBtn: document.getElementById('newProjectBtn'),
    editor: document.getElementById('editor'),
    preview: document.getElementById('preview'),
    openBrowserBtn: document.getElementById('openBrowserBtn'),
    exportBtn: document.getElementById('exportBtn'),
    browserLinkBtn: document.getElementById('browserLinkBtn')
  };

  async function api(path, opts) {
    const res = await fetch(path, opts);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  }

  async function loadProjects() {
    state.projects = await api('/api/projects');
    renderSidebar();
  }

  function renderSidebar() {
    el.projectList.innerHTML = '';
    state.projects.forEach(p => {
      const row = document.createElement('div');
      row.className = 'project' + (state.current && state.current.slug === p.slug ? ' active' : '');
      row.textContent = p.raw?.name || p.name || p.slug;
      row.onclick = () => selectProject(p.slug);
      el.projectList.appendChild(row);
    });
  }

  async function selectProject(slug) {
    state.current = await api(`/api/projects/${slug}`);
    state.found = {};
    renderSidebar();
    renderEditor();
    renderPreview();
  }

  async function createProject() {
    const name = prompt('Business name?');
    if (!name) return;
    const project = await api('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    await loadProjects();
    await selectProject(project.slug);
  }

  async function persist() {
    if (!state.current) return;
    state.current = await api(`/api/projects/${state.current.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.current)
    });
    loadProjects(); // refresh sidebar labels
  }

  function setRaw(patch) {
    state.current.raw = { ...state.current.raw, ...patch };
  }

  function aiBadge(field) {
    return state.current.aiFilled?.includes(field) ? '<span class="badge-ai">AI</span>' : '';
  }

  function categoryOptions(selected) {
    return BUSINESS_TYPES.map(t =>
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

  function renderEditor() {
    if (!state.current) {
      el.editor.innerHTML = '<div class="empty-state">Create or select a site on the left to get started.</div>';
      return;
    }
    const raw = state.current.raw || {};
    const profile = raw.businessProfile || {};
    const slug = state.current.slug;

    el.editor.innerHTML = `
      <h2>Import</h2>
      <div class="import-box">
        <input id="importUrl" type="text" placeholder="Paste a Facebook Page or Google Maps link" value="${state.current.lastImportUrl || ''}">
        <button id="importBtn">Fetch</button>
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

    wireMediaSlot('logo');
    wireMediaSlot('hero');
  }

  function mediaSlot(slot, label) {
    const raw = state.current.raw || {};
    const path = slot === 'logo' ? raw.logoImage : raw.heroImage;
    const thumbStyle = path ? `style="background-image:url('/projects/${state.current.slug}/${path}')"` : '';
    const found = state.found[slot];
    return `
      <div class="media-slot" data-slot="${slot}">
        <label>${label}</label>
        <div class="thumb" ${thumbStyle}></div>
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
    const el2 = document.querySelector(`.media-slot[data-slot="${slot}"]`);
    if (!el2) return;
    const fileInput = el2.querySelector('input[type=file]');
    el2.querySelector('[data-action="upload"]').onclick = () => fileInput.click();
    fileInput.onchange = () => uploadMedia(slot, fileInput.files[0]);
    const useFound = el2.querySelector('[data-action="use-found"]');
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
    const url = document.getElementById('importUrl').value.trim();
    const status = document.getElementById('importStatus');
    if (!url) return;
    status.textContent = 'Fetching…';
    try {
      const data = await api('/api/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url })
      });
      const aiFilled = [];
      const raw = state.current.raw || {};
      const profile = { ...(raw.businessProfile || {}) };
      if (data.name && !raw.name) setRaw({ name: data.name });
      if (data.address) profile.address = data.address;
      if (data.phone) profile.phone = data.phone;
      if (data.about) profile.about = data.about;
      if (data.mapsUrl) profile.mapsUrl = data.mapsUrl;
      if (data.hours?.length) profile.hours = data.hours;
      if (!data.about) aiFilled.push('about'); // nothing found — flag it rather than leave silently blank
      setRaw({ businessProfile: profile });
      state.current.aiFilled = aiFilled;
      state.current.lastImportUrl = url;
      if (data.images?.length) state.found[data.source === 'facebook' ? 'hero' : 'logo'] = data.images[0];
      await persist();
      renderEditor();
      schedulePreview();
      status.textContent = `Fetched from ${data.source}. ${data.images?.length ? data.images.length + ' image(s) found — see "Use found".' : 'No photos found on the page.'}`;
    } catch (err) {
      status.textContent = err.message;
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

  function renderPreview() {
    if (!state.current || !state.current.raw?.name) return;
    const raw = projectMediaAbsolute(state.current.raw, state.current.slug);
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

  el.newProjectBtn.onclick = createProject;
  el.openBrowserBtn.onclick = () => window.open(location.href, '_blank');
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
    alert(`Exported to:\n${result.path}`);
  };

  loadProjects();
})();
