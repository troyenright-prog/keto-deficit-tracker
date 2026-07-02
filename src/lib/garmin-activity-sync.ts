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
