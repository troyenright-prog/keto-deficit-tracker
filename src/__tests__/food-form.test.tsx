import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FoodForm } from '../components/FoodForm';

describe('FoodForm validation', () => {
  it('rejects fibre plus sugar alcohols above total carbs', () => {
    const onSubmit = vi.fn();
    render(<FoodForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Food name *'), { target: { value: 'Protein bar' } });
    fireEvent.change(screen.getByLabelText('Total carbs (g)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Fibre (g)'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Sugar alcohols (g)'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Log' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText('Fibre and sugar alcohols cannot exceed total carbs')).toHaveLength(2);
  });
});
