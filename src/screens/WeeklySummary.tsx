import { useMemo } from 'react';
import type { FoodLogEntry, NutritionTargets, WeightEntry } from '../types';
import { summariseDay, todayDateString } from '../lib/nutrition';
import { computeWeeklyStats, last7Days, sevenDayAvgWeight } from '../lib/weekly';
import { StatCard } from '../components/StatCard';

interface WeeklySummaryProps {
  log: FoodLogEntry[];
  targets: NutritionTargets;
  weightEntries: WeightEntry[];
  onAddWeight: (weight: number, unit: 'kg' | 'lbs') => void;
  weightUnit: 'kg' | 'lbs';
}

export function WeeklySummary({ log, targets, weightEntries, onAddWeight, weightUnit }: WeeklySummaryProps) {
  const today = todayDateString();
  const days = useMemo(() => last7Days(today), [today]);

  const summaries = useMemo(
    () => days.map((d) => summariseDay(d, log)),
    [days, log],
  );

  const stats = useMemo(() => computeWeeklyStats(summaries, targets), [summaries, targets]);

  const sortedWeights = [...weightEntries]
    .filter((e) => e.unit === weightUnit)
    .sort((a, b) => b.date.localeCompare(a.date));

  const latestWeight = sortedWeights[0];
  const sevenDayAvg = sevenDayAvgWeight(sortedWeights, today);

  const weightChange =
    sortedWeights.length >= 2
      ? sortedWeights[0].weight - sortedWeights[sortedWeights.length - 1].weight
      : null;

  function handleAddWeight(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const w = parseFloat(fd.get('weight') as string);
    if (isNaN(w) || w <= 0) return;
    onAddWeight(w, weightUnit);
    e.currentTarget.reset();
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Weekly Summary</h1>
        <span className="screen-sub">Last 7 days</span>
      </div>

      {stats.daysTracked === 0 ? (
        <p className="empty-hint">No food logged in the last 7 days. Start logging to see your weekly summary.</p>
      ) : (
        <>
          <div className="section-title">Averages ({stats.daysTracked} day{stats.daysTracked !== 1 ? 's' : ''} tracked)</div>
          <div className="cards-grid cards-grid--4">
            <StatCard label="Avg calories" value={Math.round(stats.avgCalories)} sub="kcal/day" />
            <StatCard label="Avg protein" value={`${stats.avgProteinG.toFixed(1)}g`} sub="per day" />
            <StatCard label="Avg net carbs" value={`${stats.avgNetCarbsG.toFixed(1)}g`} sub="per day" />
            <StatCard label="Avg fat" value={`${stats.avgFatG.toFixed(1)}g`} sub="per day" />
          </div>

          <div className="section-title">Targets hit</div>
          <div className="cards-grid">
            <StatCard
              label="Days within calorie target"
              value={`${stats.daysWithinCalorieTarget} / ${stats.daysTracked}`}
              variant={stats.daysWithinCalorieTarget === stats.daysTracked ? 'success' : 'default'}
            />
            <StatCard
              label="Keto alignment"
              value={`${Math.round(stats.ketoAlignmentPct)}%`}
              sub={`${stats.daysWithinNetCarbLimit} / ${stats.daysTracked} days within carb limit`}
              variant={stats.ketoAlignmentPct >= 80 ? 'success' : stats.ketoAlignmentPct >= 50 ? 'warning' : 'danger'}
            />
          </div>

          <div className="section-title">Day breakdown</div>
          <table className="week-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>kcal</th>
                <th>Protein</th>
                <th>Net carbs</th>
                <th>Fat</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.date} className={s.entryCount === 0 ? 'week-table__empty' : ''}>
                  <td>{s.date}</td>
                  <td>{s.entryCount > 0 ? Math.round(s.calories) : '—'}</td>
                  <td>{s.entryCount > 0 ? `${s.proteinG.toFixed(1)}g` : '—'}</td>
                  <td className={s.entryCount > 0 && s.netCarbsG > targets.netCarbsG ? 'cell--danger' : ''}>
                    {s.entryCount > 0 ? `${s.netCarbsG.toFixed(1)}g` : '—'}
                  </td>
                  <td>{s.entryCount > 0 ? `${s.fatG.toFixed(1)}g` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="section-title">Weight tracking</div>

      <form className="weight-form" onSubmit={handleAddWeight}>
        <input
          name="weight"
          type="number"
          step="0.1"
          min="0"
          placeholder={`Weight (${weightUnit})`}
          className="weight-input"
        />
        <button type="submit" className="btn btn--primary">Log weight</button>
      </form>

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
          {weightChange !== null && sortedWeights.length >= 2 && (
            <StatCard
              label={`Change (${sortedWeights.length} entries)`}
              value={`${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)} ${weightUnit}`}
              variant={weightChange < 0 ? 'success' : weightChange > 0 ? 'warning' : 'default'}
            />
          )}
        </div>
      )}

      {sortedWeights.length > 0 && (
        <ul className="weight-list">
          {sortedWeights.slice(0, 10).map((e) => (
            <li key={e.id} className="weight-entry">
              {e.date}: {e.weight} {e.unit}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
