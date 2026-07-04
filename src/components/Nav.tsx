import type { ReactNode } from 'react';
import type { Screen } from '../App';

interface NavProps {
  current: Screen;
  onChange: (s: Screen) => void;
}

type Tab = { id: Screen; label: string };

const homeTabs: Tab[] = [
  { id: 'dashboard', label: 'Home' },
  { id: 'daily-log', label: 'Log' },
  { id: 'weight', label: 'Garmin' },
  { id: 'progress', label: 'Progress' },
];

const endTabs: Tab[] = [
  { id: 'settings', label: 'Settings' },
];

const ICONS: Partial<Record<Screen, ReactNode>> = {
  dashboard: <><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9.7V20h12V9.7" /></>,
  'daily-log': <><circle cx="4.6" cy="6" r="1" /><circle cx="4.6" cy="12" r="1" /><circle cx="4.6" cy="18" r="1" /><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /></>,
  weight: <><path d="M3.5 12h3.5l1.6-4.2 2.7 8.4 1.9-5.6 1.3 3h4.5" /></>,
  progress: <><path d="M5 20V12" /><path d="M10 20V5.5" /><path d="M15 20v-6.5" /><path d="M20 20v-10.5" /></>,
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
  const renderTab = (t: Tab) => (
    <button
      key={t.id}
      className={`nav-btn${current === t.id ? ' nav-btn--active' : ''}`}
      onClick={() => onChange(t.id)}
      aria-current={current === t.id ? 'page' : undefined}
    >
      <NavIcon>{ICONS[t.id]}</NavIcon>
      <span className="nav-label">{t.label}</span>
    </button>
  );

  return (
    <nav className="nav" aria-label="Main navigation">
      {homeTabs.map(renderTab)}
      {endTabs.map(renderTab)}
    </nav>
  );
}
