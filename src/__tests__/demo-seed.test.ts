import { beforeEach, describe, expect, it } from 'vitest';
import { loadFoodLog, loadSavedFoods, loadWeightEntries, saveFoodLog, seedDemoDataIfEmpty } from '../lib/storage';
import type { FoodLogEntry } from '../types';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

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

describe('demo data seed', () => {
  it('does not populate a normal empty install', () => {
    expect(seedDemoDataIfEmpty()).toBe(false);
    expect(loadFoodLog()).toHaveLength(0);
    expect(loadSavedFoods()).toHaveLength(0);
    expect(loadWeightEntries()).toHaveLength(0);
  });

  it('populates demo data only when explicitly requested', () => {
    window.history.replaceState({}, '', '/?demo=reset');
    expect(seedDemoDataIfEmpty()).toBe(true);
    expect(loadFoodLog().length).toBeGreaterThan(0);
    expect(loadSavedFoods().length).toBeGreaterThan(0);
    expect(loadWeightEntries().length).toBeGreaterThan(0);
  });

  it('does not overwrite existing user data unless reset is explicit', () => {
    window.history.replaceState({}, '', '/?demo=1');
    expect(saveFoodLog([existingEntry])).toBe(true);
    expect(seedDemoDataIfEmpty()).toBe(false);
    expect(loadFoodLog()).toHaveLength(1);
    expect(loadFoodLog()[0].id).toBe('existing');
  });
});
