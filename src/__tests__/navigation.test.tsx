import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Nav } from '../components/Nav';

describe('navigation', () => {
  it('surfaces Progress as its own bottom-nav tab, next to Garmin', () => {
    const onChange = vi.fn();
    render(<Nav current="dashboard" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Progress' }));
    expect(onChange).toHaveBeenCalledWith('progress');
  });

  it('groups the meal planner, templates, and recipes under the Plan menu', () => {
    const onChange = vi.fn();
    render(<Nav current="dashboard" onChange={onChange} />);

    // These live inside the Plan dropdown, hidden until it is opened.
    expect(screen.queryByRole('menuitem', { name: 'Meal plan' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    const mealPlan = screen.getByRole('menuitem', { name: 'Meal plan' });
    fireEvent.click(mealPlan);

    expect(onChange).toHaveBeenCalledWith('planner');
  });

  it('keeps add and scan out of the bottom navigation', () => {
    render(<Nav current="dashboard" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scan' })).toBeNull();
  });
});
