/* Three example homepages, desktop preview only: a fixed 1440x900 iframe
   scaled down via CSS transform, so a small card still shows the site's
   real desktop layout. (There used to be a Mobile toggle too, but it's
   been dropped — back to a single, simple preview per card.) */
(() => {
  const grid = document.getElementById('exGrid');
  if (!grid) return;

  const DESKTOP_W = 1440, DESKTOP_H = 900;
  // Crops each site's own header off the top of the preview (it's just their
  // brand/logo — the card already gets its own fake browser chrome above it).
  const HEADER_CROP = 84;

  const examples = [
    { name: 'SISKŌ Hairdressing', tag: 'Hair salon · Beverley', url: 'https://sisko-hairdressing.vercel.app' },
    { name: 'Brian Griffin Electrical', tag: 'Electrician · Hull', url: 'https://brian-griffin-electrical.vercel.app' },
    { name: 'MGS Beverley', tag: 'Gardening & landscaping', url: 'https://mgs-beverley.vercel.app' },
  ];

  function scaleFrame(view, iframe, intrinsicW, intrinsicH, cropTop) {
    const scale = view.clientWidth / intrinsicW;
    iframe.style.width = `${intrinsicW}px`;
    iframe.style.height = `${intrinsicH}px`;
    iframe.style.transform = `scale(${scale}) translateY(-${cropTop}px)`;
    view.style.height = `${Math.round((intrinsicH - cropTop) * scale)}px`;
  }

  examples.forEach((ex) => {
    const card = document.createElement('article');
    card.className = 'ex-card';
    card.innerHTML = `
      <div class="ex-frame ex-frame-desktop is-active">
        <div class="ex-bar" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="ex-view"><iframe title="${ex.name} preview" loading="lazy" src="${ex.url}" tabindex="-1"></iframe></div>
      </div>
      <div class="ex-meta"><span>${ex.tag}</span></div>`;
    grid.appendChild(card);

    const desktopFrame = card.querySelector('.ex-frame-desktop');
    const desktopIframe = desktopFrame.querySelector('iframe');

    function layout() {
      scaleFrame(desktopFrame.querySelector('.ex-view'), desktopIframe, DESKTOP_W, DESKTOP_H, HEADER_CROP);
    }

    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(card);
    else window.addEventListener('resize', layout);
    layout();
  });

  /* One card centred at a time, the neighbours peeking off each edge —
     no arrows, no dots, just autoplay and drag/swipe, like the original
     carousel. Autoplay stops for good the moment a visitor drags it or
     clicks into a card, since at that point they're driving it themselves. */
  const carousel = document.getElementById('exCarousel');
  const slides = [...grid.children];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let active = 0;
  let timer = null;

  const VISIBLE_POSITIONS = new Set([-1, 0, 1]);

  function signedDistance(index) {
    let distance = ((index - active) % slides.length + slides.length) % slides.length;
    if (distance > slides.length / 2) distance -= slides.length;
    return distance;
  }

  function render() {
    slides.forEach((slide, i) => {
      const distance = signedDistance(i);
      slide.dataset.pos = VISIBLE_POSITIONS.has(distance) ? String(distance) : 'hidden';
    });
    // the stage is a position:relative box sized to the active card, since
    // its absolutely-positioned neighbours can't otherwise give it a height
    grid.style.height = `${slides[active].offsetHeight}px`;
  }

  function goTo(index) {
    active = ((index % slides.length) + slides.length) % slides.length;
    render();
  }

  function stopAutoplay() {
    if (!timer) return;
    window.clearInterval(timer);
    timer = null;
  }

  function startAutoplay() {
    if (timer || reduceMotion) return;
    timer = window.setInterval(() => goTo(active + 1), 6000);
  }

  // re-measure the stage height if the active card's own content changes size
  if ('ResizeObserver' in window) {
    slides.forEach((slide) => new ResizeObserver(() => {
      if (slide === slides[active]) grid.style.height = `${slide.offsetHeight}px`;
    }).observe(slide));
  }

  /* Fine-pointer dragging stays available without registering touch
     handlers, so vertical swipes on phones always belong to the page
     scroller (touch users instead just wait for autoplay or tap a peeking
     neighbour into the centre). */
  if (finePointer) {
    let dragging = false;
    let startX = 0;
    let deltaX = 0;
    let suppressClick = false;

    carousel.addEventListener('pointerdown', (e) => {
      dragging = true;
      startX = e.clientX;
      deltaX = 0;
      suppressClick = false;
      stopAutoplay();
    });
    carousel.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      deltaX = e.clientX - startX;
      suppressClick = Math.abs(deltaX) > 8;
    });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(deltaX) > 40) goTo(active + (deltaX < 0 ? 1 : -1));
    };
    carousel.addEventListener('pointerup', release);
    carousel.addEventListener('pointercancel', release);
    carousel.addEventListener('pointerleave', release);
    carousel.addEventListener('click', (e) => {
      if (suppressClick) { e.preventDefault(); suppressClick = false; return; }
      const card = e.target.closest('.ex-card');
      if (!card) return;
      const distance = signedDistance(slides.indexOf(card));
      if (distance !== 0) { stopAutoplay(); goTo(active + distance); }
    }, true);
  }

  grid.addEventListener('click', (e) => { if (e.target.closest('.ex-card')) stopAutoplay(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? startAutoplay() : stopAutoplay()));
    }, { threshold: 0.4 }).observe(carousel);
  } else {
    startAutoplay();
  }

  render();
})();
