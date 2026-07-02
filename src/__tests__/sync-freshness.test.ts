import { describe, it, expect, beforeEach } from 'vitest';
import {
  remoteBundleShouldReplaceLocal,
  markLocalDataModified,
  getLocalDataModifiedAt,
  ensureLocalModifiedBaseline,
  configureStorageScope,
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

    localStorage.setItem('keto_profile', JSON.stringify({ name: 'Troy', weightUnit: 'kg', createdAt: '2026-01-01T00:00:00.000Z' }));
    ensureLocalModifiedBaseline();
    expect(getLocalDataModifiedAt()).not.toBe('');
  });

  it('does not overwrite an existing marker', () => {
    markLocalDataModified('2026-07-01T00:00:00.000Z');
    localStorage.setItem('keto_profile', JSON.stringify({ name: 'Troy', weightUnit: 'kg', createdAt: '2026-01-01T00:00:00.000Z' }));
    ensureLocalModifiedBaseline();
    expect(getLocalDataModifiedAt()).toBe('2026-07-01T00:00:00.000Z');
  });
});
