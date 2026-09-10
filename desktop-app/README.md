# BrightSite Studio (desktop)

A personal macOS app for building BrightSite demo websites fast from a
Facebook Page or Google Maps link. Uses the same deterministic, no-AI
generator that powers brightsite.app (`../demo-generator.js`,
`../template-designs.js`, `../fresh-templates.js`,
`../hero-brand-compositor.js`) — this app is a thin shell around it, plus
project storage, media upload, and a best-effort link importer.

## Run it

```bash
cd desktop-app
npm install
npm start        # opens the Electron window
# or
npm run server   # just the local server, open http://localhost:4173 in any browser
```

Projects are saved to `~/BrightSiteProjects/<slug>/`.

## Import ("paste a link")

The import box accepts a Facebook Page URL or a Google Maps/Business URL.

- **Google Maps links** just get parsed for the place name and kept as an
  embeddable map link — reliable, no scraping involved.
- **Facebook links** are fetched directly (no Graph API key) and parsed for
  whatever the page already publishes in its `<meta>`/Open Graph tags and
  schema.org JSON-LD. **This is unreliable in practice** — Facebook blocks
  a lot of plain server-side requests outright (observed: `400` on
  `www.facebook.com` for several pages during testing, a login wall on
  `mbasic.facebook.com` for others). When it fails you'll see a clear
  "Could not read that page" message rather than blank fields — fill the
  business fields in manually for those.
- Nothing is ever silently left blank without a marker: fields the import
  couldn't find are flagged so you know to check them before sending.

## Known limitations (MVP)

- Facebook scraping is best-effort only, per above — no workaround short of
  the official (locked-down) Graph API.
- Uploaded logo isn't yet composited onto the hero image automatically
  (`hero-brand-compositor.js` is loaded and available, just not wired into
  the auto-generation step yet).
- No natural-language AI editing yet, no Sales/pipeline tab, no Supabase
  sync — this is the Builder-only MVP. See the wider BrightSite Studio plan
  for the phased roadmap.
