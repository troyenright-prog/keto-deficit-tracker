import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Nav } from '../components/Nav';

describe('navigation', () => {
  it('makes Weekly Summary reachable', () => {
    render(<Nav current="dashboard" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Week' })).not.toBeNull();
  });

  it('keeps add and scan out of the bottom navigation', () => {
    render(<Nav current="dashboard" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scan' })).toBeNull();
  });
});
