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
  const trackedSummaries = summaries.filter((summary) => summary.entryCount > 0);
  const bestCarbDay = trackedSummaries.length > 0
    ? trackedSummaries.reduce((best, summary) => summary.netCarbsG < best.netCarbsG ? summary : best)
    : null;
  const highCarbDays = trackedSummaries.filter((summary) => summary.netCarbsG > targets.netCarbsG).length;
  const lowProteinDays = trackedSummaries.filter((summary) => summary.proteinG < targets.proteinG * 0.75).length;

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
          <div className="weekly-insight">
            <strong>{Math.round(stats.ketoAlignmentPct)}% keto alignment</strong>
            <span>
              {stats.daysWithinNetCarbLimit} of {stats.daysTracked} tracked day{stats.daysTracked === 1 ? '' : 's'} stayed within net carbs.
              {highCarbDays > 0 ? ` ${highCarbDays} day${highCarbDays === 1 ? '' : 's'} exceeded the carb target.` : ' No tracked days exceeded the carb target.'}
            </span>
          </div>

          <div className="section-title">
            Averages ({stats.daysTracked} day{stats.daysTracked !== 1 ? 's' : ''} tracked)
          </div>
          <div className="cards-grid cards-grid--4">
            <StatCard label="Avg calories" value={Math.round(stats.avgCalories)} sub="kcal/day" />
            <StatCard label="Avg protein" value={`${stats.avgProteinG.toFixed(1)}g`} sub={`${lowProteinDays} low day${lowProteinDays === 1 ? '' : 's'}`} />
            <StatCard label="Avg net carbs" value={`${stats.avgNetCarbsG.toFixed(1)}g`} sub={`target ${targets.netCarbsG}g`} />
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
              label="Best carb day"
              value={bestCarbDay ? `${bestCarbDay.netCarbsG.toFixed(1)}g` : '-'}
              sub={bestCarbDay?.date ?? 'No tracked days'}
              variant="success"
            />
          </div>

          <div className="section-title">Day breakdown</div>
          <div className="week-table-wrap">
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
                    <td>{s.entryCount > 0 ? Math.round(s.calories) : '-'}</td>
                    <td>{s.entryCount > 0 ? `${s.proteinG.toFixed(1)}g` : '-'}</td>
                    <td className={s.entryCount > 0 && s.netCarbsG > targets.netCarbsG ? 'cell--danger' : ''}>
                      {s.entryCount > 0 ? `${s.netCarbsG.toFixed(1)}g` : '-'}
                    </td>
                    <td>{s.entryCount > 0 ? `${s.fatG.toFixed(1)}g` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
