// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { handleSearchFoods } from '../../functions/api/search-foods';

const productPage = () => Response.json({
  products: [
    {
      code: '1111111111111',
      product_name: 'Cheddar cheese',
      brands: 'Dairyland',
      nutriments: {
        'energy-kcal_100g': 400,
        proteins_100g: 25,
        fat_100g: 33,
        carbohydrates_100g: 1,
        sodium_100g: 0.6,
        sodium_unit: 'g',
      },
    },
    {
      // No calories -> should be filtered out as noise.
      code: '2222222222222',
      product_name: 'Mystery water',
      nutriments: {},
    },
    {
      // Duplicate barcode of the first -> should be de-duplicated.
      code: '1111111111111',
      product_name: 'Cheddar cheese (dup)',
      nutriments: { 'energy-kcal_100g': 400, proteins_100g: 25 },
    },
  ],
});

describe('food search endpoint', () => {
  it('returns an empty list for too-short queries without calling upstream', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    const response = await handleSearchFoods(new Request('https://example.com/api/search-foods?q=a'), {}, fetcher);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ results: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('normalizes, filters empty, and de-duplicates search hits', async () => {
    const fetcher = vi.fn(async () => productPage()) as unknown as typeof fetch;
    const response = await handleSearchFoods(new Request('https://example.com/api/search-foods?q=cheddar'), {}, fetcher);
    expect(response.status).toBe(200);
    const body = await response.json() as { results: Array<{ barcode: string; name: string; attribution: string; sodiumMg: number }> };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      barcode: '1111111111111',
      name: 'Cheddar cheese',
      attribution: 'Open Food Facts',
      sodiumMg: 600,
    });
  });

  it('surfaces upstream rate limiting', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 429 })) as unknown as typeof fetch;
    const response = await handleSearchFoods(new Request('https://example.com/api/search-foods?q=cheddar'), {}, fetcher);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('rate-limited') });
  });
});
