import { useMemo, useState } from 'react';
import type { DailyNutritionSummary, FoodLogEntry, NutritionTargets } from '../types';
import { todayDateString } from '../lib/nutrition';
import { computeWeeklyStats, last7Days } from '../lib/weekly';
import { summariseDay } from '../lib/nutrition';
import { summariseHistory, nutrientHistoryPoints, summariseNutrientHistory } from '../lib/history';
import { MICRONUTRIENT_FIELDS } from '../lib/micronutrients';
import { StatCard } from '../components/StatCard';

interface ProgressProps {
  log: FoodLogEntry[];
  targets: NutritionTargets;
}

interface NutrientOption {
  key: keyof DailyNutritionSummary;
  label: string;
  unit: string;
  decimals: number;
  target: number;
}

function buildNutrientOptions(targets: NutritionTargets): NutrientOption[] {
  const base: NutrientOption[] = [
    { key: 'calories', label: 'Calories', unit: 'kcal', decimals: 0, target: targets.calories },
    { key: 'proteinG', label: 'Protein', unit: 'g', decimals: 1, target: targets.proteinG },
    { key: 'netCarbsG', label: 'Net carbs', unit: 'g', decimals: 1, target: targets.netCarbsG },
    { key: 'fatG', label: 'Fat', unit: 'g', decimals: 1, target: targets.fatG },
    { key: 'fibreG', label: 'Fibre', unit: 'g', decimals: 1, target: 0 },
    { key: 'sodiumMg', label: 'Sodium', unit: 'mg', decimals: 0, target: targets.sodiumMg },
    { key: 'potassiumMg', label: 'Potassium', unit: 'mg', decimals: 0, target: targets.potassiumMg },
    { key: 'magnesiumMg', label: 'Magnesium', unit: 'mg', decimals: 0, target: targets.magnesiumMg },
  ];
  const micros: NutrientOption[] = MICRONUTRIENT_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    unit: field.unit,
    decimals: field.decimals,
    target: targets[field.key] ?? 0,
  }));
  return [...base, ...micros];
}

function formatAmount(option: NutrientOption, value: number): string {
  return `${value.toFixed(option.decimals)}${option.unit === 'kcal' ? ' kcal' : option.unit}`;
}

export function Progress({ log, targets }: ProgressProps) {
  const today = todayDateString();
  const days = useMemo(() => last7Days(today), [today]);

  const weekSummaries = useMemo(
    () => days.map((d) => summariseDay(d, log)),
    [days, log],
  );

  const stats = useMemo(() => computeWeeklyStats(weekSummaries, targets), [weekSummaries, targets]);
  const trackedSummaries = weekSummaries.filter((summary) => summary.entryCount > 0);
  const bestCarbDay = trackedSummaries.length > 0
    ? trackedSummaries.reduce((best, summary) => summary.netCarbsG < best.netCarbsG ? summary : best)
    : null;
  const highCarbDays = trackedSummaries.filter((summary) => summary.netCarbsG > targets.netCarbsG).length;
  const lowProteinDays = trackedSummaries.filter((summary) => summary.proteinG < targets.proteinG * 0.75).length;

  const historySummaries = useMemo(() => summariseHistory(log), [log]);
  const nutrientOptions = useMemo(() => buildNutrientOptions(targets), [targets]);
  const [nutrientKey, setNutrientKey] = useState<keyof DailyNutritionSummary>('calories');
  const nutrient = nutrientOptions.find((o) => o.key === nutrientKey) ?? nutrientOptions[0];

  const historyPoints = useMemo(
    () => nutrientHistoryPoints(historySummaries, nutrient.key),
    [historySummaries, nutrient.key],
  );
  const historyStats = useMemo(() => summariseNutrientHistory(historyPoints), [historyPoints]);
  const recentFirst = useMemo(() => [...historyPoints].reverse(), [historyPoints]);

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Progress</h1>
        <span className="screen-sub">This week &amp; all-time history</span>
      </div>

      {stats.daysTracked === 0 ? (
        <p className="empty-hint">No food logged in the last 7 days. Start logging to see your progress.</p>
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
            Averages this week ({stats.daysTracked} day{stats.daysTracked !== 1 ? 's' : ''} tracked)
          </div>
          <div className="cards-grid cards-grid--4">
            <StatCard label="Avg calories" value={Math.round(stats.avgCalories)} sub="kcal/day" />
            <StatCard label="Avg protein" value={`${stats.avgProteinG.toFixed(1)}g`} sub={`${lowProteinDays} low day${lowProteinDays === 1 ? '' : 's'}`} />
            <StatCard label="Avg net carbs" value={`${stats.avgNetCarbsG.toFixed(1)}g`} sub={`target ${targets.netCarbsG}g`} />
            <StatCard label="Avg fat" value={`${stats.avgFatG.toFixed(1)}g`} sub="per day" />
          </div>

          <div className="section-title">Targets hit this week</div>
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

          <div className="section-title">This week</div>
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

      <div className="section-title">Nutrient history (all-time)</div>

      {historySummaries.length === 0 ? (
        <p className="empty-hint">No food logged yet. History builds up as you track days.</p>
      ) : (
        <>
          <div className="form-group">
            <label htmlFor="nutrient-history-select">Nutrient</label>
            <select
              id="nutrient-history-select"
              value={nutrient.key}
              onChange={(e) => setNutrientKey(e.target.value as keyof DailyNutritionSummary)}
            >
              {nutrientOptions.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          {historyStats.daysTracked === 0 ? (
            <p className="empty-hint">No logged days have {nutrient.label.toLowerCase()} data yet.</p>
          ) : (
            <>
              <div className="cards-grid cards-grid--4">
                <StatCard
                  label={`Avg ${nutrient.label.toLowerCase()}`}
                  value={formatAmount(nutrient, historyStats.average)}
                  sub={nutrient.target > 0 ? `target ${formatAmount(nutrient, nutrient.target)}` : `${historyStats.daysTracked} days tracked`}
                />
                <StatCard label="Best day" value={formatAmount(nutrient, historyStats.min)} sub="lowest logged" />
                <StatCard label="Highest day" value={formatAmount(nutrient, historyStats.max)} sub="highest logged" />
                <StatCard label="Days tracked" value={historyStats.daysTracked} sub="all-time" />
              </div>

              <div className="week-table-wrap">
                <table className="week-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>{nutrient.label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentFirst.map((point) => (
                      <tr key={point.date}>
                        <td>{point.date}</td>
                        <td>{formatAmount(nutrient, point.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
