# BrightSite Studio (desktop)

A personal macOS app for building BrightSite demo websites fast from a
Facebook Page or Google Maps link, and tracking outreach to send them.
Uses the same deterministic, no-AI generator that powers brightsite.app
(`../demo-generator.js`, `../template-designs.js`, `../fresh-templates.js`,
`../hero-brand-compositor.js`) — this app is a thin shell around it, plus
project storage, media upload, a best-effort link importer, a sales
pipeline, and optional natural-language editing via your local Claude
Code sign-in.

## Run it

```bash
cd desktop-app
npm install
npm start        # opens the Electron window
# or
npm run server   # just the local server, open http://localhost:4173 in any browser
```

Every business is one record, saved to `~/BrightSiteProjects/<slug>/data.json`
— **Builder** and **Sales** are two views over the same records, nothing is
duplicated between them.

## Builder tab

- Paste a Facebook Page or Google Maps link into the import box, or add a
  site manually.
- Edit business fields, upload logo/hero/gallery images (or "Use found" on
  a photo the import turned up), pick a template, and the live preview
  re-renders instantly — fully deterministic, no AI calls for any of this.
- **Composite logo onto hero photo** — once a logo is uploaded, one button
  runs the existing `HeroBrandCompositor` to place it into the hero scene,
  same as the marketing site's compositor.
- **Edit with AI** — type a plain-English instruction ("make the about
  section warmer") and it's sent to your local **Claude Code CLI**
  (`claude -p`), never a hosted API key. One focused call per edit, scoped
  to just that site's fields, explicitly told never to invent facts
  (prices, reviews, hours, addresses). If `claude` isn't installed or
  signed in, you get a clear message and everything else keeps working.
  Each edit is logged with an "Undo" button.
- **Export folder** writes a sendable static site to
  `~/BrightSiteProjects/<slug>/export/` and moves the business to "Ready
  to send" in Sales automatically.

## Sales tab

- Every business as a thin row: mini preview, name/category, a real-vs-AI
  **information completeness meter** (green = verified, blue = AI-filled/
  inferred), a stage dropdown, and one obvious next-action button.
- Pipeline: Potential → Information needed → Ready to build → Building →
  Ready to send → Demo sent → Waiting for reply → Interested → Complete →
  Archived.
- "Build demo" / next-action buttons move a business into Builder without
  creating a second record.
- Add a lead by name directly from this tab if you don't have a link yet.

## Import ("paste a link") — what actually works

- **Google Maps links**: parsed for the place name and kept as an
  embeddable map link. Reliable, no scraping involved.
- **Facebook links**: fetched directly (no Graph API key), parsed for
  whatever the page publishes in its Open Graph tags / schema.org JSON-LD.
  **Tested against real pages and it's genuinely unreliable** — Facebook
  returned `400 Bad Request` for `www.facebook.com` and a login wall for
  `mbasic.facebook.com` on the pages tried during development. There's no
  workaround short of the official (locked-down) Graph API. When it fails
  you get a clear "Could not read that page" message, not blank fields —
  fill those in by hand.
- Nothing found by import is ever silently left blank: missing fields are
  flagged (the info meter's blue "AI" portion) so you know what to check
  before sending.

## Notifications

A slim strip at the top shows one message at a time (import result, stage
change, AI edit applied/failed, export ready) and clears itself after a
few seconds.

## Known gaps (not built)

- **Discovery mode** ("find businesses with no website in Beverley") —
  needs its own Google Places category-search + no-website filter + de-dupe
  logic against existing records; deliberately deferred as its own phase.
- **No Supabase sync** — everything is local JSON files in
  `~/BrightSiteProjects/`, which keeps this simple and credential-free, but
  means there's currently no cross-device sync (unlike the old tracker).
  If you want that back, the migration plan from the original design
  conversation is the place to pick it up.
- **Undo** on an AI edit clears the touched fields back to blank rather
  than restoring the exact previous value (no full field history is kept)
  — re-import or retype after an undo you didn't want.
