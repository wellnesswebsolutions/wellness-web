(function (global) {
  'use strict';

  const scriptUrl = document.currentScript && document.currentScript.src;
  const assetBase = scriptUrl
    ? new URL('img/hero-logo-ready/', scriptUrl).href
    : 'img/hero-logo-ready/';

  const SCENES = {
    hairbeauty: { image: 'hair-beauty.webp', left: .70, top: .31, width: .24, blend: 'multiply', opacity: .82 },
    aesthetics: { image: 'aesthetics.webp', left: .50, top: .31, width: .27, blend: 'multiply', opacity: .80 },
    health: { image: 'health-wellness.webp', left: .72, top: .30, width: .24, blend: 'multiply', opacity: .82 },
    fitness: { image: 'fitness.webp', left: .50, top: .31, width: .27, blend: 'screen', opacity: .88 },
    automotive: { image: 'automotive.webp', left: .57, top: .48, width: .25, blend: 'multiply', opacity: .84 },
    trades: { image: 'trades.webp', left: .57, top: .48, width: .25, blend: 'multiply', opacity: .84 },
    homegarden: { image: 'home-garden.webp', left: .67, top: .38, width: .23, blend: 'multiply', opacity: .82 },
    fooddrink: { image: 'food-drink.webp', left: .51, top: .31, width: .24, blend: 'multiply', opacity: .82 },
    professional: { image: 'professional-services.webp', left: .50, top: .30, width: .25, blend: 'multiply', opacity: .80 },
    creative: { image: 'creative.webp', left: .72, top: .31, width: .24, blend: 'multiply', opacity: .82 },
    pets: { image: 'pets.webp', left: .70, top: .29, width: .23, blend: 'multiply', opacity: .82 }
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

  function drawWordmark(ctx, name, box, lightInk) {
    const words = String(name || 'Your Business').trim().toUpperCase();
    let fontSize = Math.round(box.height * .40);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`;
    while (fontSize > 22 && ctx.measureText(words).width > box.width) {
      fontSize -= 2;
      ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`;
    }
    ctx.fillStyle = lightInk ? '#f6f2ea' : '#25211f';
    ctx.fillText(words, box.x + box.width / 2, box.y + box.height / 2, box.width);
  }

  function canvasBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not export the branded hero.')), 'image/webp', quality);
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

    const boxWidth = canvas.width * scene.width;
    const boxHeight = boxWidth * .48;
    const box = {
      x: canvas.width * scene.left - boxWidth / 2,
      y: canvas.height * scene.top - boxHeight / 2,
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
      drawWordmark(ctx, settings.businessName, box, lightInk);
    }
    ctx.restore();

    const output = settings.output || 'dataURL';
    const quality = Number.isFinite(settings.quality) ? settings.quality : .88;
    if (output === 'canvas') return canvas;
    if (output === 'blob') return canvasBlob(canvas, quality);
    if (output === 'objectURL') return URL.createObjectURL(await canvasBlob(canvas, quality));
    return canvas.toDataURL('image/webp', quality);
  }

  global.HeroBrandCompositor = Object.freeze({ render, scenes: SCENES, sceneKey });
})(window);
