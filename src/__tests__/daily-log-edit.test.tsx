import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DailyLog } from '../screens/DailyLog';
import { todayDateString } from '../lib/nutrition';
import { addLocalDays } from '../lib/date';
import type { FoodLogEntry } from '../types';

// DailyLog defaults its date picker to today, so the fixture must log against
// today's date to be visible without also driving the date input.
const today = todayDateString();

// Base entry logged at a 0.5x serving multiplier: per-serving values are
// double these totals (280 kcal/serving * 0.5 = 140 kcal logged).
function makeEntry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: 'e1',
    date: today,
    name: 'Salmon fillet',
    servingSize: '100g',
    servingMultiplier: 0.5,
    calories: 140,
    proteinG: 20,
    fatG: 8,
    totalCarbsG: 0,
    fibreG: 0,
    sugarAlcoholsG: 0,
    sodiumMg: 30,
    potassiumMg: 245,
    magnesiumMg: 14.5,
    vitaminDMcg: 6,
    loggedAt: `${today}T08:00:00.000Z`,
    ...overrides,
  };
}

// Opens the edit form for the entry and saves without changing any field.
function openAndSaveUnchanged(entry: FoodLogEntry, onEdit: (e: FoodLogEntry) => boolean) {
  render(
    <DailyLog
      log={[entry]}
      savedFoods={[]}
      onDelete={vi.fn()}
      onEdit={onEdit}
      onMove={vi.fn(() => true)}
      onDuplicate={vi.fn(() => true)}
      onSaveFood={vi.fn(() => true)}
      onAddFood={vi.fn()}
    />,
  );
  // Expand the row, then open edit mode.
  fireEvent.click(screen.getByText(entry.name));
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
}

describe('DailyLog edit preserves fractional-serving totals', () => {
  it('does not halve a 0.5x serving entry when saved unchanged', () => {
    const entry = makeEntry({ servingMultiplier: 0.5 });
    const onEdit = vi.fn(() => true);
    openAndSaveUnchanged(entry, onEdit);

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        servingMultiplier: 0.5,
        calories: 140,
        proteinG: 20,
        fatG: 8,
        sodiumMg: 30,
        potassiumMg: 245,
        magnesiumMg: 14.5,
        vitaminDMcg: 6,
      }),
    );
  });

  it('preserves totals for a 1x serving entry when saved unchanged', () => {
    const entry = makeEntry({
      servingMultiplier: 1, calories: 280, proteinG: 40, fatG: 16,
      sodiumMg: 60, potassiumMg: 490, magnesiumMg: 29, vitaminDMcg: 12,
    });
    const onEdit = vi.fn(() => true);
    openAndSaveUnchanged(entry, onEdit);

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        servingMultiplier: 1, calories: 280, proteinG: 40, fatG: 16,
        sodiumMg: 60, potassiumMg: 490, magnesiumMg: 29, vitaminDMcg: 12,
      }),
    );
  });

  it('preserves totals for a 2x serving entry when saved unchanged', () => {
    const entry = makeEntry({
      servingMultiplier: 2, calories: 560, proteinG: 80, fatG: 32,
      sodiumMg: 120, potassiumMg: 980, magnesiumMg: 58, vitaminDMcg: 24,
    });
    const onEdit = vi.fn(() => true);
    openAndSaveUnchanged(entry, onEdit);

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        servingMultiplier: 2, calories: 560, proteinG: 80, fatG: 32,
        sodiumMg: 120, potassiumMg: 980, magnesiumMg: 58, vitaminDMcg: 24,
      }),
    );
  });

  it('repeated unchanged saves of a 0.5x entry stay stable, not halved each time', () => {
    const entry = makeEntry({ servingMultiplier: 0.5 });
    let current = entry;
    const onEdit = vi.fn((updated: FoodLogEntry) => { current = updated; return true; });
    const { unmount } = render(
      <DailyLog log={[current]} savedFoods={[]} onDelete={vi.fn()} onEdit={onEdit} onMove={vi.fn(() => true)} onDuplicate={vi.fn(() => true)} onSaveFood={vi.fn(() => true)} onAddFood={vi.fn()} />,
    );
    fireEvent.click(screen.getByText(entry.name));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    unmount();

    // Re-render with the entry as the app would after persisting the first edit.
    render(
      <DailyLog log={[current]} savedFoods={[]} onDelete={vi.fn()} onEdit={onEdit} onMove={vi.fn(() => true)} onDuplicate={vi.fn(() => true)} onSaveFood={vi.fn(() => true)} onAddFood={vi.fn()} />,
    );
    fireEvent.click(screen.getByText(entry.name));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(current.calories).toBe(140);
    expect(current.potassiumMg).toBe(245);
  });
});

describe('DailyLog move to another day', () => {
  const yesterday = addLocalDays(today, -1);

  function renderLog(log: FoodLogEntry[], onMove = vi.fn(() => true)) {
    render(
      <DailyLog
        log={log}
        savedFoods={[]}
        onDelete={vi.fn()}
        onEdit={vi.fn(() => true)}
        onMove={onMove}
        onDuplicate={vi.fn(() => true)}
        onSaveFood={vi.fn(() => true)}
        onAddFood={vi.fn()}
      />,
    );
  }

  it('moves a single entry to the previous day', () => {
    const onMove = vi.fn(() => true);
    const entry = makeEntry();
    renderLog([entry], onMove);

    fireEvent.click(screen.getByText(entry.name));
    fireEvent.click(screen.getByRole('button', { name: '← Yesterday' }));

    expect(onMove).toHaveBeenCalledWith(['e1'], yesterday);
  });

  it('moves every item of a meal template together as one group', () => {
    const onMove = vi.fn(() => true);
    const a = makeEntry({ id: 't1', name: 'Steak & Ghee — Beef', templateId: 'tmpl', meal: 'breakfast' });
    const b = makeEntry({ id: 't2', name: 'Steak & Ghee — Ghee', templateId: 'tmpl', meal: 'breakfast' });
    renderLog([a, b], onMove);

    fireEvent.click(screen.getByText(a.name));
    expect(screen.getByText('moves all 2 meal items')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '← Yesterday' }));

    expect(onMove).toHaveBeenCalledWith(['t1', 't2'], yesterday);
  });
});
