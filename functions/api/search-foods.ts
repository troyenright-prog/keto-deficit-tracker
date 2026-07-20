import { hasPositiveNutrition, normalizeOpenFoodFactsProduct, type BarcodeFood } from '../../src/lib/barcode';
import { implausibleMacroMassMessage } from '../../src/lib/nutrition-validation';

type Env = {
  OPEN_FOOD_FACTS_USER_AGENT?: string;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 20;
const UPSTREAM_TIMEOUT_MS = 9000;

// Fields kept small so the upstream returns the nutrition we need without a
// multi-megabyte payload. Records carry populated `nutriments` (the v3 product
// endpoint returns empty nutriments — see barcode-off-v2).
const SEARCH_FIELDS = 'code,product_name,generic_name,abbreviated_product_name,brands,serving_size,quantity,nutriments';

function timeoutSignal(): AbortSignal | undefined {
  try {
    return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      : undefined;
  } catch {
    return undefined;
  }
}

// Coerce Search-a-licious's array `brands` into the string shape the shared
// Open Food Facts normalizer expects.
function coerceProduct(item: unknown): unknown {
  if (!isRecord(item) || !Array.isArray(item.brands)) return item;
  return { ...item, brands: item.brands.filter((b): b is string => typeof b === 'string').join(', ') };
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function json(body: unknown, status = 200): Response {
  const cacheControl = status >= 200 && status < 300 ? 'public, max-age=300' : 'no-store';
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      ...corsHeaders(),
    },
  });
}

function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function searchOpenFoodFacts(query: string, env: Env, fetcher: typeof fetch) {
  // Search-a-licious is Open Food Facts' purpose-built search API and is far more
  // reliable than the legacy cgi/search.pl endpoint, which frequently returns 5xx
  // under load and produced spurious "check your connection" errors.
  const url = new URL('https://search.openfoodfacts.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('page_size', String(MAX_RESULTS));
  url.searchParams.set('fields', SEARCH_FIELDS);

  const response = await fetcher(url.toString(), {
    headers: {
      accept: 'application/json',
      'user-agent': env.OPEN_FOOD_FACTS_USER_AGENT ?? 'KetoDeficitTracker/1.0 (https://keto-deficit-tracker.pages.dev)',
    },
    signal: timeoutSignal(),
  });

  // Treat any server-side failure (429/503 and other 5xx) as a temporary,
  // retryable condition rather than a hard error.
  if (response.status === 429 || response.status === 503 || response.status >= 500) return { status: 'limited' as const };
  if (!response.ok) return { status: 'failed' as const };

  const body = await response.json() as unknown;
  // Search-a-licious returns { hits: [...] }; the legacy endpoint returned
  // { products: [...] }. Accept both so this stays resilient.
  const products = isRecord(body) && Array.isArray(body.hits) ? body.hits
    : isRecord(body) && Array.isArray(body.products) ? body.products
    : [];
  const results: BarcodeFood[] = [];
  const seen = new Set<string>();
  for (const product of products) {
    const food = normalizeOpenFoodFactsProduct(coerceProduct(product));
    // Skip entries with no barcode/name or no usable nutrition (macros or
    // micros/electrolytes) — those add noise and cannot be logged meaningfully.
    // Zero-calorie supplements/electrolytes are still real, loggable foods.
    if (!food || !hasPositiveNutrition(food) || implausibleMacroMassMessage(food) || seen.has(food.barcode)) continue;
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
