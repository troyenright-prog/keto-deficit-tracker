import type { DailyActivityEntry } from '../types';

export const GARMIN_ACTIVITY_SOURCE = 'garminHealthConnect' as const;
export const GARMIN_ACTIVITY_SOURCE_LABEL = 'Garmin via Health Connect';

export interface RawStepRecord {
  startTime?: string | Date;
  endTime?: string | Date;
  count?: number;
  metadata?: {
    dataOrigin?: string;
  };
}

export interface GarminStepReading {
  date: string;
  steps: number;
}

export interface StepMergeSummary {
  entries: DailyActivityEntry[];
  inserted: number;
  refreshed: number;
  skipped: number;
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

export function isGarminStepRecord(record: RawStepRecord): boolean {
  return record.metadata?.dataOrigin?.toLowerCase().includes('garmin') === true;
}

export function toGarminStepReadings(records: RawStepRecord[]): GarminStepReading[] {
  const totals = new Map<string, number>();
  for (const record of records) {
    if (!isGarminStepRecord(record)) continue;
    const steps = typeof record.count === 'number' && Number.isFinite(record.count) && record.count > 0
      ? Math.round(record.count)
      : 0;
    if (steps <= 0) continue;
    const day = localDay(record.startTime ?? record.endTime);
    if (!day) continue;
    totals.set(day, (totals.get(day) ?? 0) + steps);
  }
  return [...totals.entries()]
    .map(([date, steps]) => ({ date, steps }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeGarminStepReadings(
  entries: DailyActivityEntry[],
  readings: GarminStepReading[],
  importedAt: string,
  makeId: () => string,
): StepMergeSummary {
  let next = entries.slice();
  const tally = { inserted: 0, refreshed: 0, skipped: 0 };

  for (const reading of readings) {
    if (!Number.isFinite(reading.steps) || reading.steps <= 0) {
      tally.skipped += 1;
      continue;
    }
    const idx = next.findIndex((entry) => entry.date === reading.date && entry.source === GARMIN_ACTIVITY_SOURCE);
    const entry: DailyActivityEntry = {
      id: idx >= 0 ? next[idx].id : makeId(),
      date: reading.date,
      steps: Math.round(reading.steps),
      source: GARMIN_ACTIVITY_SOURCE,
      sourceLabel: GARMIN_ACTIVITY_SOURCE_LABEL,
      importedAt,
    };
    if (idx >= 0) {
      next = next.map((item, index) => (index === idx ? entry : item));
      tally.refreshed += 1;
    } else {
      next = [...next, entry];
      tally.inserted += 1;
    }
  }

  return { entries: next, ...tally };
}

export function summarizeStepMerge(summary: StepMergeSummary): string {
  const parts: string[] = [];
  if (summary.inserted) parts.push(`${summary.inserted} step ${summary.inserted === 1 ? 'day' : 'days'} added`);
  if (summary.refreshed) parts.push(`${summary.refreshed} step ${summary.refreshed === 1 ? 'day' : 'days'} updated`);
  return parts.join(', ');
}

// ── Activity extras: calories burned, distance, floors, elevation ──────────
// Health Connect returns each of these as its own record stream (like steps),
// so they're summed per local day the same way and merged into whatever
// DailyActivityEntry the steps merge already produced for that date.

export interface RawEnergyRecord {
  startTime?: string | Date;
  endTime?: string | Date;
  kcal?: number;
  metadata?: { dataOrigin?: string };
}

export interface RawDistanceRecord {
  startTime?: string | Date;
  endTime?: string | Date;
  meters?: number;
  metadata?: { dataOrigin?: string };
}

export interface RawCountRecord {
  startTime?: string | Date;
  endTime?: string | Date;
  count?: number;
  metadata?: { dataOrigin?: string };
}

export interface GarminActivityExtras {
  date: string;
  activeCalories?: number;
  totalCalories?: number;
  distanceMeters?: number;
  floorsClimbed?: number;
  elevationGainedMeters?: number;
}

export interface ActivityExtrasMergeSummary {
  entries: DailyActivityEntry[];
  inserted: number;
  refreshed: number;
  skipped: number;
}

function isGarminOrigin(record: { metadata?: { dataOrigin?: string } }): boolean {
  return record.metadata?.dataOrigin?.toLowerCase().includes('garmin') === true;
}

function sumByDay<T extends { startTime?: string | Date; endTime?: string | Date; metadata?: { dataOrigin?: string } }>(
  records: T[],
  getValue: (record: T) => number | undefined,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const record of records) {
    if (!isGarminOrigin(record)) continue;
    const value = getValue(record);
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
    const day = localDay(record.startTime ?? record.endTime);
    if (!day) continue;
    totals.set(day, (totals.get(day) ?? 0) + value);
  }
  return totals;
}

export function toGarminActivityExtras(input: {
  activeCalories?: RawEnergyRecord[];
  totalCalories?: RawEnergyRecord[];
  distance?: RawDistanceRecord[];
  floors?: RawCountRecord[];
  elevation?: RawDistanceRecord[];
}): GarminActivityExtras[] {
  const activeMap = sumByDay(input.activeCalories ?? [], (r) => r.kcal);
  const totalMap = sumByDay(input.totalCalories ?? [], (r) => r.kcal);
  const distanceMap = sumByDay(input.distance ?? [], (r) => r.meters);
  const floorsMap = sumByDay(input.floors ?? [], (r) => r.count);
  const elevationMap = sumByDay(input.elevation ?? [], (r) => r.meters);

  const dates = new Set([...activeMap.keys(), ...totalMap.keys(), ...distanceMap.keys(), ...floorsMap.keys(), ...elevationMap.keys()]);
  return [...dates].sort().map((date) => ({
    date,
    ...(activeMap.has(date) ? { activeCalories: Math.round(activeMap.get(date) as number) } : {}),
    ...(totalMap.has(date) ? { totalCalories: Math.round(totalMap.get(date) as number) } : {}),
    ...(distanceMap.has(date) ? { distanceMeters: Math.round(distanceMap.get(date) as number) } : {}),
    ...(floorsMap.has(date) ? { floorsClimbed: Math.round(floorsMap.get(date) as number) } : {}),
    ...(elevationMap.has(date) ? { elevationGainedMeters: Math.round(elevationMap.get(date) as number) } : {}),
  }));
}

export function mergeGarminActivityExtras(
  entries: DailyActivityEntry[],
  extras: GarminActivityExtras[],
  importedAt: string,
  makeId: () => string,
): ActivityExtrasMergeSummary {
  let next = entries.slice();
  const tally = { inserted: 0, refreshed: 0, skipped: 0 };

  for (const extra of extras) {
    const { date, ...fields } = extra;
    const hasAnyField = Object.keys(fields).length > 0;
    if (!hasAnyField) {
      tally.skipped += 1;
      continue;
    }
    const idx = next.findIndex((entry) => entry.date === date && entry.source === GARMIN_ACTIVITY_SOURCE);
    if (idx >= 0) {
      next = next.map((item, index) => (index === idx ? { ...item, ...fields, importedAt } : item));
      tally.refreshed += 1;
    } else {
      next = [...next, {
        id: makeId(), date, steps: 0, ...fields,
        source: GARMIN_ACTIVITY_SOURCE, sourceLabel: GARMIN_ACTIVITY_SOURCE_LABEL, importedAt,
      }];
      tally.inserted += 1;
    }
  }

  return { entries: next, ...tally };
}

export function summarizeActivityExtrasMerge(summary: ActivityExtrasMergeSummary): string {
  const parts: string[] = [];
  if (summary.inserted) parts.push(`${summary.inserted} activity ${summary.inserted === 1 ? 'day' : 'days'} added`);
  if (summary.refreshed) parts.push(`${summary.refreshed} activity ${summary.refreshed === 1 ? 'day' : 'days'} updated`);
  return parts.join(', ');
}
