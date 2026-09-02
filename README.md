# wellness-web

Aesthetic Intelligence — brand websites that fill your diary

Live: https://wellnessweb.vercel.app

Static site — plain HTML/CSS, no build step.

## Deploying

Pushes to `main` auto-deploy to Vercel:
https://wellnessweb.vercel.app

Manual deploy: `vercel deploy --prod --yes`

## Testing

```bash
npm install
npx playwright install chromium
npm test
```

The smoke test checks the full form flow, document scrolling, carousel timing,
centre-card motion and colour-dot matching on desktop and an iPhone 13 viewport.
