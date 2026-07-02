import type { DailyActivityEntry, SleepEntry, VitalsEntry, WeightEntry } from '../types';

export const GARMIN_AUTO_SYNC_HISTORY_DAYS = 14;
export const GARMIN_AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const GARMIN_AUTO_SYNC_STARTUP_DELAY_MS = 2500;

export function hasImportedGarminData(input: {
  weightEntries: WeightEntry[];
  dailyActivity: DailyActivityEntry[];
  sleepEntries: SleepEntry[];
  vitalsEntries: VitalsEntry[];
}): boolean {
  return input.weightEntries.some((entry) => entry.source === 'garminHealthConnect')
    || input.dailyActivity.some((entry) => entry.source === 'garminHealthConnect')
    || input.sleepEntries.some((entry) => entry.source === 'garminHealthConnect')
    || input.vitalsEntries.some((entry) => entry.source === 'garminHealthConnect');
}

export function shouldRunGarminAutoSync(input: {
  currentUserPresent: boolean;
  healthConnectSupported: boolean;
  importedGarminData: boolean;
  now: number;
  lastAttemptAt: number;
  intervalMs?: number;
}): boolean {
  if (!input.currentUserPresent || !input.healthConnectSupported || !input.importedGarminData) return false;
  const intervalMs = input.intervalMs ?? GARMIN_AUTO_SYNC_INTERVAL_MS;
  return input.lastAttemptAt <= 0 || input.now - input.lastAttemptAt >= intervalMs;
}
