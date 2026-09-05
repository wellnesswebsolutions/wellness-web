document.addEventListener('DOMContentLoaded', () => {
  const frame = document.getElementById('beforeDemoFrame');
  if (frame && typeof buildDemoHTML === 'function') {
    const load = () => {
      frame.srcdoc = buildDemoHTML({name:'SISKŌ', tagline:'Hair & Beauty', location:'Beverley', services:'Cuts, colour, styling', prices:'From £25', goal:'Book now', about:'', phone:'', stylePreset:'modern', logo:null, heroImage:null});
      const resize = () => { frame.style.transform = `scale(${frame.parentElement.clientWidth / 1440})`; };
      new ResizeObserver(resize).observe(frame.parentElement);
      resize();
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { load(); observer.disconnect(); }
    }, {rootMargin:'200px'});
    observer.observe(frame);
  }
  const cta = document.querySelector('.mobile-demo-cta');
  const form = document.getElementById('quickLead');
  if (cta && form) {
    new IntersectionObserver(entries => {
      cta.classList.toggle('is-visible', !entries[0].isIntersecting && entries[0].boundingClientRect.bottom < 0);
    }).observe(form);
    cta.addEventListener('click', () => document.getElementById('bizName').focus({preventScroll:true}));
  }
});
