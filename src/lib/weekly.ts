import type { DailyNutritionSummary, NutritionTargets } from '../types';
import { addLocalDays, isDateString } from './date';

// A tracked day below this fraction of the calorie target is treated as
// under-logged (or heavily restricted): it still counts as tracked, but it
// cannot count as "within the calorie target" or "within the carb budget" —
// a day with one coffee logged is not a success.
export const LOW_INTAKE_RATIO = 0.5;

export interface WeeklyStats {
  avgCalories: number;
  avgProteinG: number;
  avgNetCarbsG: number;
  avgFatG: number;
  daysWithinCalorieTarget: number;
  daysWithinNetCarbLimit: number;
  ketoAlignmentPct: number;
  daysTracked: number;
  lowIntakeDays: number;
}

export function computeWeeklyStats(
  summaries: DailyNutritionSummary[],
  targets: NutritionTargets,
): WeeklyStats {
  const tracked = summaries.filter((s) => s.entryCount > 0);
  const n = tracked.length;

  if (n === 0) {
    return {
      avgCalories: 0,
      avgProteinG: 0,
      avgNetCarbsG: 0,
      avgFatG: 0,
      daysWithinCalorieTarget: 0,
      daysWithinNetCarbLimit: 0,
      ketoAlignmentPct: 0,
      daysTracked: 0,
      lowIntakeDays: 0,
    };
  }

  const avg = (key: keyof DailyNutritionSummary) =>
    tracked.reduce((acc, s) => acc + (s[key] as number), 0) / n;

  const meaningfullyLogged = (s: DailyNutritionSummary) =>
    targets.calories <= 0 || s.calories >= targets.calories * LOW_INTAKE_RATIO;

  const lowIntakeDays = tracked.filter((s) => !meaningfullyLogged(s)).length;

  const daysWithinCalorieTarget = tracked.filter(
    (s) => meaningfullyLogged(s) && s.calories <= targets.calories,
  ).length;

  const daysWithinNetCarbLimit = tracked.filter(
    (s) => meaningfullyLogged(s) && s.netCarbsG <= targets.netCarbsG,
  ).length;

  return {
    avgCalories: avg('calories'),
    avgProteinG: avg('proteinG'),
    avgNetCarbsG: avg('netCarbsG'),
    avgFatG: avg('fatG'),
    daysWithinCalorieTarget,
    daysWithinNetCarbLimit,
    ketoAlignmentPct: (daysWithinNetCarbLimit / n) * 100,
    daysTracked: n,
    lowIntakeDays,
  };
}

export function sevenDayAvgWeight(
  entries: { date: string; weight: number }[],
  referenceDate: string,
): number | null {
  if (!isDateString(referenceDate)) return null;
  const cutoff = addLocalDays(referenceDate, -6);

  const relevant = entries.filter((e) => {
    return isDateString(e.date) && e.date >= cutoff && e.date <= referenceDate;
  });

  if (relevant.length < 3) return null;
  return relevant.reduce((acc, e) => acc + e.weight, 0) / relevant.length;
}

export function last7Days(referenceDate: string): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(addLocalDays(referenceDate, -i));
  }
  return dates;
}
