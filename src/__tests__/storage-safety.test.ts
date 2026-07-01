import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  exportAppData, importAppData, loadFoodLog, loadMealTemplates, loadSavedFoods,
  loadTargets, saveFoodLog, saveFoodLogAndMealPlan, validateAppBundle,
} from '../lib/storage';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('storage boundary normalisation', () => {
  it('normalises missing and invalid stored fields without NaN', () => {
    localStorage.setItem('keto_food_log', JSON.stringify([{ id: 'x', date: 'bad', calories: -4, proteinG: null }]));
    const entry = loadFoodLog()[0];
    expect(entry.calories).toBe(0);
    expect(entry.proteinG).toBe(0);
    expect(entry.servingMultiplier).toBe(1);
    expect(Number.isFinite(entry.totalCarbsG)).toBe(true);
  });

  it('turns corrupt-but-valid JSON shapes into safe defaults', () => {
    localStorage.setItem('keto_saved_foods', JSON.stringify({ not: 'an array' }));
    localStorage.setItem('keto_targets', JSON.stringify({ calories: 0, proteinG: 'bad' }));
    localStorage.setItem('keto_meal_templates', JSON.stringify([null, 7]));
    expect(loadSavedFoods()).toEqual([]);
    expect(loadMealTemplates()).toEqual([]);
    expect(loadTargets().calories).toBeGreaterThan(0);
    expect(loadTargets().proteinG).toBeGreaterThan(0);
  });

  it('normalises optional micronutrient targets without requiring every target', () => {
    localStorage.setItem('keto_targets', JSON.stringify({ calories: 1800, proteinG: 120, vitaminCMg: 90, folateMcg: -10 }));
    expect(loadTargets()).toMatchObject({
      vitaminCMg: 90,
      folateMcg: 0,
    });
  });

  it('reports storage write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(saveFoodLog([])).toBe(false);
  });
});

describe('safe backup replacement', () => {
  it('rejects future versions, malformed nested records, and non-finite numbers', () => {
    const bundle = exportAppData();
    expect(validateAppBundle({ ...bundle, version: 999 })).toBe(false);
    expect(validateAppBundle({ ...bundle, foodLog: [null] })).toBe(false);
    expect(validateAppBundle({ ...bundle, targets: { ...bundle.targets, calories: Infinity } })).toBe(false);
  });

  it('normalises missing fields in a supported backup', () => {
    const bundle = exportAppData();
    bundle.savedFoods = [{ id: 'f1', name: 'Egg' } as never];
    expect(importAppData(bundle)).toBe(true);
    expect(loadSavedFoods()[0]).toMatchObject({ id: 'f1', calories: 0, servingSize: '1 serving' });
  });

  it('rolls back an import when a replacement write fails', () => {
    localStorage.setItem('keto_saved_foods', JSON.stringify([{ id: 'old', name: 'Old' }]));
    const bundle = exportAppData();
    bundle.savedFoods = [{ ...loadSavedFoods()[0], id: 'new', name: 'New' }];
    const original = Storage.prototype.setItem;
    let failed = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'keto_recipes' && !failed) { failed = true; throw new DOMException('full', 'QuotaExceededError'); }
      return original.call(this, key, value);
    });
    expect(importAppData(bundle)).toBe(false);
    expect(loadSavedFoods()[0].id).toBe('old');
  });

  it('atomically rolls back planner conversion writes', () => {
    localStorage.setItem('keto_food_log', JSON.stringify([{ id: 'old' }]));
    localStorage.setItem('keto_meal_plan', JSON.stringify([{ id: 'plan-old' }]));
    const original = Storage.prototype.setItem;
    let failed = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'keto_meal_plan' && !failed) { failed = true; throw new DOMException('full', 'QuotaExceededError'); }
      return original.call(this, key, value);
    });
    expect(saveFoodLogAndMealPlan([], [])).toBe(false);
    expect(JSON.parse(localStorage.getItem('keto_food_log')!)[0].id).toBe('old');
    expect(JSON.parse(localStorage.getItem('keto_meal_plan')!)[0].id).toBe('plan-old');
  });
});
