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

## Photo Food Estimate

The Photo Food Estimate screen accepts a camera photo or uploaded image, sends it to a server-side Cloudflare Pages Function, and returns an editable nutrition estimate. The user must review and explicitly confirm the estimate before it becomes a normal historical food-log snapshot.

Important limitations:

- Photo estimates are approximate. Hidden oils, sauces, ingredients, and portion sizes can materially change nutrition.
- The original image is held only in temporary browser state for preview and upload; it is not stored in localStorage.
- The image is sent to the configured OpenAI API account for analysis.
- The API key is read only by the Pages Function and is never included in the Vite client bundle.

### Environment variables

Required server-side variable:

```text
OPENAI_API_KEY
```

Optional server-side model override:

```text
OPENAI_FOOD_VISION_MODEL
```

If no model override is supplied, the function uses `gpt-4.1-mini`. The configured model must support image input and structured JSON output.

Do not place either variable in a `VITE_` variable or commit it to the repository. Vite-prefixed variables are exposed to browser code.

### Local Pages Function development

Create an uncommitted `.dev.vars` file:

```text
OPENAI_API_KEY=your_server_key
OPENAI_FOOD_VISION_MODEL=gpt-4.1-mini
```

Then build and run the site through Wrangler so `/api/analyze-food-photo` is available:

```sh
npm run build
npx wrangler pages dev dist
```

Running only `npm run dev` serves the React client but does not provide the Cloudflare Pages Function.

### Cloudflare Pages deployment

In the Cloudflare Pages project, add `OPENAI_API_KEY` as an encrypted secret under Settings → Variables and Secrets. Optionally add `OPENAI_FOOD_VISION_MODEL` as a server-side variable. Redeploy after changing either value.

The endpoint rejects missing, unsupported, or oversized images; uses an analysis timeout; validates all returned fields; rejects negative/non-finite nutrition; and clamps net carbohydrates to zero.

## Data

User profile, targets, food logs, saved foods, recipes, plans, and other app state are stored locally in versioned browser storage. Backup import/export uses the same normalized app-state structure. Images are not part of backups.
