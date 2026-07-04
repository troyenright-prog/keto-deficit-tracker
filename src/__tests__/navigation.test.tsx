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

  it('has no Plan tab or dropdown', () => {
    render(<Nav current="dashboard" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Plan' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Meal plan' })).toBeNull();
  });

  it('renders exactly the five bottom-nav tabs', () => {
    render(<Nav current="dashboard" onChange={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const labels = ['Home', 'Log', 'Garmin', 'Progress', 'Settings'];
    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(nav.querySelectorAll('button')).toHaveLength(labels.length);
  });

  it('keeps add and scan out of the bottom navigation', () => {
    render(<Nav current="dashboard" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scan' })).toBeNull();
  });
});
