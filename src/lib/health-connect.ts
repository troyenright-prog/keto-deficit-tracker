import { Capacitor } from '@capacitor/core';
import { HealthConnect, type Mass, type RecordType } from '@kiwi-health/capacitor-health-connect';
import type { RawWeightReading } from './garmin-weight-sync';

// Read-only bridge to Android Health Connect, where Garmin Connect writes body
// weight and body fat. Everything here is native-Android only; on the web the
// plugin is unavailable and `isHealthConnectSupported()` returns false so the UI
// can hide the sync affordance entirely.
const READ_TYPES: RecordType[] = ['Weight', 'BodyFat'];
const DEFAULT_HISTORY_DAYS = 730;
const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // safety bound for the pagination loop

export function isHealthConnectSupported(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('HealthConnect');
  } catch {
    return false;
  }
}

export async function healthConnectAvailable(): Promise<boolean> {
  try {
    const { availability } = await HealthConnect.checkAvailability();
    return availability === 'Available';
  } catch {
    return false;
  }
}

// Ensure read access to Weight + BodyFat. Returns true when granted; throws a
// user-facing message when the system dialog can't grant it automatically.
export async function ensureWeightPermissions(): Promise<boolean> {
  const request = { read: READ_TYPES, write: [] as RecordType[] };
  const check = await HealthConnect.checkHealthPermissions(request);
  if (check.hasAllPermissions) return true;
  const granted = await HealthConnect.requestHealthPermissions(request);
  if (granted.grantedPermissions && granted.grantedPermissions.length > 0) return true;
  // Some devices return an empty grant instead of showing the dialog — open the
  // Health Connect settings so the user can grant access manually.
  try { await HealthConnect.openHealthConnectSetting(); } catch { /* best effort */ }
  throw new Error('Grant Keto Tracker access in Health Connect → App permissions, then tap Sync again.');
}

function massToKg(mass: Mass | undefined): number | null {
  if (!mass || !Number.isFinite(mass.value)) return null;
  switch (mass.unit) {
    case 'kilogram': return mass.value;
    case 'gram': return mass.value / 1000;
    case 'milligram': return mass.value / 1_000_000;
    case 'microgram': return mass.value / 1_000_000_000;
    case 'ounce': return mass.value * 0.0283495;
    case 'pound': return mass.value * 0.453592;
    default: return mass.value; // assume kilograms when the unit is unspecified
  }
}

function localDay(time: string | Date | undefined): string {
  if (time == null) return '';
  const d = time instanceof Date ? time : new Date(time);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Read every record of a type in [start, end], following pagination.
async function readAll(type: RecordType, start: Date, end: Date): Promise<unknown[]> {
  const out: unknown[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await HealthConnect.readRecords({
      type,
      timeRangeFilter: { type: 'between', startTime: start, endTime: end },
      ascendingOrder: false, // newest first
      pageSize: PAGE_SIZE,
      ...(pageToken ? { pageToken } : {}),
    });
    if (result.records?.length) out.push(...result.records);
    if (!result.pageToken) break;
    pageToken = result.pageToken;
  }
  return out;
}

// Pull the full available weight history (with body fat where present) as raw
// kilogram readings, newest-first. Caller reduces to one-per-day + display unit.
export async function fetchWeightHistory(days = DEFAULT_HISTORY_DAYS): Promise<RawWeightReading[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const [weightRecords, fatRecords] = await Promise.all([
    readAll('Weight', start, end),
    readAll('BodyFat', start, end).catch(() => [] as unknown[]),
  ]);

  // Latest body-fat percentage per local day (records arrive newest-first).
  const fatByDay = new Map<string, number>();
  for (const record of fatRecords as Array<{ time?: string | Date; percentage?: { value?: number } }>) {
    const day = localDay(record.time);
    const pct = record.percentage?.value;
    if (day && Number.isFinite(pct) && !fatByDay.has(day)) fatByDay.set(day, pct as number);
  }

  const readings: RawWeightReading[] = [];
  for (const record of weightRecords as Array<{ time?: string | Date; weight?: Mass }>) {
    const day = localDay(record.time);
    const kg = massToKg(record.weight);
    if (!day || kg === null || kg <= 0) continue;
    const fat = fatByDay.get(day);
    readings.push({ date: day, kg, ...(fat != null ? { fat } : {}) });
  }
  return readings;
}
