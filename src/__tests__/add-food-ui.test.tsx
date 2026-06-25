import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AddFood } from '../screens/AddFood';
import type { FoodItem, FoodLogEntry } from '../types';

const favourite: FoodItem = {
  id: 'fav', name: 'Favourite Eggs', servingSize: '2 eggs', calories: 140, proteinG: 12,
  fatG: 10, totalCarbsG: 1, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 120,
  potassiumMg: 100, magnesiumMg: 10, createdAt: '2026-01-01T00:00:00.000Z', isFavourite: true,
};

const recent: FoodLogEntry = {
  id: 'recent', date: '2026-01-01', name: 'Recent Salmon', servingSize: '100g', servingMultiplier: 1,
  calories: 200, proteinG: 20, fatG: 10, totalCarbsG: 0, fibreG: 0,
  sugarAlcoholsG: 0, sodiumMg: 50, potassiumMg: 400, magnesiumMg: 30,
  loggedAt: '2026-01-01T08:00:00.000Z',
};

describe('Add Food quick logging', () => {
  it('quick-adds a favourite with the selected serving quantity', () => {
    const onAddEntries = vi.fn(() => true);
    render(<AddFood savedFoods={[favourite]} foodDatabase={[]} log={[recent]} recipes={[]} templates={[]} onAdd={vi.fn(() => true)} onAddEntries={onAddEntries} onSaveFood={vi.fn(() => true)} />);
    fireEvent.click(screen.getByRole('button', { name: /Favourite Eggs/ }));
    expect(screen.getByLabelText('Selected food nutrition per serving').textContent).toContain('1.0g net carbs');
    fireEvent.click(screen.getByRole('button', { name: '1.5x' }));
    fireEvent.click(screen.getByRole('button', { name: /Add to today/ }));
    expect(onAddEntries).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Favourite Eggs', servingMultiplier: 1.5, calories: 210 }),
    ]);
  });

  it('quick-adds a recent historical snapshot independently of saved foods', () => {
    const onAddEntries = vi.fn(() => true);
    render(<AddFood savedFoods={[]} foodDatabase={[]} log={[recent]} recipes={[]} templates={[]} onAdd={vi.fn(() => true)} onAddEntries={onAddEntries} onSaveFood={vi.fn(() => true)} />);
    fireEvent.click(screen.getByRole('button', { name: /Recent Salmon/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add to today/ }));
    expect(onAddEntries).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Recent Salmon', calories: 200, source: 'manual' }),
    ]);
  });
});
