import type { Screen } from '../App';

interface NavProps {
  current: Screen;
  onChange: (s: Screen) => void;
}

const tabs: { id: Screen; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'add-food', label: 'Add Food' },
  { id: 'daily-log', label: 'Log' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'saved-foods', label: 'Saved' },
  { id: 'profile', label: 'Profile' },
];

export function Nav({ current, onChange }: NavProps) {
  return (
    <nav className="nav">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`nav-btn${current === t.id ? ' nav-btn--active' : ''}`}
          onClick={() => onChange(t.id)}
          aria-current={current === t.id ? 'page' : undefined}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
