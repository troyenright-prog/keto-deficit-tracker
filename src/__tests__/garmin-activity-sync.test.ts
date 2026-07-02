import { describe, expect, it } from 'vitest';
import {
  GARMIN_ACTIVITY_SOURCE,
  isGarminStepRecord,
  mergeGarminStepReadings,
  summarizeStepMerge,
  toGarminStepReadings,
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
