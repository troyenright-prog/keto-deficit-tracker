import type { AppStateBundle } from '../types';
import { normalizeAppBundle } from './storage';
import type { AppUserKey } from './users';

type QueueItem = {
  userKey: AppUserKey;
  bundle: AppStateBundle;
};

type QueueState = {
  pending: number;
  flushing: boolean;
  error: string | null;
};

const KETO_DB_BASE = (import.meta.env.VITE_KETO_FIREBASE_DB_BASE || '').replace(/\/+$/, '');
const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || '';
const REQUEST_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 5_000;
const SYNC_RETRY_INTERVAL_MS = 10_000;

export function firebaseAuthEnvIsComplete(env: Record<string, string | undefined> = {}): boolean {
  return Boolean(
    env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_AUTH_DOMAIN &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID,
  );
}

export function buildFirebaseWebConfig(env: Record<string, string | undefined> = {}, dbUrl = '') {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    databaseURL: dbUrl,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  };
}

export function appendFirebaseAuth(url: string, token?: string | null): string {
  return token ? `${url}?auth=${encodeURIComponent(token)}` : url;
}

export function buildDbRestUrl(path: string, { dbUrl = '', token }: { dbUrl?: string; token?: string | null } = {}): string {
  return appendFirebaseAuth(`${dbUrl}/${path}.json`, token);
}

// Thrown when auth is configured but no token is available. Callers treat this
// as a sync failure (read fails safe, write queues) rather than silently
// sending an unauthenticated request that could bypass database rules.
export const AUTH_UNAVAILABLE_MESSAGE = 'Sync is signed out — not sending an unauthenticated request.';
export const DB_UNCONFIGURED_MESSAGE = 'Firebase sync database URL is not configured. Set VITE_KETO_FIREBASE_DB_BASE.';

// Build the REST URL for a request, refusing to proceed unauthenticated when
// auth is configured but the token could not be obtained. When auth is not
// configured at all (no API key), an unauthenticated URL is expected and fine.
export function resolveDbRequestUrl(
  path: string,
  { dbUrl = '', authActive, token }: { dbUrl?: string; authActive: boolean; token: string | null },
): string {
  if (!dbUrl) throw new Error(DB_UNCONFIGURED_MESSAGE);
  if (authActive && !token) throw new Error(AUTH_UNAVAILABLE_MESSAGE);
  return buildDbRestUrl(path, { dbUrl, token });
}

export const STORAGE_NAMESPACE = 'production';
export const DB_BASE = KETO_DB_BASE;
export const FIREBASE_DB_CONFIGURED = Boolean(DB_BASE);
export const DB_URL = FIREBASE_DB_CONFIGURED ? `${DB_BASE}/ketoDeficitTracker` : '';
export const FIREBASE_AUTH_ACTIVE = Boolean(FIREBASE_API_KEY);

const QUEUE_KEY = `keto_sync_queue_${STORAGE_NAMESPACE}`;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    return await fetch(url, controller ? { ...options, signal: controller.signal } : options);
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      const timeoutError = new Error(`Firebase request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      (timeoutError as Error & { cause?: unknown }).cause = error;
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

let cachedToken: string | null = null;
let tokenExpiry = 0;
let refreshPromise: Promise<string | null> | null = null;

async function getToken(): Promise<string | null> {
  if (!FIREBASE_API_KEY) return null;
  if (cachedToken && tokenExpiry > Date.now() + 5 * 60 * 1000) return cachedToken;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetchWithTimeout(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ returnSecureToken: true }),
        },
      );
      if (!response.ok) throw new Error(`Auth signUp failed: ${response.status}`);
      const data = await response.json() as { idToken?: string; expiresIn?: string };
      cachedToken = data.idToken || null;
      tokenExpiry = Date.now() + Number.parseInt(data.expiresIn || '3600', 10) * 1000;
      return cachedToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function initAuth(): Promise<string | null> {
  return getToken();
}

async function dbUrl(path: string): Promise<string> {
  return resolveDbRequestUrl(path, { dbUrl: DB_URL, authActive: FIREBASE_AUTH_ACTIVE, token: await getToken() });
}

async function readJson(path: string): Promise<unknown> {
  const response = await fetchWithTimeout(await dbUrl(path));
  if (!response.ok) throw new Error(`Firebase read failed: ${response.status}`);
  return response.json();
}

async function putJson(path: string, value: unknown): Promise<unknown> {
  const response = await fetchWithTimeout(await dbUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!response.ok) {
    const error = new Error(`Firebase write failed: ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function userPath(userKey: AppUserKey): string {
  return `users/${userKey}/appState`;
}

export async function readRemoteAppData(userKey: AppUserKey): Promise<AppStateBundle | null> {
  const bundle = normalizeAppBundle(await readJson(userPath(userKey)));
  return bundle;
}

function loadQueue(): QueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const record = item as Partial<QueueItem>;
        const bundle = normalizeAppBundle(record.bundle);
        if ((record.userKey === 'troy' || record.userKey === 'khatra') && bundle) return { userKey: record.userKey, bundle };
        return null;
      })
      .filter((item): item is QueueItem => item !== null);
  } catch {
    return [];
  }
}

function persistQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // The in-memory queue will still retry this session.
  }
}

const queue = loadQueue();
const queueListeners = new Set<(state: QueueState) => void>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;
let isFlushing = false;
let lastQueueError: string | null = null;

function emitQueueState(extra: Partial<QueueState> = {}): void {
  const state = { pending: queue.length, flushing: isFlushing, error: lastQueueError, ...extra };
  for (const listener of queueListeners) {
    try {
      listener(state);
    } catch {
      // Ignore subscriber errors.
    }
  }
}

function enqueue(item: QueueItem, error: unknown): void {
  const index = queue.findIndex((queued) => queued.userKey === item.userKey);
  if (index >= 0) queue[index] = item;
  else queue.push(item);
  lastQueueError = String((error as Error)?.message || error || 'sync failed');
  persistQueue();
  emitQueueState();
  if (!retryTimer) retryTimer = setTimeout(() => { void flushQueuedSync(); }, SYNC_RETRY_INTERVAL_MS);
}

export async function flushQueuedSync(): Promise<void> {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    retryTimer = null;
    if (!queue.length) {
      lastQueueError = null;
      emitQueueState();
      return;
    }
    isFlushing = true;
    lastQueueError = null;
    emitQueueState();
    while (queue.length) {
      const item = queue[0];
      try {
        await putJson(userPath(item.userKey), item.bundle);
        queue.shift();
        persistQueue();
        emitQueueState();
      } catch (error) {
        const status = (error as Error & { status?: number })?.status;
        if (status === 401 || status === 403) {
          cachedToken = null;
          tokenExpiry = 0;
        }
        lastQueueError = String((error as Error)?.message || error || 'sync failed');
        if (!retryTimer) retryTimer = setTimeout(() => { void flushQueuedSync(); }, SYNC_RETRY_INTERVAL_MS);
        emitQueueState();
        break;
      }
    }
  })().finally(() => {
    isFlushing = false;
    flushPromise = null;
    emitQueueState();
  });
  return flushPromise;
}

export function subscribeSyncQueue(listener: (state: QueueState) => void): () => void {
  queueListeners.add(listener);
  listener({ pending: queue.length, flushing: isFlushing, error: lastQueueError });
  return () => queueListeners.delete(listener);
}

export async function saveRemoteAppData(userKey: AppUserKey, bundle: AppStateBundle): Promise<{ queued: boolean }> {
  try {
    await putJson(userPath(userKey), bundle);
    return { queued: false };
  } catch (error) {
    enqueue({ userKey, bundle }, error);
    return { queued: true };
  }
}

export function subscribeRemoteAppData(
  userKey: AppUserKey,
  callback: (bundle: AppStateBundle | null) => void,
  { onError, intervalMs = POLL_INTERVAL_MS }: { onError?: (error: unknown) => void; intervalMs?: number } = {},
): () => void {
  let stopped = false;
  let inFlight = false;
  const poll = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const bundle = await readRemoteAppData(userKey);
      if (!stopped) callback(bundle);
    } catch (error) {
      if (!stopped) onError?.(error);
    } finally {
      inFlight = false;
    }
  };
  void poll();
  const id = setInterval(() => { void poll(); }, intervalMs);
  return () => {
    stopped = true;
    clearInterval(id);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void flushQueuedSync(); });
  if (queue.length) setTimeout(() => { void flushQueuedSync(); }, 0);
}
