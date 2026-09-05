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
    { label: 'Fitness', cat: 'fitness', photo: 'fitness-hero.jpg', theme: '#414349',
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
    { label: 'Professional Services', cat: 'professional', photo: 'professional-services-hero.jpg', theme: '#7a6952',
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
    { label: 'Creative', cat: 'creative', photo: 'creative-hero.jpg', theme: '#544e45',
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
    { label: 'Pets', cat: 'pets', photo: 'pets-hero.jpg', theme: '#ca7281',
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

  // Six real, category-relevant demo photographs for every generated site.
  // These are deliberately treated as temporary content: the preview labels
  // them as demo images and promises they will be replaced before launch.
  const GALLERY_PHOTO_IDS = {
    hairbeauty: ['1560066984-138dadb4c035','1521590832167-7bcbfaa6381f','1522337360788-8b13dee7a37e','1562322140-8baeececf3df','1487412947147-5cebf100ffc2','1600948836101-f9ffda59d250'],
    aesthetics: ['1570172619644-dfd03ed5d881','1616394584738-fc6e612e71b9','1515377905703-c4788e51af15','1620916566398-39f1143ab7be','1519823551278-64ac92734fb1','1540555700478-4be289fbecef'],
    health: ['1576091160399-112ba8d25d1d','1538108149393-fbbd81895907','1579684385127-1ef15d508118','1471864190281-a93a3070b6de','1519494026892-80bbd2d6fd0d','1516841273335-e39b37888115'],
    fitness: ['1534438327276-14e5300c3a48','1571019613454-1cb2f99b2d8b','1581009146145-b5ef050c2e1e','1517836357463-d25dfeac3438','1534258936925-c58bed479fcb','1540497077202-7c8a3999166f'],
    automotive: ['1487754180451-c456f719a1fc','1503376780353-7e6692767b70','1492144534655-ae79c964c9d7','1504222490345-c075b6008014','1486262715619-67b85e0b08d3','1525609004556-c46c7d6cf023'],
    trades: ['1504307651254-35680f356dfd','1541888946425-d81bb19240f5','1503387762-592deb58ef4e','1531835551805-16d864c8d311','1581578731548-c64695cc6952','1504917595217-d4dc5ebe6122'],
    homegarden: ['1416879595882-3373a0480b5b','1585320806297-9794b3e4eeae','1558904541-efa843a96f01','1598902108854-10e335adac99','1558618666-fcd25c85cd64','1466692476868-aef1dfb1e735'],
    fooddrink: ['1517248135467-4c7edcad34c4','1552566626-52f8b828add9','1414235077428-338989a2e8c0','1565299624946-b28f40a0ae38','1504674900247-0877df9cc836','1559339352-11d035aa65de'],
    professional: ['1497366754035-f200968a6e72','1497366811353-6870744d04b2','1524758631624-e2822e304c36','1497366216548-37526070297c','1497366412874-3415097a27e7','1531497865144-0464ef8fb9a9'],
    creative: ['1549490349-8643362247b5','1541961017774-22349e4a1262','1500530855697-b586d89ba3ee','1455390582262-044cdead277a','1513364776144-60967b0f800f','1547891654-e66ed7ebb968'],
    pets: ['1552053831-71594a27632d','1587300003388-59208cc962cb','1548199973-03cce0bbc87b','1517849845537-4d257902454a','1537151625747-768eb6cf92b2','1558788353-f76d92427f16'],
    office: ['1497366754035-f200968a6e72','1497366811353-6870744d04b2','1524758631624-e2822e304c36','1497366216548-37526070297c','1497366412874-3415097a27e7','1531497865144-0464ef8fb9a9']
  };

  function galleryPhotoUrl(id) {
    return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=82`;
  }
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
  const SITE_STYLE_PRESETS = {
    'modern': { heading: "'Manrope', sans-serif", body: "'Inter', sans-serif", radius: '16px', space: '5.2em', card: '0 18px 46px rgba(25,35,45,.10)' },
    'elegant': { heading: "'DM Sans', sans-serif", body: "'DM Sans', sans-serif", radius: '32px', space: '5.6em', card: 'none' },
    'bold': { heading: "'Bebas Neue', 'Arial Narrow', sans-serif", body: "'DM Sans', sans-serif", radius: '8px', space: '5em', card: 'none' },
    'soft-luxury': { heading: "'Cormorant Garamond', Georgia, serif", body: "'Montserrat', sans-serif", radius: '2px', space: '5.8em', card: '0 18px 50px rgba(28,24,21,.10)' },
    'clinical-luxury': { heading: "'DM Sans', sans-serif", body: "'DM Sans', sans-serif", radius: '12px', space: '5.2em', card: '0 16px 40px rgba(28,24,21,.08)' },
    'calm-wellness': { heading: "'Lora', Georgia, serif", body: "'DM Sans', sans-serif", radius: '16px', space: '5.6em', card: '0 18px 48px rgba(28,24,21,.09)' },
    'bold-modern': { heading: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif", radius: '6px', space: '5em', card: '0 18px 44px rgba(15,18,22,.16)' },
    'warm-editorial': { heading: "'Fraunces', Georgia, serif", body: "'DM Sans', sans-serif", radius: '4px', space: '6em', card: '0 16px 44px rgba(48,34,24,.10)' },
    'clean-professional': { heading: "'Manrope', sans-serif", body: "'Inter', sans-serif", radius: '10px', space: '5.2em', card: '0 14px 36px rgba(25,35,45,.10)' },
    'editorial-portfolio': { heading: "'Fraunces', Georgia, serif", body: "'Inter', sans-serif", radius: '0px', space: '6.4em', card: '0 12px 34px rgba(20,24,20,.12)' },
    'friendly-modern': { heading: "'Nunito Sans', sans-serif", body: "'Nunito Sans', sans-serif", radius: '20px', space: '5.2em', card: '0 18px 44px rgba(48,36,24,.10)' },
    'studio': { heading: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif", radius: '0px', space: '6.2em', card: 'none' }
  };
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
    const cat = info ? info.cat : 'office';
    const CATEGORY_UI = {
      hairbeauty:{nav:'Treatments',secondary:'View Treatments',cta:'Book a treatment',pageTitle:'Treatments & prices',cardCta:'View treatment'},
      aesthetics:{nav:'Treatments',secondary:'View Treatments',cta:'Book a consultation',pageTitle:'Treatments & prices',cardCta:'View treatment'},
      health:{nav:'Treatments',secondary:'View Treatments',cta:'Book a consultation',pageTitle:'Treatments & therapies',cardCta:'View treatment'},
      fitness:{nav:'Training',secondary:'View Training',cta:'Join now',pageTitle:'Training & memberships',cardCta:'View option'},
      automotive:{nav:'Services',secondary:'View Services',cta:'Book a service',pageTitle:'Workshop services',cardCta:'View service'},
      trades:{nav:'Services',secondary:'View Services',cta:'Get a quote',pageTitle:'Our services',cardCta:'View service'},
      homegarden:{nav:'Projects',secondary:'View Projects',cta:'Request a quote',pageTitle:'Services & projects',cardCta:'View project'},
      fooddrink:{nav:'Menu',secondary:'View Menu',cta:'Reserve a table',pageTitle:'Our menu',cardCta:'View menu'},
      professional:{nav:'Expertise',secondary:'Our Expertise',cta:'Book a consultation',pageTitle:'How we can help',cardCta:'View service'},
      creative:{nav:'Portfolio',secondary:'View Portfolio',cta:'Start a project',pageTitle:'Creative services',cardCta:'View project'},
      pets:{nav:'Services',secondary:'View Services',cta:'Book an appointment',pageTitle:'Pet care services',cardCta:'View service'},
      office:{nav:'Services',secondary:'View Services',cta:'Get in touch',pageTitle:'What we offer',cardCta:'Learn more'}
    };
    const categoryUi = CATEGORY_UI[cat] || CATEGORY_UI.office;
    const services = d.services.length ? d.services : ['Service one', 'Service two', 'Service three'];
    const prices = d.prices || [];
    const goalLabel = d.goal && d.goal !== 'Book now' ? d.goal : categoryUi.cta;
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
          <span class="card-cta">${esc(categoryUi.cardCta)}</span>
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
    // 07700 900xxx for fictional use, so it's never a real number. Once the
    // customer's given their real number (builder Q3), use that instead.
    const nameSeed = d.name.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const fakePhone = d.phone || '07700 900' + String(100 + (nameSeed % 900)).padStart(3, '0');
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
    const styleName = ['modern', 'elegant', 'bold', 'studio'].includes(d.stylePreset) ? d.stylePreset : 'modern';
    const preset = SITE_STYLE_PRESETS[styleName];
    const initials = d.name.trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const galleryPhotos = GALLERY_PHOTO_IDS[cat] || GALLERY_PHOTO_IDS.office;
    const gallery = galleryPhotos.map((photoId, i) => `
      <figure class="gallery-demo" aria-label="Demo gallery image ${i + 1} for ${esc(d.name)}">
        <img src="${galleryPhotoUrl(photoId)}" alt="Sample ${esc(info ? info.label : 'business')} photograph ${i + 1}" loading="lazy" referrerpolicy="no-referrer">
        <figcaption>Demo image</figcaption>
      </figure>`).join('');
    const eyebrowLoc = d.location ? `Based in ${esc(d.location)}` : 'Now booking';
    const defaultDesc = info ? info.desc.replace(/\{name\}/g, d.name) : `${d.name} is a business that cares about doing things properly — tell us more about what makes you different and this paragraph will describe it.`;
    const heroHook = info ? info.tagline : (d.tagline || 'Tell us what makes you different — this line introduces your business.');
    const heroSub = d.tagline ? `${d.tagline} — ${heroHook}` : heroHook;
    const galleryHeadings = { hairbeauty:'Inside the salon',aesthetics:'Inside the clinic',health:'Inside the practice',fitness:'Inside the studio',automotive:'Inside the workshop',trades:'Recent work',homegarden:'Recent projects',fooddrink:'From our kitchen',professional:'Our work',creative:'Selected work',pets:'Meet our happy clients',office:'Our work' };
    const galleryHeading = galleryHeadings[cat] || 'Our work';
    const reviewCopy = [
      'A brilliant experience from start to finish. The team listened carefully and made everything feel easy.',
      `Friendly, professional and genuinely attentive. I would happily recommend ${d.name} to anyone in ${d.location || 'the area'}.`,
      'Excellent service and a result I was really pleased with. I will definitely be coming back.'
    ];
    const reviewNames = ['Amelia','Charlotte','Sophie'];
    const reviews = reviewCopy.map((copy,i)=>`<article class="review-card"><div class="review-stars" aria-label="5 out of 5 stars">★★★★★</div><blockquote>“${esc(copy)}”</blockquote><p><strong>${reviewNames[i]}</strong> · Sample client</p></article>`).join('');
    const metaDesc = (heroHook + '. ' + defaultDesc).slice(0, 155).replace(/\s+\S*$/, '') + '.';
    const categoryPhoto = info && info.photo ? `https://wellnessweb.co.uk/img/hero/${info.photo}` : null;
    const usingCategoryPhoto = !d.heroImage && !!categoryPhoto;
    const sceneMarkup = d.heroImage || usingCategoryPhoto ? '' : sceneSVG(cat, t);
    const heroHasPhoto = !!(d.heroImage || usingCategoryPhoto);
    // `contain`, not `cover`: cover crops the edges off to fill the band,
    // zooming past the business name composited onto the wall. The heroes
    // are 16:9 and the desktop hero box matches that ratio, so contain fills
    // it edge to edge with the whole photograph visible. (Mobile overrides
    // background-size separately, further down.)
    const heroBg = d.heroImage
      ? `url('${d.heroImage}') center/contain no-repeat`
      : usingCategoryPhoto
        ? `url('${categoryPhoto}') center/contain no-repeat`
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
<meta name="theme-color" content="${t.dark}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='${t.dark}'/><text x='32' y='33' text-anchor='middle' dominant-baseline='central' font-family='Inter, Arial, sans-serif' font-weight='700' font-size='26' fill='#fff'>${esc(initials)}</text></svg>`)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600;700&family=Lora:wght@400;500;600&family=Manrope:wght@400;500;600;700&family=Montserrat:wght@300;400;600;700&family=Nunito+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#1c1815;--body:#3a3330;--muted:#6f635c;--taupe:${t.light};--rose:${t.base};--rose-dark:${t.dark};--champagne:color-mix(in srgb,var(--rose-dark) 10%,#fff);--champagne-2:color-mix(in srgb,var(--rose) 18%,#fff);--header-surface:color-mix(in srgb,var(--taupe) 28%,var(--champagne));--line:color-mix(in srgb,var(--rose-dark) 20%,transparent);--radius:${preset.radius};--shadow:${preset.card};--heading-font:${preset.heading};--body-font:${preset.body};--section-space:${preset.space}}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:110px;overflow-x:clip;overflow-y:auto}
body{margin:0;padding-bottom:150px;font-family:var(--body-font);font-size:16px;line-height:1.75;color:var(--body);background:#fff;-webkit-font-smoothing:antialiased;overflow-x:clip;overflow-y:visible}
img{max-width:100%;display:block}
a{color:var(--rose-dark)}
h1,h2,h3,h4{font-family:var(--heading-font);color:var(--ink);font-weight:600;line-height:1.2;margin:0 0 .6em;letter-spacing:-.01em}
h1{font-size:clamp(2.1rem,5.5vw,3.6rem);font-weight:300;letter-spacing:.01em}
h2{font-size:clamp(1.6rem,3.4vw,2.4rem);font-weight:300}
h3{font-size:1.05rem;font-weight:600}
p{margin:0 0 1.1em}
.container{width:100%;max-width:1140px;margin:0 auto;padding:0 22px}
.section{padding:var(--section-space) 0}
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
@media(max-width:600px){
  .btn-row{flex-direction:column;align-items:stretch;width:100%}
  .btn-row .btn{width:100%;text-align:center}
}
.site-header{position:fixed;top:0;left:0;right:0;z-index:50;background:var(--header-surface);border-bottom:1px solid rgba(28,24,21,.07);box-shadow:0 1px 14px rgba(28,24,21,.05)}
.site-header .container{display:flex;align-items:center;gap:16px;min-height:74px}
.brand{display:flex;flex-direction:row;align-items:center;text-decoration:none;color:var(--ink);margin-right:auto;font-weight:700;font-size:1.2rem}
.brand-text{display:flex;flex-direction:column;line-height:1.1}
/* Scoped to .brand-text, not .brand, on purpose: .brand span would also
   match .brand-badge (also a span, also inside .brand), overriding its
   white initials to this same rose-dark tone their own circle is filled
   with — invisible text on a same-colour background. */
.brand-text span{font-size:.55rem;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--rose-dark);margin-top:2px}
.nav{display:flex;align-items:center;gap:24px}
.nav a{text-decoration:none;color:var(--ink);font-size:.72rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;padding:6px 0;border-bottom:1px solid transparent}
.nav a:hover{border-bottom-color:var(--ink)}
.nav a.btn{padding:11px 20px;color:#fff}
.nav a.btn:hover{background:transparent;color:var(--ink)}
.menu-toggle{display:none;width:44px;height:44px;border:1px solid var(--line);border-radius:max(var(--radius),10px);
  background:var(--champagne);color:var(--ink);align-items:center;justify-content:center;cursor:pointer}
.menu-toggle span,.menu-toggle::before,.menu-toggle::after{content:"";display:block;width:19px;height:2px;border-radius:2px;background:currentColor;transition:transform .2s,opacity .2s}
.menu-toggle span{margin:4px 0}
.menu-toggle[aria-expanded="true"] span{opacity:0}
.menu-toggle[aria-expanded="true"]::before{transform:translateY(6px) rotate(45deg)}
.menu-toggle[aria-expanded="true"]::after{transform:translateY(-6px) rotate(-45deg)}
.mobile-nav{display:none}
@media(max-width:760px){
  .site-header .container{position:relative;min-height:68px}
  .nav{display:none}
  .menu-toggle{display:flex;flex-direction:column}
  .mobile-nav{position:absolute;display:grid;top:100%;left:14px;right:14px;padding:10px;background:#fff;
    border:1px solid var(--line);border-radius:max(var(--radius),14px);box-shadow:0 18px 50px rgba(28,24,21,.18)}
  .mobile-nav[hidden]{display:none}
  .mobile-nav a{padding:13px 14px;border-radius:max(var(--radius),8px);text-decoration:none;color:var(--ink);
    font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
  .mobile-nav a:hover{background:var(--champagne)}
  .mobile-nav .btn{margin-top:5px;text-align:center;background:var(--rose-dark);border-color:var(--rose-dark);color:#fff}
}
.hero{position:relative;margin-top:75px;background:${heroBg};display:flex;align-items:flex-end;overflow:hidden;min-height:min(72vh,680px)}
${heroHasPhoto ? `@media(min-width:901px){
  /* Match the hero band to the photograph's own 16:9 ratio so \`contain\`
     fills it exactly — the full image, no zoomed-in crop. The background
     colour only shows if a supplied photo is ever a different shape. */
  .hero{aspect-ratio:16/9;min-height:0;background-color:var(--ink)}
}` : ''}
.hero-photo-note{position:absolute;z-index:3;right:14px;bottom:14px;font-size:.66rem;font-style:italic;color:rgba(255,255,255,.75);
  text-shadow:0 1px 6px rgba(0,0,0,.5);pointer-events:none}
.demo-ribbon{position:absolute;z-index:4;top:14px;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100% - 28px);
  padding:7px 12px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(18,18,18,.5);backdrop-filter:blur(10px);
  color:#fff;font-size:.61rem;font-weight:600;letter-spacing:.08em;text-align:center}
@media(max-width:760px){.hero-photo-note{left:14px;right:14px;text-align:center}}
@media(max-width:760px){.demo-ribbon{top:8px;font-size:.55rem;line-height:1.3;padding:6px 9px}}
.hero::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(to right,rgba(28,24,21,.55) 0%,rgba(28,24,21,.28) 34%,rgba(28,24,21,0) 62%),linear-gradient(to top,rgba(28,24,21,.8) 0%,rgba(28,24,21,.6) 26%,rgba(28,24,21,.24) 54%,rgba(28,24,21,0) 82%)}
.hero .hero-copy{position:relative;z-index:2;width:100%;padding:0 0 3.4em}
.hero .inner{max-width:1140px;margin:0 auto;padding:0 22px}
.hero h1,.hero p{color:#fff}
.hero-title{font-size:clamp(2.3rem,5.2vw,4rem);font-weight:300;line-height:1.05;margin:0 0 .3em;text-shadow:0 2px 20px rgba(28,24,21,.4)}
.hero .hero-sub{font-size:clamp(1.02rem,1.9vw,1.25rem);font-weight:300;max-width:36ch;margin-bottom:1.8em;text-shadow:0 2px 14px rgba(28,24,21,.35)}
.hero .eyebrow{color:rgba(255,255,255,.85)}
.hero-tags{display:flex;flex-wrap:wrap;gap:10px 26px;margin-top:2em;font-size:.68rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.85)}
.brand-badge{flex:none;width:38px;height:38px;border-radius:50%;background:var(--rose-dark);
  display:flex;align-items:center;justify-content:center;margin-right:11px;border:1px solid rgba(255,255,255,.42);
  box-shadow:0 5px 16px color-mix(in srgb,var(--rose-dark) 28%,transparent);
  font-family:var(--body-font);font-weight:700;letter-spacing:.04em;color:#fff;font-size:.68rem;line-height:1}
@media(max-width:900px){
  /* Mobile uses the hero photograph as a complete 16:9 image rather than
     cropping a desktop background into a tall portrait panel. The content
     then sits in its own panel below, so buttons never cover the sentence. */
  .hero{--mobile-hero-height:clamp(180px,56.25vw,440px);display:block;min-height:0;margin-top:75px;
    padding-top:var(--mobile-hero-height);background-size:contain;
    background-position:center top;background-repeat:no-repeat;background-color:var(--ink)}
  .hero::after{inset:0 0 auto;height:var(--mobile-hero-height);
    background:linear-gradient(to top,rgba(28,24,21,.24),rgba(28,24,21,0) 58%)}
  /* The photo is only the top padding-box of .hero here — the copy panel
     below adds its own height beneath it — so anchor the note to the photo's
     own bottom edge (top:mobile-hero-height) rather than .hero's bottom,
     which would otherwise land past the copy panel and its buttons. */
  .hero-photo-note{top:calc(var(--mobile-hero-height) - 10px);bottom:auto;transform:translateY(-100%);
    width:max-content;max-width:calc(100% - 28px);margin:0 auto;padding:5px 9px;border-radius:999px;
    background:rgba(16,16,18,.58);color:#fff;line-height:1.25;text-shadow:none;backdrop-filter:blur(7px)}
  .hero .hero-copy{padding:1.35em 0 1.55em;text-align:center;background:var(--header-surface);
    border-top:1px solid color-mix(in srgb,var(--rose-dark) 16%,transparent)}
  .hero .inner{display:flex;flex-direction:column;align-items:center;padding:0 18px}
  .hero h1,.hero p{color:var(--ink);text-shadow:none}
  .hero .eyebrow{margin-bottom:.65em;color:var(--rose-dark)}
  .hero-title{font-size:clamp(1.9rem,8vw,2.5rem);margin-bottom:.25em}
  .hero .hero-sub{font-size:1rem;line-height:1.5;max-width:31ch;margin:0 auto 1.15em}
  .hero .btn-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;width:100%;max-width:390px}
  .hero .btn{display:flex;align-items:center;justify-content:center;min-height:48px;padding:11px 14px;
    border-radius:max(var(--radius),8px);font-size:.66rem;line-height:1.25;letter-spacing:.13em;box-shadow:none}
  .hero .btn--light{background:var(--rose-dark);border-color:var(--rose-dark);color:#fff}
  .hero .btn--outline-light{background:transparent;border-color:color-mix(in srgb,var(--rose-dark) 62%,transparent);color:var(--ink);backdrop-filter:none}
  .hero-tags{display:none}
}
@media(max-width:360px){
  .hero .btn-row{grid-template-columns:1fr}
}
@media(max-width:760px){.hero{margin-top:68px}}
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
.service-group-title{font-family:var(--heading-font);font-weight:600;font-size:1.3rem;color:var(--rose-dark);margin-bottom:.4em}
.service-list{border-top:1px solid var(--line)}
.service-row{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;padding:28px 0;border-bottom:1px solid var(--line)}
.service-row-main h3{font-size:1.08rem;margin-bottom:.35em}
.service-row-main p{margin:0;color:var(--muted);font-size:.92rem;max-width:56ch}
.service-row-price{flex:none;font-family:var(--body-font);font-weight:600;font-size:.95rem;color:var(--rose-dark);white-space:nowrap}
@media(max-width:600px){.service-row{flex-direction:column;gap:8px}}
.reviews{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.review-card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:30px 26px;min-height:230px;display:flex;flex-direction:column;box-shadow:var(--shadow)}
.review-stars{color:var(--rose-dark);letter-spacing:.18em;font-size:.82rem;margin-bottom:1.2em}
.review-card blockquote{margin:0 0 1.4em;color:var(--body);font-size:.98rem;line-height:1.75;flex:1}
.review-card p{margin:0;color:var(--muted);font-size:.78rem}
.review-note{margin-top:1.4em;color:var(--muted);font-size:.76rem;text-align:center}
@media(max-width:760px){.reviews{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;padding:0 1px 12px}.review-card{flex:0 0 86%;scroll-snap-align:center;min-height:215px}}
.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:760px){.gallery{grid-template-columns:repeat(2,1fr);gap:10px}}
.gallery figure{margin:0;aspect-ratio:4/3;overflow:hidden;border-radius:var(--radius)}
.gallery-demo{position:relative;background:var(--soft)}
.gallery-demo img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .5s ease}
.gallery-demo:hover img{transform:scale(1.035)}
.gallery-demo figcaption{position:absolute;right:10px;bottom:10px;padding:5px 8px;border-radius:999px;background:rgba(20,20,20,.62);
  color:#fff;font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;backdrop-filter:blur(5px)}
.gallery-placeholder{position:relative;display:flex;align-items:center;justify-content:center;isolation:isolate;background:linear-gradient(var(--gallery-angle),var(--gallery-a),var(--gallery-b));color:#fff}
.gallery-placeholder::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(28,24,21,.38),transparent 55%);z-index:-1}
.gallery-orb{position:absolute;width:70%;aspect-ratio:1;border:1px solid rgba(255,255,255,.24);border-radius:50%;z-index:-1}
.gallery-orb--1{left:-18%;top:-30%}.gallery-orb--2{right:-22%;bottom:-34%;width:85%}.gallery-orb--3{left:14%;top:8%;width:72%;border-radius:36% 64% 58% 42%}
.gallery-badge{width:clamp(58px,8vw,76px);height:clamp(58px,8vw,76px);margin:0;
  font-size:clamp(.9rem,1.8vw,1.25rem);border:2px solid rgba(255,255,255,.72);
  box-shadow:0 12px 32px rgba(28,24,21,.24),0 0 0 7px rgba(255,255,255,.12)}
.gallery-placeholder figcaption{position:absolute;left:14px;bottom:11px;font-size:.62rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.88)}
.find.has-map{display:grid;grid-template-columns:1fr 1.2fr;gap:40px;align-items:center}
@media(max-width:860px){.find.has-map{grid-template-columns:1fr}}
.map{position:relative;width:100%;aspect-ratio:21/9;max-height:420px;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--champagne-2)}
.find.has-map .map{aspect-ratio:4/3;max-height:none}
.map iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
/* contact page: intro + stacked label/value rows on the left, a bordered
   opening-hours card on the right — mirrors a real booking-site contact page */
.contact-split{display:grid;grid-template-columns:1.1fr 1fr;gap:56px;align-items:stretch;text-align:left}
@media(max-width:860px){.contact-split{grid-template-columns:1fr;gap:36px}}
.contact-intro{display:flex;flex-direction:column}
.hours-card{display:flex;flex-direction:column}
.hours-card .hours-note{flex:1}
.contact-intro h1{margin-top:.2em}
.contact-rows{margin-top:2em}
.contact-row{display:grid;grid-template-columns:100px 1fr;gap:20px;padding:20px 0;border-top:1px solid var(--line)}
.contact-row:last-child{border-bottom:1px solid var(--line)}
.contact-row-label{font-size:.7rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--rose-dark);padding-top:.15em}
.contact-row h3{font-size:1.05rem;margin-bottom:.25em}
.contact-row p{margin:0;color:var(--muted);font-size:.9rem}
.hours-card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:32px;box-shadow:var(--shadow)}
.hours-card .eyebrow{margin-bottom:.5em}
.hours-card h2{font-size:1.3rem;margin-bottom:1em}
.hours-note{color:var(--muted);font-size:.86rem;margin:1.3em 0 1.4em}
.hours{width:100%;border-collapse:collapse;font-size:.92rem}
.hours td{padding:9px 0;color:var(--body);border-bottom:1px solid var(--line)}
.hours tr:last-child td{border-bottom:0}
.hours td:last-child{text-align:right;color:var(--muted)}
.band{background:linear-gradient(160deg,#2c2523 0%,${t.dark} 60%,${t.base} 100%);color:#fff;text-align:center}
.band h2,.band .eyebrow{color:#fff}
.band .eyebrow{color:rgba(255,255,255,.8)}
.band p{color:rgba(255,255,255,.88);max-width:56ch;margin-left:auto;margin-right:auto}
.site-footer{background:var(--ink);color:rgba(255,255,255,.72);padding:3.5em 0 2.5em;font-size:.92rem;text-align:center}
.site-footer .brand{justify-content:center;display:inline-flex;color:#fff}
.legal{margin-top:2em;padding-top:1.6em;border-top:1px solid rgba(255,255,255,.14);font-size:.82rem;color:rgba(255,255,255,.55)}

/* Five visual directions share the same generated content while deliberately
   reshaping the hero, cards, reviews and gallery around it. */
.site-style-modern .site-header{backdrop-filter:blur(18px);background:color-mix(in srgb,var(--header-surface) 90%,transparent)}
.site-style-modern .btn{border-radius:999px;letter-spacing:.12em}
.site-style-modern .card,.site-style-modern .review-card,.site-style-modern .hours-card{border-color:color-mix(in srgb,var(--rose-dark) 12%,transparent)}
.site-style-modern .gallery figure:nth-child(1),.site-style-modern .gallery figure:nth-child(4){border-radius:28px 8px 28px 8px}
.site-style-modern .gallery figure:nth-child(2),.site-style-modern .gallery figure:nth-child(5){border-radius:8px 28px 8px 28px}
.site-style-modern .gallery{grid-template-columns:1.35fr .825fr .825fr;grid-auto-rows:160px}
.site-style-modern .gallery figure{height:100%;aspect-ratio:auto}
.site-style-modern .gallery figure:first-child{grid-row:span 2}
.site-style-modern .gallery figure:nth-child(6){grid-column:span 2}
.site-style-modern .hero::after{background:linear-gradient(to right,rgba(20,25,30,.62),rgba(20,25,30,.12) 68%),linear-gradient(to top,rgba(20,25,30,.58),transparent 62%)}

.site-style-elegant{background:#fdfcfc;--ink:#000;--body:#44403b;--muted:#777169;--champagne:#f5f3f1;--line:#ebe8e4}
.site-style-elegant h1,.site-style-elegant h2{letter-spacing:-.025em}
.site-style-elegant h1{font-size:clamp(3rem,7vw,5.6rem);font-weight:500}
.site-style-elegant h2{font-size:clamp(2.2rem,4.6vw,3.7rem);font-weight:500}
.site-style-elegant .site-header{top:14px;left:3%;right:3%;border:1px solid #ebe8e4;background:rgba(253,252,252,.94);box-shadow:0 10px 36px rgba(68,64,59,.08);backdrop-filter:blur(18px)}
.site-style-elegant .site-header .container{min-height:68px}
.site-style-elegant .site-header .brand,.site-style-elegant .site-header .nav a{color:#000}
.site-style-elegant .site-header .brand-text span{color:#777169}
.site-style-elegant .brand-badge{border-radius:2px;border-width:1px;box-shadow:none}
.site-style-elegant .btn{background:#000;color:#fff;border-color:#000;border-width:1px;border-radius:999px;letter-spacing:.12em}
.site-style-elegant .hero{width:94%;margin:108px auto 0;min-height:min(76vh,760px);border-radius:24px;align-items:center;box-shadow:none}
.site-style-elegant .hero::after{background:linear-gradient(rgba(9,18,32,.28),rgba(9,18,32,.55))}
.site-style-elegant .hero .hero-copy{padding:3em 0;text-align:center}
.site-style-elegant .hero .inner{display:flex;flex-direction:column;align-items:center}
.site-style-elegant .hero .hero-sub{max-width:42ch}
.site-style-elegant .hero .btn-row{justify-content:center}
.site-style-elegant .hero .btn{background:#fff;color:#121d2d;border-color:#fff}
.site-style-elegant .hero .btn--outline-light{background:transparent;color:#fff}
.site-style-elegant .section>.container{max-width:1040px}
.site-style-elegant .grid-3{grid-template-columns:1.35fr 1fr}
.site-style-elegant .grid-3 .card:first-child{grid-row:span 2;display:flex;flex-direction:column;justify-content:center;padding:60px 44px}
.site-style-elegant .card,.site-style-elegant .review-card,.site-style-elegant .hours-card{box-shadow:none;background:#f5f3f1;border-color:#ebe8e4}
.site-style-elegant .card{padding:34px;border-radius:20px}
.site-style-elegant .reviews{grid-template-columns:1fr 1.35fr 1fr;align-items:center}
.site-style-elegant .review-card{border:1px solid #ebe8e4;border-radius:20px;text-align:center;padding:42px 28px;min-height:260px}
.site-style-elegant .review-card:nth-child(2){min-height:320px;background:#000;justify-content:center}
.site-style-elegant .review-card:nth-child(2) blockquote,.site-style-elegant .review-card:nth-child(2) p{color:#fff}
.site-style-elegant .review-stars{font-size:.7rem}
.site-style-elegant .gallery{grid-template-columns:1.25fr .75fr 1fr;grid-auto-rows:150px;gap:18px}
.site-style-elegant .gallery figure{aspect-ratio:auto;height:100%;border-radius:20px;outline:1px solid rgba(255,255,255,.72);outline-offset:-9px}
.site-style-elegant .gallery figure:nth-child(1),.site-style-elegant .gallery figure:nth-child(4){grid-row:span 2}
.site-style-elegant .gallery figure:nth-child(3){grid-row:span 2}
.site-style-elegant .band{margin:0 3%;background:#000;border-radius:24px}

@media(max-width:900px){
  .site-style-elegant .site-header{top:0;left:0;right:0}
  .site-style-elegant .hero{width:100%;margin-top:68px;border-radius:0;box-shadow:none}
  .site-style-elegant .hero .btn--outline-light{color:var(--ink);border-color:var(--rose-dark)}
  .site-style-elegant .grid-3,.site-style-elegant .reviews{grid-template-columns:1fr}
  .site-style-elegant .grid-3 .card:first-child{grid-row:auto;padding:38px 30px}
  .site-style-elegant .review-card:nth-child(2){min-height:260px}
  .site-style-elegant .gallery{grid-template-columns:1fr 1fr;grid-auto-rows:auto;gap:10px}
  .site-style-elegant .gallery figure,.site-style-elegant .gallery figure:nth-child(n){height:auto;aspect-ratio:4/3;grid-row:auto;grid-column:auto}
  .site-style-elegant .band{margin:0}
}

/* Final reference-led layouts. Elegant borrows Phantom's airy capsule
   language. The markup and data stay identical across all three styles. */
.site-style-elegant{background:#fdfcfe;--ink:color-mix(in srgb,var(--rose-dark) 72%,#211b32);--body:#35313e;--muted:#86848d;--champagne:color-mix(in srgb,var(--rose) 20%,#fdfcfe);--line:color-mix(in srgb,var(--rose-dark) 18%,transparent)}
.site-style-elegant h1,.site-style-elegant h2{font-weight:300;letter-spacing:-.035em;text-transform:none}
.site-style-elegant .site-header{top:14px;left:4%;right:4%;background:rgba(253,252,254,.9);border:1px solid var(--line);border-radius:999px;box-shadow:none}
.site-style-elegant .site-header .container{min-height:64px}
.site-style-elegant .site-header .nav a.btn{background:var(--ink);border-color:var(--ink);color:#fff}
.site-style-elegant .site-header .nav a.btn:hover{background:transparent;border-color:var(--ink);color:var(--ink)}
.site-style-elegant .brand-badge,.site-style-elegant .btn,.site-style-elegant .menu-toggle{border-radius:999px}
.site-style-elegant .hero{width:92%;margin:104px auto 0;border-radius:48px;min-height:min(76vh,720px);box-shadow:none}
.site-style-elegant .hero::after{background:linear-gradient(to top,color-mix(in srgb,var(--rose-dark) 76%,transparent),transparent 72%)}
.site-style-elegant .hero .hero-copy{text-align:left;align-self:flex-end;padding:0 0 3.8em}
.site-style-elegant .hero .inner{align-items:flex-start}
.site-style-elegant .hero .btn-row{justify-content:flex-start}
.site-style-elegant .hero .btn{background:#e2dffe;color:#211b32;border-color:#e2dffe;box-shadow:0 0 0 4px rgba(226,223,254,.2)}
.site-style-elegant .hero .btn--outline-light{background:rgba(253,252,254,.14);color:#fff;border-color:rgba(255,255,255,.7);box-shadow:none}
.site-style-elegant .grid-3{grid-template-columns:1.25fr .75fr}
.site-style-elegant .grid-3 .card:first-child{grid-row:span 2;min-height:100%;padding:52px 44px}
.site-style-elegant .card{border:0;border-radius:48px;background:var(--champagne);padding:34px;box-shadow:none}
.site-style-elegant .card:nth-child(2){background:color-mix(in srgb,var(--rose) 34%,#ffffc4)}
.site-style-elegant .card:nth-child(3){background:color-mix(in srgb,var(--rose) 22%,#ffdadc)}
.site-style-elegant .reviews{display:flex;gap:16px;align-items:stretch}
.site-style-elegant .review-card{flex:1;border:0;border-radius:48px;background:color-mix(in srgb,var(--rose-dark) 88%,#3c315b);color:#fff;text-align:left;min-height:280px}
.site-style-elegant .review-card blockquote,.site-style-elegant .review-card p{color:#fff}
.site-style-elegant .review-card:nth-child(2){min-height:280px;background:color-mix(in srgb,var(--rose) 44%,#ab9ff2)}
.site-style-elegant .gallery{grid-template-columns:1.25fr .75fr 1fr;grid-auto-rows:160px;gap:14px}
.site-style-elegant .gallery figure,.site-style-elegant .gallery figure:nth-child(n){border-radius:38px}
.site-style-elegant .band{margin:0 4%;border-radius:48px;background:color-mix(in srgb,var(--rose-dark) 88%,#3c315b)}

/* Bold — a premium dark identity in the mould of high-end automotive/trade
   brands (Kings Valeting Hull): deep navy surface, warm metallic accent via
   the customer's own brand colour, bold condensed uppercase type. Unlike
   the old Dynamic style this keeps a normal photo hero — Kings Valeting's
   own hero is a real product photo, not an abstract graphic. */
.site-style-bold{background:#0b1929;--ink:#f5f7fa;--body:#c3cbd6;--muted:#8a97a8;--champagne:#14263c;--line:rgba(255,255,255,.12)}
.site-style-bold h1,.site-style-bold h2,.site-style-bold h3{text-transform:uppercase;letter-spacing:.01em}
.site-style-bold h1{font-size:clamp(3.4rem,8vw,7rem);line-height:.9}
.site-style-bold h2{font-size:clamp(2.2rem,5vw,4.2rem);line-height:.95}
.site-style-bold .site-header{background:rgba(11,25,41,.85);border-bottom:1px solid rgba(255,255,255,.12);box-shadow:none;backdrop-filter:blur(18px)}
.site-style-bold .site-header .brand,.site-style-bold .site-header .nav a{color:#fff}
.site-style-bold .site-header .nav a.btn{background:var(--rose-dark);border-color:var(--rose-dark);color:#0b1929}
.site-style-bold .site-header .nav a.btn:hover{background:transparent;border-color:#fff;color:#fff}
.site-style-bold .mobile-nav{background:#14263c;border-color:rgba(255,255,255,.14)}
.site-style-bold .mobile-nav a{color:#fff}.site-style-bold .mobile-nav a:hover{background:rgba(255,255,255,.08)}
.site-style-bold .brand-badge{border-radius:8px;background:var(--rose-dark);box-shadow:0 0 24px color-mix(in srgb,var(--rose-dark) 50%,transparent)}
.site-style-bold .btn{border-radius:6px;background:var(--rose-dark);border-color:var(--rose-dark);color:#0b1929;font-weight:700;box-shadow:none}
.site-style-bold .hero{background-color:#0b1929!important}
.site-style-bold .hero::after{background:linear-gradient(0deg,#0b1929 0 8%,rgba(11,25,41,.55) 45%,rgba(11,25,41,.1) 100%)}
.site-style-bold .hero h1,.site-style-bold .hero p,.site-style-bold .hero .eyebrow{color:#fff;text-shadow:none}
.site-style-bold .hero .btn--light{background:var(--rose-dark);border-color:var(--rose-dark);color:#0b1929}
.site-style-bold .hero .btn--outline-light{background:transparent;border-color:rgba(255,255,255,.6);color:#fff}
.site-style-bold .hero-tags{color:#fff}.site-style-bold .hero-tags span{border:1px solid rgba(255,255,255,.35)}
.site-style-bold .demo-ribbon{background:rgba(11,25,41,.8)}
.site-style-bold .section{background:#0b1929}.site-style-bold .section--tint{background:#14263c}
.site-style-bold .section h2,.site-style-bold .section h3,.site-style-bold .section .lede{color:inherit}
.site-style-bold .card,.site-style-bold .review-card,.site-style-bold .hours-card{background:#14263c;border:1px solid rgba(255,255,255,.1);border-radius:10px;box-shadow:none;color:#fff}
.site-style-bold .card:first-child{border-top:3px solid var(--rose-dark)}
.site-style-bold .card p,.site-style-bold .card .num,.site-style-bold .review-card p,.site-style-bold .review-card blockquote{color:#c3cbd6}
.site-style-bold .review-stars{color:var(--rose-dark)}
.site-style-bold .gallery figure{border-radius:8px}
.site-style-bold .band{background:var(--rose-dark);color:#0b1929;text-align:left}
.site-style-bold .band h2,.site-style-bold .band .eyebrow,.site-style-bold .band p{color:#0b1929}

@media(max-width:900px){
  .site-style-elegant .site-header{top:0;left:0;right:0;border-radius:0}
  .site-style-elegant .hero{width:100%;margin-top:68px;border-radius:0}
  .site-style-elegant .hero .hero-copy{text-align:center}
  .site-style-elegant .hero .inner{align-items:center}
  .site-style-elegant .hero .btn-row{justify-content:center}
  .site-style-elegant .grid-3{grid-template-columns:1fr}
  .site-style-elegant .reviews{display:flex}
  .site-style-elegant .review-card{flex:0 0 86%}
  .site-style-elegant .gallery{grid-template-columns:1fr 1fr;grid-auto-rows:auto}
  .site-style-elegant .gallery figure,.site-style-elegant .gallery figure:nth-child(n){aspect-ratio:4/3;height:auto;grid-row:auto;grid-column:auto;border-radius:24px}
  .site-style-elegant .band{margin:0;border-radius:0}
  /* .site-style-elegant .hero .btn--outline-light was set to white text on
     a translucent white background for the desktop hero's dark photo
     overlay — on mobile the hero-copy panel sits on a light solid
     background instead (see the shared .hero .hero-copy mobile rule
     earlier), so white-on-light was making "View Services" unreadable.
     This has to be the LAST rule for this selector in the file (same
     specificity as the desktop one) to actually win the cascade. */
  .site-style-elegant .hero .btn--outline-light{background:transparent;color:var(--ink);border-color:var(--rose-dark)}
  .site-style-bold .hero{background-color:#0b1929!important}
  .site-style-bold .grid-3,.site-style-bold .reviews{grid-template-columns:1fr}
  .site-style-bold .gallery{grid-template-columns:1fr 1fr;grid-auto-rows:auto}
  .site-style-bold .gallery figure,.site-style-bold .gallery figure:nth-child(n){aspect-ratio:4/3;height:auto;grid-row:auto;grid-column:auto}
}

/* Studio — monumental type and a clean monochrome editorial treatment. */
.site-style-studio{background:#fff;--ink:#050505;--body:#181818;--muted:#6d6d6d;--champagne:#f2f2f0;--line:#cececa}
.site-style-studio h1,.site-style-studio h2{font-weight:400;letter-spacing:-.065em}
.site-style-studio h1{font-size:clamp(4.5rem,11vw,10rem);line-height:.78}
.site-style-studio h2{font-size:clamp(3rem,7vw,6.5rem);line-height:.88}
.site-style-studio .site-header{background:#fff;border-bottom:1px solid #050505;box-shadow:none}
.site-style-studio .brand-badge,.site-style-studio .card,.site-style-studio .review-card,.site-style-studio .hours-card{border-radius:0;box-shadow:none}
.site-style-studio .btn{border-radius:999px;background:transparent;color:#050505;border:1px solid #050505;letter-spacing:.04em;text-transform:none;box-shadow:none}
.site-style-studio .hero{min-height:min(82vh,780px);background-size:cover;background-position:center}
.site-style-studio .hero::before{display:none}
.site-style-studio .hero::after{z-index:1;background:linear-gradient(to top,rgba(0,0,0,.76),rgba(0,0,0,.06) 75%)}
.site-style-studio .hero .hero-copy{padding-bottom:4.5em}
.site-style-studio .hero-title{max-width:10ch}
.site-style-studio .hero .hero-sub{font-size:1.15rem}
.site-style-studio .hero .btn{color:#fff;border-color:rgba(255,255,255,.72);background:rgba(0,0,0,.08)}
.site-style-studio .section>.container{max-width:1080px}
.site-style-studio .section .center{text-align:left}
.site-style-studio .section .center .lede{margin-left:0;margin-right:0}
.site-style-studio .grid-3{grid-template-columns:1fr;border-top:1px solid #050505}
.site-style-studio .card{display:grid;grid-template-columns:170px 1fr auto;align-items:center;gap:25px;padding:28px 0;background:transparent;border:0;border-bottom:1px solid #cececa}
.site-style-studio .card .num{margin:0}.site-style-studio .card h3{margin:0;font-size:1.5rem}.site-style-studio .card p{margin:0}.site-style-studio .card-cta{justify-self:end}
.site-style-studio .section--tint{background:#050505;color:#fff}
.site-style-studio .section--tint h2,.site-style-studio .section--tint .eyebrow,.site-style-studio .section--tint .lede{color:#fff}
.site-style-studio .reviews{grid-template-columns:1.35fr .825fr .825fr}
.site-style-studio .review-card{background:#181818;border:1px solid #444;color:#fff;min-height:270px}
.site-style-studio .review-card blockquote,.site-style-studio .review-card p{color:#fff}
.site-style-studio .gallery{grid-template-columns:1fr 1fr;gap:1px;background:#050505}
.site-style-studio .gallery figure{border-radius:0}.site-style-studio .gallery figure:first-child{grid-column:span 2;aspect-ratio:16/7}
.site-style-studio .band{background:#fff;color:#050505;border-top:1px solid #050505;border-bottom:1px solid #050505;text-align:left}
.site-style-studio .band h2,.site-style-studio .band .eyebrow,.site-style-studio .band p{color:#050505;margin-left:0}
.site-style-studio .band .btn-row{justify-content:flex-start!important}

/* Category-specific presentation: the same five systems now behave like the
   business they represent, not like a generic template with swapped photos. */
.site-category-fooddrink .service-list{border-top:2px solid var(--ink)}
.site-category-fooddrink .service-row{position:relative;padding:20px 0}.site-category-fooddrink .service-row-main h3{font-family:var(--heading-font);font-size:1.2rem}
.site-category-fooddrink .service-row-price{font-size:1.05rem}.site-category-fooddrink .service-group-title{text-transform:uppercase;letter-spacing:.14em;font-size:.8rem}
.site-category-fitness .card{border-top:4px solid var(--rose-dark)}
.site-category-trades .card,.site-category-automotive .card{border-radius:min(var(--radius),10px)}
.site-category-creative .gallery figure:first-child{grid-column:span 2;aspect-ratio:16/7}
.site-category-hairbeauty .gallery img,.site-category-aesthetics .gallery img{filter:saturate(.88) contrast(.96)}

@media(max-width:900px){
  .site-style-modern .gallery{grid-template-columns:1fr 1fr;grid-auto-rows:auto}
  .site-style-modern .gallery figure,.site-style-modern .gallery figure:nth-child(n){height:auto;aspect-ratio:4/3;grid-row:auto;grid-column:auto}
  .site-style-studio .hero-title{font-size:clamp(3.6rem,17vw,6rem)}
  .site-style-studio .hero::before{inset:0 0 auto;height:var(--mobile-hero-height)}
  .site-style-studio .hero .btn{color:#050505;border-color:#050505;background:transparent}
  .site-style-studio .grid-3,.site-style-studio .reviews{grid-template-columns:1fr}
  .site-style-studio .card{display:block;padding:28px 0}.site-style-studio .card h3,.site-style-studio .card p{margin-bottom:12px}
  .site-style-studio .gallery{grid-template-columns:1fr 1fr}.site-style-studio .gallery figure:first-child{grid-column:span 2}
}

/* ---- a little life: things settle into place as they enter the viewport,
   and the hero copy leads in on load. Kept to opacity/transform so it's
   cheap to animate, and dropped entirely for reduced-motion. ---- */
.reveal{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.16,.84,.44,1),transform .7s cubic-bezier(.16,.84,.44,1)}
.reveal.in{opacity:1;transform:none}
.hero-copy .inner>*{opacity:0;transform:translateY(16px);animation:hero-in .8s cubic-bezier(.16,.84,.44,1) forwards}
.hero-copy .inner>*:nth-child(1){animation-delay:.05s}
.hero-copy .inner>*:nth-child(2){animation-delay:.18s}
.hero-copy .inner>*:nth-child(3){animation-delay:.31s}
.hero-copy .inner>*:nth-child(4){animation-delay:.44s}
.hero-copy .inner>*:nth-child(5){animation-delay:.55s}
@keyframes hero-in{to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){
  .reveal{opacity:1;transform:none;transition:none}
  .hero-copy .inner>*{opacity:1;transform:none;animation:none}
}
</style>
</head>
<body class="site-style-${styleName} site-category-${cat}">

<header class="site-header">
  <div class="container">
    <a class="brand" href="#" data-nav="home"><span class="brand-badge">${esc(initials)}</span><span class="brand-text">${brandMark}${d.tagline ? `<span>${esc(d.tagline)}</span>` : ''}</span></a>
    <nav class="nav">
      <a href="#" data-nav="home">Home</a>
      <a href="#" data-nav="services">${esc(categoryUi.nav)}</a>
      <a href="#" data-nav="contact">Contact</a>
      <a class="btn" href="#" data-nav="contact">${esc(goalLabel)}</a>
    </nav>
    <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav"><span></span></button>
    <nav class="mobile-nav" id="mobileNav" hidden>
      <a href="#" data-nav="home">Home</a>
      <a href="#" data-nav="services">${esc(categoryUi.nav)}</a>
      <a href="#" data-nav="contact">Contact</a>
      <a class="btn" href="#" data-nav="contact">${esc(goalLabel)}</a>
    </nav>
  </div>
</header>

<div class="page" data-page="home">
  <section class="hero">
    <div class="demo-ribbon">Personalised demo · every section, colour and layout can be redesigned</div>
    ${sceneMarkup}
    ${heroHasPhoto ? '<span class="hero-photo-note">(This picture will be custom made for your business — it\u2019s just a demo picture for now)</span>' : ''}
    <div class="hero-copy">
      <div class="inner">
        <span class="eyebrow">${esc(eyebrowLoc)}</span>
        <h1 class="hero-title">${esc(d.name)}</h1>
        <p class="hero-sub">${esc(heroSub)}</p>
        <div class="btn-row">
          <a class="btn btn--light" href="#" data-nav="contact">${esc(goalLabel)}</a>
          <a class="btn btn--outline-light" href="#" data-nav="services">${esc(categoryUi.secondary)}</a>
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
        <a class="btn btn--ghost" href="#" data-nav="services">${esc(categoryUi.secondary)}</a>
      </div>
    </div>
  </section>

  <section class="section section--tint">
    <div class="container">
      <div class="center" style="margin-bottom:2.4em">
        <span class="eyebrow">Client Reviews</span>
        <h2>What our clients say</h2>
        <p class="lede center">A few words from recent clients.</p>
      </div>
      <div class="reviews">${reviews}</div>
      <p class="review-note">Sample preview reviews — replace these with your real customer feedback.</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="center" style="margin-bottom:2.4em">
        <span class="eyebrow">Gallery</span>
        <h2>${esc(galleryHeading)}</h2>
        <p class="lede center">Demo images only — all six will be replaced with your own photographs before launch.</p>
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
      <span class="eyebrow">${esc(categoryUi.nav)}</span>
      <h1>${esc(categoryUi.pageTitle)}</h1>
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

  <section class="section band">
    <div class="container">
      <span class="eyebrow">Not sure which to book?</span>
      <h2>Start with a consultation</h2>
      <p>Tell us what you'd like to work on and we'll recommend the right treatment.</p>
      <div class="btn-row" style="justify-content:center;margin-top:1.6em">
        <a class="btn btn--light" href="#" data-nav="contact">${esc(goalLabel)}</a>
      </div>
    </div>
  </section>
</div>

<div class="page" data-page="contact" hidden>
  <section class="section">
    <div class="container">
      <div class="contact-split">
        <div class="contact-intro">
          <span class="eyebrow">Contact</span>
          <h1>${esc(d.name)}${d.location ? `, ${esc(d.location)}` : ''}</h1>
          <p class="lede">Questions, bookings or anything else — we'd love to hear from you.</p>
          <div class="contact-rows">
            <div class="contact-row">
              <span class="contact-row-label">Phone</span>
              <div>
                <h3>${fakePhone}</h3>
                <p>Call or text — we'll reply as soon as we can</p>
              </div>
            </div>
            <div class="contact-row">
              <span class="contact-row-label">Location</span>
              <div>
                <h3>${esc(fakeAddress)}</h3>
                <p>${d.location ? `${esc(d.location)}, ${fakePostcode}` : fakePostcode}</p>
              </div>
            </div>
            <div class="contact-row">
              <span class="contact-row-label">Enquiries</span>
              <div>
                <h3>${esc(goalLabel)}</h3>
                <p>Get in touch and we'll find a time that suits you</p>
              </div>
            </div>
          </div>
        </div>

        <div class="hours-card">
          <span class="eyebrow">Opening Hours</span>
          <h2>When we're open</h2>
          <table class="hours"><tbody>
            <tr><td>Mon – Fri</td><td>9:00 – 18:00</td></tr>
            <tr><td>Saturday</td><td>9:00 – 14:00</td></tr>
            <tr><td>Sunday</td><td>Closed</td></tr>
          </tbody></table>
          <p class="hours-note">Get in touch to book — ${fakePhone}.</p>
          <a class="btn" href="#" data-nav="contact" style="width:100%;text-align:center">${esc(goalLabel)}</a>
        </div>
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
    <div class="legal">Auto-generated preview by BrightSite — not a live website.</div>
  </div>
</footer>

<script>
// Three "pages" (Home, Services, Contact) live in this one document —
// nav links swap which .page is visible instead of anchor-scrolling,
// and the parent page (showing this in a preview frame) is told which
// page is active so its address bar can reflect it.
var slug = ${JSON.stringify(d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'your-business')};
var menuToggle = document.querySelector('.menu-toggle');
var mobileNav = document.getElementById('mobileNav');
function closeMobileMenu() {
  if (!menuToggle || !mobileNav) return;
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open menu');
  mobileNav.hidden = true;
}
if (menuToggle && mobileNav) {
  menuToggle.addEventListener('click', function () {
    var opening = mobileNav.hidden;
    mobileNav.hidden = !opening;
    menuToggle.setAttribute('aria-expanded', String(opening));
    menuToggle.setAttribute('aria-label', opening ? 'Close menu' : 'Open menu');
  });
}
function showPage(id) {
  closeMobileMenu();
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

// A little life: sections, cards and tiles settle into place as they scroll
// into view, staggered by their position within their own row/grid so a
// group of cards cascades in rather than popping in as one flat block.
var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduceMotion && 'IntersectionObserver' in window) {
  var revealGroups = document.querySelectorAll('.grid, .reviews, .gallery');
  revealGroups.forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.classList.add('reveal');
      child.style.transitionDelay = Math.min(i * 70, 280) + 'ms';
    });
  });
  document.querySelectorAll('.section .center, .section.band > .container, .page-head').forEach(function (el) {
    el.classList.add('reveal');
  });
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealIO.unobserve(entry.target);
      }
    });
  }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { revealIO.observe(el); });
}

/* Modern-only: the hero copy fades and lifts away as you scroll past it —
   Elegant and Bold each already have their own distinct hero treatment
   (the tucked-in card frame, the dot-pattern blob), so Modern gets its own
   bit of scroll-linked motion instead of a static hero. rAF-throttled so
   it costs nothing beyond the scroll events themselves. */
if (!reduceMotion && document.body.classList.contains('site-style-modern')) {
  var modernHero = document.querySelector('.hero');
  var modernHeroCopy = document.querySelector('.hero .hero-copy');
  if (modernHero && modernHeroCopy) {
    var modernTicking = false;
    var onModernHeroScroll = function () {
      modernTicking = false;
      var heroH = modernHero.offsetHeight || 1;
      var p = Math.min(1, window.scrollY / heroH);
      modernHeroCopy.style.transform = 'translateY(' + (p * 40).toFixed(1) + 'px)';
      modernHeroCopy.style.opacity = (1 - p * 0.9).toFixed(3);
    };
    window.addEventListener('scroll', function () {
      if (!modernTicking) { modernTicking = true; requestAnimationFrame(onModernHeroScroll); }
    }, { passive: true });
    onModernHeroScroll();
  }
}

showPage('home');
<\/script>

</body>
</html>`;
  }
