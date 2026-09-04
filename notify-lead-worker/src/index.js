// Cloudflare Worker replacement for the old Vercel serverless function
// (api/notify-lead.js). Emails wellnesswebsolutions@gmail.com whenever a
// lead is captured on the site. Leads are also logged to Supabase (see
// homepage-builder.js), but that table isn't checked automatically — this
// runs regardless of whether the customer presses the WhatsApp handoff.

const ALLOWED_ORIGINS = new Set([
  'https://wellnessweb.co.uk',
  'https://www.wellnessweb.co.uk',
]);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://wellnessweb.co.uk';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });
    }

    if (!env.RESEND_API_KEY) {
      return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500, headers: cors });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { business_name, details } = body || {};
    if (!business_name) {
      return Response.json({ error: 'business_name required' }, { status: 400, headers: cors });
    }

    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'BrightSite Leads <leads@wellnessweb.co.uk>',
          to: ['wellnesswebsolutions@gmail.com'],
          subject: `New lead: ${business_name}`,
          text: details || '(no further details)',
        }),
      });

      if (!emailRes.ok) {
        const text = await emailRes.text();
        throw new Error(`Resend ${emailRes.status}: ${text}`);
      }

      return Response.json({ ok: true }, { headers: cors });
    } catch (error) {
      console.error('notify-lead failed:', error);
      return Response.json({ error: 'Failed to send notification' }, { status: 502, headers: cors });
    }
  },
};
