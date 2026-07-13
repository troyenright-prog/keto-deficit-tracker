import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { FoodForm } from '../components/FoodForm';
import { foodItemToTemplateItem, templateToLogEntries } from '../lib/meal-templates';
import { calcRecipePerServing, recipeToLogEntry } from '../lib/recipes';
import { summariseDay } from '../lib/nutrition';
import { Dashboard } from '../screens/Dashboard';
import { DEFAULT_TARGETS } from '../lib/storage';
import type { FoodItem, MealTemplate, Recipe } from '../types';

const food: FoodItem = {
  id: 'f', name: 'Salmon', servingSize: '100g', calories: 200, proteinG: 20, fatG: 10,
  totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 50, potassiumMg: 400,
  magnesiumMg: 30, calciumMg: 12, vitaminCMg: 18, folateMcg: 40, omega3G: 2, createdAt: '2026-01-01T00:00:00Z',
};

describe('micronutrient snapshots', () => {
  it('preserves saved food micronutrients through templates and logs', () => {
    const template: MealTemplate = { id: 't', name: 'Meal', items: [foodItemToTemplateItem(food, 2)], createdAt: food.createdAt };
    food.calciumMg = 99;
    const entry = templateToLogEntries(template, '2026-01-01')[0];
    expect(entry.calciumMg).toBe(24);
    expect(entry.vitaminCMg).toBe(36);
    expect(entry.folateMcg).toBe(80);
    expect(entry.omega3G).toBe(4);
    expect(summariseDay('2026-01-01', [entry]).calciumMg).toBe(24);
    expect(summariseDay('2026-01-01', [entry]).vitaminCMg).toBe(36);
  });

  it('preserves recipe micronutrients per serving and in final consumed totals', () => {
    const recipe: Recipe = {
      id: 'r', name: 'Fish', servings: 2, createdAt: food.createdAt,
      ingredients: [{ ...foodItemToTemplateItem(food, 2), id: 'i' }],
    };
    expect(calcRecipePerServing(recipe).omega3G).toBe(2);
    expect(recipeToLogEntry(recipe, 2, '2026-01-01').omega3G).toBe(4);
    expect(recipeToLogEntry(recipe, 2, '2026-01-01').folateMcg).toBe(80);
  });

  it('captures expanded micronutrients from manual food entry', () => {
    const onSubmit = vi.fn();
    render(createElement(FoodForm, { onSubmit }));

    fireEvent.change(screen.getByLabelText('Food name *'), { target: { value: 'Multivitamin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show micronutrients' }));
    fireEvent.change(screen.getByLabelText('Vitamin C (mg)'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('Folate (mcg)'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('Iodine (mcg)'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Log' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Multivitamin',
      vitaminCMg: 90,
      folateMcg: 400,
      iodineMcg: 150,
    }));
  });

  it('shows micronutrient and vitamin target progress on the dashboard', () => {
    const entry = recipeToLogEntry({
      id: 'r',
      name: 'Supplement',
      servings: 1,
      createdAt: food.createdAt,
      ingredients: [{ ...foodItemToTemplateItem(food, 1), id: 'i' }],
    }, 1, '2026-01-01');
    const summary = summariseDay('2026-01-01', [entry]);

    render(createElement(Dashboard, {
      summary,
      entries: [entry],
      targets: { ...DEFAULT_TARGETS, vitaminCMg: 90, folateMcg: 400 },
      recommendations: [],
      onAddFood: vi.fn(),
    }));

    expect(screen.getByText('Micronutrients & vitamins')).toBeTruthy();
    expect(screen.getByText('Vitamin C')).toBeTruthy();
    expect(screen.getByText('18.0 mg / 90.0 mg')).toBeTruthy();
    expect(screen.getByText('Folate')).toBeTruthy();
    expect(screen.getByText('40.0 mcg / 400.0 mcg')).toBeTruthy();
  });

  it('keeps unlogged targeted micronutrients hidden until the user shows all nutrients', () => {
    const entry = recipeToLogEntry({
      id: 'r',
      name: 'Supplement',
      servings: 1,
      createdAt: food.createdAt,
      ingredients: [{ ...foodItemToTemplateItem(food, 1), id: 'i' }],
    }, 1, '2026-01-01');
    const summary = summariseDay('2026-01-01', [entry]);

    render(createElement(Dashboard, {
      summary,
      entries: [entry],
      targets: { ...DEFAULT_TARGETS, vitaminCMg: 90, vitaminAMcg: 900 },
      recommendations: [],
      onAddFood: vi.fn(),
    }));

    expect(screen.getByText('Vitamin C')).toBeTruthy();
    expect(screen.queryByText('Vitamin A')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show all 25 nutrients' }));

    expect(screen.getByRole('button', { name: 'Show logged only' })).toBeTruthy();
    expect(screen.getByText('Vitamin A')).toBeTruthy();
    expect(screen.getByText('0.0 mcg / 900.0 mcg')).toBeTruthy();
  });
});
