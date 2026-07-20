import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Meals } from '../screens/Meals';
import type { FoodItem } from '../types';

const ghee: FoodItem = {
  id: 'ghee',
  name: 'Sol Ghee (grass fed)',
  servingSize: '10g',
  calories: 88,
  proteinG: 0.1,
  fatG: 10,
  totalCarbsG: 0,
  fibreG: 0,
  sugarAlcoholsG: 0,
  sodiumMg: 0,
  potassiumMg: 0,
  magnesiumMg: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('Meals template editor', () => {
  it('allows the serving quantity to be cleared and replaced on mobile', () => {
    const onSave = vi.fn(() => true);
    render(
      <Meals
        templates={[]}
        savedFoods={[ghee]}
        onSave={onSave}
        onDelete={vi.fn()}
        onAddToLog={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Steak & Ghee' } });
    fireEvent.change(screen.getByPlaceholderText('Search your food library…'), { target: { value: 'ghee' } });
    fireEvent.click(screen.getByRole('button', { name: /Sol Ghee/ }));

    const quantity = screen.getByLabelText('Servings of Sol Ghee (grass fed)') as HTMLInputElement;
    expect(quantity.value).toBe('1');

    fireEvent.change(quantity, { target: { value: '' } });
    expect(quantity.value).toBe('');

    fireEvent.change(quantity, { target: { value: '4' } });
    expect(quantity.value).toBe('4');
    expect(screen.getByText('352 kcal')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Steak & Ghee',
      items: [expect.objectContaining({ name: 'Sol Ghee (grass fed)', quantity: 4 })],
    }));
  });
});
