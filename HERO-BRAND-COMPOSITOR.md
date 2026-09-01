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

The customer-facing builder does not show colour or image-upload controls. It automatically uses the art-directed colour palette for the category hero. If the internal workflow has no logo, omit `logo`; the business name becomes a fitted wordmark on the wall automatically.

The included categories are Hair & Beauty, Aesthetics, Health & Wellness, Fitness, Automotive, Trades, Home & Garden, Food & Drink, Professional Services, Creative and Pets.

For safety and consistent browser rendering, the website upload control should accept PNG, JPEG and WebP logos, not SVG files. The supplied hero images must stay in `img/hero-logo-ready/` beside `hero-scenes.json`.
