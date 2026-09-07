/* MGS Beverley — shared site behaviour. No dependencies. */
(function () {
  var MOBILE = '(max-width: 900px)';
  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav-toggle');
  var drop = document.querySelector('.has-drop');

  function isMobile() { return window.matchMedia(MOBILE).matches; }

  function closeMenu() {
    if (nav) nav.classList.remove('open');
    document.body.classList.remove('nav-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (drop) drop.classList.remove('open');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (!open && drop) drop.classList.remove('open');
    });
  }

  /* On mobile the Services link opens the submenu instead of navigating;
     the submenu's own "All Services" link goes to the page. */
  if (drop) {
    var parentLink = drop.querySelector('a');
    parentLink.addEventListener('click', function (e) {
      if (!isMobile()) return;
      e.preventDefault();
      drop.classList.toggle('open');
    });
    drop.querySelectorAll('.drop a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
  }

  /* Any other menu link closes the full-screen menu (in-page anchors included). */
  nav && nav.querySelectorAll(':scope > a').forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav && nav.classList.contains('open')) closeMenu();
  });

  window.addEventListener('resize', function () {
    if (!isMobile()) closeMenu();
  });

  /* Scroll reveals: fade up any .reveal element as it enters the viewport,
     plus staggered groups for galleries, service cards, area chips etc. */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var reveals = document.querySelectorAll('.reveal, .section-head');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  function stagger(selector, step) {
    var els = document.querySelectorAll(selector);
    if (!('IntersectionObserver' in window) || reduced) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var group = [].slice.call(e.target.parentElement.children).filter(function (c) { return c.matches(selector); });
        var i = group.indexOf(e.target);
        setTimeout(function () { e.target.classList.add('in'); }, i * step);
        io2.unobserve(e.target);
      });
    }, { threshold: .2, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io2.observe(el); });
  }
  stagger('.gallery-item, .gallery figure', 90);
  stagger('.svc-card', 70);
  stagger('.why-card', 90);
  stagger('.area-chip', 55);
  stagger('.trust-strip .wrap > div', 110);

  /* Header lifts / shrinks once you start scrolling. */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 40); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Gentle parallax + fade on the hero banner as you scroll away */
  var heroImg = document.getElementById('heroImg');
  if (heroImg && !reduced) {
    window.addEventListener('scroll', function () {
      var y = Math.min(window.scrollY, 500);
      heroImg.style.transform = 'translateY(' + (y * 0.08) + 'px) scale(' + (1 + y * 0.00004) + ')';
    }, { passive: true });
  }

  /* Gallery lightbox */
  var lb = document.getElementById('lightbox');
  if (lb) {
    var lbImg = lb.querySelector('img');
    var closeLb = function () { lb.classList.remove('show'); setTimeout(function () { lb.classList.remove('open'); }, 300); };
    document.querySelectorAll('.gallery-item, .gallery figure').forEach(function (item) {
      item.addEventListener('click', function () {
        var img = item.querySelector('img');
        if (!img) return;
        lbImg.src = img.src;
        lbImg.alt = img.alt;
        lb.classList.add('open');
        requestAnimationFrame(function () { lb.classList.add('show'); });
      });
    });
    lb.addEventListener('click', closeLb);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && lb.classList.contains('open')) closeLb(); });
  }

  /* Hide gallery tiles whose photo hasn't loaded (missing/placeholder images). */
  document.querySelectorAll('.gallery img, .gallery-item img').forEach(function (img) {
    function hide() { var el = img.closest('figure') || img.closest('.gallery-item'); if (el) el.style.display = 'none'; }
    img.addEventListener('error', hide);
    if (img.complete && img.naturalWidth === 0) hide();
  });

  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();
})();
