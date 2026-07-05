import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Progress } from '../screens/Progress';
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

describe('Progress screen', () => {
  it('surfaces keto alignment and best carb day insights', () => {
    const today = todayDateString();
    render(<Progress log={[
      entry({ id: 'a', date: addLocalDays(today, -1), totalCarbsG: 30, fibreG: 2, proteinG: 50 }),
      entry({ id: 'b', date: today, totalCarbsG: 6, fibreG: 2, proteinG: 120 }),
    ]} targets={DEFAULT_TARGETS} />);

    expect(screen.getByText(/keto alignment/i)).toBeTruthy();
    expect(screen.getByText('Best carb day')).toBeTruthy();
    expect(screen.getAllByText('4.0g').length).toBeGreaterThanOrEqual(1);
  });

  it('offers a week picker once history goes back further than the current week, and switching weeks shows that week\'s data', () => {
    const today = todayDateString();
    const fiveWeeksAgo = addLocalDays(today, -35);
    render(<Progress log={[
      entry({ id: 'old', date: fiveWeeksAgo, calories: 999, proteinG: 77 }),
      entry({ id: 'today', date: today, calories: 140, proteinG: 12 }),
    ]} targets={DEFAULT_TARGETS} />);

    const select = screen.getByLabelText('Week') as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(1);
    expect(screen.getByText(new RegExp(`^This week`))).toBeTruthy();

    // Today's week shows today's entry, not the five-week-old one.
    const table = screen.getByRole('table');
    expect(within(table).getByText('140')).toBeTruthy();
    expect(within(table).queryByText('999')).toBeNull();

    // Switch to the week containing the older entry.
    const targetOption = [...select.options].find((o) => {
      const start = addLocalDays(o.value, -6);
      return fiveWeeksAgo >= start && fiveWeeksAgo <= o.value;
    });
    expect(targetOption).toBeDefined();
    fireEvent.change(select, { target: { value: targetOption!.value } });

    expect(within(screen.getByRole('table')).getByText('999')).toBeTruthy();
    expect(within(screen.getByRole('table')).queryByText('140')).toBeNull();
  });

  it('does not show a week picker when there is no history beyond the current week', () => {
    const today = todayDateString();
    render(<Progress log={[entry({ id: 'a', date: today })]} targets={DEFAULT_TARGETS} />);
    expect(screen.queryByLabelText('Week')).toBeNull();
  });
});
