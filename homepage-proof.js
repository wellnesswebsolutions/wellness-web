document.addEventListener('DOMContentLoaded', () => {
  const cta = document.querySelector('.mobile-demo-cta');
  const form = document.getElementById('quickLead');
  if (cta && form) {
    new IntersectionObserver(entries => {
      cta.classList.toggle('is-visible', !entries[0].isIntersecting && entries[0].boundingClientRect.bottom < 0);
    }).observe(form);
    cta.addEventListener('click', () => document.getElementById('bizName').focus({preventScroll:true}));
  }
});
