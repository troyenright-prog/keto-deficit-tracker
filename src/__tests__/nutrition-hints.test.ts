import { describe, it, expect } from 'vitest';
import { buildNutritionHints } from '../lib/nutrition-hints';
import { summariseDay } from '../lib/nutrition';
import type { FoodLogEntry, NutritionTargets } from '../types';
import { DEFAULT_TARGETS } from '../lib/storage';

const DATE = '2026-07-05';
const TARGETS: NutritionTargets = { ...DEFAULT_TARGETS, calories: 1800, proteinG: 120, netCarbsG: 20, fatG: 140 };

function makeEntry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: overrides.id ?? Math.random().toString(36),
    date: DATE,
    name: 'Test Food',
    servingSize: '100g',
    servingMultiplier: 1,
    calories: 300,
    proteinG: 30,
    fatG: 20,
    totalCarbsG: 5,
    fibreG: 2,
    sugarAlcoholsG: 0,
    sodiumMg: 300,
    potassiumMg: 300,
    magnesiumMg: 40,
    loggedAt: new Date().toISOString(),
    ...overrides,
  };
}

function hintsFor(entries: FoodLogEntry[], targets: NutritionTargets = TARGETS) {
  const summary = summariseDay(DATE, entries);
  return buildNutritionHints(summary, targets, entries, { age: 30, sex: 'male' });
}

describe('buildNutritionHints', () => {
  it('returns nothing for an empty day', () => {
    expect(hintsFor([])).toHaveLength(0);
  });

  it('flags low potassium with keto food suggestions', () => {
    const hints = hintsFor([makeEntry({ potassiumMg: 100, magnesiumMg: 350, sodiumMg: 2200 })]);
    const hint = hints.find((h) => h.id === 'potassiumMg-low');
    expect(hint).toBeDefined();
    expect(hint!.advice).toMatch(/avocado/);
    expect(hint!.advice).toMatch(/spinach/);
  });

  it('flags low magnesium with a magnesium food suggestion', () => {
    const hints = hintsFor([makeEntry({ magnesiumMg: 40, potassiumMg: 3200, sodiumMg: 2200 })]);
    const hint = hints.find((h) => h.id === 'magnesiumMg-low');
    expect(hint).toBeDefined();
    expect(hint!.advice).toMatch(/pumpkin seeds|almonds|spinach/);
  });

  it('flags low omega-3 with oily fish suggestions', () => {
    const hints = hintsFor([
      makeEntry({ potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200, omega3G: 0.1 }),
    ]);
    const hint = hints.find((h) => h.id === 'omega3G-low');
    expect(hint).toBeDefined();
    expect(hint!.advice).toMatch(/salmon/);
    expect(hint!.advice).toMatch(/sardines|mackerel/);
  });

  it('warns when sodium is already high, without suggesting more electrolytes', () => {
    const hints = hintsFor([
      makeEntry({ sodiumMg: 3200, potassiumMg: 3200, magnesiumMg: 350 }),
    ]);
    const hint = hints.find((h) => h.id === 'sodiumMg-high');
    expect(hint).toBeDefined();
    expect(hint!.advice.toLowerCase()).toMatch(/salty|sodium/);
    expect(hint!.advice.toLowerCase()).not.toMatch(/add.*sodium|electrolyte drink/);
  });

  it('warns about high calcium driven by dairy/halloumi', () => {
    const hints = hintsFor([
      makeEntry({ name: 'Halloumi', calciumMg: 1800, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 }),
    ]);
    const hint = hints.find((h) => h.id === 'calciumMg-high');
    expect(hint).toBeDefined();
    expect(hint!.advice.toLowerCase()).toMatch(/dairy/);
  });

  it('does not warn about high calcium when no dairy/supplement driver is found', () => {
    const hints = hintsFor([
      makeEntry({ name: 'Sardines', calciumMg: 1800, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 }),
    ]);
    expect(hints.find((h) => h.id === 'calciumMg-high')).toBeUndefined();
  });

  it('flags supplement stacking risk for high B6 from a multivitamin', () => {
    const hints = hintsFor([
      makeEntry({ name: "Swisse Men's Multivitamin", calories: 5, proteinG: 0, fatG: 0, totalCarbsG: 0, fibreG: 0, vitaminB6Mg: 20 }),
      makeEntry({ name: 'Halloumi', calciumMg: 1200, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 }),
    ]);
    const hint = hints.find((h) => h.id === 'vitaminB6Mg-high');
    expect(hint).toBeDefined();
    expect(hint!.advice.toLowerCase()).toMatch(/supplement|multivitamin/);
    expect(hint!.advice.toLowerCase()).toMatch(/stack/);
  });

  it('shows a data caveat instead of a false "none" claim when a substantial food is missing micronutrient data', () => {
    // Steak with every macro/electrolyte/micronutrient at or above target,
    // except vitaminB12Mcg, which the food source simply never reported.
    // A missing field here should read as "database gap", not "zero B12".
    const hints = hintsFor([
      makeEntry({
        name: 'Steak', calories: 500, proteinG: 150, fatG: 30, fibreG: 30,
        potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200,
        omega3G: 2, calciumMg: 1000, phosphorusMg: 700, ironMg: 10, zincMg: 11,
        copperMg: 0.9, manganeseMg: 2.3, iodineMcg: 150, seleniumMcg: 55,
        vitaminAMcg: 900, vitaminCMg: 90, vitaminDMcg: 15, vitaminEMg: 15,
        vitaminKMcg: 120, thiaminMg: 1.2, riboflavinMg: 1.3, niacinMg: 16,
        vitaminB6Mg: 1.3, folateMcg: 400,
        // vitaminB12Mcg intentionally omitted
      }),
    ]);
    const hint = hints.find((h) => h.id === 'vitaminB12Mcg-data-caveat');
    expect(hint).toBeDefined();
    expect(hint!.kind).toBe('data-caveat');
    expect(hint!.caveat).toMatch(/incomplete/);
    expect(hints.some((h) => h.id === 'vitaminB12Mcg-low')).toBe(false);
  });

  it('limits hints to at most five, ranked by priority', () => {
    const hints = hintsFor([
      makeEntry({
        potassiumMg: 50, magnesiumMg: 20, sodiumMg: 200, proteinG: 10, fibreG: 1,
        omega3G: 0.05, vitaminCMg: 1, vitaminEMg: 1, folateMcg: 5, thiaminMg: 0.05,
      }),
    ]);
    expect(hints.length).toBeLessThanOrEqual(5);
    expect(hints[0].id).toBe('potassiumMg-low');
  });

  it('does not break existing daily macro aggregation', () => {
    const summary = summariseDay(DATE, [makeEntry({ calories: 500, proteinG: 40 })]);
    expect(summary.calories).toBe(500);
    expect(summary.proteinG).toBe(40);
    expect(summary.entryCount).toBe(1);
  });
});
