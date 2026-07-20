import { describe, expect, it } from 'vitest';
import { implausibleMacroMassMessage, servingWeightGrams } from '../lib/nutrition-validation';

describe('nutrition mass validation', () => {
  it('extracts gram and kilogram serving weights', () => {
    expect(servingWeightGrams('1 wafer (40 g)')).toBe(40);
    expect(servingWeightGrams('40g')).toBe(40);
    expect(servingWeightGrams('0.04 kg')).toBe(40);
    expect(servingWeightGrams('250 ml')).toBeNull();
  });

  it('rejects macro weights that cannot fit in the serving', () => {
    expect(implausibleMacroMassMessage({
      servingSize: '1 wafer (40g)',
      proteinG: 400,
      fatG: 524,
      totalCarbsG: 388,
    })).toMatch(/cannot fit in a 40\.0g serving/);
  });

  it('allows realistic labels and small rounding differences', () => {
    expect(implausibleMacroMassMessage({
      servingSize: '40g',
      proteinG: 11.5,
      fatG: 13.2,
      totalCarbsG: 9.4,
    })).toBeNull();
    expect(implausibleMacroMassMessage({
      servingSize: '100g',
      proteinG: 34,
      fatG: 34,
      totalCarbsG: 34,
    })).toBeNull();
  });
});
