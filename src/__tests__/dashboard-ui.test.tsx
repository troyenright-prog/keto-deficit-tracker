import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../screens/Dashboard';
import { summariseDay } from '../lib/nutrition';
import { DEFAULT_TARGETS } from '../lib/storage';
import type { DailyNutritionSummary } from '../types';

describe('Dashboard screen', () => {
  it('makes an over-target calorie result explicit', () => {
    const summary: DailyNutritionSummary = {
      ...summariseDay('2026-01-01', []),
      calories: DEFAULT_TARGETS.calories + 703,
      entryCount: 1,
    };

    render(
      <Dashboard
        summary={summary}
        entries={[]}
        targets={DEFAULT_TARGETS}
        recommendations={[]}
        onAddFood={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '703 calories over target' }).textContent).toBe('+703');
    expect(screen.getByText('Over target')).toBeTruthy();
  });

  it('shows recommendations in one priorities panel near the top of home', () => {
    const { container } = render(
      <Dashboard
        summary={summariseDay('2026-01-01', [])}
        entries={[]}
        targets={DEFAULT_TARGETS}
        recommendations={[{ id: 'electrolytes', priority: 'warning', message: 'Top up electrolytes today.' }]}
        onAddFood={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Today's priorities")).toHaveLength(1);
    expect(screen.getByText('Top up electrolytes today.')).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text.indexOf("Today's priorities")).toBeLessThan(text.indexOf('Daily progress'));
    expect(screen.queryByText('Needs attention')).toBeNull();
    expect(screen.queryByText('What to fix next')).toBeNull();
  });

  it('shows synced Garmin steps when activity is available', () => {
    render(
      <Dashboard
        summary={summariseDay('2026-01-01', [])}
        entries={[]}
        activity={{
          id: 'steps-1',
          date: '2026-01-01',
          steps: 7420,
          source: 'garminHealthConnect',
          sourceLabel: 'Garmin via Health Connect',
          importedAt: '2026-01-01T08:00:00.000Z',
        }}
        targets={DEFAULT_TARGETS}
        recommendations={[]}
        onAddFood={vi.fn()}
      />,
    );

    expect(screen.getByText('Steps today')).toBeTruthy();
    expect(screen.getByText('7,420')).toBeTruthy();
  });

  it('shows a Garmin sync action on home when native sync is available', async () => {
    const onSyncGarmin = vi.fn(async () => 'Garmin sync complete.');
    render(
      <Dashboard
        summary={summariseDay('2026-01-01', [])}
        entries={[]}
        targets={DEFAULT_TARGETS}
        recommendations={[]}
        onAddFood={vi.fn()}
        onSyncGarmin={onSyncGarmin}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync Garmin' }));

    expect(onSyncGarmin).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Garmin sync complete.'));
  });

  it('keeps one concise, deduplicated priorities panel', () => {
    const summary: DailyNutritionSummary = {
      date: '2026-01-01',
      calories: 700,
      proteinG: 40,
      fatG: 50,
      totalCarbsG: 10,
      fibreG: 4,
      sugarAlcoholsG: 0,
      netCarbsG: 6,
      sodiumMg: 500,
      potassiumMg: 900,
      magnesiumMg: 80,
      entryCount: 2,
    };

    render(
      <Dashboard
        summary={summary}
        entries={[]}
        targets={DEFAULT_TARGETS}
        recommendations={[
          { id: 'protein-low', priority: 'info', message: '80g protein to go. Prioritise eggs, chicken, tuna, salmon, lean beef, or Greek yoghurt next.' },
          { id: 'calories-low-late', priority: 'warning', message: '1200 kcal remain late in the day. Add a simple protein-forward meal if this is not intentional.' },
          { id: 'sodium-low', priority: 'info', message: 'Sodium is low. Consider broth, salted meat, pickles, or an electrolyte drink.' },
          { id: 'magnesium-low', priority: 'info', message: 'Magnesium is low. Spinach, pumpkin seeds, almonds, or avocado are useful options.' },
        ]}
        onAddFood={vi.fn()}
      />,
    );

    expect(screen.getByText('Prioritise protein next.')).toBeTruthy();
    expect(screen.queryByText(/80g protein to go/)).toBeNull();
    expect(screen.queryByText(/protein-forward meal/)).toBeNull();
    expect(screen.getAllByText("Today's priorities")).toHaveLength(1);
    expect(screen.queryByText('Needs attention')).toBeNull();
    expect(screen.queryByText('What to fix next')).toBeNull();
  });
});
