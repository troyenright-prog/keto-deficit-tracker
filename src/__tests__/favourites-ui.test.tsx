import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SavedFoods } from '../screens/SavedFoods';
import type { FoodItem } from '../types';

const savedFood: FoodItem = {
  id: 'food', name: 'Eggs', servingSize: '2 eggs', calories: 140, proteinG: 12,
  fatG: 10, totalCarbsG: 1, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 120,
  potassiumMg: 100, magnesiumMg: 10, createdAt: '2026-01-01T00:00:00.000Z',
  isFavourite: false,
};

describe('saved food favourites', () => {
  it('marks and unmarks a saved food through the existing save boundary', () => {
    const onSave = vi.fn(() => true);
    const { rerender } = render(<SavedFoods foods={[savedFood]} onSave={onSave} onDelete={vi.fn()} onAddToLog={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Favourite Eggs' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'food', isFavourite: true }));

    rerender(<SavedFoods foods={[{ ...savedFood, isFavourite: true }]} onSave={onSave} onDelete={vi.fn()} onAddToLog={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Unfavourite Eggs' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'food', isFavourite: false }));
  });
});
