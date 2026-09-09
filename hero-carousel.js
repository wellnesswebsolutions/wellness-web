/* Drives the hero background photo to match the quiz: picking a business
   type in step 2 crossfades in that category's real scene photo (the same
   11 images HeroBrandCompositor paints the branded logo onto later), and
   typing a location in step 3 live-updates a caption over it. Purely a
   visual layer on top of the existing wizard in homepage-builder.js —
   it only reads bizTagline/bizLocation, never writes them, so it can't
   affect lead capture if anything here fails. */
document.addEventListener('DOMContentLoaded', () => {
  const heroConv = document.querySelector('.hero-conv');
  const stage = document.getElementById('heroStage');
  const imgA = document.getElementById('heroStageImgA');
  const imgB = document.getElementById('heroStageImgB');
  const caption = document.getElementById('heroStageCaption');
  const bizTagline = document.getElementById('bizTagline');
  const bizLocation = document.getElementById('bizLocation');
  if (!heroConv || !stage || !imgA || !imgB || !bizTagline || !bizLocation) return;
  if (typeof HeroBrandCompositor === 'undefined') return;

  const CAPTIONS = {
    'Hair & Beauty': 'The art of hair & beauty',
    'Aesthetics': 'Look and feel your best',
    'Health & Wellness': 'Feel better, live better',
    'Fitness': 'Train harder, together',
    'Automotive': 'Looked after, properly',
    'Trades': 'Reliable work, done right',
    'Home & Garden': 'Spaces you’ll love coming home to',
    'Food & Drink': 'Made fresh, served with care',
    'Professional Services': 'Expert help you can trust',
    'Creative': 'Ideas brought to life',
    'Pets': 'Loving care for your pets',
  };

  let front = imgA;
  let back = imgB;
  let currentType = '';

  function showScene(type) {
    if (!type || type === currentType) return;
    let source;
    try { source = HeroBrandCompositor.heroSource(type); } catch (e) { return; }
    if (!source) return;
    currentType = type;
    back.onload = () => {
      front.classList.remove('is-active');
      back.classList.add('is-active');
      stage.classList.add('is-active');
      heroConv.classList.add('has-scene');
      const tmp = front; front = back; back = tmp;
    };
    back.src = source;
  }

  function updateCaption() {
    const base = CAPTIONS[bizTagline.value] || '';
    const loc = bizLocation.value.trim();
    if (!base && !loc) { caption.classList.remove('is-active'); return; }
    const text = loc ? `${base}${base ? ' in ' : ''}${loc}` : base;
    caption.innerHTML = `${text}<span class="type-caret"></span>`;
    caption.classList.add('is-active');
  }

  bizTagline.addEventListener('change', () => { showScene(bizTagline.value); updateCaption(); });
  bizLocation.addEventListener('input', updateCaption);
});
