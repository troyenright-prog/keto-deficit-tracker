import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_WEEKDAYS, buildReminderNotifications, normalizeReminderSettings, scheduleReminderNotifications } from '../lib/reminders';
import { exportAppData, importAppData, loadReminders, saveReminders } from '../lib/storage';

beforeEach(() => localStorage.clear());

describe('reminder settings', () => {
  it('normalizes invalid reminder values to safe defaults', () => {
    const settings = normalizeReminderSettings({
      mealLogging: { enabled: true, time: '99:00' },
      weighIn: { enabled: true, time: '06:30', weekday: 99 },
    });

    expect(settings.mealLogging).toEqual({ enabled: true, time: '19:00', weekday: 1, days: ALL_WEEKDAYS });
    expect(settings.weighIn).toEqual({ enabled: true, time: '06:30', weekday: 2, days: [2] });
    expect(settings.electrolytes).toEqual({ enabled: false, time: '14:00', weekday: 1, days: ALL_WEEKDAYS });
  });

  it('exports and imports reminder preferences with existing backup data', () => {
    expect(saveReminders({
      mealLogging: { enabled: true, time: '20:15', weekday: 1, days: ALL_WEEKDAYS },
      weighIn: { enabled: true, time: '07:30', weekday: 1, days: [1] },
      electrolytes: { enabled: false, time: '14:00', weekday: 1, days: ALL_WEEKDAYS },
      shopping: { enabled: true, time: '18:45', weekday: 6, days: [6] },
    })).toBe(true);

    const bundle = exportAppData();
    localStorage.clear();
    expect(importAppData(bundle)).toBe(true);

    expect(loadReminders()).toMatchObject({
      mealLogging: { enabled: true, time: '20:15', weekday: 1, days: ALL_WEEKDAYS },
      shopping: { enabled: true, time: '18:45', weekday: 6, days: [6] },
    });
  });

  it('builds native local notification schedules for enabled reminders', () => {
    const notifications = buildReminderNotifications({
      mealLogging: { enabled: true, time: '20:15', weekday: 1, days: [1, 3] },
      weighIn: { enabled: true, time: '07:30', weekday: 1, days: [1] },
      electrolytes: { enabled: false, time: '14:00', weekday: 1, days: ALL_WEEKDAYS },
      shopping: { enabled: false, time: '18:45', weekday: 6, days: [6] },
    });

    expect(notifications).toHaveLength(3);
    expect(notifications[0]).toMatchObject({
      id: 1001,
      title: 'Log your keto day',
      schedule: { on: { hour: 20, minute: 15, weekday: 1 }, repeats: true },
    });
    expect(notifications[1]).toMatchObject({
      id: 10013,
      schedule: { on: { hour: 20, minute: 15, weekday: 3 }, repeats: true },
    });
    expect(notifications[2]).toMatchObject({
      id: 1002,
      schedule: { on: { hour: 7, minute: 30, weekday: 1 }, repeats: true },
    });
  });

  it('schedules one notification per selected day for a multi-day weekly reminder', () => {
    const notifications = buildReminderNotifications({
      mealLogging: { enabled: false, time: '19:00', weekday: 1, days: ALL_WEEKDAYS },
      weighIn: { enabled: true, time: '07:00', weekday: 2, days: [2, 4, 6] },
      electrolytes: { enabled: false, time: '14:00', weekday: 1, days: ALL_WEEKDAYS },
      shopping: { enabled: false, time: '18:00', weekday: 6, days: [6] },
    });

    expect(notifications).toHaveLength(3);
    expect(notifications.map((n) => n.id)).toEqual([1002, 10024, 10026]);
    expect(notifications.map((n) => (n.schedule as { on: { weekday: number } }).on.weekday)).toEqual([2, 4, 6]);
  });

  it('schedules selected days for meal logging and electrolyte reminders too', () => {
    const notifications = buildReminderNotifications({
      mealLogging: { enabled: true, time: '19:00', weekday: 2, days: [2, 4, 6] },
      weighIn: { enabled: false, time: '07:00', weekday: 2, days: [2] },
      electrolytes: { enabled: true, time: '14:00', weekday: 1, days: [1, 7] },
      shopping: { enabled: false, time: '18:00', weekday: 6, days: [6] },
    });

    expect(notifications).toHaveLength(5);
    expect(notifications.map((n) => n.id)).toEqual([1001, 10014, 10016, 1003, 10037]);
    expect(notifications.map((n) => (n.schedule as { on: { weekday: number } }).on.weekday)).toEqual([2, 4, 6, 1, 7]);
  });

  it('saves settings without scheduling when running as the web app', async () => {
    const result = await scheduleReminderNotifications(loadReminders());
    expect(result).toMatchObject({
      ok: true,
      native: false,
      permission: 'unsupported',
      scheduled: 0,
    });
  });
});
