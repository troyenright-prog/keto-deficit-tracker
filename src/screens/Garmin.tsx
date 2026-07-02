import { useMemo, useState } from 'react';
import type { DailyActivityEntry, SleepEntry, VitalsEntry, WeightEntry } from '../types';
import { todayDateString } from '../lib/nutrition';
import { sevenDayAvgWeight } from '../lib/weekly';
import { StatCard } from '../components/StatCard';
import { nanoid } from '../lib/nanoid';
import { buildWeightTrendChart, toSmoothAreaPath, toSmoothPath } from '../lib/weight-trend';

interface GarminProps {
  entries: WeightEntry[];
  weightUnit: 'kg' | 'lbs';
  dailyActivity: DailyActivityEntry[];
  sleepEntries: SleepEntry[];
  vitalsEntries: VitalsEntry[];
  onSave: (entries: WeightEntry[]) => boolean;
  // Provided only on platforms where Garmin/Health Connect is available.
  // Resolves to a status message to show the user.
  onSyncGarmin?: () => Promise<string>;
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

const STAGE_LABELS: Record<string, string> = { awake: 'Awake', light: 'Light', deep: 'Deep', rem: 'REM', unknown: 'Unknown' };
const STAGE_CLASSES: Record<string, string> = {
  awake: 'sleep-stage-bar__seg--awake',
  light: 'sleep-stage-bar__seg--light',
  deep: 'sleep-stage-bar__seg--deep',
  rem: 'sleep-stage-bar__seg--rem',
  unknown: 'sleep-stage-bar__seg--unknown',
};

export function Garmin({ entries, weightUnit, dailyActivity, sleepEntries, vitalsEntries, onSave, onSyncGarmin }: GarminProps) {
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
  const latestLeanMass = sorted.find((entry) => entry.leanBodyMassKg != null);
  const latestBoneMass = sorted.find((entry) => entry.boneMassKg != null);
  const latestBodyWater = sorted.find((entry) => entry.bodyWaterMassKg != null);
  const sevenDayAvg = sevenDayAvgWeight(sorted, todayDateString());
  const trendChart = buildWeightTrendChart(sorted, weightUnit);

  const weightChange =
    sorted.length >= 2
      ? sorted[0].weight - sorted[sorted.length - 1].weight
      : null;

  const latestActivity = useMemo(
    () => [...dailyActivity].sort((a, b) => b.date.localeCompare(a.date))[0],
    [dailyActivity],
  );
  const isActivityToday = latestActivity?.date === todayDateString();

  const latestSleep = useMemo(
    () => [...sleepEntries].sort((a, b) => b.date.localeCompare(a.date))[0],
    [sleepEntries],
  );

  const sortedVitals = useMemo(
    () => [...vitalsEntries].sort((a, b) => b.date.localeCompare(a.date)),
    [vitalsEntries],
  );
  const latestRestingHeartRate = sortedVitals.find((entry) => entry.restingHeartRate != null);
  const latestHrv = sortedVitals.find((entry) => entry.hrv != null);
  const latestVo2Max = sortedVitals.find((entry) => entry.vo2Max != null);
  const latestOxygenSaturation = sortedVitals.find((entry) => entry.oxygenSaturation != null);
  const latestRespiratoryRate = sortedVitals.find((entry) => entry.respiratoryRate != null);
  const hasAnyVitals = latestRestingHeartRate || latestHrv || latestVo2Max || latestOxygenSaturation || latestRespiratoryRate;

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
        <h1>Garmin</h1>
        {onSyncGarmin && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={runGarminSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync from Garmin'}
          </button>
        )}
      </div>
      {syncMessage && <p className="empty-hint empty-hint--compact" role="status">{syncMessage}</p>}
      {validationError && <p className="form-error" role="alert">{validationError}</p>}

      <div className="section-title">Weight and body composition</div>

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
          {latestLeanMass?.leanBodyMassKg != null && (
            <StatCard label="Lean mass" value={`${latestLeanMass.leanBodyMassKg.toFixed(1)} kg`} sub={latestLeanMass.date} />
          )}
          {latestBoneMass?.boneMassKg != null && (
            <StatCard label="Bone mass" value={`${latestBoneMass.boneMassKg.toFixed(1)} kg`} sub={latestBoneMass.date} />
          )}
          {latestBodyWater?.bodyWaterMassKg != null && (
            <StatCard label="Body water" value={`${latestBodyWater.bodyWaterMassKg.toFixed(1)} kg`} sub={latestBodyWater.date} />
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

      <div className="section-title">Activity</div>
      {latestActivity ? (
        <div className="cards-grid">
          <StatCard
            label={isActivityToday ? 'Steps today' : 'Latest steps'}
            value={latestActivity.steps.toLocaleString()}
            sub={isActivityToday ? 'Garmin via Health Connect' : latestActivity.date}
          />
          {latestActivity.activeCalories != null && (
            <StatCard label="Active calories" value={Math.round(latestActivity.activeCalories).toLocaleString()} sub="kcal" />
          )}
          {latestActivity.totalCalories != null && (
            <StatCard label="Total calories burned" value={Math.round(latestActivity.totalCalories).toLocaleString()} sub="kcal" />
          )}
          {latestActivity.distanceMeters != null && (
            <StatCard label="Distance" value={formatDistance(latestActivity.distanceMeters)} />
          )}
          {latestActivity.floorsClimbed != null && (
            <StatCard label="Floors climbed" value={Math.round(latestActivity.floorsClimbed)} />
          )}
          {latestActivity.elevationGainedMeters != null && (
            <StatCard label="Elevation gained" value={`${Math.round(latestActivity.elevationGainedMeters)} m`} />
          )}
        </div>
      ) : (
        <p className="empty-hint">No activity data yet. Sync from Garmin to pull in steps and calories burned.</p>
      )}

      <div className="section-title">Sleep</div>
      {latestSleep ? (
        <div className="sleep-card">
          <div className="sleep-card-header">
            <span className="sleep-card-duration">{formatDuration(latestSleep.totalMinutes)}</span>
            <span className="sleep-card-times">{formatClockTime(latestSleep.startTime)} - {formatClockTime(latestSleep.endTime)}</span>
          </div>
          {latestSleep.stages && latestSleep.stages.length > 0 && (
            <>
              <div className="sleep-stage-bar">
                {latestSleep.stages.map((segment, index) => {
                  const start = new Date(segment.startTime).getTime();
                  const end = new Date(segment.endTime).getTime();
                  const widthPercent = Math.max(0, ((end - start) / 60000 / latestSleep.totalMinutes) * 100);
                  return (
                    <span
                      key={index}
                      className={`sleep-stage-bar__seg ${STAGE_CLASSES[segment.stage]}`}
                      style={{ width: `${widthPercent}%` }}
                      title={STAGE_LABELS[segment.stage]}
                    />
                  );
                })}
              </div>
              <div className="sleep-stage-legend">
                {(['awake', 'light', 'deep', 'rem'] as const).map((stage) => (
                  <span key={stage} className="sleep-stage-legend__item" data-stage={stage}>{STAGE_LABELS[stage]}</span>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="empty-hint">No sleep data yet. Sync from Garmin to pull in last night's sleep.</p>
      )}

      <div className="section-title">Vitals</div>
      {hasAnyVitals ? (
        <div className="cards-grid">
          {latestRestingHeartRate?.restingHeartRate != null && (
            <StatCard label="Resting heart rate" value={`${latestRestingHeartRate.restingHeartRate} bpm`} sub={latestRestingHeartRate.date} />
          )}
          {latestHrv?.hrv != null && (
            <StatCard label="HRV" value={`${latestHrv.hrv} ms`} sub={latestHrv.date} />
          )}
          {latestVo2Max?.vo2Max != null && (
            <StatCard label="VO2 max" value={latestVo2Max.vo2Max} sub={latestVo2Max.date} />
          )}
          {latestOxygenSaturation?.oxygenSaturation != null && (
            <StatCard label="Oxygen saturation" value={`${latestOxygenSaturation.oxygenSaturation}%`} sub={latestOxygenSaturation.date} />
          )}
          {latestRespiratoryRate?.respiratoryRate != null && (
            <StatCard label="Respiratory rate" value={`${latestRespiratoryRate.respiratoryRate}/min`} sub={latestRespiratoryRate.date} />
          )}
        </div>
      ) : (
        <p className="empty-hint">No vitals yet. Sync from Garmin to pull in resting heart rate, HRV, and more.</p>
      )}
    </div>
  );
}
