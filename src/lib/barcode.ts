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

// Strip binary floating-point noise from unit conversions (e.g. 0.00015 g ->
// 150.00000000000003 mcg) without losing any real nutrition precision.
function roundFloat(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

// Open Food Facts normalizes every mass nutrient's `_100g` / `_serving` field
// to GRAMS, regardless of the unit shown on the label. The `<key>_unit` field
// describes `<key>_value` (the as-entered label figure) — applying it to
// `_100g` / `_serving` misreads e.g. potassium_100g: 0.35 (grams) as 0.35 mg,
// a 1000x underestimate. Verified against live v2 payloads on 2026-07-05:
// Nutella 3017620422003 (sodium_100g 0.0428 g), Alpro 5411188110835
// (calcium_100g 0.12 g = 120 mg, vitamin-d_100g 7.5e-7 g = 0.75 mcg),
// Cheerios 016000275287 (sodium_serving 0.19 g per 39 g serving).
function gramsNutrientAs(
  nutriments: UnknownRecord,
  key: string,
  basis: 'serving' | '100g',
  targetUnit: 'mg' | 'mcg' | 'g',
): number | undefined {
  const grams = nutrient(nutriments, key, basis);
  if (grams === 0) return undefined;
  const converted = targetUnit === 'g' ? grams : targetUnit === 'mg' ? grams * 1000 : grams * 1_000_000;
  return converted > 0 ? roundFloat(converted) : undefined;
}

const OFF_MICRONUTRIENTS: Array<{
  appKey: MicronutrientKey;
  offKeys: string[];
  targetUnit: 'mg' | 'mcg' | 'g';
}> = [
  { appKey: 'calciumMg', offKeys: ['calcium'], targetUnit: 'mg' },
  { appKey: 'phosphorusMg', offKeys: ['phosphorus'], targetUnit: 'mg' },
  { appKey: 'ironMg', offKeys: ['iron'], targetUnit: 'mg' },
  { appKey: 'zincMg', offKeys: ['zinc'], targetUnit: 'mg' },
  { appKey: 'copperMg', offKeys: ['copper'], targetUnit: 'mg' },
  { appKey: 'manganeseMg', offKeys: ['manganese'], targetUnit: 'mg' },
  { appKey: 'iodineMcg', offKeys: ['iodine'], targetUnit: 'mcg' },
  { appKey: 'seleniumMcg', offKeys: ['selenium'], targetUnit: 'mcg' },
  { appKey: 'vitaminAMcg', offKeys: ['vitamin-a'], targetUnit: 'mcg' },
  { appKey: 'vitaminCMg', offKeys: ['vitamin-c'], targetUnit: 'mg' },
  { appKey: 'vitaminDMcg', offKeys: ['vitamin-d'], targetUnit: 'mcg' },
  { appKey: 'vitaminEMg', offKeys: ['vitamin-e'], targetUnit: 'mg' },
  { appKey: 'vitaminKMcg', offKeys: ['vitamin-k'], targetUnit: 'mcg' },
  { appKey: 'thiaminMg', offKeys: ['vitamin-b1'], targetUnit: 'mg' },
  { appKey: 'riboflavinMg', offKeys: ['vitamin-b2'], targetUnit: 'mg' },
  { appKey: 'niacinMg', offKeys: ['vitamin-pp', 'vitamin-b3'], targetUnit: 'mg' },
  { appKey: 'vitaminB6Mg', offKeys: ['vitamin-b6'], targetUnit: 'mg' },
  { appKey: 'folateMcg', offKeys: ['vitamin-b9', 'folates'], targetUnit: 'mcg' },
  { appKey: 'vitaminB12Mcg', offKeys: ['vitamin-b12'], targetUnit: 'mcg' },
  { appKey: 'omega3G', offKeys: ['omega-3-fat'], targetUnit: 'g' },
  { appKey: 'omega6G', offKeys: ['omega-6-fat'], targetUnit: 'g' },
];

function nutrimentMicros(nutriments: UnknownRecord, basis: 'serving' | '100g'): Micronutrients {
  const result: Micronutrients = {};
  for (const field of OFF_MICRONUTRIENTS) {
    for (const offKey of field.offKeys) {
      const value = gramsNutrientAs(nutriments, offKey, basis, field.targetUnit);
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
    calories: firstNutrient(nutriments, ['energy-kcal'], basis),
    proteinG: nutrient(nutriments, 'proteins', basis),
    fatG: nutrient(nutriments, 'fat', basis),
    totalCarbsG: nutrient(nutriments, 'carbohydrates', basis),
    fibreG: firstNutrient(nutriments, ['fiber', 'fibre'], basis),
    sugarAlcoholsG: firstNutrient(nutriments, ['polyols', 'sugar-alcohol', 'sugar-alcohols'], basis),
    sodiumMg: gramsNutrientAs(nutriments, 'sodium', basis, 'mg') ?? 0,
    potassiumMg: gramsNutrientAs(nutriments, 'potassium', basis, 'mg') ?? 0,
    magnesiumMg: gramsNutrientAs(nutriments, 'magnesium', basis, 'mg') ?? 0,
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

// Honest copy: only blame the user's connection when the browser is actually
// offline; a failed upstream fetch is the barcode database being unreachable,
// not them. Mirrors the same rule in food-search.
function unreachableMessage(): string {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return offline
    ? 'You appear to be offline — check your connection and try again.'
    : 'The barcode database is busy right now — please try again in a moment.';
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
      lastError = unreachableMessage();
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
      lastError = unreachableMessage();
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

// Every macro, electrolyte, and micronutrient we track. A record is considered
// to carry usable nutrition if any one of these is above zero — so a valid
// zero-calorie supplement (electrolytes/vitamins only) still counts as real
// data, not an empty row.
export const TRACKED_NUTRITION_KEYS = [
  'calories', 'proteinG', 'fatG', 'totalCarbsG', 'fibreG', 'sugarAlcoholsG',
  'sodiumMg', 'potassiumMg', 'magnesiumMg', ...MICRONUTRIENT_KEYS,
] as const;

type NutritionProbe = Partial<Record<(typeof TRACKED_NUTRITION_KEYS)[number], number | undefined>>;

export function hasPositiveNutrition(food: NutritionProbe): boolean {
  return TRACKED_NUTRITION_KEYS.some((key) => (food[key] ?? 0) > 0);
}

// A logged barcode entry needs nutrition repair if it was scanned but stored no
// usable nutrition at all (e.g. logged while the Open Food Facts lookup was
// returning empty nutriments). A zero-calorie supplement that still has real
// electrolytes/micros is complete and must NOT be flagged. See barcode-off-v2.
export function entryNeedsNutritionRepair(entry: Pick<FoodLogEntry, 'barcode'> & NutritionProbe): boolean {
  return Boolean(entry.barcode) && !hasPositiveNutrition(entry);
}

export interface RepairResult {
  ok: boolean;
  message: string;
}

// Lookup errors are worded for the scanner's manual-entry flow; reword the ones
// that mean a stored barcode can never resolve, so the repair banner doesn't
// suggest retrying something that will always fail.
export function repairFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Enter a valid barcode number.' || message === 'No food was found for that barcode.') {
    return 'A logged barcode is not in the food database — edit the entry to fill in nutrition manually.';
  }
  return message;
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
