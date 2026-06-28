import { useState } from 'react';
import { APP_USERS, type AppUserKey } from '../lib/users';

interface UserPickerProps {
  onPick: (userKey: AppUserKey) => void;
}

export function UserPicker({ onPick }: UserPickerProps) {
  const [selected, setSelected] = useState<AppUserKey | null>(null);

  return (
    <div className="user-picker-shell">
      <div className="user-picker-panel">
        <div>
          <p className="eyebrow">Keto Tracker</p>
          <h1>Who is logging?</h1>
          <p className="user-picker-copy">Your device remembers this choice and keeps each person&apos;s data separate.</p>
        </div>
        <div className="user-picker-grid">
          {Object.entries(APP_USERS).map(([key, user]) => (
            <button
              key={key}
              type="button"
              className={`user-picker-card${selected === key ? ' user-picker-card--selected' : ''}`}
              onClick={() => setSelected(key as AppUserKey)}
            >
              <span className="user-picker-avatar" style={{ background: `${user.color}18`, color: user.color }}>
                {user.label[0]}
              </span>
              <strong>{user.label}</strong>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--primary" disabled={!selected} onClick={() => selected && onPick(selected)}>
          Continue
        </button>
      </div>
    </div>
  );
}
