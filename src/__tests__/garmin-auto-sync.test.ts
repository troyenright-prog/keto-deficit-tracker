import { describe, expect, it } from 'vitest';
import {
  GARMIN_AUTO_SYNC_INTERVAL_MS,
  hasImportedGarminData,
  shouldRunGarminAutoSync,
} from '../lib/garmin-auto-sync';
import type { DailyActivityEntry, SleepEntry, VitalsEntry, WeightEntry } from '../types';

const importedAt = '2026-07-02T08:00:00.000Z';

describe('Garmin auto sync helpers', () => {
  it('detects existing Garmin-imported data', () => {
    const manualWeight: WeightEntry = {
      id: 'manual-weight',
      date: '2026-07-02',
      weight: 90,
      unit: 'kg',
      loggedAt: importedAt,
    };
    const activity: DailyActivityEntry = {
      id: 'activity',
      date: '2026-07-02',
      steps: 18800,
      source: 'garminHealthConnect',
      importedAt,
    };

    expect(hasImportedGarminData({
      weightEntries: [manualWeight],
      dailyActivity: [],
      sleepEntries: [],
      vitalsEntries: [],
    })).toBe(false);
    expect(hasImportedGarminData({
      weightEntries: [manualWeight],
      dailyActivity: [activity],
      sleepEntries: [],
      vitalsEntries: [],
    })).toBe(true);
  });

  it('requires user, native support, imported data, and an elapsed interval', () => {
    const base = {
      currentUserPresent: true,
      healthConnectSupported: true,
      importedGarminData: true,
      now: 10_000,
      lastAttemptAt: 0,
    };

    expect(shouldRunGarminAutoSync(base)).toBe(true);
    expect(shouldRunGarminAutoSync({ ...base, currentUserPresent: false })).toBe(false);
    expect(shouldRunGarminAutoSync({ ...base, healthConnectSupported: false })).toBe(false);
    expect(shouldRunGarminAutoSync({ ...base, importedGarminData: false })).toBe(false);
    expect(shouldRunGarminAutoSync({
      ...base,
      now: GARMIN_AUTO_SYNC_INTERVAL_MS + 1000,
      lastAttemptAt: 1000,
    })).toBe(true);
    expect(shouldRunGarminAutoSync({
      ...base,
      now: GARMIN_AUTO_SYNC_INTERVAL_MS + 999,
      lastAttemptAt: 1001,
    })).toBe(false);
  });

  it('counts Garmin sleep and vitals data too', () => {
    const sleep: SleepEntry = {
      id: 'sleep',
      date: '2026-07-02',
      startTime: '2026-07-01T22:00:00.000Z',
      endTime: '2026-07-02T06:00:00.000Z',
      totalMinutes: 480,
      source: 'garminHealthConnect',
      importedAt,
    };
    const vitals: VitalsEntry = {
      id: 'vitals',
      date: '2026-07-02',
      restingHeartRate: 58,
      source: 'garminHealthConnect',
      importedAt,
    };

    expect(hasImportedGarminData({
      weightEntries: [],
      dailyActivity: [],
      sleepEntries: [sleep],
      vitalsEntries: [],
    })).toBe(true);
    expect(hasImportedGarminData({
      weightEntries: [],
      dailyActivity: [],
      sleepEntries: [],
      vitalsEntries: [vitals],
    })).toBe(true);
  });
});
