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

The app supports two users, Troy and Khatra. Each device asks who is logging, stores that choice locally, keeps browser storage scoped per user/environment, and syncs that user's app-state bundle to Firebase Realtime Database under:

```text
ketoDeficitTracker/users/{troy|khatra}/appState
```

Local storage remains the offline cache and write-through source. If Firebase is unavailable, changes are queued in the browser and retried when the connection returns. Backup import/export uses the same normalized app-state structure. Barcode metadata is optional and included only with saved-food/log snapshots.

Demo data is not loaded for normal installs. For local demos or screenshots, open the app with `?demo=reset` to replace local data with a sample dataset.

### Multi-user sync configuration

Copy `.env.example` to `.env` for local development. Keep local development on sandbox:

```text
VITE_KETO_ENV=sandbox
```

The defaults point at the same Firebase Realtime Database projects used by Taskboard, but a separate `ketoDeficitTracker` root is used so data does not mix with Taskboard. If Firebase rules require anonymous auth, set the `VITE_FIREBASE_*` web-app values in Cloudflare/GitHub environment variables.

Production GitHub/Cloudflare setup:

- `PROD_DOTENV`: full production `.env` contents, including `VITE_KETO_ENV=production`.
- `FIREBASE_DB_SECRET_PROD` and `FIREBASE_DB_SECRET_SANDBOX`: used by the daily backup workflow.
- Optional repository variables `KETO_FIREBASE_DB_BASE_PROD` and `KETO_FIREBASE_DB_BASE_SANDBOX` if the DB URLs differ from Taskboard.

### Mobile update emails

Pushing to `master` can build the Android APK and distribute it through Firebase App Distribution. Firebase emails Troy/Khatra when the update is ready.

Required GitHub Actions secrets:

- `FIREBASE_SERVICE_ACCOUNT`
- `FIREBASE_APP_DISTRIBUTION_APP_ID`
- `FIREBASE_TESTERS`
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
