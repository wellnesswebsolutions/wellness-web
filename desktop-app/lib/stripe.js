// Stripe payment links for customers on the Live tab. The secret key is
// saved in Settings and lives on this computer only (not synced), in
// ~/BrightSiteProjects/stripe-settings.json. STRIPE_SECRET_KEY in the
// environment overrides it for development.
const fs = require('fs');
const path = require('path');
const storage = require('./site-storage');

const SETTINGS_FILE = path.join(storage.ROOT, 'stripe-settings.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { return {}; }
}

function getKey() {
  return process.env.STRIPE_SECRET_KEY || readSettings().apiKey || '';
}

function setKey(apiKey, account = '') {
  storage.ensureRoot();
  if (apiKey) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ apiKey, account }, null, 2));
  else fs.rmSync(SETTINGS_FILE, { force: true });
}

// Same shape as the CLI connections in lib/connections.js, for Settings.
function status() {
  const key = getKey();
  if (!key) return { installed: true, signedIn: false };
  return { installed: true, signedIn: true, account: `${readSettings().account || 'Stripe'}${key.includes('_test_') ? ' (test mode)' : ''}` };
}

async function call(endpoint, params, key = getKey()) {
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: params ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params ? new URLSearchParams(params) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message || `Stripe error ${res.status}`);
  return body;
}

// Proves the key can see payment links, and finds the account's name to
// show in Settings (restricted keys may not be allowed to read it).
async function testKey(key) {
  await call('payment_links?limit=1', null, key);
  const account = await call('account', null, key).catch(() => null);
  return account?.settings?.dashboard?.display_name || account?.business_profile?.name || account?.email || 'Stripe account';
}

// One link per plan: the recurring hosting price plus, if there is one,
// the one-off setup fee (charged with the first payment).
async function createPaymentLink({ business, slug, planName, setup, amount, interval }) {
  if (!getKey()) throw new Error('Add your Stripe secret key in Settings first.');
  const pence = n => String(Math.round(n * 100));
  const prices = [];
  if (amount > 0) {
    prices.push(await call('prices', {
      currency: 'gbp', unit_amount: pence(amount), 'recurring[interval]': interval,
      'product_data[name]': `${planName} website — ${business}`
    }));
  }
  if (setup > 0) {
    prices.push(await call('prices', {
      currency: 'gbp', unit_amount: pence(setup), 'product_data[name]': `${planName} website setup — ${business}`
    }));
  }
  if (!prices.length) throw new Error('This plan has nothing to charge.');
  const params = { 'metadata[brightsite_slug]': slug };
  prices.forEach((price, i) => {
    params[`line_items[${i}][price]`] = price.id;
    params[`line_items[${i}][quantity]`] = '1';
  });
  return (await call('payment_links', params)).url;
}

module.exports = { getKey, setKey, status, testKey, createPaymentLink };
