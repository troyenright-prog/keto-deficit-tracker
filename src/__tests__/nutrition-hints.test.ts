import { describe, it, expect } from 'vitest';
import { buildNutritionHints } from '../lib/nutrition-hints';
import { summariseDay } from '../lib/nutrition';
import type { FoodLogEntry, MealPlanEntry, NutritionTargets } from '../types';
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

// Real Swisse Ultivite Men's Multivitamin values from the app's starter foods
// (src/lib/australianFoods.ts) — a zero-calorie tablet that still carries a
// full micronutrient panel.
function swisseMultivitamin(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return makeEntry({
    name: "Swisse Ultivite Men's Multivitamin", servingSize: '1 tablet',
    calories: 0, proteinG: 0, fatG: 0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0,
    sodiumMg: 0, potassiumMg: 4, magnesiumMg: 105,
    calciumMg: 21, ironMg: 3, zincMg: 15, copperMg: 0.058, manganeseMg: 1.2,
    iodineMcg: 50, seleniumMcg: 26, vitaminCMg: 165, vitaminDMcg: 25, vitaminEMg: 24.79,
    thiaminMg: 22.03, riboflavinMg: 30, niacinMg: 25, vitaminB6Mg: 24.68,
    folateMcg: 500, vitaminB12Mcg: 50,
    ...overrides,
  });
}

// A large (~200g) serve of halloumi: salty, calcium-heavy dairy with almost
// no potassium/magnesium/fibre/omega-3, and no micronutrient panel beyond
// what a label typically reports (i.e. most micros left undefined).
function halloumi(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return makeEntry({
    name: 'Halloumi', servingSize: '200g',
    calories: 700, proteinG: 40, fatG: 55, totalCarbsG: 4, fibreG: 0, sugarAlcoholsG: 0,
    sodiumMg: 3200, potassiumMg: 50, magnesiumMg: 20, calciumMg: 1600,
    ...overrides,
  });
}

function hintsFor(entries: FoodLogEntry[], targets: NutritionTargets = TARGETS) {
  const summary = summariseDay(DATE, entries);
  return buildNutritionHints(summary, targets, entries, { age: 30, sex: 'male' });
}

function makePlanEntry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: Math.random().toString(36),
    date: DATE,
    name: 'Ribeye steak',
    type: 'saved-food',
    sourceId: 'food-steak',
    servings: 1,
    calories: 600,
    proteinG: 60,
    fatG: 40,
    totalCarbsG: 0,
    fibreG: 0,
    sugarAlcoholsG: 0,
    netCarbsG: 0,
    sodiumMg: 120,
    potassiumMg: 700,
    magnesiumMg: 50,
    converted: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function hintsWithPlan(entries: FoodLogEntry[], plan: MealPlanEntry[], targets: NutritionTargets = TARGETS) {
  const summary = summariseDay(DATE, entries);
  return buildNutritionHints(summary, targets, entries, { age: 30, sex: 'male' }, new Date(), undefined, plan);
}

function suggestionText(hint: { suggestions: string[] }): string {
  return hint.suggestions.join(' ');
}

describe('buildNutritionHints - low nutrient suggestions', () => {
  it('returns nothing for an empty day', () => {
    expect(hintsFor([])).toHaveLength(0);
  });

  it('flags low potassium with avocado/spinach/mushroom suggestions', () => {
    const hints = hintsFor([makeEntry({ potassiumMg: 100, magnesiumMg: 350, sodiumMg: 2200 })]);
    const hint = hints.find((h) => h.id === 'potassiumMg-low');
    expect(hint).toBeDefined();
    expect(hint!.severity).toBe('low');
    expect(suggestionText(hint!)).toMatch(/avocado/);
    expect(suggestionText(hint!)).toMatch(/spinach/);
    expect(suggestionText(hint!)).toMatch(/mushrooms/);
  });

  it('flags low magnesium with food-first suggestion and an optional supplement note', () => {
    const hints = hintsFor([makeEntry({ magnesiumMg: 40, potassiumMg: 3200, sodiumMg: 2200 })]);
    const hint = hints.find((h) => h.id === 'magnesiumMg-low');
    expect(hint).toBeDefined();
    expect(hint!.suggestions[0]).toMatch(/pumpkin seeds|almonds|spinach/);
    expect(hint!.suggestions[0]).not.toMatch(/glycinate/); // food comes first
    expect(suggestionText(hint!)).toMatch(/magnesium glycinate/); // supplement is a secondary, optional line
    expect(suggestionText(hint!).toLowerCase()).toMatch(/optional|if appropriate/);
  });

  it('flags low omega-3 with oily fish suggestions', () => {
    const hints = hintsFor([
      makeEntry({ potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200, omega3G: 0.1 }),
    ]);
    const hint = hints.find((h) => h.id === 'omega3G-low');
    expect(hint).toBeDefined();
    expect(suggestionText(hint!)).toMatch(/salmon/);
    expect(suggestionText(hint!)).toMatch(/sardines|mackerel/);
  });

  it('flags low fibre with avocado/chia/psyllium/greens suggestions', () => {
    const hints = hintsFor([
      makeEntry({ fibreG: 1, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 }),
    ]);
    const hint = hints.find((h) => h.id === 'fibreG-low');
    expect(hint).toBeDefined();
    expect(suggestionText(hint!)).toMatch(/avocado/);
    expect(suggestionText(hint!)).toMatch(/chia/);
    expect(suggestionText(hint!)).toMatch(/psyllium/);
    expect(suggestionText(hint!)).toMatch(/leafy greens|broccoli/);
  });

  it('flags protein behind target with practical protein foods', () => {
    const hints = hintsFor([makeEntry({ proteinG: 20, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 })]);
    const hint = hints.find((h) => h.id === 'proteinG-low');
    expect(hint).toBeDefined();
    expect(suggestionText(hint!)).toMatch(/chicken|eggs|tuna|salmon|beef/);
  });
});

describe('buildNutritionHints - excess warnings and likely drivers', () => {
  it('warns when sodium is already high without suggesting more electrolytes', () => {
    const hints = hintsFor([
      makeEntry({ sodiumMg: 3200, potassiumMg: 3200, magnesiumMg: 350 }),
    ]);
    const hint = hints.find((h) => h.id === 'sodiumMg-high');
    expect(hint).toBeDefined();
    expect(hint!.severity).toBe('high');
    expect(suggestionText(hint!).toLowerCase()).toMatch(/salty|sodium/);
    expect(suggestionText(hint!).toLowerCase()).not.toMatch(/add.*sodium|electrolyte drink/);
  });

  it('warns about high calcium driven by dairy/halloumi and names the driver', () => {
    const hints = hintsFor([
      makeEntry({ name: 'Halloumi', calciumMg: 1800, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 }),
    ]);
    const hint = hints.find((h) => h.id === 'calciumMg-high');
    expect(hint).toBeDefined();
    expect(suggestionText(hint!).toLowerCase()).toMatch(/dairy/);
    expect(hint!.likelyDrivers).toContain('Halloumi');
  });

  it('does not warn about high calcium when no dairy driver is found', () => {
    const hints = hintsFor([
      makeEntry({ name: 'Sardines', calciumMg: 1800, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 }),
    ]);
    expect(hints.find((h) => h.id === 'calciumMg-high')).toBeUndefined();
  });

  it('flags supplement stacking risk for high B6 from a multivitamin and names it as a likely driver', () => {
    const hints = hintsFor([
      swisseMultivitamin(),
      makeEntry({ name: 'Halloumi', calciumMg: 1200, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 }),
    ]);
    const hint = hints.find((h) => h.id === 'vitaminB6Mg-high');
    expect(hint).toBeDefined();
    expect(suggestionText(hint!).toLowerCase()).toMatch(/supplement|multivitamin/);
    expect(suggestionText(hint!).toLowerCase()).toMatch(/stack/);
    expect(hint!.likelyDrivers.some((d) => d.toLowerCase().includes('multivitamin'))).toBe(true);
  });
});

describe('buildNutritionHints - incomplete data & confidence', () => {
  it('softens wording and adds a caveat instead of a false "none" claim when a substantial food is missing micronutrient data', () => {
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
    const hint = hints.find((h) => h.id === 'vitaminB12Mcg-low');
    expect(hint).toBeDefined();
    expect(hint!.confidence).not.toBe('high');
    expect(hint!.title.toLowerCase()).toMatch(/appears low/);
    expect(hint!.caveat).toMatch(/incomplete/);
  });

  it('does not treat a manual food with no micronutrients logged as a confirmed zero', () => {
    const hints = hintsFor([
      makeEntry({
        name: 'Home-cooked chicken curry', calories: 450, proteinG: 40, fatG: 25, fibreG: 20,
        potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200,
        // No micronutrient fields at all - a typical manual entry.
      }),
    ]);
    // None of the ~20 undefined micronutrients should be reported as a confident "low";
    // every one of them should carry a softened title and a data-incompleteness caveat.
    const microHints = hints.filter((h) => !['proteinG', 'fibreG', 'sodiumMg', 'potassiumMg', 'magnesiumMg', 'meal', 'calories'].includes(h.nutrientKey));
    expect(microHints.length).toBeGreaterThan(0);
    for (const hint of microHints) {
      expect(hint.confidence).not.toBe('high');
      expect(hint.caveat).toMatch(/incomplete/);
      expect(hint.title.toLowerCase()).not.toMatch(/^low /);
    }
  });

  it('keeps full confidence for a well-reported micronutrient', () => {
    const hints = hintsFor([
      makeEntry({ vitaminCMg: 5, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 }),
    ]);
    const hint = hints.find((h) => h.id === 'vitaminCMg-low');
    expect(hint).toBeDefined();
    expect(hint!.confidence).toBe('high');
    expect(hint!.title).toBe('Low vitamin C');
    expect(hint!.caveat).toBeUndefined();
  });
});

describe('buildNutritionHints - ranking', () => {
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

  it('prioritises electrolytes over a supplement/dairy excess when both are present', () => {
    // The full real-world scenario: multivitamin + a lot of halloumi. With
    // 10 competing issues and only 5 slots, electrolytes (this app's stated
    // top keto priority) should win over the calcium/B6 excesses.
    const hints = hintsFor([swisseMultivitamin(), halloumi()]);
    expect(hints.length).toBeLessThanOrEqual(5);
    expect(hints.some((h) => h.id === 'potassiumMg-low')).toBe(true);
    expect(hints.some((h) => h.id === 'magnesiumMg-low')).toBe(true);
    expect(hints.some((h) => h.id === 'sodiumMg-high')).toBe(true);
  });
});

describe('buildNutritionHints - next meal logic', () => {
  it('suggests a protein food plus a pairing food for whatever is still low', () => {
    const hints = hintsFor([
      makeEntry({ calories: 150, proteinG: 15, fatG: 5, totalCarbsG: 0, fibreG: 0, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 }),
    ]);
    const hint = hints.find((h) => h.id === 'next-meal');
    expect(hint).toBeDefined();
    expect(hint!.severity).toBe('nextMeal');
    expect(suggestionText(hint!)).toMatch(/steak|chicken|eggs|fish/i);
    expect(suggestionText(hint!)).toMatch(/avocado|spinach|greens/i);
    expect(suggestionText(hint!)).toMatch(/fibre/i);
  });

  it('does not suggest a next meal when protein is already close to target', () => {
    const hints = hintsFor([
      makeEntry({ calories: 1700, proteinG: 118, fatG: 130, totalCarbsG: 5, fibreG: 20, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 }),
    ]);
    expect(hints.find((h) => h.id === 'next-meal')).toBeUndefined();
  });
});

describe('buildNutritionHints - planned-meal awareness', () => {
  // 20g protein logged vs a 120g target: clearly low, unless the plan says
  // more protein is coming later today.
  const lowProteinDay = () => [
    makeEntry({ proteinG: 20, fibreG: 20, potassiumMg: 3200, magnesiumMg: 350, sodiumMg: 2200 }),
  ];

  it('acknowledges a planned steak instead of warning that protein is low', () => {
    // 70g planned lifts protein out of the low zone without fully closing the
    // gap, so the softened low card shows rather than the next-meal-planned one.
    const hints = hintsWithPlan(lowProteinDay(), [makePlanEntry({ proteinG: 70 })]);
    expect(hints.find((h) => h.id === 'proteinG-low')).toBeUndefined();
    const hint = hints.find((h) => h.id === 'proteinG-low-planned');
    expect(hint).toBeDefined();
    expect(hint!.title).toMatch(/low so far/i);
    expect(hint!.title).toMatch(/plan/i);
    expect(suggestionText(hint!)).toMatch(/Ribeye steak/);
    // Planned food must never be counted as consumed: the reason still shows
    // only the logged amount.
    expect(hint!.reason).toMatch(/Logged: 20 g \/ 120 g/);
  });

  it('shows only the next-meal card, not a duplicate protein card, when the plan fully closes the gap', () => {
    const hints = hintsWithPlan(lowProteinDay(), [makePlanEntry({ proteinG: 100 })]);
    expect(hints.find((h) => h.id === 'next-meal-planned')).toBeDefined();
    expect(hints.find((h) => h.id === 'proteinG-low-planned')).toBeUndefined();
    expect(hints.find((h) => h.id === 'proteinG-low')).toBeUndefined();
  });

  it('still warns normally when the planned food is not enough to close the gap', () => {
    const hints = hintsWithPlan(lowProteinDay(), [makePlanEntry({ proteinG: 5 })]);
    expect(hints.find((h) => h.id === 'proteinG-low-planned')).toBeUndefined();
    expect(hints.find((h) => h.id === 'proteinG-low')).toBeDefined();
  });

  it('ignores plan entries already converted to log entries', () => {
    const hints = hintsWithPlan(lowProteinDay(), [makePlanEntry({ proteinG: 80, converted: true })]);
    expect(hints.find((h) => h.id === 'proteinG-low-planned')).toBeUndefined();
    expect(hints.find((h) => h.id === 'proteinG-low')).toBeDefined();
  });

  it('ignores plan entries for other days', () => {
    const hints = hintsWithPlan(lowProteinDay(), [makePlanEntry({ proteinG: 80, date: '2026-07-06' })]);
    expect(hints.find((h) => h.id === 'proteinG-low-planned')).toBeUndefined();
    expect(hints.find((h) => h.id === 'proteinG-low')).toBeDefined();
  });

  it('behaves exactly as before when no plan is passed', () => {
    const hints = hintsFor(lowProteinDay());
    expect(hints.find((h) => h.id === 'proteinG-low')).toBeDefined();
    expect(hints.find((h) => h.id === 'proteinG-low-planned')).toBeUndefined();
  });

  it('points the next-meal nudge at the plan when planned protein closes the gap', () => {
    const hints = hintsWithPlan(lowProteinDay(), [makePlanEntry({ proteinG: 90 })]);
    expect(hints.find((h) => h.id === 'next-meal')).toBeUndefined();
    const hint = hints.find((h) => h.id === 'next-meal-planned');
    expect(hint).toBeDefined();
    expect(hint!.reason).toMatch(/Ribeye steak/);
    expect(suggestionText(hint!).toLowerCase()).toMatch(/log/);
  });

  it('drops a plan-covered nutrient from the next-meal pairing suggestions', () => {
    // Potassium is low from logged food but fully covered by the planned
    // side of spinach; the next-meal pairing should no longer push potassium.
    const entries = [
      makeEntry({ proteinG: 20, fibreG: 20, potassiumMg: 100, magnesiumMg: 350, sodiumMg: 2200 }),
    ];
    const plan = [makePlanEntry({ name: 'Spinach salad', proteinG: 0, potassiumMg: 3000 })];
    const hints = hintsWithPlan(entries, plan);
    const nextMeal = hints.find((h) => h.id === 'next-meal');
    expect(nextMeal).toBeDefined();
    expect(suggestionText(nextMeal!).toLowerCase()).not.toMatch(/potassium/);
  });
});

describe('buildNutritionHints - keto-aware scenarios', () => {
  it('does not warn about a steak-heavy carnivore day beyond genuinely low nutrients', () => {
    const hints = hintsFor([
      makeEntry({
        name: 'Steak', calories: 900, proteinG: 180, fatG: 60, totalCarbsG: 0, fibreG: 0,
        potassiumMg: 600, magnesiumMg: 40, sodiumMg: 400,
      }),
    ]);
    // Protein target is already met/exceeded, so no next-meal nudge.
    expect(hints.find((h) => h.id === 'next-meal')).toBeUndefined();
    // Fibre and vitamin K are genuinely low on a steak-only day - that's fine to surface.
    expect(hints.some((h) => h.id === 'fibreG-low')).toBe(true);
  });

  it('does not raise false-positive high-severity warnings on a balanced keto day', () => {
    const hints = hintsFor([
      makeEntry({ name: 'Eggs', calories: 220, proteinG: 18, fatG: 16, totalCarbsG: 2, fibreG: 0, potassiumMg: 300, magnesiumMg: 20, sodiumMg: 180 }),
      makeEntry({ name: 'Avocado', calories: 240, proteinG: 3, fatG: 22, totalCarbsG: 12, fibreG: 10, potassiumMg: 975, magnesiumMg: 58, sodiumMg: 14, vitaminKMcg: 42 }),
      makeEntry({ name: 'Salmon', calories: 400, proteinG: 80, fatG: 26, totalCarbsG: 0, fibreG: 0, potassiumMg: 980, magnesiumMg: 58, sodiumMg: 118, omega3G: 4.4 }),
      makeEntry({ name: 'Spinach salad', calories: 60, proteinG: 6, fatG: 1, totalCarbsG: 6, fibreG: 4, potassiumMg: 1116, magnesiumMg: 158, sodiumMg: 158, folateMcg: 466, vitaminKMcg: 966 }),
    ]);
    expect(hints.every((h) => h.severity !== 'high')).toBe(true);
  });
});

describe('buildNutritionHints - existing behaviour preserved', () => {
  it('does not break existing daily macro aggregation', () => {
    const summary = summariseDay(DATE, [makeEntry({ calories: 500, proteinG: 40 })]);
    expect(summary.calories).toBe(500);
    expect(summary.proteinG).toBe(40);
    expect(summary.entryCount).toBe(1);
  });

  it('handles a Swisse-multivitamin-only day without crashing', () => {
    // With literally nothing else logged, potassium/magnesium/protein/fibre
    // being near-zero is the far more useful thing to surface than the B6
    // excess - electrolytes and protein outrank supplement-driven excess in
    // the priority list, so this is expected, not a bug (see the dedicated
    // "high B6" test above for driver-attribution behaviour on a fuller day).
    const hints = hintsFor([swisseMultivitamin()]);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.some((h) => h.id === 'potassiumMg-low')).toBe(true);
    expect(hints.some((h) => h.id === 'magnesiumMg-low')).toBe(true);
  });
});
