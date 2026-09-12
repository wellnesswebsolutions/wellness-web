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
  if (amount > 0) params['subscription_data[metadata][brightsite_slug]'] = slug;
  prices.forEach((price, i) => {
    params[`line_items[${i}][price]`] = price.id;
    params[`line_items[${i}][quantity]`] = '1';
  });
  return (await call('payment_links', params)).url;
}

// Where each customer's subscription stands, keyed by business slug:
// 'active', 'cancelling' (cancelled, runs until `until`), 'failed' (payment
// failing) or 'cancelled'. Found through the payment links Studio made
// (tagged with brightsite_slug) and the checkouts completed on them.
const BILLING_RANK = { active: 4, cancelling: 3, failed: 2, cancelled: 1 };

function billingOf(sub) {
  const until = sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : '';
  if (['active', 'trialing'].includes(sub.status)) return sub.cancel_at_period_end || sub.cancel_at ? { status: 'cancelling', until } : { status: 'active', until: '' };
  if (['past_due', 'unpaid', 'incomplete'].includes(sub.status)) return { status: 'failed', until: '' };
  return { status: 'cancelled', until: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : '' };
}

async function billingBySlug() {
  if (!getKey()) return {};
  const out = {};
  const links = (await call('payment_links?limit=100')).data.filter(l => l.metadata?.brightsite_slug);
  for (const link of links) {
    const slug = link.metadata.brightsite_slug;
    const sessions = (await call(`checkout/sessions?payment_link=${link.id}&status=complete&limit=20&expand[]=data.subscription`)).data;
    for (const session of sessions) {
      if (!session.subscription || typeof session.subscription !== 'object') continue;
      const billing = billingOf(session.subscription);
      // A customer who re-subscribed has an active one alongside the old one.
      if (!out[slug] || BILLING_RANK[billing.status] > BILLING_RANK[out[slug].status]) out[slug] = billing;
    }
  }
  return out;
}

module.exports = { getKey, setKey, status, testKey, createPaymentLink, billingBySlug };
