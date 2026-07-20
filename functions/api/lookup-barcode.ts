import { normalizeBarcode, normalizeOpenFoodFactsProduct } from '../../src/lib/barcode';
import { implausibleMacroMassMessage } from '../../src/lib/nutrition-validation';

type Env = {
  OPEN_FOOD_FACTS_USER_AGENT?: string;
  FOOD_DATA_CENTRAL_API_KEY?: string;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const asText = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const asNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

function json(body: unknown, status = 200): Response {
  const cacheControl = status >= 200 && status < 300 ? 'public, max-age=3600' : 'no-store';
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      // Allow the native (Capacitor) app, whose WebView origin is
      // https://localhost, to call this public read-only endpoint cross-origin.
      'access-control-allow-origin': '*',
    },
  });
}

function nutrient(food: UnknownRecord, names: string[]): number {
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  for (const item of nutrients) {
    if (!isRecord(item)) continue;
    const name = asText(item.nutrientName)?.toLowerCase() ?? '';
    const number = asText(item.nutrientNumber);
    if (!names.some((candidate) => name === candidate || number === candidate)) continue;
    const value = asNumber(item.value) ?? asNumber(item.amount);
    if (value !== undefined) return value;
  }
  return 0;
}

function normalizeFoodDataCentralSearch(value: unknown, barcode: string) {
  if (!isRecord(value) || !Array.isArray(value.foods)) return null;
  const food = value.foods.find((candidate) => {
    if (!isRecord(candidate)) return false;
    return normalizeBarcode(asText(candidate.gtinUpc) ?? '') === barcode;
  }) ?? value.foods.find(isRecord);
  if (!isRecord(food)) return null;

  const name = asText(food.description);
  if (!name) return null;
  const servingSize = asNumber(food.servingSize);
  const rawServingUnit = asText(food.servingSizeUnit)?.toLowerCase();
  // FDC branded `foodNutrients` values are per 100 g/ml, while `servingSize`
  // is the labelled serving. When the serving is a known mass/volume, convert
  // nutrition to per-serving here so logging "1 serving" in the app matches
  // the label instead of silently logging 100 g. Otherwise present the food
  // explicitly as per-100g so the serving text and nutrition basis agree.
  const servingUnit = rawServingUnit === 'g' || rawServingUnit === 'grm' ? 'g'
    : rawServingUnit === 'ml' || rawServingUnit === 'mlt' ? 'ml'
    : undefined;
  const perServingScale = servingSize && servingUnit ? servingSize / 100 : null;
  const scale = perServingScale ?? 1;
  const scaled = (names: string[]) => Math.round(nutrient(food, names) * scale * 1e6) / 1e6;
  return {
    barcode,
    name,
    brand: asText(food.brandOwner) ?? asText(food.brandName),
    servingSize: perServingScale ? `${servingSize}${servingUnit}` : '100g',
    dataBasis: perServingScale ? 'serving' : '100g',
    calories: scaled(['energy', '208']),
    proteinG: scaled(['protein', '203']),
    fatG: scaled(['total lipid (fat)', '204']),
    totalCarbsG: scaled(['carbohydrate, by difference', '205']),
    fibreG: scaled(['fiber, total dietary', '291']),
    sugarAlcoholsG: scaled(['sugar alcohols', '1086']),
    sodiumMg: scaled(['sodium, na', '307']),
    potassiumMg: scaled(['potassium, k', '306']),
    magnesiumMg: scaled(['magnesium, mg', '304']),
    calciumMg: scaled(['calcium, ca', '301']) || undefined,
    ironMg: scaled(['iron, fe', '303']) || undefined,
    zincMg: scaled(['zinc, zn', '309']) || undefined,
    // FDC reports each nutrient in its own labelled unit, which already
    // matches these fields (g / mg / mcg) — no conversion needed.
    saturatedFatG: scaled(['fatty acids, total saturated', '606']) || undefined,
    pantothenicAcidMg: scaled(['pantothenic acid', '410']) || undefined,
    biotinMcg: scaled(['biotin', '416']) || undefined,
    cholineMg: scaled(['choline, total', '421']) || undefined,
    sourceUrl: asNumber(food.fdcId) ? `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}/nutrients` : undefined,
  };
}

async function lookupOpenFoodFacts(code: string, env: Env, fetcher: typeof fetch) {
  // v2 returns fully-populated `nutriments` by default; v3.x returns an empty
  // nutriments object, which silently yields 0-calorie results.
  const upstream = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;
  const response = await fetcher(upstream, {
    headers: {
      accept: 'application/json',
      'user-agent': env.OPEN_FOOD_FACTS_USER_AGENT ?? 'KetoDeficitTracker/1.0 (https://keto-deficit-tracker.pages.dev)',
    },
  });

  if (response.status === 404) return { status: 'missing' as const };
  if (response.status === 429 || response.status === 503) return { status: 'limited' as const };
  if (!response.ok) return { status: 'failed' as const };

  const body = await response.json() as unknown;
  const normalized = normalizeOpenFoodFactsProduct(body, code);
  if (!normalized || implausibleMacroMassMessage(normalized)) return { status: 'incomplete' as const };
  return {
    status: 'found' as const,
    food: {
      ...normalized,
      attribution: 'Open Food Facts',
      attributionUrl: 'https://world.openfoodfacts.org',
    },
  };
}

async function lookupFoodDataCentral(code: string, env: Env, fetcher: typeof fetch) {
  if (!env.FOOD_DATA_CENTRAL_API_KEY) return { status: 'unconfigured' as const };
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', env.FOOD_DATA_CENTRAL_API_KEY);
  url.searchParams.set('query', code);
  url.searchParams.set('dataType', 'Branded');
  url.searchParams.set('pageSize', '5');

  const response = await fetcher(url.toString(), { headers: { accept: 'application/json' } });
  if (response.status === 429 || response.status === 503) return { status: 'limited' as const };
  if (!response.ok) return { status: 'failed' as const };
  const normalized = normalizeFoodDataCentralSearch(await response.json(), code);
  if (!normalized || implausibleMacroMassMessage(normalized)) return { status: 'missing' as const };
  return {
    status: 'found' as const,
    food: {
      ...normalized,
      attribution: 'USDA FoodData Central',
      attributionUrl: 'https://fdc.nal.usda.gov',
    },
  };
}

export async function handleLookupBarcode(request: Request, env: Env = {}, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Use GET for barcode lookup.' }, 405);

  const url = new URL(request.url);
  const code = normalizeBarcode(url.searchParams.get('code') ?? '');
  if (!code) return json({ error: 'Enter a valid barcode number.' }, 400);

  try {
    const openFoodFacts = await lookupOpenFoodFacts(code, env, fetcher);
    if (openFoodFacts.status === 'found') return json(openFoodFacts.food);
    if (openFoodFacts.status === 'limited') return json({ error: 'Barcode lookup is temporarily rate-limited. Try again shortly.' }, 502);

    const foodDataCentral = await lookupFoodDataCentral(code, env, fetcher);
    if (foodDataCentral.status === 'found') return json(foodDataCentral.food);
    if (foodDataCentral.status === 'limited') return json({ error: 'Barcode lookup is temporarily rate-limited. Try again shortly.' }, 502);
  } catch {
    return json({ error: 'Could not reach the barcode database. Check your connection and try again.' }, 502);
  }

  return json({ error: 'No food was found for that barcode.' }, 404);
}

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) => handleLookupBarcode(request, env);
