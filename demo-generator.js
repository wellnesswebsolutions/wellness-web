// Shared, pure demo-site generator — no DOM access, no UI logic.
// Included by both index.html (the live builder) and preview.html (a
// standalone, shareable rendering of one generated site from a URL param),
// so both stay byte-for-byte the same generator instead of drifting apart.
  // each business type's services are organised into ~6 groups of 5 (30
  // total), matching a real treatment-menu/price-list page. `services`/
  // `prices` (used for hidden auto-fill + homepage teaser tiles) are
  // derived from the groups by flattenGroups() below.
  function G(name, items) { return { name, items }; } // items: [label, price] pairs
  const BUSINESS_TYPES = [
    { label: 'Hair & Beauty', cat: 'hairbeauty', photo: 'hair-beauty-hero.jpg', theme: '#a89a92',
      tagline: 'Hair and beauty, done properly',
      desc: '{name} is a friendly, modern salon where every visit starts with a proper consultation, not a rushed guess. Whatever you’re after, our team takes the time to get it right.',
      groups: [
        G('Hair', [['Cuts & styling', 'From £32'], ['Colour & balayage', 'From £68'], ['Blow-dry', 'From £22'], ['Keratin treatment', 'From £85'], ['Hair extensions', 'From £150']]),
        G('Nails', [['Manicure', 'From £22'], ['Pedicure', 'From £28'], ['Gel extensions', 'From £38'], ['Nail art', 'From £8'], ['Acrylic infills', 'From £25']]),
        G('Facials & Skin', [['Classic facial', 'From £35'], ['Deep cleanse facial', 'From £45'], ['Micro-needling', 'From £90'], ['Chemical peel', 'From £65'], ['LED light therapy', 'From £30']]),
        G('Waxing', [['Full leg wax', 'From £25'], ['Underarm wax', 'From £10'], ['Bikini wax', 'From £18'], ['Facial wax', 'From £8'], ['Back & chest wax', 'From £22']]),
        G('Brows & Lashes', [['Brow shape & tint', 'From £15'], ['Lash lift', 'From £35'], ['Classic lashes', 'From £45'], ['Russian volume lashes', 'From £60'], ['Lash tint', 'From £12']]),
        G('Makeup & Tanning', [['Occasion makeup', 'From £35'], ['Bridal makeup', 'From £85'], ['Spray tan', 'From £25'], ['Makeup lesson', 'From £45'], ['Party makeup', 'From £30']])
      ] },
    { label: 'Aesthetics', cat: 'aesthetics', photo: 'aesthetics-hero.jpg', theme: '#ada7a3',
      tagline: 'Advanced treatments, honest advice',
      desc: '{name} offers professional-grade aesthetic treatments in a private, clinical setting. Every treatment starts with a proper consultation, so you know exactly what to expect.',
      groups: [
        G('Injectables', [['Anti-wrinkle treatment', 'From £150'], ['Dermal fillers', 'From £180'], ['Lip filler', 'From £160'], ['Jaw filler', 'From £250'], ['Profhilo', 'From £220']]),
        G('Skin Treatments', [['Chemical peel', 'From £65'], ['Microneedling', 'From £90'], ['Dermaplaning', 'From £45'], ['HydraFacial', 'From £75'], ['LED light therapy', 'From £30']]),
        G('Laser', [['Laser hair removal', 'From £35'], ['Skin resurfacing', 'From £120'], ['Pigmentation removal', 'From £80'], ['Thread vein removal', 'From £60'], ['Tattoo removal', 'From £50/session']]),
        G('Body', [['Fat dissolving injections', 'From £180'], ['Body contouring', 'From £150'], ['Cellulite treatment', 'From £90'], ['Skin tightening', 'From £120'], ['Body wrap', 'From £55']]),
        G('Advanced Facials', [['CACI facial', 'From £55'], ['Oxygen facial', 'From £60'], ['Radiofrequency facial', 'From £85'], ['Vitamin C facial', 'From £50'], ['Anti-ageing facial', 'From £70']]),
        G('Consultations', [['Skin consultation', 'Free'], ['Patch test', 'Free'], ['Treatment planning', 'Free'], ['Follow-up review', 'From £20'], ['Virtual consultation', 'Free']])
      ] },
    { label: 'Health & Wellness', cat: 'health', photo: 'health-wellness-hero.webp', theme: '#9e826b',
      tagline: 'Feel better, move better',
      desc: '{name} helps you feel and move better, with treatments built around what your body actually needs — not a generic routine.',
      groups: [
        G('Massage', [['Swedish massage', 'From £45'], ['Deep tissue massage', 'From £55'], ['Sports massage', 'From £50'], ['Hot stone massage', 'From £60'], ['Pregnancy massage', 'From £50']]),
        G('Physiotherapy', [['Initial assessment', 'From £55'], ['Sports injury treatment', 'From £50'], ['Rehab programme', 'Get a quote'], ['Postural assessment', 'From £40'], ['Follow-up session', 'From £40']]),
        G('Alternative Therapies', [['Acupuncture', 'From £40'], ['Reflexology', 'From £35'], ['Reiki', 'From £40'], ['Cupping therapy', 'From £45'], ['Aromatherapy', 'From £40']]),
        G('Mental Wellness', [['Counselling session', 'From £50'], ['Mindfulness coaching', 'From £45'], ['Stress management', 'From £45'], ['Life coaching', 'From £60'], ['Group therapy', 'From £25']]),
        G('Nutrition', [['Nutrition consultation', 'From £45'], ['Meal planning', 'From £35'], ['Weight management', 'From £40'], ['Food intolerance testing', 'From £75'], ['Follow-up review', 'From £30']]),
        G('Clinics', [['Health screening', 'From £60'], ['Blood pressure check', 'From £15'], ['Vaccination', 'From £25'], ['Travel clinic', 'From £35'], ['General consultation', 'From £40']])
      ] },
    { label: 'Fitness', cat: 'fitness', photo: 'fitness-hero.jpg', theme: '#a39b94',
      tagline: 'Training plans built around real life',
      desc: '{name} builds training plans around real life, not just the gym. Whether it’s 1-to-1 coaching, group sessions or nutrition advice, the goal is progress you can actually stick to.',
      groups: [
        G('Personal Training', [['1-to-1 training', 'From £45'], ['Couples training', 'From £65'], ['Small group training', 'From £20'], ['Online coaching', 'From £60/mo'], ['Assessment session', 'From £25']]),
        G('Classes', [['HIIT class', 'From £12'], ['Yoga class', 'From £10'], ['Spin class', 'From £12'], ['Pilates class', 'From £12'], ['Boxing class', 'From £14']]),
        G('Nutrition & Body', [['Nutrition plan', 'From £80'], ['Body composition scan', 'From £25'], ['Meal prep guidance', 'From £40'], ['Supplement advice', 'Free'], ['Progress review', 'From £20']]),
        G('Memberships', [['Monthly membership', 'From £35/mo'], ['Annual membership', 'From £350/yr'], ['Day pass', 'From £10'], ['Class pack (10)', 'From £90'], ['Student membership', 'From £25/mo']]),
        G('Recovery', [['Sports massage', 'From £45'], ['Stretching session', 'From £25'], ['Recovery room access', 'From £15'], ['Ice bath', 'From £15'], ['Cryotherapy', 'From £35']]),
        G('Specialist', [['Pre/post-natal training', 'From £45'], ['Youth training', 'From £30'], ['Senior fitness', 'From £30'], ['Rehab training', 'From £45'], ['Sports-specific training', 'From £50']])
      ] },
    { label: 'Automotive', cat: 'automotive', photo: 'automotive-hero.jpg', theme: '#7f8790',
      tagline: 'Honest, no-nonsense car care',
      desc: '{name} is your local garage for honest, no-nonsense car care. Our qualified team explains what your car actually needs — and nothing it doesn’t.',
      groups: [
        G('Servicing', [['Full service', 'From £120'], ['Interim service', 'From £80'], ['MOT testing', 'From £45'], ['Diagnostics', 'From £60'], ['Oil change', 'From £45']]),
        G('Repairs', [['Brake repair', 'From £150'], ['Clutch replacement', 'From £350'], ['Suspension repair', 'From £120'], ['Exhaust repair', 'From £80'], ['Engine repair', 'Get a quote']]),
        G('Tyres & Wheels', [['Tyre fitting', 'From £25'], ['Wheel alignment', 'From £45'], ['Wheel balancing', 'From £20'], ['Puncture repair', 'From £15'], ['Tyre pressure check', 'Free']]),
        G('Valeting', [['Full valet', 'From £60'], ['Interior detail', 'From £80'], ['Exterior wash', 'From £15'], ['Engine bay clean', 'From £30'], ['Ceramic coating', 'From £250']]),
        G('Air Con & Electrics', [['Air con regas', 'From £50'], ['Battery replacement', 'From £80'], ['Electrical diagnostics', 'From £45'], ['Alternator repair', 'From £150'], ['Starter motor repair', 'From £150']]),
        G('Bodywork', [['Dent removal', 'From £60'], ['Scratch repair', 'From £50'], ['Paint correction', 'From £150'], ['Bumper repair', 'From £120'], ['Alloy wheel refurb', 'From £45']])
      ] },
    { label: 'Trades', cat: 'trades', photo: 'trades-hero.jpg', theme: '#6b625c',
      tagline: 'Fast, fully qualified tradework',
      desc: '{name} is on call for the jobs that can’t wait, and the projects that can. Fully qualified, fully insured, and always upfront about pricing before we start.',
      groups: [
        G('Plumbing', [['Emergency call-out', 'From £75'], ['Boiler repair', 'From £150'], ['Boiler installation', 'Get a quote'], ['Leak detection', 'From £65'], ['Tap & toilet repair', 'From £55']]),
        G('Electrical', [['Rewiring', 'Get a quote'], ['Fuse box upgrade', 'From £350'], ['Socket & switch fitting', 'From £45'], ['PAT testing', 'From £3 per item'], ['EV charger install', 'From £650']]),
        G('Building', [['Extensions', 'Get a quote'], ['Loft conversions', 'Get a quote'], ['Renovations', 'Get a quote'], ['Groundwork', 'Get a quote'], ['Plastering', 'From £250']]),
        G('Roofing', [['Roof repair', 'From £150'], ['Re-roofing', 'Get a quote'], ['Guttering', 'From £120'], ['Flat roof repair', 'From £180'], ['Chimney repair', 'From £200']]),
        G('Locksmith & Security', [['Lock changes', 'From £65'], ['Emergency lockout', 'From £85'], ['Key cutting', 'From £5'], ['Security upgrades', 'Get a quote'], ['uPVC door repair', 'From £75']]),
        G('Cleaning', [['Domestic cleaning', 'From £15/hr'], ['End of tenancy clean', 'From £120'], ['Carpet cleaning', 'From £45'], ['Window cleaning', 'From £15'], ['Office cleaning', 'From £18/hr']])
      ] },
    { label: 'Home & Garden', cat: 'homegarden', photo: 'home-garden-hero.jpg', theme: '#6b7a4a',
      tagline: 'Spaces people love spending time in',
      desc: '{name} designs and maintains outdoor spaces people actually want to spend time in. From a one-off tidy-up to a full redesign, we work with your space, not against it.',
      groups: [
        G('Garden Design', [['Design consultation', 'From £75'], ['Planting plan', 'From £120'], ['Landscape design', 'Get a quote'], ['Patio design', 'From £90'], ['3D garden visual', 'From £150']]),
        G('Maintenance', [['Lawn care', 'From £35'], ['Hedge trimming', 'From £45'], ['Weeding & tidy-up', 'From £40'], ['Seasonal clean-up', 'From £80'], ['Regular maintenance visit', 'From £30']]),
        G('Landscaping', [['Tree surgery', 'From £150'], ['Fencing', 'From £45/m'], ['Patio & decking', 'Get a quote'], ['Turfing', 'From £25/m²'], ['Drainage work', 'Get a quote']]),
        G('Interior', [['Interior design consultation', 'From £85'], ['Home staging', 'Get a quote'], ['Curtains & blinds', 'From £120'], ['Furniture assembly', 'From £40'], ['Room makeover', 'Get a quote']]),
        G('Renovation', [['Kitchen fitting', 'Get a quote'], ['Bathroom renovation', 'Get a quote'], ['Painting & decorating', 'From £200'], ['Flooring', 'From £25/m²'], ['Plastering', 'From £250']]),
        G('Outdoor Living', [['Garden building install', 'Get a quote'], ['Outdoor lighting', 'From £150'], ['Water features', 'From £250'], ['BBQ area build', 'Get a quote'], ['Furniture assembly', 'From £45']])
      ] },
    { label: 'Food & Drink', cat: 'fooddrink', photo: 'food-drink-hero.jpg', theme: '#7a5c3d',
      tagline: 'Made properly, every time',
      desc: '{name} makes everything properly, with ingredients that matter. A spot for people who care about what they’re eating and drinking.',
      groups: [
        G('Bakery', [['Fresh bread', 'From £3.50'], ['Pastries', 'From £2.80'], ['Custom cakes', 'From £35'], ['Cupcakes', 'From £2.50'], ['Celebration cakes', 'From £55']]),
        G('Cafe', [['Coffee & drinks', 'From £3'], ['Breakfast & brunch', 'From £6.50'], ['Sandwiches & light bites', 'From £5.50'], ['Afternoon tea', 'From £18'], ['Loyalty card', 'Free']]),
        G('Dining', [['A la carte dining', 'From £18'], ['Set menu', 'From £25'], ['Sunday roast', 'From £16'], ['Tasting menu', 'From £45'], ['Private dining', 'Get a quote']]),
        G('Takeaway & Delivery', [['Takeaway', 'From £12'], ['Delivery', 'From £14'], ['Click & collect', 'From £10'], ['Meal deals', 'From £15'], ['Party platters', 'From £35']]),
        G('Events & Catering', [['Private events', 'Get a quote'], ['Wedding catering', 'Get a quote'], ['Corporate catering', 'Get a quote'], ['Buffet catering', 'From £12/head'], ['Drinks packages', 'Get a quote']]),
        G('Drinks', [['Cocktails', 'From £9'], ['Wine list', 'From £24/bottle'], ['Craft beer', 'From £5'], ['Coffee subscription', 'From £15/mo'], ['Tasting sessions', 'From £25']])
      ] },
    { label: 'Professional Services', cat: 'professional', photo: 'professional-services-hero.jpg', theme: '#8a4a3d',
      tagline: 'Clear advice, no jargon',
      desc: '{name} keeps things straightforward, with clear advice and deadlines that never sneak up on you. One trusted team, from start to finish.',
      groups: [
        G('Accounting', [['Tax returns', 'From £150'], ['Bookkeeping', 'From £40/mo'], ['VAT returns', 'From £60'], ['Payroll', 'From £25/mo'], ['Annual accounts', 'From £250']]),
        G('Business Advice', [['Business planning', 'From £150'], ['Start-up advice', 'From £75'], ['Growth strategy', 'Get a quote'], ['Financial forecasting', 'From £120'], ['Advisory session', 'From £75/hr']]),
        G('Legal', [['Contract review', 'From £120'], ['Will writing', 'From £150'], ['Conveyancing', 'Get a quote'], ['Legal consultation', 'From £60'], ['Dispute resolution', 'Get a quote']]),
        G('Property', [['Property sales', 'Get a quote'], ['Lettings', 'Get a quote'], ['Valuations', 'Free valuation'], ['Property management', 'Get a quote'], ['Land & new build', 'Get a quote']]),
        G('Financial', [['Mortgage advice', 'Free'], ['Pension advice', 'From £150'], ['Investment advice', 'Get a quote'], ['Insurance advice', 'Free'], ['Financial planning', 'From £200']]),
        G('Consulting', [['Strategy consulting', 'Get a quote'], ['IT consulting', 'From £85/hr'], ['HR consulting', 'From £75/hr'], ['Marketing consulting', 'From £75/hr'], ['Project management', 'Get a quote']])
      ] },
    { label: 'Creative', cat: 'creative', photo: 'creative-hero.jpg', theme: '#3f4a3d',
      tagline: 'The moments that actually matter',
      desc: '{name} captures the moments that actually matter. A relaxed, professional approach that means natural results every time.',
      groups: [
        G('Photography', [['Portraits', 'From £120'], ['Family sessions', 'From £150'], ['Weddings', 'From £950'], ['Newborn photography', 'From £180'], ['Event photography', 'From £250']]),
        G('Commercial', [['Product photography', 'From £200'], ['Commercial shoots', 'Get a quote'], ['Branding photography', 'From £250'], ['Real estate photography', 'From £120'], ['Food photography', 'From £180']]),
        G('Video', [['Wedding videography', 'From £850'], ['Promotional video', 'Get a quote'], ['Event videography', 'From £300'], ['Drone footage', 'From £150'], ['Video editing', 'From £50/hr']]),
        G('Design', [['Logo design', 'From £250'], ['Brand identity', 'From £600'], ['Print design', 'From £120'], ['Web design', 'Get a quote'], ['Social media graphics', 'From £80']]),
        G('Editing & Retouching', [['Photo editing', 'From £5/image'], ['Retouching', 'From £15/image'], ['Album design', 'From £150'], ['Colour grading', 'From £80'], ['Video editing', 'From £50/hr']]),
        G('Prints & Products', [['Framed prints', 'From £35'], ['Photo books', 'From £65'], ['Canvas prints', 'From £45'], ['Digital downloads', 'From £10'], ['Prop hire', 'From £20']])
      ] },
    { label: 'Pets', cat: 'pets', photo: 'pets-hero.jpg', theme: '#c08a3d',
      tagline: 'Calm, gentle care for your pet',
      desc: '{name} gives your pet a calm, gentle experience from start to finish. Always handled with patience and care.',
      groups: [
        G('Grooming', [['Full groom', 'From £35'], ['Bath & brush', 'From £20'], ['Nail trim', 'From £10'], ['De-shedding treatment', 'From £15'], ['Puppy introduction groom', 'From £18']]),
        G('Styling', [['Breed-specific trim', 'From £40'], ['Hand stripping', 'From £45'], ['Teeth cleaning', 'From £15'], ['Ear cleaning', 'From £8'], ['Creative grooming', 'From £25']]),
        G('Health & Care', [['Flea treatment', 'From £12'], ['Anal gland expression', 'From £10'], ['Skin & coat treatment', 'From £15'], ['Health check', 'From £20'], ['Microchipping', 'From £20']]),
        G('Boarding & Daycare', [['Dog boarding', 'From £25/night'], ['Cat boarding', 'From £18/night'], ['Doggy daycare', 'From £20/day'], ['Dog walking', 'From £12'], ['Pet sitting', 'From £15/visit']]),
        G('Training', [['Puppy training', 'From £45'], ['Obedience training', 'From £40'], ['Behaviour consultation', 'From £65'], ['Group classes', 'From £15'], ['1-to-1 training', 'From £50']]),
        G('Extras', [['Pet taxi', 'From £15'], ['Photography session', 'From £45'], ['Spa treatment', 'From £30'], ['Pawdicure', 'From £8'], ['Aromatherapy', 'From £12']])
      ] },
    { label: 'Other', cat: 'other',
      tagline: 'Tell us what makes you different',
      desc: '{name} is a business that cares about doing things properly — tell us more about what makes you different and this paragraph will describe it.',
      groups: [
        G('General Services', [['Consultation', 'Free'], ['Custom service', 'Get a quote'], ['Callout', 'Get a quote'], ['One-off project', 'Get a quote'], ['Assessment', 'From £25']]),
        G('Ongoing', [['Ongoing support', 'Get a quote'], ['Maintenance plan', 'Get a quote'], ['Subscription service', 'Get a quote'], ['Regular visit', 'Get a quote'], ['Membership', 'Get a quote']]),
        G('Specialist', [['Specialist service', 'Get a quote'], ['Advanced service', 'Get a quote'], ['Premium service', 'Get a quote'], ['Bespoke service', 'Get a quote'], ['Priority service', 'Get a quote']]),
        G('Add-ons', [['Add-on service', 'Get a quote'], ['Upgrade', 'Get a quote'], ['Extra', 'Get a quote'], ['Enhancement', 'Get a quote'], ['Extension', 'Get a quote']]),
        G('Consultation', [['Initial consultation', 'Free'], ['Follow-up', 'Get a quote'], ['Review session', 'Get a quote'], ['Planning session', 'Get a quote'], ['Assessment', 'Get a quote']]),
        G('Custom', [['Bespoke project', 'Get a quote'], ['Custom order', 'Get a quote'], ['Special request', 'Get a quote'], ['Tailored package', 'Get a quote'], ['Made to measure', 'Get a quote']])
      ] }
  ];
  function flattenGroups(t) {
    const items = t.groups.reduce((all, g) => all.concat(g.items), []);
    return { services: items.map(i => i[0]), prices: items.map(i => i[1]) };
  }
  function typeInfo(label) { return BUSINESS_TYPES.find(t => t.label === label); }

  // ---- wall-scene illustration behind the hero copy, per business category ----
  function sceneSVG(cat, tones) {
    const wallDark = (tones && tones.dark) || '#8a6d72';
    const wallBase = (tones && tones.base) || '#a3878b';
    // every category now has a real photo except Health & Wellness and
    // Other, which fall back to one of these illustrated wall scenes
    const propsByCategory = {
      health: `
        <g fill="rgba(0,0,0,.24)">
          <rect x="60" y="360" width="30" height="60" rx="6"/>
          <rect x="220" y="360" width="30" height="60" rx="6"/>
          <rect x="80" y="380" width="150" height="20" rx="10"/>
        </g>
        <g fill="rgba(0,0,0,.16)">
          <rect x="600" y="70" width="70" height="20" rx="4"/>
          <rect x="625" y="45" width="20" height="70" rx="4"/>
        </g>`,
      office: `
        <rect x="580" y="60" width="120" height="90" rx="4" fill="none" stroke="rgba(0,0,0,.24)" stroke-width="6"/>
        <rect x="592" y="72" width="96" height="66" fill="rgba(0,0,0,.1)"/>
        <path d="M60 420 q0 -110 40 -110 q40 0 40 110 z" fill="rgba(0,0,0,.18)"/>`
    };
    const props = propsByCategory[cat] || propsByCategory.office;
    return `<svg viewBox="0 0 800 460" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%">
      <rect width="800" height="460" fill="${wallDark}"/>
      <rect width="800" height="460" fill="url(#wallGrad)"/>
      <defs><linearGradient id="wallGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${wallBase}" stop-opacity=".5"/>
        <stop offset="100%" stop-color="${wallDark}" stop-opacity="0"/>
      </linearGradient></defs>
      <rect x="0" y="400" width="800" height="60" fill="rgba(0,0,0,.32)"/>
      ${props}
    </svg>`;
  }
  // ---- colour picker: turn one chosen swatch into a light/base/dark trio ----
  function hexToHsl(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  }
  function tonesFromHex(hex) {
    const [h, s] = hexToHsl(hex);
    return {
      light: hslToHex(h, Math.max(s - 14, 16), 86),
      base: hex,
      dark: hslToHex(h, Math.min(s + 2, 70), 44)
    };
  }
  function esc(s) { return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  // customers type answers however they like ("isla spa", "HULL") — title
  // case them for anywhere they're displayed, so the generated site reads
  // as professionally as a real one, regardless of typing habits.
  function toTitleCase(s) {
    return (s || '').replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }
  function buildDemoHTML(rawD) {
    const d = Object.assign({}, rawD, { name: toTitleCase(rawD.name), location: toTitleCase(rawD.location) });
    const info = typeInfo(d.tagline);
    const services = d.services.length ? d.services : ['Service one', 'Service two', 'Service three'];
    const prices = d.prices || [];
    const goalLabel = d.goal || 'Book now';
    const cardBlurbs = [
      s => `One of the most requested treatments here — ask about ${esc(s.toLowerCase())} and we'll take it from there.`,
      s => `${esc(s)}, done properly, every time. Get in touch to check availability.`,
      s => `Popular with regulars. Get in touch and we'll talk you through ${esc(s.toLowerCase())}.`
    ];
    // 3 tile cards for the homepage "most popular" teaser — always the
    // first 3 items of the first group (or the flat list as a fallback)
    const popularCards = services.slice(0, 3).map((s, i) => `
        <a class="card card-link" href="#" data-nav="services">
          <span class="num">Most Popular · ${esc(s)}</span>
          <h3>${esc(s)}${prices[i] ? `<span class="card-price">${esc(prices[i])}</span>` : ''}</h3>
          <p>${cardBlurbs[i % cardBlurbs.length](s)}</p>
          <span class="card-cta">Learn more</span>
        </a>`).join('');
    // Services page: grouped sections (Bayar-style treatment menu) when
    // the type has groups, otherwise a flat list of whatever's in d.services
    function serviceRowsFor(items, offset) {
      return items.map(([s, price], i) => `
        <div class="service-row">
          <div class="service-row-main">
            <h3>${esc(s)}</h3>
            <p>${cardBlurbs[(offset + i) % cardBlurbs.length](s)}</p>
          </div>
          ${price ? `<span class="service-row-price">${esc(price)}</span>` : ''}
        </div>`).join('');
    }
    const serviceGroups = info && info.groups
      ? info.groups.map((g, i) => `
        <div class="service-group" id="svc-group-${i}">
          <h3 class="service-group-title">${esc(g.name)}</h3>
          <div class="service-list">${serviceRowsFor(g.items, 0)}</div>
        </div>`).join('')
      : `<div class="service-list">${serviceRowsFor(services.map((s, i) => [s, prices[i]]), 0)}</div>`;
    // category tiles at the top of the services page — one per treatment
    // group, in a 3x2 grid (Bayar Beauty-style), jumping down to that group
    const categoryTiles = info && info.groups
      ? info.groups.map((g, i) => `
        <a class="cat-tile" href="#svc-group-${i}">
          <h3>${esc(g.name)}</h3>
        </a>`).join('')
      : '';
    const tags = services.slice(0, 4).map(s => `<span>${esc(s)}</span>`).join('');
    // fake but plausible contact details for the demo — Ofcom reserves
    // 07700 900xxx for fictional use, so it's never a real number.
    const nameSeed = d.name.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const fakePhone = '07700 900' + String(100 + (nameSeed % 900)).padStart(3, '0');
    const emailSlug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'business';
    const fakeEmail = `hello@${emailSlug}.co.uk`;
    const fakeStreetNum = 1 + (nameSeed % 98);
    const streetNames = ['High Street', 'Market Street', 'Church Lane', 'Victoria Road', 'Mill Lane'];
    const fakeStreet = streetNames[nameSeed % streetNames.length];
    const fakeAddress = `${fakeStreetNum} ${fakeStreet}`;
    const fakePostcode = String.fromCharCode(65 + (nameSeed % 26)) + String.fromCharCode(65 + ((nameSeed >> 3) % 26))
      + (1 + (nameSeed % 9)) + ' ' + (1 + ((nameSeed >> 2) % 9)) + String.fromCharCode(65 + ((nameSeed >> 5) % 26)) + String.fromCharCode(65 + ((nameSeed >> 7) % 26));
    // colour scheme: whatever the customer picked in step 2, otherwise a
    // palette derived from their category's own hero photo (so a demo
    // for e.g. Automotive doesn't default to a rose/taupe salon palette)
    const t = d.tones || (info && info.theme ? tonesFromHex(info.theme) : { light: '#d9cdc1', base: '#a3878b', dark: '#8a6d72' });
    const gallery = Array.from({length: 6}).map((_, i) => `
        <figure style="display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);
          font-size:.68rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
          background:linear-gradient(${135 + i * 20}deg,${t.dark},${t.light})">Add your photos</figure>`).join('');
    const eyebrowLoc = d.location ? `Based in ${esc(d.location)}` : 'Now booking';
    const cat = info ? info.cat : 'office';
    const defaultDesc = info ? info.desc.replace(/\{name\}/g, d.name) : `${d.name} is a business that cares about doing things properly — tell us more about what makes you different and this paragraph will describe it.`;
    const heroHook = info ? info.tagline : (d.tagline || 'Tell us what makes you different — this line introduces your business.');
    const heroSub = d.tagline ? `${d.tagline} — ${heroHook}` : heroHook;
    const metaDesc = (heroHook + '. ' + defaultDesc).slice(0, 155).replace(/\s+\S*$/, '') + '.';
    const categoryPhoto = info && info.photo ? `https://wellnessweb.co.uk/img/hero/${info.photo}` : null;
    const usingCategoryPhoto = !d.heroImage && !!categoryPhoto;
    const sceneMarkup = (d.heroImage || usingCategoryPhoto) ? '' : sceneSVG(cat, t);
    const initials = d.name.trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const heroBg = d.heroImage
      ? `url('${d.heroImage}') center/cover no-repeat`
      : usingCategoryPhoto
        ? `url('${categoryPhoto}') center/cover no-repeat`
        : `linear-gradient(155deg,${t.dark},${t.light})`;
    const brandMark = d.logo
      ? `<img src="${d.logo}" alt="${esc(d.name)} logo" style="height:38px;width:auto;display:block">`
      : esc(d.name);
    return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.name)}${d.tagline ? ' | ' + esc(d.tagline) : ''}${d.location ? ' in ' + esc(d.location) : ''}</title>
<meta name="description" content="${esc(metaDesc)}">
<meta name="theme-color" content="#f6efe9">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#1c1815;--body:#3a3330;--muted:#6f635c;--champagne:#f6efe9;--champagne-2:#efe4db;--taupe:${t.light};--rose:${t.base};--rose-dark:${t.dark};--line:rgba(28,24,21,.12);--radius:2px;--shadow:0 18px 50px rgba(28,24,21,.10)}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:110px}
body{margin:0;padding-top:37px;font-family:'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.75;color:var(--body);background:#fff;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:var(--rose-dark)}
h1,h2,h3,h4{color:var(--ink);font-weight:600;line-height:1.2;margin:0 0 .6em;letter-spacing:-.01em}
h1{font-size:clamp(2.1rem,5.5vw,3.6rem);font-weight:300;letter-spacing:.01em}
h2{font-size:clamp(1.6rem,3.4vw,2.4rem);font-weight:300}
h3{font-size:1.05rem;font-weight:600}
p{margin:0 0 1.1em}
.container{width:100%;max-width:1140px;margin:0 auto;padding:0 22px}
.section{padding:5.5em 0}
.section--tint{background:var(--champagne)}
.page-head{padding-bottom:3.2em}
@media(max-width:767px){.section{padding:3.5em 0}}
.eyebrow{display:block;font-size:.7rem;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--rose-dark);margin-bottom:1em}
.lede{font-size:1.06rem;color:var(--body);max-width:62ch}
.center{text-align:center}
.center .lede{margin-left:auto;margin-right:auto}
.btn{display:inline-block;padding:15px 30px;border:1px solid var(--ink);background:var(--ink);color:#fff;text-decoration:none;border-radius:var(--radius);font-size:.72rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;transition:background .25s,color .25s,border-color .25s,transform .25s,box-shadow .25s}
.btn:hover{background:transparent;color:var(--ink);transform:translateY(-2px);box-shadow:0 10px 22px rgba(28,24,21,.16)}
.btn--ghost{background:transparent;color:var(--ink)}
.btn--ghost:hover{background:var(--ink);color:#fff}
.btn--light{background:#fff;border-color:#fff;color:var(--ink)}
.btn--light:hover{background:transparent;color:#fff;border-color:#fff}
.btn--outline-light{background:transparent;border-color:rgba(255,255,255,.75);color:#fff}
.btn--outline-light:hover{background:#fff;color:var(--ink);border-color:#fff}
.btn-row{display:flex;flex-wrap:wrap;gap:12px}
.center .btn-row{justify-content:center}
.site-header{position:fixed;top:37px;left:0;right:0;z-index:50;background:color-mix(in srgb, var(--taupe) 28%, var(--champagne));border-bottom:1px solid rgba(28,24,21,.07);box-shadow:0 1px 14px rgba(28,24,21,.05)}
.site-header .container{display:flex;align-items:center;gap:16px;min-height:74px}
.brand{display:flex;flex-direction:row;align-items:center;text-decoration:none;color:var(--ink);margin-right:auto;font-weight:700;font-size:1.2rem}
.brand-text{display:flex;flex-direction:column;line-height:1.1}
.brand span{font-size:.55rem;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--rose-dark);margin-top:2px}
.nav{display:flex;align-items:center;gap:24px}
.nav a{text-decoration:none;color:var(--ink);font-size:.72rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;padding:6px 0;border-bottom:1px solid transparent}
.nav a:hover{border-bottom-color:var(--ink)}
.nav a.btn{padding:11px 20px;color:#fff}
.nav a.btn:hover{background:transparent;color:var(--ink)}
@media(max-width:760px){.nav{display:none}}
.hero{position:relative;margin-top:75px;background:${heroBg};display:flex;align-items:flex-end;overflow:hidden;min-height:min(72vh,680px)}
.hero-photo-note{position:absolute;z-index:3;right:14px;bottom:14px;font-size:.66rem;font-style:italic;color:rgba(255,255,255,.75);
  text-shadow:0 1px 6px rgba(0,0,0,.5);pointer-events:none}
@media(max-width:760px){.hero-photo-note{left:14px;right:14px;text-align:center}}
.hero::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(to right,rgba(28,24,21,.55) 0%,rgba(28,24,21,.28) 34%,rgba(28,24,21,0) 62%),linear-gradient(to top,rgba(28,24,21,.8) 0%,rgba(28,24,21,.6) 26%,rgba(28,24,21,.24) 54%,rgba(28,24,21,0) 82%)}
.hero .hero-copy{position:relative;z-index:2;width:100%;padding:0 0 3.4em}
.hero .inner{max-width:1140px;margin:0 auto;padding:0 22px}
.hero h1,.hero p{color:#fff}
.hero-title{font-size:clamp(2.3rem,5.2vw,4rem);font-weight:300;line-height:1.05;margin:0 0 .3em;text-shadow:0 2px 20px rgba(28,24,21,.4)}
.hero .hero-sub{font-size:clamp(1.02rem,1.9vw,1.25rem);font-weight:300;max-width:36ch;margin-bottom:1.8em;text-shadow:0 2px 14px rgba(28,24,21,.35)}
.hero .eyebrow{color:rgba(255,255,255,.85)}
.hero-tags{display:flex;flex-wrap:wrap;gap:10px 26px;margin-top:2em;font-size:.68rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.85)}
.brand-badge{flex:none;width:28px;height:28px;border-radius:50%;background:var(--rose-dark);
  display:flex;align-items:center;justify-content:center;margin-right:10px;
  font-family:'Montserrat',sans-serif;font-weight:700;letter-spacing:.02em;color:#fff;font-size:.7rem}
@media(max-width:900px){
  .site-header{top:64px}
  .hero{min-height:min(60vh,480px);margin-top:75px}
  .hero .hero-copy{padding:2.2em 0;text-align:center}
  .hero .inner{display:flex;flex-direction:column;align-items:center}
  .hero .btn-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:420px}
  .hero-tags{display:none}
}
.grid{display:grid;gap:26px}
.grid-2{grid-template-columns:repeat(2,1fr)}
.grid-3{grid-template-columns:repeat(3,1fr)}
@media(max-width:860px){.grid-3{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.grid-2,.grid-3{grid-template-columns:1fr}}
.card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:32px 28px;box-shadow:var(--shadow);transition:transform .3s,box-shadow .3s}
.card:hover{transform:translateY(-4px);box-shadow:0 26px 60px rgba(28,24,21,.14)}
.card .num{display:block;font-size:.7rem;font-weight:700;letter-spacing:.22em;color:var(--rose-dark);margin-bottom:1em}
.card h3{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
.card-price{font-size:.62rem;font-weight:700;letter-spacing:.06em;color:var(--rose-dark);background:var(--champagne);
  border:1px solid var(--line);border-radius:999px;padding:4px 10px;white-space:nowrap}
.card-hook{display:block;font-style:italic;font-size:.82rem;color:var(--rose-dark);margin:.3em 0 .9em}
.card p:last-child{margin-bottom:0}
.card-link{display:block;text-decoration:none;color:inherit}
.card-cta{display:inline-flex;align-items:center;gap:8px;margin-top:1.2em;font-size:.66rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--rose-dark)}
.cat-grid{gap:12px;margin-bottom:1em}
.cat-tile{display:flex;align-items:center;justify-content:center;text-align:center;background:#fff;border:1px solid var(--line);
  border-radius:var(--radius);padding:18px 16px;min-height:64px;box-shadow:var(--shadow);text-decoration:none;color:inherit;
  transition:transform .3s,box-shadow .3s}
.cat-tile:hover{transform:translateY(-4px);box-shadow:0 26px 60px rgba(28,24,21,.14)}
.cat-tile h3{margin:0;font-size:.98rem}
.service-group{margin-bottom:2.4em;scroll-margin-top:110px}
.service-group:last-child{margin-bottom:0}
.service-group-title{font-family:'Montserrat',sans-serif;font-weight:600;font-size:1.3rem;color:var(--rose-dark);margin-bottom:.4em}
.service-list{border-top:1px solid var(--line)}
.service-row{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;padding:28px 0;border-bottom:1px solid var(--line)}
.service-row-main h3{font-size:1.08rem;margin-bottom:.35em}
.service-row-main p{margin:0;color:var(--muted);font-size:.92rem;max-width:56ch}
.service-row-price{flex:none;font-family:'Montserrat',sans-serif;font-weight:600;font-size:.95rem;color:var(--rose-dark);white-space:nowrap}
@media(max-width:600px){.service-row{flex-direction:column;gap:8px}}
.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:760px){.gallery{grid-template-columns:repeat(2,1fr);gap:10px}}
.gallery figure{margin:0;aspect-ratio:1/1;overflow:hidden}
.find.has-map{display:grid;grid-template-columns:1fr 1.2fr;gap:40px;align-items:center}
@media(max-width:860px){.find.has-map{grid-template-columns:1fr}}
.map{position:relative;width:100%;aspect-ratio:21/9;max-height:420px;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--champagne-2)}
.find.has-map .map{aspect-ratio:4/3;max-height:none}
.map iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.info-card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:26px 28px;box-shadow:var(--shadow)}
.info-card .eyebrow{margin-bottom:.6em}
.info-card h3{font-size:1.15rem;margin-bottom:.3em}
.info-card p{margin:0;color:var(--muted);font-size:.92rem}
.hours{width:100%;border-collapse:collapse;font-size:.92rem}
.hours td{padding:5px 0;color:var(--body)}
.hours td:last-child{text-align:right;color:var(--muted)}
.band{background:linear-gradient(160deg,#2c2523 0%,${t.dark} 60%,${t.base} 100%);color:#fff;text-align:center}
.band h2,.band .eyebrow{color:#fff}
.band .eyebrow{color:rgba(255,255,255,.8)}
.band p{color:rgba(255,255,255,.88);max-width:56ch;margin-left:auto;margin-right:auto}
.site-footer{background:var(--ink);color:rgba(255,255,255,.72);padding:3.5em 0 2.5em;font-size:.92rem;text-align:center}
.site-footer .brand{justify-content:center;display:inline-flex;color:#fff}
.legal{margin-top:2em;padding-top:1.6em;border-top:1px solid rgba(255,255,255,.14);font-size:.82rem;color:rgba(255,255,255,.55)}
@media(max-width:900px){body{padding-top:64px}}
.demo-flag{position:fixed;top:0;left:0;right:0;z-index:99;background:#1c1815;color:#fff;text-align:center;font-size:12px;letter-spacing:.04em;padding:8px 12px}
.demo-flag a{color:#e8cd95}
</style>
</head>
<body>
<div class="demo-flag">This is an auto-generated preview from your answers — not a finished site. <a href="https://wellnessweb.co.uk/contact.html" target="_blank" rel="noopener">Talk to us to make it real →</a></div>

<header class="site-header">
  <div class="container">
    <a class="brand" href="#" data-nav="home"><span class="brand-badge">${esc(initials)}</span><span class="brand-text">${brandMark}${d.tagline ? `<span>${esc(d.tagline)}</span>` : ''}</span></a>
    <nav class="nav">
      <a href="#" data-nav="home">Home</a>
      <a href="#" data-nav="services">Services</a>
      <a href="#" data-nav="contact">Contact</a>
      <a class="btn" href="#" data-nav="contact">${esc(goalLabel)}</a>
    </nav>
  </div>
</header>

<div class="page" data-page="home">
  <section class="hero">
    ${sceneMarkup}
    ${!d.heroImage ? '<span class="hero-photo-note">(Demo photo — your finished site gets a custom hero image with your logo and brand name)</span>' : ''}
    <div class="hero-copy">
      <div class="inner">
        <span class="eyebrow">${esc(eyebrowLoc)}</span>
        <h1 class="hero-title">${esc(d.name)}</h1>
        <p class="hero-sub">${esc(heroSub)}</p>
        <div class="btn-row">
          <a class="btn btn--light" href="#" data-nav="contact">${esc(goalLabel)}</a>
          <a class="btn btn--outline-light" href="#" data-nav="services">View Services</a>
        </div>
        ${tags ? `<div class="hero-tags">${tags}</div>` : ''}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="center" style="margin-bottom:2.4em">
        <span class="eyebrow">Welcome to ${esc(d.name)}</span>
        <h2>${esc(heroHook) || 'Everything you need, in one place'}</h2>
        <p class="lede center">${esc(d.about) || esc(defaultDesc)}</p>
      </div>
      <div class="grid grid-3" style="gap:20px">${popularCards}</div>
      <div class="btn-row" style="justify-content:center;margin-top:2.2em">
        <a class="btn btn--ghost" href="#" data-nav="services">View All Services</a>
      </div>
    </div>
  </section>

  <section class="section section--tint">
    <div class="container">
      <div class="center" style="margin-bottom:2.4em">
        <span class="eyebrow">Gallery</span>
        <h2>See more</h2>
        <p class="lede">A look at the space and the work — drop in real photos and this fills itself in.</p>
      </div>
      <div class="gallery">${gallery}</div>
    </div>
  </section>

  <section class="section band">
    <div class="container">
      <span class="eyebrow">Ready when you are</span>
      <h2>Ready to visit ${esc(d.name)}?</h2>
      <p>Get in touch and find a time that suits you.</p>
      <div class="btn-row" style="justify-content:center;margin-top:1.6em">
        <a class="btn btn--light" href="#" data-nav="contact">${esc(goalLabel)}</a>
      </div>
    </div>
  </section>
</div>

<div class="page" data-page="services" hidden>
  <section class="section page-head">
    <div class="container center">
      <span class="eyebrow">Services</span>
      <h1>What we offer</h1>
      <p class="lede center">${esc(heroHook) || 'A quick look at what we do — get in touch for anything not listed here.'}</p>
    </div>
  </section>
  ${categoryTiles ? `<section class="section" style="padding-top:0">
    <div class="container">
      <div class="grid grid-3 cat-grid">${categoryTiles}</div>
    </div>
  </section>` : ''}
  <section class="section" style="padding-top:0">
    <div class="container">
      ${serviceGroups}
    </div>
  </section>
</div>

<div class="page" data-page="contact" hidden>
  <section class="section page-head">
    <div class="container center">
      <span class="eyebrow">Contact &amp; Booking</span>
      <h1>${esc(d.name)}${d.location ? `, ${esc(d.location)}` : ''}</h1>
      <p class="lede center">Questions, bookings or anything else — we'd love to hear from you.</p>
    </div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="grid grid-2" style="gap:20px">
        <div class="info-card">
          <span class="eyebrow">Phone</span>
          <h3>${fakePhone}</h3>
          <p>Call or text — we'll reply as soon as we can</p>
        </div>
        <div class="info-card">
          <span class="eyebrow">Location</span>
          <h3>${esc(fakeAddress)}</h3>
          <p>${d.location ? `${esc(d.location)}, ${fakePostcode}` : fakePostcode}</p>
        </div>
        <div class="info-card">
          <span class="eyebrow">Booking</span>
          <h3>${esc(goalLabel)}</h3>
          <p>Get in touch and we'll find a time that suits you</p>
        </div>
        <div class="info-card">
          <span class="eyebrow">Opening Hours</span>
          <table class="hours"><tbody>
            <tr><td>Mon – Fri</td><td>9:00 – 18:00</td></tr>
            <tr><td>Saturday</td><td>9:00 – 14:00</td></tr>
            <tr><td>Sunday</td><td>Closed</td></tr>
          </tbody></table>
        </div>
      </div>
      <div class="btn-row" style="justify-content:center;margin-top:2.2em">
        <a class="btn" href="#">${esc(goalLabel)}</a>
      </div>
    </div>
  </section>

  ${d.location ? `<section class="section section--tint" style="padding-top:2em">
    <div class="container">
      <div class="find has-map">
        <div>
          <span class="eyebrow">Find Us</span>
          <h2>${esc(d.location)}</h2>
          <p class="lede">${esc(fakeAddress)}, ${esc(d.location)}, ${fakePostcode}</p>
          <div class="btn-row">
            <a class="btn" href="https://www.google.com/maps?q=${encodeURIComponent(d.location)}" target="_blank" rel="noopener">Get Directions</a>
            <a class="btn btn--ghost" href="#">${esc(goalLabel)}</a>
          </div>
        </div>
        <div class="map"><iframe title="Map showing ${esc(d.location)}" src="https://www.google.com/maps?q=${encodeURIComponent(d.location)}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
      </div>
    </div>
  </section>` : ''}

  <section class="section band">
    <div class="container">
      <span class="eyebrow">Ready when you are</span>
      <h2>Book with ${esc(d.name)}</h2>
      <p>Get in touch and find a time that suits you.</p>
      <div class="btn-row" style="justify-content:center;margin-top:1.6em">
        <a class="btn btn--light" href="#">${esc(goalLabel)}</a>
      </div>
    </div>
  </section>
</div>

<footer class="site-footer">
  <div class="container">
    <a class="brand" href="#">${esc(d.name)}</a>
    <div class="legal">Auto-generated preview by Aesthetic Intelligence — not a live website.</div>
  </div>
</footer>

<script>
// Three "pages" (Home, Services, Contact) live in this one document —
// nav links swap which .page is visible instead of anchor-scrolling,
// and the parent page (showing this in a preview frame) is told which
// page is active so its address bar can reflect it.
var slug = ${JSON.stringify(d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'your-business')};
function showPage(id) {
  document.querySelectorAll('.page').forEach(function (p) { p.hidden = p.dataset.page !== id; });
  window.scrollTo({ top: 0 });
  try {
    var path = id === 'home' ? '' : '/' + id;
    parent.postMessage({ source: 'ai-demo', path: slug + '.co.uk' + path }, '*');
  } catch (e) {}
}
document.querySelectorAll('[data-nav]').forEach(function (a) {
  a.addEventListener('click', function (e) { e.preventDefault(); showPage(a.dataset.nav); });
});
// same reason as [data-nav] above: this whole page is loaded via srcdoc,
// so a plain href="#id" resolves against the PARENT page's URL (per spec,
// a srcdoc frame with no <base> inherits its embedder's URL as its base) —
// clicking one would navigate the iframe to the real live site instead of
// scrolling here. Intercepting and scrolling manually keeps it in-page.
document.querySelectorAll('a[href^="#svc-group-"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    e.preventDefault();
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
showPage('home');
<\/script>

</body>
</html>`;
  }
