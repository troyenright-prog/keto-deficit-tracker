export const APP_USERS = {
  troy: { label: 'Troy', email: import.meta.env.VITE_USER_TROY_EMAIL || '', color: '#246bfe' },
  khatra: { label: 'Khatra', email: import.meta.env.VITE_USER_KHATRA_EMAIL || '', color: '#df3f86' },
} as const;

export type AppUserKey = keyof typeof APP_USERS;

const CURRENT_USER_KEY = 'keto_current_user';

export function isAppUserKey(value: unknown): value is AppUserKey {
  return typeof value === 'string' && value in APP_USERS;
}

export function loadCurrentUser(): AppUserKey | null {
  try {
    const value = localStorage.getItem(CURRENT_USER_KEY);
    return isAppUserKey(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveCurrentUser(userKey: AppUserKey): void {
  try {
    localStorage.setItem(CURRENT_USER_KEY, userKey);
  } catch {
    // A blocked localStorage still lets the user continue for this session.
  }
}

export function clearCurrentUser(): void {
  try {
    localStorage.removeItem(CURRENT_USER_KEY);
  } catch {
    // Ignore storage failures.
  }
}
