import { describe, expect, it } from 'vitest';
import { getStarterFoodOptions } from '../lib/australianFoods';
import { buildQuickAddGroups } from '../lib/quick-add';

describe('starter foods', () => {
  it('includes Swisse Ultivite as a micronutrient-only supplement', () => {
    const supplement = getStarterFoodOptions().find((food) => food.name === "Swisse Ultivite Men's Multivitamin");

    expect(supplement).toMatchObject({
      servingSize: '1 tablet',
      calories: 0,
      proteinG: 0,
      fatG: 0,
      totalCarbsG: 0,
      potassiumMg: 4,
      magnesiumMg: 105,
      vitaminCMg: 165,
      vitaminDMcg: 25,
      folateMcg: 500,
      vitaminB12Mcg: 50,
    });
  });

  it('surfaces Swisse Ultivite from quick-add search', () => {
    const groups = buildQuickAddGroups({
      query: 'ultivite',
      savedFoods: [],
      foodDatabase: [],
      recentFoods: [],
      recipes: [],
      templates: [],
      starterFoods: getStarterFoodOptions(),
      remoteFoods: [],
    });

    expect(groups.find((group) => group.key === 'starters')?.items[0].name)
      .toBe("Swisse Ultivite Men's Multivitamin");
  });
});
