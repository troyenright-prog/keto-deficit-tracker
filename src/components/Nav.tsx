import { useState, type ReactNode } from 'react';
import type { Screen } from '../App';

interface NavProps {
  current: Screen;
  onChange: (s: Screen) => void;
}

type Tab = { id: Screen; label: string };

const homeTabs: Tab[] = [
  { id: 'dashboard', label: 'Home' },
  { id: 'daily-log', label: 'Log' },
  { id: 'weight', label: 'Weight' },
];

const planTabs: Tab[] = [
  { id: 'weekly', label: 'Week' },
  { id: 'saved-foods', label: 'Foods' },
  { id: 'shopping', label: 'Shop' },
];

const endTabs: Tab[] = [
  { id: 'settings', label: 'Settings' },
];

const ICONS: Partial<Record<Screen, ReactNode>> = {
  dashboard: <><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9.7V20h12V9.7" /></>,
  'daily-log': <><circle cx="4.6" cy="6" r="1" /><circle cx="4.6" cy="12" r="1" /><circle cx="4.6" cy="18" r="1" /><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /></>,
  weight: <><path d="M5.5 18a6.5 6.5 0 1 1 13 0" /><path d="M12 14.5l2.6-3" /></>,
  planner: <><rect x="3.6" y="5" width="16.8" height="15.4" rx="2.2" /><path d="M3.6 9.4h16.8" /><path d="M8 3.3v3.3" /><path d="M16 3.3v3.3" /></>,
  weekly: <><path d="M5 20V12" /><path d="M10 20V5.5" /><path d="M15 20v-6.5" /><path d="M20 20v-10.5" /></>,
  'saved-foods': <><path d="M6.5 4.5h11v15l-5.5-3.7-5.5 3.7z" /></>,
  meals: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /></>,
  recipes: <><path d="M6 4.5h9a2.5 2.5 0 0 1 2.5 2.5v12.5H8a2 2 0 0 1-2-2z" /><path d="M6 4.5v12.5" /></>,
  shopping: <><path d="M4 5h2l1.7 9.1a1.6 1.6 0 0 0 1.6 1.3h6.9a1.6 1.6 0 0 0 1.6-1.3L19.4 8H7" /><circle cx="9.5" cy="19" r="1.2" /><circle cx="16.4" cy="19" r="1.2" /></>,
  settings: <><path d="M4 8h7" /><path d="M15 8h5" /><circle cx="13" cy="8" r="2.1" /><path d="M4 16h4" /><path d="M12 16h8" /><circle cx="10" cy="16" r="2.1" /></>,
};

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

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
      <NavIcon>{ICONS[t.id]}</NavIcon>
      <span className="nav-label">{t.label}</span>
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
                  <NavIcon>{ICONS[t.id]}</NavIcon>
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
            <NavIcon>{ICONS.planner}</NavIcon>
            <span className="nav-label">Plan<span className="nav-caret" aria-hidden="true" /></span>
          </button>
        </div>

        {endTabs.map(renderTab)}
      </nav>
    </>
  );
}
