import { describe, expect, it } from 'vitest';
import {
  GARMIN_SLEEP_SOURCE,
  mergeGarminSleepReadings,
  summarizeSleepMerge,
  toGarminSleepReadings,
  type RawSleepSession,
} from '../lib/garmin-sleep-sync';

const importedAt = '2026-07-02T08:00:00.000Z';
let id = 0;
const makeId = () => `sleep-${(id += 1)}`;

function session(
  start: string,
  end: string,
  origin = 'com.garmin.android.apps.connectmobile',
  stages?: { start: string; end: string; stage: number }[],
): RawSleepSession {
  return {
    startTime: start,
    endTime: end,
    metadata: { dataOrigin: origin },
    ...(stages ? { stages: stages.map((s) => ({ startTime: s.start, endTime: s.end, stage: s.stage })) } : {}),
  };
}

describe('Garmin sleep sync', () => {
  it('buckets a session that spans midnight by its wake (end) date', () => {
    const readings = toGarminSleepReadings([
      session('2026-07-01T22:52:00.000Z', '2026-07-02T06:04:00.000Z'),
    ]);
    expect(readings).toEqual([
      { date: '2026-07-02', startTime: '2026-07-01T22:52:00.000Z', endTime: '2026-07-02T06:04:00.000Z', totalMinutes: 432, stages: undefined },
    ]);
  });

  it('keeps only Garmin-origin sessions', () => {
    const readings = toGarminSleepReadings([
      session('2026-07-01T22:00:00.000Z', '2026-07-02T06:00:00.000Z', 'com.google.android.apps.fitness'),
    ]);
    expect(readings).toEqual([]);
  });

  it('picks the longest session per wake date when there are multiple (e.g. a nap)', () => {
    const readings = toGarminSleepReadings([
      session('2026-07-02T13:00:00.000Z', '2026-07-02T13:30:00.000Z'), // 30 min nap, same wake date
      session('2026-07-01T22:00:00.000Z', '2026-07-02T06:00:00.000Z'), // 8h main sleep
    ]);
    expect(readings).toHaveLength(1);
    expect(readings[0].totalMinutes).toBe(480);
  });

  it('maps Health Connect stage codes into named stages', () => {
    const readings = toGarminSleepReadings([
      session('2026-07-01T22:00:00.000Z', '2026-07-02T06:00:00.000Z', 'garmin', [
        { start: '2026-07-01T22:00:00.000Z', end: '2026-07-01T22:15:00.000Z', stage: 1 },
        { start: '2026-07-01T22:15:00.000Z', end: '2026-07-02T00:00:00.000Z', stage: 4 },
        { start: '2026-07-02T00:00:00.000Z', end: '2026-07-02T02:00:00.000Z', stage: 5 },
        { start: '2026-07-02T02:00:00.000Z', end: '2026-07-02T06:00:00.000Z', stage: 6 },
      ]),
    ]);
    expect(readings[0].stages).toEqual([
      { stage: 'awake', startTime: '2026-07-01T22:00:00.000Z', endTime: '2026-07-01T22:15:00.000Z' },
      { stage: 'light', startTime: '2026-07-01T22:15:00.000Z', endTime: '2026-07-02T00:00:00.000Z' },
      { stage: 'deep', startTime: '2026-07-02T00:00:00.000Z', endTime: '2026-07-02T02:00:00.000Z' },
      { stage: 'rem', startTime: '2026-07-02T02:00:00.000Z', endTime: '2026-07-02T06:00:00.000Z' },
    ]);
  });

  it('inserts and refreshes sleep entries', () => {
    const inserted = mergeGarminSleepReadings([], [{ date: '2026-07-02', startTime: '2026-07-01T22:00:00.000Z', endTime: '2026-07-02T06:00:00.000Z', totalMinutes: 480 }], importedAt, makeId);
    expect(inserted.inserted).toBe(1);
    expect(inserted.entries[0]).toMatchObject({ date: '2026-07-02', totalMinutes: 480, source: GARMIN_SLEEP_SOURCE });

    const refreshed = mergeGarminSleepReadings(inserted.entries, [{ date: '2026-07-02', startTime: '2026-07-01T22:30:00.000Z', endTime: '2026-07-02T06:12:00.000Z', totalMinutes: 462 }], '2026-07-03T08:00:00.000Z', makeId);
    expect(refreshed.refreshed).toBe(1);
    expect(refreshed.entries).toHaveLength(1);
    expect(refreshed.entries[0]).toMatchObject({ id: inserted.entries[0].id, totalMinutes: 462 });
  });

  it('skips a reading with no positive duration', () => {
    const result = mergeGarminSleepReadings([], [{ date: '2026-07-02', startTime: 'x', endTime: 'x', totalMinutes: 0 }], importedAt, makeId);
    expect(result.skipped).toBe(1);
    expect(result.entries).toHaveLength(0);
  });

  it('summarizes only real sleep changes', () => {
    expect(summarizeSleepMerge({ entries: [], inserted: 1, refreshed: 2, skipped: 0 })).toBe('1 night added, 2 nights updated');
    expect(summarizeSleepMerge({ entries: [], inserted: 0, refreshed: 0, skipped: 1 })).toBe('');
  });
});
