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
    fireEvent.click(screen.getByRole('button', { name: 'Add to log' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      source: 'barcode',
      barcode: '1234567890123',
      calories: 800,
      totalCarbsG: 4,
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
    fireEvent.click(screen.getByRole('button', { name: 'Add to log' }));

    await waitFor(() => expect(onSaveFoodDatabaseItem).toHaveBeenCalledWith(expect.objectContaining({
      barcode: '5555',
      name: 'Manual Bar',
      userEdited: true,
    })));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Manual Bar', calories: 150 }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Add to log' }));

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

  it('does not offer a manual add fallback from the scan screen', () => {
    render(<BarcodeScanner foodDatabase={[]} onAdd={vi.fn(() => true)} onSaveFood={vi.fn(() => true)} onSaveFoodDatabaseItem={vi.fn(() => true)} />);

    expect(screen.queryByRole('button', { name: 'Add manually' })).toBeNull();
  });
});
