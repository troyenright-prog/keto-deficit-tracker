import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Shopping } from '../screens/Shopping';
import type { MealTemplate, ShoppingItem } from '../types';

const template: MealTemplate = {
  id: 'template-1',
  name: 'Breakfast',
  mealType: 'breakfast',
  createdAt: '2026-01-01T00:00:00.000Z',
  items: [{
    id: 'item-1',
    name: 'Eggs',
    servingSize: '2 eggs',
    quantity: 1,
    calories: 140,
    proteinG: 12,
    fatG: 10,
    totalCarbsG: 1,
    fibreG: 0,
    sugarAlcoholsG: 0,
    sodiumMg: 120,
    potassiumMg: 100,
    magnesiumMg: 10,
  }],
};

const existing: ShoppingItem = {
  id: 'shop-1',
  name: 'Eggs',
  quantity: '2 eggs',
  completed: false,
  source: 'template',
  sourceId: 'template-1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('Shopping screen', () => {
  it('skips duplicate generated items from a template', () => {
    const onSave = vi.fn(() => true);
    render(<Shopping items={[existing]} templates={[template]} recipes={[]} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '+ Breakfast' }));

    expect(onSave).toHaveBeenCalledWith([existing]);
    expect(screen.getByText(/skipped 1 duplicate/i)).toBeTruthy();
  });
});
