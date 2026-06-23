import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BarcodeScanner } from '../screens/BarcodeScanner';

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
    render(<BarcodeScanner onAdd={onAdd} onSaveFood={vi.fn(() => true)} />);

    fireEvent.change(screen.getByLabelText('Barcode number'), { target: { value: '1234567890123' } });
    fireEvent.click(screen.getByRole('button', { name: /Look up barcode/ }));
    await screen.findByText('Cheese snack');

    fireEvent.change(screen.getByLabelText('Servings'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to log' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      source: 'barcode',
      barcode: '1234567890123',
      calories: 800,
      totalCarbsG: 4,
    })));
  });
});
