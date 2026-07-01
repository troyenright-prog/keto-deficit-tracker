import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BarcodeScanner } from '../screens/BarcodeScanner';
import type { FoodDatabaseItem } from '../types';

const localFood: FoodDatabaseItem = {
  id: 'db-1',
  barcode: '1234567890123',
  name: 'Local Cheese',
  brand: 'Keto Co',
  source: 'openFoodFacts',
  servingSize: '100g',
  calories: 400,
  proteinG: 25,
  fatG: 32,
  totalCarbsG: 2,
  fibreG: 0,
  sugarAlcoholsG: 0,
  netCarbsG: 2,
  sodiumMg: 500,
  potassiumMg: 0,
  magnesiumMg: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const zeroCacheFood: FoodDatabaseItem = {
  ...localFood,
  id: 'db-zero',
  barcode: '9311770608800',
  name: 'Cached Multivitamin',
  brand: 'Swisse',
  servingSize: '1 tablet',
  calories: 0,
  proteinG: 0,
  fatG: 0,
  totalCarbsG: 0,
  fibreG: 0,
  sugarAlcoholsG: 0,
  netCarbsG: 0,
  sodiumMg: 0,
  potassiumMg: 0,
  magnesiumMg: 0,
};

describe('Barcode scanner screen', () => {
  it('looks up a manually entered barcode and logs a reviewed snapshot', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      barcode: '1234567890123',
      name: 'Cheese snack',
      servingSize: '100g',
      dataBasis: '100g',
      calories: 400,
      proteinG: 25,
      fatG: 32,
      totalCarbsG: 2,
      fibreG: 0,
      sugarAlcoholsG: 0,
      sodiumMg: 500,
      potassiumMg: 0,
      magnesiumMg: 0,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const onAdd = vi.fn(() => true);
    const onSaveFoodDatabaseItem = vi.fn(() => true);
    render(<BarcodeScanner foodDatabase={[]} onAdd={onAdd} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={onSaveFoodDatabaseItem} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '1234567890123' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));
    await screen.findByText('Cheese snack');
    expect(onSaveFoodDatabaseItem).toHaveBeenCalledWith(expect.objectContaining({
      barcode: '1234567890123',
      source: 'openFoodFacts',
    }));

    fireEvent.change(screen.getByLabelText('Servings'), { target: { value: '2' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to log' })[0]);
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      source: 'barcode',
      barcode: '1234567890123',
      calories: 800,
      totalCarbsG: 4,
    })));
  });

  it('labels and stores USDA fallback barcode hits distinctly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      barcode: '1234567890123',
      name: 'USDA Cheese Snack',
      brand: 'USDA Brand',
      attribution: 'USDA FoodData Central',
      attributionUrl: 'https://fdc.nal.usda.gov',
      servingSize: '40g',
      dataBasis: '100g',
      calories: 180,
      proteinG: 8,
      fatG: 14,
      totalCarbsG: 6,
      fibreG: 4,
      sugarAlcoholsG: 0,
      sodiumMg: 120,
      potassiumMg: 0,
      magnesiumMg: 0,
    })));
    const onSaveFoodDatabaseItem = vi.fn(() => true);
    render(<BarcodeScanner foodDatabase={[]} onAdd={vi.fn(() => true)} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={onSaveFoodDatabaseItem} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '1234567890123' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));

    await screen.findByText('USDA Cheese Snack');
    expect(screen.getByText('USDA FoodData Central')).toBeTruthy();
    expect(onSaveFoodDatabaseItem).toHaveBeenCalledWith(expect.objectContaining({
      barcode: '1234567890123',
      source: 'foodDataCentral',
    }));
  });

  it('shows and logs a found product with zero macro nutrition', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      barcode: '9311770608800',
      name: 'Mens multivitamin',
      brand: 'Swisse',
      servingSize: '1 tablet',
      dataBasis: 'serving',
      calories: 0,
      proteinG: 0,
      fatG: 0,
      totalCarbsG: 0,
      fibreG: 0,
      sugarAlcoholsG: 0,
      sodiumMg: 0,
      potassiumMg: 0,
      magnesiumMg: 0,
    })));
    const onAdd = vi.fn(() => true);
    const onSaveFoodDatabaseItem = vi.fn(() => true);
    render(<BarcodeScanner foodDatabase={[]} onAdd={onAdd} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={onSaveFoodDatabaseItem} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '9311770608800' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));

    await screen.findByText('Mens multivitamin');
    expect(screen.getByText('No macro nutrition found - values are zero or need manual adjustment.')).toBeTruthy();
    expect(onSaveFoodDatabaseItem).toHaveBeenCalledWith(expect.objectContaining({
      barcode: '9311770608800',
      source: 'openFoodFacts',
      calories: 0,
    }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Add to log' })[0]);
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      source: 'barcode',
      barcode: '9311770608800',
      calories: 0,
      proteinG: 0,
      fatG: 0,
      totalCarbsG: 0,
    })));
  });

  it('uses a local barcode database hit without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onAdd = vi.fn(() => true);
    render(<BarcodeScanner foodDatabase={[localFood]} onAdd={onAdd} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={vi.fn(() => true)} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '1234567890123' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));

    await screen.findByText('Local Cheese');
    expect(screen.getByText('Local database')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows not found with manual creation available when no cache exists', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Not found' }, { status: 404 })));
    render(<BarcodeScanner foodDatabase={[]} onAdd={vi.fn(() => true)} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={vi.fn(() => true)} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '0000000000000' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));

    expect(await screen.findByText('No food was found for that barcode.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create food for this barcode' })).toBeTruthy();
    expect(screen.queryByText('Review before logging')).toBeNull();
  });

  it('falls back to an all-zero cached product when a fresh not-found lookup fails', async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: 'Not found' }, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const onSaveFoodDatabaseItem = vi.fn(() => true);
    render(<BarcodeScanner foodDatabase={[zeroCacheFood]} onAdd={vi.fn(() => true)} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={onSaveFoodDatabaseItem} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '9311770608800' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));

    await screen.findByText('Cached Multivitamin');
    expect(fetchMock).toHaveBeenCalled();
    expect(screen.getByText('Local database')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create food for this barcode' })).toBeNull();
    expect(onSaveFoodDatabaseItem).not.toHaveBeenCalled();
  });

  it('falls back to an all-zero cached product when the network fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('offline');
    });
    vi.stubGlobal('fetch', fetchMock);
    const onSaveFoodDatabaseItem = vi.fn(() => true);
    render(<BarcodeScanner foodDatabase={[zeroCacheFood]} onAdd={vi.fn(() => true)} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={onSaveFoodDatabaseItem} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '9311770608800' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));

    await screen.findByText('Cached Multivitamin');
    expect(fetchMock).toHaveBeenCalled();
    expect(screen.getByText('Local database')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSaveFoodDatabaseItem).not.toHaveBeenCalled();
  });

  it('allows manual creation when lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Not found' }, { status: 404 })));
    const onAdd = vi.fn(() => true);
    const onSaveFoodDatabaseItem = vi.fn(() => true);
    render(<BarcodeScanner foodDatabase={[]} onAdd={onAdd} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={onSaveFoodDatabaseItem} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '5555' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));
    await screen.findByRole('button', { name: 'Create food for this barcode' });
    fireEvent.click(screen.getByRole('button', { name: 'Create food for this barcode' }));
    fireEvent.change(screen.getByLabelText('Food name'), { target: { value: 'Manual Bar' } });
    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '150' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to log' })[0]);

    await waitFor(() => expect(onSaveFoodDatabaseItem).toHaveBeenCalledWith(expect.objectContaining({
      barcode: '5555',
      name: 'Manual Bar',
      userEdited: true,
    })));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Manual Bar', calories: 150 }));
  });

  it('imports a nutrition label photo after barcode lookup misses', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/parse-nutrition-label')) {
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
      }
      return Response.json({ error: 'Not found' }, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAdd = vi.fn(() => true);
    const onSaveFoodDatabaseItem = vi.fn(() => true);
    const { container } = render(<BarcodeScanner foodDatabase={[]} onAdd={onAdd} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={onSaveFoodDatabaseItem} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '7777' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));
    await screen.findByRole('button', { name: 'Scan nutrition label' });

    const labelInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(labelInput, { target: { files: [new File(['fake'], 'label.jpg', { type: 'image/jpeg' })] } });

    await screen.findByText('Label Almond Bar');
    expect(screen.getByText('Nutrition label photo')).toBeTruthy();
    expect((screen.getByLabelText('Total carbs (g)') as HTMLInputElement).value).toBe('18');

    fireEvent.click(screen.getAllByRole('button', { name: 'Add to log' })[0]);

    await waitFor(() => expect(onSaveFoodDatabaseItem).toHaveBeenCalledWith(expect.objectContaining({
      barcode: '7777',
      name: 'Label Almond Bar',
      source: 'barcode',
      userEdited: true,
      vitaminCMg: 12,
    })));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      barcode: '7777',
      name: 'Label Almond Bar (Keto Co)',
      calories: 210,
      totalCarbsG: 18,
      fibreG: 12,
      vitaminCMg: 12,
    }));
  });

  it('reuses a manually created barcode food on future scans', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<BarcodeScanner foodDatabase={[{ ...zeroCacheFood, barcode: '5555', name: 'Manual Bar', calories: 150, userEdited: true, source: 'barcode' }]} onAdd={vi.fn(() => true)} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={vi.fn(() => true)} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '5555' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));

    await screen.findByText('Manual Bar');
    expect(screen.getByText('User-corrected food')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects reviewed barcode nutrition with impossible carb components', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Not found' }, { status: 404 })));
    const onAdd = vi.fn(() => true);
    render(<BarcodeScanner foodDatabase={[]} onAdd={onAdd} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={vi.fn(() => true)} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '5555' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));
    await screen.findByRole('button', { name: 'Create food for this barcode' });
    fireEvent.click(screen.getByRole('button', { name: 'Create food for this barcode' }));
    fireEvent.change(screen.getByLabelText('Food name'), { target: { value: 'Manual Bar' } });
    fireEvent.change(screen.getByLabelText('Total carbs (g)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Fibre (g)'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Sugar alcohols (g)'), { target: { value: '4' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to log' })[0]);

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText('Fibre and sugar alcohols cannot exceed total carbs.')).toBeTruthy();
  });

  it('prefers a user-corrected local barcode food over a future remote result', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<BarcodeScanner foodDatabase={[{ ...localFood, name: 'Corrected Cheese', userEdited: true }]} onAdd={vi.fn(() => true)} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={vi.fn(() => true)} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '1234567890123' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));

    await screen.findByText('Corrected Cheese');
    expect(screen.getByText('User-corrected food')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('offers a manual add fallback when a handler is provided', () => {
    const onAddManually = vi.fn();
    render(<BarcodeScanner foodDatabase={[]} onAdd={vi.fn(() => true)} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={vi.fn(() => true)} onAddManually={onAddManually} />);

    fireEvent.click(screen.getByRole('button', { name: 'No barcode? Add manually' }));
    expect(onAddManually).toHaveBeenCalled();
  });

  it('hides the manual add fallback when no handler is provided', () => {
    render(<BarcodeScanner foodDatabase={[]} onAdd={vi.fn(() => true)} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={vi.fn(() => true)} />);

    expect(screen.queryByRole('button', { name: 'No barcode? Add manually' })).toBeNull();
  });
});
