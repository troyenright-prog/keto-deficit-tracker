import { describe, it, expect, beforeEach } from 'vitest';
import { migrateIfNeeded, loadMealTemplates, loadRecipes, loadShoppingList, loadMealPlan } from '../lib/storage';

// jsdom provides localStorage; reset between tests
beforeEach(() => {
  localStorage.clear();
});

describe('migrateIfNeeded', () => {
  it('initialises empty arrays for new entities when no version key exists', () => {
    migrateIfNeeded();
    expect(loadMealTemplates()).toEqual([]);
    expect(loadRecipes()).toEqual([]);
    expect(loadShoppingList()).toEqual([]);
    expect(loadMealPlan()).toEqual([]);
  });

  it('sets the version key after migration', () => {
    migrateIfNeeded();
    const v = localStorage.getItem('keto_version');
    expect(v).not.toBeNull();
    expect(JSON.parse(v!)).toBeGreaterThanOrEqual(2);
  });

  it('does not overwrite existing data on re-run', () => {
    migrateIfNeeded();
    // Simulate data written after first migration
    localStorage.setItem('keto_meal_templates', JSON.stringify([{ id: 'x' }]));
    migrateIfNeeded(); // second run — should be a no-op
    expect(loadMealTemplates()).toEqual([{ id: 'x' }]);
  });
});
