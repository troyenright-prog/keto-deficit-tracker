import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeeklySummary } from '../screens/WeeklySummary';
import { DEFAULT_TARGETS } from '../lib/storage';
import { addLocalDays } from '../lib/date';
import { todayDateString } from '../lib/nutrition';
import type { FoodLogEntry } from '../types';

const entry = (overrides: Partial<FoodLogEntry> = {}): FoodLogEntry => ({
  id: 'log-1',
  date: '2026-06-25',
  name: 'Eggs',
  servingSize: '2 eggs',
  servingMultiplier: 1,
  calories: 140,
  proteinG: 12,
  fatG: 10,
  totalCarbsG: 1,
  fibreG: 0,
  sugarAlcoholsG: 0,
  sodiumMg: 120,
  potassiumMg: 100,
  magnesiumMg: 10,
  loggedAt: '2026-06-25T08:00:00.000Z',
  ...overrides,
});

describe('WeeklySummary screen', () => {
  it('surfaces keto alignment and best carb day insights', () => {
    const today = todayDateString();
    render(<WeeklySummary log={[
      entry({ id: 'a', date: addLocalDays(today, -1), totalCarbsG: 30, fibreG: 2, proteinG: 50 }),
      entry({ id: 'b', date: today, totalCarbsG: 6, fibreG: 2, proteinG: 120 }),
    ]} targets={DEFAULT_TARGETS} />);

    expect(screen.getByText(/keto alignment/i)).toBeTruthy();
    expect(screen.getByText('Best carb day')).toBeTruthy();
    expect(screen.getAllByText('4.0g').length).toBeGreaterThanOrEqual(1);
  });
});
