import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Planner } from '../screens/Planner';
import type { Recipe } from '../types';

const recipe: Recipe = {
  id: 'recipe-1',
  name: 'Salmon bake',
  servings: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  ingredients: [{
    id: 'ing-1',
    name: 'Salmon',
    servingSize: '100g',
    quantity: 2,
    calories: 200,
    proteinG: 20,
    fatG: 12,
    totalCarbsG: 0,
    fibreG: 0,
    sugarAlcoholsG: 0,
    sodiumMg: 80,
    potassiumMg: 300,
    magnesiumMg: 25,
  }],
};

describe('Planner screen', () => {
  it('rejects recipe plan servings that are not greater than zero', () => {
    const onSavePlan = vi.fn(() => true);
    render(<Planner plan={[]} savedFoods={[]} templates={[]} recipes={[recipe]} onSavePlan={onSavePlan} onConvertToLog={vi.fn(() => true)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recipe' }));
    fireEvent.change(screen.getByPlaceholderText(/Search recipes/), { target: { value: 'Salmon' } });
    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onSavePlan).not.toHaveBeenCalled();
    expect(screen.getByText('Servings must be greater than zero.')).toBeTruthy();
  });
});
