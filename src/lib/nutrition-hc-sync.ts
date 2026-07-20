import type { FoodLogEntry, MealSlot, NutritionSyncSettings } from '../types';
import { calcNetCarbs } from './nutrition';

// Write-side Health Connect support for read-only consumers such as RepIQ.
// Sync v2 publishes one replaceable daily total. The legacy per-entry helpers
// remain below only to normalize/migrate devices that already tracked pushed
// entry ids under v1.
export const DEFAULT_NUTRITION_SYNC_SETTINGS: NutritionSyncSettings = {
  enabled: true,
  syncedEntryIds: [],
  lastSyncAt: '',
  schemaVersion: 1,
  daySignatures: {},
};
export const CURRENT_NUTRITION_SYNC_SCHEMA = 2;

// Periodic catch-up push, mirroring garmin-auto-sync.ts's interval. New
// entries are pushed immediately on add; this only catches entries that
// arrived another way (e.g. merged in from a remote sync bundle on another
// device) or that failed to push earlier (permission granted only later).
export const NUTRITION_PUSH_INTERVAL_MS = 15 * 60 * 1000;
export const NUTRITION_PUSH_STARTUP_DELAY_MS = 4000;

export function shouldRunNutritionPush(input: {
  currentUserPresent: boolean;
  healthConnectSupported: boolean;
  enabled: boolean;
  hasPending: boolean;
  now: number;
  lastAttemptAt: number;
  intervalMs?: number;
}): boolean {
  if (!input.currentUserPresent || !input.healthConnectSupported || !input.enabled || !input.hasPending) return false;
  const intervalMs = input.intervalMs ?? NUTRITION_PUSH_INTERVAL_MS;
  return input.lastAttemptAt <= 0 || input.now - input.lastAttemptAt >= intervalMs;
}

// Android Health Connect's NutritionRecord#mealType int constants.
const MEAL_TYPE_BY_SLOT: Record<MealSlot, number> = {
  breakfast: 1,
  lunch: 2,
  dinner: 3,
  snack: 4,
};
const MEAL_TYPE_UNKNOWN = 0;

export interface NutritionRecordPayload {
  id: string; // FoodLogEntry.id, used only for syncedEntryIds bookkeeping
  time: string; // ISO instant - startTime === endTime, a single logged meal
  name: string;
  mealType: number;
  calories: number;
  proteinG: number;
  totalCarbsG: number;
  fatG: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeNutritionSyncSettings(value: unknown): NutritionSyncSettings {
  const record = isRecord(value) ? value : {};
  const syncedEntryIds = Array.isArray(record.syncedEntryIds)
    ? record.syncedEntryIds.filter((id): id is string => typeof id === 'string')
    : [];
  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : DEFAULT_NUTRITION_SYNC_SETTINGS.enabled,
    syncedEntryIds,
    lastSyncAt: typeof record.lastSyncAt === 'string' && Number.isFinite(Date.parse(record.lastSyncAt)) ? record.lastSyncAt : '',
    schemaVersion: typeof record.schemaVersion === 'number' && Number.isFinite(record.schemaVersion) ? record.schemaVersion : 1,
    daySignatures: isRecord(record.daySignatures)
      ? Object.fromEntries(Object.entries(record.daySignatures).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {},
  };
}

// A food-log entry only has something worth writing if at least one macro is
// a real, finite, non-negative number - a bare placeholder entry isn't useful
// in Health Connect and shouldn't burn an irreversible insert.
function hasUsableMacros(entry: FoodLogEntry): boolean {
  return [entry.calories, entry.proteinG, entry.totalCarbsG, entry.fatG]
    .some((value) => Number.isFinite(value) && (value as number) > 0);
}

// Entries not yet recorded in `syncedEntryIds` and worth writing, oldest first
// so a partial failure (e.g. permission revoked mid-batch) still leaves the
// oldest backlog synced first next time.
export function selectEntriesToPush(foodLog: FoodLogEntry[], syncedEntryIds: string[]): FoodLogEntry[] {
  const synced = new Set(syncedEntryIds);
  return foodLog
    .filter((entry) => !synced.has(entry.id) && hasUsableMacros(entry))
    .slice()
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
}

// Every entry-creation path in this app sets loggedAt to "right now" even
// when `date` is a different day the user explicitly picked (backdating,
// "copy from previous date", editing an entry's date after the fact, or
// simply logging late at night for the day that just ended). A reader that
// groups Health Connect records by calendar day (RepIQ does) would then
// attribute the entry's macros to whatever day it happened to be PUSHED on,
// not the day it's logically for - inflating that day's total there while
// this app's own day totals (grouped by `date`) stay correct. Keep the
// time-of-day from loggedAt (useful context in Health Connect's own data
// browser) but force the calendar day to match `entry.date`.
function nutritionRecordTime(entry: FoodLogEntry): string {
  const logged = new Date(entry.loggedAt);
  const [year, month, day] = (entry.date || '').split('-').map(Number);
  if (!year || !month || !day || Number.isNaN(logged.getTime())) return entry.loggedAt;
  const combined = new Date(logged);
  combined.setFullYear(year, month - 1, day);
  return combined.toISOString();
}

export function toNutritionRecordPayload(entry: FoodLogEntry): NutritionRecordPayload {
  return {
    id: entry.id,
    time: nutritionRecordTime(entry),
    name: entry.name,
    mealType: entry.meal ? MEAL_TYPE_BY_SLOT[entry.meal] : MEAL_TYPE_UNKNOWN,
    calories: Math.max(0, Math.round(entry.calories || 0)),
    proteinG: Math.max(0, Math.round(entry.proteinG || 0)),
    totalCarbsG: Math.max(0, Math.round(entry.totalCarbsG || 0)),
    fatG: Math.max(0, Math.round(entry.fatG || 0)),
  };
}

function localNoon(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

// RepIQ consumes one set of daily macro totals. A single authoritative record
// per day makes Health Connect replaceable after food edits/deletes and avoids
// accumulating stale per-food records. Carbohydrate is the app's keto-facing
// net-carb total so the value matches the Health Tracker dashboard.
export function buildDailyNutritionPayloads(foodLog: FoodLogEntry[]): NutritionRecordPayload[] {
  const totals = new Map<string, { calories: number; proteinG: number; netCarbsG: number; fatG: number }>();
  for (const entry of foodLog) {
    if (!entry.date || !hasUsableMacros(entry)) continue;
    const day = totals.get(entry.date) ?? { calories: 0, proteinG: 0, netCarbsG: 0, fatG: 0 };
    day.calories += entry.calories;
    day.proteinG += entry.proteinG;
    day.netCarbsG += calcNetCarbs(entry.totalCarbsG, entry.fibreG, entry.sugarAlcoholsG);
    day.fatG += entry.fatG;
    totals.set(entry.date, day);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({
      id: `day:${date}`,
      time: localNoon(date),
      name: 'Health Tracker daily macros',
      mealType: MEAL_TYPE_UNKNOWN,
      calories: Math.max(0, Math.round(total.calories)),
      proteinG: Math.max(0, Math.round(total.proteinG)),
      totalCarbsG: Math.max(0, Math.round(total.netCarbsG)),
      fatG: Math.max(0, Math.round(total.fatG)),
    }));
}

export function nutritionPayloadDate(payload: NutritionRecordPayload): string {
  return payload.id.startsWith('day:') ? payload.id.slice(4) : '';
}

export function nutritionDaySignatures(payloads: NutritionRecordPayload[]): Record<string, string> {
  return Object.fromEntries(payloads.map((payload) => [
    nutritionPayloadDate(payload),
    [payload.calories, payload.proteinG, payload.totalCarbsG, payload.fatG].join('|'),
  ]));
}

export function nutritionDaysNeedingSync(
  current: Record<string, string>,
  previous: Record<string, string>,
): string[] {
  const dates = new Set([...Object.keys(current), ...Object.keys(previous)]);
  return [...dates].filter((date) => current[date] !== previous[date]).sort();
}

// Drop ids for entries no longer in the food log (deleted) so the tracking
// list doesn't grow forever, then add the newly-pushed ids.
export function pruneAndRecordSyncedIds(
  syncedEntryIds: string[],
  foodLog: FoodLogEntry[],
  pushedIds: string[],
): string[] {
  const stillLogged = new Set(foodLog.map((entry) => entry.id));
  const kept = syncedEntryIds.filter((id) => stillLogged.has(id));
  const merged = new Set([...kept, ...pushedIds]);
  return [...merged];
}

export function summarizePush(pushedCount: number): string {
  if (pushedCount <= 0) return 'Already up to date - nothing new to push to Health Connect.';
  return `Pushed ${pushedCount} ${pushedCount === 1 ? 'entry' : 'entries'} to Health Connect.`;
}

// Health Connect has no delete-notification for this app to observe - if a
// record gets removed there directly (e.g. the user cleaning up a mis-dated
// duplicate, see the wrong-day-attribution bug this file's header comment
// warns about), `syncedEntryIds` still thinks that entry is synced and will
// never re-push it, permanently losing it from Health Connect even though
// the entry is still sitting right here in the food log. This drops the ids
// for a given day's entries from `syncedEntryIds` so the next push re-sends
// them as if they were new, without touching the food log itself.
export function clearSyncedEntryIdsForDate(
  syncedEntryIds: string[],
  foodLog: FoodLogEntry[],
  date: string,
): string[] {
  const idsForDate = new Set(foodLog.filter((entry) => entry.date === date).map((entry) => entry.id));
  return syncedEntryIds.filter((id) => !idsForDate.has(id));
}
