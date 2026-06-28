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

## Native mobile app

The app can also run as a Capacitor Android/iOS wrapper around the same React/Vite build.

```sh
npm run android:sync
npm run android:open
```

Android native project files live in `android/`. The app includes Capacitor Local Notifications for native reminder scheduling from Settings. iOS support uses the same Capacitor config, but generating/opening the iOS project requires macOS and Xcode:

```sh
npm run ios:add
npm run ios:open
```

Push notifications are not wired yet. They require Firebase Cloud Messaging for Android and APNs/app capabilities for iOS.

## Barcode scanning

The Scan screen supports packaged-food lookup by barcode. When the browser supports the native BarcodeDetector API, users can scan with the device camera. Every browser can still use manual barcode entry.

Barcode lookup uses a Cloudflare Pages Function at `/api/lookup-barcode`, which queries Open Food Facts first and can fall back to USDA FoodData Central when configured. Results are normalized for review before logging. Logged entries and saved foods are copied as snapshots, so future changes in the external database do not alter historical logs.

Important limitations:

- Open Food Facts data is crowd-sourced and can be incomplete or wrong.
- Some browsers do not expose camera barcode scanning; manual barcode entry is the fallback.
- Lookup requests are subject to upstream provider rate limits.
- The app does not upload or store camera frames; the camera preview is only used locally to detect a barcode.

### Environment variables

Optional server-side variable:

```text
OPEN_FOOD_FACTS_USER_AGENT
FOOD_DATA_CENTRAL_API_KEY
```

If supplied, use a descriptive value in the form `AppName/Version (contact or URL)`. Do not put it in a `VITE_` variable.
`FOOD_DATA_CENTRAL_API_KEY` enables USDA FoodData Central fallback lookup when Open Food Facts does not have a barcode match.

### Local Pages Function development

Build and run the site through Wrangler so `/api/lookup-barcode` is available:

```sh
npm run build
npx wrangler pages dev dist
```

Running only `npm run dev` serves the React client but does not provide the Cloudflare Pages Function.

### Cloudflare Pages deployment

No secret is required for Open Food Facts. Optionally add `OPEN_FOOD_FACTS_USER_AGENT` under Settings -> Variables and Secrets if you want to override the default app identifier. Add `FOOD_DATA_CENTRAL_API_KEY` to enable USDA FoodData Central fallback lookup.

## Data

User profile, targets, food logs, saved foods, recipes, plans, and other app state are stored locally in versioned browser storage. Backup import/export uses the same normalized app-state structure. Barcode metadata is optional and included only with saved-food/log snapshots.

Demo data is not loaded for normal installs. For local demos or screenshots, open the app with `?demo=reset` to replace local data with a sample dataset.
