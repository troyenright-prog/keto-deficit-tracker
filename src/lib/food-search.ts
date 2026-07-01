import { normalizeOpenFoodFactsProduct, type BarcodeFood } from './barcode';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

export const MIN_FOOD_SEARCH_LENGTH = 2;
const MAX_RESULTS = 20;
const SEARCH_FIELDS = 'code,product_name,generic_name,abbreviated_product_name,brands,serving_size,quantity,nutriments';

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

function directOpenFoodFactsUrl(query: string): string {
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
  // native builds that have no server function configured).
  addUniqueUrl(urls, directOpenFoodFactsUrl(normalized));
  return urls;
}

function resultsFromBody(body: unknown): BarcodeFood[] {
  if (!isRecord(body)) return [];
  // Our own endpoint returns { results: [...] }; Open Food Facts returns
  // { products: [...] }. Normalize both to guarantee a consistent shape.
  const raw = Array.isArray(body.results) ? body.results : Array.isArray(body.products) ? body.products : [];
  const foods: BarcodeFood[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const food = normalizeOpenFoodFactsProduct(item);
    if (!food || !(food.calories > 0) || seen.has(food.barcode)) continue;
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
      response = await fetcher(url, { cache: 'no-store', headers: { accept: 'application/json' } });
    } catch {
      lastError = new Error('Could not reach the food database. Check your connection and try again.');
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
      lastError = new Error('Could not reach the food database. Check your connection and try again.');
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
