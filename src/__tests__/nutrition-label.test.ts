import { describe, expect, it, vi } from 'vitest';
import { parseNutritionLabelPhoto } from '../lib/nutrition-label';

describe('nutrition label photo client', () => {
  it('posts a label image and normalizes the returned barcode food', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain('/api/parse-nutrition-label');
      expect(init?.method).toBe('POST');
      expect(init?.body).toBeInstanceOf(FormData);
      return Response.json({
        barcode: '7777',
        name: 'Label Almond Bar',
        brand: 'Keto Co',
        servingSize: '1 bar (45g)',
        dataBasis: 'serving',
        calories: 210,
        proteinG: 8,
        fatG: 14,
        totalCarbsG: 18,
        fibreG: 12,
        sugarAlcoholsG: 2,
        sodiumMg: 120,
        potassiumMg: 80,
        magnesiumMg: 35,
        vitaminCMg: 12,
        attribution: 'Nutrition label photo',
      });
    }) as unknown as typeof fetch;

    await expect(parseNutritionLabelPhoto(new File(['fake'], 'label.jpg', { type: 'image/jpeg' }), '7777', fetcher)).resolves.toMatchObject({
      barcode: '7777',
      name: 'Label Almond Bar',
      brand: 'Keto Co',
      calories: 210,
      totalCarbsG: 18,
      fibreG: 12,
      vitaminCMg: 12,
      attribution: 'Nutrition label photo',
    });
  });

  it('requires a barcode before sending a label photo', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(parseNutritionLabelPhoto(new File(['fake'], 'label.jpg', { type: 'image/jpeg' }), '', fetcher))
      .rejects.toThrow('valid barcode');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
