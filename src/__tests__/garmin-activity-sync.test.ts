import { describe, expect, it } from 'vitest';
import {
  GARMIN_ACTIVITY_SOURCE,
  isGarminStepRecord,
  mergeGarminActivityExtras,
  mergeGarminStepReadings,
  summarizeActivityExtrasMerge,
  summarizeStepMerge,
  toGarminActivityExtras,
  toGarminStepReadings,
  type RawCountRecord,
  type RawDistanceRecord,
  type RawEnergyRecord,
  type RawStepRecord,
} from '../lib/garmin-activity-sync';

const importedAt = '2026-07-02T08:00:00.000Z';
let id = 0;
const makeId = () => `activity-${(id += 1)}`;

function steps(date: string, count: number, origin = 'com.garmin.android.apps.connectmobile'): RawStepRecord {
  return {
    startTime: `${date}T00:00:00.000Z`,
    endTime: `${date}T23:59:00.000Z`,
    count,
    metadata: { dataOrigin: origin },
  };
}

describe('Garmin activity sync', () => {
  it('keeps only Garmin-origin step records and sums them per day', () => {
    const readings = toGarminStepReadings([
      steps('2026-07-01', 3000),
      steps('2026-07-01', 2500),
      steps('2026-07-01', 9000, 'com.google.android.apps.fitness'),
      steps('2026-07-02', 7400),
      steps('2026-07-03', 0),
    ]);

    expect(readings).toEqual([
      { date: '2026-07-01', steps: 5500 },
      { date: '2026-07-02', steps: 7400 },
    ]);
  });

  it('detects Garmin origins by package name text', () => {
    expect(isGarminStepRecord(steps('2026-07-01', 1))).toBe(true);
    expect(isGarminStepRecord(steps('2026-07-01', 1, 'com.google.android.apps.fitness'))).toBe(false);
  });

  it('inserts and refreshes daily activity entries', () => {
    const inserted = mergeGarminStepReadings([], [{ date: '2026-07-01', steps: 5500 }], importedAt, makeId);
    expect(inserted.inserted).toBe(1);
    expect(inserted.entries[0]).toMatchObject({
      date: '2026-07-01',
      steps: 5500,
      source: GARMIN_ACTIVITY_SOURCE,
    });

    const refreshed = mergeGarminStepReadings(inserted.entries, [{ date: '2026-07-01', steps: 6200 }], '2026-07-03T08:00:00.000Z', makeId);
    expect(refreshed.refreshed).toBe(1);
    expect(refreshed.entries).toHaveLength(1);
    expect(refreshed.entries[0]).toMatchObject({ id: inserted.entries[0].id, steps: 6200 });
  });

  it('summarizes only real step changes', () => {
    expect(summarizeStepMerge({ entries: [], inserted: 2, refreshed: 1, skipped: 0 }))
      .toBe('2 step days added, 1 step day updated');
    expect(summarizeStepMerge({ entries: [], inserted: 0, refreshed: 0, skipped: 3 })).toBe('');
  });
});

function energy(date: string, kcal: number, origin = 'com.garmin.android.apps.connectmobile'): RawEnergyRecord {
  return { startTime: `${date}T00:00:00.000Z`, endTime: `${date}T23:59:00.000Z`, kcal, metadata: { dataOrigin: origin } };
}

function distance(date: string, meters: number, origin = 'com.garmin.android.apps.connectmobile'): RawDistanceRecord {
  return { startTime: `${date}T00:00:00.000Z`, endTime: `${date}T23:59:00.000Z`, meters, metadata: { dataOrigin: origin } };
}

function count(date: string, value: number, origin = 'com.garmin.android.apps.connectmobile'): RawCountRecord {
  return { startTime: `${date}T00:00:00.000Z`, endTime: `${date}T23:59:00.000Z`, count: value, metadata: { dataOrigin: origin } };
}

describe('Garmin activity extras sync', () => {
  it('sums each metric per Garmin-origin day and merges dates across metrics', () => {
    const extras = toGarminActivityExtras({
      activeCalories: [energy('2026-07-01', 300), energy('2026-07-01', 150), energy('2026-07-01', 90, 'com.google.android.apps.fitness')],
      totalCalories: [energy('2026-07-01', 2200)],
      distance: [distance('2026-07-02', 5000)],
      floors: [count('2026-07-02', 8)],
    });

    expect(extras).toEqual([
      { date: '2026-07-01', activeCalories: 450, totalCalories: 2200 },
      { date: '2026-07-02', distanceMeters: 5000, floorsClimbed: 8 },
    ]);
  });

  it('inserts a new entry when no steps entry exists for the day, refreshes fields on an existing one', () => {
    const inserted = mergeGarminActivityExtras([], [{ date: '2026-07-01', activeCalories: 450 }], '2026-07-02T08:00:00.000Z', makeId);
    expect(inserted.inserted).toBe(1);
    expect(inserted.entries[0]).toMatchObject({ date: '2026-07-01', steps: 0, activeCalories: 450, source: GARMIN_ACTIVITY_SOURCE });

    const existing = mergeGarminStepReadings([], [{ date: '2026-07-01', steps: 5500 }], '2026-07-01T08:00:00.000Z', makeId).entries;
    const refreshed = mergeGarminActivityExtras(existing, [{ date: '2026-07-01', distanceMeters: 4200 }], '2026-07-03T08:00:00.000Z', makeId);
    expect(refreshed.refreshed).toBe(1);
    expect(refreshed.entries).toHaveLength(1);
    expect(refreshed.entries[0]).toMatchObject({ steps: 5500, distanceMeters: 4200 });
  });

  it('skips a reading with no populated fields', () => {
    const result = mergeGarminActivityExtras([], [{ date: '2026-07-01' }], '2026-07-01T08:00:00.000Z', makeId);
    expect(result.skipped).toBe(1);
    expect(result.entries).toHaveLength(0);
  });

  it('summarizes only real activity-extras changes', () => {
    expect(summarizeActivityExtrasMerge({ entries: [], inserted: 1, refreshed: 2, skipped: 0 }))
      .toBe('1 activity day added, 2 activity days updated');
    expect(summarizeActivityExtrasMerge({ entries: [], inserted: 0, refreshed: 0, skipped: 1 })).toBe('');
  });
});
