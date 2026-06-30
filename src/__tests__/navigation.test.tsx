import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Nav } from '../components/Nav';

describe('navigation', () => {
  it('groups Weekly Summary under the Plan menu and keeps it reachable', () => {
    const onChange = vi.fn();
    render(<Nav current="dashboard" onChange={onChange} />);

    // Week lives inside the Plan dropdown, hidden until it is opened.
    expect(screen.queryByRole('menuitem', { name: 'Week' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    const week = screen.getByRole('menuitem', { name: 'Week' });
    fireEvent.click(week);

    expect(onChange).toHaveBeenCalledWith('weekly');
  });

  it('keeps add and scan out of the bottom navigation', () => {
    render(<Nav current="dashboard" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scan' })).toBeNull();
  });
});
