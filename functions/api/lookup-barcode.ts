import { normalizeBarcode, normalizeOpenFoodFactsProduct } from '../../src/lib/barcode';

type Env = {
  OPEN_FOOD_FACTS_USER_AGENT?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}

export async function handleLookupBarcode(request: Request, env: Env = {}, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Use GET for barcode lookup.' }, 405);

  const url = new URL(request.url);
  const code = normalizeBarcode(url.searchParams.get('code') ?? '');
  if (!code) return json({ error: 'Enter a valid barcode number.' }, 400);

  const upstream = `https://world.openfoodfacts.org/api/v3.6/product/${encodeURIComponent(code)}.json`;
  let response: Response;
  try {
    response = await fetcher(upstream, {
      headers: {
        accept: 'application/json',
        'user-agent': env.OPEN_FOOD_FACTS_USER_AGENT ?? 'KetoDeficitTracker/1.0 (https://keto-deficit-tracker.pages.dev)',
      },
    });
  } catch {
    return json({ error: 'Could not reach the barcode database. Check your connection and try again.' }, 502);
  }

  if (response.status === 404) return json({ error: 'No food was found for that barcode.' }, 404);
  if (response.status === 429 || response.status === 503) return json({ error: 'Barcode lookup is temporarily rate-limited. Try again shortly.' }, 502);
  if (!response.ok) return json({ error: 'Barcode lookup failed. Try again shortly.' }, 502);

  const body = await response.json() as unknown;
  const normalized = normalizeOpenFoodFactsProduct(body, code);
  if (!normalized) return json({ error: 'That barcode was found, but usable nutrition data was missing.' }, 422);

  return json({
    ...normalized,
    attribution: 'Open Food Facts',
    attributionUrl: 'https://world.openfoodfacts.org',
  });
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) => handleLookupBarcode(request, env);
