import type { FoodItem, FoodLogEntry, MealSlot, Micronutrients } from '../types';
import { safeNonNegative, safePositive } from './nutrition';
import { nanoid } from './nanoid';

export interface BarcodeFood extends Micronutrients {
  barcode: string;
  name: string;
  brand?: string;
  attribution?: string;
  attributionUrl?: string;
  servingSize: string;
  dataBasis: 'serving' | '100g';
  calories: number;
  proteinG: number;
  fatG: number;
  totalCarbsG: number;
  fibreG: number;
  sugarAlcoholsG: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
  sourceUrl?: string;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const asText = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const asNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 32);
}

function nutrient(nutriments: UnknownRecord, key: string, basis: 'serving' | '100g'): number {
  return safeNonNegative(nutriments[`${key}_${basis}`]);
}

function firstNutrient(nutriments: UnknownRecord, keys: string[], basis: 'serving' | '100g'): number {
  for (const key of keys) {
    const value = nutrient(nutriments, key, basis);
    if (value > 0) return value;
  }
  return 0;
}

function toMilligrams(nutriments: UnknownRecord, key: string, basis: 'serving' | '100g', defaultUnit: 'g' | 'mg'): number {
  const value = nutrient(nutriments, key, basis);
  if (value === 0) return 0;
  const unit = asText(nutriments[`${key}_unit`])?.toLowerCase() ?? defaultUnit;
  if (unit === 'g') return value * 1000;
  if (unit === 'mcg' || unit === 'µg') return value / 1000;
  return value;
}

function optionalMicro(nutriments: UnknownRecord, key: string, basis: 'serving' | '100g', defaultUnit: 'g' | 'mg'): number | undefined {
  const value = toMilligrams(nutriments, key, basis, defaultUnit);
  return value > 0 ? value : undefined;
}

export function normalizeOpenFoodFactsProduct(value: unknown, barcodeFallback = ''): BarcodeFood | null {
  if (!isRecord(value)) return null;
  const product = isRecord(value.product) ? value.product : value;
  if (!isRecord(product)) return null;
  const nutriments = isRecord(product.nutriments) ? product.nutriments : product;
  const barcode = normalizeBarcode(asText(product.code) ?? asText(value.code) ?? asText(product.barcode) ?? barcodeFallback);
  const name = asText(product.product_name) ?? asText(product.generic_name) ?? asText(product.abbreviated_product_name) ?? asText(product.name);
  if (!barcode || !name) return null;

  const servingSize = asText(product.serving_size) ?? asText(product.servingSize) ?? asText(product.quantity) ?? '100g';
  if (asNumber(product.calories) !== undefined) {
    return {
      barcode,
      name,
      brand: asText(product.brands) ?? asText(product.brand),
      servingSize,
      dataBasis: product.dataBasis === '100g' ? '100g' : 'serving',
      calories: safeNonNegative(product.calories),
      proteinG: safeNonNegative(product.proteinG),
      fatG: safeNonNegative(product.fatG),
      totalCarbsG: safeNonNegative(product.totalCarbsG),
      fibreG: safeNonNegative(product.fibreG),
      sugarAlcoholsG: safeNonNegative(product.sugarAlcoholsG),
      sodiumMg: safeNonNegative(product.sodiumMg),
      potassiumMg: safeNonNegative(product.potassiumMg),
      magnesiumMg: safeNonNegative(product.magnesiumMg),
      calciumMg: asNumber(product.calciumMg),
      ironMg: asNumber(product.ironMg),
      zincMg: asNumber(product.zincMg),
      vitaminDMcg: asNumber(product.vitaminDMcg),
      vitaminB12Mcg: asNumber(product.vitaminB12Mcg),
      omega3G: asNumber(product.omega3G),
      omega6G: asNumber(product.omega6G),
      attribution: asText(product.attribution),
      attributionUrl: asText(product.attributionUrl),
      sourceUrl: asText(product.sourceUrl),
    };
  }

  const hasServingNutrition = ['energy-kcal', 'proteins', 'fat', 'carbohydrates'].some((key) => asNumber(nutriments[`${key}_serving`]) !== undefined);
  const basis: 'serving' | '100g' = hasServingNutrition ? 'serving' : '100g';

  return {
    barcode,
    name,
    brand: asText(product.brands),
    servingSize: basis === 'serving' ? servingSize : '100g',
    dataBasis: basis,
    calories: firstNutrient(nutriments, ['energy-kcal', 'energy-kcal_value'], basis),
    proteinG: nutrient(nutriments, 'proteins', basis),
    fatG: nutrient(nutriments, 'fat', basis),
    totalCarbsG: nutrient(nutriments, 'carbohydrates', basis),
    fibreG: firstNutrient(nutriments, ['fiber', 'fibre'], basis),
    sugarAlcoholsG: firstNutrient(nutriments, ['polyols', 'sugar-alcohol', 'sugar-alcohols'], basis),
    sodiumMg: toMilligrams(nutriments, 'sodium', basis, 'g'),
    potassiumMg: toMilligrams(nutriments, 'potassium', basis, 'mg'),
    magnesiumMg: toMilligrams(nutriments, 'magnesium', basis, 'mg'),
    calciumMg: optionalMicro(nutriments, 'calcium', basis, 'mg'),
    ironMg: optionalMicro(nutriments, 'iron', basis, 'mg'),
    zincMg: optionalMicro(nutriments, 'zinc', basis, 'mg'),
    vitaminDMcg: asNumber(nutriments[`vitamin-d_${basis}`]),
    vitaminB12Mcg: asNumber(nutriments[`vitamin-b12_${basis}`]),
    omega3G: asNumber(nutriments[`omega-3-fat_${basis}`]),
    omega6G: asNumber(nutriments[`omega-6-fat_${basis}`]),
    attribution: asText(product.attribution),
    attributionUrl: asText(product.attributionUrl),
    sourceUrl: asText(product.url),
  };
}

// Detected via the injected Capacitor global rather than a static import, so
// this module stays safe to import from the Cloudflare Pages function.
function isNativePlatform(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === 'function' ? cap.isNativePlatform() : false;
}

// Prefer the app lookup endpoint when available because it can combine multiple
// food sources. Direct Open Food Facts remains the no-key fallback.
const OPEN_FOOD_FACTS_BASE = 'https://world.openfoodfacts.org/api/v3.6/product';

function publicEnv(name: string): string {
  const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
  return meta.env?.[name]?.trim() ?? '';
}

function withCodeParam(endpoint: string, code: string): string {
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}code=${encodeURIComponent(code)}`;
}

function addUniqueUrl(urls: string[], url: string): void {
  if (!urls.includes(url)) urls.push(url);
}

export function barcodeLookupUrls(code: string): string[] {
  const normalized = normalizeBarcode(code);
  if (!normalized) return [];

  const urls: string[] = [];
  const configuredEndpoint = publicEnv('VITE_BARCODE_LOOKUP_URL');
  if (configuredEndpoint) {
    addUniqueUrl(urls, withCodeParam(configuredEndpoint, normalized));
  } else if (!isNativePlatform()) {
    addUniqueUrl(urls, `/api/lookup-barcode?code=${encodeURIComponent(normalized)}`);
  }

  addUniqueUrl(urls, `${OPEN_FOOD_FACTS_BASE}/${encodeURIComponent(normalized)}.json`);
  return urls;
}

export function barcodeLookupUrl(code: string): string {
  return barcodeLookupUrls(code)[0] ?? `${OPEN_FOOD_FACTS_BASE}/${encodeURIComponent(normalizeBarcode(code))}.json`;
}

export async function lookupBarcodeFood(barcode: string, fetcher: typeof fetch = fetch): Promise<BarcodeFood> {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) throw new Error('Enter a valid barcode number.');

  let lastError = 'No food was found for that barcode.';
  for (const url of barcodeLookupUrls(normalized)) {
    let response: Response;
    try {
      // `no-store` avoids serving a stale cached response; `accept` is a
      // CORS-safelisted header so it does not trigger a preflight.
      response = await fetcher(url, { cache: 'no-store', headers: { accept: 'application/json' } });
    } catch {
      lastError = 'Could not reach the barcode database. Check your connection and try again.';
      continue;
    }

    if (response.status === 404) {
      lastError = 'No food was found for that barcode.';
      continue;
    }
    if (response.status === 429 || response.status === 503) {
      lastError = 'Barcode lookup is temporarily rate-limited. Try again shortly.';
      continue;
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      lastError = 'Could not reach the barcode database. Check your connection and try again.';
      continue;
    }
    if (!response.ok) {
      lastError = isRecord(body) && typeof body.error === 'string' ? body.error : 'Barcode lookup failed.';
      continue;
    }

    const food = normalizeOpenFoodFactsProduct(body, normalized);
    if (food) return food;
    lastError = 'Barcode lookup returned incomplete nutrition data.';
  }

  throw new Error(lastError);
}

export function barcodeFoodToLogEntry(food: BarcodeFood, date: string, multiplier = 1, meal?: MealSlot): FoodLogEntry {
  const amount = safePositive(multiplier);
  return {
    id: nanoid(),
    date,
    source: 'barcode',
    meal,
    barcode: food.barcode,
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    servingSize: food.servingSize,
    servingMultiplier: amount,
    calories: food.calories * amount,
    proteinG: food.proteinG * amount,
    fatG: food.fatG * amount,
    totalCarbsG: food.totalCarbsG * amount,
    fibreG: food.fibreG * amount,
    sugarAlcoholsG: food.sugarAlcoholsG * amount,
    sodiumMg: food.sodiumMg * amount,
    potassiumMg: food.potassiumMg * amount,
    magnesiumMg: food.magnesiumMg * amount,
    calciumMg: food.calciumMg === undefined ? undefined : food.calciumMg * amount,
    ironMg: food.ironMg === undefined ? undefined : food.ironMg * amount,
    zincMg: food.zincMg === undefined ? undefined : food.zincMg * amount,
    vitaminDMcg: food.vitaminDMcg === undefined ? undefined : food.vitaminDMcg * amount,
    vitaminB12Mcg: food.vitaminB12Mcg === undefined ? undefined : food.vitaminB12Mcg * amount,
    omega3G: food.omega3G === undefined ? undefined : food.omega3G * amount,
    omega6G: food.omega6G === undefined ? undefined : food.omega6G * amount,
    loggedAt: new Date().toISOString(),
  };
}

export function barcodeFoodToSavedFood(food: BarcodeFood): FoodItem {
  return {
    id: nanoid(),
    barcode: food.barcode,
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    servingSize: food.servingSize,
    calories: food.calories,
    proteinG: food.proteinG,
    fatG: food.fatG,
    totalCarbsG: food.totalCarbsG,
    fibreG: food.fibreG,
    sugarAlcoholsG: food.sugarAlcoholsG,
    sodiumMg: food.sodiumMg,
    potassiumMg: food.potassiumMg,
    magnesiumMg: food.magnesiumMg,
    calciumMg: food.calciumMg,
    ironMg: food.ironMg,
    zincMg: food.zincMg,
    vitaminDMcg: food.vitaminDMcg,
    vitaminB12Mcg: food.vitaminB12Mcg,
    omega3G: food.omega3G,
    omega6G: food.omega6G,
    createdAt: new Date().toISOString(),
    isFavourite: false,
  };
}
