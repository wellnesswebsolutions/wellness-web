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
    document.body.style.overflow = open ? 'hidden' : '';
  }

  burger.addEventListener('click', () => setOpen(!tabs.classList.contains('open')));
  tabs.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
});
