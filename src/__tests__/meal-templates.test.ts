import { describe, it, expect } from 'vitest';
import type { MealTemplate } from '../types';
import { calcTemplateTotals, calcItemsTotals, templateToLogEntries } from '../lib/meal-templates';

const template: MealTemplate = {
  id: 't1',
  name: 'Keto breakfast',
  createdAt: '2024-01-01T00:00:00Z',
  items: [
    {
      id: 'i1', name: 'Eggs', servingSize: '2 eggs', quantity: 1,
      calories: 156, proteinG: 12.6, fatG: 10.6, totalCarbsG: 1.2,
      fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 124, potassiumMg: 126, magnesiumMg: 12,
    },
    {
      id: 'i2', name: 'Bacon', servingSize: '2 rashers', quantity: 2,
      calories: 100, proteinG: 3, fatG: 9.3, totalCarbsG: 0.1,
      fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 430, potassiumMg: 65, magnesiumMg: 5,
    },
  ],
};

describe('calcTemplateTotals', () => {
  it('sums macros applying quantity multipliers', () => {
    const t = calcTemplateTotals(template);
    // bacon quantity=2, so bacon contribution is doubled
    expect(t.calories).toBeCloseTo(156 + 100 * 2, 1);
    expect(t.proteinG).toBeCloseTo(12.6 + 3 * 2, 1);
    expect(t.sodiumMg).toBeCloseTo(124 + 430 * 2, 0);
  });

  it('calculates net carbs correctly', () => {
    const t = calcTemplateTotals(template);
    // totalCarbs = 1.2 + 0.1*2 = 1.4, fibre=0, sa=0 → netCarbs = 1.4
    expect(t.netCarbsG).toBeCloseTo(1.4, 1);
  });
});

describe('calcItemsTotals', () => {
  it('returns zero totals for empty items', () => {
    const t = calcItemsTotals([]);
    expect(t.calories).toBe(0);
    expect(t.netCarbsG).toBe(0);
  });
});

describe('templateToLogEntries', () => {
  it('creates one log entry per template item', () => {
    const entries = templateToLogEntries(template, '2024-06-01');
    expect(entries).toHaveLength(2);
  });

  it('sets date and source correctly', () => {
    const entries = templateToLogEntries(template, '2024-06-01');
    expect(entries[0].date).toBe('2024-06-01');
    expect(entries[0].source).toBe('template');
    expect(entries[0].templateId).toBe('t1');
  });

  it('applies quantity to calories', () => {
    const entries = templateToLogEntries(template, '2024-06-01');
    // item i2 has quantity=2, calories=100 → entry calories = 200
    expect(entries[1].calories).toBe(200);
  });
});
