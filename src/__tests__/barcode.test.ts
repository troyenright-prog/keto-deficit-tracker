import { describe, expect, it, vi } from 'vitest';
import {
  applyBarcodeNutritionToEntry,
  barcodeFoodToLogEntry,
  barcodeFoodToSavedFood,
  barcodesEquivalent,
  barcodeLookupUrls,
  entryNeedsNutritionRepair,
  expandUpce,
  hasValidGtinCheckDigit,
  lookupBarcodeFood,
  hasPositiveNutrition,
  normalizeBarcode,
  normalizeOpenFoodFactsProduct,
  repairFailureMessage,
  type BarcodeFood,
} from '../lib/barcode';
import type { FoodLogEntry } from '../types';

// Realistic Open Food Facts v2 shape: `_100g` / `_serving` values are always
// in GRAMS regardless of `_unit`, which describes only the as-entered label
// figure (`_value`). Mirrors live payloads captured 2026-07-05 (Nutella
// 3017620422003, Alpro 5411188110835, Cheerios 016000275287).
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
      sodium_serving: 0.12, // grams
      sodium_unit: 'g',
      potassium_serving: 0.18, // grams, even though the label unit is mg
      potassium_unit: 'mg',
      magnesium_serving: 0.055, // grams
      magnesium_unit: 'mg',
      'vitamin-c_serving': 0.012, // grams (label: 12 mg)
      'vitamin-c_unit': 'mg',
      iodine_serving: 0.00015, // grams (label: 150 mcg)
      iodine_unit: 'mcg',
      'vitamin-b12_serving': 0.0000024, // grams (label: 2.4 mcg)
      'vitamin-b12_unit': 'mcg',
      'saturated-fat_serving': 5.5, // grams
      'pantothenic-acid_serving': 0.002, // grams (label: 2 mg)
      'pantothenic-acid_unit': 'mg',
      biotin_serving: 0.00003, // grams (label: 30 mcg)
      biotin_unit: 'µg',
      choline_serving: 0.185, // grams (label: 185 mg)
      choline_unit: 'mg',
    },
  },
};

// Captured from the live v2 API (Alpro almond drink 5411188110835, trimmed):
// 100g-basis product where every mineral/vitamin `_100g` value is in grams.
const capturedAlmondDrinkResponse = {
  code: '5411188110835',
  product: {
    code: '5411188110835',
    product_name: 'Almond drink',
    brands: 'Alpro',
    serving_size: '1 portion (100 ml)',
    nutrition_data_per: '100g',
    nutriments: {
      'energy-kcal_100g': 22,
      proteins_100g: 0.4,
      fat_100g: 1.1,
      carbohydrates_100g: 2.4,
      sodium_100g: 0.059,
      sodium_unit: 'g',
      calcium_100g: 0.12,
      calcium_unit: 'g',
      'vitamin-d_100g': 7.5e-7,
      'vitamin-d_unit': 'µg',
      'vitamin-b12_100g': 3.8e-7,
      'vitamin-b12_unit': 'µg',
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

  it('matches equivalent UPC-A, EAN-13, and GTIN container forms', () => {
    expect(barcodesEquivalent('036000291452', '0036000291452')).toBe(true);
    expect(barcodesEquivalent('036000291452', '00036000291452')).toBe(true);
    expect(hasValidGtinCheckDigit('036000291452')).toBe(true);
    expect(hasValidGtinCheckDigit('036000291453')).toBe(false);
  });

  it('expands scanner UPC-E values to their UPC-A equivalent', () => {
    expect(expandUpce('04210005')).toBe('042000001005');
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
      magnesiumMg: 55,
      vitaminCMg: 12,
      iodineMcg: 150,
      vitaminB12Mcg: 2.4,
      saturatedFatG: 5.5,
      pantothenicAcidMg: 2,
      biotinMcg: 30,
      cholineMg: 185,
    });
  });

  it('reads _100g/_serving values as grams and ignores the label display unit', () => {
    // potassium_unit says "mg" but the _serving value is in grams (OFF always
    // normalizes _100g/_serving to grams) — the old unit-driven parsing read
    // 0.18 as 0.18 mg, a 1000x underestimate.
    const food = normalizeOpenFoodFactsProduct(capturedAlmondDrinkResponse);
    expect(food).toMatchObject({
      barcode: '5411188110835',
      name: 'Almond drink',
      brand: 'Alpro',
      servingSize: '100g',
      dataBasis: '100g',
      calories: 22,
      sodiumMg: 59, // 0.059 g
      calciumMg: 120, // 0.12 g
      vitaminDMcg: 0.75, // 7.5e-7 g, despite _unit "µg"
      vitaminB12Mcg: 0.38, // 3.8e-7 g
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

  it('falls through to the direct source when the app lookup endpoint is unavailable', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/lookup-barcode')) return Response.json({ error: 'Unavailable' }, { status: 502 });
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
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not blame the connection when a fetch fails while online', async () => {
    const fetcher = vi.fn(async () => { throw new Error('network layer'); }) as unknown as typeof fetch;

    await expect(lookupBarcodeFood('9300675051132', fetcher)).rejects.toThrow(/barcode database is busy/);
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

  it('flags scanned entries with no usable nutrition and ignores complete ones', () => {
    expect(entryNeedsNutritionRepair(zeroEntry)).toBe(true);
    expect(entryNeedsNutritionRepair({ ...zeroEntry, calories: 100 })).toBe(false);
    expect(entryNeedsNutritionRepair({ ...zeroEntry, barcode: undefined })).toBe(false);
  });

  it('does not flag a valid zero-calorie supplement that carries electrolytes or micros', () => {
    // Electrolyte-only supplement: 0 kcal but real sodium/potassium is complete data.
    expect(entryNeedsNutritionRepair({ ...zeroEntry, sodiumMg: 250, potassiumMg: 100 })).toBe(false);
    // Micronutrient-only supplement: 0 kcal but a real vitamin is complete data.
    expect(entryNeedsNutritionRepair({ ...zeroEntry, vitaminDMcg: 25 })).toBe(false);
  });

  it('hasPositiveNutrition recognises calories, macros, electrolytes, and micros', () => {
    expect(hasPositiveNutrition({ calories: 200 })).toBe(true); // calorie-bearing food
    expect(hasPositiveNutrition({ calories: 0, sodiumMg: 300 })).toBe(true); // zero-cal electrolyte
    expect(hasPositiveNutrition({ calories: 0, iodineMcg: 150 })).toBe(true); // micronutrient-only
    expect(hasPositiveNutrition({ calories: 0, proteinG: 0, sodiumMg: 0 })).toBe(false); // empty row → failed lookup
  });

  it('recomputes macros from fresh nutrition, scaled by the serving multiplier', () => {
    const repaired = applyBarcodeNutritionToEntry(zeroEntry, food);
    expect(repaired.id).toBe('e1'); // identity preserved
    expect(repaired.servingMultiplier).toBe(2);
    expect(repaired.calories).toBe(1078); // 539 * 2
    expect(repaired.totalCarbsG).toBe(115); // 57.5 * 2
    expect(entryNeedsNutritionRepair(repaired)).toBe(false);
  });

  it('rewords unresolvable-barcode errors and passes other reasons through', () => {
    expect(repairFailureMessage(new Error('No food was found for that barcode.'))).toMatch(/edit the entry/);
    expect(repairFailureMessage(new Error('Enter a valid barcode number.'))).toMatch(/edit the entry/);
    expect(repairFailureMessage(new Error('Barcode lookup is temporarily rate-limited. Try again shortly.')))
      .toBe('Barcode lookup is temporarily rate-limited. Try again shortly.');
    expect(repairFailureMessage('not an error')).toBe('');
  });
});
