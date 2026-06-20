import type { DailyNutritionSummary, NutritionTargets } from '../types';
import { addLocalDays, isDateString } from './date';

export interface WeeklyStats {
  avgCalories: number;
  avgProteinG: number;
  avgNetCarbsG: number;
  avgFatG: number;
  daysWithinCalorieTarget: number;
  daysWithinNetCarbLimit: number;
  ketoAlignmentPct: number;
  daysTracked: number;
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
    };
  }

  const avg = (key: keyof DailyNutritionSummary) =>
    tracked.reduce((acc, s) => acc + (s[key] as number), 0) / n;

  const daysWithinCalorieTarget = tracked.filter(
    (s) => s.calories <= targets.calories,
  ).length;

  const daysWithinNetCarbLimit = tracked.filter(
    (s) => s.netCarbsG <= targets.netCarbsG,
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
