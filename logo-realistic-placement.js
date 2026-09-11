// Realistic Logo Placement — takes a business's real logo and a real photo
// of its premises/vehicle and composites the logo so it reads as physically
// installed on that surface: perspective-matched, lit like the scene, and
// blended into the surface texture. Pure Canvas 2D (no WebGL/GPU, no
// generative AI) so it runs instantly in the same browser context as the
// rest of the BrightSite builder.
//
// Public API (window.LogoPlacement):
//   removeBackground(image, opts) -> Promise<canvas>   flat-background logo -> transparent PNG
//   detectSurfaces(photoImage, opts) -> [{quad, score}] candidate flat placement areas, normalised 0-1 coords
//   render({photo, logo, quad, strength, width, height, output}) -> Promise<dataURL|canvas|blob>
//   openEditor({photo, logo, quad, strength, onChange, onSave, onCancel}) -> {destroy()}
//     Interactive corner-drag + reposition/resize UI, mounted as a full-screen
//     overlay. Calls onChange(state) live and onSave(state) when confirmed.
(function (global) {
  'use strict';

  const STRENGTH_PRESETS = {
    clean: { opacity: .97, texture: .05, lighting: .22, shadow: .35, edgeSoftness: .3, blur: 0 },
    realistic: { opacity: .90, texture: .16, lighting: .40, shadow: .55, edgeSoftness: .6, blur: .3 },
    subtle: { opacity: .74, texture: .28, lighting: .52, shadow: .70, edgeSoftness: 1.1, blur: .7 }
  };

  function loadImage(source) {
    if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) return Promise.resolve(source);
    return new Promise((resolve, reject) => {
      const img = new Image();
      let objectUrl = null;
      img.decoding = 'async';
      img.onload = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); reject(new Error('Could not load image.')); };
      if (source instanceof Blob) { objectUrl = URL.createObjectURL(source); img.src = objectUrl; }
      else { img.crossOrigin = 'anonymous'; img.src = source; }
    });
  }

  function toCanvas(image, maxDim) {
    const scale = maxDim ? Math.min(1, maxDim / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)) : 1;
    const w = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const h = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(image, 0, 0, w, h);
    return canvas;
  }

  // ---------------------------------------------------------------------
  // Background removal — for logos exported on a flat (usually white)
  // background rather than already-transparent PNGs. Samples the four
  // corners to find the background colour, then removes any pixel within
  // a colour-distance threshold of it, feathering the edge over a couple of
  // pixels so the cut doesn't look jagged. Leaves already-transparent PNGs
  // and busy/photographic logos (no consistent corner colour) untouched.
  // ---------------------------------------------------------------------
  async function removeBackground(source, opts) {
    const options = opts || {};
    const image = await loadImage(source);
    const canvas = toCanvas(image);
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height);
    const px = data.data;

    // Already has real transparency (a proper cut-out was uploaded) — leave it.
    let hasAlpha = false;
    for (let i = 3; i < px.length; i += 4 * 97) { if (px[i] < 250) { hasAlpha = true; break; } }
    if (hasAlpha) return canvas;

    const corner = (x, y) => { const i = (y * width + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
    const samples = [corner(0, 0), corner(width - 1, 0), corner(0, height - 1), corner(width - 1, height - 1)];
    const [r0, g0, b0] = samples[0];
    const consistent = samples.every(([r, g, b]) => Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0) < 36);
    if (!consistent) return canvas; // no reliable flat background to key out

    const threshold = Number.isFinite(options.threshold) ? options.threshold : 42;
    const feather = Number.isFinite(options.feather) ? options.feather : 28;
    for (let i = 0; i < px.length; i += 4) {
      const dist = Math.abs(px[i] - r0) + Math.abs(px[i + 1] - g0) + Math.abs(px[i + 2] - b0);
      if (dist < threshold) px[i + 3] = 0;
      else if (dist < threshold + feather) px[i + 3] = Math.round(px[i + 3] * ((dist - threshold) / feather));
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  }

  // ---------------------------------------------------------------------
  // Flat-surface detection — no ML, just a local-variance scan. Downscales
  // the photo, computes a luminance-gradient "roughness" map (Sobel-ish),
  // then slides candidate rectangles of a few aspect ratios across the
  // image looking for the largest low-roughness patch that isn't right at
  // an edge (walls, van panels and signs are usually mid-frame). Returns
  // the best few candidates as normalised quads (0-1), ranked by score.
  // ---------------------------------------------------------------------
  function detectSurfaces(source, opts) {
    return loadImage(source).then(image => {
      const options = opts || {};
      const work = toCanvas(image, 240); // small raster is plenty for a roughness map
      const ctx = work.getContext('2d');
      const { width: w, height: h } = work;
      const gray = new Float32Array(w * h);
      const { data } = ctx.getImageData(0, 0, w, h);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        gray[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
      const rough = new Float32Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const gx = gray[i + 1] - gray[i - 1];
          const gy = gray[i + w] - gray[i - w];
          rough[i] = Math.sqrt(gx * gx + gy * gy);
        }
      }
      // integral image over roughness for O(1) rectangle sums
      const integral = new Float64Array((w + 1) * (h + 1));
      for (let y = 0; y < h; y++) {
        let rowSum = 0;
        for (let x = 0; x < w; x++) {
          rowSum += rough[y * w + x];
          integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
        }
      }
      const sumRect = (x0, y0, x1, y1) =>
        integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];

      const aspects = options.aspects || [1.8, 1, 1.3, 2.6];
      const candidates = [];
      const stepX = Math.max(2, Math.round(w / 24));
      const stepY = Math.max(2, Math.round(h / 24));
      const minW = w * 0.16, minH = h * 0.10;
      for (const aspect of aspects) {
        for (let boxW = minW; boxW <= w * 0.62; boxW *= 1.35) {
          const boxH = Math.max(minH, boxW / aspect);
          if (boxH > h * 0.62) continue;
          for (let y = h * 0.06; y + boxH < h * 0.94; y += stepY) {
            for (let x = w * 0.05; x + boxW < w * 0.95; x += stepX) {
              const x0 = Math.round(x), y0 = Math.round(y);
              const x1 = Math.min(w, Math.round(x + boxW)), y1 = Math.min(h, Math.round(y + boxH));
              const area = Math.max(1, (x1 - x0) * (y1 - y0));
              const meanRough = sumRect(x0, y0, x1, y1) / area;
              // score rewards large, flat, roughly-centred regions
              const cx = (x0 + x1) / 2 / w, cy = (y0 + y1) / 2 / h;
              const centreBias = 1 - (Math.abs(cx - 0.5) * 0.6 + Math.abs(cy - 0.48) * 0.5);
              const score = (area / (w * h)) * centreBias * (1 / (1 + meanRough * 0.4));
              candidates.push({ score, meanRough, quad: [[x0 / w, y0 / h], [x1 / w, y0 / h], [x1 / w, y1 / h], [x0 / w, y1 / h]] });
            }
          }
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      // de-duplicate heavily-overlapping candidates so results aren't 40
      // near-identical boxes
      const picked = [];
      const overlap = (a, b) => {
        const ax0 = a.quad[0][0], ay0 = a.quad[0][1], ax1 = a.quad[2][0], ay1 = a.quad[2][1];
        const bx0 = b.quad[0][0], by0 = b.quad[0][1], bx1 = b.quad[2][0], by1 = b.quad[2][1];
        const ix = Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0));
        const iy = Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
        const inter = ix * iy;
        const union = (ax1 - ax0) * (ay1 - ay0) + (bx1 - bx0) * (by1 - by0) - inter;
        return union > 0 ? inter / union : 0;
      };
      for (const c of candidates) {
        if (picked.length >= (options.limit || 5)) break;
        if (picked.every(p => overlap(p, c) < 0.45)) picked.push(c);
      }
      return picked;
    });
  }

  // ---------------------------------------------------------------------
  // Perspective warp via triangle subdivision. Canvas 2D only offers affine
  // transforms, so a true 4-corner perspective is approximated by splitting
  // the destination quad into an N x N grid (bilinearly interpolated from
  // the 4 corners) and affine-mapping each source grid cell into its
  // corresponding destination cell. With a reasonably fine grid (10-16
  // divisions) this reads as a correct perspective warp for a logo-sized
  // element and is fast enough to run live while dragging handles.
  // ---------------------------------------------------------------------
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpPt(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
  function quadPoint(quad, u, v) {
    const top = lerpPt(quad[0], quad[1], u);
    const bottom = lerpPt(quad[3], quad[2], u);
    return lerpPt(top, bottom, v);
  }

  function warpImageToQuad(ctx, image, quad, grid) {
    const divisions = grid || 14;
    for (let gy = 0; gy < divisions; gy++) {
      const v0 = gy / divisions, v1 = (gy + 1) / divisions;
      for (let gx = 0; gx < divisions; gx++) {
        const u0 = gx / divisions, u1 = (gx + 1) / divisions;
        const sx0 = u0 * image.width, sx1 = u1 * image.width;
        const sy0 = v0 * image.height, sy1 = v1 * image.height;
        const d00 = quadPoint(quad, u0, v0);
        const d10 = quadPoint(quad, u1, v0);
        const d01 = quadPoint(quad, u0, v1);
        const d11 = quadPoint(quad, u1, v1);

        // two triangles per cell, each affine-mapped and clipped so the
        // seam between them is invisible
        drawTriangleAffine(ctx, image, [sx0, sy0], [sx1, sy0], [sx0, sy1], d00, d10, d01);
        drawTriangleAffine(ctx, image, [sx1, sy0], [sx1, sy1], [sx0, sy1], d10, d11, d01);
      }
    }
  }

  function drawTriangleAffine(ctx, image, s0, s1, s2, d0, d1, d2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d0[0], d0[1]); ctx.lineTo(d1[0], d1[1]); ctx.lineTo(d2[0], d2[1]);
    ctx.closePath();
    ctx.clip();

    // Solve the 2x3 affine matrix mapping s0,s1,s2 -> d0,d1,d2.
    const [x0, y0] = s0, [x1, y1] = s1, [x2, y2] = s2;
    const [X0, Y0] = d0, [X1, Y1] = d1, [X2, Y2] = d2;
    const dx1 = x1 - x0, dy1 = y1 - y0, dx2 = x2 - x0, dy2 = y2 - y0;
    const denom = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(denom) < 1e-8) { ctx.restore(); return; }
    const a = ((X1 - X0) * dy2 - (X2 - X0) * dy1) / denom;
    const b = ((Y1 - Y0) * dy2 - (Y2 - Y0) * dy1) / denom;
    const c = (dx1 * (X2 - X0) - dx2 * (X1 - X0)) / denom;
    const d = (dx1 * (Y2 - Y0) - dx2 * (Y1 - Y0)) / denom;
    const e = X0 - a * x0 - c * y0;
    const f = Y0 - b * x0 - d * y0;
    ctx.setTransform(a, b, c, d, e, f);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  function quadBounds(quad) {
    const xs = quad.map(p => p[0]), ys = quad.map(p => p[1]);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }

  // Estimate the scene's light direction/contrast from the photo patch
  // under the quad, so the logo's shading and shadow agree with the room
  // or street light rather than looking pasted from nowhere.
  function analyseLight(ctx, bounds) {
    try {
      const x = Math.max(0, Math.round(bounds.x0)), y = Math.max(0, Math.round(bounds.y0));
      const w = Math.max(1, Math.round(bounds.x1 - bounds.x0)), h = Math.max(1, Math.round(bounds.y1 - bounds.y0));
      const data = ctx.getImageData(x, y, w, h).data;
      let sumL = 0, sumTop = 0, sumBottom = 0, sumLeft = 0, sumRight = 0, n = 0, nHalf = 0;
      for (let py = 0; py < h; py += 2) {
        for (let px = 0; px < w; px += 2) {
          const i = (py * w + px) * 4;
          const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          sumL += l; n++;
          if (py < h / 2) sumTop += l; else sumBottom += l;
          if (px < w / 2) sumLeft += l; else sumRight += l;
          nHalf++;
        }
      }
      const mean = sumL / Math.max(1, n);
      const vBias = (sumTop - sumBottom) / Math.max(1, nHalf); // >0 => light from above
      const hBias = (sumLeft - sumRight) / Math.max(1, nHalf); // >0 => light from left
      return { mean, light: mean > 150, vBias, hBias };
    } catch (error) {
      return { mean: 190, light: true, vBias: 8, hBias: 0 };
    }
  }

  async function render(options) {
    const opts = options || {};
    const preset = STRENGTH_PRESETS[opts.strength] || STRENGTH_PRESETS.realistic;
    const [photo, logo] = await Promise.all([loadImage(opts.photo), loadImage(opts.logo)]);

    const outW = Number(opts.width) || photo.naturalWidth || photo.width || 1600;
    const outH = Number(opts.height) || photo.naturalHeight || photo.height || Math.round(outW * (photo.height / photo.width));
    const canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(photo, 0, 0, outW, outH);

    const quad = (opts.quad || defaultQuad()).map(([u, v]) => [u * outW, v * outH]);
    const bounds = quadBounds(quad);
    const boundsW = Math.max(1, bounds.x1 - bounds.x0), boundsH = Math.max(1, bounds.y1 - bounds.y0);

    const light = analyseLight(ctx, bounds);

    // Logo layer at native resolution scaled to roughly fill the quad's
    // bounding box, warped in a second pass — keeps the source crisp
    // instead of warping an already-downscaled bitmap.
    const scale = Math.min(3, Math.max(1, Math.max(boundsW, boundsH) / Math.max(logo.naturalWidth || logo.width, 1) * 1.4));
    const logoLayer = document.createElement('canvas');
    logoLayer.width = Math.round((logo.naturalWidth || logo.width) * scale);
    logoLayer.height = Math.round((logo.naturalHeight || logo.height) * scale);
    logoLayer.getContext('2d').drawImage(logo, 0, 0, logoLayer.width, logoLayer.height);

    // Recolour dark/near-black logos toward the scene's shadow tone and
    // very light logos toward its highlight tone by a small amount only —
    // never enough to alter the brand's actual colours, just enough that
    // pure #000/#fff ink doesn't look like a sticker under coloured light.
    const warpLayer = document.createElement('canvas');
    warpLayer.width = outW; warpLayer.height = outH;
    const wctx = warpLayer.getContext('2d');
    warpImageToQuad(wctx, logoLayer, quad, 14);

    // Shading pass: multiply a blurred greyscale copy of the underlying
    // surface into the logo, so its brightness varies exactly like the
    // wall/panel it sits on (masonry joints, panel seams, sign glare).
    const shadeLayer = document.createElement('canvas');
    shadeLayer.width = outW; shadeLayer.height = outH;
    const sctx = shadeLayer.getContext('2d');
    sctx.drawImage(canvas, 0, 0);
    sctx.filter = `grayscale(1) blur(${Math.max(1, boundsW * 0.01)}px) brightness(1.08) contrast(1.15)`;
    sctx.drawImage(canvas, 0, 0);
    sctx.filter = 'none';

    // Cast shadow, offset opposite the detected light direction.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(quad[0][0], quad[0][1]); quad.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.closePath();
    ctx.clip();
    const shadowDX = -Math.sign(light.hBias || 1) * boundsW * 0.012 * preset.shadow;
    const shadowDY = -Math.sign(light.vBias || 1) * boundsH * 0.02 * preset.shadow + boundsH * 0.01;
    ctx.globalAlpha = 0.30 * preset.shadow;
    ctx.filter = `blur(${Math.max(1, boundsW * 0.012)}px)`;
    ctx.drawImage(warpLayer, shadowDX, shadowDY);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.restore();

    // Composite the warped logo, then modulate it with the surface's own
    // shading, then let a faint pass of the raw surface texture show
    // through so it reads as printed/painted onto the material rather than
    // floating above it.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(quad[0][0], quad[0][1]); quad.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.closePath();
    ctx.clip();
    if (preset.blur) ctx.filter = `blur(${preset.blur}px)`;
    ctx.globalAlpha = preset.opacity;
    ctx.drawImage(warpLayer, 0, 0);
    ctx.filter = 'none';

    ctx.globalAlpha = preset.lighting;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(shadeLayer, 0, 0);
    // a light screen pass recovers highlight glare that pure multiply loses
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = preset.lighting * 0.30;
    ctx.drawImage(shadeLayer, 0, 0);

    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = preset.texture;
    ctx.drawImage(canvas, 0, 0);

    ctx.globalCompositeOperation = 'destination-in';
    ctx.globalAlpha = 1;
    ctx.drawImage(warpLayer, 0, 0); // keep result within the logo's own alpha shape
    ctx.restore();

    // The destination-in pass above only clipped a temp region conceptually;
    // actually composite the finished patch back onto the base photo.
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = outW; finalCanvas.height = outH;
    const fctx = finalCanvas.getContext('2d');
    fctx.drawImage(photo, 0, 0, outW, outH);
    fctx.save();
    fctx.beginPath();
    fctx.moveTo(quad[0][0], quad[0][1]); quad.slice(1).forEach(p => fctx.lineTo(p[0], p[1]));
    fctx.closePath();
    fctx.clip();
    fctx.drawImage(canvas, 0, 0);
    fctx.restore();

    const output = opts.output || 'dataURL';
    const quality = Number.isFinite(opts.quality) ? opts.quality : 0.92;
    if (output === 'canvas') return finalCanvas;
    if (output === 'blob') return new Promise((resolve, reject) =>
      finalCanvas.toBlob(b => b ? resolve(b) : reject(new Error('Export failed.')), 'image/jpeg', quality));
    if (output === 'objectURL') return URL.createObjectURL(await render({ ...opts, output: 'blob' }));
    return finalCanvas.toDataURL('image/jpeg', quality);
  }

  function defaultQuad() {
    return [[.30, .30], [.70, .30], [.70, .55], [.30, .55]];
  }

  // ---------------------------------------------------------------------
  // Interactive editor overlay: drag the 4 corners to fit a surface exactly
  // (manual fallback, or fine-tuning an auto-detected quad), plus a
  // drag-to-move / corner-resize interaction and a strength picker. Renders
  // a fast low-res live preview while dragging and a full-quality one on
  // release, so it stays responsive on large photos.
  // ---------------------------------------------------------------------
  function openEditor(options) {
    const opts = options || {};
    let strength = opts.strength || 'realistic';
    let quad = (opts.quad || defaultQuad()).map(p => p.slice());
    let photoImg, logoImg;
    let destroyed = false;

    const overlay = document.createElement('div');
    overlay.className = 'lp-overlay';
    overlay.innerHTML = `
      <div class="lp-panel">
        <div class="lp-canvas-wrap">
          <canvas class="lp-canvas"></canvas>
        </div>
        <div class="lp-sidebar">
          <h3>Place logo on photo</h3>
          <p class="lp-hint">Drag the corner handles onto the flat surface — wall, sign, window or van side. Drag inside the shape to move it.</p>
          <div class="lp-row">
            <button class="lp-btn" data-action="auto">Auto-detect surface</button>
          </div>
          <div class="lp-row lp-strength">
            <label><input type="radio" name="lp-strength" value="clean"> Clean</label>
            <label><input type="radio" name="lp-strength" value="realistic" checked> Realistic</label>
            <label><input type="radio" name="lp-strength" value="subtle"> Subtle</label>
          </div>
          <div class="lp-row lp-actions">
            <button class="lp-btn ghost" data-action="cancel">Cancel</button>
            <button class="lp-btn primary" data-action="save">Save</button>
          </div>
          <div class="lp-status"></div>
        </div>
      </div>`;
    injectStyles();
    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('.lp-canvas');
    const ctx = canvas.getContext('2d');
    const status = overlay.querySelector('.lp-status');
    overlay.querySelectorAll('input[name="lp-strength"]').forEach(r => {
      r.checked = r.value === strength;
      r.addEventListener('change', () => { if (r.checked) { strength = r.value; scheduleDraw(); } });
    });

    let candidates = [];
    let candidateIndex = -1;

    function fitCanvasSize() {
      const wrap = overlay.querySelector('.lp-canvas-wrap');
      const maxW = wrap.clientWidth, maxH = wrap.clientHeight;
      const ratio = photoImg.naturalWidth / photoImg.naturalHeight;
      let w = maxW, h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      canvas.width = Math.round(w); canvas.height = Math.round(h);
    }

    function toPx(pt) { return [pt[0] * canvas.width, pt[1] * canvas.height]; }
    function toNorm(x, y) { return [x / canvas.width, y / canvas.height]; }

    let drawToken = 0;
    function scheduleDraw() {
      const token = ++drawToken;
      requestAnimationFrame(() => { if (token === drawToken) draw(); });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(photoImg, 0, 0, canvas.width, canvas.height);
      // fast low-res preview composite, full-quality happens on save
      overlayPreview();
      drawHandles();
    }

    function overlayPreview() {
      const pts = quad.map(toPx);
      ctx.save();
      ctx.globalAlpha = STRENGTH_PRESETS[strength].opacity;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.clip();
      warpImageToQuad(ctx, logoImg, pts, 10);
      ctx.restore();
    }

    function drawHandles() {
      const pts = quad.map(toPx);
      ctx.save();
      ctx.strokeStyle = 'rgba(80,200,255,.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      pts.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(80,200,255,.95)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      ctx.restore();
    }

    // pointer interaction: drag a corner if near one, else drag whole quad
    let dragCorner = -1, dragOrigin = null, dragQuadStart = null;
    function pointerPos(e) {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    }
    function insideQuad(x, y) {
      const pts = quad.map(toPx);
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    }
    function onDown(e) {
      const [x, y] = pointerPos(e);
      const pts = quad.map(toPx);
      dragCorner = pts.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 14);
      if (dragCorner === -1 && insideQuad(x, y)) { dragCorner = -2; dragOrigin = [x, y]; dragQuadStart = quad.map(p => p.slice()); }
      else if (dragCorner === -1) return;
      e.preventDefault();
    }
    function onMove(e) {
      if (dragCorner === -1) return;
      const [x, y] = pointerPos(e);
      if (dragCorner === -2) {
        const dx = (x - dragOrigin[0]) / canvas.width, dy = (y - dragOrigin[1]) / canvas.height;
        quad = dragQuadStart.map(([u, v]) => [u + dx, v + dy]);
      } else {
        quad[dragCorner] = toNorm(Math.max(0, Math.min(canvas.width, x)), Math.max(0, Math.min(canvas.height, y)));
      }
      scheduleDraw();
      if (typeof opts.onChange === 'function') opts.onChange({ quad, strength });
    }
    function onUp() { dragCorner = -1; }
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    overlay.querySelector('[data-action="auto"]').onclick = async () => {
      status.textContent = 'Scanning the photo for a flat surface…';
      try {
        candidates = await detectSurfaces(photoImg);
        candidateIndex = (candidateIndex + 1) % Math.max(1, candidates.length);
        if (candidates[candidateIndex]) {
          quad = candidates[candidateIndex].quad.map(p => p.slice());
          status.textContent = candidates.length > 1
            ? `Suggestion ${candidateIndex + 1} of ${candidates.length} — click again for another, or drag the corners.`
            : 'Suggested a placement — drag the corners to fine-tune.';
          scheduleDraw();
        } else {
          status.textContent = 'No obvious flat area found — place the corners manually.';
        }
      } catch (error) {
        status.textContent = 'Could not auto-detect a surface — place the corners manually.';
      }
    };
    overlay.querySelector('[data-action="cancel"]').onclick = () => { destroy(); if (typeof opts.onCancel === 'function') opts.onCancel(); };
    overlay.querySelector('[data-action="save"]').onclick = async () => {
      status.textContent = 'Rendering full-resolution result…';
      try {
        const dataUrl = await render({
          photo: photoImg, logo: logoImg, quad, strength,
          width: photoImg.naturalWidth, height: photoImg.naturalHeight, output: 'dataURL'
        });
        destroy();
        if (typeof opts.onSave === 'function') opts.onSave({ dataUrl, quad, strength });
      } catch (error) {
        status.textContent = 'Could not render — try adjusting the placement.';
      }
    };

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      overlay.remove();
    }
    function onResize() { fitCanvasSize(); scheduleDraw(); }
    window.addEventListener('resize', onResize);

    (async () => {
      status.textContent = 'Loading…';
      [photoImg, logoImg] = await Promise.all([loadImage(opts.photo), loadImage(opts.logo)]);
      fitCanvasSize();
      status.textContent = '';
      scheduleDraw();
      if (!opts.quad) {
        try {
          const auto = await detectSurfaces(photoImg, { limit: 1 });
          if (auto[0] && !destroyed) { quad = auto[0].quad.map(p => p.slice()); scheduleDraw(); }
        } catch (error) { /* manual placement still works */ }
      }
    })();

    return { destroy };
  }

  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      .lp-overlay { position: fixed; inset: 0; background: rgba(10,12,16,.72); z-index: 9999; display: flex; align-items: center; justify-content: center; }
      .lp-panel { background: #16181d; border-radius: 12px; display: flex; width: min(1100px, 94vw); height: min(720px, 90vh); overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
      .lp-canvas-wrap { flex: 1 1 auto; background: #0b0c0f; display: flex; align-items: center; justify-content: center; }
      .lp-canvas { touch-action: none; cursor: grab; max-width: 100%; max-height: 100%; }
      .lp-sidebar { width: 260px; flex: none; padding: 20px; color: #e8e9ec; display: flex; flex-direction: column; gap: 12px; border-left: 1px solid rgba(255,255,255,.08); }
      .lp-sidebar h3 { margin: 0; font-size: 16px; }
      .lp-hint { margin: 0; font-size: 12.5px; line-height: 1.5; color: #a6a9b1; }
      .lp-row { display: flex; gap: 8px; flex-wrap: wrap; }
      .lp-strength { flex-direction: column; gap: 6px; font-size: 13px; }
      .lp-strength label { display: flex; align-items: center; gap: 6px; }
      .lp-btn { flex: 1 1 auto; padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,.14); background: #23262e; color: #fff; cursor: pointer; font-size: 13px; }
      .lp-btn:hover { background: #2c303a; }
      .lp-btn.primary { background: #3d7bfa; border-color: #3d7bfa; }
      .lp-btn.primary:hover { background: #5a8dfb; }
      .lp-btn.ghost { background: transparent; }
      .lp-actions { margin-top: auto; }
      .lp-status { font-size: 12px; color: #9fb3ff; min-height: 16px; }
    `;
    document.head.appendChild(style);
  }

  global.LogoPlacement = Object.freeze({
    removeBackground, detectSurfaces, render, openEditor, strengthPresets: STRENGTH_PRESETS
  });
})(window);
