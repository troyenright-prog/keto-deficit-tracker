import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PhotoEstimate } from '../screens/PhotoEstimate';
import { validPhotoEstimate } from './fixtures/photo-estimate';

afterEach(() => vi.unstubAllGlobals());

describe('Photo Food Estimate review flow', () => {
  it('uploads, reviews, edits, and explicitly logs an estimate', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(validPhotoEstimate()), { status: 200, headers: { 'content-type': 'application/json' } })));
    const onAdd = vi.fn(() => true);
    const { container } = render(<PhotoEstimate onAdd={onAdd} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['image'], 'plate.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Estimate macros' }));

    await screen.findByDisplayValue('Chicken and avocado plate');
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Calories (kcal)'), { target: { value: '450' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add reviewed estimate to log' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ calories: 450, source: 'photo-estimate' })));
  });

  it('shows a client-side missing-image state', () => {
    render(<PhotoEstimate onAdd={vi.fn(() => true)} />);
    expect((screen.getByRole('button', { name: 'Estimate macros' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
