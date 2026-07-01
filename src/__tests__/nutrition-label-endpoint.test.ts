// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { handleParseNutritionLabel } from '../../functions/api/parse-nutrition-label';
import { MICRONUTRIENT_KEYS } from '../lib/micronutrients';

function labelPayload(overrides: Record<string, unknown> = {}) {
  const nutrients = MICRONUTRIENT_KEYS.reduce((result, key) => {
    result[key] = 0;
    return result;
  }, {} as Record<string, number>);

  return {
    productName: 'Label Almond Bar',
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
    ...nutrients,
    vitaminCMg: 12,
    folateMcg: 90,
    confidence: 0.86,
    warnings: ['Some small text was unclear.'],
    ...overrides,
  };
}

function requestWithImage(file = new File(['fake image'], 'label.jpg', { type: 'image/jpeg' }), barcode = '7777') {
  const form = new FormData();
  form.append('image', file);
  form.append('barcode', barcode);
  return new Request('https://example.com/api/parse-nutrition-label', { method: 'POST', body: form });
}

describe('nutrition label parser endpoint', () => {
  it('requires server-side OpenAI configuration', async () => {
    const response = await handleParseNutritionLabel(requestWithImage());
    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('not configured') });
  });

  it('rejects non-image uploads', async () => {
    const response = await handleParseNutritionLabel(
      requestWithImage(new File(['not an image'], 'label.txt', { type: 'text/plain' })),
      { OPENAI_API_KEY: 'test-key' },
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('JPG') });
  });

  it('parses a label photo into barcode food nutrition', async () => {
    const fetcher = vi.fn(async (_input: unknown, init?: { body?: unknown }) => {
      const payload = JSON.parse(String(init?.body));
      expect(payload.model).toBe('gpt-5.5');
      expect(payload.input[0].content[1].type).toBe('input_image');
      expect(payload.input[0].content[1].image_url).toContain('data:image/jpeg;base64,');
      expect(payload.text.format.type).toBe('json_schema');
      return Response.json({ output_text: JSON.stringify(labelPayload()) });
    }) as unknown as typeof fetch;

    const response = await handleParseNutritionLabel(
      requestWithImage(),
      { OPENAI_API_KEY: 'test-key' },
      fetcher,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      barcode: '7777',
      name: 'Label Almond Bar',
      brand: 'Keto Co',
      servingSize: '1 bar (45g)',
      calories: 210,
      fibreG: 12,
      vitaminCMg: 12,
      folateMcg: 90,
      attribution: 'Nutrition label photo',
      warnings: ['Some small text was unclear.'],
    });
  });
});
