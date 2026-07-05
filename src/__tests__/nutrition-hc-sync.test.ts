import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NUTRITION_SYNC_SETTINGS,
  NUTRITION_PUSH_INTERVAL_MS,
  normalizeNutritionSyncSettings,
  pruneAndRecordSyncedIds,
  selectEntriesToPush,
  shouldRunNutritionPush,
  summarizePush,
  toNutritionRecordPayload,
} from '../lib/nutrition-hc-sync';
import type { FoodLogEntry } from '../types';

function makeEntry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: 'entry-1',
    date: '2026-07-05',
    name: 'Chicken breast',
    servingSize: '150g',
    servingMultiplier: 1,
    calories: 250,
    proteinG: 45,
    fatG: 6,
    totalCarbsG: 0,
    fibreG: 0,
    sugarAlcoholsG: 0,
    sodiumMg: 90,
    potassiumMg: 400,
    magnesiumMg: 30,
    loggedAt: '2026-07-05T12:00:00.000Z',
    meal: 'lunch',
    ...overrides,
  };
}

describe('normalizeNutritionSyncSettings', () => {
  it('falls back to defaults for garbage input', () => {
    expect(normalizeNutritionSyncSettings(null)).toEqual(DEFAULT_NUTRITION_SYNC_SETTINGS);
    expect(normalizeNutritionSyncSettings(undefined)).toEqual(DEFAULT_NUTRITION_SYNC_SETTINGS);
    expect(normalizeNutritionSyncSettings('nonsense')).toEqual(DEFAULT_NUTRITION_SYNC_SETTINGS);
  });

  it('keeps valid fields and drops invalid ones', () => {
    const result = normalizeNutritionSyncSettings({
      enabled: false,
      syncedEntryIds: ['a', 'b', 42, null],
      lastSyncAt: '2026-07-05T08:00:00.000Z',
    });
    expect(result).toEqual({
      enabled: false,
      syncedEntryIds: ['a', 'b'],
      lastSyncAt: '2026-07-05T08:00:00.000Z',
    });
  });

  it('rejects an unparsable lastSyncAt timestamp', () => {
    const result = normalizeNutritionSyncSettings({ lastSyncAt: 'not-a-date' });
    expect(result.lastSyncAt).toBe('');
  });
});

describe('selectEntriesToPush', () => {
  it('excludes already-synced ids and entries with no usable macros', () => {
    const synced = makeEntry({ id: 'synced' });
    const empty = makeEntry({ id: 'empty', calories: 0, proteinG: 0, fatG: 0, totalCarbsG: 0 });
    const pending = makeEntry({ id: 'pending' });

    const result = selectEntriesToPush([synced, empty, pending], ['synced']);
    expect(result.map((e) => e.id)).toEqual(['pending']);
  });

  it('orders pending entries oldest-logged first', () => {
    const later = makeEntry({ id: 'later', loggedAt: '2026-07-05T18:00:00.000Z' });
    const earlier = makeEntry({ id: 'earlier', loggedAt: '2026-07-05T08:00:00.000Z' });

    const result = selectEntriesToPush([later, earlier], []);
    expect(result.map((e) => e.id)).toEqual(['earlier', 'later']);
  });
});

describe('toNutritionRecordPayload', () => {
  it('maps a food log entry to a Health Connect nutrition payload', () => {
    const entry = makeEntry();
    expect(toNutritionRecordPayload(entry)).toEqual({
      id: 'entry-1',
      time: '2026-07-05T12:00:00.000Z',
      name: 'Chicken breast',
      mealType: 2, // lunch
      calories: 250,
      proteinG: 45,
      totalCarbsG: 0,
      fatG: 6,
    });
  });

  it('defaults mealType to unknown when the entry has no meal slot', () => {
    const entry = makeEntry({ meal: undefined });
    expect(toNutritionRecordPayload(entry).mealType).toBe(0);
  });
});

describe('pruneAndRecordSyncedIds', () => {
  it('drops ids for entries that no longer exist and adds newly pushed ids', () => {
    const foodLog = [makeEntry({ id: 'still-here' }), makeEntry({ id: 'pushed-now' })];
    const result = pruneAndRecordSyncedIds(['still-here', 'deleted-entry'], foodLog, ['pushed-now']);
    expect(new Set(result)).toEqual(new Set(['still-here', 'pushed-now']));
  });
});

describe('summarizePush', () => {
  it('describes zero vs a positive push count', () => {
    expect(summarizePush(0)).toMatch(/already up to date/i);
    expect(summarizePush(1)).toMatch(/pushed 1 entry/i);
    expect(summarizePush(3)).toMatch(/pushed 3 entries/i);
  });
});

describe('shouldRunNutritionPush', () => {
  const base = {
    currentUserPresent: true,
    healthConnectSupported: true,
    enabled: true,
    hasPending: true,
    now: 10_000,
    lastAttemptAt: 0,
  };

  it('requires a user, HC support, the feature enabled, and pending entries', () => {
    expect(shouldRunNutritionPush(base)).toBe(true);
    expect(shouldRunNutritionPush({ ...base, currentUserPresent: false })).toBe(false);
    expect(shouldRunNutritionPush({ ...base, healthConnectSupported: false })).toBe(false);
    expect(shouldRunNutritionPush({ ...base, enabled: false })).toBe(false);
    expect(shouldRunNutritionPush({ ...base, hasPending: false })).toBe(false);
  });

  it('respects the interval since the last attempt', () => {
    expect(shouldRunNutritionPush({
      ...base,
      now: NUTRITION_PUSH_INTERVAL_MS + 1000,
      lastAttemptAt: 1000,
    })).toBe(true);
    expect(shouldRunNutritionPush({
      ...base,
      now: NUTRITION_PUSH_INTERVAL_MS + 999,
      lastAttemptAt: 1001,
    })).toBe(false);
  });
});
