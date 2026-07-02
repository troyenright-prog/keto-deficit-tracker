import { useMemo, useState } from 'react';
import type { DailyActivityEntry, SleepEntry, VitalsEntry, WeightEntry } from '../types';
import { todayDateString } from '../lib/nutrition';
import { sevenDayAvgWeight } from '../lib/weekly';
import { StatCard } from '../components/StatCard';
import { buildWeightTrendChart, toSmoothAreaPath, toSmoothPath } from '../lib/weight-trend';

interface GarminProps {
  entries: WeightEntry[];
  weightUnit: 'kg' | 'lbs';
  dailyActivity: DailyActivityEntry[];
  sleepEntries: SleepEntry[];
  vitalsEntries: VitalsEntry[];
  // Provided only on platforms where Garmin/Health Connect is available.
  // Resolves to a status message to show the user.
  onSyncGarmin?: () => Promise<string>;
}

const HISTORY_PREVIEW_COUNT = 5;

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

// Read-only Garmin dashboard: sync + latest synced metrics. Manual weight
// entry/edit/delete lives outside this screen — Garmin data is source-of-truth
// synced data here, not a log to hand-edit.
export function Garmin({ entries, weightUnit, dailyActivity, sleepEntries, vitalsEntries, onSyncGarmin }: GarminProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [showFullHistory, setShowFullHistory] = useState(false);

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
  const isSleepLastNight = latestSleep?.date === todayDateString();

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

  const hasOverview = latestWeight || latestActivity || latestSleep || hasAnyVitals;
  const historyEntries = showFullHistory ? sorted : sorted.slice(0, HISTORY_PREVIEW_COUNT);

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
      {syncMessage && <p className="sync-status-line" role="status">{syncMessage}</p>}

      {!hasOverview ? (
        <p className="empty-hint">No Garmin data yet. Tap "Sync from Garmin" to pull in weight, activity, sleep, and vitals.</p>
      ) : (
        <>
          <div className="section-title">Overview</div>
          <div className="cards-grid">
            {latestWeight && (
              <StatCard label="Latest weight" value={`${latestWeight.weight} ${weightUnit}`} sub={latestWeight.date} />
            )}
            {sevenDayAvg !== null && (
              <StatCard label="7-day average" value={`${sevenDayAvg.toFixed(1)} ${weightUnit}`} />
            )}
            {latestBodyFat?.bodyFat != null && (
              <StatCard label="Latest body fat" value={`${latestBodyFat.bodyFat.toFixed(1)}%`} sub={latestBodyFat.date} />
            )}
            {latestActivity && (
              <StatCard
                label={isActivityToday ? 'Steps today' : 'Latest steps'}
                value={latestActivity.steps.toLocaleString()}
                sub={isActivityToday ? undefined : latestActivity.date}
              />
            )}
            {latestSleep && (
              <StatCard
                label={isSleepLastNight ? 'Sleep last night' : 'Latest sleep'}
                value={formatDuration(latestSleep.totalMinutes)}
                sub={isSleepLastNight ? undefined : latestSleep.date}
              />
            )}
            {latestRestingHeartRate?.restingHeartRate != null && (
              <StatCard label="Resting heart rate" value={`${latestRestingHeartRate.restingHeartRate} bpm`} sub={latestRestingHeartRate.date} />
            )}
          </div>

          <div className="section-title">Body composition</div>
          {(latestLeanMass || latestBoneMass || latestBodyWater || weightChange !== null) ? (
            <div className="cards-grid">
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
          ) : (
            <p className="empty-hint">No body composition data yet.</p>
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
                <line className="weight-trend-grid" x1="8" y1="10" x2="92" y2="10" />
                <line className="weight-trend-grid" x1="8" y1="29.5" x2="92" y2="29.5" />
                <line className="weight-trend-grid" x1="8" y1="49" x2="92" y2="49" />
                <line className="weight-trend-grid" x1="8" y1="68.5" x2="92" y2="68.5" />
                <line className="weight-trend-grid" x1="8" y1="88" x2="92" y2="88" />
                <path className="weight-trend-area" d={toSmoothAreaPath(trendChart.weightPoints)} fill="url(#weight-trend-area-fill)" />
                <path className="weight-trend-line weight-trend-line--weight" d={toSmoothPath(trendChart.weightPoints)} />
                {trendChart.bodyFatPoints.length >= 2 && (
                  <path className="weight-trend-line weight-trend-line--body-fat" d={toSmoothPath(trendChart.bodyFatPoints)} />
                )}
                {trendChart.weightPoints.map((point, index) => {
                  const entry = trendChart.entries.find((item) => item.id === point.id);
                  const isLatest = index === trendChart.weightPoints.length - 1;
                  return (
                    <circle
                      key={`w-${point.id}`}
                      className={`weight-trend-dot weight-trend-dot--weight${isLatest ? ' weight-trend-dot--latest' : ''}`}
                      cx={point.x} cy={point.y} r={isLatest ? 2.6 : 1.7}
                    >
                      <title>{`${point.date}: weight ${point.value.toFixed(1)} ${weightUnit}${entry?.bodyFat != null ? `; body fat ${entry.bodyFat.toFixed(1)}%` : ''}`}</title>
                    </circle>
                  );
                })}
                {trendChart.bodyFatPoints.map((point) => (
                  <circle key={`bf-${point.id}`} className="weight-trend-dot weight-trend-dot--body-fat" cx={point.x} cy={point.y} r="2">
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
        </>
      )}

      <div className="section-title">History</div>
      {sorted.length === 0 ? (
        <p className="empty-hint">No weight entries yet. Sync from Garmin to start tracking.</p>
      ) : (
        <>
          <ul className="weight-list">
            {historyEntries.map((e) => (
              <li key={e.id} className="weight-entry weight-entry--full">
                <span className="weight-entry-date">{e.date}</span>
                <span className="weight-entry-value">
                  {e.weight} {e.unit}
                  {e.bodyFat != null && <small className="dim"> · {e.bodyFat}% fat</small>}
                  {e.source === 'garminHealthConnect' && <small className="source-pill"> Garmin</small>}
                </span>
              </li>
            ))}
          </ul>
          {sorted.length > HISTORY_PREVIEW_COUNT && (
            <button type="button" className="btn btn--ghost btn--sm history-toggle" onClick={() => setShowFullHistory((v) => !v)}>
              {showFullHistory ? 'Show less' : `Show full history (${sorted.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
