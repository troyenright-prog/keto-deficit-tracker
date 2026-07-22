import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DailyLog } from '../screens/DailyLog';
import { entrySourceLabel } from '../lib/log-source';
import { todayDateString } from '../lib/nutrition';
import type { FoodLogEntry } from '../types';

const today = todayDateString();

function makeEntry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: 'e1',
    date: today,
    name: 'Salmon fillet',
    servingSize: '100g',
    servingMultiplier: 1,
    calories: 280,
    proteinG: 40,
    fatG: 16,
    totalCarbsG: 0,
    fibreG: 0,
    sugarAlcoholsG: 0,
    sodiumMg: 60,
    potassiumMg: 490,
    magnesiumMg: 29,
    loggedAt: `${today}T08:00:00.000Z`,
    ...overrides,
  };
}

describe('entrySourceLabel', () => {
  it('labels every explicit log source', () => {
    expect(entrySourceLabel({ source: 'manual' })).toBe('Manual entry');
    expect(entrySourceLabel({ source: 'saved-food' })).toBe('Saved food');
    expect(entrySourceLabel({ source: 'template' })).toBe('Meal template');
    expect(entrySourceLabel({ source: 'recipe' })).toBe('Recipe');
    expect(entrySourceLabel({ source: 'plan' })).toBe('From plan');
    expect(entrySourceLabel({ source: 'barcode' })).toBe('Scanned barcode');
  });

  it('infers a source for legacy entries without one, and stays silent when it cannot', () => {
    expect(entrySourceLabel({ barcode: '9300675051132' })).toBe('Scanned barcode');
    expect(entrySourceLabel({ recipeId: 'r1' })).toBe('Recipe');
    expect(entrySourceLabel({ templateId: 't1' })).toBe('Meal template');
    expect(entrySourceLabel({ foodItemId: 'f1' })).toBe('Saved food');
    expect(entrySourceLabel({})).toBeUndefined();
  });

  it('prefers the explicit source over inferred ids', () => {
    expect(entrySourceLabel({ source: 'manual', barcode: '9300675051132' })).toBe('Manual entry');
  });
});

describe('DailyLog source visibility', () => {
  function renderLog(entry: FoodLogEntry) {
    render(
      <DailyLog
        log={[entry]}
        savedFoods={[]}
        onDelete={vi.fn()}
        onEdit={vi.fn(() => true)}
        onMove={vi.fn(() => true)}
        onDuplicate={vi.fn(() => true)}
        onSaveFood={vi.fn(() => true)}
        onAddFood={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(entry.name));
  }

  it('shows the nutrition source on an expanded scanned entry', () => {
    renderLog(makeEntry({ source: 'barcode', barcode: '9300675051132' }));
    expect(screen.getByText(/Scanned barcode/)).toBeTruthy();
  });

  it('shows no source text for a legacy entry with nothing to infer from', () => {
    renderLog(makeEntry());
    expect(screen.queryByText(/Manual entry|Saved food|Scanned barcode|Meal template|Recipe|From plan/)).toBeNull();
  });
});
