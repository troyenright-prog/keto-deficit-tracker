import type { SleepEntry, SleepStage, SleepStageSegment } from '../types';

// Read-only "Garmin via Health Connect" sleep import. Sleep is always
// Garmin-sourced (no manual sleep entry in this app), so unlike weight there's
// no manual-preserve rule — re-importing a night simply refreshes it in place.
export const GARMIN_SLEEP_SOURCE = 'garminHealthConnect' as const;
export const GARMIN_SLEEP_SOURCE_LABEL = 'Garmin via Health Connect';

// Health Connect's SleepSessionRecord.Stage constants.
const STAGE_TYPE: Record<number, SleepStage> = {
  1: 'awake',
  2: 'unknown', // generic "sleeping", no stage detail
  3: 'unknown', // out of bed
  4: 'light',
  5: 'deep',
  6: 'rem',
  7: 'awake', // awake in bed
};

export interface RawSleepStage {
  startTime?: string | Date;
  endTime?: string | Date;
  stage?: number;
}

export interface RawSleepSession {
  startTime?: string | Date;
  endTime?: string | Date;
  stages?: RawSleepStage[];
  metadata?: { dataOrigin?: string };
}

export interface GarminSleepReading {
  date: string; // wake date — the day the session ends
  startTime: string;
  endTime: string;
  totalMinutes: number;
  stages?: SleepStageSegment[];
}

export interface SleepMergeSummary {
  entries: SleepEntry[];
  inserted: number;
  refreshed: number;
  skipped: number;
}

function isGarminOrigin(record: { metadata?: { dataOrigin?: string } }): boolean {
  return record.metadata?.dataOrigin?.toLowerCase().includes('garmin') === true;
}

function toIso(time: string | Date | undefined): string | null {
  if (time == null) return null;
  const d = time instanceof Date ? time : new Date(time);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Bucket a session by wake date (the day it ends) since sessions typically span
// midnight — a session starting 10:52pm and ending 6:04am the next morning is
// "last night's sleep" for that following day.
function wakeDate(endTime: string): string {
  const d = new Date(endTime);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toStageSegments(stages: RawSleepStage[] | undefined): SleepStageSegment[] | undefined {
  if (!stages || stages.length === 0) return undefined;
  const segments: SleepStageSegment[] = [];
  for (const stage of stages) {
    const start = toIso(stage.startTime);
    const end = toIso(stage.endTime);
    if (!start || !end) continue;
    segments.push({ stage: STAGE_TYPE[stage.stage ?? 0] ?? 'unknown', startTime: start, endTime: end });
  }
  return segments.length > 0 ? segments : undefined;
}

// Reduce raw sessions to one per wake date (longest session wins — naps or
// short daytime sessions on the same day shouldn't override the main night).
export function toGarminSleepReadings(records: RawSleepSession[]): GarminSleepReading[] {
  const byDate = new Map<string, GarminSleepReading>();
  for (const record of records) {
    if (!isGarminOrigin(record)) continue;
    const startIso = toIso(record.startTime);
    const endIso = toIso(record.endTime);
    if (!startIso || !endIso) continue;
    const totalMinutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
    if (totalMinutes <= 0) continue;
    const date = wakeDate(endIso);
    const existing = byDate.get(date);
    if (existing && existing.totalMinutes >= totalMinutes) continue;
    byDate.set(date, { date, startTime: startIso, endTime: endIso, totalMinutes, stages: toStageSegments(record.stages) });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeGarminSleepReadings(
  entries: SleepEntry[],
  readings: GarminSleepReading[],
  importedAt: string,
  makeId: () => string,
): SleepMergeSummary {
  let next = entries.slice();
  const tally = { inserted: 0, refreshed: 0, skipped: 0 };

  for (const reading of readings) {
    if (!Number.isFinite(reading.totalMinutes) || reading.totalMinutes <= 0) {
      tally.skipped += 1;
      continue;
    }
    const idx = next.findIndex((entry) => entry.date === reading.date && entry.source === GARMIN_SLEEP_SOURCE);
    const entry: SleepEntry = {
      id: idx >= 0 ? next[idx].id : makeId(),
      date: reading.date,
      startTime: reading.startTime,
      endTime: reading.endTime,
      totalMinutes: reading.totalMinutes,
      ...(reading.stages ? { stages: reading.stages } : {}),
      source: GARMIN_SLEEP_SOURCE,
      sourceLabel: GARMIN_SLEEP_SOURCE_LABEL,
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

export function summarizeSleepMerge(summary: SleepMergeSummary): string {
  const parts: string[] = [];
  if (summary.inserted) parts.push(`${summary.inserted} ${summary.inserted === 1 ? 'night' : 'nights'} added`);
  if (summary.refreshed) parts.push(`${summary.refreshed} ${summary.refreshed === 1 ? 'night' : 'nights'} updated`);
  return parts.join(', ');
}
