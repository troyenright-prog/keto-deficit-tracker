import type { Screen } from '../App';

interface NavProps {
  current: Screen;
  onChange: (s: Screen) => void;
}

const tabs: { id: Screen; label: string }[] = [
  { id: 'dashboard', label: 'Home' },
  { id: 'add-food', label: 'Add' },
  { id: 'daily-log', label: 'Log' },
  { id: 'saved-foods', label: 'Foods' },
  { id: 'meals', label: 'Meals' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'planner', label: 'Plan' },
  { id: 'shopping', label: 'Shop' },
  { id: 'weight', label: 'Weight' },
  { id: 'settings', label: 'Settings' },
];

export function Nav({ current, onChange }: NavProps) {
  return (
    <nav className="nav" aria-label="Main navigation">
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
