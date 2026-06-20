import { describe, it, expect } from 'vitest';
import type { Recipe } from '../types';
import { calcRecipeTotals, calcRecipePerServing, recipeToLogEntry } from '../lib/recipes';

const recipe: Recipe = {
  id: 'r1',
  name: 'Keto stir fry',
  servings: 4,
  createdAt: '2024-01-01T00:00:00Z',
  ingredients: [
    {
      id: 'g1', name: 'Chicken breast', servingSize: '100g', quantity: 3,
      calories: 120, proteinG: 22.5, fatG: 2.6, totalCarbsG: 0,
      fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 74, potassiumMg: 360, magnesiumMg: 29,
    },
    {
      id: 'g2', name: 'Broccoli', servingSize: '100g', quantity: 2,
      calories: 34, proteinG: 2.8, fatG: 0.4, totalCarbsG: 7,
      fibreG: 2.6, sugarAlcoholsG: 0, sodiumMg: 33, potassiumMg: 316, magnesiumMg: 21,
    },
  ],
};

describe('calcRecipeTotals', () => {
  it('sums ingredients applying quantities', () => {
    const t = calcRecipeTotals(recipe);
    // chicken: 120*3=360, broccoli: 34*2=68 → total=428
    expect(t.calories).toBeCloseTo(428, 0);
    expect(t.proteinG).toBeCloseTo(22.5 * 3 + 2.8 * 2, 1);
  });

  it('computes net carbs (totalCarbs - fibre)', () => {
    const t = calcRecipeTotals(recipe);
    // totalCarbs = 0 + 7*2 = 14, fibre = 0 + 2.6*2 = 5.2 → net = 8.8
    expect(t.netCarbsG).toBeCloseTo(8.8, 1);
  });
});

describe('calcRecipePerServing', () => {
  it('divides totals by number of servings', () => {
    const ps = calcRecipePerServing(recipe);
    const total = calcRecipeTotals(recipe);
    expect(ps.calories).toBeCloseTo(total.calories / 4, 1);
    expect(ps.netCarbsG).toBeCloseTo(total.netCarbsG / 4, 2);
  });

  it('handles servings=1 without division errors', () => {
    const r1: Recipe = { ...recipe, servings: 1 };
    const ps = calcRecipePerServing(r1);
    const t = calcRecipeTotals(r1);
    expect(ps.calories).toBeCloseTo(t.calories, 1);
  });
});

describe('recipeToLogEntry', () => {
  it('creates a log entry for the requested number of servings', () => {
    const entry = recipeToLogEntry(recipe, 2, '2024-06-01');
    const ps = calcRecipePerServing(recipe);
    expect(entry.calories).toBeCloseTo(ps.calories * 2, 1);
    expect(entry.date).toBe('2024-06-01');
    expect(entry.source).toBe('recipe');
    expect(entry.recipeId).toBe('r1');
  });

  it('labels single serving without count suffix', () => {
    const entry = recipeToLogEntry(recipe, 1, '2024-06-01');
    expect(entry.name).toBe('Keto stir fry');
  });

  it('labels multiple servings with count suffix', () => {
    const entry = recipeToLogEntry(recipe, 2, '2024-06-01');
    expect(entry.name).toContain('2 servings');
  });
});
