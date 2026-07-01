import type { WeightEntry } from '../types';

// Read-only "Garmin via Health Connect" weight import. These are pure functions
// (no DOM, no plugin, no storage) so the merge rules can be unit-tested. The
// golden rules, ported from the LiFT app's health sync:
//   - never silently overwrite a manual entry's weight
//   - re-importing the same day refreshes a prior Garmin row instead of duplicating it
//   - a missing metric is tolerated (partial import), never fails the whole sync
export const GARMIN_SOURCE = 'garminHealthConnect' as const;
export const GARMIN_SOURCE_LABEL = 'Garmin via Health Connect';
const KG_TO_LB = 2.20462;

// A raw Health Connect reading: weight is always in kilograms (HC's unit).
export interface RawWeightReading {
  date: string; // YYYY-MM-DD (local day of the reading)
  kg: number;
  fat?: number; // body-fat percentage
}

// A reading normalised to the user's display unit, ready to merge.
export interface GarminWeightReading {
  date: string;
  weight: number; // in `unit`
  bodyFat?: number;
}

export type MergeOutcome = 'inserted' | 'refreshed' | 'filled' | 'preserved' | 'skipped';

export interface MergeSummary {
  entries: WeightEntry[];
  inserted: number;
  refreshed: number;
  filled: number;
  preserved: number;
  skipped: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Reduce raw readings to one per calendar day (newest wins) and convert to the
// target unit. Callers pass readings newest-first, so the first seen per date is
// the latest reading of that day.
export function toGarminReadings(raw: RawWeightReading[], unit: 'kg' | 'lbs'): GarminWeightReading[] {
  const byDate = new Map<string, RawWeightReading>();
  for (const reading of raw) {
    if (!reading || typeof reading.date !== 'string' || !Number.isFinite(reading.kg) || reading.kg <= 0) continue;
    if (!byDate.has(reading.date)) byDate.set(reading.date, reading);
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((reading) => ({
      date: reading.date,
      weight: round1(unit === 'lbs' ? reading.kg * KG_TO_LB : reading.kg),
      ...(Number.isFinite(reading.fat) && (reading.fat as number) > 0 ? { bodyFat: round1(reading.fat as number) } : {}),
    }));
}

// A row counts as manual unless it was written by a Garmin/Health Connect import.
function isManualEntry(entry: WeightEntry): boolean {
  return entry.source !== GARMIN_SOURCE;
}

function mergeOne(
  entries: WeightEntry[],
  reading: GarminWeightReading,
  unit: 'kg' | 'lbs',
  importedAt: string,
  makeId: () => string,
): { entries: WeightEntry[]; outcome: MergeOutcome } {
  if (!Number.isFinite(reading.weight) || reading.weight <= 0) {
    return { entries, outcome: 'skipped' };
  }
  // Match an existing row for the same calendar day AND unit. The Weight screen
  // groups entries by unit, so conflicts only matter within a single unit.
  const idx = entries.findIndex((entry) => entry.date === reading.date && entry.unit === unit);

  if (idx < 0) {
    const entry: WeightEntry = {
      id: makeId(),
      date: reading.date,
      weight: reading.weight,
      unit,
      loggedAt: importedAt,
      source: GARMIN_SOURCE,
      sourceLabel: GARMIN_SOURCE_LABEL,
      importedAt,
      ...(reading.bodyFat != null ? { bodyFat: reading.bodyFat } : {}),
    };
    return { entries: [...entries, entry], outcome: 'inserted' };
  }

  const existing = entries[idx];
  if (isManualEntry(existing)) {
    // Manual weight stays primary. Only fill a body-fat reading the user hasn't entered.
    if (reading.bodyFat != null && existing.bodyFat == null) {
      const updated: WeightEntry = { ...existing, bodyFat: reading.bodyFat, importedAt };
      return { entries: entries.map((entry, i) => (i === idx ? updated : entry)), outcome: 'filled' };
    }
    return { entries, outcome: 'preserved' };
  }

  // Previous Garmin import for this date+unit — safe to refresh in place.
  const updated: WeightEntry = {
    ...existing,
    weight: reading.weight,
    loggedAt: importedAt,
    source: GARMIN_SOURCE,
    sourceLabel: GARMIN_SOURCE_LABEL,
    importedAt,
    ...(reading.bodyFat != null ? { bodyFat: reading.bodyFat } : {}),
  };
  return { entries: entries.map((entry, i) => (i === idx ? updated : entry)), outcome: 'refreshed' };
}

// Merge a batch of readings (full history) into the weight log.
export function mergeGarminReadings(
  entries: WeightEntry[],
  readings: GarminWeightReading[],
  unit: 'kg' | 'lbs',
  importedAt: string,
  makeId: () => string,
): MergeSummary {
  let acc = entries.slice();
  const tally = { inserted: 0, refreshed: 0, filled: 0, preserved: 0, skipped: 0 };
  for (const reading of readings) {
    const result = mergeOne(acc, reading, unit, importedAt, makeId);
    acc = result.entries;
    tally[result.outcome] += 1;
  }
  return { entries: acc, ...tally };
}

// Human-readable result line for a toast/status.
export function summarizeMerge(summary: MergeSummary): string {
  const added = summary.inserted;
  const updated = summary.refreshed + summary.filled;
  const parts: string[] = [];
  if (added) parts.push(`${added} new ${added === 1 ? 'entry' : 'entries'}`);
  if (updated) parts.push(`${updated} updated`);
  if (!parts.length) return 'Already up to date — nothing new from Garmin.';
  return `Synced from Garmin: ${parts.join(', ')}.`;
}
