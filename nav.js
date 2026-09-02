// Mobile nav: burger button opens the nav links as a full-screen overlay.
// Shared by every page (index, contact, pricing, work, terms) since the
// header markup is identical on all of them.
document.addEventListener('DOMContentLoaded', () => {
  const burger = document.getElementById('burgerBtn');
  const tabs = document.getElementById('navTabs');
  if (!burger || !tabs) return;

  function setOpen(open) {
    tabs.classList.toggle('open', open);
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('nav-open', open);
    document.body.classList.toggle('nav-open', open);
  }

  burger.addEventListener('click', () => setOpen(!tabs.classList.contains('open')));
  tabs.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  const desktop = window.matchMedia('(min-width: 821px)');
  const closeOnDesktop = (event) => {
    if (event.matches) setOpen(false);
  };
  if (desktop.addEventListener) desktop.addEventListener('change', closeOnDesktop);
  else desktop.addListener(closeOnDesktop);
});
