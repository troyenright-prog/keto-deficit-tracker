import { describe, expect, it } from 'vitest';
import { savedFoodToLogEntry } from '../lib/nutrition';
import { foodItemToTemplateItem, templateToLogEntries } from '../lib/meal-templates';
import { recipeToLogEntry } from '../lib/recipes';
import { foodToPlanEntry, templateToPlanEntry } from '../lib/planner';
import type { FoodItem, MealTemplate, Recipe } from '../types';

const food = (): FoodItem => ({
  id: 'f', name: 'Egg', servingSize: '1', calories: 70, proteinG: 6, fatG: 5,
  totalCarbsG: 1, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 60,
  potassiumMg: 50, magnesiumMg: 5, createdAt: '2026-01-01T00:00:00Z',
});

describe('historical snapshot stability', () => {
  it('keeps a logged saved food stable after the source is edited or deleted', () => {
    const source = food();
    const entry = savedFoodToLogEntry(source, '2026-01-01');
    source.calories = 999;
    const library: FoodItem[] = [];
    expect(library).toHaveLength(0);
    expect(entry.calories).toBe(70);
  });

  it('keeps template log entries stable after template editing/deletion', () => {
    const template: MealTemplate = { id: 't', name: 'Breakfast', items: [foodItemToTemplateItem(food())], createdAt: '2026-01-01T00:00:00Z' };
    const entries = templateToLogEntries(template, '2026-01-01');
    template.items[0].calories = 999;
    const templates: MealTemplate[] = [];
    expect(templates).toHaveLength(0);
    expect(entries[0].calories).toBe(70);
  });

  it('keeps recipe log entries stable after recipe editing/deletion', () => {
    const recipe: Recipe = {
      id: 'r', name: 'Eggs', servings: 1, createdAt: '2026-01-01T00:00:00Z',
      ingredients: [{ ...foodItemToTemplateItem(food()), id: 'i' }],
    };
    const entry = recipeToLogEntry(recipe, 1, '2026-01-01');
    recipe.ingredients[0].calories = 999;
    const recipes: Recipe[] = [];
    expect(recipes).toHaveLength(0);
    expect(entry.calories).toBe(70);
  });

  it('snapshots planner nutrition independently from source items', () => {
    const source = food();
    const foodPlan = foodToPlanEntry(source, '2026-01-02');
    const template: MealTemplate = { id: 't', name: 'Meal', items: [foodItemToTemplateItem(source)], createdAt: source.createdAt };
    const templatePlan = templateToPlanEntry(template, '2026-01-02');
    source.calories = 999;
    template.items[0].calories = 888;
    expect(foodPlan.calories).toBe(70);
    expect(templatePlan.calories).toBe(70);
  });
});
