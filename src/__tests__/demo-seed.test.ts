import { beforeEach, describe, expect, it } from 'vitest';
import { loadFoodLog, loadSavedFoods, loadWeightEntries, saveFoodLog, seedDemoDataIfEmpty } from '../lib/storage';
import type { FoodLogEntry } from '../types';

beforeEach(() => localStorage.clear());

const existingEntry: FoodLogEntry = {
  id: 'existing',
  date: '2026-06-25',
  name: 'Existing food',
  servingSize: '1 serve',
  servingMultiplier: 1,
  calories: 100,
  proteinG: 10,
  fatG: 5,
  totalCarbsG: 2,
  fibreG: 0,
  sugarAlcoholsG: 0,
  sodiumMg: 50,
  potassiumMg: 50,
  magnesiumMg: 5,
  loggedAt: '2026-06-25T00:00:00.000Z',
};

describe('temporary demo data seed', () => {
  it('populates an empty local install with realistic demo data', () => {
    expect(seedDemoDataIfEmpty()).toBe(true);
    expect(loadFoodLog().length).toBeGreaterThan(0);
    expect(loadSavedFoods().length).toBeGreaterThan(0);
    expect(loadWeightEntries().length).toBeGreaterThan(0);
  });

  it('does not overwrite existing user data', () => {
    expect(saveFoodLog([existingEntry])).toBe(true);
    expect(seedDemoDataIfEmpty()).toBe(false);
    expect(loadFoodLog()).toHaveLength(1);
    expect(loadFoodLog()[0].id).toBe('existing');
  });
});
