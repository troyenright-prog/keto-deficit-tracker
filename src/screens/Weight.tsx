import { useMemo, useState } from 'react';
import type { WeightEntry } from '../types';
import { todayDateString } from '../lib/nutrition';
import { sevenDayAvgWeight } from '../lib/weekly';
import { StatCard } from '../components/StatCard';
import { nanoid } from '../lib/nanoid';

interface WeightProps {
  entries: WeightEntry[];
  weightUnit: 'kg' | 'lbs';
  onSave: (entries: WeightEntry[]) => boolean;
}

export function Weight({ entries, weightUnit, onSave }: WeightProps) {
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(todayDateString());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [validationError, setValidationError] = useState('');

  const sorted = useMemo(
    () =>
      [...entries]
        .filter((e) => e.unit === weightUnit)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries, weightUnit],
  );

  const latestWeight = sorted[0];
  const sevenDayAvg = sevenDayAvgWeight(sorted, todayDateString());

  const weightChange =
    sorted.length >= 2
      ? sorted[0].weight - sorted[sorted.length - 1].weight
      : null;

  function addEntry() {
    const w = parseFloat(weightInput);
    if (!Number.isFinite(w) || w <= 0) { setValidationError('Weight must be a number greater than zero.'); return; }
    if (!dateInput) { setValidationError('Choose a date.'); return; }
    setValidationError('');
    const entry: WeightEntry = {
      id: nanoid(),
      date: dateInput,
      weight: w,
      unit: weightUnit,
      loggedAt: new Date().toISOString(),
    };
    if (!onSave([...entries, entry])) return;
    setWeightInput('');
  }

  function deleteEntry(id: string) {
    onSave(entries.filter((e) => e.id !== id));
  }

  function startEdit(entry: WeightEntry) {
    setEditingId(entry.id);
    setEditWeight(String(entry.weight));
  }

  function saveEdit(id: string) {
    const w = parseFloat(editWeight);
    if (Number.isFinite(w) && w > 0) {
      if (!onSave(entries.map((e) => e.id === id ? { ...e, weight: w } : e))) return;
      setValidationError('');
    } else {
      setValidationError('Weight must be a number greater than zero.');
      return;
    }
    setEditingId(null);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Weight Tracking</h1>
      </div>
      {validationError && <p className="form-error" role="alert">{validationError}</p>}

      <div className="weight-add-row">
        <input
          type="number"
          step="0.1"
          min="0"
          placeholder={`Weight (${weightUnit})`}
          value={weightInput}
          onChange={(e) => setWeightInput(e.target.value)}
          className="weight-input"
        />
        <input
          type="date"
          value={dateInput}
          max={todayDateString()}
          onChange={(e) => setDateInput(e.target.value)}
        />
        <button className="btn btn--primary" onClick={addEntry}>Log</button>
      </div>

      {latestWeight && (
        <div className="cards-grid">
          <StatCard
            label="Latest weight"
            value={`${latestWeight.weight} ${weightUnit}`}
            sub={latestWeight.date}
          />
          {sevenDayAvg !== null && (
            <StatCard
              label="7-day average"
              value={`${sevenDayAvg.toFixed(1)} ${weightUnit}`}
            />
          )}
          {weightChange !== null && sorted.length >= 2 && (
            <StatCard
              label={`Change (${sorted.length} entries)`}
              value={`${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)} ${weightUnit}`}
              variant={weightChange < 0 ? 'success' : weightChange > 0 ? 'warning' : 'default'}
            />
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="empty-hint">No weight entries yet. Log your weight above to start tracking.</p>
      ) : (
        <ul className="weight-list">
          {sorted.map((e) => (
            <li key={e.id} className="weight-entry weight-entry--full">
              {editingId === e.id ? (
                <>
                  <span className="weight-entry-date">{e.date}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={editWeight}
                    className="weight-input weight-input--inline"
                    onChange={(ev) => setEditWeight(ev.target.value)}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') saveEdit(e.id); if (ev.key === 'Escape') setEditingId(null); }}
                    autoFocus
                  />
                  <span>{weightUnit}</span>
                  <button className="btn btn--primary btn--xs" onClick={() => saveEdit(e.id)}>Save</button>
                  <button className="btn btn--ghost btn--xs" onClick={() => setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span className="weight-entry-date">{e.date}</span>
                  <span className="weight-entry-value">{e.weight} {e.unit}</span>
                  <button className="btn btn--ghost btn--xs" onClick={() => startEdit(e)}>Edit</button>
                  <button
                    className="btn btn--danger btn--xs"
                    onClick={() => { if (confirm(`Delete weight entry for ${e.date}?`)) deleteEntry(e.id); }}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
