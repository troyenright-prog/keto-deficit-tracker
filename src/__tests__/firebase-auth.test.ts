import { describe, it, expect } from 'vitest';
import {
  resolveDbRequestUrl, parseSignUpResponse, parseRefreshTokenResponse, parseFirebaseStreamPayload,
  AUTH_UNAVAILABLE_MESSAGE, DB_UNCONFIGURED_MESSAGE,
} from '../lib/firebase-db';

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

// Persisting the refresh token (instead of only caching the id token in
// memory) is what stops every app restart from creating a brand new anonymous
// Firebase Auth account — see firebase-db.ts's refreshWithToken/signUpAnonymous.
describe('auth token response parsing', () => {
  it('reads the camelCase fields from an accounts:signUp response', () => {
    expect(parseSignUpResponse({ idToken: 'id-1', refreshToken: 'refresh-1', expiresIn: '3600' }))
      .toEqual({ idToken: 'id-1', refreshToken: 'refresh-1', expiresIn: '3600' });
  });

  it('defaults expiresIn to 3600 when absent from a signUp response', () => {
    expect(parseSignUpResponse({ idToken: 'id-1', refreshToken: 'refresh-1' }))
      .toEqual({ idToken: 'id-1', refreshToken: 'refresh-1', expiresIn: '3600' });
  });

  it('rejects a signUp response missing idToken or refreshToken', () => {
    expect(parseSignUpResponse({ idToken: 'id-1' })).toBeNull();
    expect(parseSignUpResponse(null)).toBeNull();
  });

  it('reads the snake_case fields from a securetoken.googleapis.com refresh response', () => {
    expect(parseRefreshTokenResponse({ id_token: 'id-2', refresh_token: 'refresh-2', expires_in: '3600' }))
      .toEqual({ idToken: 'id-2', refreshToken: 'refresh-2', expiresIn: '3600' });
  });

  it('rejects a refresh response missing id_token or refresh_token', () => {
    expect(parseRefreshTokenResponse({ id_token: 'id-2' })).toBeNull();
    expect(parseRefreshTokenResponse({})).toBeNull();
  });
});

describe('Firebase stream payload parsing', () => {
  it('accepts Firebase put and patch payloads', () => {
    expect(parseFirebaseStreamPayload('{"path":"/","data":{"version":6}}')).toEqual({
      path: '/',
      data: { version: 6 },
    });
  });

  it('rejects malformed stream messages', () => {
    expect(parseFirebaseStreamPayload('not json')).toBeNull();
    expect(parseFirebaseStreamPayload('{"data":null}')).toBeNull();
    expect(parseFirebaseStreamPayload('{"path":"/"}')).toBeNull();
  });
});
