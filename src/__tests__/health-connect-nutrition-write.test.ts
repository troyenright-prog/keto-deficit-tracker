import { describe, expect, it, vi } from 'vitest';

// The native plugin's Nutrition serializer (Serializer.kt#toRecord) reads every
// one of these fields unconditionally - JSONException("No value for X") and a
// full app crash if any is missing from the record we hand it. This is the
// exact field list from that native switch case; regression-tests that
// writeNutritionRecords always supplies every one of them.
const REQUIRED_NUTRITION_FIELDS = [
  'startTime', 'endTime', 'name', 'mealType',
  'biotin', 'caffeine', 'calcium', 'energy', 'energyFromFat', 'chloride', 'cholesterol',
  'chromium', 'copper', 'dietaryFiber', 'folate', 'folicAcid', 'iodine', 'iron', 'magnesium',
  'manganese', 'molybdenum', 'monounsaturatedFat', 'niacin', 'pantothenicAcid', 'phosphorus',
  'polyunsaturatedFat', 'potassium', 'protein', 'riboflavin', 'saturatedFat', 'selenium',
  'sodium', 'sugar', 'thiamin', 'totalCarbohydrate', 'totalFat', 'transFat', 'unsaturatedFat',
  'vitaminA', 'vitaminB12', 'vitaminB6', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK', 'zinc',
];

const insertRecords = vi.fn().mockResolvedValue({ recordIds: ['id-1'] });

vi.mock('@kiwi-health/capacitor-health-connect', () => ({
  HealthConnect: {
    insertRecords: (...args: unknown[]) => insertRecords(...args),
  },
}));

describe('writeNutritionRecords', () => {
  it('includes every field the native Nutrition serializer reads unconditionally', async () => {
    const { writeNutritionRecords } = await import('../lib/health-connect');
    await writeNutritionRecords([{
      id: 'entry-1',
      time: '2026-07-05T12:00:00.000Z',
      name: 'Chicken breast',
      mealType: 2,
      calories: 250,
      proteinG: 45,
      totalCarbsG: 0,
      fatG: 6,
    }]);

    expect(insertRecords).toHaveBeenCalledTimes(1);
    const [{ records }] = insertRecords.mock.calls[0] as [{ records: Record<string, unknown>[] }];
    expect(records).toHaveLength(1);

    const record = records[0];
    const missing = REQUIRED_NUTRITION_FIELDS.filter((field) => !(field in record));
    expect(missing).toEqual([]);
  });

  it('does not call insertRecords for an empty payload list', async () => {
    insertRecords.mockClear();
    const { writeNutritionRecords } = await import('../lib/health-connect');
    const count = await writeNutritionRecords([]);
    expect(count).toBe(0);
    expect(insertRecords).not.toHaveBeenCalled();
  });
});
