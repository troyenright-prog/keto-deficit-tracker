import type { FoodItem, FoodLogEntry, MealSlot, Micronutrients } from '../types';
import { safeNonNegative, safePositive } from './nutrition';
import { nanoid } from './nanoid';

export interface BarcodeFood extends Micronutrients {
  barcode: string;
  name: string;
  brand?: string;
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
    sourceUrl: asText(product.url),
  };
}

export async function lookupBarcodeFood(barcode: string, fetcher: typeof fetch = fetch): Promise<BarcodeFood> {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) throw new Error('Enter a valid barcode number.');
  const response = await fetcher(`/api/lookup-barcode?code=${encodeURIComponent(normalized)}`);
  const body = await response.json() as unknown;
  if (!response.ok) {
    const message = isRecord(body) && typeof body.error === 'string' ? body.error : 'Barcode lookup failed.';
    throw new Error(message);
  }
  const food = normalizeOpenFoodFactsProduct(body, normalized);
  if (!food) throw new Error('Barcode lookup returned incomplete nutrition data.');
  return food;
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
