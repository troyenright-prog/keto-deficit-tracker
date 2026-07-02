import { describe, it, expect } from 'vitest';
import { resolveDbRequestUrl, AUTH_UNAVAILABLE_MESSAGE, DB_UNCONFIGURED_MESSAGE } from '../lib/firebase-db';

describe('resolveDbRequestUrl auth fail-safe', () => {
  const dbUrl = 'https://example-rtdb.firebaseio.com/ketoDeficitTracker';

  it('refuses to build an unauthenticated URL when auth is configured but tokenless', () => {
    expect(() => resolveDbRequestUrl('users/troy/appState', { dbUrl, authActive: true, token: null }))
      .toThrow(AUTH_UNAVAILABLE_MESSAGE);
  });

  it('includes the auth token when one is available', () => {
    const url = resolveDbRequestUrl('users/troy/appState', { dbUrl, authActive: true, token: 'tok123' });
    expect(url).toBe(`${dbUrl}/users/troy/appState.json?auth=tok123`);
  });

  it('allows an unauthenticated URL only when auth is not configured', () => {
    const url = resolveDbRequestUrl('users/troy/appState', { dbUrl, authActive: false, token: null });
    expect(url).toBe(`${dbUrl}/users/troy/appState.json`);
  });

  it('refuses to build a URL when the database base is missing', () => {
    expect(() => resolveDbRequestUrl('users/troy/appState', { dbUrl: '', authActive: true, token: 'tok123' }))
      .toThrow(DB_UNCONFIGURED_MESSAGE);
  });
});
