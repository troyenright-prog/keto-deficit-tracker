import { describe, expect, it } from 'vitest';
import type { WeightEntry } from '../types';
import { buildWeightTrendChart, toPolylinePoints } from '../lib/weight-trend';

function entry(id: string, date: string, weight: number, bodyFat?: number): WeightEntry {
  return {
    id,
    date,
    weight,
    unit: 'kg',
    bodyFat,
    loggedAt: `${date}T07:00:00.000Z`,
  };
}

describe('buildWeightTrendChart', () => {
  it('builds distinct weight and body-fat series with labels tied to dates', () => {
    const chart = buildWeightTrendChart([
      entry('w3', '2026-07-03', 89.7, 20.1),
      entry('w1', '2026-07-01', 90.4, 21.2),
      entry('w2', '2026-07-02', 90.1),
    ], 'kg');

    expect(chart).not.toBeNull();
    expect(chart!.entries.map((item) => item.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(chart!.weightPoints).toHaveLength(3);
    expect(chart!.bodyFatPoints).toHaveLength(2);
    expect(chart!.bodyFatRange).not.toBeNull();
    expect(toPolylinePoints(chart!.weightPoints)).toMatch(/10\.0,/);
  });

  it('returns null until at least two matching weight entries are available', () => {
    expect(buildWeightTrendChart([entry('w1', '2026-07-01', 90.4)], 'kg')).toBeNull();
    expect(buildWeightTrendChart([{ ...entry('w1', '2026-07-01', 90.4), unit: 'lbs' }], 'kg')).toBeNull();
  });
});
