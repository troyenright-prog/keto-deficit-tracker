import { describe, it, expect } from 'vitest';
import { buildRecommendations } from '../lib/recommendations';
import type { DailyNutritionSummary } from '../types';
import { DEFAULT_TARGETS } from '../lib/storage';

// Fixed strict-keto targets so these tests stay stable regardless of the
// app's default recomposition targets (see DEFAULT_TARGETS in storage.ts).
const DEFAULT_TARGETS_FOR_TESTS = { ...DEFAULT_TARGETS, calories: 1800, proteinG: 120, netCarbsG: 20, fatG: 140 };

function makeSummary(overrides: Partial<DailyNutritionSummary> = {}): DailyNutritionSummary {
  return {
    date: '2026-06-20',
    calories: 1200,
    proteinG: 100,
    fatG: 90,
    totalCarbsG: 15,
    fibreG: 5,
    sugarAlcoholsG: 0,
    netCarbsG: 10,
    sodiumMg: 1800,
    potassiumMg: 2800,
    magnesiumMg: 320,
    entryCount: 3,
    ...overrides,
  };
}

describe('buildRecommendations', () => {
  it('returns on-track message when all within targets', () => {
    const recs = buildRecommendations(makeSummary(), DEFAULT_TARGETS_FOR_TESTS);
    expect(recs.some((r) => r.id === 'on-track')).toBe(true);
  });

  it('warns when carb limit exceeded', () => {
    const s = makeSummary({ netCarbsG: 25 });
    const recs = buildRecommendations(s, DEFAULT_TARGETS_FOR_TESTS);
    expect(recs.some((r) => r.id === 'carbs-exceeded')).toBe(true);
  });

  it('warns when approaching carb limit', () => {
    const s = makeSummary({ netCarbsG: 17 }); // 85% of 20g strict limit
    const recs = buildRecommendations(s, DEFAULT_TARGETS_FOR_TESTS);
    expect(recs.some((r) => r.id === 'carbs-approaching')).toBe(true);
  });

  it('suggests protein when low and calories remain', () => {
    const s = makeSummary({ proteinG: 50, calories: 800 });
    const recs = buildRecommendations(s, DEFAULT_TARGETS_FOR_TESTS, new Date('2026-06-20T12:00:00'));
    expect(recs.some((r) => r.id === 'protein-low')).toBe(true);
  });

  it('warns when intake is very low late in the day', () => {
    const s = makeSummary({ calories: 900, proteinG: 80 });
    const recs = buildRecommendations(s, DEFAULT_TARGETS_FOR_TESTS, new Date('2026-06-20T19:00:00'));
    expect(recs.some((r) => r.id === 'calories-low-late')).toBe(true);
  });

  it('warns when calories exceeded', () => {
    const s = makeSummary({ calories: 2500 });
    const recs = buildRecommendations(s, DEFAULT_TARGETS_FOR_TESTS);
    expect(recs.some((r) => r.id === 'calories-exceeded')).toBe(true);
  });

  it('suggests sodium when very low', () => {
    const s = makeSummary({ sodiumMg: 500 });
    const recs = buildRecommendations(s, DEFAULT_TARGETS_FOR_TESTS);
    expect(recs.some((r) => r.id === 'sodium-low')).toBe(true);
  });

  it('suggests magnesium when very low', () => {
    const s = makeSummary({ magnesiumMg: 50 });
    const recs = buildRecommendations(s, DEFAULT_TARGETS_FOR_TESTS);
    expect(recs.some((r) => r.id === 'magnesium-low')).toBe(true);
  });

  it('returns no recommendations for empty day', () => {
    const s = makeSummary({ entryCount: 0, calories: 0, proteinG: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0, netCarbsG: 0 });
    const recs = buildRecommendations(s, DEFAULT_TARGETS_FOR_TESTS);
    expect(recs).toHaveLength(0);
  });
});
