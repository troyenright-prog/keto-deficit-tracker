import { describe, expect, it, vi } from 'vitest';
import { foodSearchUrls, MIN_FOOD_SEARCH_LENGTH, searchFoodsByName } from '../lib/food-search';

describe('foodSearchUrls', () => {
  it('returns no urls for a too-short query', () => {
    expect(foodSearchUrls('a')).toEqual([]);
    expect('a'.length).toBeLessThan(MIN_FOOD_SEARCH_LENGTH);
  });

  it('prefers the local Pages function, then Search-a-licious, then the legacy cgi fallback', () => {
    const urls = foodSearchUrls('cheddar');
    expect(urls[0]).toBe('/api/search-foods?q=cheddar');
    const searchalicious = urls.findIndex((url) => url.includes('search.openfoodfacts.org/search'));
    const legacy = urls.findIndex((url) => url.includes('world.openfoodfacts.org/cgi/search.pl'));
    expect(searchalicious).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(-1);
    // Reliable Search-a-licious must be tried before the flaky legacy endpoint.
    expect(searchalicious).toBeLessThan(legacy);
    expect(urls.some((url) => url.includes('search_terms=cheddar'))).toBe(true);
  });
});

describe('searchFoodsByName', () => {
  it('normalizes results returned by our own endpoint', async () => {
    const fetcher = vi.fn(async () => Response.json({
      results: [{
        barcode: '1234567890123',
        name: 'Cheddar cheese',
        servingSize: '100g',
        dataBasis: '100g',
        calories: 400,
        proteinG: 25,
        fatG: 33,
        totalCarbsG: 1,
        fibreG: 0,
        sugarAlcoholsG: 0,
        sodiumMg: 600,
        potassiumMg: 0,
        magnesiumMg: 0,
        attribution: 'Open Food Facts',
      }],
    })) as unknown as typeof fetch;

    const foods = await searchFoodsByName('cheddar', fetcher);
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ barcode: '1234567890123', name: 'Cheddar cheese', calories: 400 });
  });

  it('normalizes raw Open Food Facts products and drops empty ones', async () => {
    const fetcher = vi.fn(async () => Response.json({
      products: [
        { code: '111', product_name: 'Almonds', nutriments: { 'energy-kcal_100g': 600, proteins_100g: 21 } },
        { code: '222', product_name: 'Nothing', nutriments: {} },
      ],
    })) as unknown as typeof fetch;

    const foods = await searchFoodsByName('almonds', fetcher);
    expect(foods.map((f) => f.name)).toEqual(['Almonds']);
    expect(foods[0].attribution).toBe('Open Food Facts');
  });

  it('normalizes Search-a-licious hits and coerces array brands', async () => {
    const fetcher = vi.fn(async () => Response.json({
      hits: [
        { code: '333', product_name: 'Cheddar', brands: ['Dairyland'], nutriments: { 'energy-kcal_100g': 410, proteins_100g: 25 } },
      ],
    })) as unknown as typeof fetch;

    const foods = await searchFoodsByName('cheddar', fetcher);
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ barcode: '333', name: 'Cheddar', brand: 'Dairyland', calories: 410 });
  });

  it('throws a friendly, non-blaming error when every endpoint is unreachable', async () => {
    const fetcher = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    // Browser reports online in jsdom, so the message must not blame the connection.
    await expect(searchFoodsByName('cheddar', fetcher)).rejects.toThrow(/food database is busy/);
  });
});
