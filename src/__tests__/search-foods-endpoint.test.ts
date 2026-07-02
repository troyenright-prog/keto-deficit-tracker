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
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    await expect(response.json()).resolves.toEqual({ results: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('normalizes, filters empty, and de-duplicates search hits', async () => {
    const fetcher = vi.fn(async () => productPage()) as unknown as typeof fetch;
    const response = await handleSearchFoods(new Request('https://example.com/api/search-foods?q=cheddar'), {}, fetcher);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    const body = await response.json() as { results: Array<{ barcode: string; name: string; attribution: string; sodiumMg: number }> };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      barcode: '1111111111111',
      name: 'Cheddar cheese',
      attribution: 'Open Food Facts',
      sodiumMg: 600,
    });
  });

  it('normalizes Search-a-licious hits and coerces array brands', async () => {
    const fetcher = vi.fn(async () => Response.json({
      hits: [
        {
          code: '4444444444444',
          product_name: 'Cheddar block',
          brands: ['Dairyland'],
          nutriments: { 'energy-kcal_100g': 410, proteins_100g: 25, fat_100g: 34, carbohydrates_100g: 1 },
        },
      ],
    })) as unknown as typeof fetch;
    const response = await handleSearchFoods(new Request('https://example.com/api/search-foods?q=cheddar'), {}, fetcher);
    expect(response.status).toBe(200);
    const body = await response.json() as { results: Array<{ barcode: string; name: string; brand: string }> };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({ barcode: '4444444444444', name: 'Cheddar block', brand: 'Dairyland' });
  });

  it('surfaces upstream rate limiting', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 429 })) as unknown as typeof fetch;
    const response = await handleSearchFoods(new Request('https://example.com/api/search-foods?q=cheddar'), {}, fetcher);
    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('rate-limited') });
  });

  it('treats a generic upstream 5xx as temporary, not a hard failure', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    const response = await handleSearchFoods(new Request('https://example.com/api/search-foods?q=cheddar'), {}, fetcher);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('rate-limited') });
  });
});
