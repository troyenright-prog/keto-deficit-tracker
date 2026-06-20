import type { DailyNutritionSummary, NutritionTargets } from '../types';

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
  const ref = new Date(referenceDate);
  const cutoff = new Date(ref);
  cutoff.setDate(ref.getDate() - 6);

  const relevant = entries.filter((e) => {
    const d = new Date(e.date);
    return d >= cutoff && d <= ref;
  });

  if (relevant.length < 3) return null;
  return relevant.reduce((acc, e) => acc + e.weight, 0) / relevant.length;
}

export function last7Days(referenceDate: string): string[] {
  const dates: string[] = [];
  const ref = new Date(referenceDate);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref);
    d.setDate(ref.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
