// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { handleLookupBarcode } from '../../functions/api/lookup-barcode';

describe('barcode lookup endpoint', () => {
  it('rejects a missing barcode', async () => {
    const response = await handleLookupBarcode(new Request('https://example.com/api/lookup-barcode'));
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('maps missing products clearly', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
    const response = await handleLookupBarcode(new Request('https://example.com/api/lookup-barcode?code=123'), {}, fetcher);
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('No food') });
    expect(fetcher).toHaveBeenCalledTimes(1);
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
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=604800');
    await expect(response.json()).resolves.toMatchObject({
      barcode: '1234567890123',
      name: 'Cheese snack',
      servingSize: '100g',
      sodiumMg: 500,
      attribution: 'Open Food Facts',
    });
  });

  it('shares successful provider hits through the edge barcode cache', async () => {
    const stored = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (request: Request) => stored.get(request.url)?.clone()),
      put: vi.fn(async (request: Request, response: Response) => { stored.set(request.url, response.clone()); }),
    };
    const pending: Promise<unknown>[] = [];
    const fetcher = vi.fn(async () => Response.json({
      code: '036000291452',
      product: {
        code: '036000291452',
        product_name: 'Cached cereal',
        nutriments: { 'energy-kcal_100g': 370, proteins_100g: 8 },
      },
    })) as unknown as typeof fetch;

    const first = await handleLookupBarcode(
      new Request('https://example.com/api/lookup-barcode?code=036000291452'),
      {}, fetcher, cache, (promise) => pending.push(promise),
    );
    expect(first.status).toBe(200);
    await Promise.all(pending);

    const second = await handleLookupBarcode(
      new Request('https://example.com/api/lookup-barcode?code=0036000291452'),
      {}, fetcher, cache,
    );
    await expect(second.json()).resolves.toMatchObject({ name: 'Cached cereal' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns found Open Food Facts products with zero macro nutrition', async () => {
    const fetcher = vi.fn(async () => Response.json({
      code: '9311770608800',
      product: {
        code: '9311770608800',
        product_name: 'Mens multivitamin',
        brands: 'Swisse',
        serving_size: '1 tablet',
        nutriments: {},
      },
    })) as unknown as typeof fetch;
    const response = await handleLookupBarcode(new Request('https://example.com/api/lookup-barcode?code=9311770608800'), {}, fetcher);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      barcode: '9311770608800',
      name: 'Mens multivitamin',
      brand: 'Swisse',
      servingSize: '1 tablet',
      calories: 0,
      proteinG: 0,
      fatG: 0,
      totalCarbsG: 0,
      attribution: 'Open Food Facts',
    });
  });

  it('falls back to USDA FoodData Central and converts per-100g nutrition to per-serving', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('openfoodfacts')) return new Response('{}', { status: 429 });
      return Response.json({
        foods: [{
          fdcId: 123,
          gtinUpc: '1234567890123',
          description: 'USDA Cheese Snack',
          brandOwner: 'USDA Brand',
          servingSize: 40,
          servingSizeUnit: 'g',
          // FDC branded foodNutrients are per 100g; a 40g serving must scale by 0.4.
          foodNutrients: [
            { nutrientName: 'Energy', nutrientNumber: '208', value: 180 },
            { nutrientName: 'Protein', nutrientNumber: '203', value: 8 },
            { nutrientName: 'Total lipid (fat)', nutrientNumber: '204', value: 14 },
            { nutrientName: 'Carbohydrate, by difference', nutrientNumber: '205', value: 6 },
            { nutrientName: 'Fiber, total dietary', nutrientNumber: '291', value: 4 },
            { nutrientName: 'Sodium, Na', nutrientNumber: '307', value: 120 },
            { nutrientName: 'Fatty acids, total saturated', nutrientNumber: '606', value: 9 },
            { nutrientName: 'Pantothenic acid', nutrientNumber: '410', value: 1.5 },
            { nutrientName: 'Biotin', nutrientNumber: '416', value: 10 },
            { nutrientName: 'Choline, total', nutrientNumber: '421', value: 45 },
          ],
        }],
      });
    }) as unknown as typeof fetch;

    const response = await handleLookupBarcode(
      new Request('https://example.com/api/lookup-barcode?code=1234567890123'),
      { FOOD_DATA_CENTRAL_API_KEY: 'test-key' },
      fetcher,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      barcode: '1234567890123',
      name: 'USDA Cheese Snack',
      brand: 'USDA Brand',
      servingSize: '40g',
      dataBasis: 'serving',
      calories: 72,
      proteinG: 3.2,
      fatG: 5.6,
      totalCarbsG: 2.4,
      fibreG: 1.6,
      sodiumMg: 48,
      // Per-100g values scaled to the 40g serving, in FDC's own units.
      saturatedFatG: 3.6,
      pantothenicAcidMg: 0.6,
      biotinMcg: 4,
      cholineMg: 18,
      attribution: 'USDA FoodData Central',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps USDA foods per-100g when the serving unit is not a mass or volume', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('openfoodfacts')) return new Response('{}', { status: 404 });
      return Response.json({
        foods: [{
          fdcId: 456,
          gtinUpc: '1234567890123',
          description: 'USDA Snack Bar',
          servingSize: 1,
          servingSizeUnit: 'bar',
          foodNutrients: [
            { nutrientName: 'Energy', nutrientNumber: '208', value: 180 },
            { nutrientName: 'Protein', nutrientNumber: '203', value: 8 },
          ],
        }],
      });
    }) as unknown as typeof fetch;

    const response = await handleLookupBarcode(
      new Request('https://example.com/api/lookup-barcode?code=1234567890123'),
      { FOOD_DATA_CENTRAL_API_KEY: 'test-key' },
      fetcher,
    );

    expect(response.status).toBe(200);
    // The serving label and nutrition basis must agree: unknown serving unit
    // means the food is presented explicitly as per-100g, unscaled.
    await expect(response.json()).resolves.toMatchObject({
      name: 'USDA Snack Bar',
      servingSize: '100g',
      dataBasis: '100g',
      calories: 180,
      proteinG: 8,
    });
  });
});
