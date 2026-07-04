import { Capacitor } from '@capacitor/core';
import { HealthConnect, type Energy, type Length, type Mass, type RecordType } from '@kiwi-health/capacitor-health-connect';
import type { RawCountRecord, RawDistanceRecord, RawEnergyRecord, RawStepRecord } from './garmin-activity-sync';
import type { RawWeightReading } from './garmin-weight-sync';
import type { RawSleepSession, RawSleepStage } from './garmin-sleep-sync';
import type { RawVitalsReading } from './garmin-vitals-sync';

// Read-only bridge to Android Health Connect, where Garmin Connect writes body
// weight, body fat, and steps. Everything here is native-Android only; on the web the
// plugin is unavailable and `isHealthConnectSupported()` returns false so the UI
// can hide the sync affordance entirely.
const WEIGHT_READ_TYPES: RecordType[] = ['Weight', 'BodyFat', 'LeanBodyMass', 'BoneMass', 'BodyWaterMass'];
const STEP_READ_TYPES: RecordType[] = ['Steps'];
const ACTIVITY_EXTRAS_READ_TYPES: RecordType[] = ['ActiveCaloriesBurned', 'TotalCaloriesBurned', 'Distance', 'FloorsClimbed', 'ElevationGained'];
const SLEEP_READ_TYPES: RecordType[] = ['SleepSession'];
const VITALS_READ_TYPES: RecordType[] = ['RestingHeartRate', 'HeartRateVariabilityRmssd', 'Vo2Max', 'OxygenSaturation', 'RespiratoryRate'];
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

async function hasReadPermissions(read: RecordType[]): Promise<boolean> {
  try {
    const check = await HealthConnect.checkHealthPermissions({ read, write: [] as RecordType[] });
    return check.hasAllPermissions;
  } catch {
    return false;
  }
}

export const hasWeightPermissions = () => hasReadPermissions(WEIGHT_READ_TYPES);
export const hasStepPermissions = () => hasReadPermissions(STEP_READ_TYPES);
export const hasActivityExtrasPermissions = () => hasReadPermissions(ACTIVITY_EXTRAS_READ_TYPES);
export const hasSleepPermissions = () => hasReadPermissions(SLEEP_READ_TYPES);
export const hasVitalsPermissions = () => hasReadPermissions(VITALS_READ_TYPES);

// Ensure read access to Weight + BodyFat. Returns true when granted; throws a
// user-facing message when the system dialog can't grant it automatically.
export async function ensureWeightPermissions(): Promise<boolean> {
  const request = { read: WEIGHT_READ_TYPES, write: [] as RecordType[] };
  const check = await HealthConnect.checkHealthPermissions(request);
  if (check.hasAllPermissions) return true;
  const granted = await HealthConnect.requestHealthPermissions(request);
  if (granted.grantedPermissions && granted.grantedPermissions.length > 0) return true;
  // Some devices return an empty grant instead of showing the dialog — open the
  // Health Connect settings so the user can grant access manually.
  try { await HealthConnect.openHealthConnectSetting(); } catch { /* best effort */ }
  throw new Error('Grant Health Tracker access in Health Connect → App permissions, then tap Sync again.');
}

export async function ensureStepPermissions(): Promise<boolean> {
  const request = { read: STEP_READ_TYPES, write: [] as RecordType[] };
  const check = await HealthConnect.checkHealthPermissions(request);
  if (check.hasAllPermissions) return true;
  const granted = await HealthConnect.requestHealthPermissions(request);
  if (granted.hasAllPermissions || granted.grantedPermissions?.length) return true;
  try { await HealthConnect.openHealthConnectSetting(); } catch { /* best effort */ }
  throw new Error('Grant Health Tracker access to Steps in Health Connect, then tap Sync again.');
}

// Calories/distance/floors/elevation — requested as one group since they're all
// "activity extras" shown together on the Garmin tab; a device missing one type
// (e.g. no floors sensor) shouldn't block granting the rest.
export async function ensureActivityExtrasPermissions(): Promise<boolean> {
  const request = { read: ACTIVITY_EXTRAS_READ_TYPES, write: [] as RecordType[] };
  const check = await HealthConnect.checkHealthPermissions(request);
  if (check.hasAllPermissions) return true;
  const granted = await HealthConnect.requestHealthPermissions(request);
  if (granted.hasAllPermissions || granted.grantedPermissions?.length) return true;
  try { await HealthConnect.openHealthConnectSetting(); } catch { /* best effort */ }
  throw new Error('Grant Health Tracker access to activity data in Health Connect, then tap Sync again.');
}

export async function ensureSleepPermissions(): Promise<boolean> {
  const request = { read: SLEEP_READ_TYPES, write: [] as RecordType[] };
  const check = await HealthConnect.checkHealthPermissions(request);
  if (check.hasAllPermissions) return true;
  const granted = await HealthConnect.requestHealthPermissions(request);
  if (granted.hasAllPermissions || granted.grantedPermissions?.length) return true;
  try { await HealthConnect.openHealthConnectSetting(); } catch { /* best effort */ }
  throw new Error('Grant Health Tracker access to Sleep in Health Connect, then tap Sync again.');
}

export async function ensureVitalsPermissions(): Promise<boolean> {
  const request = { read: VITALS_READ_TYPES, write: [] as RecordType[] };
  const check = await HealthConnect.checkHealthPermissions(request);
  if (check.hasAllPermissions) return true;
  const granted = await HealthConnect.requestHealthPermissions(request);
  if (granted.hasAllPermissions || granted.grantedPermissions?.length) return true;
  try { await HealthConnect.openHealthConnectSetting(); } catch { /* best effort */ }
  throw new Error('Grant Health Tracker access to vitals in Health Connect, then tap Sync again.');
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

function lengthToMeters(length: Length | undefined): number | null {
  if (!length || !Number.isFinite(length.value)) return null;
  switch (length.unit) {
    case 'meter': return length.value;
    case 'kilometer': return length.value * 1000;
    case 'mile': return length.value * 1609.344;
    case 'inch': return length.value * 0.0254;
    case 'feet': return length.value * 0.3048;
    default: return length.value; // assume meters when the unit is unspecified
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

// Latest value per local day from a mass-record stream (records arrive newest-first).
function massByDay(records: unknown[], getMass: (r: { weight?: Mass; mass?: Mass }) => Mass | undefined): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const record of records as Array<{ time?: string | Date; weight?: Mass; mass?: Mass }>) {
    const day = localDay(record.time);
    const kg = massToKg(getMass(record));
    if (day && kg !== null && kg > 0 && !byDay.has(day)) byDay.set(day, kg);
  }
  return byDay;
}

// Pull the full available weight history (with body fat and body composition
// where present) as raw kilogram readings, newest-first. Caller reduces to
// one-per-day + display unit. Body-composition streams are best-effort — an
// older Garmin scale that only produces weight/body-fat shouldn't fail the sync.
export async function fetchWeightHistory(days = DEFAULT_HISTORY_DAYS): Promise<RawWeightReading[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const [weightRecords, fatRecords, leanRecords, boneRecords, waterRecords] = await Promise.all([
    readAll('Weight', start, end),
    readAll('BodyFat', start, end).catch(() => [] as unknown[]),
    readAll('LeanBodyMass', start, end).catch(() => [] as unknown[]),
    readAll('BoneMass', start, end).catch(() => [] as unknown[]),
    readAll('BodyWaterMass', start, end).catch(() => [] as unknown[]),
  ]);

  // Latest body-fat percentage per local day.
  const fatByDay = new Map<string, number>();
  for (const record of fatRecords as Array<{ time?: string | Date; percentage?: { value?: number } }>) {
    const day = localDay(record.time);
    const pct = record.percentage?.value;
    if (day && Number.isFinite(pct) && !fatByDay.has(day)) fatByDay.set(day, pct as number);
  }
  const leanByDay = massByDay(leanRecords, (r) => r.mass);
  const boneByDay = massByDay(boneRecords, (r) => r.mass);
  const waterByDay = massByDay(waterRecords, (r) => r.mass);

  const readings: RawWeightReading[] = [];
  for (const record of weightRecords as Array<{ time?: string | Date; weight?: Mass }>) {
    const day = localDay(record.time);
    const kg = massToKg(record.weight);
    if (!day || kg === null || kg <= 0) continue;
    const fat = fatByDay.get(day);
    readings.push({
      date: day, kg,
      ...(fat != null ? { fat } : {}),
      ...(leanByDay.has(day) ? { leanKg: leanByDay.get(day) } : {}),
      ...(boneByDay.has(day) ? { boneKg: boneByDay.get(day) } : {}),
      ...(waterByDay.has(day) ? { waterKg: waterByDay.get(day) } : {}),
    });
  }
  return readings;
}

export async function fetchStepHistory(days = DEFAULT_HISTORY_DAYS): Promise<RawStepRecord[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const records = await readAll('Steps', start, end);
  return records as RawStepRecord[];
}

export interface ActivityExtrasHistory {
  activeCalories: RawEnergyRecord[];
  totalCalories: RawEnergyRecord[];
  distance: RawDistanceRecord[];
  floors: RawCountRecord[];
  elevation: RawDistanceRecord[];
}

// Pull calories/distance/floors/elevation in parallel, tolerating any one type
// failing or being unsupported on the user's device (older Garmin watches
// don't all produce every metric).
export async function fetchActivityExtrasHistory(days = DEFAULT_HISTORY_DAYS): Promise<ActivityExtrasHistory> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const [activeCaloriesRaw, totalCaloriesRaw, distanceRaw, floorsRaw, elevationRaw] = await Promise.all([
    readAll('ActiveCaloriesBurned', start, end).catch(() => [] as unknown[]),
    readAll('TotalCaloriesBurned', start, end).catch(() => [] as unknown[]),
    readAll('Distance', start, end).catch(() => [] as unknown[]),
    readAll('FloorsClimbed', start, end).catch(() => [] as unknown[]),
    readAll('ElevationGained', start, end).catch(() => [] as unknown[]),
  ]);

  const toEnergyRecords = (records: unknown[]): RawEnergyRecord[] =>
    (records as Array<{ startTime?: string | Date; endTime?: string | Date; energy?: Energy; metadata?: { dataOrigin?: string } }>)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime, kcal: r.energy?.value, metadata: r.metadata }));

  const toDistanceRecords = (records: unknown[]): RawDistanceRecord[] =>
    (records as Array<{ startTime?: string | Date; endTime?: string | Date; distance?: Length; metadata?: { dataOrigin?: string } }>)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime, meters: lengthToMeters(r.distance) ?? undefined, metadata: r.metadata }));

  const toElevationRecords = (records: unknown[]): RawDistanceRecord[] =>
    (records as Array<{ startTime?: string | Date; endTime?: string | Date; elevation?: Length; metadata?: { dataOrigin?: string } }>)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime, meters: lengthToMeters(r.elevation) ?? undefined, metadata: r.metadata }));

  const toFloorsRecords = (records: unknown[]): RawCountRecord[] =>
    (records as Array<{ startTime?: string | Date; endTime?: string | Date; floors?: number; metadata?: { dataOrigin?: string } }>)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime, count: r.floors, metadata: r.metadata }));

  return {
    activeCalories: toEnergyRecords(activeCaloriesRaw),
    totalCalories: toEnergyRecords(totalCaloriesRaw),
    distance: toDistanceRecords(distanceRaw),
    floors: toFloorsRecords(floorsRaw),
    elevation: toElevationRecords(elevationRaw),
  };
}

export interface VitalsHistory {
  restingHeartRate: RawVitalsReading[];
  hrv: RawVitalsReading[];
  vo2Max: RawVitalsReading[];
  oxygenSaturation: RawVitalsReading[];
  respiratoryRate: RawVitalsReading[];
}

export async function fetchVitalsHistory(days = DEFAULT_HISTORY_DAYS): Promise<VitalsHistory> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const [rhrRaw, hrvRaw, vo2Raw, spo2Raw, respRaw] = await Promise.all([
    readAll('RestingHeartRate', start, end).catch(() => [] as unknown[]),
    readAll('HeartRateVariabilityRmssd', start, end).catch(() => [] as unknown[]),
    readAll('Vo2Max', start, end).catch(() => [] as unknown[]),
    readAll('OxygenSaturation', start, end).catch(() => [] as unknown[]),
    readAll('RespiratoryRate', start, end).catch(() => [] as unknown[]),
  ]);

  const toReadings = (records: unknown[], getValue: (r: Record<string, unknown>) => number | undefined): RawVitalsReading[] =>
    (records as Array<Record<string, unknown> & { time?: string | Date; metadata?: { dataOrigin?: string } }>)
      .map((r) => ({ time: r.time, value: getValue(r), metadata: r.metadata }));

  return {
    restingHeartRate: toReadings(rhrRaw, (r) => r.beatsPerMinute as number | undefined),
    hrv: toReadings(hrvRaw, (r) => r.heartRateVariabilityMillis as number | undefined),
    vo2Max: toReadings(vo2Raw, (r) => r.vo2MillilitersPerMinuteKilogram as number | undefined),
    oxygenSaturation: toReadings(spo2Raw, (r) => (r.percentage as { value?: number } | undefined)?.value),
    respiratoryRate: toReadings(respRaw, (r) => r.rate as number | undefined),
  };
}

export async function fetchSleepHistory(days = DEFAULT_HISTORY_DAYS): Promise<RawSleepSession[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const records = await readAll('SleepSession', start, end);
  return (records as Array<{
    startTime?: string | Date; endTime?: string | Date;
    stages?: Array<{ startTime?: string | Date; endTime?: string | Date; stage?: number }>;
    metadata?: { dataOrigin?: string };
  }>).map((r) => ({
    startTime: r.startTime, endTime: r.endTime, metadata: r.metadata,
    stages: r.stages as RawSleepStage[] | undefined,
  }));
}
