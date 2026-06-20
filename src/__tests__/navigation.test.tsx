import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Nav } from '../components/Nav';

describe('navigation', () => {
  it('makes Weekly Summary reachable', () => {
    render(<Nav current="dashboard" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Week' })).not.toBeNull();
  });
});
