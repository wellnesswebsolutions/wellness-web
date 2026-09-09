const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const DAILY_LIMIT = 25;
const MONTHLY_LIMIT = 850;

function normalise(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cacheKey(name, location) {
  return `${normalise(name)}|${normalise(location)}`.slice(0, 240);
}

function supabaseHeaders(key) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function getCachedMatch(baseUrl, key, lookupKey) {
  const result = await fetch(`${baseUrl}/rest/v1/rpc/get_business_lookup_cache`, {
    method: 'POST', headers: supabaseHeaders(key), body: JSON.stringify({ requested_key: lookupKey })
  });
  if (!result.ok) throw new Error(`Cache read failed: ${result.status}`);
  return result.json();
}

async function claimLookup(baseUrl, key) {
  const result = await fetch(`${baseUrl}/rest/v1/rpc/claim_google_lookup`, {
    method: 'POST', headers: supabaseHeaders(key), body: '{}'
  });
  if (!result.ok) throw new Error(`Quota check failed: ${result.status}`);
  return result.json();
}

async function storeCachedMatch(baseUrl, key, lookupKey, payload) {
  const result = await fetch(`${baseUrl}/rest/v1/rpc/store_business_lookup_cache`, {
    method: 'POST',
    headers: supabaseHeaders(key),
    body: JSON.stringify({ requested_key: lookupKey, requested_payload: payload })
  });
  if (!result.ok) throw new Error(`Cache write failed: ${result.status}`);
}

function tokenScore(expected, actual) {
  const wanted = new Set(normalise(expected).split(' ').filter(Boolean));
  const found = new Set(normalise(actual).split(' ').filter(Boolean));
  if (!wanted.size || !found.size) return 0;
  let matches = 0;
  wanted.forEach(token => { if (found.has(token)) matches += 1; });
  return matches / wanted.size;
}

function mapPlace(place) {
  return {
    placeId: place.id,
    name: place.displayName?.text || '',
    address: place.formattedAddress || '',
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
    website: place.websiteUri || '',
    mapsUrl: place.googleMapsUri || '',
    category: place.primaryTypeDisplayName?.text || '',
    rating: place.rating || null,
    reviewCount: place.userRatingCount || 0,
    hours: place.regularOpeningHours?.weekdayDescriptions || [],
    openNow: place.regularOpeningHours?.openNow,
    reviews: (place.reviews || []).slice(0, 3).map(review => ({
      text: review.text?.text || review.originalText?.text || '',
      rating: review.rating || 5,
      author: review.authorAttribution?.displayName || 'Google reviewer',
      authorUrl: review.authorAttribution?.uri || '',
      relativeTime: review.relativePublishTimeDescription || ''
    })).filter(review => review.text),
    // One Google image per preview keeps the demo inside the monthly photo
    // allowance at roughly 30 previews/day. Facebook can still add more.
    photos: []
  };
}

export default async function handler(request, response) {
  const origin = request.headers.origin;
  if (origin === 'https://brightsite.app' || origin === 'https://www.brightsite.app') {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return response.status(503).json({ error: 'Business lookup is not configured' });
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return response.status(503).json({ error: 'Safe lookup quota is not configured' });

  const name = String(request.query.name || '').trim().slice(0, 120);
  const location = String(request.query.location || '').trim().slice(0, 120);
  if (!name || !location) return response.status(400).json({ error: 'Business name and location are required' });

  try {
    const lookupKey = cacheKey(name, location);
    const cached = await getCachedMatch(supabaseUrl, supabaseKey, lookupKey);
    if (cached) return response.status(200).json({ match: cached, cached: true });
    const allowed = await claimLookup(supabaseUrl, supabaseKey);
    if (!allowed) return response.status(429).json({ error: 'Free Google lookup allowance reached' });

    const googleResponse = await fetch(GOOGLE_PLACES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': [
          'places.id', 'places.displayName', 'places.formattedAddress',
          'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
          'places.websiteUri', 'places.googleMapsUri', 'places.primaryTypeDisplayName',
          'places.rating', 'places.userRatingCount', 'places.regularOpeningHours',
          'places.reviews'
        ].join(',')
      },
      body: JSON.stringify({ textQuery: `${name}, ${location}`, maxResultCount: 5, languageCode: 'en-GB' })
    });
    if (!googleResponse.ok) {
      console.error('Places lookup failed', googleResponse.status, await googleResponse.text());
      return response.status(502).json({ error: 'Business lookup failed' });
    }

    const data = await googleResponse.json();
    const ranked = (data.places || []).map(place => ({
      place,
      score: tokenScore(name, place.displayName?.text) * 0.75 + tokenScore(location, place.formattedAddress) * 0.25
    })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score < 0.45) return response.status(200).json({ match: null });

    const match = mapPlace(best.place);
    await storeCachedMatch(supabaseUrl, supabaseKey, lookupKey, match);
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return response.status(200).json({ match });
  } catch (error) {
    console.error('Places lookup error', error);
    return response.status(502).json({ error: 'Business lookup failed' });
  }
}
