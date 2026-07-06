import { hasPositiveNutrition, normalizeOpenFoodFactsProduct, type BarcodeFood } from './barcode';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

export const MIN_FOOD_SEARCH_LENGTH = 2;
const MAX_RESULTS = 20;
const SEARCH_FIELDS = 'code,product_name,generic_name,abbreviated_product_name,brands,serving_size,quantity,nutriments';
const REQUEST_TIMEOUT_MS = 9000;

// A request signal that aborts a hung upstream so the UI can fall back or fail
// cleanly instead of showing "Searching…" forever. Undefined where unsupported.
function timeoutSignal(): AbortSignal | undefined {
  try {
    return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      : undefined;
  } catch {
    return undefined;
  }
}

// Honest copy: only blame the user's connection when the browser is actually
// offline; an upstream 5xx/timeout is the food database being busy, not them.
function unreachableMessage(): string {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return offline
    ? 'You appear to be offline — check your connection and try again.'
    : 'The food database is busy right now — please try again in a moment.';
}

// Coerce Search-a-licious's array `brands` into the string shape the shared
// Open Food Facts normalizer expects, so the brand still shows on results.
function coerceProduct(item: unknown): unknown {
  if (!isRecord(item) || !Array.isArray(item.brands)) return item;
  return { ...item, brands: item.brands.filter((b): b is string => typeof b === 'string').join(', ') };
}

function publicEnv(name: string): string {
  const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
  return meta.env?.[name]?.trim() ?? '';
}

// Detected via the injected Capacitor global rather than a static import so this
// module stays safe to import from the Cloudflare Pages function.
function isNativePlatform(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === 'function' ? cap.isNativePlatform() : false;
}

function searchEndpointFromBarcodeLookup(endpoint: string): string {
  if (endpoint.startsWith('/')) return '/api/search-foods';
  try {
    const url = new URL(endpoint);
    url.pathname = '/api/search-foods';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return endpoint.replace(/\/api\/lookup-barcode(?:\?.*)?$/, '/api/search-foods') || '/api/search-foods';
  }
}

function withQueryParam(endpoint: string, query: string): string {
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}q=${encodeURIComponent(query)}`;
}

// Primary direct source: Open Food Facts' Search-a-licious API. It is purpose-built
// for name search and far more reliable than the legacy cgi endpoint, which is
// frequently overloaded (5xx/timeout) and was the cause of spurious "check your
// connection" errors.
function searchaliciousUrl(query: string): string {
  const url = new URL('https://search.openfoodfacts.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('page_size', String(MAX_RESULTS));
  url.searchParams.set('fields', SEARCH_FIELDS);
  return url.toString();
}

// Legacy cgi search, kept only as a last-ditch fallback if Search-a-licious is down.
function legacyOpenFoodFactsUrl(query: string): string {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', query);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', String(MAX_RESULTS));
  url.searchParams.set('fields', SEARCH_FIELDS);
  return url.toString();
}

function addUniqueUrl(urls: string[], url: string): void {
  if (!urls.includes(url)) urls.push(url);
}

export function foodSearchUrls(query: string): string[] {
  const normalized = query.trim();
  if (normalized.length < MIN_FOOD_SEARCH_LENGTH) return [];

  const urls: string[] = [];
  const configuredSearch = publicEnv('VITE_FOOD_SEARCH_URL');
  if (configuredSearch) {
    addUniqueUrl(urls, withQueryParam(configuredSearch, normalized));
  } else {
    const barcodeEndpoint = publicEnv('VITE_BARCODE_LOOKUP_URL');
    if (barcodeEndpoint) {
      addUniqueUrl(urls, withQueryParam(searchEndpointFromBarcodeLookup(barcodeEndpoint), normalized));
    } else if (!isNativePlatform()) {
      addUniqueUrl(urls, withQueryParam('/api/search-foods', normalized));
    }
  }

  // Direct Open Food Facts remains the no-key fallback (and the primary path for
  // native builds that have no server function configured). Try the reliable
  // Search-a-licious API first, then the legacy cgi endpoint as a last resort.
  addUniqueUrl(urls, searchaliciousUrl(normalized));
  addUniqueUrl(urls, legacyOpenFoodFactsUrl(normalized));
  return urls;
}

function resultsFromBody(body: unknown): BarcodeFood[] {
  if (!isRecord(body)) return [];
  // Our own endpoint returns { results: [...] }; Search-a-licious returns
  // { hits: [...] }; the legacy cgi endpoint returns { products: [...] }.
  // Normalize all three to guarantee a consistent shape.
  const raw = Array.isArray(body.results) ? body.results
    : Array.isArray(body.hits) ? body.hits
    : Array.isArray(body.products) ? body.products
    : [];
  const foods: BarcodeFood[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const food = normalizeOpenFoodFactsProduct(coerceProduct(item));
    if (!food || !hasPositiveNutrition(food) || seen.has(food.barcode)) continue;
    seen.add(food.barcode);
    foods.push(food.attribution ? food : { ...food, attribution: 'Open Food Facts', attributionUrl: 'https://world.openfoodfacts.org' });
    if (foods.length >= MAX_RESULTS) break;
  }
  return foods;
}

export async function searchFoodsByName(query: string, fetcher: typeof fetch = fetch): Promise<BarcodeFood[]> {
  const urls = foodSearchUrls(query);
  if (urls.length === 0) return [];

  let lastError: Error | null = null;
  for (const url of urls) {
    let response: Response;
    try {
      response = await fetcher(url, { cache: 'no-store', headers: { accept: 'application/json' }, signal: timeoutSignal() });
    } catch {
      lastError = new Error(unreachableMessage());
      continue;
    }

    if (response.status === 429 || response.status === 503) {
      lastError = new Error('Food search is temporarily rate-limited. Try again shortly.');
      continue;
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      lastError = new Error(unreachableMessage());
      continue;
    }

    if (!response.ok) {
      lastError = new Error(isRecord(body) && typeof body.error === 'string' ? body.error : 'Food search failed.');
      continue;
    }

    return resultsFromBody(body);
  }

  if (lastError) throw lastError;
  return [];
}
