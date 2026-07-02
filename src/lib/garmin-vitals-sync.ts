import type { VitalsEntry } from '../types';

// Read-only "Garmin via Health Connect" vitals import: resting heart rate,
// HRV, VO2 max, SpO2, respiratory rate. Each is its own Health Connect record
// stream and independently optional — an older Garmin watch might produce
// resting heart rate but not VO2 max, and that's fine.
export const GARMIN_VITALS_SOURCE = 'garminHealthConnect' as const;
export const GARMIN_VITALS_SOURCE_LABEL = 'Garmin via Health Connect';

export interface RawVitalsReading {
  time?: string | Date;
  value?: number;
  metadata?: { dataOrigin?: string };
}

export interface GarminVitalsReading {
  date: string;
  restingHeartRate?: number;
  hrv?: number;
  vo2Max?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
}

export interface VitalsMergeSummary {
  entries: VitalsEntry[];
  inserted: number;
  refreshed: number;
  skipped: number;
}

function isGarminOrigin(record: { metadata?: { dataOrigin?: string } }): boolean {
  return record.metadata?.dataOrigin?.toLowerCase().includes('garmin') === true;
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

// Latest Garmin-origin reading per local day (point-in-time metrics take the
// most recent value of the day, unlike activity sums).
function latestByDay(records: RawVitalsReading[]): Map<string, { value: number; time: string }> {
  const byDay = new Map<string, { value: number; time: string }>();
  for (const record of records) {
    if (!isGarminOrigin(record)) continue;
    if (typeof record.value !== 'number' || !Number.isFinite(record.value) || record.value <= 0) continue;
    const day = localDay(record.time);
    if (!day) continue;
    const timeIso = new Date(record.time as string | Date).toISOString();
    const existing = byDay.get(day);
    if (!existing || timeIso > existing.time) byDay.set(day, { value: record.value, time: timeIso });
  }
  return byDay;
}

export function toGarminVitalsReadings(input: {
  restingHeartRate?: RawVitalsReading[];
  hrv?: RawVitalsReading[];
  vo2Max?: RawVitalsReading[];
  oxygenSaturation?: RawVitalsReading[];
  respiratoryRate?: RawVitalsReading[];
}): GarminVitalsReading[] {
  const rhrMap = latestByDay(input.restingHeartRate ?? []);
  const hrvMap = latestByDay(input.hrv ?? []);
  const vo2Map = latestByDay(input.vo2Max ?? []);
  const spo2Map = latestByDay(input.oxygenSaturation ?? []);
  const respMap = latestByDay(input.respiratoryRate ?? []);

  const dates = new Set([...rhrMap.keys(), ...hrvMap.keys(), ...vo2Map.keys(), ...spo2Map.keys(), ...respMap.keys()]);
  return [...dates].sort().map((date) => ({
    date,
    ...(rhrMap.has(date) ? { restingHeartRate: Math.round(rhrMap.get(date)!.value) } : {}),
    ...(hrvMap.has(date) ? { hrv: Math.round(hrvMap.get(date)!.value) } : {}),
    ...(vo2Map.has(date) ? { vo2Max: Math.round(vo2Map.get(date)!.value * 10) / 10 } : {}),
    ...(spo2Map.has(date) ? { oxygenSaturation: Math.round(spo2Map.get(date)!.value * 10) / 10 } : {}),
    ...(respMap.has(date) ? { respiratoryRate: Math.round(respMap.get(date)!.value) } : {}),
  }));
}

export function mergeGarminVitalsReadings(
  entries: VitalsEntry[],
  readings: GarminVitalsReading[],
  importedAt: string,
  makeId: () => string,
): VitalsMergeSummary {
  let next = entries.slice();
  const tally = { inserted: 0, refreshed: 0, skipped: 0 };

  for (const reading of readings) {
    const { date, ...fields } = reading;
    if (Object.keys(fields).length === 0) {
      tally.skipped += 1;
      continue;
    }
    const idx = next.findIndex((entry) => entry.date === date && entry.source === GARMIN_VITALS_SOURCE);
    if (idx >= 0) {
      // Merge fields in rather than replace, so a later sync that only brought
      // one metric (e.g. RHR) doesn't erase a previously-synced field (e.g. VO2 max).
      next = next.map((item, index) => (index === idx ? { ...item, ...fields, importedAt } : item));
      tally.refreshed += 1;
    } else {
      next = [...next, { id: makeId(), date, ...fields, source: GARMIN_VITALS_SOURCE, sourceLabel: GARMIN_VITALS_SOURCE_LABEL, importedAt }];
      tally.inserted += 1;
    }
  }

  return { entries: next, ...tally };
}

export function summarizeVitalsMerge(summary: VitalsMergeSummary): string {
  const parts: string[] = [];
  if (summary.inserted) parts.push(`${summary.inserted} ${summary.inserted === 1 ? 'day' : 'days'} added`);
  if (summary.refreshed) parts.push(`${summary.refreshed} ${summary.refreshed === 1 ? 'day' : 'days'} updated`);
  return parts.join(', ');
}
