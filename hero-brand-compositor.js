(function (global) {
  'use strict';

  const scriptUrl = document.currentScript && document.currentScript.src;
  const assetBase = scriptUrl
    ? new URL('img/hero-logo-ready/', scriptUrl).href
    : 'img/hero-logo-ready/';

  // Per-image placement. `panel` is the usable surface in normalised coords —
  // the flat side of the van, the blank stretch of wall, the facade — measured
  // off each photograph rather than a single generic position. cx/cy is its
  // centre, w/h its extent, and the lockup is fitted inside and clamped to it,
  // so the name cannot drift over windows, doors, wheels or shelving.
  const SCENES = {
    // blank plaster wall right of the mirrors
    hairbeauty: { image: 'hair-beauty.webp', panel: { cx: .72, cy: .32, w: .34, h: .23 }, blend: 'multiply', opacity: .82 },
    // wall panel above and behind the reception desk
    aesthetics: { image: 'aesthetics.webp', panel: { cx: .51, cy: .32, w: .38, h: .23 }, blend: 'multiply', opacity: .80 },
    // wide bare wall to the right of the treatment bed
    health: { image: 'health-wellness.webp', panel: { cx: .70, cy: .34, w: .34, h: .22 }, blend: 'multiply', opacity: .82 },
    // dark gym wall — light ink, kept clear of the rig on the right
    fitness: { image: 'fitness.webp', panel: { cx: .50, cy: .38, w: .40, h: .24 }, blend: 'screen', opacity: .88 },
    // flat side panel of the van, behind the cab and above the sill
    automotive: { image: 'automotive.webp', panel: { cx: .69, cy: .44, w: .31, h: .16 }, blend: 'multiply', opacity: .84 },
    // van side panel, between the window line and the lower stripe
    trades: { image: 'trades.webp', panel: { cx: .68, cy: .47, w: .30, h: .17 }, blend: 'multiply', opacity: .84 },
    // rendered facade right of the timber doorway
    homegarden: { image: 'home-garden.webp', panel: { cx: .69, cy: .43, w: .27, h: .18 }, blend: 'multiply', opacity: .82 },
    // wall above the counter, below the pendant lights
    fooddrink: { image: 'food-drink.webp', panel: { cx: .51, cy: .35, w: .34, h: .18 }, blend: 'multiply', opacity: .82 },
    // marble wall behind the reception desk
    professional: { image: 'professional-services.webp', panel: { cx: .50, cy: .31, w: .32, h: .21 }, blend: 'multiply', opacity: .80 },
    // large empty studio wall on the right
    creative: { image: 'creative.webp', panel: { cx: .74, cy: .35, w: .34, h: .24 }, blend: 'multiply', opacity: .82 },
    // pink salon wall, clear of the shelf and the plant
    pets: { image: 'pets.webp', panel: { cx: .73, cy: .27, w: .30, h: .20 }, blend: 'multiply', opacity: .82 }
  };

  const CATEGORY_ALIASES = {
    'hair & beauty': 'hairbeauty', hairbeauty: 'hairbeauty',
    aesthetics: 'aesthetics',
    'health & wellness': 'health', health: 'health',
    fitness: 'fitness', automotive: 'automotive', trades: 'trades',
    'home & garden': 'homegarden', homegarden: 'homegarden',
    'food & drink': 'fooddrink', fooddrink: 'fooddrink',
    'professional services': 'professional', professional: 'professional',
    creative: 'creative', pets: 'pets', other: 'professional'
  };

  function sceneKey(category) {
    return CATEGORY_ALIASES[String(category || 'other').trim().toLowerCase()] || 'professional';
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      let temporaryUrl = null;
      image.decoding = 'async';
      image.onload = () => {
        if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
        resolve(image);
      };
      image.onerror = () => {
        if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
        reject(new Error('The hero or logo image could not be loaded.'));
      };
      if (source instanceof Blob) {
        temporaryUrl = URL.createObjectURL(source);
        image.src = temporaryUrl;
      } else {
        image.crossOrigin = 'anonymous';
        image.src = source;
      }
    });
  }

  function fitInside(sourceWidth, sourceHeight, maxWidth, maxHeight) {
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    return { width: sourceWidth * scale, height: sourceHeight * scale };
  }

  function makeLogoLayer(logo, width, height, lightInk) {
    const layer = document.createElement('canvas');
    layer.width = Math.max(1, Math.round(width));
    layer.height = Math.max(1, Math.round(height));
    const ctx = layer.getContext('2d');
    ctx.drawImage(logo, 0, 0, layer.width, layer.height);

    // On a dark wall, convert the artwork to warm white so even dark uploaded
    // logos remain readable. Light-wall scenes retain the brand's own colours.
    if (lightInk) {
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#f6f2ea';
      ctx.fillRect(0, 0, layer.width, layer.height);
    }
    return layer;
  }

  function setFont(ctx, weight, size, tracking) {
    ctx.font = `${weight} ${size}px Inter, "Helvetica Neue", Arial, sans-serif`;
    // letterSpacing is not in every engine; ignored where unsupported
    try { ctx.letterSpacing = `${tracking}px`; } catch (error) { /* older Safari */ }
  }

  // Break a name across at most two lines at the most balanced word gap, so a
  // long name gets shorter lines instead of shrinking away to nothing.
  function splitName(words) {
    if (words.length < 2) return [words.join(' ')];
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const diff = Math.abs(a.length - b.length);
      if (!best || diff < best.diff) best = { diff, lines: [a, b] };
    }
    return best.lines;
  }

  // Measures the region the lockup will cover and returns whether it sits on a
  // light or dark surface, plus how much local variation there is. A busy or
  // mid-tone surface gets a shadow; a clean one does not need it.
  function readSurface(ctx, box, fallbackLight) {
    try {
      const x = Math.max(0, Math.round(box.x)), y = Math.max(0, Math.round(box.y));
      const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
      const data = ctx.getImageData(x, y, w, h).data;
      let total = 0, count = 0, min = 255, max = 0;
      // sample on a grid rather than every pixel — plenty for a mean
      for (let i = 0; i < data.length; i += 4 * 16) {
        const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        total += l; count++;
        if (l < min) min = l;
        if (l > max) max = l;
      }
      const mean = total / Math.max(1, count);
      return { light: mean < 128, busy: (max - min) > 118, mean };
    } catch (error) {
      // a cross-origin uploaded hero taints the canvas; fall back to the scene
      return { light: fallbackLight, busy: false, mean: fallbackLight ? 40 : 210 };
    }
  }

  function drawLockup(ctx, name, location, box, fallbackLight) {
    const nameText = String(name || 'Your Business').trim().toUpperCase();
    const placeText = String(location || '').trim().toUpperCase();

    // Keep equal breathing room on every side. All measuring, wrapping and
    // centring happens inside this inset box, so a short or long name shares
    // the exact same visual centre and never leans toward an edge.
    const insetX = box.width * .07;
    const insetY = box.height * .07;
    box = {
      x: box.x + insetX,
      y: box.y + insetY,
      width: box.width - insetX * 2,
      height: box.height - insetY * 2
    };

    // Start from the panel height and shrink until the name fits the width. Try
    // one line first; if that would drive the type too small, use two.
    const maxSize = Math.round(box.height * (placeText ? .40 : .46));
    const minSize = Math.max(18, Math.round(box.height * .16));
    let lines = [nameText];
    let size = maxSize;

    const fits = (candidate, px) => {
      setFont(ctx, 700, px, px * .06);
      return candidate.every(line => ctx.measureText(line).width <= box.width);
    };

    while (size > minSize && !fits(lines, size)) size -= 2;
    if (size <= minSize && nameText.split(/\s+/).length > 1) {
      lines = splitName(nameText.split(/\s+/));
      size = maxSize;
      while (size > minSize && !fits(lines, size)) size -= 2;
    }

    // Location sits at 40% of the name — inside the 35–45% the brand calls for —
    // and shrinks further only if it would otherwise run past the panel.
    let placeSize = Math.round(size * .40);
    if (placeText) {
      setFont(ctx, 500, placeSize, placeSize * .16);
      while (placeSize > 11 && ctx.measureText(placeText).width > box.width) {
        placeSize -= 1;
        setFont(ctx, 500, placeSize, placeSize * .16);
      }
    }

    // Centre on the real glyph box, not on em-boxes. Cap height and descender
    // depth vary with the name, so measuring the actual ink is what keeps the
    // lockup optically centred whether it is one short word or two long lines.
    setFont(ctx, 700, size, size * .06);
    const nameMetrics = lines.map(line => ctx.measureText(line));
    const nameAscent = Math.max(...nameMetrics.map(m => m.actualBoundingBoxAscent || size * .72));
    const nameDescent = Math.max(...nameMetrics.map(m => m.actualBoundingBoxDescent || size * .08));
    const lineStep = nameAscent + nameDescent + size * .22;

    let placeAscent = 0, placeDescent = 0;
    if (placeText) {
      setFont(ctx, 500, placeSize, placeSize * .16);
      const pm = ctx.measureText(placeText);
      placeAscent = pm.actualBoundingBoxAscent || placeSize * .72;
      placeDescent = pm.actualBoundingBoxDescent || placeSize * .08;
    }
    // gap between the two halves of the lockup: close enough to read as one
    // unit, open enough to separate them
    const lockupGap = placeText ? size * .40 : 0;

    const blockHeight =
      nameAscent + (lines.length - 1) * lineStep + nameDescent +
      (placeText ? lockupGap + placeAscent + placeDescent : 0);

    const surface = readSurface(ctx, box, fallbackLight);
    const ink = surface.light ? '#f7f4ef' : '#23201e';

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (surface.busy || (surface.mean > 95 && surface.mean < 165)) {
      ctx.shadowColor = surface.light ? 'rgba(0,0,0,.42)' : 'rgba(255,255,255,.40)';
      ctx.shadowBlur = Math.max(6, size * .12);
    }
    ctx.fillStyle = ink;

    const cx = box.x + box.width / 2;
    const blockTop = box.y + box.height / 2 - blockHeight / 2;
    let baseline = blockTop + nameAscent;

    setFont(ctx, 700, size, size * .06);
    lines.forEach((line, i) => {
      ctx.fillText(line, cx, baseline, box.width);
      if (i < lines.length - 1) baseline += lineStep;
    });

    if (placeText) {
      setFont(ctx, 500, placeSize, placeSize * .16);
      ctx.globalAlpha = (ctx.globalAlpha || 1) * .82;   // lighter visual weight
      ctx.fillText(placeText, cx, baseline + nameDescent + lockupGap + placeAscent, box.width);
    }
    ctx.restore();
  }

  // Safari does not encode WebP from a canvas: it ignores the requested type
  // and silently returns PNG. For a 1600x900 photograph that is ~2.1 MB of
  // base64 instead of ~120 KB — large enough to stall the iPhone preview once
  // it is inlined into the generated site's srcdoc. Probe once and fall back
  // to JPEG, which every browser encodes and which stays small for photos.
  // (The hero is fully opaque, so losing alpha costs nothing.)
  let exportType = null;
  function pickExportType() {
    if (exportType) return exportType;
    try {
      const probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      exportType = probe.toDataURL('image/webp').indexOf('data:image/webp') === 0 ? 'image/webp' : 'image/jpeg';
    } catch (error) {
      exportType = 'image/jpeg';
    }
    return exportType;
  }

  function canvasBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not export the branded hero.')), pickExportType(), quality);
    });
  }

  async function render(options) {
    const settings = options || {};
    const key = sceneKey(settings.category);
    const scene = SCENES[key];
    const heroSource = settings.heroImage || new URL(scene.image, assetBase).href;
    const hero = await loadImage(heroSource);
    const canvas = document.createElement('canvas');
    canvas.width = Number(settings.width) || 1600;
    canvas.height = Number(settings.height) || 900;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(hero, 0, 0, canvas.width, canvas.height);

    // The panel is the usable surface; clamp it inside the frame so no rounding
    // or custom size can push the lockup off the edge of the image.
    const p = scene.panel;
    const boxWidth = canvas.width * p.w;
    const boxHeight = canvas.height * p.h;
    const box = {
      x: Math.max(0, Math.min(canvas.width - boxWidth, canvas.width * p.cx - boxWidth / 2)),
      y: Math.max(0, Math.min(canvas.height - boxHeight, canvas.height * p.cy - boxHeight / 2)),
      width: boxWidth,
      height: boxHeight
    };
    const lightInk = scene.blend === 'screen';

    ctx.save();
    ctx.globalAlpha = scene.opacity;
    ctx.globalCompositeOperation = scene.blend;
    if (settings.logo) {
      const logo = await loadImage(settings.logo);
      const fitted = fitInside(logo.naturalWidth, logo.naturalHeight, box.width, box.height);
      const layer = makeLogoLayer(logo, fitted.width, fitted.height, lightInk);
      const x = box.x + (box.width - fitted.width) / 2;
      const y = box.y + (box.height - fitted.height) / 2;
      ctx.filter = 'blur(0.25px)';
      ctx.drawImage(layer, x, y, fitted.width, fitted.height);
      // A faint second pass lets wall grain show through without looking pasted on.
      ctx.globalAlpha = .12;
      ctx.filter = 'blur(0.7px)';
      ctx.drawImage(layer, x, y + 1, fitted.width, fitted.height);
    } else {
      // The wordmark reads the surface it lands on, so it composites normally
      // rather than through the logo's blend mode.
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      drawLockup(ctx, settings.businessName, settings.location, box, lightInk);
    }
    ctx.restore();

    const output = settings.output || 'dataURL';
    const quality = Number.isFinite(settings.quality) ? settings.quality : .88;
    if (output === 'canvas') return canvas;
    if (output === 'blob') return canvasBlob(canvas, quality);
    if (output === 'objectURL') return URL.createObjectURL(await canvasBlob(canvas, quality));
    return canvas.toDataURL(pickExportType(), quality);
  }

  global.HeroBrandCompositor = Object.freeze({ render, scenes: SCENES, sceneKey });
})(window);
