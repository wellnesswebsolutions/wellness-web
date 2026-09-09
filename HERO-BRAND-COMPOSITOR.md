# Automatic hero logo compositor

`hero-brand-compositor.js` places an uploaded logo onto the correct wall or sign in each supplied hero image. It chooses the position, size, opacity and blend mode from the business category, then exports a ready-to-use WebP image.

## Add it to a page

Load it before the page's own JavaScript:

```html
<script src="hero-brand-compositor.js"></script>
```

Then render a hero from a logo supplied by the designer/admin workflow:

```js
const brandedHero = await HeroBrandCompositor.render({
  category: 'Hair & Beauty',
  businessName: 'Bayan Beauty',
  logo: logoFile,             // File, Blob, data URL or same-origin URL
  output: 'dataURL'           // dataURL, blob, objectURL or canvas
});

document.querySelector('.hero img').src = brandedHero;
```

The customer-facing builder does not show logo, material or 3D controls. If the internal workflow has no logo, omit `logo`; the business name becomes a bespoke procedural wordmark on the surface automatically. The renderer analyses the name, chooses one to three compatible signature details, and combines those with the category, hero surface, website layout, type direction and selected palette.

```js
const brandedHero = await HeroBrandCompositor.render({
  category: 'Automotive',
  businessName: 'Northline Detail',
  location: 'Hull',
  layout: 'kinetic',
  fontFamily: 'Montserrat',
  signColour: '#245bb0'
});
```

The automatic system deliberately uses only three high-quality treatments:

- polished dimensional metal lettering for luxury, hospitality, professional, exterior and industrial walls;
- a frosted glass plaque with realistic edges, reflections, shadows and metal stand-offs for suitable clean interior and studio walls;
- cut vinyl graphics with a shallow contact shadow for vehicle panels.

Every scene carries a subtle perspective correction tied to its photographed signage plane. Category and website style still determine typography, proportion, colour and spacing within those three physical systems.

Results generated from the bundled heroes are cached in memory, capped at 16 variants, so repeated preview refreshes avoid recompositing the photograph.

The included categories are Hair & Beauty, Aesthetics, Health & Wellness, Fitness, Automotive, Trades, Home & Garden, Food & Drink, Professional Services, Creative and Pets.

For safety and consistent browser rendering, the website upload control should accept PNG, JPEG and WebP logos, not SVG files. The supplied hero images must stay in `img/hero-logo-ready/` beside `hero-scenes.json`.
