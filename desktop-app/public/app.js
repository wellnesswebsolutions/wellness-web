(() => {
  const state = { projects: [], current: null, found: {}, activeTab: 'builder' };

  const STAGE_LABELS = {
    potential: 'Potential', info_needed: 'Information needed', ready_to_build: 'Ready to build',
    building: 'Building', ready_to_send: 'Ready to send', demo_sent: 'Demo sent',
    waiting_reply: 'Waiting for reply', interested: 'Interested', complete: 'Complete', archived: 'Archived'
  };
  const STAGE_ORDER = Object.keys(STAGE_LABELS);
  const NEXT_ACTION = {
    potential: { label: 'Find info', run: p => startImportFor(p) },
    info_needed: { label: 'Add missing info', run: p => openBuilder(p.slug) },
    ready_to_build: { label: 'Build demo', run: p => buildDemo(p) },
    building: { label: 'Open in Builder', run: p => openBuilder(p.slug) },
    ready_to_send: { label: 'Mark sent', run: p => setStage(p.slug, 'demo_sent') },
    demo_sent: { label: 'Log reply', run: p => setStage(p.slug, 'waiting_reply') },
    waiting_reply: { label: 'Mark interested', run: p => setStage(p.slug, 'interested') },
    interested: { label: 'Mark complete', run: p => setStage(p.slug, 'complete') },
    complete: { label: 'Archive', run: p => setStage(p.slug, 'archived') },
    archived: { label: 'Reopen', run: p => setStage(p.slug, 'potential') }
  };

  const el = {
    projectList: document.getElementById('projectList'),
    newProjectBtn: document.getElementById('newProjectBtn'),
    editor: document.getElementById('editor'),
    preview: document.getElementById('preview'),
    openBrowserBtn: document.getElementById('openBrowserBtn'),
    exportBtn: document.getElementById('exportBtn'),
    browserLinkBtn: document.getElementById('browserLinkBtn'),
    notice: document.getElementById('noticeStrip'),
    salesWrap: document.getElementById('salesWrap'),
    builderView: document.getElementById('builderView'),
    salesView: document.getElementById('salesView'),
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

  // --- deterministic completeness meter (no AI involved in computing this) ---
  const COMPLETENESS_FIELDS = [
    { key: 'name', get: p => p.raw?.name },
    { key: 'tagline', get: p => p.raw?.tagline },
    { key: 'location', get: p => p.raw?.location },
    { key: 'phone', get: p => p.raw?.businessProfile?.phone || p.contact?.phone },
    { key: 'address', get: p => p.raw?.businessProfile?.address },
    { key: 'about', get: p => p.raw?.businessProfile?.about }
  ];
  function completeness(project) {
    const aiFields = new Set(project.aiFilled || []);
    let verified = 0, ai = 0, missing = 0;
    COMPLETENESS_FIELDS.forEach(f => {
      const value = f.get(project);
      if (!value) missing += 1;
      else if (aiFields.has(f.key)) ai += 1;
      else verified += 1;
    });
    const total = COMPLETENESS_FIELDS.length;
    return { verified, ai, missing, total, verifiedPct: Math.round((verified / total) * 100) };
  }
  function meterHtml(project) {
    const c = completeness(project);
    const verifiedW = (c.verified / c.total) * 100;
    const aiW = (c.ai / c.total) * 100;
    return `<div class="info-meter"><div class="fill" style="width:${verifiedW}%"></div><div class="fill ai-part" style="left:${verifiedW}%;width:${aiW}%"></div></div><span class="info-pct">${c.verifiedPct}% real</span>`;
  }
  // minimum info required to begin a build (per spec): name, category,
  // location, one contact method, one source, enough to pick a template —
  // template picking is automatic once category is known, so that folds in.
  function hasMinimumInfo(project) {
    const raw = project.raw || {};
    const contact = project.contact || {};
    const hasContact = raw.businessProfile?.phone || contact.phone || contact.whatsapp || contact.email;
    const hasSource = project.lastImportUrl || contact.facebookUrl || contact.googleUrl;
    return !!(raw.name && raw.tagline && raw.location && hasContact && hasSource);
  }

  // ---------------- tabs ----------------
  document.querySelectorAll('header .tab').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
  function switchTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('header .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    el.builderView.hidden = tab !== 'builder';
    el.salesView.hidden = tab !== 'sales';
    if (tab === 'sales') renderSales();
  }

  el.gearBtn.onclick = () => el.settingsDialog.showModal();
  el.closeSettingsBtn.onclick = () => el.settingsDialog.close();

  // ---------------- projects ----------------
  async function loadProjects() {
    state.projects = await api('/api/projects');
    renderSidebar();
    if (state.activeTab === 'sales') renderSales();
  }

  function renderSidebar() {
    const builderProjects = state.projects.filter(p => ['ready_to_build', 'building', 'ready_to_send'].includes(p.pipelineStage || 'ready_to_build') || !p.pipelineStage);
    el.projectList.innerHTML = '';
    builderProjects.forEach(p => {
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

  function openBuilder(slug) {
    switchTab('builder');
    selectProject(slug);
  }

  async function createProject(name, pipelineStage) {
    const project = await api('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pipelineStage })
    });
    await loadProjects();
    return project;
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

  // ---------------- Builder editor ----------------
  function renderEditor() {
    if (!state.current) {
      el.editor.innerHTML = '<div class="empty-state">Create or select a site on the left to get started.</div>';
      return;
    }
    const raw = state.current.raw || {};
    const profile = raw.businessProfile || {};

    el.editor.innerHTML = `
      <h2>Import</h2>
      <div class="import-box">
        <input id="importUrl" type="text" placeholder="Paste a Facebook Page or Google Maps link" value="${escapeAttr(state.current.lastImportUrl || '')}">
        <button id="importBtn">Fetch</button>
      </div>
      <div class="import-status" id="importStatus"></div>
      ${meterHtml(state.current)}

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
      ${raw.logoImage ? `<button id="compositeBtn" style="font-size:12px;padding:6px 10px;border-radius:7px;border:1px solid var(--line);background:#fff;cursor:pointer;margin-bottom:10px">Composite logo onto hero photo</button>` : ''}
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
    const compositeBtn = document.getElementById('compositeBtn');
    if (compositeBtn) compositeBtn.onclick = runComposite;

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
    // Undo by reversing exactly what that edit changed back to the value
    // beforehand, using the previous entry's patch trail — simplest safe
    // approach without keeping full field history: re-fetch is not
    // possible, so we just clear the touched fields back to blank and
    // let you retype/re-import rather than risk showing a wrong value.
    const clearedRaw = { ...state.current.raw };
    Object.keys(entry.fieldPatch || {}).forEach(k => delete clearedRaw[k]);
    if (entry.profilePatch && Object.keys(entry.profilePatch).length) {
      const profile = { ...(clearedRaw.businessProfile || {}) };
      Object.keys(entry.profilePatch).forEach(k => delete profile[k]);
      clearedRaw.businessProfile = profile;
    }
    const newLog = log.filter((_, i) => i !== index);
    state.current.raw = clearedRaw;
    state.current.editLog = newLog;
    await persist();
    renderEditor();
    renderPreview();
  }

  async function runComposite() {
    const raw = state.current.raw;
    if (!raw.logoImage) return;
    const info = typeInfo(raw.tagline) || BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
    const logoUrl = `${location.origin}/projects/${state.current.slug}/${raw.logoImage}`;
    try {
      const dataUrl = await HeroBrandCompositor.render({
        category: info.cat, businessName: raw.name || 'Your business', logo: logoUrl, output: 'dataURL'
      });
      const blob = await (await fetch(dataUrl)).blob();
      const form = new FormData();
      form.append('file', blob, 'hero.jpg');
      const result = await api(`/api/projects/${state.current.slug}/media/hero`, { method: 'POST', body: form });
      setRaw({ heroImage: result.path });
      await persist();
      renderEditor();
      renderPreview();
      notify('Logo composited onto the hero photo.');
    } catch (err) {
      notify(`Couldn't composite the logo: ${err.message}`, { sticky: false });
    }
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
    const url = document.getElementById('importUrl').value.trim();
    const status = document.getElementById('importStatus');
    if (!url) return;
    status.textContent = 'Fetching…';
    try {
      const data = await api('/api/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url })
      });
      const aiFilled = (state.current.aiFilled || []).slice();
      const raw = state.current.raw || {};
      const profile = { ...(raw.businessProfile || {}) };
      if (data.name && !raw.name) setRaw({ name: data.name });
      if (data.address) profile.address = data.address;
      if (data.phone) profile.phone = data.phone;
      if (data.about) profile.about = data.about;
      if (data.mapsUrl) profile.mapsUrl = data.mapsUrl;
      if (data.hours?.length) profile.hours = data.hours;
      if (!data.about && !aiFilled.includes('about')) aiFilled.push('about');
      setRaw({ businessProfile: profile });
      state.current.aiFilled = aiFilled;
      state.current.lastImportUrl = url;
      const contact = { ...(state.current.contact || {}) };
      if (data.source === 'facebook') contact.facebookUrl = url;
      if (data.source === 'google') contact.googleUrl = url;
      state.current.contact = contact;
      if (data.images?.length) state.found[data.source === 'facebook' ? 'hero' : 'logo'] = data.images[0];
      await persist();
      renderEditor();
      schedulePreview();
      status.textContent = `Fetched from ${data.source}. ${data.images?.length ? data.images.length + ' image(s) found — see "Use found".' : 'No photos found on the page.'}`;
      notify(`Imported from ${data.source} for ${state.current.raw.name || 'this site'}.`);
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

  // ---------------- Sales tab ----------------
  async function setStage(slug, stage) {
    await api(`/api/projects/${slug}/stage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage })
    });
    notify(`Moved to "${STAGE_LABELS[stage]}".`);
    await loadProjects();
    renderSales();
  }

  async function buildDemo(project) {
    await setStage(project.slug, 'building');
    openBuilder(project.slug);
    notify('Building homepage…');
  }

  async function startImportFor(project) {
    openBuilder(project.slug);
  }

  async function addLead() {
    const input = document.getElementById('newLeadInput');
    const name = input.value.trim();
    if (!name) return;
    await createProject(name, 'potential');
    input.value = '';
    notify(`${name} added to Sales.`);
    renderSales();
  }

  function renderSales() {
    const groups = {};
    STAGE_ORDER.forEach(s => (groups[s] = []));
    state.projects.forEach(p => {
      const stage = p.pipelineStage || 'ready_to_build';
      (groups[stage] || (groups[stage] = [])).push(p);
    });

    el.salesWrap.innerHTML = `
      <div class="new-lead-row">
        <input id="newLeadInput" placeholder="Add a business by name…">
        <button id="addLeadBtn">Add to Sales</button>
      </div>
      ${STAGE_ORDER.filter(s => groups[s].length).map(stage => `
        <div class="stage-group">
          <h3>${STAGE_LABELS[stage]} <span class="count">${groups[stage].length}</span></h3>
          ${groups[stage].map(rowHtml).join('')}
        </div>
      `).join('') || '<div class="empty-state">No businesses yet — add one above or create a site in Builder.</div>'}
    `;

    document.getElementById('addLeadBtn').onclick = addLead;
    document.getElementById('newLeadInput').onkeydown = e => { if (e.key === 'Enter') addLead(); };

    state.projects.forEach(p => {
      const select = document.getElementById(`stage_${p.slug}`);
      if (select) select.onchange = e => setStage(p.slug, e.target.value);
      const actionBtn = document.getElementById(`action_${p.slug}`);
      if (actionBtn) actionBtn.onclick = () => NEXT_ACTION[p.pipelineStage || 'ready_to_build'].run(p);
    });
  }

  function rowHtml(p) {
    const raw = p.raw || {};
    const thumbStyle = raw.heroImage ? `style="background-image:url('/projects/${p.slug}/${raw.heroImage}')"` : '';
    const stage = p.pipelineStage || 'ready_to_build';
    const action = NEXT_ACTION[stage];
    const infoWarning = stage === 'potential' && !hasMinimumInfo(p) ? ' · missing info' : '';
    return `
      <div class="sales-row">
        <div class="mini-preview" ${thumbStyle}></div>
        <div><div class="name">${escapeHtml(raw.name || p.name)}</div><div class="cat">${escapeHtml(raw.tagline || 'Uncategorised')}${infoWarning}</div></div>
        <div class="meter-cell">${meterHtml(p)}</div>
        <select class="stage-select" id="stage_${p.slug}">
          ${STAGE_ORDER.map(s => `<option value="${s}" ${s === stage ? 'selected' : ''}>${STAGE_LABELS[s]}</option>`).join('')}
        </select>
        <button class="next-action" id="action_${p.slug}">${action.label}</button>
      </div>`;
  }

  function escapeHtml(s) { return String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function escapeAttr(s) { return String(s || '').replace(/"/g, '&quot;'); }

  el.newProjectBtn.onclick = async () => {
    const name = prompt('Business name?');
    if (!name) return;
    const project = await createProject(name, 'ready_to_build');
    await selectProject(project.slug);
  };
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
    await setStage(state.current.slug, 'ready_to_send');
    notify('Website ready to review — exported and marked "Ready to send".');
    alert(`Exported to:\n${result.path}`);
  };

  loadProjects();
})();
