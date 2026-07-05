import { useMemo, useState } from 'react';
import type { FoodLogEntry, NutritionTargets } from '../types';
import { summariseDay, todayDateString } from '../lib/nutrition';
import { computeWeeklyStats, last7Days } from '../lib/weekly';
import { loggedDates } from '../lib/history';
import { addLocalDays } from '../lib/date';
import { StatCard } from '../components/StatCard';

interface ProgressProps {
  log: FoodLogEntry[];
  targets: NutritionTargets;
}

interface WeekOption {
  endDate: string;
  label: string;
}

// One option per 7-day block going back from today, as far as the earliest
// logged date — lets the whole history be browsed one week at a time instead
// of picking a single nutrient to trend.
function buildWeekOptions(today: string, log: FoodLogEntry[]): WeekOption[] {
  const earliest = loggedDates(log)[0];
  const options: WeekOption[] = [];
  let end = today;
  for (let i = 0; i < 260; i++) { // ~5 years safety cap
    const start = addLocalDays(end, -6);
    const range = `${start} to ${end}`;
    const label = i === 0 ? `This week (${range})` : i === 1 ? `Last week (${range})` : range;
    options.push({ endDate: end, label });
    if (!earliest || start <= earliest) break;
    end = addLocalDays(end, -7);
  }
  return options;
}

export function Progress({ log, targets }: ProgressProps) {
  const today = todayDateString();
  const weekOptions = useMemo(() => buildWeekOptions(today, log), [today, log]);
  const [weekEnd, setWeekEnd] = useState(today);
  const selectedWeek = weekOptions.find((w) => w.endDate === weekEnd) ?? weekOptions[0];

  const days = useMemo(() => last7Days(selectedWeek.endDate), [selectedWeek.endDate]);
  const weekSummaries = useMemo(() => days.map((d) => summariseDay(d, log)), [days, log]);

  const stats = useMemo(() => computeWeeklyStats(weekSummaries, targets), [weekSummaries, targets]);
  const trackedSummaries = weekSummaries.filter((summary) => summary.entryCount > 0);
  const bestCarbDay = trackedSummaries.length > 0
    ? trackedSummaries.reduce((best, summary) => summary.netCarbsG < best.netCarbsG ? summary : best)
    : null;
  const highCarbDays = trackedSummaries.filter((summary) => summary.netCarbsG > targets.netCarbsG).length;
  const lowProteinDays = trackedSummaries.filter((summary) => summary.proteinG < targets.proteinG * 0.75).length;

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Progress</h1>
        <span className="screen-sub">All-time, by week</span>
      </div>

      {weekOptions.length > 1 && (
        <div className="form-group">
          <label htmlFor="week-select">Week</label>
          <select id="week-select" value={selectedWeek.endDate} onChange={(e) => setWeekEnd(e.target.value)}>
            {weekOptions.map((w) => (
              <option key={w.endDate} value={w.endDate}>{w.label}</option>
            ))}
          </select>
        </div>
      )}

      {stats.daysTracked === 0 ? (
        <p className="empty-hint">
          {weekOptions.length > 1
            ? 'No food logged for this week. Try a different week.'
            : 'No food logged in the last 7 days. Start logging to see your progress.'}
        </p>
      ) : (
        <>
          <div className="weekly-insight">
            <strong>{Math.round(stats.ketoAlignmentPct)}% within carb budget</strong>
            <span>
              {stats.daysWithinNetCarbLimit} of {stats.daysTracked} tracked day{stats.daysTracked === 1 ? '' : 's'} stayed within the net-carb budget.
              {highCarbDays > 0 ? ` ${highCarbDays} day${highCarbDays === 1 ? '' : 's'} exceeded the carb target.` : ' No tracked days exceeded the carb target.'}
              {stats.lowIntakeDays > 0 && ` ${stats.lowIntakeDays} day${stats.lowIntakeDays === 1 ? ' was' : 's were'} logged well below the calorie target, so ${stats.lowIntakeDays === 1 ? 'it is' : 'they are'} not counted as on-target.`}
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
                {weekSummaries.map((s) => (
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
