import { normalizeOpenFoodFactsProduct, type BarcodeFood } from '../../src/lib/barcode';

type Env = {
  OPEN_FOOD_FACTS_USER_AGENT?: string;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 20;

// Fields kept small so Open Food Facts returns the nutrition we need without a
// multi-megabyte payload. Uses the v1 search endpoint, which returns
// product-shaped records with populated `nutriments` (the v3 product endpoint
// returns empty nutriments — see barcode-off-v2).
const SEARCH_FIELDS = 'code,product_name,generic_name,abbreviated_product_name,brands,serving_size,quantity,nutriments';

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      ...corsHeaders(),
    },
  });
}

function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function searchOpenFoodFacts(query: string, env: Env, fetcher: typeof fetch) {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', query);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', String(MAX_RESULTS));
  url.searchParams.set('fields', SEARCH_FIELDS);

  const response = await fetcher(url.toString(), {
    headers: {
      accept: 'application/json',
      'user-agent': env.OPEN_FOOD_FACTS_USER_AGENT ?? 'KetoDeficitTracker/1.0 (https://keto-deficit-tracker.pages.dev)',
    },
  });

  if (response.status === 429 || response.status === 503) return { status: 'limited' as const };
  if (!response.ok) return { status: 'failed' as const };

  const body = await response.json() as unknown;
  const products = isRecord(body) && Array.isArray(body.products) ? body.products : [];
  const results: BarcodeFood[] = [];
  const seen = new Set<string>();
  for (const product of products) {
    const food = normalizeOpenFoodFactsProduct(product);
    // Skip entries with no barcode/name or no usable calories — those add noise
    // and cannot be logged meaningfully.
    if (!food || !(food.calories > 0) || seen.has(food.barcode)) continue;
    seen.add(food.barcode);
    results.push({ ...food, attribution: 'Open Food Facts', attributionUrl: 'https://world.openfoodfacts.org' });
    if (results.length >= MAX_RESULTS) break;
  }
  return { status: 'ok' as const, results };
}

export async function handleSearchFoods(request: Request, env: Env = {}, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'GET') return json({ error: 'Use GET for food search.' }, 405);

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim();
  if (query.length < MIN_QUERY_LENGTH) return json({ results: [] });

  try {
    const result = await searchOpenFoodFacts(query, env, fetcher);
    if (result.status === 'limited') return json({ error: 'Food search is temporarily rate-limited. Try again shortly.' }, 502);
    if (result.status === 'failed') return json({ error: 'Could not reach the food database. Try again shortly.' }, 502);
    return json({ results: result.results });
  } catch {
    return json({ error: 'Could not reach the food database. Check your connection and try again.' }, 502);
  }
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) => handleSearchFoods(request, env);
export const onRequestOptions = () => noContent();
