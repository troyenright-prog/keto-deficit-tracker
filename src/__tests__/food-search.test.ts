import { describe, expect, it, vi } from 'vitest';
import { foodSearchUrls, MIN_FOOD_SEARCH_LENGTH, searchFoodsByName } from '../lib/food-search';

describe('foodSearchUrls', () => {
  it('returns no urls for a too-short query', () => {
    expect(foodSearchUrls('a')).toEqual([]);
    expect('a'.length).toBeLessThan(MIN_FOOD_SEARCH_LENGTH);
  });

  it('prefers the local Pages function and keeps a direct Open Food Facts fallback', () => {
    const urls = foodSearchUrls('cheddar');
    expect(urls[0]).toBe('/api/search-foods?q=cheddar');
    expect(urls.some((url) => url.includes('world.openfoodfacts.org/cgi/search.pl'))).toBe(true);
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

  it('throws a friendly error when every endpoint is unreachable', async () => {
    const fetcher = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    await expect(searchFoodsByName('cheddar', fetcher)).rejects.toThrow(/Could not reach the food database/);
  });
});
