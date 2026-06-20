import { useMemo } from 'react';
import type { FoodLogEntry, NutritionTargets } from '../types';
import { summariseDay, todayDateString } from '../lib/nutrition';
import { computeWeeklyStats, last7Days } from '../lib/weekly';
import { StatCard } from '../components/StatCard';

interface WeeklySummaryProps {
  log: FoodLogEntry[];
  targets: NutritionTargets;
}

export function WeeklySummary({ log, targets }: WeeklySummaryProps) {
  const today = todayDateString();
  const days = useMemo(() => last7Days(today), [today]);

  const summaries = useMemo(
    () => days.map((d) => summariseDay(d, log)),
    [days, log],
  );

  const stats = useMemo(() => computeWeeklyStats(summaries, targets), [summaries, targets]);

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
          <div className="section-title">
            Averages ({stats.daysTracked} day{stats.daysTracked !== 1 ? 's' : ''} tracked)
          </div>
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
    </div>
  );
}
