import { describe, expect, it, vi } from 'vitest';
import {
  applyBarcodeNutritionToEntry,
  barcodeFoodToLogEntry,
  barcodeFoodToSavedFood,
  barcodeLookupUrls,
  entryNeedsNutritionRepair,
  lookupBarcodeFood,
  normalizeBarcode,
  normalizeOpenFoodFactsProduct,
  type BarcodeFood,
} from '../lib/barcode';
import type { FoodLogEntry } from '../types';

const openFoodFactsResponse = {
  code: '9300675051132',
  product: {
    code: '9300675051132',
    product_name: 'Test Almond Bar',
    brands: 'Keto Co',
    serving_size: '40g',
    url: 'https://world.openfoodfacts.org/product/9300675051132/test',
    nutriments: {
      'energy-kcal_serving': 180,
      proteins_serving: 8,
      fat_serving: 14,
      carbohydrates_serving: 6,
      fiber_serving: 4,
      polyols_serving: 1,
      sodium_serving: 0.12,
      sodium_unit: 'g',
      potassium_serving: 180,
      potassium_unit: 'mg',
      magnesium_serving: 55,
      magnesium_unit: 'mg',
    },
  },
};

const zeroNutritionResponse = {
  code: '9311770608800',
  product: {
    code: '9311770608800',
    product_name: 'Mens multivitamin',
    brands: 'Swisse',
    serving_size: '1 tablet',
    url: 'https://world.openfoodfacts.org/product/9311770608800/test',
    nutriments: {},
  },
};

describe('barcode food mapping', () => {
  it('normalizes typed or scanned barcode text', () => {
    expect(normalizeBarcode(' 9300-6750 51132 ')).toBe('9300675051132');
  });

  it('tries the app lookup endpoint before the direct Open Food Facts fallback', () => {
    const urls = barcodeLookupUrls('9300675051132');
    expect(urls[0]).toBe('/api/lookup-barcode?code=9300675051132');
    expect(urls[1]).toBe('https://world.openfoodfacts.org/api/v2/product/9300675051132.json');
  });

  it('maps Open Food Facts nutrition to app nutrition safely', () => {
    const food = normalizeOpenFoodFactsProduct(openFoodFactsResponse);
    expect(food).toMatchObject({
      barcode: '9300675051132',
      name: 'Test Almond Bar',
      brand: 'Keto Co',
      servingSize: '40g',
      calories: 180,
      totalCarbsG: 6,
      fibreG: 4,
      sugarAlcoholsG: 1,
      sodiumMg: 120,
      potassiumMg: 180,
    });
  });

  it('keeps found Open Food Facts products with zero macro nutrition valid', () => {
    const food = normalizeOpenFoodFactsProduct(zeroNutritionResponse);
    expect(food).toMatchObject({
      barcode: '9311770608800',
      name: 'Mens multivitamin',
      brand: 'Swisse',
      servingSize: '1 tablet',
      dataBasis: 'serving',
      calories: 0,
      proteinG: 0,
      fatG: 0,
      totalCarbsG: 0,
      sodiumMg: 0,
    });

    const entry = barcodeFoodToLogEntry(food!, '2026-07-01');
    expect(entry).toMatchObject({
      source: 'barcode',
      barcode: '9311770608800',
      calories: 0,
      proteinG: 0,
      fatG: 0,
      totalCarbsG: 0,
    });
  });

  it('copies barcode nutrition into stable log and saved-food snapshots', () => {
    const food = normalizeOpenFoodFactsProduct(openFoodFactsResponse);
    expect(food).not.toBeNull();
    const entry = barcodeFoodToLogEntry(food!, '2026-06-24', 2);
    const saved = barcodeFoodToSavedFood(food!);
    expect(entry).toMatchObject({
      source: 'barcode',
      barcode: '9300675051132',
      name: 'Test Almond Bar (Keto Co)',
      calories: 360,
      totalCarbsG: 12,
      fibreG: 8,
      sugarAlcoholsG: 2,
    });
    expect(saved).toMatchObject({
      barcode: '9300675051132',
      name: 'Test Almond Bar (Keto Co)',
      calories: 180,
    });
  });

  it('falls through to the direct source when the app lookup endpoint misses', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/lookup-barcode')) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(openFoodFactsResponse);
    }) as unknown as typeof fetch;

    await expect(lookupBarcodeFood('9300675051132', fetcher)).resolves.toMatchObject({
      barcode: '9300675051132',
      name: 'Test Almond Bar',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('reports not found when every barcode source misses', async () => {
    const fetcher = vi.fn(async () => Response.json({ error: 'Not found' }, { status: 404 })) as unknown as typeof fetch;

    await expect(lookupBarcodeFood('0000000000000', fetcher)).rejects.toThrow('No food was found');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('nutrition repair', () => {
  const zeroEntry: FoodLogEntry = {
    id: 'e1', date: '2026-07-01', source: 'barcode', barcode: '3017620422003',
    name: 'Nutella', servingSize: '100g', servingMultiplier: 2,
    calories: 0, proteinG: 0, fatG: 0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0,
    sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0, loggedAt: '2026-07-01T00:00:00.000Z',
  };
  const food: BarcodeFood = {
    barcode: '3017620422003', name: 'Nutella', servingSize: '100g', dataBasis: '100g',
    calories: 539, proteinG: 6.3, fatG: 30.9, totalCarbsG: 57.5, fibreG: 0, sugarAlcoholsG: 0,
    sodiumMg: 42, potassiumMg: 0, magnesiumMg: 0,
  };

  it('flags scanned entries with no calories and ignores complete ones', () => {
    expect(entryNeedsNutritionRepair(zeroEntry)).toBe(true);
    expect(entryNeedsNutritionRepair({ ...zeroEntry, calories: 100 })).toBe(false);
    expect(entryNeedsNutritionRepair({ ...zeroEntry, barcode: undefined })).toBe(false);
  });

  it('recomputes macros from fresh nutrition, scaled by the serving multiplier', () => {
    const repaired = applyBarcodeNutritionToEntry(zeroEntry, food);
    expect(repaired.id).toBe('e1'); // identity preserved
    expect(repaired.servingMultiplier).toBe(2);
    expect(repaired.calories).toBe(1078); // 539 * 2
    expect(repaired.totalCarbsG).toBe(115); // 57.5 * 2
    expect(entryNeedsNutritionRepair(repaired)).toBe(false);
  });
});
