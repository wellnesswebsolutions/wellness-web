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
  const builderBar = document.getElementById('builderBar');
  const builderBarRow = document.getElementById('builderBarRow');
  const builderBack = document.getElementById('builderBack');
  const builderTopbar = document.getElementById('builderTopbar');
  const builderForName = document.getElementById('builderForName');
  const builderDeviceDesktop = document.getElementById('builderDeviceDesktop');
  const builderDeviceMobile = document.getElementById('builderDeviceMobile');
  const builderProgress = document.getElementById('builderProgress');
  const builderField = document.getElementById('builderField');
  const builderPh = document.getElementById('builderPh');
  const builderInput = document.getElementById('builderInput');
  const builderGo = document.getElementById('builderGo');
  const builderWhatsappBtn = document.getElementById('builderWhatsappBtn');

  const creatingOverlay = document.getElementById('creatingOverlay');
  const creatingVerb = document.getElementById('creatingVerb');
  const creatingName = document.getElementById('creatingName');
  const creatingSub = document.getElementById('creatingSub');
  const creatingProgress = document.getElementById('creatingProgress');

  let selectedTones = null;
  let uploadedHeroImage = null;
  // Must exist before the initial mobile sizing pass below. Previously this
  // was declared much later, so phones hit its temporal dead zone and aborted
  // the entire form setup before submit/input handlers were attached.
  let builderMobileView = false;

  const STYLE_BY_TYPE = {
    'Hair & Beauty': 'soft-luxury',
    'Aesthetics': 'clinical-luxury',
    'Health & Wellness': 'calm-wellness',
    'Fitness': 'bold-modern',
    'Automotive': 'bold-modern',
    'Trades': 'bold-modern',
    'Home & Garden': 'warm-editorial',
    'Food & Drink': 'warm-editorial',
    'Professional Services': 'clean-professional',
    'Creative': 'editorial-portfolio',
    'Pets': 'friendly-modern',
    'Other': 'clean-professional'
  };

  const COLOURS_BY_TYPE = {
    'Hair & Beauty': ['#a89a92', '#b07d93', '#847796', '#8d9a82'],
    'Aesthetics': ['#ada7a3', '#9b8ba6', '#82959a', '#b38d82'],
    'Health & Wellness': ['#9e826b', '#788c7a', '#77899c', '#9a7895'],
    'Fitness': ['#4d5864', '#914b45', '#526d59', '#5b4d7c'],
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
  // The preview pane is short and wide (the header and question bar eat ~170px
  // of height), so at full width it has a ~1.9 aspect where a real desktop
  // viewport is ~1.5. The generated site's hero is a 16:9 band, so at that
  // stretched ratio it grew taller than the pane and pushed its own CTA
  // buttons below the fold. Narrow the frame to a realistic desktop shape
  // instead — never below 960px, or the site would flip to its mobile layout
  // (breakpoint 900px) and stop being a desktop preview at all.
  // The personalised strip sits between the header and the preview, so the
  // preview's top offset has to account for its real measured height —
  // otherwise the strip would overlap the top of the generated site.
  function syncTopbarHeight() {
    if (!builderTopbar) return;
    const h = builderOverlay.hidden ? 0 : builderTopbar.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--builder-topbar-h', `${Math.round(h)}px`);
  }

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
  if (builderBarWrap && builderPreview && 'ResizeObserver' in window) {
    const updateBuilderBottom = () => {
      builderPreview.style.bottom = `${builderBarWrap.getBoundingClientRect().height}px`;
      syncTopbarHeight();
      syncDeviceControlAvailability();
      sizePreviewToDesktopRatio();
    };
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
    syncTopbarHeight();
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
    // Every hero has one art-directed palette. Customers do not need to
    // choose colours; the generated site automatically matches its image.
    const firstColour = (COLOURS_BY_TYPE[bizTagline.value] || COLOURS_BY_TYPE.Other)[0];
    selectedTones = tonesFromHex(firstColour);
    uploadedHeroImage = null;
    addPill(2, bizTagline.value);
    setProgressStep(3);
    goToSlide(qaSlideLocation);
  }
  bizTagline.addEventListener('change', finishType);
  qaTypeGo.addEventListener('click', finishType);

  let isCreatingPreview = false;

  async function finishLocation() {
    const loc = bizLocation.value.trim();
    if (!loc || isCreatingPreview) return;
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
      const heroImagePromise = Promise.resolve().then(() => HeroBrandCompositor.render({
        category: bizTagline.value,
        businessName: name,
        location: loc,
        output: 'dataURL'
      })).catch((error) => {
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
      syncTopbarHeight();
      sizePreviewToDesktopRatio();
      setDocumentScrollLock(true);
      resetBuilderBar();

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
      stylePreset: STYLE_BY_TYPE[bizTagline.value] || 'clean-professional',
      logo: null,
      heroImage: uploadedHeroImage
    };
  }
  // the preview is a REAL iframe filling the screen — no scaled-down
  // mockup, no browser-chrome wrapper. It just renders at its own natural
  // size, so the generated site's own responsive CSS applies exactly as
  // it would on a real visit, and normal scrolling (wheel/trackpad/touch)
  // works inside it with no tricks needed.
  function refreshPreview() {
    if (!previewFrame) return;
    previewFrame.srcdoc = buildDemoHTML(gatherData());
  }

  async function postLead(business_name, details) {
    const res = await fetch('https://klreehoegatehoubhhog.supabase.co/rest/v1/wellnessweb_leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'sb_publishable_oexuN3loIJTtwF93K_i2iA_OzJSAcHD',
        'Authorization': 'Bearer sb_publishable_oexuN3loIJTtwF93K_i2iA_OzJSAcHD',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ business_name, details, created_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error(await res.text());

    // best-effort email notification — don't let a failure here block the
    // lead capture itself, which already succeeded above
    fetch('/api/notify-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_name, details })
    }).catch(() => {});
  }

  const designerWhatsAppNumber = '447535928879';

  // the fixed bottom bar: one question at a time, floating over the
  // full-page live preview. Same fading-placeholder / crossfade pattern as
  // the first 3 questions, just driven by a single reusable field instead
  // of 5 near-identical slides. Name + WhatsApp are the only two the
  // designer actually needs to get started — the rest are optional.
  const BUILDER_QUESTIONS = [
    { q: 'Full name', type: 'text', required: true },
    { q: 'Email address', type: 'email', required: true },
    { q: 'Current website', type: 'text', optional: true },
    { q: 'Social media', type: 'text', optional: true },
    { q: 'Add your media', type: 'media', optional: true }
  ];
  let builderIndex = 0;
  let builderAnswers = [];
  let selectedMediaSummary = 'Not provided';

  const mediaModal = document.getElementById('builderMediaModal');
  const mediaEmailForm = document.getElementById('mediaEmailForm');
  const mediaEmailBusiness = document.getElementById('mediaEmailBusiness');
  const mediaEmailCustomer = document.getElementById('mediaEmailCustomer');
  const mediaEmailCustomerAddress = document.getElementById('mediaEmailCustomerAddress');
  const mediaModalBackdrop = document.getElementById('mediaModalBackdrop');
  const mediaModalClose = document.getElementById('mediaModalClose');
  const logoUpload = document.getElementById('builderLogoUpload');
  const heroUpload = document.getElementById('builderHeroUpload');
  const galleryUpload = document.getElementById('builderGalleryUpload');
  const mediaSelectionStatus = document.getElementById('mediaSelectionStatus');
  const mediaSaveBtn = document.getElementById('mediaSaveBtn');
  const mediaLaterBtn = document.getElementById('mediaLaterBtn');
  const mediaDesignerBtn = document.getElementById('mediaDesignerBtn');

  function getSelectedMedia() {
    return {
      logo: logoUpload.files[0] || null,
      hero: heroUpload.files[0] || null,
      gallery: Array.from(galleryUpload.files || [])
    };
  }

  function getSelectedMediaBytes() {
    const media = getSelectedMedia();
    return [media.logo, media.hero, ...media.gallery].filter(Boolean).reduce((total, file) => total + file.size, 0);
  }

  function updateMediaSelectionStatus() {
    const media = getSelectedMedia();
    const parts = [];
    if (media.logo) parts.push('Logo added');
    if (media.hero) parts.push('Homepage picture added');
    if (media.gallery.length) parts.push(`${media.gallery.length} gallery picture${media.gallery.length === 1 ? '' : 's'} added`);
    mediaSelectionStatus.textContent = parts.length ? parts.join(' · ') : 'No files selected yet.';
    mediaSaveBtn.disabled = !parts.length;
  }

  function openMediaModal() {
    mediaModal.hidden = false;
    requestAnimationFrame(() => mediaModal.classList.add('is-open'));
    mediaModalClose.focus();
  }

  function closeMediaModal() {
    mediaModal.classList.remove('is-open');
    setTimeout(() => {
      mediaModal.hidden = true;
      builderGo.focus();
    }, 180);
  }

  function completeMediaStep(summary) {
    selectedMediaSummary = summary;
    builderAnswers[builderIndex] = summary;
    builderIndex++;
    closeMediaModal();
    finishBuilder();
  }

  [logoUpload, heroUpload].forEach(input => input.addEventListener('change', updateMediaSelectionStatus));
  galleryUpload.addEventListener('change', () => {
    if (galleryUpload.files.length > 6) {
      galleryUpload.value = '';
      mediaSelectionStatus.textContent = 'Please choose no more than 6 gallery pictures.';
      mediaSaveBtn.disabled = true;
      return;
    }
    updateMediaSelectionStatus();
  });
  mediaSaveBtn.addEventListener('click', () => {
    const media = getSelectedMedia();
    if (getSelectedMediaBytes() > 10 * 1024 * 1024) {
      mediaSelectionStatus.textContent = 'Please keep the total upload below 10 MB.';
      return;
    }
    const parts = [];
    if (media.logo) parts.push(`logo: ${media.logo.name}`);
    if (media.hero) parts.push(`homepage picture: ${media.hero.name}`);
    if (media.gallery.length) parts.push(`gallery: ${media.gallery.map(file => file.name).join(', ')}`);
    completeMediaStep(`Selected — ${parts.join('; ')}. Files will also be emailed automatically.`);
  });
  mediaLaterBtn.addEventListener('click', () => completeMediaStep('Customer will add media later'));
  mediaDesignerBtn.addEventListener('click', () => completeMediaStep('Please choose suitable images for me'));
  mediaModalClose.addEventListener('click', closeMediaModal);
  mediaModalBackdrop.addEventListener('click', closeMediaModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !mediaModal.hidden) closeMediaModal();
  });

  function resetBuilderBar() {
    builderIndex = 0;
    builderAnswers = [];
    selectedMediaSummary = 'Not provided';
    logoUpload.value = '';
    heroUpload.value = '';
    galleryUpload.value = '';
    updateMediaSelectionStatus();
    builderBarRow.hidden = false;
    builderWhatsappBtn.hidden = true;
    builderBar.classList.remove('builder-bar-done');
    showBuilderQuestion(0, { animate: false });
  }

  function showBuilderQuestion(i, { animate = true } = {}) {
    const question = BUILDER_QUESTIONS[i];
    const render = () => {
      const isMediaStep = question.type === 'media';
      builderPh.textContent = question.q + (question.optional ? ' (optional)' : '');
      builderInput.setAttribute('aria-label', question.q + (question.optional ? ' (optional)' : ''));
      builderInput.type = isMediaStep ? 'text' : question.type;
      builderInput.hidden = isMediaStep;
      builderInput.disabled = isMediaStep;
      builderInput.readOnly = isMediaStep;
      builderField.classList.toggle('builder-media-field', isMediaStep);
      builderField.setAttribute('role', isMediaStep ? 'button' : 'presentation');
      builderField.tabIndex = isMediaStep ? 0 : -1;
      builderGo.setAttribute('aria-label', isMediaStep ? 'Open media options' : 'Next question');
      builderInput.enterKeyHint = i === BUILDER_QUESTIONS.length - 1 ? 'done' : 'next';
      builderInput.value = '';
      builderField.classList.remove('qa-filled', 'qa-focused');
      builderProgress.textContent = `${i + 1}/${BUILDER_QUESTIONS.length}`;
      // always visible: on question 1 it steps back out of the full-page
      // builder into the 3-question wizard (editing location) instead of
      // just being hidden with nowhere to go.
      builderBack.classList.add('visible');
    };
    if (!animate) { render(); return; }
    builderBarRow.classList.add('builder-leaving');
    setTimeout(() => {
      render();
      builderBarRow.classList.remove('builder-leaving');
      builderBarRow.classList.add('builder-entering');
      requestAnimationFrame(() => requestAnimationFrame(() => builderBarRow.classList.remove('builder-entering')));
    }, 220);
  }

  function finishBuilder() {
    builderBar.classList.add('builder-bar-done');
    setTimeout(() => {
      builderBarRow.hidden = true;
      builderWhatsappBtn.hidden = false;
    }, 220);
  }

  function submitBuilderAnswer() {
    const question = BUILDER_QUESTIONS[builderIndex];
    if (question.type === 'media') {
      openMediaModal();
      return;
    }
    const value = builderInput.value.trim();
    if (question.required && !value) {
      builderField.classList.add('qa-focused');
      builderInput.focus();
      return;
    }
    builderAnswers[builderIndex] = value;
    builderIndex++;
    if (builderIndex < BUILDER_QUESTIONS.length) {
      showBuilderQuestion(builderIndex);
    } else {
      finishBuilder();
    }
  }
  function goToPreviousBuilderQuestion() {
    if (builderIndex === 0) { goBackToLocation(); return; }
    builderIndex--;
    showBuilderQuestion(builderIndex);
    setTimeout(() => {
      if (BUILDER_QUESTIONS[builderIndex].type !== 'media') {
        builderInput.value = builderAnswers[builderIndex] || '';
        builderInput.dispatchEvent(new Event('input'));
      }
    }, 230);
  }
  builderGo.addEventListener('click', submitBuilderAnswer);
  builderBack.addEventListener('click', goToPreviousBuilderQuestion);
  builderInput.addEventListener('input', () => {
    builderField.classList.toggle('qa-filled', !!builderInput.value.trim());
  });
  builderInput.addEventListener('focus', () => {
    builderField.classList.add('qa-focused');
    requestAnimationFrame(syncBuilderBarToKeyboard);
  });
  builderInput.addEventListener('blur', () => {
    builderField.classList.remove('qa-focused');
    setTimeout(() => {
      if (builderBarWrap) builderBarWrap.style.transform = '';
    }, 120);
  });
  builderInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitBuilderAnswer(); }
  });
  builderField.addEventListener('click', () => {
    if (BUILDER_QUESTIONS[builderIndex]?.type === 'media') openMediaModal();
  });
  builderField.addEventListener('keydown', e => {
    if (BUILDER_QUESTIONS[builderIndex]?.type === 'media' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openMediaModal();
    }
  });

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

  // final step: hand everything off to the designer over WhatsApp instead
  // of a checkout/payment page — nothing is charged until the finished
  // site is approved. The customer still has to press send inside WhatsApp.
  builderWhatsappBtn.addEventListener('click', () => {
    const businessName = bizNameInput.value.trim();
    const businessType = bizTagline.value;
    const location_ = bizLocation.value.trim();
    const [fullName, email, website, socialMedia, mediaChoice] = builderAnswers;

    const message = `Hi, I'd like you to finish my website.

Business: ${businessName}
Industry: ${businessType}
Location: ${location_}

Name: ${fullName || 'Not provided'}
Email address: ${email || 'Not provided'}
Current website: ${website || 'Not provided'}
Social media: ${socialMedia || 'Not provided'}
Media: ${mediaChoice || selectedMediaSummary}`;

    const completeMessage = message;

    postLead(businessName, completeMessage).catch(() => {});

    if (getSelectedMediaBytes() > 0) {
      mediaEmailBusiness.value = businessName;
      mediaEmailCustomer.value = fullName || 'Not provided';
      mediaEmailCustomerAddress.value = email || 'Not provided';
      mediaEmailForm.submit();
    }

    const whatsappUrl = `https://wa.me/${designerWhatsAppNumber}?text=${encodeURIComponent(completeMessage)}`;
    window.open(whatsappUrl, '_blank');
  });
});
