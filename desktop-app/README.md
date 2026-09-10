# BrightSite Studio (desktop)

A personal macOS app: paste a business's Facebook Page and/or Google Maps
link and it builds a full demo website, ready to send. Uses the same
deterministic, no-AI generator that powers brightsite.app
(`../demo-generator.js`, `../template-designs.js`, `../fresh-templates.js`,
`../hero-brand-compositor.js`) — this app is a thin shell around it, plus
project storage, media upload, a real link-reading import, and optional
natural-language editing via your local Claude Code sign-in.

## Run it

```bash
cd desktop-app
npm install
npm start        # opens the Electron window
# or
npm run server   # just the local server, open http://localhost:4173 in any browser
```

Every business is saved to `~/BrightSiteProjects/<slug>/data.json`.

## The one page

- **Paste a link, get a website**: paste a Facebook Page link and/or a
  Google Maps link, hit **Build website**, and it creates a new site
  pre-filled with whatever it found.
- The import reads the page the same way pasting a link into a Claude
  conversation would — through your local **Claude Code CLI** (your own
  subscription, no API key), which fetches the page and extracts
  name/category/location/phone/address/about/hours/photos itself, far
  better than a raw regex scraper. If Claude Code isn't installed or
  signed in, it falls back to a plain no-API HTTP fetch + Open Graph/
  JSON-LD parse instead (see `lib/scrape.js`) — works either way, the
  Claude path is just much more capable.
- Nothing found is ever silently invented: missing fields are flagged
  (the ✨ "AI" badge) so you know what to check before sending.
- Edit fields, upload logo/hero/gallery images (or "Use found" on a photo
  the import turned up), pick a template — the live preview re-renders
  instantly, fully deterministic, no AI calls for any of this.
- **Composite logo onto hero photo** — once a logo is uploaded, one button
  runs `HeroBrandCompositor` to place it into the hero scene.
- **Edit with AI** — a plain-English instruction box for copy tweaks
  ("make the about section warmer"), also via local Claude Code, scoped to
  just that site, told never to invent facts. Undo restores the exact
  prior values.
- **Export folder** writes a sendable static site to
  `~/BrightSiteProjects/<slug>/export/`.
- **Copy browser link** at the top copies `http://localhost:4173` so a
  colleague on the same network can open the same app in their own
  browser — same server, same data.

## Cross-device sync (optional, off by default)

Everything works purely on local files unless you opt in to Supabase
sync. Run `supabase/businesses_schema.sql` once in your Supabase project's
SQL editor (not run automatically — that's your call), then set
`SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars before `npm start`.

## Known gaps

- Facebook/Google scraping fallback (when Claude Code isn't available) is
  genuinely unreliable — Facebook actively blocks a lot of plain
  server-side requests. The Claude Code path is the real fix for this.
- This was built and tested in a sandboxed dev environment without a full
  interactive display; do a quick real end-to-end pass yourself the first
  time — a real link, real media, a real export — before sending anything
  to a client.
