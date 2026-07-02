import { describe, expect, it } from 'vitest';
import {
  GARMIN_VITALS_SOURCE,
  mergeGarminVitalsReadings,
  summarizeVitalsMerge,
  toGarminVitalsReadings,
  type RawVitalsReading,
} from '../lib/garmin-vitals-sync';

const importedAt = '2026-07-02T08:00:00.000Z';
let id = 0;
const makeId = () => `vitals-${(id += 1)}`;

function reading(time: string, value: number, origin = 'com.garmin.android.apps.connectmobile'): RawVitalsReading {
  return { time, value, metadata: { dataOrigin: origin } };
}

describe('Garmin vitals sync', () => {
  it('takes the latest Garmin-origin reading per day across each metric stream', () => {
    const readings = toGarminVitalsReadings({
      restingHeartRate: [reading('2026-07-01T01:00:00.000Z', 60), reading('2026-07-01T02:00:00.000Z', 56)],
      hrv: [reading('2026-07-01T01:00:00.000Z', 42)],
      oxygenSaturation: [reading('2026-07-05T01:00:00.000Z', 97, 'com.google.android.apps.fitness')],
    });

    expect(readings).toEqual([{ date: '2026-07-01', restingHeartRate: 56, hrv: 42 }]);
  });

  it('merges dates across metric streams into one reading per day', () => {
    const readings = toGarminVitalsReadings({
      restingHeartRate: [reading('2026-07-01T06:00:00.000Z', 58)],
      vo2Max: [reading('2026-07-01T06:00:00.000Z', 41.3)],
      respiratoryRate: [reading('2026-07-01T06:00:00.000Z', 14)],
    });
    expect(readings).toEqual([{ date: '2026-07-01', restingHeartRate: 58, vo2Max: 41.3, respiratoryRate: 14 }]);
  });

  it('inserts a new day and merges fields into an existing day without clobbering prior fields', () => {
    const inserted = mergeGarminVitalsReadings([], [{ date: '2026-07-01', restingHeartRate: 58 }], importedAt, makeId);
    expect(inserted.inserted).toBe(1);
    expect(inserted.entries[0]).toMatchObject({ date: '2026-07-01', restingHeartRate: 58, source: GARMIN_VITALS_SOURCE });

    const refreshed = mergeGarminVitalsReadings(inserted.entries, [{ date: '2026-07-01', vo2Max: 41 }], '2026-07-03T08:00:00.000Z', makeId);
    expect(refreshed.refreshed).toBe(1);
    expect(refreshed.entries).toHaveLength(1);
    expect(refreshed.entries[0]).toMatchObject({ restingHeartRate: 58, vo2Max: 41 });
  });

  it('skips a reading with no populated fields', () => {
    const result = mergeGarminVitalsReadings([], [{ date: '2026-07-01' }], importedAt, makeId);
    expect(result.skipped).toBe(1);
    expect(result.entries).toHaveLength(0);
  });

  it('summarizes only real vitals changes', () => {
    expect(summarizeVitalsMerge({ entries: [], inserted: 1, refreshed: 1, skipped: 0 })).toBe('1 day added, 1 day updated');
    expect(summarizeVitalsMerge({ entries: [], inserted: 0, refreshed: 0, skipped: 2 })).toBe('');
  });
});
