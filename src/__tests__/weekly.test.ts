import { describe, it, expect } from 'vitest';
import { computeWeeklyStats, sevenDayAvgWeight, last7Days } from '../lib/weekly';
import type { DailyNutritionSummary } from '../types';
import { DEFAULT_TARGETS } from '../lib/storage';

function makeSummary(date: string, overrides: Partial<DailyNutritionSummary> = {}): DailyNutritionSummary {
  return {
    date,
    calories: 1600,
    proteinG: 110,
    fatG: 120,
    totalCarbsG: 18,
    fibreG: 3,
    sugarAlcoholsG: 0,
    netCarbsG: 15,
    sodiumMg: 2000,
    potassiumMg: 3000,
    magnesiumMg: 350,
    entryCount: 3,
    ...overrides,
  };
}

describe('computeWeeklyStats', () => {
  it('returns zeros for empty input', () => {
    const stats = computeWeeklyStats([], DEFAULT_TARGETS);
    expect(stats.daysTracked).toBe(0);
    expect(stats.avgCalories).toBe(0);
  });

  it('ignores days with no entries', () => {
    const summaries = [
      makeSummary('2026-06-14', { entryCount: 0, calories: 0 }),
      makeSummary('2026-06-15', { calories: 1600 }),
    ];
    const stats = computeWeeklyStats(summaries, DEFAULT_TARGETS);
    expect(stats.daysTracked).toBe(1);
    expect(stats.avgCalories).toBe(1600);
  });

  it('calculates correct averages', () => {
    const summaries = [
      makeSummary('2026-06-14', { calories: 1600, proteinG: 100, netCarbsG: 15, fatG: 120 }),
      makeSummary('2026-06-15', { calories: 2000, proteinG: 140, netCarbsG: 18, fatG: 160 }),
    ];
    const stats = computeWeeklyStats(summaries, DEFAULT_TARGETS);
    expect(stats.avgCalories).toBe(1800);
    expect(stats.avgProteinG).toBe(120);
    expect(stats.avgNetCarbsG).toBe(16.5);
    expect(stats.avgFatG).toBe(140);
  });

  it('counts days within calorie target', () => {
    const targets = { ...DEFAULT_TARGETS, calories: 1800 };
    const summaries = [
      makeSummary('2026-06-14', { calories: 1700 }),
      makeSummary('2026-06-15', { calories: 2000 }),
    ];
    const stats = computeWeeklyStats(summaries, targets);
    expect(stats.daysWithinCalorieTarget).toBe(1);
  });

  it('counts days within net carb limit', () => {
    const summaries = [
      makeSummary('2026-06-14', { netCarbsG: 18 }),
      makeSummary('2026-06-15', { netCarbsG: 25 }),
    ];
    const stats = computeWeeklyStats(summaries, DEFAULT_TARGETS);
    expect(stats.daysWithinNetCarbLimit).toBe(1);
    expect(stats.ketoAlignmentPct).toBe(50);
  });
});

describe('sevenDayAvgWeight', () => {
  it('returns null with fewer than 3 entries', () => {
    const entries = [
      { date: '2026-06-19', weight: 80 },
      { date: '2026-06-20', weight: 79.5 },
    ];
    expect(sevenDayAvgWeight(entries, '2026-06-20')).toBeNull();
  });

  it('calculates average over 7 days', () => {
    const entries = [
      { date: '2026-06-14', weight: 80 },
      { date: '2026-06-15', weight: 79.8 },
      { date: '2026-06-16', weight: 79.6 },
      { date: '2026-06-17', weight: 79.4 },
    ];
    const avg = sevenDayAvgWeight(entries, '2026-06-20');
    expect(avg).toBeCloseTo(79.7, 1);
  });

  it('excludes entries outside the 7-day window', () => {
    const entries = [
      { date: '2026-06-10', weight: 85 }, // outside window
      { date: '2026-06-14', weight: 80 },
      { date: '2026-06-15', weight: 79.8 },
      { date: '2026-06-16', weight: 79.6 },
    ];
    const avg = sevenDayAvgWeight(entries, '2026-06-20');
    expect(avg).toBeCloseTo(79.8, 0);
  });
});

describe('last7Days', () => {
  it('returns 7 dates ending on the reference date', () => {
    const days = last7Days('2026-06-20');
    expect(days).toHaveLength(7);
    expect(days[6]).toBe('2026-06-20');
    expect(days[0]).toBe('2026-06-14');
  });
});
