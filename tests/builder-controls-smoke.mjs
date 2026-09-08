import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const relativePath = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    .replace(/^[/\\]+/, '');
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

async function revealBuilder(page) {
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.locator('#builderOverlay').evaluate((overlay) => {
    overlay.hidden = false;
    window.dispatchEvent(new Event('resize'));
  });
}

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktop = await desktopContext.newPage();
  await revealBuilder(desktop);

  assert.equal(
    await desktop.locator('.builder-bar-wrap').evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgb(255, 255, 255)',
    'desktop builder dock should be white'
  );
  assert.equal(await desktop.locator('#builderOpenHtml').isVisible(), true, 'desktop full-screen button should be visible');

  await desktop.locator('#builderDeviceMobile').click();
  assert.equal(await desktop.locator('#builderPreview').evaluate((element) => element.classList.contains('mobile-view')), true);
  assert.equal(await desktop.locator('#builderDeviceMobile').getAttribute('aria-pressed'), 'true');

  await desktop.locator('#builderDeviceDesktop').click();
  assert.equal(await desktop.locator('#builderPreview').evaluate((element) => element.classList.contains('mobile-view')), false);
  assert.equal(await desktop.locator('#builderDeviceDesktop').getAttribute('aria-pressed'), 'true');

  const popupPromise = desktopContext.waitForEvent('page');
  await desktop.locator('#builderOpenHtml').click();
  const popup = await popupPromise;
  await popup.waitForLoadState('load');
  assert.match(popup.url(), /^blob:/, 'full-screen button should open the generated site');
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobile = await mobileContext.newPage();
  await revealBuilder(mobile);

  assert.equal(
    await mobile.locator('.builder-bar-wrap').evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgba(0, 0, 0, 0)',
    'mobile builder dock should stay transparent'
  );
  assert.equal(await mobile.locator('#builderOpenHtml').isVisible(), false, 'mobile full-screen button should be hidden');
  await mobileContext.close();

  console.log('Builder controls passed desktop and mobile checks.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
