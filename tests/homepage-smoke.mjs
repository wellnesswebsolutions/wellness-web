import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const relativePath = normalize(requestedPath).replace(/^[/\\]+/, '');
  const filePath = join(root, relativePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const file = await stat(filePath);
    if (!file.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });

async function swipeUp(page, { x, startY, endY }) {
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: startY }]
  });

  const steps = 12;
  for (let step = 1; step <= steps; step++) {
    const y = startY + ((endY - startY) * step / steps);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y }]
    });
    await page.waitForTimeout(18);
  }

  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: []
  });
  await client.detach();
  await page.waitForTimeout(450);
}

async function runHomepageFlow(label, contextOptions, mobile) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  const activate = (locator) => mobile ? locator.tap() : locator.click();

  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://*.vercel.app/**', (route) => route.abort());
  await page.route('https://klreehoegatehoubhhog.supabase.co/**', (route) => {
    route.fulfill({ status: 201, body: '' });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(baseUrl, { waitUntil: 'load' });

  await page.locator('#cx').scrollIntoViewIfNeeded();
  const firstCarouselIndex = await page.locator('#cx').getAttribute('data-active');
  await page.waitForTimeout(1950);
  const nextCarouselIndex = await page.locator('#cx').getAttribute('data-active');
  assert.notEqual(nextCarouselIndex, firstCarouselIndex, `${label}: carousel should advance every 1.8s`);

  const activeCardMotion = await page.locator('.cx-item[data-pos="0"] .cx-float').evaluate((element) => (
    getComputedStyle(element).animationName
  ));
  assert.equal(activeCardMotion, 'cx-centre-drift', `${label}: centre card should keep drifting`);

  const dotColoursMatch = await page.locator('.cx-item[data-pos="0"]').evaluate((item) => {
    const dot = item.querySelector('.cx-dot');
    const itemColour = getComputedStyle(item).getPropertyValue('--cx-hero-colour').trim();
    const probe = document.createElement('span');
    probe.style.color = itemColour;
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    return getComputedStyle(dot).backgroundColor === expected;
  });
  assert.equal(dotColoursMatch, true, `${label}: active dot should match the site's hero colour`);

  if (mobile) {
    await page.locator('#cx').evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(100);
    const carouselBox = await page.locator('#cx').boundingBox();
    const viewport = page.viewportSize();
    const beforeSwipe = await page.evaluate(() => window.scrollY);
    const startY = Math.min(viewport.height - 70, carouselBox.y + carouselBox.height * 0.72);
    await swipeUp(page, {
      x: Math.round(viewport.width / 2),
      startY: Math.round(startY),
      endY: Math.round(Math.max(80, startY - 340))
    });
    const afterSwipe = await page.evaluate(() => window.scrollY);
    assert.ok(
      afterSwipe > beforeSwipe + 40,
      `${label}: a real finger swipe over the carousel should scroll (${beforeSwipe} -> ${afterSwipe})`
    );
  } else {
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => window.scrollY > 0), `${label}: document should scroll`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  const nameInput = page.locator('#bizName');
  await activate(nameInput);
  const focusedPlaceholderOpacity = await nameInput.evaluate((element) => (
    getComputedStyle(element, '::placeholder').opacity
  ));
  assert.equal(focusedPlaceholderOpacity, '0', `${label}: question text should clear on focus`);
  await nameInput.pressSequentially('BrightSite Test Studio', { delay: 20 });
  assert.equal(await nameInput.inputValue(), 'BrightSite Test Studio', `${label}: name should stay typed`);

  await activate(page.locator('#qaNameGo'));
  await page.locator('#qaSlideType.qa-active').waitFor();
  await page.locator('#qaSlideName[hidden]').waitFor({ state: 'attached' });
  assert.equal(await nameInput.inputValue(), 'BrightSite Test Studio', `${label}: intentional capitals should remain`);

  await page.locator('#bizTagline').selectOption({ label: 'Hair & Beauty' });
  await page.locator('#qaSlideLocation.qa-active').waitFor();
  await page.locator('#qaSlideType[hidden]').waitFor({ state: 'attached' });

  const locationInput = page.locator('#bizLocation');
  await activate(locationInput);
  await locationInput.pressSequentially('Beverley', { delay: 20 });
  assert.equal(await locationInput.inputValue(), 'Beverley', `${label}: location should stay typed`);

  await activate(page.locator('#qaLocationNext'));
  await page.locator('#builderOverlay:not([hidden])').waitFor({ timeout: 10000 });
  await page.getByText('A quick demo — your final website can be anything you imagine').waitFor();
  assert.equal(await page.locator('.builder-style').count(), 5, `${label}: builder should offer five genuinely different styles`);
  for (const style of ['minimal', 'studio']) {
    await activate(page.locator(`.builder-style[data-style="${style}"]`));
    await page.waitForFunction((expected) => document.querySelector('#previewFrame').contentDocument?.body.classList.contains(`site-style-${expected}`), style);
  }
  const foodDemo = await page.evaluate(() => buildDemoHTML({
    name: 'The Sample Kitchen', tagline: 'Food & Drink', location: 'Beverley', services: [], prices: [], goal: 'Book now', stylePreset: 'minimal'
  }));
  assert.match(foodDemo, />Menu</, `${label}: food sites should use Menu navigation`);
  assert.match(foodDemo, /Reserve a table/, `${label}: food sites should use a relevant reservation CTA`);
  await page.waitForFunction(() => document.querySelector('#previewFrame').contentDocument?.querySelectorAll('.gallery-demo img').length === 6);
  const galleryNotice = await page.locator('#previewFrame').evaluate((frame) => (
    frame.contentDocument.body.textContent.includes('all six will be replaced with your own photographs before launch')
  ));
  assert.equal(galleryNotice, true, `${label}: demo gallery should explain that customer photographs replace it`);

  const rootLocked = await page.evaluate(() => document.documentElement.classList.contains('builder-scroll-lock'));
  assert.equal(rootLocked, !mobile, `${label}: scroll lock should be desktop-only`);

  const signPalette = page.locator('#builderSignPalette');
  const signAuto = page.locator('[data-sign-colour=""]');
  const blueSign = page.locator('[data-sign-colour="#2563eb"]');
  assert.equal(await signPalette.isVisible(), true, `${label}: sign colour palette should be visible`);
  assert.equal(await signAuto.getAttribute('aria-pressed'), 'true', `${label}: sign colour should start in auto mode`);
  const previewBeforeColour = await page.locator('#previewFrame').getAttribute('srcdoc');
  await activate(page.locator('#builderSignPalette summary'));
  await activate(blueSign);
  await page.waitForFunction((before) => (
    document.querySelector('#previewFrame').getAttribute('srcdoc') !== before
  ), previewBeforeColour);
  assert.equal(await signAuto.getAttribute('aria-pressed'), 'false', `${label}: choosing a colour should leave auto mode`);
  await activate(page.locator('#builderSignPalette summary'));
  await activate(signAuto);
  await page.waitForFunction(() => document.querySelector('[data-sign-colour=""]').getAttribute('aria-pressed') === 'true');

  if (mobile) {
    const previewFrame = page.locator('#previewFrame');
    const frameBox = await previewFrame.boundingBox();
    const beforePreviewSwipe = await previewFrame.evaluate((frame) => frame.contentWindow.scrollY);
    const startY = Math.min(frameBox.y + frameBox.height - 90, page.viewportSize().height - 150);
    await swipeUp(page, {
      x: Math.round(frameBox.x + frameBox.width / 2),
      startY: Math.round(startY),
      endY: Math.round(Math.max(frameBox.y + 80, startY - 360))
    });
    const afterPreviewSwipe = await previewFrame.evaluate((frame) => frame.contentWindow.scrollY);
    assert.ok(
      afterPreviewSwipe > beforePreviewSwipe + 40,
      `${label}: a real finger swipe should scroll the generated preview (${beforePreviewSwipe} -> ${afterPreviewSwipe})`
    );
  }

  const builderInput = page.locator('#builderInput');
  await activate(builderInput);
  await builderInput.pressSequentially('Lucan Tester', { delay: 20 });
  assert.equal(await builderInput.inputValue(), 'Lucan Tester', `${label}: builder input should accept typing`);

  assert.deepEqual(errors, [], `${label}: page should not throw runtime errors`);
  await context.close();
}

try {
  await runHomepageFlow('desktop', { viewport: { width: 1440, height: 900 } }, false);
  await runHomepageFlow('iPhone 13', { ...devices['iPhone 13'] }, true);
  console.log('Homepage smoke tests passed on desktop and iPhone 13.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
