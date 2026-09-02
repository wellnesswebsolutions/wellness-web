/* Six-site homepage carousel. The card transition lasts almost the full
   1.8-second cycle, while the active card has a subtle inner drift, so the
   presentation keeps moving instead of stopping between designs. */
(() => {
  const root = document.getElementById('cx');
  const stage = document.getElementById('cxStage');
  if (!root || !stage) return;

  const AUTOPLAY_MS = 1800;
  const VISIBLE_POSITIONS = new Set([-1, 0, 1]);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const designs = [
    { name: 'SISKŌ Hairdressing', url: 'sisko-hairdressing.vercel.app', colour: '#C59B7A' },
    { name: 'Kings Valeting Hull', url: 'kings-valeting-hull.vercel.app', colour: '#315B6D' },
    { name: 'De Lacy', url: 'de-lacy.vercel.app', colour: '#C58F9F' },
    { name: 'Muse.', url: 'muse-hull-deploy.vercel.app', colour: '#A9ADB3' },
    { name: 'MGS Beverley', url: 'mgs-beverley.vercel.app', colour: '#6D8757' },
    { name: 'Brian Griffin Electrical', url: 'brian-griffin-electrical.vercel.app', colour: '#B94B45' }
  ];

  designs.forEach((design) => {
    const item = document.createElement('article');
    item.className = 'cx-item';
    item.style.setProperty('--cx-hero-colour', design.colour);
    item.innerHTML = `
      <div class="cx-float">
        <span class="cx-dot" aria-hidden="true"></span>
        <div class="cx-win">
          <div class="cx-bar" aria-hidden="true"><i></i><i></i><i></i></div>
          <div class="cx-shot">
            <iframe
              data-src="https://${design.url}"
              title="${design.name} homepage preview"
              sandbox="allow-scripts allow-same-origin"
              scrolling="no"
              tabindex="-1"
              loading="lazy"
            ></iframe>
            <a
              class="cx-hit"
              href="https://${design.url}"
              target="_blank"
              rel="noopener"
              aria-label="Open the ${design.name} site"
            ></a>
          </div>
        </div>
      </div>`;
    stage.appendChild(item);
  });

  const items = [...stage.children];
  const frames = items.map((item) => item.querySelector('iframe'));
  const itemCount = items.length;
  let activeIndex = 0;
  let timer = null;
  let paused = false;
  let offscreen = false;
  let framesArmed = false;
  let loadingFrame = null;

  const signedDistance = (index) => {
    let distance = ((index - activeIndex) % itemCount + itemCount) % itemCount;
    if (distance > itemCount / 2) distance -= itemCount;
    return distance;
  };

  function isLive(frame) {
    const src = frame.getAttribute('src');
    return Boolean(src && src.startsWith('http'));
  }

  function syncFrames() {
    if (!framesArmed) return;

    frames.forEach((frame, index) => {
      if (Math.abs(signedDistance(index)) > 1 && isLive(frame)) {
        frame.src = 'about:blank';
      }
    });

    if (loadingFrame) return;

    const wantedIndexes = [
      activeIndex,
      (activeIndex + 1) % itemCount,
      (activeIndex - 1 + itemCount) % itemCount
    ];
    const nextIndex = wantedIndexes.find((index) => !isLive(frames[index]));
    if (nextIndex === undefined) return;

    const frame = frames[nextIndex];
    loadingFrame = frame;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      frame.removeEventListener('load', finish);
      if (loadingFrame === frame) loadingFrame = null;
      window.setTimeout(syncFrames, 80);
    };

    frame.addEventListener('load', finish, { once: true });
    frame.src = frame.dataset.src;
    window.setTimeout(finish, 3500);
  }

  function placeItems() {
    items.forEach((item, index) => {
      const distance = signedDistance(index);
      const position = VISIBLE_POSITIONS.has(distance) ? String(distance) : 'hidden';
      const active = distance === 0;

      item.dataset.pos = position;
      item.setAttribute('aria-hidden', String(!active));
      item.querySelector('.cx-hit').tabIndex = active ? 0 : -1;
    });

    root.dataset.active = String(activeIndex);
    syncFrames();
  }

  function goTo(index) {
    activeIndex = ((index % itemCount) + itemCount) % itemCount;
    placeItems();
  }

  function stopAutoplay() {
    if (!timer) return;
    window.clearTimeout(timer);
    timer = null;
  }

  function startAutoplay() {
    if (timer || reduceMotion || paused || offscreen || document.hidden) return;
    timer = window.setTimeout(() => {
      timer = null;
      goTo(activeIndex + 1);
      startAutoplay();
    }, AUTOPLAY_MS);
  }

  function setPaused(value) {
    paused = value;
    if (paused) stopAutoplay();
    else startAutoplay();
  }

  function fitPreview() {
    if (stage.clientWidth) {
      stage.style.setProperty('--cx-scale', (stage.clientWidth / 1440).toFixed(4));
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        offscreen = !entry.isIntersecting;
        if (offscreen) stopAutoplay();
        else startAutoplay();
      });
    }, { threshold: 0.15 }).observe(root);

    const frameObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      framesArmed = true;
      frameObserver.disconnect();
      const queue = window.requestIdleCallback
        ? window.requestIdleCallback.bind(window)
        : (callback) => window.setTimeout(callback, 120);
      queue(syncFrames, { timeout: 700 });
    }, { rootMargin: '180px' });
    frameObserver.observe(root);
  } else {
    framesArmed = true;
    syncFrames();
  }

  /* Fine-pointer dragging stays available without registering touch handlers,
     so vertical swipes on phones always belong to the document scroller. */
  if (finePointer) {
    let dragging = false;
    let startX = 0;
    let deltaX = 0;
    let suppressClick = false;

    root.addEventListener('pointerdown', (event) => {
      dragging = true;
      startX = event.clientX;
      deltaX = 0;
      suppressClick = false;
      setPaused(true);
    });
    root.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      deltaX = event.clientX - startX;
      suppressClick = Math.abs(deltaX) > 8;
    });

    const release = () => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(deltaX) > 40) goTo(activeIndex + (deltaX < 0 ? 1 : -1));
      setPaused(false);
    };

    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('pointerleave', release);
    root.addEventListener('click', (event) => {
      if (suppressClick) {
        event.preventDefault();
        suppressClick = false;
      }
    }, true);
  }

  placeItems();
  fitPreview();
  window.addEventListener('resize', fitPreview, { passive: true });
  startAutoplay();
})();
