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

  it('rejects macros that cannot fit in the labelled serving', () => {
    const onSubmit = vi.fn();
    render(<FoodForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Food name *'), { target: { value: 'Corrupt wafer' } });
    fireEvent.change(screen.getByLabelText('Serving size'), { target: { value: '40g' } });
    fireEvent.change(screen.getByLabelText('Protein (g)'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('Fat (g)'), { target: { value: '524' } });
    fireEvent.change(screen.getByLabelText('Total carbs (g)'), { target: { value: '388' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Log' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot fit in a 40\.0g serving/)).toBeTruthy();
  });

  it('shows numeric fields empty with a placeholder instead of a locked 0', () => {
    render(<FoodForm onSubmit={vi.fn()} />);
    const calories = screen.getByLabelText('Calories') as HTMLInputElement;
    expect(calories.value).toBe('');
    expect(calories.placeholder).toBe('0');
  });

  it('lets a numeric field be cleared without snapping back to 0', () => {
    render(<FoodForm onSubmit={vi.fn()} />);
    const calories = screen.getByLabelText('Calories') as HTMLInputElement;

    fireEvent.change(calories, { target: { value: '250' } });
    expect(calories.value).toBe('250');

    fireEvent.change(calories, { target: { value: '' } });
    expect(calories.value).toBe('');

    fireEvent.change(calories, { target: { value: '0.5' } });
    expect(calories.value).toBe('0.5');
  });

  it('scales a cleared (empty) numeric field as 0 on submit', () => {
    const onSubmit = vi.fn();
    render(<FoodForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Food name *'), { target: { value: 'Water' } });
    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Log' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Water', calories: 0 }));
  });

  it('keeps electrolytes and micronutrients collapsed for a fresh manual add', () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    // Core macro fields stay visible; the extras hide behind the toggle so Save
    // sits right below the macros without scrolling.
    expect(screen.getByLabelText('Calories')).toBeTruthy();
    expect(screen.queryByLabelText('Sodium (mg)')).toBeNull();
    expect(screen.queryByLabelText('Calcium (mg)')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add electrolytes & micronutrients' }));
    expect(screen.getByLabelText('Sodium (mg)')).toBeTruthy();
    expect(screen.getByLabelText('Calcium (mg)')).toBeTruthy();
  });

  it('auto-expands the extras when editing a food that already carries them', () => {
    render(<FoodForm onSubmit={vi.fn()} initial={{ calciumMg: 120, sodiumMg: 300 }} />);

    // Logged electrolytes/micronutrients auto-open the section without a click.
    expect(screen.getByLabelText('Calcium (mg)')).toBeTruthy();
    expect(screen.getByLabelText('Sodium (mg)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide electrolytes & micronutrients' }));
    expect(screen.queryByLabelText('Calcium (mg)')).toBeNull();
    expect(screen.queryByLabelText('Sodium (mg)')).toBeNull();
  });
});
