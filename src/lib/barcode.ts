import type { FoodItem, FoodLogEntry, MealSlot, Micronutrients } from '../types';
import { safeNonNegative, safePositive } from './nutrition';
import { nanoid } from './nanoid';
import { MICRONUTRIENT_KEYS, pickMicronutrients, scaleMicronutrients, type MicronutrientKey } from './micronutrients';

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

function normalizeNutrientUnit(unit: string): 'g' | 'mg' | 'mcg' {
  const normalized = unit.toLowerCase().replace('μ', 'µ').replace('ug', 'mcg');
  if (normalized === 'g') return 'g';
  if (normalized === 'mcg' || normalized === 'µg' || normalized === 'Âµg'.toLowerCase()) return 'mcg';
  return 'mg';
}

function nutrientAsUnit(
  nutriments: UnknownRecord,
  key: string,
  basis: 'serving' | '100g',
  targetUnit: 'mg' | 'mcg' | 'g',
  defaultUnit: 'g' | 'mg' | 'mcg',
): number | undefined {
  const value = nutrient(nutriments, key, basis);
  if (value === 0) return undefined;
  const sourceUnit = normalizeNutrientUnit(asText(nutriments[`${key}_unit`]) ?? defaultUnit);
  const valueMg = sourceUnit === 'g' ? value * 1000 : sourceUnit === 'mcg' ? value / 1000 : value;
  const converted = targetUnit === 'g' ? valueMg / 1000 : targetUnit === 'mcg' ? valueMg * 1000 : valueMg;
  return converted > 0 ? converted : undefined;
}

const OFF_MICRONUTRIENTS: Array<{
  appKey: MicronutrientKey;
  offKeys: string[];
  targetUnit: 'mg' | 'mcg' | 'g';
  defaultUnit: 'g' | 'mg' | 'mcg';
}> = [
  { appKey: 'calciumMg', offKeys: ['calcium'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'phosphorusMg', offKeys: ['phosphorus'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'ironMg', offKeys: ['iron'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'zincMg', offKeys: ['zinc'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'copperMg', offKeys: ['copper'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'manganeseMg', offKeys: ['manganese'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'iodineMcg', offKeys: ['iodine'], targetUnit: 'mcg', defaultUnit: 'mcg' },
  { appKey: 'seleniumMcg', offKeys: ['selenium'], targetUnit: 'mcg', defaultUnit: 'mcg' },
  { appKey: 'vitaminAMcg', offKeys: ['vitamin-a'], targetUnit: 'mcg', defaultUnit: 'mcg' },
  { appKey: 'vitaminCMg', offKeys: ['vitamin-c'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'vitaminDMcg', offKeys: ['vitamin-d'], targetUnit: 'mcg', defaultUnit: 'mcg' },
  { appKey: 'vitaminEMg', offKeys: ['vitamin-e'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'vitaminKMcg', offKeys: ['vitamin-k'], targetUnit: 'mcg', defaultUnit: 'mcg' },
  { appKey: 'thiaminMg', offKeys: ['vitamin-b1'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'riboflavinMg', offKeys: ['vitamin-b2'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'niacinMg', offKeys: ['vitamin-pp', 'vitamin-b3'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'vitaminB6Mg', offKeys: ['vitamin-b6'], targetUnit: 'mg', defaultUnit: 'mg' },
  { appKey: 'folateMcg', offKeys: ['vitamin-b9', 'folates'], targetUnit: 'mcg', defaultUnit: 'mcg' },
  { appKey: 'vitaminB12Mcg', offKeys: ['vitamin-b12'], targetUnit: 'mcg', defaultUnit: 'mcg' },
  { appKey: 'omega3G', offKeys: ['omega-3-fat'], targetUnit: 'g', defaultUnit: 'g' },
  { appKey: 'omega6G', offKeys: ['omega-6-fat'], targetUnit: 'g', defaultUnit: 'g' },
];

function nutrimentMicros(nutriments: UnknownRecord, basis: 'serving' | '100g'): Micronutrients {
  const result: Micronutrients = {};
  for (const field of OFF_MICRONUTRIENTS) {
    for (const offKey of field.offKeys) {
      const value = nutrientAsUnit(nutriments, offKey, basis, field.targetUnit, field.defaultUnit);
      if (value !== undefined) {
        result[field.appKey] = value;
        break;
      }
    }
  }
  return result;
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
      ...MICRONUTRIENT_KEYS.reduce((result, key) => {
        const amount = asNumber(product[key]);
        if (amount !== undefined) result[key] = amount;
        return result;
      }, {} as Micronutrients),
      attribution: asText(product.attribution),
      attributionUrl: asText(product.attributionUrl),
      sourceUrl: asText(product.sourceUrl),
    };
  }

  const coreNutritionKeys = ['energy-kcal', 'proteins', 'fat', 'carbohydrates'];
  const hasServingNutrition = coreNutritionKeys.some((key) => asNumber(nutriments[`${key}_serving`]) !== undefined);
  const has100gNutrition = coreNutritionKeys.some((key) => asNumber(nutriments[`${key}_100g`]) !== undefined);
  const basis: 'serving' | '100g' = hasServingNutrition || !has100gNutrition ? 'serving' : '100g';

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
    ...nutrimentMicros(nutriments, basis),
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
// v2 returns fully-populated `nutriments`; v3.x returns an empty nutriments
// object, which silently produces 0-calorie results.
const OPEN_FOOD_FACTS_BASE = 'https://world.openfoodfacts.org/api/v2/product';

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
    ...scaleMicronutrients(food, amount),
    loggedAt: new Date().toISOString(),
  };
}

// A logged barcode entry needs nutrition repair if it was scanned but stored no
// calories (e.g. logged while the Open Food Facts lookup was returning empty
// nutriments). See barcode-off-v2.
export function entryNeedsNutritionRepair(entry: Pick<FoodLogEntry, 'barcode' | 'calories'>): boolean {
  return Boolean(entry.barcode) && !(entry.calories > 0);
}

// Recompute a log entry's macros from a freshly-fetched barcode food, preserving
// the entry's identity, date, meal, and serving multiplier.
export function applyBarcodeNutritionToEntry(entry: FoodLogEntry, food: BarcodeFood): FoodLogEntry {
  const amount = safePositive(entry.servingMultiplier);
  const scaledMicros = pickMicronutrients(entry);
  for (const key of MICRONUTRIENT_KEYS) {
    if (food[key] !== undefined) scaledMicros[key] = food[key]! * amount;
  }
  return {
    ...entry,
    calories: food.calories * amount,
    proteinG: food.proteinG * amount,
    fatG: food.fatG * amount,
    totalCarbsG: food.totalCarbsG * amount,
    fibreG: food.fibreG * amount,
    sugarAlcoholsG: food.sugarAlcoholsG * amount,
    sodiumMg: food.sodiumMg * amount,
    potassiumMg: food.potassiumMg * amount,
    magnesiumMg: food.magnesiumMg * amount,
    ...scaledMicros,
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
    ...pickMicronutrients(food),
    createdAt: new Date().toISOString(),
    isFavourite: false,
  };
}
