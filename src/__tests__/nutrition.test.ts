import { describe, it, expect } from 'vitest';
import {
  calcNetCarbs,
  summariseDay,
  remainingCalories,
  proteinProgress,
  carbStatus,
} from '../lib/nutrition';
import type { FoodLogEntry, NutritionTargets } from '../types';
import { DEFAULT_TARGETS } from '../lib/storage';

function makeEntry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: '1',
    date: '2026-06-20',
    name: 'Test Food',
    servingSize: '100g',
    servingMultiplier: 1,
    calories: 200,
    proteinG: 20,
    fatG: 10,
    totalCarbsG: 10,
    fibreG: 3,
    sugarAlcoholsG: 0,
    sodiumMg: 100,
    potassiumMg: 200,
    magnesiumMg: 30,
    loggedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('calcNetCarbs', () => {
  it('subtracts fibre and sugar alcohols from total carbs', () => {
    expect(calcNetCarbs(20, 5, 3)).toBe(12);
  });

  it('never returns below zero', () => {
    expect(calcNetCarbs(5, 8, 2)).toBe(0);
  });

  it('returns zero when all fibre covers carbs exactly', () => {
    expect(calcNetCarbs(10, 10, 0)).toBe(0);
  });

  it('handles zero carbs', () => {
    expect(calcNetCarbs(0, 0, 0)).toBe(0);
  });

  it('handles only sugar alcohols', () => {
    expect(calcNetCarbs(10, 0, 4)).toBe(6);
  });

  it('normalises negative and non-finite inputs to a finite non-negative result', () => {
    expect(calcNetCarbs(Infinity, Number.NaN, -2)).toBe(0);
    expect(calcNetCarbs(-10, 0, 0)).toBe(0);
  });
});

describe('summariseDay', () => {
  it('returns zero summary for no entries', () => {
    const s = summariseDay('2026-06-20', []);
    expect(s.calories).toBe(0);
    expect(s.netCarbsG).toBe(0);
    expect(s.entryCount).toBe(0);
  });

  it('sums multiple entries', () => {
    const entries = [
      makeEntry({ calories: 200, proteinG: 20 }),
      makeEntry({ id: '2', calories: 300, proteinG: 30, totalCarbsG: 8, fibreG: 2, sugarAlcoholsG: 0 }),
    ];
    const s = summariseDay('2026-06-20', entries);
    expect(s.calories).toBe(500);
    expect(s.proteinG).toBe(50);
    expect(s.entryCount).toBe(2);
  });

  it('only includes entries matching the date', () => {
    const entries = [
      makeEntry({ date: '2026-06-19' }),
      makeEntry({ id: '2', date: '2026-06-20' }),
    ];
    const s = summariseDay('2026-06-20', entries);
    expect(s.entryCount).toBe(1);
    expect(s.calories).toBe(200);
  });

  it('calculates net carbs correctly in summary', () => {
    const entries = [makeEntry({ totalCarbsG: 10, fibreG: 3, sugarAlcoholsG: 2 })];
    const s = summariseDay('2026-06-20', entries);
    expect(s.netCarbsG).toBe(5);
  });

  it('clamps net carbs to zero in summary', () => {
    const entries = [makeEntry({ totalCarbsG: 2, fibreG: 5, sugarAlcoholsG: 0 })];
    const s = summariseDay('2026-06-20', entries);
    expect(s.netCarbsG).toBe(0);
  });
});

describe('remainingCalories', () => {
  it('returns positive when under target', () => {
    const s = summariseDay('2026-06-20', [makeEntry({ calories: 400 })]);
    expect(remainingCalories(s, DEFAULT_TARGETS)).toBe(DEFAULT_TARGETS.calories - 400);
  });

  it('returns negative when over target', () => {
    const s = summariseDay('2026-06-20', [makeEntry({ calories: 2500 })]);
    expect(remainingCalories(s, DEFAULT_TARGETS)).toBe(DEFAULT_TARGETS.calories - 2500);
  });
});

describe('proteinProgress', () => {
  it('calculates percentage of protein target', () => {
    const s = summariseDay('2026-06-20', [makeEntry({ proteinG: 60 })]);
    const targets: NutritionTargets = { ...DEFAULT_TARGETS, proteinG: 120 };
    expect(proteinProgress(s, targets)).toBe(50);
  });

  it('caps at 100% when protein exceeds target', () => {
    const s = summariseDay('2026-06-20', [makeEntry({ proteinG: 150 })]);
    const targets: NutritionTargets = { ...DEFAULT_TARGETS, proteinG: 120 };
    expect(proteinProgress(s, targets)).toBe(100);
  });
});

describe('carbStatus', () => {
  it('returns aligned when well under limit', () => {
    const s = summariseDay('2026-06-20', [makeEntry({ totalCarbsG: 5, fibreG: 0, sugarAlcoholsG: 0 })]);
    expect(carbStatus(s, DEFAULT_TARGETS)).toBe('aligned');
  });

  it('returns approaching at 80% of limit', () => {
    const netCarbs = DEFAULT_TARGETS.netCarbsG * 0.85;
    const s = summariseDay('2026-06-20', [
      makeEntry({ totalCarbsG: netCarbs, fibreG: 0, sugarAlcoholsG: 0 }),
    ]);
    expect(carbStatus(s, DEFAULT_TARGETS)).toBe('approaching');
  });

  it('returns exceeded when over limit', () => {
    const s = summariseDay('2026-06-20', [
      makeEntry({ totalCarbsG: DEFAULT_TARGETS.netCarbsG + 5, fibreG: 0, sugarAlcoholsG: 0 }),
    ]);
    expect(carbStatus(s, DEFAULT_TARGETS)).toBe('exceeded');
  });
});
