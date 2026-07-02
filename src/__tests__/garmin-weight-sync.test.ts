import { describe, expect, it } from 'vitest';
import type { WeightEntry } from '../types';
import {
  GARMIN_SOURCE,
  mergeGarminReadings,
  summarizeMerge,
  toGarminReadings,
} from '../lib/garmin-weight-sync';

const IMPORTED_AT = '2026-07-01T08:00:00.000Z';
let idCounter = 0;
const makeId = () => `id-${(idCounter += 1)}`;

function manual(date: string, weight: number, unit: 'kg' | 'lbs' = 'kg', extra: Partial<WeightEntry> = {}): WeightEntry {
  return { id: `m-${date}`, date, weight, unit, loggedAt: '2026-06-01T00:00:00.000Z', ...extra };
}

describe('toGarminReadings', () => {
  it('keeps the latest reading per day and sorts ascending', () => {
    const readings = toGarminReadings([
      { date: '2026-06-30', kg: 90.7 }, // newest of the day (passed first)
      { date: '2026-06-30', kg: 91.0 },
      { date: '2026-06-28', kg: 91.5 },
    ], 'kg');
    expect(readings.map((r) => [r.date, r.weight])).toEqual([
      ['2026-06-28', 91.5],
      ['2026-06-30', 90.7],
    ]);
  });

  it('converts kilograms to pounds for lbs users and rounds to 0.1', () => {
    const [reading] = toGarminReadings([{ date: '2026-06-30', kg: 90 }], 'lbs');
    expect(reading.weight).toBe(198.4); // 90 * 2.20462 = 198.4158 -> 198.4
  });

  it('drops invalid or non-positive weights and carries body fat', () => {
    const readings = toGarminReadings([
      { date: '2026-06-30', kg: 0 },
      { date: '2026-06-29', kg: Number.NaN },
      { date: '2026-06-28', kg: 88.2, fat: 21.4 },
    ], 'kg');
    expect(readings).toEqual([{ date: '2026-06-28', weight: 88.2, bodyFat: 21.4 }]);
  });

  it('carries lean mass, bone mass, and body water through', () => {
    const [reading] = toGarminReadings([
      { date: '2026-06-30', kg: 88.2, leanKg: 65.1, boneKg: 3.2, waterKg: 48.5 },
    ], 'kg');
    expect(reading).toEqual({ date: '2026-06-30', weight: 88.2, leanBodyMassKg: 65.1, boneMassKg: 3.2, bodyWaterMassKg: 48.5 });
  });
});

describe('mergeGarminReadings', () => {
  it('inserts new Garmin rows tagged with the source', () => {
    const result = mergeGarminReadings([], [
      { date: '2026-06-28', weight: 91.5 },
      { date: '2026-06-30', weight: 90.7, bodyFat: 20.1 },
    ], 'kg', IMPORTED_AT, makeId);
    expect(result.inserted).toBe(2);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[1]).toMatchObject({
      date: '2026-06-30', weight: 90.7, unit: 'kg', bodyFat: 20.1,
      source: GARMIN_SOURCE, sourceLabel: 'Garmin via Health Connect', importedAt: IMPORTED_AT,
    });
  });

  it('never overwrites a manual weight, but fills missing body fat', () => {
    const entries = [manual('2026-06-30', 89.9)];
    const result = mergeGarminReadings(entries, [
      { date: '2026-06-30', weight: 90.7, bodyFat: 20.1 },
    ], 'kg', IMPORTED_AT, makeId);
    expect(result.filled).toBe(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].weight).toBe(89.9); // manual value preserved
    expect(result.entries[0].bodyFat).toBe(20.1); // body fat filled in
    expect(result.entries[0].source).toBeUndefined(); // still manual
  });

  it('preserves a complete manual entry with no changes', () => {
    const entries = [manual('2026-06-30', 89.9, 'kg', { bodyFat: 19 })];
    const result = mergeGarminReadings(entries, [
      { date: '2026-06-30', weight: 90.7, bodyFat: 20.1 },
    ], 'kg', IMPORTED_AT, makeId);
    expect(result.preserved).toBe(1);
    expect(result.entries[0]).toEqual(entries[0]);
  });

  it('refreshes a prior Garmin row in place instead of duplicating', () => {
    const prior = mergeGarminReadings([], [{ date: '2026-06-30', weight: 90.7 }], 'kg', IMPORTED_AT, makeId).entries;
    const result = mergeGarminReadings(prior, [
      { date: '2026-06-30', weight: 90.2, bodyFat: 19.8 },
    ], 'kg', '2026-07-02T08:00:00.000Z', makeId);
    expect(result.refreshed).toBe(1);
    expect(result.entries).toHaveLength(1); // no duplicate
    expect(result.entries[0].weight).toBe(90.2);
    expect(result.entries[0].bodyFat).toBe(19.8);
  });

  it('fills lean mass, bone mass, and body water on a manual entry without touching the manual weight', () => {
    const entries = [manual('2026-06-30', 89.9)];
    const result = mergeGarminReadings(entries, [
      { date: '2026-06-30', weight: 90.7, leanBodyMassKg: 65.1, boneMassKg: 3.2, bodyWaterMassKg: 48.5 },
    ], 'kg', IMPORTED_AT, makeId);
    expect(result.filled).toBe(1);
    expect(result.entries[0]).toMatchObject({ weight: 89.9, leanBodyMassKg: 65.1, boneMassKg: 3.2, bodyWaterMassKg: 48.5 });
  });

  it('does not collide across different units on the same day', () => {
    const entries = [manual('2026-06-30', 198, 'lbs')];
    const result = mergeGarminReadings(entries, [
      { date: '2026-06-30', weight: 90.7 },
    ], 'kg', IMPORTED_AT, makeId);
    expect(result.inserted).toBe(1);
    expect(result.entries).toHaveLength(2);
  });
});

describe('summarizeMerge', () => {
  it('summarises inserts and updates', () => {
    expect(summarizeMerge({ entries: [], inserted: 3, refreshed: 1, filled: 1, preserved: 2, skipped: 0 }))
      .toBe('Synced from Garmin: 3 new entries, 2 updated.');
  });
  it('reports when nothing changed', () => {
    expect(summarizeMerge({ entries: [], inserted: 0, refreshed: 0, filled: 0, preserved: 4, skipped: 0 }))
      .toBe('Already up to date — nothing new from Garmin.');
  });
});
