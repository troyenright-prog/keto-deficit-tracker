import { describe, it, expect, beforeEach } from 'vitest';
import {
  remoteBundleShouldReplaceLocal,
  markLocalDataModified,
  getLocalDataModifiedAt,
  ensureLocalModifiedBaseline,
  configureStorageScope,
  hasLocalUserData,
  migrateIfNeeded,
  ensureTroyMealTemplates,
  loadMealTemplates,
} from '../lib/storage';

beforeEach(() => {
  localStorage.clear();
  configureStorageScope(null);
});

describe('remoteBundleShouldReplaceLocal', () => {
  it('accepts remote on a fresh install (no marker, no local data)', () => {
    expect(remoteBundleShouldReplaceLocal('2026-07-02T00:00:00.000Z', '', false)).toBe(true);
  });

  it('protects existing local data when there is no freshness marker yet', () => {
    // First launch after the update: local data exists but was never stamped.
    expect(remoteBundleShouldReplaceLocal('2026-07-02T00:00:00.000Z', '', true)).toBe(false);
  });

  it('accepts a strictly newer remote bundle', () => {
    expect(remoteBundleShouldReplaceLocal('2026-07-02T10:00:00.000Z', '2026-07-02T09:00:00.000Z', true)).toBe(true);
  });

  it('rejects a stale remote bundle so newer local edits survive', () => {
    // Queued-sync recovery / offline edit: local is newer than the remote read.
    expect(remoteBundleShouldReplaceLocal('2026-07-02T08:00:00.000Z', '2026-07-02T09:00:00.000Z', true)).toBe(false);
  });

  it('rejects an equal-timestamp remote bundle (nothing to gain)', () => {
    expect(remoteBundleShouldReplaceLocal('2026-07-02T09:00:00.000Z', '2026-07-02T09:00:00.000Z', true)).toBe(false);
  });

  it('uses the startup snapshot so a first edit while connecting cannot clobber populated remote data', () => {
    const startup = { modifiedAt: '', hasData: false };

    // The edit happens after sync starts but before the first remote GET returns.
    markLocalDataModified('2026-07-02T11:00:00.000Z');
    localStorage.setItem('keto_saved_foods', JSON.stringify([{ id: 'new', name: 'New local food' }]));

    expect(hasLocalUserData()).toBe(true);
    expect(remoteBundleShouldReplaceLocal(
      '2026-07-02T10:00:00.000Z',
      startup.modifiedAt,
      startup.hasData,
    )).toBe(true);
  });
});

describe('hasLocalUserData', () => {
  it('treats a migrated fresh install with defaults as empty so populated remote data hydrates', () => {
    migrateIfNeeded();

    expect(hasLocalUserData()).toBe(false);
    expect(remoteBundleShouldReplaceLocal('2026-07-02T10:00:00.000Z', getLocalDataModifiedAt(), hasLocalUserData())).toBe(true);
  });

  it('counts real food content but not profile or reminder configuration', () => {
    localStorage.setItem('keto_profile', JSON.stringify({ name: 'Troy', weightUnit: 'kg' }));
    localStorage.setItem('keto_reminders', JSON.stringify({
      mealLogging: { enabled: true, time: '19:00', weekday: 1, days: [1] },
    }));
    expect(hasLocalUserData()).toBe(false);

    localStorage.setItem('keto_saved_foods', JSON.stringify([{ id: 'food-1', name: 'Steak' }]));
    expect(hasLocalUserData()).toBe(true);
  });
});

describe('local freshness marker', () => {
  it('round-trips the marker value', () => {
    markLocalDataModified('2026-07-02T09:00:00.000Z');
    expect(getLocalDataModifiedAt()).toBe('2026-07-02T09:00:00.000Z');
  });

  it('defaults to empty when never set', () => {
    expect(getLocalDataModifiedAt()).toBe('');
  });

  it('seeds a baseline only when local user data exists', () => {
    ensureLocalModifiedBaseline();
    expect(getLocalDataModifiedAt()).toBe(''); // nothing to protect yet

    localStorage.setItem('keto_saved_foods', JSON.stringify([{ id: 'food-1', name: 'Steak' }]));
    ensureLocalModifiedBaseline();
    expect(getLocalDataModifiedAt()).not.toBe('');
  });

  it('does not overwrite an existing marker', () => {
    markLocalDataModified('2026-07-01T00:00:00.000Z');
    localStorage.setItem('keto_saved_foods', JSON.stringify([{ id: 'food-1', name: 'Steak' }]));
    ensureLocalModifiedBaseline();
    expect(getLocalDataModifiedAt()).toBe('2026-07-01T00:00:00.000Z');
  });
});

describe('Troy meal-template repair', () => {
  // The repair exists for an established install that lost its templates. Seeding a
  // fresh client instead would stamp a new modified marker and make the device look
  // like it holds user data, so the older remote bundle gets refused and the client
  // later pushes its near-empty state over the user's real data.
  const giveTroyExistingData = () =>
    localStorage.setItem('keto_production_troy_keto_saved_foods', JSON.stringify([{ id: 'food-1', name: 'Steak' }]));

  it('restores the requested shortcuts once with the intended serving quantities', () => {
    configureStorageScope({ environment: 'production', userKey: 'troy' });
    giveTroyExistingData();

    expect(ensureTroyMealTemplates('troy')).toBe(true);
    expect(loadMealTemplates()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'troy-steak-ghee-v1',
        name: 'Steak & Ghee',
        mealType: 'dinner',
        items: [
          expect.objectContaining({ name: 'Beef rib fillet thick cut (Super Butcher, raw)', quantity: 1 }),
          expect.objectContaining({ name: 'Sol Ghee (grass fed)', quantity: 4 }),
        ],
      }),
      expect.objectContaining({
        id: 'troy-eggs-ghee-v1',
        name: 'Eggs & Ghee',
        items: [
          expect.objectContaining({ name: 'Eggs 700g (Harris Farm)', quantity: 4 }),
          expect.objectContaining({ name: 'Sol Ghee (grass fed)', quantity: 2 }),
        ],
      }),
    ]));
    expect(getLocalDataModifiedAt()).not.toBe('');
    expect(ensureTroyMealTemplates('troy')).toBe(false);
    expect(loadMealTemplates()).toHaveLength(2);
  });

  it('does not seed a fresh install, so remote data can still hydrate', () => {
    configureStorageScope({ environment: 'production', userKey: 'troy' });

    expect(ensureTroyMealTemplates('troy')).toBe(false);
    expect(loadMealTemplates()).toEqual([]);
    expect(getLocalDataModifiedAt()).toBe('');
    expect(remoteBundleShouldReplaceLocal('2026-07-02T10:00:00.000Z', getLocalDataModifiedAt(), hasLocalUserData())).toBe(true);
  });

  it('does not seed another user', () => {
    configureStorageScope({ environment: 'production', userKey: 'angela' });

    expect(ensureTroyMealTemplates('angela')).toBe(false);
    expect(loadMealTemplates()).toEqual([]);
  });
});
