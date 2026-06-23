import { describe, expect, it } from 'vitest';
import { entryMeal, inferMealSlot, mealLabel } from '../lib/meals';
import { savedFoodToLogEntry } from '../lib/nutrition';
import { normalizeAppBundle } from '../lib/storage';
import type { FoodItem } from '../types';

const egg: FoodItem = {
  id: 'egg',
  name: 'Eggs',
  servingSize: '2 eggs',
  calories: 140,
  proteinG: 12,
  fatG: 10,
  totalCarbsG: 1,
  fibreG: 0,
  sugarAlcoholsG: 0,
  sodiumMg: 120,
  potassiumMg: 100,
  magnesiumMg: 10,
  createdAt: '2026-06-24T00:00:00.000Z',
};

describe('meal slots', () => {
  it('infers sensible default meals from local time', () => {
    expect(inferMealSlot(new Date('2026-06-24T08:00:00'))).toBe('breakfast');
    expect(inferMealSlot(new Date('2026-06-24T13:00:00'))).toBe('lunch');
    expect(inferMealSlot(new Date('2026-06-24T18:00:00'))).toBe('dinner');
    expect(inferMealSlot(new Date('2026-06-24T22:00:00'))).toBe('snack');
  });

  it('copies meal selection into stable food log snapshots', () => {
    const entry = savedFoodToLogEntry(egg, '2026-06-24', 1.5, 'breakfast');
    expect(entry).toMatchObject({ meal: 'breakfast', calories: 210 });
    expect(entryMeal(entry)).toBe('breakfast');
    expect(mealLabel(entry.meal!)).toBe('Breakfast');
  });

  it('preserves valid imported meal slots and ignores invalid ones safely', () => {
    const normalized = normalizeAppBundle({
      version: 3,
      exportedAt: '2026-06-24T00:00:00.000Z',
      profile: { name: '', weightUnit: 'kg', createdAt: '2026-06-24T00:00:00.000Z' },
      targets: { calories: 1800, proteinG: 120, netCarbsG: 20, fatG: 140, sodiumMg: 2300, potassiumMg: 3500, magnesiumMg: 400, dietMode: 'strict-keto', manualNetCarbs: false },
      foodLog: [
        { id: 'valid', date: '2026-06-24', meal: 'dinner', name: 'Steak', servingSize: '1 serve', servingMultiplier: 1, calories: 300, proteinG: 30, fatG: 20, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 100, potassiumMg: 300, magnesiumMg: 20, loggedAt: '2026-06-24T10:00:00.000Z' },
        { id: 'invalid', date: '2026-06-24', meal: 'brunch', name: 'Mystery', servingSize: '1 serve', servingMultiplier: 1, calories: 10, proteinG: 1, fatG: 1, totalCarbsG: 1, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0, loggedAt: '2026-06-24T10:00:00.000Z' },
      ],
      savedFoods: [],
      weightEntries: [],
      mealTemplates: [],
      recipes: [],
      shoppingList: [],
      mealPlan: [],
    });

    expect(normalized?.foodLog[0].meal).toBe('dinner');
    expect(normalized?.foodLog[1].meal).toBeUndefined();
  });
});
