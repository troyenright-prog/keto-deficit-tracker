// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { handleLookupBarcode } from '../../functions/api/lookup-barcode';

describe('barcode lookup endpoint', () => {
  it('rejects a missing barcode', async () => {
    const response = await handleLookupBarcode(new Request('https://example.com/api/lookup-barcode'));
    expect(response.status).toBe(400);
  });

  it('maps missing products clearly', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
    const response = await handleLookupBarcode(new Request('https://example.com/api/lookup-barcode?code=123'), {}, fetcher);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('No food') });
  });

  it('returns normalized Open Food Facts data with attribution', async () => {
    const fetcher = vi.fn(async () => Response.json({
      code: '1234567890123',
      product: {
        code: '1234567890123',
        product_name: 'Cheese snack',
        nutriments: {
          'energy-kcal_100g': 400,
          proteins_100g: 25,
          fat_100g: 32,
          carbohydrates_100g: 2,
          fiber_100g: 0,
          sodium_100g: 0.5,
          sodium_unit: 'g',
        },
      },
    })) as unknown as typeof fetch;
    const response = await handleLookupBarcode(new Request('https://example.com/api/lookup-barcode?code=1234567890123'), {}, fetcher);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      barcode: '1234567890123',
      name: 'Cheese snack',
      servingSize: '100g',
      sodiumMg: 500,
      attribution: 'Open Food Facts',
    });
  });
});
