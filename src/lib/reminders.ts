import { Capacitor } from '@capacitor/core';
import type { LocalNotificationSchema, Weekday } from '@capacitor/local-notifications';
import type { ReminderKey, ReminderRule, ReminderSettings } from '../types';

// All 7 weekdays (1 Sunday - 7 Saturday), used for the "every day" preset and
// to enumerate every native notification id a weekly reminder could ever use.
export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export const DEFAULT_REMINDERS: ReminderSettings = {
  mealLogging: { enabled: false, time: '19:00', weekday: 1, days: ALL_WEEKDAYS },
  weighIn: { enabled: false, time: '07:00', weekday: 2, days: [2] },
  electrolytes: { enabled: false, time: '14:00', weekday: 1, days: ALL_WEEKDAYS },
  shopping: { enabled: false, time: '18:00', weekday: 6, days: [6] },
};

export const REMINDER_NOTIFICATION_IDS: Record<ReminderKey, number> = {
  mealLogging: 1001,
  weighIn: 1002,
  electrolytes: 1003,
  shopping: 1004,
};

// The native LocalNotifications API schedules one weekday per notification, so
// a weekly reminder covering multiple days needs one notification per day. The
// first selected day keeps the reminder's base id (for backward compatibility
// with the old single-weekday shape); additional days get a derived id.
function weeklyNotificationId(baseId: number, day: number, isFirst: boolean): number {
  return isFirst ? baseId : baseId * 10 + day;
}

// Every id a weekly reminder could ever have scheduled, across all 7 days —
// needed to fully clear stale notifications when the user changes which days
// are selected (not just cancel today's set of ids).
function allPossibleNotificationIds(): number[] {
  const ids: number[] = [];
  for (const key of Object.keys(REMINDER_NOTIFICATION_IDS) as ReminderKey[]) {
    const baseId = REMINDER_NOTIFICATION_IDS[key];
    ids.push(baseId, ...ALL_WEEKDAYS.map((day) => weeklyNotificationId(baseId, day, false)));
  }
  return ids;
}

type UnknownRecord = Record<string, unknown>;
type PermissionValue = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied' | 'unsupported';

export interface ReminderScheduleResult {
  ok: boolean;
  native: boolean;
  permission: PermissionValue;
  scheduled: number;
  message: string;
}

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

export function isValidReminderTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function normalizeTime(value: unknown, fallback: string): string {
  return isValidReminderTime(value) ? value : fallback;
}

function normalizeWeekday(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7 ? value : fallback;
}

function normalizeRule(value: unknown, fallback: ReminderRule): ReminderRule {
  const record = isRecord(value) ? value : {};
  const weekday = normalizeWeekday(record.weekday, fallback.weekday);
  const dayFallback = 'weekday' in record ? [weekday] : fallback.days;
  const days = normalizeDays(record.days, dayFallback);
  return {
    enabled: record.enabled === true,
    time: normalizeTime(record.time, fallback.time),
    weekday: days[0],
    days,
  };
}

function normalizeDays(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned = [...new Set(
    value.filter((d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 7),
  )].sort((a, b) => a - b);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function normalizeReminderSettings(value: unknown): ReminderSettings {
  const record = isRecord(value) ? value : {};
  return {
    mealLogging: normalizeRule(record.mealLogging, DEFAULT_REMINDERS.mealLogging),
    weighIn: normalizeRule(record.weighIn, DEFAULT_REMINDERS.weighIn),
    electrolytes: normalizeRule(record.electrolytes, DEFAULT_REMINDERS.electrolytes),
    shopping: normalizeRule(record.shopping, DEFAULT_REMINDERS.shopping),
    updatedAt: typeof record.updatedAt === 'string' && Number.isFinite(Date.parse(record.updatedAt)) ? record.updatedAt : undefined,
  };
}

export function hasEnabledReminders(settings: ReminderSettings): boolean {
  return settings.mealLogging.enabled || settings.weighIn.enabled || settings.electrolytes.enabled || settings.shopping.enabled;
}

function timeParts(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  return { hour, minute };
}

export function buildReminderNotifications(settings: ReminderSettings): LocalNotificationSchema[] {
  const notifications: LocalNotificationSchema[] = [];
  const addReminder = (
    key: ReminderKey,
    rule: ReminderRule,
    title: string,
    body: string,
  ) => {
    if (!rule.enabled) return;
    const days = rule.days.length > 0 ? rule.days : [rule.weekday];
    days.forEach((day, index) => {
      notifications.push({
        id: weeklyNotificationId(REMINDER_NOTIFICATION_IDS[key], day, index === 0),
        title,
        body,
        channelId: 'keto-reminders',
        autoCancel: true,
        schedule: {
          on: { ...timeParts(rule.time), weekday: day as Weekday },
          repeats: true,
          allowWhileIdle: true,
        },
        extra: { reminder: key, weekday: day },
      });
    });
  };

  addReminder('mealLogging', settings.mealLogging, 'Log your keto day', 'Add meals while the details are still fresh.');
  addReminder('weighIn', settings.weighIn, 'Weigh-in reminder', 'Log your weight trend for the week.');
  addReminder('electrolytes', settings.electrolytes, 'Electrolyte check', 'Check sodium, potassium, magnesium, and hydration.');
  addReminder('shopping', settings.shopping, 'Shopping list check', 'Review your keto shopping list before the next shop.');

  return notifications;
}

export function isNativeReminderPlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');
}

const TEST_NOTIFICATION_ID = 1099;

export async function sendTestReminder(): Promise<ReminderScheduleResult> {
  if (!isNativeReminderPlatform()) {
    return {
      ok: false,
      native: false,
      permission: 'unsupported',
      scheduled: 0,
      message: 'Test notifications only run in the Android or iOS app build.',
    };
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') {
      return {
        ok: false,
        native: true,
        permission: permission.display,
        scheduled: 0,
        message: 'Notification permission was not granted.',
      };
    }

    await LocalNotifications.createChannel({
      id: 'keto-reminders',
      name: 'Keto reminders',
      description: 'Meal, weigh-in, electrolyte, and shopping reminders.',
      importance: 4,
      visibility: 1,
      vibration: true,
    }).catch(() => {
      // iOS and older Android paths do not need explicit channels.
    });

    await LocalNotifications.schedule({
      notifications: [{
        id: TEST_NOTIFICATION_ID,
        title: 'Test reminder',
        body: 'Notifications are working. Your keto reminders will fire like this.',
        channelId: 'keto-reminders',
        autoCancel: true,
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
        extra: { reminder: 'test' },
      }],
    });

    return {
      ok: true,
      native: true,
      permission: permission.display,
      scheduled: 1,
      message: 'Test notification scheduled — it should appear in about 5 seconds.',
    };
  } catch {
    return {
      ok: false,
      native: true,
      permission: 'prompt',
      scheduled: 0,
      message: 'Test notification could not be scheduled on this device.',
    };
  }
}

export async function scheduleReminderNotifications(settings: ReminderSettings): Promise<ReminderScheduleResult> {
  if (!isNativeReminderPlatform()) {
    return {
      ok: true,
      native: false,
      permission: 'unsupported',
      scheduled: 0,
      message: 'Reminder settings saved. Native notifications run in Android and iOS app builds.',
    };
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') {
      return {
        ok: false,
        native: true,
        permission: permission.display,
        scheduled: 0,
        message: 'Notification permission was not granted.',
      };
    }

    await LocalNotifications.createChannel({
      id: 'keto-reminders',
      name: 'Keto reminders',
      description: 'Meal, weigh-in, electrolyte, and shopping reminders.',
      importance: 4,
      visibility: 1,
      vibration: true,
    }).catch(() => {
      // iOS and older Android paths do not need explicit channels.
    });

    await LocalNotifications.cancel({
      notifications: allPossibleNotificationIds().map((id) => ({ id })),
    });

    const notifications = buildReminderNotifications(settings);
    if (notifications.length === 0) {
      return {
        ok: true,
        native: true,
        permission: permission.display,
        scheduled: 0,
        message: 'All native reminders are off.',
      };
    }

    const result = await LocalNotifications.schedule({ notifications });
    return {
      ok: true,
      native: true,
      permission: permission.display,
      scheduled: result.notifications.length,
      message: `${result.notifications.length} native reminder${result.notifications.length === 1 ? '' : 's'} scheduled.`,
    };
  } catch {
    return {
      ok: false,
      native: true,
      permission: 'prompt',
      scheduled: 0,
      message: 'Native reminders could not be scheduled on this device.',
    };
  }
}
