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
  // Provided only on platforms where Garmin/Health Connect is available.
  // Resolves to a status message to show the user.
  onSyncGarmin?: () => Promise<string>;
}

export function Weight({ entries, weightUnit, onSave, onSyncGarmin }: WeightProps) {
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(todayDateString());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [validationError, setValidationError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  async function runGarminSync() {
    if (!onSyncGarmin || syncing) return;
    setSyncing(true);
    setSyncMessage('');
    try {
      setSyncMessage(await onSyncGarmin());
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Could not sync from Garmin.');
    } finally {
      setSyncing(false);
    }
  }

  const sorted = useMemo(
    () =>
      [...entries]
        .filter((e) => e.unit === weightUnit)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries, weightUnit],
  );

  const latestWeight = sorted[0];
  const sevenDayAvg = sevenDayAvgWeight(sorted, todayDateString());
  const trendEntries = [...sorted].reverse().slice(-14);
  const trendWeights = trendEntries.map((entry) => entry.weight);
  const minTrend = trendWeights.length > 0 ? Math.min(...trendWeights) : 0;
  const maxTrend = trendWeights.length > 0 ? Math.max(...trendWeights) : 0;
  const trendRange = Math.max(0.1, maxTrend - minTrend);
  const trendPoints = trendEntries.map((entry, index) => {
    const x = trendEntries.length === 1 ? 50 : (index / (trendEntries.length - 1)) * 100;
    const y = 84 - ((entry.weight - minTrend) / trendRange) * 68;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

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
        {onSyncGarmin && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={runGarminSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync from Garmin'}
          </button>
        )}
      </div>
      {syncMessage && <p className="empty-hint empty-hint--compact" role="status">{syncMessage}</p>}
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

      {trendEntries.length >= 2 && (
        <div className="weight-trend-panel" aria-label="Weight trend">
          <div className="weight-trend-header">
            <strong>Trend</strong>
            <span>Last {trendEntries.length} entries</span>
          </div>
          <svg viewBox="0 0 100 100" role="img" aria-label={`Weight trend from ${trendEntries[0].weight} to ${trendEntries[trendEntries.length - 1].weight} ${weightUnit}`}>
            <polyline points={trendPoints} />
          </svg>
          <div className="weight-trend-axis">
            <span>{trendEntries[0].date}</span>
            <span>{trendEntries[trendEntries.length - 1].date}</span>
          </div>
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
                  <span className="weight-entry-value">
                    {e.weight} {e.unit}
                    {e.bodyFat != null && <small className="dim"> · {e.bodyFat}% fat</small>}
                    {e.source === 'garminHealthConnect' && <small className="source-pill"> Garmin</small>}
                  </span>
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
