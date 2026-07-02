import { useMemo, useState } from 'react';
import type { WeightEntry } from '../types';
import { todayDateString } from '../lib/nutrition';
import { sevenDayAvgWeight } from '../lib/weekly';
import { StatCard } from '../components/StatCard';
import { nanoid } from '../lib/nanoid';
import { buildWeightTrendChart, toSmoothAreaPath, toSmoothPath } from '../lib/weight-trend';

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
  const latestBodyFat = sorted.find((entry) => entry.bodyFat != null);
  const sevenDayAvg = sevenDayAvgWeight(sorted, todayDateString());
  const trendChart = buildWeightTrendChart(sorted, weightUnit);

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
          {latestBodyFat?.bodyFat != null && (
            <StatCard
              label="Latest body fat"
              value={`${latestBodyFat.bodyFat.toFixed(1)}%`}
              sub={latestBodyFat.date}
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

      {trendChart && (
        <div className="weight-trend-panel" aria-label="Weight and body fat trend">
          <div className="weight-trend-header">
            <strong>Trend</strong>
            <span>Last {trendChart.entries.length} entries</span>
          </div>
          <div className="weight-trend-legend" aria-hidden="true">
            <span className="weight-trend-legend__item weight-trend-legend__item--weight">Weight ({weightUnit})</span>
            {trendChart.bodyFatPoints.length > 0 && <span className="weight-trend-legend__item weight-trend-legend__item--body-fat">Body fat (%)</span>}
          </div>
          <svg viewBox="0 0 100 100" role="img" aria-label={`Weight trend from ${trendChart.entries[0].weight} ${weightUnit} to ${trendChart.entries[trendChart.entries.length - 1].weight} ${weightUnit}${trendChart.bodyFatPoints.length > 0 ? ', with body fat percentage where available' : ''}`}>
            <defs>
              <linearGradient id="weight-trend-area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--green)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line className="weight-trend-grid" x1="10" y1="18" x2="90" y2="18" />
            <line className="weight-trend-grid" x1="10" y1="34" x2="90" y2="34" />
            <line className="weight-trend-grid" x1="10" y1="50" x2="90" y2="50" />
            <line className="weight-trend-grid" x1="10" y1="66" x2="90" y2="66" />
            <line className="weight-trend-grid" x1="10" y1="82" x2="90" y2="82" />
            <path className="weight-trend-area" d={toSmoothAreaPath(trendChart.weightPoints)} fill="url(#weight-trend-area-fill)" />
            <path className="weight-trend-line weight-trend-line--weight" d={toSmoothPath(trendChart.weightPoints)} />
            {trendChart.bodyFatPoints.length >= 2 && (
              <path className="weight-trend-line weight-trend-line--body-fat" d={toSmoothPath(trendChart.bodyFatPoints)} />
            )}
            {trendChart.weightPoints.map((point) => {
              const entry = trendChart.entries.find((item) => item.id === point.id);
              return (
                <circle key={`w-${point.id}`} className="weight-trend-dot weight-trend-dot--weight" cx={point.x} cy={point.y} r="1.8">
                  <title>{`${point.date}: weight ${point.value.toFixed(1)} ${weightUnit}${entry?.bodyFat != null ? `; body fat ${entry.bodyFat.toFixed(1)}%` : ''}`}</title>
                </circle>
              );
            })}
            {trendChart.bodyFatPoints.map((point) => (
              <circle key={`bf-${point.id}`} className="weight-trend-dot weight-trend-dot--body-fat" cx={point.x} cy={point.y} r="2.1">
                <title>{`${point.date}: body fat ${point.value.toFixed(1)}%`}</title>
              </circle>
            ))}
          </svg>
          <div className="weight-trend-scale">
            <span>
              Weight {trendChart.weightRange.min.toFixed(1)}-{trendChart.weightRange.max.toFixed(1)} {weightUnit}
            </span>
            {trendChart.bodyFatRange && (
              <span>
                Body fat {trendChart.bodyFatRange.min.toFixed(1)}-{trendChart.bodyFatRange.max.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="weight-trend-axis">
            <span>{trendChart.entries[0].date}</span>
            <span>{trendChart.entries[trendChart.entries.length - 1].date}</span>
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
