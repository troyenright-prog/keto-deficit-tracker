import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../screens/Dashboard';
import { summariseDay } from '../lib/nutrition';
import { DEFAULT_TARGETS } from '../lib/storage';

describe('Dashboard screen', () => {
  it('shows needs-attention recommendations near the top of home', () => {
    const { container } = render(
      <Dashboard
        summary={summariseDay('2026-01-01', [])}
        entries={[]}
        targets={DEFAULT_TARGETS}
        recommendations={[{ id: 'electrolytes', priority: 'warning', message: 'Top up electrolytes today.' }]}
        onAddFood={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Needs attention')).toHaveLength(1);
    expect(screen.getByText('Top up electrolytes today.')).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text.indexOf('Needs attention')).toBeLessThan(text.indexOf('Daily progress'));
  });
});
