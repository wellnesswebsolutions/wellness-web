/* Three example homepages, each with a Desktop/Mobile toggle.
   Desktop: a fixed 1440x900 iframe scaled down via CSS transform, so a
   small card still shows the site's real desktop layout.
   Mobile: NOT the same scale trick — a transformed iframe's on-screen size
   has no effect on the framed page's own layout viewport, but it turned out
   some sites' mobile breakpoints didn't reliably kick in at the scaled
   390x844 anyway, rendering their desktop hero cropped into a short window.
   So the mobile frame instead gets a genuinely small native iframe (no
   transform) sized to the phone mockup's actual on-screen box — a real
   narrow viewport a site's own CSS can't mistake for desktop.
   The mobile iframe is only given a src the first time its tab is opened,
   so a visitor who never toggles never pays for a second cross-origin
   page load. */
(() => {
  const grid = document.getElementById('exGrid');
  if (!grid) return;

  const DESKTOP_W = 1440, DESKTOP_H = 900;

  const examples = [
    { name: 'SISKŌ Hairdressing', tag: 'Hair salon · Beverley', url: 'https://sisko-hairdressing.vercel.app' },
    { name: 'Brian Griffin Electrical', tag: 'Electrician · Hull', url: 'https://brian-griffin-electrical.vercel.app' },
    { name: 'MGS Beverley', tag: 'Gardening & landscaping', url: 'https://mgs-beverley.vercel.app' },
  ];

  function scaleFrame(view, iframe, intrinsicW, intrinsicH) {
    const scale = view.clientWidth / intrinsicW;
    iframe.style.width = `${intrinsicW}px`;
    iframe.style.height = `${intrinsicH}px`;
    iframe.style.transform = `scale(${scale})`;
    view.style.height = `${Math.round(intrinsicH * scale)}px`;
  }

  examples.forEach((ex) => {
    const card = document.createElement('article');
    card.className = 'ex-card';
    card.innerHTML = `
      <div class="ex-toggle" role="tablist" aria-label="Preview device for ${ex.name}">
        <button type="button" class="ex-tab is-active" data-device="desktop" role="tab" aria-selected="true">Desktop</button>
        <button type="button" class="ex-tab" data-device="mobile" role="tab" aria-selected="false">Mobile</button>
      </div>
      <div class="ex-frame ex-frame-desktop is-active">
        <div class="ex-bar" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="ex-view"><iframe title="${ex.name} desktop preview" loading="lazy" src="${ex.url}" tabindex="-1"></iframe></div>
      </div>
      <div class="ex-frame ex-frame-mobile">
        <div class="ex-notch" aria-hidden="true"></div>
        <div class="ex-view"><iframe title="${ex.name} mobile preview" loading="lazy" tabindex="-1"></iframe></div>
      </div>
      <div class="ex-meta"><span>${ex.tag}</span></div>`;
    grid.appendChild(card);

    const desktopFrame = card.querySelector('.ex-frame-desktop');
    const mobileFrame = card.querySelector('.ex-frame-mobile');
    const desktopIframe = desktopFrame.querySelector('iframe');
    const mobileIframe = mobileFrame.querySelector('iframe');
    const tabs = [...card.querySelectorAll('.ex-tab')];
    let mobileLoaded = false;

    function layout() {
      scaleFrame(desktopFrame.querySelector('.ex-view'), desktopIframe, DESKTOP_W, DESKTOP_H);
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const device = tab.dataset.device;
        tabs.forEach((t) => {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', String(t === tab));
        });
        desktopFrame.classList.toggle('is-active', device === 'desktop');
        mobileFrame.classList.toggle('is-active', device === 'mobile');
        if (device === 'mobile' && !mobileLoaded) {
          mobileIframe.src = ex.url;
          mobileLoaded = true;
        }
        layout();
      });
    });

    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(card);
    else window.addEventListener('resize', layout);
    layout();
  });

  /* One card visible at a time, autoplay every 6s. Autoplay stops for good
     the moment a visitor touches the carousel — clicks a card's own
     Desktop/Mobile toggle, or uses the arrows/dots — since at that point
     they're driving it themselves and an autoadvance would just yank the
     card out from under whatever they were looking at. */
  const carousel = document.getElementById('exCarousel');
  const dotsWrap = document.getElementById('exDots');
  const prevBtn = document.getElementById('exPrev');
  const nextBtn = document.getElementById('exNext');
  const slides = [...grid.children];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active = 0;
  let timer = null;

  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'ex-dot';
    dot.setAttribute('aria-label', `Show example ${i + 1}`);
    dotsWrap.appendChild(dot);
    return dot;
  });

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
    dots.forEach((d, i) => d.classList.toggle('is-active', i === active));
    // the stage is a position:relative box sized to the active card, since
    // its absolutely-positioned neighbours can't otherwise give it a height
    const activeSlide = slides[active];
    grid.style.height = `${activeSlide.offsetHeight}px`;
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

  // re-measure the stage height if the active card's own content changes
  // size (e.g. switching that card's Desktop/Mobile tab)
  if ('ResizeObserver' in window) {
    slides.forEach((slide) => new ResizeObserver(() => {
      if (slide === slides[active]) grid.style.height = `${slide.offsetHeight}px`;
    }).observe(slide));
  }

  dots.forEach((dot, i) => dot.addEventListener('click', () => { stopAutoplay(); goTo(i); }));
  prevBtn.addEventListener('click', () => { stopAutoplay(); goTo(active - 1); });
  nextBtn.addEventListener('click', () => { stopAutoplay(); goTo(active + 1); });
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
