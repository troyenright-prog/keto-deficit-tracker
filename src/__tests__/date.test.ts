import { describe, expect, it, vi } from 'vitest';
import { addLocalDays, localDateString } from '../lib/date';
import { last7Days } from '../lib/weekly';
import { summariseDay } from '../lib/nutrition';
import type { FoodLogEntry } from '../types';

describe('local calendar dates', () => {
  it('uses the Brisbane date after local midnight while UTC is still yesterday', () => {
    const brisbaneInstant = new Date('2026-06-20T14:30:00.000Z');
    vi.spyOn(brisbaneInstant, 'getFullYear').mockReturnValue(2026);
    vi.spyOn(brisbaneInstant, 'getMonth').mockReturnValue(5);
    vi.spyOn(brisbaneInstant, 'getDate').mockReturnValue(21);
    expect(localDateString(brisbaneInstant)).toBe('2026-06-21');
    expect(brisbaneInstant.toISOString().slice(0, 10)).toBe('2026-06-20');
  });

  it('builds a local seven-day range across month boundaries', () => {
    expect(last7Days('2026-03-03')).toEqual([
      '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28',
      '2026-03-01', '2026-03-02', '2026-03-03',
    ]);
    expect(addLocalDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('keeps selected-date entries on their exact calendar date', () => {
    const base = {
      id: 'x', name: 'Egg', servingSize: '1', servingMultiplier: 1,
      calories: 70, proteinG: 6, fatG: 5, totalCarbsG: 1, fibreG: 0,
      sugarAlcoholsG: 0, sodiumMg: 60, potassiumMg: 50, magnesiumMg: 5,
      loggedAt: '2026-06-20T14:30:00.000Z',
    };
    const entries = [
      { ...base, date: '2026-06-20' },
      { ...base, id: 'y', date: '2026-06-21' },
    ] as FoodLogEntry[];
    expect(summariseDay('2026-06-21', entries).entryCount).toBe(1);
  });
});
