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
  await page.route('https://brightsite.app/img/**', async route => {
    const asset = new URL(route.request().url()).pathname;
    await route.fulfill({path:join(root,asset)});
  });
  await page.route('**/rest/v1/**', route => route.fulfill({status:201,body:''}));
  await page.route('**/wellnessweb-notify-lead.**', route => route.fulfill({status:200,body:'{}'}));
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.getElementById('bizName').value = 'Hull Hair';
    document.getElementById('bizTagline').value = 'Hair & Beauty';
    document.getElementById('bizLocation').value = 'Hull';
  });
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
    'rgba(0, 0, 0, 0)',
    'desktop controls should float without a dock'
  );
  assert.equal(await desktop.locator('#builderOpenHtml').count(), 0, 'fullscreen removed');

  await desktop.locator('#builderDeviceMobile').click();
  assert.equal(await desktop.locator('#builderPreview').evaluate((element) => element.classList.contains('mobile-view')), true);
  assert.equal(await desktop.locator('#builderDeviceMobile').getAttribute('aria-pressed'), 'true');
  for (const height of [900,700]) {
    await desktop.setViewportSize({width:1440,height});
    await desktop.locator('.builder-phone-frame').evaluate(element => Promise.all(element.parentElement.getAnimations().map(animation=>animation.finished)));
    const phone = await desktop.locator('.builder-phone-frame').boundingBox();
    const tools = await desktop.locator('.builder-glass-tools').boundingBox();
    assert.ok(Math.abs(phone.height/phone.width - 2) < .02,'phone preview keeps a compact 2:1 ratio');
    assert.ok(phone.y+phone.height <= tools.y-12,'phone stays above the floating tools');
  }
  await desktop.setViewportSize({width:1440,height:900});

  await desktop.locator('#builderDeviceDesktop').click();
  assert.equal(await desktop.locator('#builderPreview').evaluate((element) => element.classList.contains('mobile-view')), false);
  assert.equal(await desktop.locator('#builderDeviceDesktop').getAttribute('aria-pressed'), 'true');

  await desktop.locator('[data-tool="colour"]').click();
  await desktop.locator('[data-family="Bold"]').click();
  await desktop.locator('[data-colour]').first().click();
  const surfaceColours = async () => desktop.frameLocator('#previewFrame').locator('body').evaluate(() =>
    ['body','.site-header','.service-card','.closing'].map(selector => getComputedStyle(document.querySelector(selector)).backgroundColor));
  await desktop.frameLocator('#previewFrame').locator('.service-card').first().waitFor();
  const firstPalette = await surfaceColours();
  assert.equal(await desktop.locator('#builderOptions').isVisible(),false);
  await desktop.locator('[data-tool="colour"]').click();
  await desktop.locator('[data-family="Bold"]').click();
  await desktop.locator('[data-colour="#245bb0"]').click();
  await desktop.frameLocator('#previewFrame').locator('body').evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  const secondPalette = await surfaceColours();
  firstPalette.forEach((colour,index) => assert.notEqual(secondPalette[index],colour,'palette must update every major surface'));
  await desktop.locator('[data-tool="colour"]').click();
  await desktop.locator('[data-family="Dark"]').click();
  await desktop.locator('[data-colour="#26313e"]').click();
  await desktop.frameLocator('#previewFrame').locator('body').waitFor();
  assert.equal(await desktop.frameLocator('#previewFrame').locator('html').evaluate(el=>getComputedStyle(el).colorScheme),'dark');
  await desktop.locator('[data-tool="font"]').click();
  await desktop.locator('[data-font="editorial"]').click();
  assert.equal(await desktop.locator('#builderOptions').isVisible(),false);
  assert.match(await desktop.frameLocator('#previewFrame').locator('.hero .button').first().evaluate(el=>getComputedStyle(el).fontFamily),/Fraunces/);
  await desktop.locator('[data-tool="layout"]').click();
  await desktop.locator('[data-layout="creative"]').click();
  await desktop.frameLocator('#previewFrame').locator('body.layout-creative').waitFor();
  await desktop.keyboard.press('Escape');
  assert.equal(await desktop.locator('#builderOptions').isVisible(), false);
  await desktop.locator('[data-tool="send"]').click();
  assert.equal(await desktop.getByRole('button', {name:'Send To Designer',exact:true}).isVisible(),true);
  await desktop.locator('[data-tool="send"]').click();
  assert.equal(await desktop.locator('#builderOptions').isVisible(),false);
  await desktop.frameLocator('#previewFrame').locator('.brand-scene').evaluate(async image => {await image.decode(); await Promise.all(image.getAnimations().map(animation => animation.finished));});
  const desktopHero = await desktop.frameLocator('#previewFrame').locator('.brand-scene').evaluate(image => {
    const photo = image.getBoundingClientRect();
    const copy = document.querySelector('.hero-copy').getBoundingClientRect();
    return {overlays:copy.top < photo.bottom, logoClear:copy.top >= photo.top + photo.height * .52, bottomAligned:Math.abs(copy.bottom-photo.bottom)<2};
  });
  assert.deepEqual(desktopHero,{overlays:true,logoClear:true,bottomAligned:true});
  await desktop.screenshot({path:'/tmp/brightsite-builder-desktop.png'});
  // Render the real compositor output into the new renderer, then inspect the
  // body at desktop and phone widths. No lead or designer messages are sent.
  const brandedHero = await desktop.evaluate(() => HeroBrandCompositor.render({category:'Hair & Beauty',businessName:'Hull Hair',location:'Hull',output:'dataURL'}));
  assert.match(brandedHero,/^data:image\//);
  const site = await desktopContext.newPage();
  const errors=[];
  site.on('pageerror',error=>errors.push(error.message));
  for(const [category,layout] of [['Hair & Beauty','salon'],['Trades','trades'],['Food & Drink','restaurant'],['Fitness','fitness'],['Creative','creative'],['Professional Services','professional'],['Automotive','automotive']]) {
    const html = await desktop.evaluate(({category,brandedHero}) => buildDemoHTML({name:'Studio North',tagline:category,location:'Hull',heroImage:brandedHero}),{category,brandedHero});
    await site.setContent(html,{waitUntil:'domcontentloaded'});
    assert.equal(await site.locator('.brand-scene').getAttribute('src'),brandedHero);
    await site.emulateMedia({reducedMotion:'reduce'});
    await site.locator('.signature').scrollIntoViewIfNeeded();
    await site.waitForFunction(()=>Array.from(document.querySelectorAll('.signature .demo-photo')).filter(img=>img.getBoundingClientRect().top<innerHeight).every(img=>img.complete&&img.naturalWidth>0),{},{timeout:15000});
    await site.screenshot({path:`/tmp/brightsite-fresh-${layout}.png`});
    assert.equal(await site.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${layout} should fit desktop`);
    await site.setViewportSize({width:390,height:844});
    assert.equal(await site.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${layout} should fit mobile`);
    await site.setViewportSize({width:1440,height:900});
  }
  assert.deepEqual(errors,[],'generated sites must have no script errors');
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobile = await mobileContext.newPage();
  await revealBuilder(mobile);

  assert.equal(
    await mobile.locator('.builder-bar-wrap').evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgba(0, 0, 0, 0)',
    'mobile builder dock should stay transparent'
  );
  assert.equal(await mobile.locator('#builderOpenHtml').count(), 0);
  for (const layout of ['salon','trades','restaurant','fitness','creative','professional','automotive']) {
    await mobile.locator('[data-tool="layout"]').click();
    await mobile.locator(`[data-layout="${layout}"]`).click();
    assert.equal(await mobile.locator('#builderOptions').isVisible(),false);
    const frame = mobile.frameLocator('#previewFrame');
    await frame.locator(`body.layout-${layout}`).waitFor();
    const geometry = await frame.locator('.brand-scene').evaluate(image => {
      const photo = image.getBoundingClientRect();
      const copy = document.querySelector('.hero-copy').getBoundingClientRect();
      const header = document.querySelector('.site-header').getBoundingClientRect();
      return {contained:getComputedStyle(image).objectFit === 'contain', separate:copy.top >= photo.bottom - 1, belowHeader:photo.top >= header.bottom - 1, fits:photo.right <= innerWidth + 1};
    });
    assert.deepEqual(geometry,{contained:true,separate:true,belowHeader:true,fits:true});
    assert.equal(await frame.locator('.gallery-demo').count(),6);
    assert.equal(await frame.locator('.review-card').count(),3);
    assert.equal(await frame.locator('body').evaluate(el=>el.textContent.includes('↗')),false);
    assert.equal(await frame.locator('.header-action').isVisible(),true);
    await frame.locator('.header-action').click();
    assert.equal(await frame.locator('[data-page="contact"]').isVisible(),true);
    assert.equal(await frame.locator('[data-page="contact"] iframe').count(),1);
    await frame.locator('.menu-toggle').click();
    await frame.locator('#mobileNav [data-nav="home"]').click();
    assert.equal(await frame.locator('#mobileNav').isVisible(),false);
  }
  await mobile.locator('[data-tool="layout"]').click();
  await mobile.locator('[data-layout="salon"]').click();
  await mobile.locator('[data-tool="colour"]').click();
  await mobile.frameLocator('#previewFrame').locator('.brand-scene').evaluate(async image => {await image.decode(); await Promise.all(image.getAnimations().map(animation => animation.finished));});
  await mobile.screenshot({path:'/tmp/brightsite-builder-mobile.png'});
  await mobileContext.close();

  console.log('Builder controls passed desktop and mobile checks.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
