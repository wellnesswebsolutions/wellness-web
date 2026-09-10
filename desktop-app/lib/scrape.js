// Best-effort, no-API extraction: fetch the public page HTML and read
// whatever it already publishes for link-preview purposes (Open Graph /
// meta tags, schema.org JSON-LD). No Graph API key, no Places API key.
// Fragile by nature — pages change their markup, and some content is
// only rendered client-side and won't show up in the raw HTML at all.

async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'en-GB,en;q=0.9'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Facebook actively blocks plain server-side fetches for a lot of pages
// (observed: www.facebook.com returns 400, mbasic.facebook.com returns a
// login wall for many pages) — there is no reliable no-API path here for
// every page. We try twice with different entry points and surface a
// clear "couldn't read this page" message rather than pretending it
// worked, so nothing gets silently left blank without you knowing why.
async function fetchFacebookHtml(url) {
  const attempts = [url];
  try {
    const u = new URL(url);
    if (/(^|\.)facebook\.com$/.test(u.hostname) && !u.hostname.startsWith('mbasic.')) {
      attempts.push(`https://mbasic.facebook.com${u.pathname}${u.search}`);
    }
  } catch { /* not a URL we can rewrite, just try as-is */ }

  let lastError;
  for (const attempt of attempts) {
    try {
      const html = await fetchHtml(attempt);
      if (/log ?in to (facebook|continue)|content not found/i.test(html) && !/og:title/i.test(html)) {
        lastError = new Error('Facebook served a login/blocked page instead of the business page');
        continue;
      }
      return html;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Could not reach Facebook');
}

function metaContent(html, attr, key) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i');
  const alt = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`, 'i');
  const m = html.match(re) || html.match(alt);
  return m ? decodeEntities(m[1]) : '';
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function jsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try { blocks.push(JSON.parse(m[1].trim())); } catch { /* ignore malformed block */ }
  }
  return blocks.flatMap(b => Array.isArray(b) ? b : [b]);
}

function findLocalBusiness(blocks) {
  return blocks.find(b => {
    const type = b['@type'];
    const types = Array.isArray(type) ? type : [type];
    return types.some(t => /LocalBusiness|Organization|Store|Restaurant|BeautySalon|HealthClub/i.test(t || ''));
  });
}

async function scrapeFacebook(url) {
  const html = await fetchFacebookHtml(url);
  const blocks = jsonLdBlocks(html);
  const biz = findLocalBusiness(blocks);
  const name = metaContent(html, 'property', 'og:title') || biz?.name || '';
  const about = metaContent(html, 'property', 'og:description') || biz?.description || '';
  const image = metaContent(html, 'property', 'og:image') || biz?.image || '';
  const phone = biz?.telephone || '';
  const address = typeof biz?.address === 'string'
    ? biz.address
    : [biz?.address?.streetAddress, biz?.address?.addressLocality, biz?.address?.postalCode].filter(Boolean).join(', ');
  return {
    source: 'facebook',
    url,
    name: name.replace(/\s*\|\s*Facebook.*/i, '').trim(),
    about,
    phone,
    address,
    hours: Array.isArray(biz?.openingHours) ? biz.openingHours : [],
    images: [image].filter(Boolean)
  };
}

function parseGoogleMapsUrl(url) {
  // Google Maps place URLs embed the readable name in the path, e.g.
  // /maps/place/Some+Business+Name/@lat,lng,...  We don't scrape Maps
  // itself (heavily JS-rendered, unreliable without the Places API) —
  // we just pull the name for a head start and keep the URL for an
  // embeddable map on the generated site.
  let name = '';
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/place\/([^/]+)/);
    if (match) name = decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch { /* not a parseable URL */ }
  return { source: 'google', url, name, mapsUrl: url };
}

module.exports = { scrapeFacebook, parseGoogleMapsUrl };
