// Emails wellnesswebsolutions@gmail.com whenever a lead is captured on the
// site. Leads are also logged to Supabase (see homepage-builder.js), but
// that table isn't checked automatically — the WhatsApp handoff was the only
// notification, and it's silent if the customer never presses send. This
// runs regardless of whether they do.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'RESEND_API_KEY not configured' });
    return;
  }

  const { business_name, details } = req.body || {};
  if (!business_name) {
    res.status(400).json({ error: 'business_name required' });
    return;
  }

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'WellnessWeb Leads <leads@wellnessweb.co.uk>',
        to: ['wellnesswebsolutions@gmail.com'],
        subject: `New lead: ${business_name}`,
        text: details || '(no further details)',
      }),
    });

    if (!emailRes.ok) {
      const body = await emailRes.text();
      throw new Error(`Resend ${emailRes.status}: ${body}`);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('notify-lead failed:', error);
    res.status(502).json({ error: 'Failed to send notification' });
  }
}
