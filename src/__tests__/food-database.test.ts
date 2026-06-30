import { beforeEach, describe, expect, it } from 'vitest';
import { buildQuickAddGroups } from '../lib/quick-add';
import {
  exportAppData,
  importAppData,
  loadFoodDatabase,
  saveFoodDatabase,
  validateAppBundle,
} from '../lib/storage';
import { barcodeFoodToFoodDatabaseItem, upsertFoodDatabaseItem } from '../lib/food-database';
import type { FoodDatabaseItem } from '../types';

const dbFood = (overrides: Partial<FoodDatabaseItem> = {}): FoodDatabaseItem => ({
  id: 'db-1',
  barcode: '1234567890123',
  name: 'Scanned Cheese',
  brand: 'Keto Co',
  source: 'openFoodFacts',
  servingSize: '40g',
  calories: 180,
  proteinG: 8,
  fatG: 14,
  totalCarbsG: 6,
  fibreG: 4,
  sugarAlcoholsG: 1,
  netCarbsG: 1,
  sodiumMg: 120,
  potassiumMg: 180,
  magnesiumMg: 55,
  verified: false,
  userEdited: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => localStorage.clear());

describe('food database storage', () => {
  it('reads and writes normalized food database records', () => {
    expect(saveFoodDatabase([dbFood()])).toBe(true);
    expect(loadFoodDatabase()[0]).toMatchObject({
      barcode: '1234567890123',
      name: 'Scanned Cheese',
      netCarbsG: 1,
    });
  });

  it('recovers malformed stored records safely', () => {
    localStorage.setItem('keto_food_database', JSON.stringify([
      { id: 'bad', barcode: '555', calories: -1, proteinG: null, totalCarbsG: 10, fibreG: 3, sugarAlcoholsG: 2 },
    ]));
    const loaded = loadFoodDatabase()[0];
    expect(loaded.name).toBe('Unnamed food');
    expect(loaded.calories).toBe(0);
    expect(loaded.netCarbsG).toBe(5);
  });

  it('deduplicates by barcode and keeps user-corrected records over remote imports', () => {
    const corrected = dbFood({ id: 'local', name: 'Corrected Cheese', userEdited: true, calories: 200 });
    const remote = dbFood({ id: 'remote', name: 'Remote Cheese', userEdited: false, calories: 180 });
    const merged = upsertFoodDatabaseItem([corrected], remote);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 'local', name: 'Corrected Cheese', calories: 200 });
  });

  it('stores USDA barcode results with the correct source', () => {
    const item = barcodeFoodToFoodDatabaseItem({
      barcode: '1234567890123',
      name: 'USDA Cheese',
      brand: 'USDA Brand',
      attribution: 'USDA FoodData Central',
      servingSize: '40g',
      dataBasis: '100g',
      calories: 180,
      proteinG: 8,
      fatG: 14,
      totalCarbsG: 6,
      fibreG: 4,
      sugarAlcoholsG: 0,
      sodiumMg: 120,
      potassiumMg: 0,
      magnesiumMg: 0,
    });
    expect(item.source).toBe('foodDataCentral');
  });
});

describe('food database backup and search', () => {
  it('exports and imports the food database', () => {
    saveFoodDatabase([dbFood()]);
    const bundle = exportAppData();
    expect(bundle.foodDatabase).toHaveLength(1);
    localStorage.clear();
    expect(importAppData(bundle)).toBe(true);
    expect(loadFoodDatabase()[0].barcode).toBe('1234567890123');
  });

  it('validates backups with food database arrays and rejects corrupt records', () => {
    const bundle = exportAppData();
    expect(validateAppBundle({ ...bundle, foodDatabase: [{ id: 'ok' }] })).toBe(true);
    expect(validateAppBundle({ ...bundle, foodDatabase: [null] })).toBe(false);
  });

  it('includes database foods in quick-add search without duplicating saved foods', () => {
    const groups = buildQuickAddGroups({
      query: 'cheese',
      savedFoods: [],
      foodDatabase: [dbFood()],
      recentFoods: [],
      recipes: [],
      templates: [],
      starterFoods: [],
    });
    expect(groups.find((group) => group.key === 'database')?.items[0]).toMatchObject({
      kind: 'database',
      name: 'Scanned Cheese (Keto Co)',
    });
  });
});
