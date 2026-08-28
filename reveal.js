// Sleek scroll reveals: each block eases up out of a soft blur once, on entry.
// Groups (cards, list items) stagger so they arrive one after another.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // [selector, stagger step in ms] — groups share a parent, so siblings stagger
  var TARGETS = [
    ['.hero-conv .eyebrow', 0],
    ['.hero-conv h1', 0],
    ['.conv-col', 110],
    ['.sec-head .eyebrow', 0],
    ['.sec-head h3', 0],
    ['.sec-head p', 0],
    ['.page-hero .eyebrow', 0],
    ['.page-hero h1', 0],
    ['.page-hero p', 0],
    ['.ecard', 90],
    ['.founder', 0],
    ['.compare div', 90],
    ['.missed-band', 0],
    ['.missed-stats > div', 90],
    ['.missed-list div', 90],
    ['.missed-foot', 0],
    ['.demo', 110],
    ['.work-note', 0],
    ['.mgmt-head', 0],
    ['.plan', 100],
    ['.sub-card', 0],
    ['.ccard', 90],
    ['footer', 0]
  ];

  var seen = [];
  TARGETS.forEach(function (t) {
    var els = [].slice.call(document.querySelectorAll(t[0]));
    els.forEach(function (el, i) {
      if (seen.indexOf(el) > -1) return;      // never double-register a node
      seen.push(el);
      el.classList.add('reveal', 'reveal-blur');
      if (t[1]) el.style.transitionDelay = (i % 4) * t[1] + 'ms';
    });
  });

  if (!('IntersectionObserver' in window)) {
    seen.forEach(function (el) { el.classList.add('in'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);                 // one-way: no re-animating on scroll back
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

  seen.forEach(function (el) { io.observe(el); });

  // anything already on screen at load reveals together, so a block never
  // sits mid-animation over the one below it
  requestAnimationFrame(function () {
    seen.forEach(function (el) {
      if (el.getBoundingClientRect().top < innerHeight) {
        el.style.transitionDelay = '0ms';
        el.classList.add('in');
        io.unobserve(el);
      }
    });
  });
})();
