import { useState } from 'react';
import type { Screen } from '../App';

interface NavProps {
  current: Screen;
  onChange: (s: Screen) => void;
}

type Tab = { id: Screen; label: string };

const homeTabs: Tab[] = [
  { id: 'dashboard', label: 'Home' },
  { id: 'daily-log', label: 'Log' },
];

const planTabs: Tab[] = [
  { id: 'planner', label: 'Planner' },
  { id: 'weekly', label: 'Week' },
  { id: 'saved-foods', label: 'Foods' },
  { id: 'meals', label: 'Meals' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'shopping', label: 'Shop' },
];

const endTabs: Tab[] = [
  { id: 'weight', label: 'Weight' },
  { id: 'settings', label: 'Settings' },
];

export function Nav({ current, onChange }: NavProps) {
  const [planOpen, setPlanOpen] = useState(false);
  const planActive = planTabs.some((t) => t.id === current);

  const select = (id: Screen) => {
    setPlanOpen(false);
    onChange(id);
  };

  const renderTab = (t: Tab) => (
    <button
      key={t.id}
      className={`nav-btn${current === t.id ? ' nav-btn--active' : ''}`}
      onClick={() => select(t.id)}
      aria-current={current === t.id ? 'page' : undefined}
    >
      {t.label}
    </button>
  );

  return (
    <>
      {planOpen && <button className="nav-backdrop" aria-label="Close menu" onClick={() => setPlanOpen(false)} />}
      <nav className="nav" aria-label="Main navigation">
        {homeTabs.map(renderTab)}

        <div className="nav-plan">
          {planOpen && (
            <div className="nav-plan-menu" role="menu">
              {planTabs.map((t) => (
                <button
                  key={t.id}
                  role="menuitem"
                  className={`nav-plan-item${current === t.id ? ' nav-plan-item--active' : ''}`}
                  onClick={() => select(t.id)}
                  aria-current={current === t.id ? 'page' : undefined}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <button
            className={`nav-btn nav-btn--plan${planActive ? ' nav-btn--active' : ''}${planOpen ? ' nav-btn--open' : ''}`}
            onClick={() => setPlanOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={planOpen}
          >
            Plan
            <span className="nav-caret" aria-hidden="true" />
          </button>
        </div>

        {endTabs.map(renderTab)}
      </nav>
    </>
  );
}
