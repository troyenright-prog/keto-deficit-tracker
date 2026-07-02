import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => { vi.unstubAllGlobals(); });

  it('quick-adds a favourite with the selected serving quantity', () => {
    const onAddEntries = vi.fn(() => true);
    render(<AddFood savedFoods={[favourite]} foodDatabase={[]} log={[recent]} recipes={[]} templates={[]} onAdd={vi.fn(() => true)} onAddEntries={onAddEntries} onSaveFood={vi.fn(() => true)} />);
    fireEvent.click(screen.getByRole('button', { name: /Favourite Eggs/ }));
    const preview = () => screen.getByLabelText('Selected food nutrition for chosen servings').textContent ?? '';
    expect(preview()).toContain('140 kcal');
    expect(preview()).toContain('1.0g net carbs');
    fireEvent.click(screen.getByRole('button', { name: '1.5x' }));
    expect(preview()).toContain('210 kcal');
    expect(preview()).toContain('1.5g net carbs');
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

  it('quick-adds common boiled egg quantities to the selected meal', () => {
    const onAddEntries = vi.fn(() => true);
    render(<AddFood savedFoods={[]} foodDatabase={[]} log={[]} recipes={[]} templates={[]} onAdd={vi.fn(() => true)} onAddEntries={onAddEntries} onSaveFood={vi.fn(() => true)} />);

    fireEvent.change(screen.getByLabelText('Meal'), { target: { value: 'lunch' } });
    fireEvent.click(screen.getByRole('button', { name: '2 eggs' }));
    expect(screen.getByLabelText('Selected food nutrition for chosen servings').textContent).toContain('156 kcal');
    fireEvent.click(screen.getByRole('button', { name: /Add to today/ }));

    expect(onAddEntries).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Boiled egg (large)',
        meal: 'lunch',
        servingMultiplier: 2,
        calories: 156,
      }),
    ]);
  });

  it('searches Open Food Facts by name, logs the hit, and caches it locally', async () => {
    const onAddEntries = vi.fn(() => true);
    const onSaveFoodDatabaseItem = vi.fn(() => true);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      results: [{
        barcode: '1234567890123', name: 'Cheddar cheese', brand: 'Dairyland', servingSize: '100g',
        dataBasis: '100g', calories: 400, proteinG: 25, fatG: 33, totalCarbsG: 1, fibreG: 0,
        sugarAlcoholsG: 0, sodiumMg: 600, potassiumMg: 0, magnesiumMg: 0, attribution: 'Open Food Facts',
      }],
    })));

    render(<AddFood savedFoods={[]} foodDatabase={[]} log={[]} recipes={[]} templates={[]} onAdd={vi.fn(() => true)} onAddEntries={onAddEntries} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={onSaveFoodDatabaseItem} />);

    fireEvent.change(screen.getByPlaceholderText(/Search foods/), { target: { value: 'cheddar' } });
    const hit = await screen.findByRole('button', { name: /Cheddar cheese \(Dairyland\)/ });
    fireEvent.click(hit);
    fireEvent.click(screen.getByRole('button', { name: /Add to today/ }));

    expect(onAddEntries).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Cheddar cheese (Dairyland)', source: 'barcode', calories: 400 }),
    ]);
    expect(onSaveFoodDatabaseItem).toHaveBeenCalledWith(
      expect.objectContaining({ barcode: '1234567890123', source: 'openFoodFacts' }),
    );
  });

  it('does not create entries with a cleared log date', () => {
    const onAddEntries = vi.fn(() => true);
    render(<AddFood savedFoods={[favourite]} foodDatabase={[]} log={[]} recipes={[]} templates={[]} onAdd={vi.fn(() => true)} onAddEntries={onAddEntries} onSaveFood={vi.fn(() => true)} />);

    fireEvent.change(screen.getByLabelText('Add to date'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Favourite Eggs/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to' }));

    expect(onAddEntries).not.toHaveBeenCalled();
    expect(screen.getByText('Choose a valid log date that is not in the future.')).toBeTruthy();
  });
});
