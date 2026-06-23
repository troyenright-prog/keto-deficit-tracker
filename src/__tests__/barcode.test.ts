import { describe, expect, it } from 'vitest';
import { barcodeFoodToLogEntry, barcodeFoodToSavedFood, normalizeBarcode, normalizeOpenFoodFactsProduct } from '../lib/barcode';

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

describe('barcode food mapping', () => {
  it('normalizes typed or scanned barcode text', () => {
    expect(normalizeBarcode(' 9300-6750 51132 ')).toBe('9300675051132');
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
});
