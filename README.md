# Keto Deficit Tracker

A React, TypeScript, and Vite progressive web app for keto nutrition, meal planning, weight tracking, and local-first food logging.

## Development

```sh
npm install
npm run dev
```

Release validation:

```sh
npm run build
npm run lint
npm test
```

## Barcode scanning

The Scan screen supports packaged-food lookup by barcode. When the browser supports the native BarcodeDetector API, users can scan with the device camera. Every browser can still use manual barcode entry.

Barcode lookup uses a Cloudflare Pages Function at `/api/lookup-barcode`, which queries Open Food Facts and returns normalized nutrition for review before logging. Logged entries and saved foods are copied as snapshots, so future changes in the external database do not alter historical logs.

Important limitations:

- Open Food Facts data is crowd-sourced and can be incomplete or wrong.
- Some browsers do not expose camera barcode scanning; manual barcode entry is the fallback.
- Lookup requests are subject to Open Food Facts rate limits.
- The app does not upload or store camera frames; the camera preview is only used locally to detect a barcode.

### Environment variables

Optional server-side variable:

```text
OPEN_FOOD_FACTS_USER_AGENT
```

If supplied, use a descriptive value in the form `AppName/Version (contact or URL)`. Do not put it in a `VITE_` variable.

### Local Pages Function development

Build and run the site through Wrangler so `/api/lookup-barcode` is available:

```sh
npm run build
npx wrangler pages dev dist
```

Running only `npm run dev` serves the React client but does not provide the Cloudflare Pages Function.

### Cloudflare Pages deployment

No secret is required. Optionally add `OPEN_FOOD_FACTS_USER_AGENT` under Settings → Variables and Secrets if you want to override the default app identifier.

## Data

User profile, targets, food logs, saved foods, recipes, plans, and other app state are stored locally in versioned browser storage. Backup import/export uses the same normalized app-state structure. Barcode metadata is optional and included only with saved-food/log snapshots.
