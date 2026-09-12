document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('quickLead');
  const status = document.getElementById('quickLeadStatus');
  const convRow = document.getElementById('convRow');
  const bizNameInput = document.getElementById('bizName');
  const bizTagline = document.getElementById('bizTagline');
  const bizLocation = document.getElementById('bizLocation');
  const qaSuggest = document.getElementById('qaSuggest');
  const bizServices = document.getElementById('bizServices');
  const bizPrices = document.getElementById('bizPrices');
  const bizGoal = document.getElementById('bizGoal');
  const previewFrame = document.getElementById('previewFrame');

  const builderOverlay = document.getElementById('builderOverlay');
  const builderPreview = document.getElementById('builderPreview');
  const builderForName = document.getElementById('builderForName');
  const builderDeviceDesktop = document.getElementById('builderDeviceDesktop');
  const builderDeviceMobile = document.getElementById('builderDeviceMobile');
  const builderChatPill = document.getElementById('builderChatPill');

  const creatingOverlay = document.getElementById('creatingOverlay');
  const creatingVerb = document.getElementById('creatingVerb');
  const creatingName = document.getElementById('creatingName');
  const creatingSub = document.getElementById('creatingSub');
  const creatingProgress = document.getElementById('creatingProgress');
  const personalisingStatus = document.getElementById('personalisingStatus');
  const personalisingText = document.getElementById('personalisingText');

  let selectedTones = null;
  let heroMatchedTones = null;
  let hasManualPalette = false;
  let previewRenderVersion = 0;
  let previewPosition = {page:'home',x:0,y:0};
  let selectedLayout = null;
  let selectedFont = null;
  let selectedPaletteName = null;
  let uploadedHeroImage = null;
  let businessProfile = null;
  let heroRenderVersion = 0;
  // Must exist before the initial mobile sizing pass below. Previously this
  // was declared much later, so phones hit its temporal dead zone and aborted
  // the entire form setup before submit/input handlers were attached.
  let builderMobileView = false;

  function automaticLogoOptions() {
    const category = typeInfo(bizTagline.value)?.cat;
    const layout = selectedLayout || demoLayoutForCategory(category);
    const fontFamily = DEMO_FONTS.find(item => item.id === selectedFont)?.family || DEMO_LAYOUTS.find(item => item.id === layout)?.font;
    return {
      layout,
      fontFamily
    };
  }

  async function rerenderPersonalisedHero({ appearanceOnly = false, refreshSite = true } = {}) {
    if (!bizNameInput.value.trim() || !bizLocation.value.trim()) return null;
    const version = ++heroRenderVersion;
    try {
      const image = await HeroBrandCompositor.render({
        category: bizTagline.value,
        businessName: bizNameInput.value.trim(),
        location: bizLocation.value.trim(),
        ...automaticLogoOptions(),
        output: 'dataURL'
      });
      if (version !== heroRenderVersion) return null;
      uploadedHeroImage = image;
      if (appearanceOnly && previewFrame.contentDocument) {
        const scene = previewFrame.contentDocument.querySelector('.brand-scene');
        if (scene) scene.src = image;
      }
      if (refreshSite) refreshPreview({ appearanceOnly });
      return image;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  const COLOURS_BY_TYPE = {
    'Hair & Beauty': ['#a89a92', '#b07d93', '#847796', '#8d9a82'],
    'Aesthetics': ['#ada7a3', '#9b8ba6', '#82959a', '#b38d82'],
    'Health & Wellness': ['#9e826b', '#788c7a', '#77899c', '#9a7895'],
    'Fitness': ['#26313e', '#c8322a', '#1f6fb2', '#5a3fa0'],
    'Automotive': ['#59636e', '#7a403c', '#36586a', '#4b4b4b'],
    'Trades': ['#6b625c', '#8a6337', '#3f6270', '#59654a'],
    'Home & Garden': ['#6b7a4a', '#827052', '#54736c', '#7e667c'],
    'Food & Drink': ['#7a5c3d', '#8b4540', '#5f7046', '#69506e'],
    'Professional Services': ['#7a6952', '#6a4c70', '#4f6659', '#7a5047'],
    'Creative': ['#544e45', '#704b72', '#9a5a42', '#3f6170'],
    'Pets': ['#ca7281', '#4f7d70', '#8a6687', '#9a6650'],
    'Other': ['#5b3a73', '#456c78', '#7a5947', '#596b52']
  };

  if (!form) return;

  // keeps the full-page preview's top offset (--header-h) matched to the
  // real fixed header, which is a different height on mobile.
  const topBar = document.querySelector('.top');
  function syncHeaderHeight() {
    if (topBar) document.documentElement.style.setProperty('--header-h', topBar.offsetHeight + 'px');
  }
  syncHeaderHeight();
  window.addEventListener('resize', syncHeaderHeight);

  // keeps the preview's bottom edge finishing above the floating question
  // bar instead of sliding underneath it — the bar's real height shifts
  // with mobile safe-area padding, so it's measured rather than assumed.
  // The preview pane is short and wide (the question bar eats ~170px of
  // height), so at full width it has a ~1.9 aspect where a real desktop
  // viewport is ~1.5. The generated site's hero is a 16:9 band, so at that
  // stretched ratio it grew taller than the pane and pushed its own CTA
  // buttons below the fold. Narrow the frame to a realistic desktop shape
  // instead — never below 960px, or the site would flip to its mobile layout
  // (breakpoint 900px) and stop being a desktop preview at all.

  // Matches the CSS above: under 900px the desktop control is hidden, so make
  // sure we are never left stuck in the mobile-view state after a resize or
  // rotation back up to a wide screen.
  function syncDeviceControlAvailability() {
    if (window.innerWidth <= 900 && builderMobileView) setBuilderMobileView(false);
    if (!builderOverlay.hidden) setDocumentScrollLock(true);
  }

  function setDocumentScrollLock(locked) {
    const shouldLock = locked && window.innerWidth > 820;
    document.documentElement.classList.toggle('builder-scroll-lock', shouldLock);
    document.body.classList.toggle('builder-scroll-lock', shouldLock);
  }

  function sizePreviewToDesktopRatio() {
    if (!builderPreview || builderPreview.classList.contains('mobile-view')) return;
    const pane = builderPreview.getBoundingClientRect();
    if (!pane.width || !pane.height) return;
    const ideal = Math.max(960, Math.round(pane.height * 1.5));
    previewFrame.style.width = `${Math.min(pane.width, ideal)}px`;
  }

  const builderBarWrap = document.querySelector('.builder-bar-wrap');
  // Below 900px the bar collapses to just the floating chat pill (see the
  // matching breakpoint in styles.css), so the preview should run all the
  // way to the bottom of the screen behind it instead of leaving a gap of
  // real page showing above where the bar used to be.
  const MOBILE_BAR_BREAKPOINT = '(max-width: 900px)';
  function updateBuilderBottom() {
    if (!builderBarWrap || !builderPreview) return;
    builderPreview.style.bottom = '0px';
    builderPreview.style.setProperty('--builder-tools-height', `${builderBarWrap.getBoundingClientRect().height}px`);
    syncDeviceControlAvailability();
    sizePreviewToDesktopRatio();
  }
  if (builderBarWrap && builderPreview && 'ResizeObserver' in window) {
    new ResizeObserver(updateBuilderBottom).observe(builderBarWrap);
    updateBuilderBottom();
    window.addEventListener('resize', updateBuilderBottom);
  }

  // On iPhones, a fixed bottom control can sit behind the software keyboard
  // because the visual viewport becomes shorter than the layout viewport.
  // Lift only the builder bar by that difference so the field and arrow stay
  // visible and tappable while typing.
  function syncBuilderBarToKeyboard() {
    if (!builderBarWrap || !window.visualViewport || builderOverlay.hidden) return;
    const viewport = window.visualViewport;
    const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    builderBarWrap.style.transform = `translateY(${-keyboardHeight}px)`;
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncBuilderBarToKeyboard);
    window.visualViewport.addEventListener('scroll', syncBuilderBarToKeyboard);
  }

  function formatBusinessName(value) {
    const normalised = value.trim().replace(/\s+/g, ' ');
    if (normalised !== normalised.toLowerCase()) return normalised;

    return normalised.replace(
      /(^|[\s&/\-’'])([a-z])/g,
      (_, separator, letter) => separator + letter.toUpperCase()
    );
  }

  // Show capital initials while typing, then store the same properly-cased
  // value so it is also correct in pills, previews and WhatsApp messages.
  bizNameInput.style.textTransform = 'capitalize';
  bizNameInput.addEventListener('blur', () => {
    bizNameInput.value = formatBusinessName(bizNameInput.value);
  });
  bizLocation.style.textTransform = 'capitalize';
  bizLocation.addEventListener('blur', () => {
    bizLocation.value = formatBusinessName(bizLocation.value);
  });

  // populate the type dropdown from the shared generator's BUSINESS_TYPES
  BUSINESS_TYPES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.label;
    opt.textContent = t.label;
    bizTagline.appendChild(opt);
  });
  // A quick, polished build transition. The customer's business name stays
  // fixed while the supporting copy and progress line move smoothly.
  const CREATING_STEPS = [
    { verb: 'Finding your business', sub: 'checking local listings', progress: 14 },
    { verb: 'Importing contact details', sub: 'adding your real location', progress: 32 },
    { verb: 'Adding business hours', sub: 'making visits easy to plan', progress: 50 },
    { verb: 'Importing reviews', sub: 'bringing in your reputation', progress: 68 },
    { verb: 'Choosing your style', sub: 'matching your business', progress: 84 },
    { verb: 'Building your homepage', sub: 'optimising every screen', progress: 94 },
    { verb: 'Ready', sub: 'your preview is complete', progress: 100 }
  ];
  function swapText(el, text) {
    el.classList.add('is-swapping');
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove('is-swapping');
    }, 130);
  }
  function runCreatingAnimation(name) {
    return new Promise((resolve) => {
      creatingName.textContent = name;
      creatingProgress.style.width = '6%';
      creatingOverlay.classList.remove('final');
      creatingOverlay.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => creatingOverlay.classList.add('active'));
      let i = 0;
      function step() {
        const currentStep = CREATING_STEPS[i];
        swapText(creatingVerb, currentStep.verb);
        swapText(creatingSub, currentStep.sub);
        creatingProgress.style.width = currentStep.progress + '%';
        creatingOverlay.classList.toggle('final', i === CREATING_STEPS.length - 1);
        i++;
        if (i < CREATING_STEPS.length) {
          setTimeout(step, 480);
        } else {
          setTimeout(() => {
            creatingOverlay.classList.remove('active');
            creatingOverlay.setAttribute('aria-hidden', 'true');
            resolve();
          }, 620);
        }
      }
      setTimeout(step, 80);
    });
  }

  // conversational step 1: one persistent glowing box, one question at a
  // time. The question sits inside the box itself as fading placeholder
  // text; answering it crossfades that same box into the next question
  // rather than swapping in a new one. Answered questions collapse into
  // small ✓ pills above the box. Only once all three are answered does
  // the personalised loading screen run, revealing the finished, live
  // preview right after.
  const qaBox = document.getElementById('qaBox');
  const qaPills = document.getElementById('qaPills');
  const qaSlideName = document.getElementById('qaSlideName');
  const qaSlideType = document.getElementById('qaSlideType');
  const qaSlideLocation = document.getElementById('qaSlideLocation');
  const qaFieldName = document.getElementById('qaFieldName');
  const qaFieldType = document.getElementById('qaFieldType');
  const qaFieldLocation = document.getElementById('qaFieldLocation');
  const qaLocationNext = document.getElementById('qaLocationNext');
  const qaProgress = document.getElementById('qaProgress');
  const qaProgressLabel = document.getElementById('qaProgressLabel');
  const qaProgressSegs = qaProgress.querySelectorAll('.qa-progress-seg');

  function setProgressStep(step) {
    qaProgressLabel.textContent = step > 3 ? "You're all set" : `Step ${step} of 3`;
    qaProgressSegs.forEach((seg, i) => seg.classList.toggle('filled', i < step - 1 || step > 3));
  }

  // a field's placeholder question fades away (revealing the real input
  // and its cursor) as soon as it's focused or already has a value; its
  // paired arrow button (if any) fades in once there's something to submit.
  const qaNameGo = document.getElementById('qaNameGo');
  const qaTypeGo = document.getElementById('qaTypeGo');
  function wireField(field, input, goBtn) {
    const sync = () => {
      field.classList.toggle('qa-filled', !!input.value.trim());
      if (goBtn) goBtn.classList.toggle('visible', !!input.value.trim());
    };
    // Belt and braces for touch: the control now stretches to fill the row,
    // but the pill still has padding around the field. A tap landing in that
    // gap hits a plain div and would otherwise do nothing at all — which is
    // what made this feel dead on a phone. (A select opens its own picker
    // when tapped, so only redirect taps for text inputs.)
    // Keep the first field on the browser's native mobile input path.
    // Do not cancel touchstart/pointerdown: iOS and Android need the original
    // gesture to open the keyboard and preserve the typed value.
    field.addEventListener('click', (event) => {
      if (event.target !== input && input.tagName === 'INPUT') input.focus();
    });
    input.addEventListener('focus', () => field.classList.add('qa-focused'));
    input.addEventListener('blur', () => field.classList.remove('qa-focused'));
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    sync();
  }
  wireField(qaFieldName, bizNameInput, qaNameGo);
  wireField(qaFieldType, bizTagline, qaTypeGo);
  wireField(qaFieldLocation, bizLocation, qaLocationNext);

  // crossfades the box's content from whichever slide is active to `next`
  // — same box, same position, the question just dissolves into the next.
  const qaSlides = [qaSlideName, qaSlideType, qaSlideLocation];
  let activeSlide = qaSlideName;
  let slideTransitionTimer = null;

  function goToSlide(next, focusTarget) {
    if (activeSlide !== next) {
      clearTimeout(slideTransitionTimer);
      const leaving = activeSlide;

      qaSlides.forEach((slide) => {
        if (slide !== leaving && slide !== next) {
          slide.classList.remove('qa-active', 'qa-leaving');
          slide.hidden = true;
        }
      });

      next.hidden = false;
      leaving.classList.remove('qa-active');
      leaving.classList.add('qa-leaving');
      next.classList.add('qa-active');
      activeSlide = next;

      slideTransitionTimer = setTimeout(() => {
        leaving.classList.remove('qa-leaving');
        if (leaving !== activeSlide) leaving.hidden = true;
      }, 320);
    }
    if (focusTarget) setTimeout(() => focusTarget.focus(), 260);
  }

  // clicking any answered pill jumps back to that question instead of
  // needing a page refresh — collapses anything generated after it too,
  // since changing an earlier answer invalidates what came after.
  const pills = {};
  function collapseGenerated() {
    enrichmentRun += 1;
    previewIsVisible = false;
    businessProfile = null;
    googleProfile = null;
    facebookProfile = null;
    clearTimeout(personalisingTimer);
    if (personalisingStatus) {
      personalisingStatus.classList.remove('is-visible', 'is-fading', 'is-done');
      personalisingStatus.setAttribute('aria-hidden', 'true');
    }
    qaProgress.classList.remove('done');
    convRow.classList.remove('collapsed');
    qaBox.classList.remove('qa-box-done', 'qa-box-finish');
    builderOverlay.hidden = true;
    setDocumentScrollLock(false);
    resetBuilderBar();
  }
  function removePillsFrom(step) {
    [1, 2, 3].forEach((s) => { if (s >= step && pills[s]) { pills[s].remove(); delete pills[s]; } });
  }
  function goBackToName() {
    collapseGenerated();
    removePillsFrom(1);
    goToSlide(qaSlideName);
    qaProgress.classList.remove('started');
    setProgressStep(1);
    setTimeout(() => { bizNameInput.focus(); bizNameInput.select(); }, 320);
  }
  function goBackToType() {
    collapseGenerated();
    removePillsFrom(2);
    goToSlide(qaSlideType, bizTagline);
    setProgressStep(2);
  }
  function goBackToLocation() {
    collapseGenerated();
    removePillsFrom(3);
    goToSlide(qaSlideLocation, bizLocation);
    setProgressStep(3);
  }
  const goBackByStep = { 1: goBackToName, 2: goBackToType, 3: goBackToLocation };

  function addPill(step, text) {
    const pill = document.createElement('div');
    pill.className = 'qa-pill';
    pill.innerHTML = '<span class="qa-pill-check">✓</span><span class="qa-pill-text"></span>';
    pill.querySelector('.qa-pill-text').textContent = text;
    pill.addEventListener('click', () => goBackByStep[step]());
    qaPills.appendChild(pill);
    pills[step] = pill;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = formatBusinessName(bizNameInput.value);
    if (!name) return;
    bizNameInput.value = name;

    addPill(1, name);
    qaProgress.classList.add('started');
    setProgressStep(2);
    goToSlide(qaSlideType);
  });

  function finishType() {
    if (!bizTagline.value) return;
    const info = typeInfo(bizTagline.value);
    if (info) { const flat = flattenGroups(info); bizServices.value = flat.services.join(', '); bizPrices.value = flat.prices.join(', '); }
    // Use the category as a fallback until the completed hero is sampled.
    const firstColour = (COLOURS_BY_TYPE[bizTagline.value] || COLOURS_BY_TYPE.Other)[0];
    selectedTones = tonesFromHex(firstColour);
    selectedLayout = bizTagline.value === 'Fitness' ? 'studio' : null;
    selectedFont = null;
    selectedPaletteName = bizTagline.value === 'Fitness' ? 'Ink' : null;
    heroMatchedTones = null;
    hasManualPalette = false;
    uploadedHeroImage = null;
    addPill(2, bizTagline.value);
    setProgressStep(3);
    goToSlide(qaSlideLocation);
  }
  bizTagline.addEventListener('change', finishType);
  qaTypeGo.addEventListener('click', finishType);

  let isCreatingPreview = false;
  let enrichmentRun = 0;
  let enrichmentPending = 0;
  let previewIsVisible = false;
  let googleProfile = null;
  let facebookProfile = null;
  let personalisingTimer = null;
  const enrichmentApiBase = 'https://wellnessweb-coral.vercel.app';

  // Autocomplete lets the user pick the exact Google listing instead of us
  // guessing from free-text name+location. Picking a suggestion means the
  // Google side of the lookup goes straight to Place Details by ID (cheaper
  // and far more accurate than the fuzzy text search fallback below).
  let placesSessionToken = '';
  let selectedPlaceId = '';
  let suggestAbortController = null;
  let suggestDebounce = null;
  let suggestActiveIndex = -1;

  function newSessionToken() {
    return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  }

  function clearSuggestions() {
    qaSuggest.hidden = true;
    qaSuggest.innerHTML = '';
    suggestActiveIndex = -1;
  }

  function renderSuggestions(suggestions) {
    qaSuggest.innerHTML = '';
    if (!suggestions.length) return clearSuggestions();
    suggestions.forEach((s, index) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.index = String(index);
      li.innerHTML = `${s.mainText || s.text}${s.secondaryText ? `<small>${s.secondaryText}</small>` : ''}`;
      li.addEventListener('mousedown', (e) => { e.preventDefault(); choosePlace(s); });
      qaSuggest.appendChild(li);
    });
    qaSuggest.hidden = false;
    suggestActiveIndex = -1;
  }

  function choosePlace(suggestion) {
    selectedPlaceId = suggestion.placeId;
    bizLocation.value = suggestion.mainText ? `${suggestion.mainText}, ${suggestion.secondaryText || ''}`.replace(/,\s*$/, '') : suggestion.text;
    bizLocation.dispatchEvent(new Event('input'));
    clearSuggestions();
  }

  async function fetchSuggestions(input) {
    if (suggestAbortController) suggestAbortController.abort();
    suggestAbortController = new AbortController();
    if (!placesSessionToken) placesSessionToken = newSessionToken();
    try {
      const query = new URLSearchParams({ input, sessionToken: placesSessionToken });
      const response = await fetch(`${enrichmentApiBase}/api/place-autocomplete?${query}`, { signal: suggestAbortController.signal });
      if (!response.ok) return;
      const data = await response.json();
      renderSuggestions(data.suggestions || []);
    } catch (error) {
      if (error.name !== 'AbortError') console.info('Business search suggestions unavailable', error);
    }
  }

  bizLocation.addEventListener('input', () => {
    selectedPlaceId = '';
    clearTimeout(suggestDebounce);
    const name = bizNameInput.value.trim();
    const loc = bizLocation.value.trim();
    if (!name || loc.length < 2) return clearSuggestions();
    suggestDebounce = setTimeout(() => fetchSuggestions(`${name} ${loc}`), 220);
  });
  bizLocation.addEventListener('keydown', (e) => {
    const items = [...qaSuggest.children];
    if (!items.length || qaSuggest.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); suggestActiveIndex = Math.min(suggestActiveIndex + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); suggestActiveIndex = Math.max(suggestActiveIndex - 1, 0); }
    else if (e.key === 'Escape') { clearSuggestions(); return; }
    else return;
    items.forEach((li, i) => li.classList.toggle('qa-suggest-active', i === suggestActiveIndex));
  });
  bizLocation.addEventListener('blur', () => setTimeout(clearSuggestions, 120));

  async function findBusiness(source, name, location, timeoutMs, placeId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const query = new URLSearchParams(placeId ? { placeId } : { name, location });
      const response = await fetch(`${enrichmentApiBase}/api/${source}-lookup?${query}`, { signal: controller.signal });
      if (!response.ok) return null;
      const data = await response.json();
      return data.match || null;
    } catch (error) {
      if (error.name !== 'AbortError') console.info('Business details were not available', error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  function photoScore(photo) {
    const width = Number(photo.width) || 0;
    const height = Number(photo.height) || 0;
    const pixels = Math.min(width * height, 8000000) / 8000000;
    const landscape = width && height ? Math.min(width / height, 2.2) / 2.2 : .35;
    const age = photo.createdAt ? Math.max(0, Date.now() - Date.parse(photo.createdAt)) : null;
    const recency = Number.isFinite(age) ? Math.max(0, 1 - age / (1000 * 60 * 60 * 24 * 365 * 5)) : .35;
    return pixels * .5 + landscape * .25 + recency * .2 + (photo.source === 'google' ? .05 : 0);
  }

  function rankPhotos(...groups) {
    const seen = new Set();
    return groups.flat().filter(photo => {
      if (!photo?.url) return false;
      const key = photo.id || photo.url.replace(/[?#].*$/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => photoScore(b) - photoScore(a));
  }

  function mergeBusinessProfiles() {
    if (!googleProfile && !facebookProfile) return null;
    const g = googleProfile || {};
    const f = facebookProfile || {};
    const photos = rankPhotos(g.photos || [], f.photos || []);
    return {
      placeId: g.placeId || '',
      facebookId: f.id || '',
      name: g.name || f.name || '',
      address: g.address || f.address || '',
      city: g.city || '',
      postcode: g.postcode || '',
      lat: g.lat ?? null,
      lng: g.lng ?? null,
      phone: g.phone || f.phone || '',
      website: g.website || f.website || '',
      mapsUrl: g.mapsUrl || '',
      facebookUrl: f.facebookUrl || '',
      category: g.category || f.category || '',
      types: g.types || [],
      businessStatus: g.businessStatus || '',
      priceLevel: g.priceLevel || null,
      attributes: g.attributes || null,
      about: f.about || '',
      rating: g.rating || null,
      reviewCount: g.reviewCount || 0,
      hours: g.hours?.length ? g.hours : (f.hours || []),
      openNow: g.openNow,
      reviews: g.reviews || [],
      heroPhoto: photos[0] || null,
      photos: photos.slice(1, 7),
      sources: [googleProfile && 'Google', facebookProfile && 'Facebook'].filter(Boolean)
    };
  }

  function showPersonalising(done = false) {
    if (!personalisingStatus || !previewIsVisible) return;
    clearTimeout(personalisingTimer);
    personalisingText.textContent = done ? 'Preview personalised' : 'Personalising…';
    personalisingStatus.classList.remove('is-fading');
    personalisingStatus.classList.toggle('is-done', done);
    personalisingStatus.classList.add('is-visible');
    personalisingStatus.setAttribute('aria-hidden', 'false');
    if (done) personalisingTimer = setTimeout(() => {
      personalisingStatus.classList.add('is-fading');
      personalisingTimer = setTimeout(() => {
        personalisingStatus.classList.remove('is-visible', 'is-fading', 'is-done');
        personalisingStatus.setAttribute('aria-hidden', 'true');
      }, 180);
    }, 650);
  }

  function applyEnrichment(source, result, run) {
    if (run !== enrichmentRun) return;
    if (source === 'business') googleProfile = result;
    if (source === 'facebook') facebookProfile = result;
    businessProfile = mergeBusinessProfiles();
    if (previewIsVisible && result) refreshPreview({ smooth: true });
  }

  function finishEnrichment(run) {
    if (run !== enrichmentRun) return;
    enrichmentPending -= 1;
    if (previewIsVisible) showPersonalising(enrichmentPending <= 0);
  }

  function startEnrichment(name, location) {
    const run = ++enrichmentRun;
    const placeId = selectedPlaceId;
    placesSessionToken = ''; // spent — Google bills the details fetch against this session
    enrichmentPending = 1;
    googleProfile = null;
    facebookProfile = null;
    businessProfile = null;
    previewIsVisible = false;

    // The user picked an exact listing from autocomplete: go straight to an
    // accurate Place Details fetch instead of guessing from free text, and
    // still run Facebook alongside it for photos/about copy Google lacks.
    if (placeId) {
      enrichmentPending = 2;
      findBusiness('business', name, location, 4200, placeId)
        .then(google => applyEnrichment('business', google, run))
        .finally(() => finishEnrichment(run));
      findBusiness('facebook', name, location, 2400)
        .then(result => applyEnrichment('facebook', result, run))
        .finally(() => finishEnrichment(run));
      return;
    }

    findBusiness('facebook', name, location, 2400)
      .then(result => {
        applyEnrichment('facebook', result, run);
        if (run !== enrichmentRun) return;
        // Facebook is the free first choice. Only spend a capped Google
        // lookup when the Page result is missing or too incomplete to make
        // the generated site meaningfully real.
        const facebookIsUseful = result && result.address && result.phone &&
          (result.hours?.length || result.website || result.about);
        if (!facebookIsUseful) {
          enrichmentPending += 1;
          findBusiness('business', name, location, 4200)
            .then(google => applyEnrichment('business', google, run))
            .finally(() => finishEnrichment(run));
        }
      })
      .finally(() => finishEnrichment(run));
  }

  async function finishLocation() {
    const loc = formatBusinessName(bizLocation.value);
    if (!loc || isCreatingPreview) return;
    bizLocation.value = loc;
    isCreatingPreview = true;
    qaLocationNext.disabled = true;
    bizLocation.readOnly = true;
    status.textContent = '';
    status.className = 'quick-lead-status';

    try {
      addPill(3, loc);
      setProgressStep(4);

      // a slightly more exciting flourish into the loading/preview experience
      qaBox.classList.add('qa-box-finish');
      setTimeout(() => qaBox.classList.add('qa-box-done'), 500);

      const name = bizNameInput.value.trim();
      startEnrichment(name, loc);

      // Render the category hero while the timed loading sequence is playing,
      // rather than waiting until the animation has already finished.
      // On a phone the hero only ever displays at phone width, but the
      // multi-pass shadow/blur compositing (getImageData, several offset
      // fillText passes) still costs the same either way — at the full
      // 1600x900 canvas that was enough to push Safari's per-tab memory
      // limit over the edge and get the WebContent process jetsam-killed,
      // which looks exactly like "the page refreshes, then goes black".
      // Rendering at a smaller canvas on narrow viewports cuts that cost
      // without any visible loss, since it's downscaled to fit anyway.
      const isNarrowViewport = window.innerWidth <= 480;
      const heroImagePromise = Promise.resolve().then(async () => {
        // Sample the untouched photograph first, then render the identity from
        // that same palette. Sampling the already-branded result caused the
        // logo colour itself to skew the website palette on a second pass.
        await matchPaletteToHero(HeroBrandCompositor.heroSource(bizTagline.value));
        return HeroBrandCompositor.render({
          category: bizTagline.value,
          businessName: name,
          location: loc,
          ...automaticLogoOptions(),
          output: 'dataURL',
          width: isNarrowViewport ? 900 : 1600,
          height: isNarrowViewport ? 506 : 900
        });
      }).catch((error) => {
        console.error(error);
        return null;
      });

      const [, heroImage] = await Promise.all([
        runCreatingAnimation(name.toUpperCase()),
        heroImagePromise
      ]);
      uploadedHeroImage = heroImage;

      qaProgress.classList.add('done');
      convRow.classList.add('collapsed');
      refreshPreview();

      // hand off to the full-page builder: the generated site fills the
      // screen below the header, with the 5-question bar floating over it
      builderOverlay.hidden = false;
      previewIsVisible = true;
      showPersonalising(enrichmentPending <= 0);
      if (builderForName) builderForName.textContent = `Designed for ${name}`;
      // Must run here, not just at load: while the overlay is hidden the preview
      // pane measures 0x0, so the sizing bails out and the frame would stay at
      // full pane width — the exact case that pushed the hero's CTA off-screen.
      // updateBuilderBottom also can't wait for its ResizeObserver alone: that
      // observer doesn't reliably fire for this exact hidden-to-visible
      // transition, which left the preview's bottom offset at 0 and the whole
      // pane running under the bar until an actual window resize nudged it.
      updateBuilderBottom();
      sizePreviewToDesktopRatio();
      setDocumentScrollLock(true);

      postLead(name, 'Demo created — ' + bizTagline.value + ' in ' + loc).catch(() => {});
    } catch (error) {
      console.error(error);
      creatingOverlay.classList.remove('active');
      creatingOverlay.setAttribute('aria-hidden', 'true');
      qaBox.classList.remove('qa-box-finish', 'qa-box-done');
      removePillsFrom(3);
      setProgressStep(3);
      status.textContent = 'We could not build the preview just then. Please try again.';
      status.className = 'quick-lead-status err';
    } finally {
      isCreatingPreview = false;
      qaLocationNext.disabled = false;
      bizLocation.readOnly = false;
    }
  }
  bizLocation.addEventListener('input', () => {
    qaLocationNext.classList.toggle('visible', !!bizLocation.value.trim());
    refreshPreview();
  });
  bizLocation.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finishLocation(); }
  });
  qaLocationNext.addEventListener('click', finishLocation);

  // gather the initial 3 questions into the shape buildDemoHTML expects.
  // Q2 collects an email address for the designer, not a phone number, so the
  // preview keeps the generator's placeholder number rather than showing an
  // email where a phone number belongs.
  function gatherData() {
    return {
      name: bizNameInput.value.trim() || 'Your Business Name',
      tagline: bizTagline.value,
      location: bizLocation.value.trim(),
      services: bizServices.value.split(',').map(s => s.trim()).filter(Boolean),
      prices: bizPrices.value.split(',').map(s => s.trim()).filter(Boolean),
      goal: bizGoal.value,
      about: businessProfile?.about || '',
      phone: businessProfile?.phone || '',
      tones: selectedTones,
      layout: selectedLayout,
      font: selectedFont,
      logo: null,
      heroImage: businessProfile?.heroPhoto?.url || uploadedHeroImage,
      businessProfile
    };
  }
  // the preview is a REAL iframe filling the screen — no scaled-down
  // mockup, no browser-chrome wrapper. It just renders at its own natural
  // size, so the generated site's own responsive CSS applies exactly as
  // it would on a real visit, and normal scrolling (wheel/trackpad/touch)
  // works inside it with no tricks needed.
  function refreshPreview({appearanceOnly = false, smooth = false} = {}) {
    if (!previewFrame) return;
    const current = previewFrame.contentDocument;
    const activePage = current?.querySelector('.page:not([hidden])');
    if (activePage) {
      previewPosition = {page:activePage.dataset.page,x:previewFrame.contentWindow.scrollX,y:previewFrame.contentWindow.scrollY};
    }
    const position = {...previewPosition};
    const version = ++previewRenderVersion;
    const html = buildDemoHTML(gatherData());
    if (smooth) previewFrame.classList.add('is-refreshing');
    updatePaletteOrb();
    if (appearanceOnly && activePage) {
      // Colour and font choices only replace styles, keeping the live document,
      // open pages, scroll effects and gallery images in place.
      const next = new DOMParser().parseFromString(html,'text/html');
      current.querySelector('style').textContent = next.querySelector('style').textContent;
      const fontLink = current.querySelector('link[rel="stylesheet"]');
      const nextFont = next.querySelector('link[rel="stylesheet"]');
      if (fontLink.href !== nextFont.href) fontLink.href = nextFont.href;
      current.querySelector('meta[name="theme-color"]').content = next.querySelector('meta[name="theme-color"]').content;
      const win = previewFrame.contentWindow;
      win.scrollTo({left:position.x,top:position.y,behavior:'instant'});
      const restoredY = win.scrollY;
      current.fonts.ready.then(() => win.requestAnimationFrame(() => {
        if (version === previewRenderVersion && Math.abs(win.scrollY-restoredY)<2) win.scrollTo({left:position.x,top:position.y,behavior:'instant'});
      }));
      return;
    }
    previewFrame.onload = () => {
      if (version !== previewRenderVersion) return;
      previewFrame.classList.remove('is-refreshing');
      const win = previewFrame.contentWindow;
      const doc = win.document;
      doc.querySelectorAll('.page').forEach(page => {page.hidden = page.dataset.page !== position.page;});
      win.scrollTo({left:position.x,top:position.y,behavior:'instant'});
      const restoredY = win.scrollY;
      // Font metrics can settle after the frame loads. Reapply the position
      // only if the visitor hasn't already started scrolling again.
      doc.fonts.ready.then(() => win.requestAnimationFrame(() => {
        if (version === previewRenderVersion && Math.abs(win.scrollY-restoredY)<2) {
          win.scrollTo({left:position.x,top:position.y,behavior:'instant'});
        }
      }));
    };
    previewFrame.srcdoc = html;
  }

  function updatePaletteOrb() {
    const orb = document.querySelector('.palette-orb');
    if (orb && selectedTones) orb.style.background = `conic-gradient(${selectedTones.light} 0 120deg,${selectedTones.base} 120deg 240deg,${selectedTones.dark} 240deg)`;
  }

  async function matchPaletteToHero(source) {
    if (!source) return;
    try {
      heroMatchedTones = await HeroPalette.fromImage(source);
      if (!hasManualPalette && bizTagline.value !== 'Fitness') {
        selectedTones = heroMatchedTones;
        selectedPaletteName = 'Matched from hero photo';
      }
    } catch (error) {
      // Keep the category palette if the image cannot be sampled.
      console.warn('Could not match the hero palette', error);
    }
  }

  const controls = document.createElement('div');
  controls.className = 'builder-glass-tools';
  const whatsappIcon = builderChatPill.querySelector('svg').outerHTML;
  controls.innerHTML = `<div class="builder-options" id="builderOptions" hidden></div>
    <button type="button" class="glass-circle whatsapp-circle" data-tool="send" aria-label="Contact designer" aria-expanded="false">${whatsappIcon}</button>
    <button type="button" class="glass-circle" data-tool="colour" aria-label="Choose colours" aria-expanded="false"><span class="palette-orb"></span></button>
    <button type="button" class="glass-circle" data-tool="font" aria-label="Choose fonts" aria-expanded="false"><span class="font-orb">Aa</span></button>
    <button type="button" class="glass-circle" data-tool="layout" aria-label="Choose layout" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 10h18M12 10v11"/></svg></button>`;
  builderBarWrap.append(controls);
  builderChatPill.textContent = 'Send To Designer';
  builderChatPill.className = 'designer-send';
  builderChatPill.hidden = true;
  const mobileActions = document.createElement('div');
  mobileActions.className = 'mobile-builder-actions';
  mobileActions.innerHTML = `
    <div class="mobile-send-choices" hidden>
      <button type="button" data-mobile-send="whatsapp">WhatsApp</button>
      <button type="button" data-mobile-send="email">Email</button>
    </div>
    <div class="mobile-swipe-rail" aria-label="Website style controls" hidden>
      <button type="button" data-mobile-swipe="font" aria-label="Swipe to change font"><span>F<br>O<br>N<br>T</span></button>
      <button type="button" data-mobile-swipe="colour" aria-label="Swipe to change colour"><span>C<br>O<br>L<br>O<br>U<br>R</span></button>
      <button type="button" data-mobile-swipe="layout" aria-label="Swipe to change template"><span>T<br>E<br>M<br>P<br>L<br>A<br>T<br>E</span></button>
    </div>
    <div class="mobile-swipe-zones" aria-label="Swipe the preview to change its style" hidden>
      <button type="button" data-mobile-swipe="font" aria-label="Swipe left or right to change font"></button>
      <button type="button" data-mobile-swipe="colour" aria-label="Swipe left or right to change colour"></button>
      <button type="button" data-mobile-swipe="layout" aria-label="Swipe left or right to change template"></button>
    </div>
    <div class="mobile-builder-bottom">
      <button type="button" class="mobile-submit" aria-expanded="false">Submit to designer</button>
      <button type="button" class="mobile-edit" aria-pressed="false"><span>✦</span><b>Edit</b></button>
    </div>`;
  builderOverlay.append(mobileActions);
  const mobileSubmit = mobileActions.querySelector('.mobile-submit');
  const mobileEdit = mobileActions.querySelector('.mobile-edit');
  const mobileChoices = mobileActions.querySelector('.mobile-send-choices');
  const mobileRail = mobileActions.querySelector('.mobile-swipe-rail');
  const mobileSwipeZones = mobileActions.querySelector('.mobile-swipe-zones');

  function setMobileEditor(open) {
    builderOverlay.classList.toggle('mobile-editor-active', open);
    mobileRail.hidden = !open;
    mobileSwipeZones.hidden = !open;
    mobileEdit.setAttribute('aria-pressed', String(open));
    mobileEdit.querySelector('span').textContent = open ? '✓' : '✦';
    mobileEdit.querySelector('b').textContent = open ? 'Swipe screen' : 'Edit';
  }
  function cycleMobileStyle(tool, direction) {
    if (tool === 'font') {
      const current = DEMO_FONTS.findIndex(item => item.id === selectedFont);
      selectedFont = DEMO_FONTS[(current + direction + DEMO_FONTS.length) % DEMO_FONTS.length].id;
      refreshPreview({ appearanceOnly: true });
      rerenderPersonalisedHero({ appearanceOnly: true, refreshSite: false });
      return;
    }
    if (tool === 'colour') {
      const choices = Object.values(palettes).flat();
      const current = choices.findIndex(([, hex]) => hex.toLowerCase() === selectedTones?.base?.toLowerCase());
      const [name, hex] = choices[(current + direction + choices.length) % choices.length];
      hasManualPalette = true;
      selectedTones = {...tonesFromHex(hex), mode: 'light'};
      selectedPaletteName = name;
      refreshPreview({ appearanceOnly: true });
      return;
    }
    const category = typeInfo(bizTagline.value)?.cat;
    const fallback = demoLayoutForCategory(category);
    const current = DEMO_LAYOUTS.findIndex(item => item.id === (selectedLayout || fallback));
    selectedLayout = DEMO_LAYOUTS[(current + direction + DEMO_LAYOUTS.length) % DEMO_LAYOUTS.length].id;
    refreshPreview();
    rerenderPersonalisedHero({ appearanceOnly: true, refreshSite: false });
  }
  mobileEdit.addEventListener('click', () => setMobileEditor(!builderOverlay.classList.contains('mobile-editor-active')));
  mobileSubmit.addEventListener('click', () => {
    const open = mobileChoices.hidden;
    mobileChoices.hidden = !open;
    mobileSubmit.setAttribute('aria-expanded', String(open));
  });
  mobileChoices.addEventListener('click', event => {
    const action = event.target.closest('[data-mobile-send]')?.dataset.mobileSend;
    if (!action) return;
    mobileChoices.hidden = true;
    mobileSubmit.setAttribute('aria-expanded', 'false');
    if (action === 'whatsapp') builderChatPill.click();
    if (action === 'email') {
      const status = document.getElementById('handoffStatus');
      const design = selectedDesignSummary();
      status.textContent = 'Sending your design details…';
      postLeadWithMedia({
        Business: bizNameInput.value.trim(), Industry: bizTagline.value || 'Not provided',
        Location: bizLocation.value.trim() || 'Not provided', Template: design.template,
        Font: design.font, 'Colour scheme': design.palette
      }, []).then(sent => { status.textContent = sent ? 'Your design details have been emailed to Tom.' : 'Email could not be sent. Please try WhatsApp.'; });
    }
  });
  mobileActions.querySelectorAll('[data-mobile-swipe]').forEach(zone => {
    let startX = null;
    let hasSwiped = false;
    zone.addEventListener('pointerdown', event => {
      startX = event.clientX;
      hasSwiped = false;
      zone.setPointerCapture?.(event.pointerId);
    });
    zone.addEventListener('pointermove', event => {
      if (startX === null) return;
      const delta = event.clientX - startX;
      if (!hasSwiped && Math.abs(delta) > 32) {
        hasSwiped = true;
        cycleMobileStyle(zone.dataset.mobileSwipe, delta > 0 ? -1 : 1);
      }
    });
    const finishSwipe = event => {
      if (startX === null) return;
      const delta = event.clientX - startX;
      if (!hasSwiped && Math.abs(delta) > 24) cycleMobileStyle(zone.dataset.mobileSwipe, delta > 0 ? -1 : 1);
      startX = null;
      hasSwiped = false;
    };
    zone.addEventListener('pointerup', finishSwipe);
    zone.addEventListener('pointercancel', finishSwipe);
  });
  const options = controls.querySelector('.builder-options');
  let activeTool = null;
  const palettes = {
    Soft: [['Porcelain','#b59b94'],['Rose','#b77988'],['Lavender','#9180a5'],['Cloud','#8b9ca7'],['Sand','#b69b72'],['Pearl','#92918b']],
    Bold: [['Ruby','#ac2637'],['Cobalt','#245bb0'],['Forest','#286148'],['Ochre','#a97618'],['Plum','#763d67'],['Copper','#a75132']],
    Natural: [['Sage','#70836a'],['Clay','#a86e52'],['Olive','#797744'],['Ocean','#3d7479'],['Oat','#a29378'],['Moss','#506951']],
    Bright: [['Coral','#cf5547'],['Azure','#267fba'],['Berry','#b33e7e'],['Tangerine','#c96623'],['Teal','#16847b'],['Violet','#7652b0']],
    Dark: [['Ink','#26313e'],['Espresso','#4a3630'],['Midnight','#283958'],['Pine','#29473e'],['Charcoal','#3e4145'],['Aubergine','#4f354d']]
  };
  let paletteFamily = 'Soft';
  function paletteFamilyForColour(hex) {
    if (!hex) return paletteFamily;
    const rgb = value => {
      const clean = value.replace('#', '');
      return [0, 2, 4].map(offset => parseInt(clean.slice(offset, offset + 2), 16));
    };
    const current = rgb(hex);
    let closest = { family: paletteFamily, distance: Infinity };
    Object.entries(palettes).forEach(([family, choices]) => choices.forEach(([, value]) => {
      const candidate = rgb(value);
      const distance = candidate.reduce((total, channel, index) => total + (channel - current[index]) ** 2, 0);
      if (distance < closest.distance) closest = { family, distance };
    }));
    return closest.family;
  }
  function paletteNameForColour(hex) {
    if (!hex) return 'Not selected';
    const clean = hex.toLowerCase();
    for (const choices of Object.values(palettes)) {
      const match = choices.find(([, value]) => value.toLowerCase() === clean);
      if (match) return match[0];
    }
    return paletteFamilyForColour(hex);
  }
  function selectedDesignSummary() {
    const category = typeInfo(bizTagline.value)?.cat;
    const layoutId = selectedLayout || demoLayoutForCategory(category);
    const layout = DEMO_LAYOUTS.find(item => item.id === layoutId);
    const fallbackFontByLayout = {
      minimal: 'Manrope', soft: 'Manrope', serene: 'Cormorant Garamond',
      organic: 'Manrope', editorial: 'Fraunces', bold: 'Cormorant Garamond',
      luxe: 'Cormorant Garamond', kinetic: 'Lora',
      index: 'Manrope', studio: 'Bebas Neue'
    };
    const chosenFont = DEMO_FONTS.find(item => item.id === selectedFont);
    const fontFamily = chosenFont?.family || layout?.font || fallbackFontByLayout[layoutId] || 'Manrope';
    const fontLabel = chosenFont ? `${chosenFont.name} (${chosenFont.family})` : fontFamily;
    const palette = selectedPaletteName || paletteNameForColour(selectedTones?.base);

    return {
      template: layout?.name || layoutId || 'Not selected',
      font: fontLabel,
      palette
    };
  }
  function closeOptions() {
    activeTool = null;
    options.hidden = true;
    builderChatPill.hidden = true;
    controls.querySelectorAll('[data-tool]').forEach(button => button.setAttribute('aria-expanded','false'));
  }
  function renderOptions() {
    options.hidden = false;
    options.setAttribute('aria-label', `Choose ${activeTool}`);
    if (activeTool === 'send') {
      options.replaceChildren(builderChatPill);
      builderChatPill.hidden = false;
    } else if (activeTool === 'colour') {
      options.innerHTML = `<div class="palette-tabs" role="group" aria-label="Palette mood">${Object.keys(palettes).map(f => `<button type="button" data-family="${f}" aria-pressed="${f === paletteFamily}">${f}</button>`).join('')}</div><div class="palette-scroll">${palettes[paletteFamily].map(([name,hex]) => { const t = tonesFromHex(hex); return `<button type="button" class="palette-choice" data-colour="${hex}" data-palette-name="${name}" aria-label="${name} palette"><span style="background:${t.light}"></span><span style="background:${t.base}"></span><span style="background:${t.dark}"></span><small>${name}</small></button>`; }).join('')}</div><p>Swipe to explore colours</p>`;
      if (heroMatchedTones) {
        const recommendation = document.createElement('button');
        recommendation.type = 'button';
        recommendation.className = 'hero-palette-choice';
        recommendation.dataset.heroPalette = 'true';
        recommendation.setAttribute('aria-pressed', String(selectedTones?.base === heroMatchedTones.base));
        recommendation.innerHTML = `<span class="hero-palette-swatches"><i style="background:${heroMatchedTones.light}"></i><i style="background:${heroMatchedTones.base}"></i><i style="background:${heroMatchedTones.dark}"></i></span><span>From your hero photo<small>Recommended</small></span>`;
        options.prepend(recommendation);
      }
    } else if (activeTool === 'font') {
      options.innerHTML = `<h3>Choose your type</h3><div class="builder-choice-list">${DEMO_FONTS.map(f => `<button type="button" data-font="${f.id}" aria-pressed="${selectedFont === f.id}" style="font-family:${f.family}">${f.name}<span>Aa</span></button>`).join('')}</div>`;
    } else {
      const recommended = demoLayoutForCategory(typeInfo(bizTagline.value)?.cat);
      options.innerHTML = `<h2 class="builder-options-title">Choose your template</h2><div class="builder-choice-list">${DEMO_LAYOUTS.map(l => `<button type="button" data-layout="${l.id}" aria-pressed="${(selectedLayout || recommended) === l.id}">${l.name}<small>${l.id === recommended ? 'Recommended' : l.detail}</small></button>`).join('')}</div>`;
    }
  }
  controls.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.tool) {
      const next = button.dataset.tool;
      const previous = activeTool;
      closeOptions();
      if (previous === next) return;
      activeTool = next;
      if (next === 'colour') {
        paletteFamily = paletteFamilyForColour(selectedTones?.base);
      }
      button.setAttribute('aria-expanded','true');
      renderOptions();
    } else if (button.dataset.family) {
      paletteFamily = button.dataset.family;
      renderOptions();
    } else if (button.dataset.heroPalette) {
      hasManualPalette = true;
      selectedTones = {...heroMatchedTones};
      selectedPaletteName = 'Matched from hero photo';
      closeOptions();
      refreshPreview({ appearanceOnly: true });
      controls.querySelector('[data-tool="colour"]').focus();
    } else if (button.dataset.colour) {
      hasManualPalette = true;
      selectedTones = {...tonesFromHex(button.dataset.colour), mode: paletteFamily === 'Dark' ? 'dark' : 'light'};
      selectedPaletteName = button.dataset.paletteName || paletteNameForColour(button.dataset.colour);
      controls.querySelector('.palette-orb').style.background = `conic-gradient(${selectedTones.light} 0 120deg,${selectedTones.base} 120deg 240deg,${selectedTones.dark} 240deg)`;
      closeOptions();
      refreshPreview({ appearanceOnly: true });
      controls.querySelector('[data-tool="colour"]').focus();
    } else if (button.dataset.font || button.dataset.layout) {
      if (button.dataset.font) selectedFont = button.dataset.font;
      if (button.dataset.layout) selectedLayout = button.dataset.layout;
      closeOptions();
      refreshPreview({ appearanceOnly: Boolean(button.dataset.font) });
      await rerenderPersonalisedHero({ appearanceOnly: true, refreshSite: false });
      controls.querySelector(`[data-tool="${button.dataset.font ? 'font' : 'layout'}"]`).focus();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeTool) {
      const trigger = controls.querySelector(`[data-tool="${activeTool}"]`);
      closeOptions();
      trigger.focus();
    }
  });

  async function postLead(business_name, details) {
    const databaseRequest = fetch('https://klreehoegatehoubhhog.supabase.co/rest/v1/wellnessweb_leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'sb_publishable_oexuN3loIJTtwF93K_i2iA_OzJSAcHD',
        'Authorization': 'Bearer sb_publishable_oexuN3loIJTtwF93K_i2iA_OzJSAcHD',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ business_name, details, created_at: new Date().toISOString() })
    });
    const emailRequest = fetch('https://wellnessweb-notify-lead.notify-lead-worker.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_name, details }),
      keepalive: true
    });

    // Save and notify independently so an unavailable database cannot prevent
    // the email. Check both responses so failures are visible in diagnostics.
    const [databaseResult, emailResult] = await Promise.allSettled([databaseRequest, emailRequest]);
    if (databaseResult.status === 'rejected') {
      console.error('Lead database capture failed', databaseResult.reason);
    } else if (!databaseResult.value.ok) {
      console.error('Lead database capture failed', await databaseResult.value.text());
    }
    if (emailResult.status === 'rejected') {
      console.error('Lead email notification failed', emailResult.reason);
    } else if (!emailResult.value.ok) {
      console.error('Lead email notification failed', await emailResult.value.text());
    }
    return emailResult.status === 'fulfilled' && emailResult.value.ok;
  }

  // the final WhatsApp handoff sends everything — business details, any
  // uploaded photos and the generated preview — as one real email with
  // attachments, via the same Cloudflare Worker (Resend) postLead uses.
  // formsubmit.co previously handled the photos, but it needs a manual
  // "activate this form" confirmation per recipient and still couldn't
  // carry the business details or preview, so it's no longer used.
  async function postLeadWithMedia(fields, files) {
    const databaseRequest = fetch('https://klreehoegatehoubhhog.supabase.co/rest/v1/wellnessweb_leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'sb_publishable_oexuN3loIJTtwF93K_i2iA_OzJSAcHD',
        'Authorization': 'Bearer sb_publishable_oexuN3loIJTtwF93K_i2iA_OzJSAcHD',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ business_name: fields.Business, details: JSON.stringify(fields), created_at: new Date().toISOString() })
    });

    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
    files.forEach(({ name, file }) => { if (file) formData.append(name, file, file.name); });
    const emailRequest = fetch('https://wellnessweb-notify-lead.notify-lead-worker.workers.dev/', {
      method: 'POST',
      body: formData,
      keepalive: true
    });

    const [databaseResult, emailResult] = await Promise.allSettled([databaseRequest, emailRequest]);
    if (databaseResult.status === 'rejected') {
      console.error('Lead database capture failed', databaseResult.reason);
    } else if (!databaseResult.value.ok) {
      console.error('Lead database capture failed', await databaseResult.value.text());
    }
    if (emailResult.status === 'rejected') {
      console.error('Lead email notification failed', emailResult.reason);
    } else if (!emailResult.value.ok) {
      console.error('Lead email notification failed', await emailResult.value.text());
    }
    return emailResult.status === 'fulfilled' && emailResult.value.ok;
  }

  const designerWhatsAppNumber = '447535928879';

  // handoff is a single floating "Chat now" pill over the full-page live
  // preview — no question flow, straight to WhatsApp with what we already
  // know from the first 3 questions.
  if (builderChatPill) {
    builderChatPill.addEventListener('click', () => {
      const businessName = bizNameInput.value.trim();
      const businessType = bizTagline.value;
      const location_ = bizLocation.value.trim();
      const design = selectedDesignSummary();

      const message = `Hi, I'd like you to finish my website.

Business: ${businessName}
Industry: ${businessType}
Location: ${location_}
Template: ${design.template}
Font: ${design.font}
Colour palette: ${design.palette}`;

      const status = document.getElementById('handoffStatus');
      status.textContent = 'Opening WhatsApp…';

      let previewFile = null;
      try {
        const previewHtml = buildDemoHTML(gatherData());
        previewFile = new File([previewHtml], `${businessName || 'preview'}-site-preview.html`, { type: 'text/html' });
      } catch (err) {
        console.error('Could not build site preview attachment', err);
      }
      postLeadWithMedia({
        Business: businessName,
        Industry: businessType || 'Not provided',
        Location: location_ || 'Not provided',
        Template: design.template,
        Font: design.font,
        'Colour scheme': design.palette,
      }, [{ name: 'Site preview', file: previewFile }]).then(sent => {
        status.textContent = sent
          ? 'Your details were accepted for email delivery. Press Send inside WhatsApp to message Tom.'
          : 'Email could not be confirmed. Please press Send inside WhatsApp so Tom receives your details.';
      }).catch(() => {
        status.textContent = 'Email could not be confirmed. Please send your details in WhatsApp.';
      });

      const whatsappUrl = `https://wa.me/${designerWhatsAppNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    });
  }

  // toggles the full-page preview to a centred, phone-width column — since
  // it's a real iframe (not a scaled mockup), the generated site's own
  // responsive CSS just naturally switches to its mobile layout at that width.
  function setBuilderMobileView(on) {
    builderMobileView = on;
    builderPreview.classList.toggle('mobile-view', on);
    builderDeviceDesktop.classList.toggle('is-on', !on);
    builderDeviceMobile.classList.toggle('is-on', on);
    builderDeviceDesktop.setAttribute('aria-pressed', String(!on));
    builderDeviceMobile.setAttribute('aria-pressed', String(on));
    // hand width back to the stylesheet in mobile view, re-apply it on the way out
    if (on) previewFrame.style.width = ''; else sizePreviewToDesktopRatio();
  }
  builderDeviceDesktop.addEventListener('click', () => setBuilderMobileView(false));
  builderDeviceMobile.addEventListener('click', () => setBuilderMobileView(true));

});
