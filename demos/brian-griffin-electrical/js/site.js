/* Brian Griffin Electrical Services — shared site behaviour. No dependencies. */
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

  /* Scroll reveal for elements already marked with .reveal in the markup. */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* Dynamic footer year. */
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();
})();
