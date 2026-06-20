import { describe, expect, it } from 'vitest';
import { foodItemToTemplateItem, templateToLogEntries } from '../lib/meal-templates';
import { calcRecipePerServing, recipeToLogEntry } from '../lib/recipes';
import { summariseDay } from '../lib/nutrition';
import type { FoodItem, MealTemplate, Recipe } from '../types';

const food: FoodItem = {
  id: 'f', name: 'Salmon', servingSize: '100g', calories: 200, proteinG: 20, fatG: 10,
  totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 50, potassiumMg: 400,
  magnesiumMg: 30, calciumMg: 12, omega3G: 2, createdAt: '2026-01-01T00:00:00Z',
};

describe('micronutrient snapshots', () => {
  it('preserves saved food micronutrients through templates and logs', () => {
    const template: MealTemplate = { id: 't', name: 'Meal', items: [foodItemToTemplateItem(food, 2)], createdAt: food.createdAt };
    food.calciumMg = 99;
    const entry = templateToLogEntries(template, '2026-01-01')[0];
    expect(entry.calciumMg).toBe(24);
    expect(entry.omega3G).toBe(4);
    expect(summariseDay('2026-01-01', [entry]).calciumMg).toBe(24);
  });

  it('preserves recipe micronutrients per serving and in final consumed totals', () => {
    const recipe: Recipe = {
      id: 'r', name: 'Fish', servings: 2, createdAt: food.createdAt,
      ingredients: [{ ...foodItemToTemplateItem(food, 2), id: 'i' }],
    };
    expect(calcRecipePerServing(recipe).omega3G).toBe(2);
    expect(recipeToLogEntry(recipe, 2, '2026-01-01').omega3G).toBe(4);
  });
});
