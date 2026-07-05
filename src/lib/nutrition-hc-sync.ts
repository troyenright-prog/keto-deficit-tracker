import type { FoodLogEntry, MealSlot, NutritionSyncSettings } from '../types';

// Write-side "push nutrition to Health Connect" support, so read-only Health
// Connect apps (e.g. RepIQ) can pick up this app's food log as Nutrition
// records. The Health Connect plugin only supports INSERT (no update/delete),
// so this is deliberately insert-once-per-entry: each food-log entry becomes
// exactly one Nutrition record, tracked by id in `syncedEntryIds` so it is
// never re-pushed (which would double-count it in any reader that sums
// records per day). Edits/deletes made in this app after an entry has already
// been pushed are NOT reflected in Health Connect - there is no way to
// retract or update a record already written by this plugin version.
export const DEFAULT_NUTRITION_SYNC_SETTINGS: NutritionSyncSettings = {
  enabled: true,
  syncedEntryIds: [],
  lastSyncAt: '',
};

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
