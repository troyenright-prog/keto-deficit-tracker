import { describe, it, expect, beforeEach } from 'vitest';
import { exportAppData, validateAppBundle, importAppData, loadSavedFoods } from '../lib/storage';

beforeEach(() => {
  localStorage.clear();
});

describe('validateAppBundle', () => {
  it('accepts a valid bundle shape', () => {
    const bundle = exportAppData();
    expect(validateAppBundle(bundle)).toBe(true);
  });

  it('rejects null', () => {
    expect(validateAppBundle(null)).toBe(false);
  });

  it('rejects a bundle missing required arrays', () => {
    expect(validateAppBundle({ version: 2, exportedAt: '', profile: {}, targets: {} })).toBe(false);
  });

  it('rejects a bundle with wrong type for foodLog', () => {
    const bundle = exportAppData();
    const bad = { ...bundle, foodLog: 'not-an-array' };
    expect(validateAppBundle(bad)).toBe(false);
  });

  it('rejects a bundle with an invalid exportedAt timestamp', () => {
    const bundle = exportAppData();
    expect(validateAppBundle({ ...bundle, exportedAt: 'not-a-date' })).toBe(false);
  });
});

describe('exportAppData / importAppData round-trip', () => {
  it('restores data after import', () => {
    // Write some data
    localStorage.setItem('keto_saved_foods', JSON.stringify([{ id: 'f1', name: 'Test food' }]));
    const bundle = exportAppData();

    // Wipe and reimport
    localStorage.clear();
    importAppData(bundle);

    expect(loadSavedFoods()).toHaveLength(1);
    expect(loadSavedFoods()[0]).toMatchObject({ id: 'f1', name: 'Test food', calories: 0 });
  });

  it('export includes all required keys', () => {
    const bundle = exportAppData();
    expect(bundle).toHaveProperty('version');
    expect(bundle).toHaveProperty('exportedAt');
    expect(bundle).toHaveProperty('profile');
    expect(bundle).toHaveProperty('targets');
    expect(bundle).toHaveProperty('foodLog');
    expect(bundle).toHaveProperty('savedFoods');
    expect(bundle).toHaveProperty('weightEntries');
    expect(bundle).toHaveProperty('dailyActivity');
    expect(bundle).toHaveProperty('mealTemplates');
    expect(bundle).toHaveProperty('recipes');
    expect(bundle).toHaveProperty('shoppingList');
    expect(bundle).toHaveProperty('mealPlan');
  });

  it('exportedAt is a valid ISO string', () => {
    const bundle = exportAppData();
    expect(() => new Date(bundle.exportedAt)).not.toThrow();
    expect(isNaN(new Date(bundle.exportedAt).getTime())).toBe(false);
  });
});
