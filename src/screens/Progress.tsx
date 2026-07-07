import { useMemo, useState } from 'react';
import type { DailyNutritionSummary, FoodLogEntry, NutritionTargets } from '../types';
import { carbStatus, summariseDay, todayDateString } from '../lib/nutrition';
import { computeWeeklyStats, last7Days, lastNDays } from '../lib/weekly';
import { loggedDates } from '../lib/history';
import { addLocalDays, formatLongDate } from '../lib/date';
import { StatCard } from '../components/StatCard';

const BREAKDOWN_RANGE_OPTIONS = [7, 14, 30] as const;
const BREAKDOWN_PAGE_SIZE = 10;

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'within', label: 'Within budget' },
  { key: 'exceeded', label: 'Exceeded' },
] as const;
type StatusFilter = typeof STATUS_FILTERS[number]['key'];

function matchesStatusFilter(summary: DailyNutritionSummary, targets: NutritionTargets, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  const exceeded = carbStatus(summary, targets) === 'exceeded';
  return filter === 'exceeded' ? exceeded : !exceeded;
}

// Mirrors the aligned/approaching/exceeded language already used on the
// Dashboard's carb status, so a day reads the same way on both screens.
function carbRowVariant(summary: DailyNutritionSummary, targets: NutritionTargets): 'success' | 'warning' | 'danger' {
  const status = carbStatus(summary, targets);
  return status === 'aligned' ? 'success' : status === 'approaching' ? 'warning' : 'danger';
}

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

  // Day breakdown: its own range (independent of the week picker above, but
  // anchored to the same end date so browsing an older week still shows that
  // week's trailing days) plus a status filter, capped and paginated so a
  // 30-day view never dumps a huge table at once.
  const [breakdownRangeDays, setBreakdownRangeDays] = useState<number>(BREAKDOWN_RANGE_OPTIONS[0]);
  const [breakdownStatus, setBreakdownStatus] = useState<StatusFilter>('all');
  const [breakdownVisible, setBreakdownVisible] = useState(BREAKDOWN_PAGE_SIZE);

  // Reset the load-more page size whenever the filters change, following
  // React's "adjust state during render" pattern instead of an effect (an
  // effect here would commit the stale page size for one extra render).
  const breakdownFilterKey = `${selectedWeek.endDate}|${breakdownRangeDays}|${breakdownStatus}`;
  const [lastBreakdownFilterKey, setLastBreakdownFilterKey] = useState(breakdownFilterKey);
  if (breakdownFilterKey !== lastBreakdownFilterKey) {
    setLastBreakdownFilterKey(breakdownFilterKey);
    setBreakdownVisible(BREAKDOWN_PAGE_SIZE);
  }

  const breakdownAllSummaries = useMemo(
    () => lastNDays(selectedWeek.endDate, breakdownRangeDays).map((d) => summariseDay(d, log)).reverse(),
    [selectedWeek.endDate, breakdownRangeDays, log],
  );
  const breakdownTracked = breakdownAllSummaries.filter((s) => s.entryCount > 0);
  const breakdownUntrackedCount = breakdownAllSummaries.length - breakdownTracked.length;
  const breakdownFiltered = breakdownTracked.filter((s) => matchesStatusFilter(s, targets, breakdownStatus));
  const breakdownVisibleRows = breakdownFiltered.slice(0, breakdownVisible);
  const breakdownHasMore = breakdownVisible < breakdownFiltered.length;
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
              sub={bestCarbDay ? formatLongDate(bestCarbDay.date) : 'No tracked days'}
              variant="success"
            />
          </div>

          <div className="section-title">Day breakdown</div>
          <div className="breakdown-filters">
            <div className="form-group">
              <label htmlFor="breakdown-range">Range</label>
              <select
                id="breakdown-range"
                value={breakdownRangeDays}
                onChange={(e) => setBreakdownRangeDays(Number(e.target.value))}
              >
                {BREAKDOWN_RANGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>Last {n} days</option>
                ))}
              </select>
            </div>
            <div className="status-chip-group" role="group" aria-label="Filter by carb status">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`status-chip status-chip--${f.key}${breakdownStatus === f.key ? ' status-chip--active' : ''}`}
                  aria-pressed={breakdownStatus === f.key}
                  onClick={() => setBreakdownStatus(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <p className="breakdown-count">
            {`Showing ${breakdownVisibleRows.length} of ${breakdownFiltered.length} day${breakdownFiltered.length === 1 ? '' : 's'}`}
            {breakdownUntrackedCount > 0 && ` (${breakdownUntrackedCount} untracked day${breakdownUntrackedCount === 1 ? '' : 's'} in this range not shown)`}
          </p>

          {breakdownVisibleRows.length === 0 ? (
            <p className="empty-hint empty-hint--compact">No days match this filter.</p>
          ) : (
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
                  {breakdownVisibleRows.map((s) => {
                    const variant = carbRowVariant(s, targets);
                    return (
                      <tr key={s.date} className={`week-table-row--${variant}`}>
                        <td>{formatLongDate(s.date)}</td>
                        <td>{Math.round(s.calories)}</td>
                        <td>{s.proteinG.toFixed(1)}g</td>
                        <td className={`cell--${variant}`}>{s.netCarbsG.toFixed(1)}g</td>
                        <td>{s.fatG.toFixed(1)}g</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {breakdownHasMore && (
            <button
              type="button"
              className="btn btn--secondary btn--sm breakdown-load-more"
              onClick={() => setBreakdownVisible((v) => v + BREAKDOWN_PAGE_SIZE)}
            >
              Load {Math.min(BREAKDOWN_PAGE_SIZE, breakdownFiltered.length - breakdownVisible)} more days
            </button>
          )}
        </>
      )}
    </div>
  );
}
