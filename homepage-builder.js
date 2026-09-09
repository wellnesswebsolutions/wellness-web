document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('quickLead');
  const status = document.getElementById('quickLeadStatus');
  const convRow = document.getElementById('convRow');
  const bizNameInput = document.getElementById('bizName');
  const bizTagline = document.getElementById('bizTagline');
  const bizLocation = document.getElementById('bizLocation');
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

  let selectedTones = null;
  let heroMatchedTones = null;
  let hasManualPalette = false;
  let previewRenderVersion = 0;
  let previewPosition = {page:'home',x:0,y:0};
  let selectedLayout = null;
  let selectedFont = null;
  let uploadedHeroImage = null;
  let heroRenderVersion = 0;
  // Must exist before the initial mobile sizing pass below. Previously this
  // was declared much later, so phones hit its temporal dead zone and aborted
  // the entire form setup before submit/input handlers were attached.
  let builderMobileView = false;

  async function rerenderPersonalisedHero() {
    if (!bizNameInput.value.trim() || !bizLocation.value.trim()) return null;
    const version = ++heroRenderVersion;
    try {
      const image = await HeroBrandCompositor.render({
        category: bizTagline.value,
        businessName: bizNameInput.value.trim(),
        location: bizLocation.value.trim(),
        output: 'dataURL'
      });
      if (version !== heroRenderVersion) return null;
      uploadedHeroImage = image;
      await matchPaletteToHero(image);
      refreshPreview();
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
    'Fitness': ['#c8322a', '#e2672a', '#1f6fb2', '#5a3fa0'],
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
    { verb: 'Choosing your style', sub: 'matching your business', progress: 22 },
    { verb: 'Building your homepage', sub: 'adding your content', progress: 58 },
    { verb: 'Finishing the details', sub: 'optimising every screen', progress: 84 },
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
          setTimeout(step, 540);
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
      const heroImagePromise = Promise.resolve().then(() => HeroBrandCompositor.render({
        category: bizTagline.value,
        businessName: name,
        location: loc,
        output: 'dataURL',
        width: isNarrowViewport ? 900 : 1600,
        height: isNarrowViewport ? 506 : 900
      })).then(async image => {
        await matchPaletteToHero(image);
        return image;
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
      about: '',
      phone: '',
      tones: selectedTones,
      layout: selectedLayout,
      font: selectedFont,
      logo: null,
      heroImage: uploadedHeroImage
    };
  }
  // the preview is a REAL iframe filling the screen — no scaled-down
  // mockup, no browser-chrome wrapper. It just renders at its own natural
  // size, so the generated site's own responsive CSS applies exactly as
  // it would on a real visit, and normal scrolling (wheel/trackpad/touch)
  // works inside it with no tricks needed.
  function refreshPreview({appearanceOnly = false} = {}) {
    if (!previewFrame) return;
    const current = previewFrame.contentDocument;
    const activePage = current?.querySelector('.page:not([hidden])');
    if (activePage) {
      previewPosition = {page:activePage.dataset.page,x:previewFrame.contentWindow.scrollX,y:previewFrame.contentWindow.scrollY};
    }
    const position = {...previewPosition};
    const version = ++previewRenderVersion;
    const html = buildDemoHTML(gatherData());
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
      if (!hasManualPalette) selectedTones = heroMatchedTones;
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
  function selectedDesignSummary() {
    const category = typeInfo(bizTagline.value)?.cat;
    const layoutId = selectedLayout || demoLayoutForCategory(category);
    const layout = DEMO_LAYOUTS.find(item => item.id === layoutId);
    const fallbackFontByLayout = {
      minimal: 'Manrope', soft: 'Manrope', serene: 'Cormorant Garamond',
      organic: 'Manrope', editorial: 'Fraunces', bold: 'Cormorant Garamond',
      luxe: 'Cormorant Garamond', kinetic: 'Lora', lume: 'Cormorant Garamond',
      index: 'Manrope'
    };
    const chosenFont = DEMO_FONTS.find(item => item.id === selectedFont);
    const fontFamily = chosenFont?.family || layout?.font || fallbackFontByLayout[layoutId] || 'Manrope';
    const fontLabel = chosenFont ? `${chosenFont.name} (${chosenFont.family})` : fontFamily;
    const colourCode = selectedTones
      ? [selectedTones.light, selectedTones.base, selectedTones.dark].map(value => value.toUpperCase()).join(' / ')
      : 'Not selected';

    return {
      template: layout?.name || layoutId || 'Not selected',
      font: fontLabel,
      colourCode
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
      options.innerHTML = `<div class="palette-tabs" role="group" aria-label="Palette mood">${Object.keys(palettes).map(f => `<button type="button" data-family="${f}" aria-pressed="${f === paletteFamily}">${f}</button>`).join('')}</div><div class="palette-scroll">${palettes[paletteFamily].map(([name,hex]) => { const t = tonesFromHex(hex); return `<button type="button" class="palette-choice" data-colour="${hex}" aria-label="${name} palette"><span style="background:${t.light}"></span><span style="background:${t.base}"></span><span style="background:${t.dark}"></span><small>${name}</small></button>`; }).join('')}</div><p>Swipe to explore colours</p>`;
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
      const groups = ['Essential', 'Pro'].map(tier => {
        const layouts = DEMO_LAYOUTS.filter(layout => (layout.tier || 'Essential') === tier);
        if (!layouts.length) return '';
        return `<section class="builder-template-group"><h3>${tier}</h3><div class="builder-choice-list">${layouts.map(l => `<button type="button" data-layout="${l.id}" aria-pressed="${(selectedLayout || recommended) === l.id}">${l.name}<small>${l.id === recommended ? 'Recommended' : l.detail}</small></button>`).join('')}</div></section>`;
      }).join('');
      options.innerHTML = `<h2 class="builder-options-title">Choose your template</h2>${groups}`;
    }
  }
  controls.addEventListener('click', event => {
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
      refreshPreview({appearanceOnly:true});
      closeOptions();
      controls.querySelector('[data-tool="colour"]').focus();
    } else if (button.dataset.colour) {
      hasManualPalette = true;
      selectedTones = {...tonesFromHex(button.dataset.colour), mode: paletteFamily === 'Dark' ? 'dark' : 'light'};
      controls.querySelector('.palette-orb').style.background = `conic-gradient(${selectedTones.light} 0 120deg,${selectedTones.base} 120deg 240deg,${selectedTones.dark} 240deg)`;
      refreshPreview({appearanceOnly:true});
      closeOptions();
      controls.querySelector('[data-tool="colour"]').focus();
    } else if (button.dataset.font || button.dataset.layout) {
      if (button.dataset.font) selectedFont = button.dataset.font;
      if (button.dataset.layout) selectedLayout = button.dataset.layout;
      refreshPreview({appearanceOnly:!!button.dataset.font});
      closeOptions();
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
Colour scheme: ${design.colourCode}`;

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
        'Colour scheme': design.colourCode,
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
