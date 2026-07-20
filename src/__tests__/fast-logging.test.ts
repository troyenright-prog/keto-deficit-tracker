import { beforeEach, describe, expect, it } from 'vitest';
import { buildQuickAddGroups, copyLogEntries, duplicateLogEntry, recentFoodsFromLog } from '../lib/quick-add';
import { savedFoodToLogEntry } from '../lib/nutrition';
import { templateToLogEntries } from '../lib/meal-templates';
import { exportAppData, loadMealTemplates, loadSavedFoods, migrateIfNeeded } from '../lib/storage';
import type { FoodItem, FoodLogEntry, MealTemplate, Recipe } from '../types';

const food = (overrides: Partial<FoodItem> = {}): FoodItem => ({
  id: 'food-1', name: 'Eggs', servingSize: '2 eggs', calories: 140, proteinG: 12,
  fatG: 10, totalCarbsG: 1, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 120,
  potassiumMg: 100, magnesiumMg: 10, createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const entry = (overrides: Partial<FoodLogEntry> = {}): FoodLogEntry => ({
  id: 'log-1', date: '2026-01-02', name: 'Eggs', servingSize: '2 eggs', servingMultiplier: 2,
  calories: 280, proteinG: 24, fatG: 20, totalCarbsG: 2, fibreG: 0,
  sugarAlcoholsG: 0, sodiumMg: 240, potassiumMg: 200, magnesiumMg: 20,
  loggedAt: '2026-01-02T08:00:00.000Z', ...overrides,
});

describe('fast logging helpers', () => {
  it('derives unique recent foods from immutable historical snapshots', () => {
    const source = entry();
    const recent = recentFoodsFromLog([source, entry({ id: 'older', loggedAt: '2026-01-01T08:00:00.000Z' })]);
    source.calories = 999;
    expect(recent).toHaveLength(1);
    expect(recent[0].calories).toBe(140);
    expect(recent[0].proteinG).toBe(12);
  });

  it('adds saved and recent snapshots with validated quantity multipliers', () => {
    const logged = savedFoodToLogEntry(food({ isFavourite: true }), '2026-01-03', 1.5);
    expect(logged.servingMultiplier).toBe(1.5);
    expect(logged.calories).toBe(210);
    expect(savedFoodToLogEntry(food(), '2026-01-03', Number.NaN).servingMultiplier).toBe(1);
  });

  it('copies and duplicates entries with new IDs without mutating originals', () => {
    const original = entry();
    const duplicate = duplicateLogEntry(original);
    const copied = copyLogEntries([original], '2026-01-04')[0];
    expect(duplicate.id).not.toBe(original.id);
    expect(copied.id).not.toBe(original.id);
    expect(copied.date).toBe('2026-01-04');
    expect(copied.calories).toBe(original.calories);
    expect(original.date).toBe('2026-01-02');
  });

  it('scales meal-template snapshots by the requested multiplier', () => {
    const template: MealTemplate = {
      id: 'meal', name: 'Breakfast', mealType: 'breakfast', createdAt: '2026-01-01T00:00:00.000Z',
      items: [{ ...food(), id: 'item', quantity: 1 }],
    };
    const logged = templateToLogEntries(template, '2026-01-03', 2)[0];
    expect(logged.calories).toBe(280);
    expect(logged.servingMultiplier).toBe(2);
  });
});

describe('unified quick-add grouping', () => {
  const favourite = food({ id: 'fav', name: 'Favourite Eggs', isFavourite: true });
  const saved = food({ id: 'saved', name: 'Saved Salmon' });
  const recipe = { id: 'recipe', name: 'Salmon Bake', servings: 2, ingredients: [], createdAt: saved.createdAt } as Recipe;
  const shortcut = { id: 'shortcut', name: 'Quick Breakfast', mealType: 'breakfast', items: [], createdAt: saved.createdAt } as MealTemplate;

  it('surfaces favourites, recent foods, and meal shortcuts without a search', () => {
    const groups = buildQuickAddGroups({ query: '', savedFoods: [favourite, saved], recentFoods: [food()], recipes: [recipe], templates: [shortcut], starterFoods: [] });
    expect(groups.map((group) => group.key)).toEqual(['favourites', 'recent', 'shortcuts']);
  });

  it('searches and groups all reusable sources by name', () => {
    const groups = buildQuickAddGroups({ query: 'salmon', savedFoods: [favourite, saved], recentFoods: [], recipes: [recipe], templates: [shortcut], starterFoods: [] });
    expect(groups.map((group) => group.key)).toEqual(['saved', 'recipes']);
  });

  it('does not offer a duplicate starter food already present in saved foods', () => {
    const groups = buildQuickAddGroups({ query: 'saved', savedFoods: [saved], recentFoods: [], recipes: [], templates: [], starterFoods: [food({ id: 'starter', name: saved.name, servingSize: saved.servingSize, isStarter: true })] });
    expect(groups.find((group) => group.key === 'starters')).toBeUndefined();
  });

  it('hides poisoned local macros without suppressing a valid remote replacement', () => {
    const poisoned = food({
      id: 'bad-wafer',
      barcode: '999',
      name: 'Musashi wafer',
      servingSize: '40g',
      proteinG: 400,
      fatG: 524,
      totalCarbsG: 388,
    });
    const corrected = food({
      id: 'remote-wafer',
      barcode: '999',
      name: 'Musashi wafer',
      servingSize: '40g',
      proteinG: 10,
      fatG: 13.1,
      totalCarbsG: 9.7,
    });
    const groups = buildQuickAddGroups({
      query: 'musashi',
      savedFoods: [poisoned],
      recentFoods: [poisoned],
      recipes: [],
      templates: [],
      starterFoods: [],
      remoteFoods: [corrected],
    });

    expect(groups.map((group) => group.key)).toEqual(['remote']);
    expect(groups[0].items[0].id).toBe('remote-wafer');
  });
});

describe('favourite and meal shortcut storage defaults', () => {
  beforeEach(() => localStorage.clear());

  it('normalises existing saved foods to not-favourite and preserves favourite exports', () => {
    localStorage.setItem('keto_saved_foods', JSON.stringify([food({ isFavourite: undefined })]));
    migrateIfNeeded();
    expect(loadSavedFoods()[0].isFavourite).toBe(false);
    localStorage.setItem('keto_saved_foods', JSON.stringify([food({ isFavourite: true })]));
    expect(exportAppData().savedFoods[0].isFavourite).toBe(true);
  });

  it('normalises and exports meal shortcut tags', () => {
    localStorage.setItem('keto_meal_templates', JSON.stringify([{ id: 't', name: 'Lunch', mealType: 'lunch', items: [], createdAt: '2026-01-01T00:00:00.000Z' }]));
    expect(loadMealTemplates()[0].mealType).toBe('lunch');
    expect(exportAppData().mealTemplates[0].mealType).toBe('lunch');
  });
});
