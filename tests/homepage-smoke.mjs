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

async function runHomepageFlow(label, contextOptions, mobile) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://*.vercel.app/**', (route) => route.abort());
  await page.route('https://klreehoegatehoubhhog.supabase.co/**', (route) => {
    route.fulfill({ status: 201, body: '' });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(baseUrl, { waitUntil: 'load' });

  await page.locator('#cx').scrollIntoViewIfNeeded();
  const firstCarouselIndex = await page.locator('#cx').getAttribute('data-active');
  await page.waitForTimeout(1350);
  const nextCarouselIndex = await page.locator('#cx').getAttribute('data-active');
  assert.notEqual(nextCarouselIndex, firstCarouselIndex, `${label}: carousel should advance every 1.2s`);

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

  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => window.scrollY > 0), `${label}: document should scroll`);
  await page.evaluate(() => window.scrollTo(0, 0));

  const nameInput = page.locator('#bizName');
  await nameInput.tap();
  const focusedPlaceholderOpacity = await nameInput.evaluate((element) => (
    getComputedStyle(element, '::placeholder').opacity
  ));
  assert.equal(focusedPlaceholderOpacity, '0', `${label}: question text should clear on focus`);
  await nameInput.pressSequentially('BrightSite Test Studio', { delay: 20 });
  assert.equal(await nameInput.inputValue(), 'BrightSite Test Studio', `${label}: name should stay typed`);

  await page.locator('#qaNameGo').tap();
  await page.locator('#qaSlideType.qa-active').waitFor();
  await page.locator('#qaSlideName[hidden]').waitFor({ state: 'attached' });
  assert.equal(await nameInput.inputValue(), 'BrightSite Test Studio', `${label}: intentional capitals should remain`);

  await page.locator('#bizTagline').selectOption({ label: 'Hair & Beauty' });
  await page.locator('#qaSlideLocation.qa-active').waitFor();
  await page.locator('#qaSlideType[hidden]').waitFor({ state: 'attached' });

  const locationInput = page.locator('#bizLocation');
  await locationInput.tap();
  await locationInput.pressSequentially('Beverley', { delay: 20 });
  assert.equal(await locationInput.inputValue(), 'Beverley', `${label}: location should stay typed`);

  await page.locator('#qaLocationNext').tap();
  await page.locator('#builderOverlay:not([hidden])').waitFor({ timeout: 10000 });

  const rootLocked = await page.evaluate(() => document.documentElement.classList.contains('builder-scroll-lock'));
  assert.equal(rootLocked, !mobile, `${label}: scroll lock should be desktop-only`);

  const builderInput = page.locator('#builderInput');
  await builderInput.tap();
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
