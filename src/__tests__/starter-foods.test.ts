import { describe, expect, it } from 'vitest';
import { getStarterFoodOptions } from '../lib/australianFoods';
import { MICRONUTRIENT_KEYS } from '../lib/micronutrients';
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

  it('carries meaningful micronutrient panels on the core keto foods', () => {
    const byName = (name: string) => {
      const food = getStarterFoodOptions().find((f) => f.name === name);
      expect(food, name).toBeDefined();
      return food!;
    };

    // Spot-check the flagship values per food (per listed serving).
    expect(byName('Eggs (whole, large)')).toMatchObject({ cholineMg: 147, biotinMcg: 10, vitaminDMcg: 1.1, seleniumMcg: 15 });
    expect(byName('Salmon (Atlantic, raw)')).toMatchObject({ vitaminDMcg: 11, omega3G: 2.2, vitaminB12Mcg: 3.2, saturatedFatG: 3.1 });
    expect(byName('Spinach (raw)')).toMatchObject({ vitaminKMcg: 483, folateMcg: 194, ironMg: 2.7 });
    expect(byName('Avocado')).toMatchObject({ folateMcg: 81, pantothenicAcidMg: 1.4, vitaminEMg: 2.1 });
    expect(byName('Cheddar cheese')).toMatchObject({ calciumMg: 216, saturatedFatG: 5.9 });
    expect(byName('Beef mince 80/20 (raw)')).toMatchObject({ zincMg: 4.2, vitaminB12Mcg: 2.1, saturatedFatG: 7.6 });

    // Every enriched core food should report at least 8 micronutrient fields.
    const coreFoods = [
      'Eggs (whole, large)', 'Chicken breast (raw, skinless)', 'Beef eye fillet (raw)', 'Beef mince 80/20 (raw)',
      'Salmon (Atlantic, raw)', 'Tuna (canned in water, drained)', 'Avocado', 'Spinach (raw)', 'Broccoli (raw)',
      'Cauliflower (raw)', 'Mushrooms (button, raw)', 'Cheddar cheese', 'Greek yoghurt (full fat, plain)',
      'Almonds (raw)',
    ];
    for (const name of coreFoods) {
      const food = byName(name);
      const microCount = MICRONUTRIENT_KEYS.filter((key) => typeof food[key] === 'number').length;
      expect(microCount, `${name} has ${microCount} micronutrient fields`).toBeGreaterThanOrEqual(8);
    }
  });

  it('keeps the original macro values unchanged after enrichment', () => {
    expect(getStarterFoodOptions().find((f) => f.name === 'Eggs (whole, large)')).toMatchObject({
      calories: 78, proteinG: 6.3, fatG: 5.3, totalCarbsG: 0.6, sodiumMg: 62, potassiumMg: 63, magnesiumMg: 6,
    });
    expect(getStarterFoodOptions().find((f) => f.name === 'Salmon (Atlantic, raw)')).toMatchObject({
      calories: 208, proteinG: 20.0, fatG: 13.0, sodiumMg: 59, potassiumMg: 490, magnesiumMg: 29,
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

  it('includes the two label-verified Musashi protein wafers', () => {
    const byBarcode = (barcode: string) => getStarterFoodOptions().find((food) => food.barcode === barcode);

    expect(byBarcode('9400581052855')).toMatchObject({
      name: 'Musashi Protein Wafer — White Chocolate',
      servingSize: '1 wafer (40g)',
      calories: 216,
      proteinG: 10,
      fatG: 13.1,
      totalCarbsG: 9.7,
      fibreG: 0,
      sugarAlcoholsG: 4.8,
      sodiumMg: 59,
      saturatedFatG: 7.3,
    });
    expect(byBarcode('9400581053869')).toMatchObject({
      name: 'Musashi Protein Wafer — White Choc Caramel',
      servingSize: '1 wafer (40g)',
      calories: 215,
      proteinG: 10,
      fatG: 13.2,
      totalCarbsG: 9.6,
      fibreG: 0,
      sugarAlcoholsG: 7.2,
      sodiumMg: 96,
      saturatedFatG: 7.3,
    });
  });
});
