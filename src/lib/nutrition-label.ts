import { normalizeBarcode, normalizeOpenFoodFactsProduct, type BarcodeFood } from './barcode';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

function publicEnv(name: string): string {
  const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
  return meta.env?.[name]?.trim() ?? '';
}

function parseEndpointFromBarcodeLookup(endpoint: string): string {
  if (endpoint.startsWith('/')) return '/api/parse-nutrition-label';
  try {
    const url = new URL(endpoint);
    url.pathname = '/api/parse-nutrition-label';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return endpoint.replace(/\/api\/lookup-barcode(?:\?.*)?$/, '/api/parse-nutrition-label') || '/api/parse-nutrition-label';
  }
}

export function nutritionLabelParseUrl(): string {
  const configuredEndpoint = publicEnv('VITE_NUTRITION_LABEL_PARSE_URL');
  if (configuredEndpoint) return configuredEndpoint;

  const barcodeLookupEndpoint = publicEnv('VITE_BARCODE_LOOKUP_URL');
  if (barcodeLookupEndpoint) return parseEndpointFromBarcodeLookup(barcodeLookupEndpoint);

  return '/api/parse-nutrition-label';
}

async function responseError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.error === 'string' && body.error.trim()) return body.error.trim();
  } catch {
    // Fall through to the generic message.
  }
  return 'Nutrition label import failed. Try another photo or enter the food manually.';
}

export async function parseNutritionLabelPhoto(file: File, barcode: string, fetcher: typeof fetch = fetch): Promise<BarcodeFood> {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) throw new Error('Enter or scan a valid barcode before importing a nutrition label.');

  const form = new FormData();
  form.append('image', file);
  form.append('barcode', normalized);

  let response: Response;
  try {
    response = await fetcher(nutritionLabelParseUrl(), { method: 'POST', body: form });
  } catch {
    throw new Error('Could not reach the nutrition label importer. Check your connection and try again.');
  }

  if (!response.ok) throw new Error(await responseError(response));

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('Nutrition label import returned unreadable nutrition data.');
  }

  const food = normalizeOpenFoodFactsProduct(body, normalized);
  if (!food) throw new Error('Nutrition label import returned incomplete nutrition data.');
  return food;
}
