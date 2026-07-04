import type { DailyNutritionSummary, FoodLogEntry } from '../types';
import { summariseDay } from './nutrition';

// All distinct dates that have at least one logged entry, oldest first —
// unlike last7Days() in weekly.ts this doesn't fill in a fixed calendar
// window, since all-time history can span months with long gaps.
export function loggedDates(entries: FoodLogEntry[]): string[] {
  return [...new Set(entries.map((e) => e.date))].sort();
}

export function summariseHistory(entries: FoodLogEntry[]): DailyNutritionSummary[] {
  return loggedDates(entries).map((date) => summariseDay(date, entries));
}

export interface NutrientHistoryPoint {
  date: string;
  value: number;
}

export interface NutrientHistoryStats {
  average: number;
  min: number;
  max: number;
  daysTracked: number;
}

export function nutrientHistoryPoints(
  summaries: DailyNutritionSummary[],
  key: keyof DailyNutritionSummary,
): NutrientHistoryPoint[] {
  return summaries
    .filter((s) => s.entryCount > 0)
    .map((s) => ({ date: s.date, value: (s[key] as number | undefined) ?? 0 }));
}

export function summariseNutrientHistory(points: NutrientHistoryPoint[]): NutrientHistoryStats {
  if (points.length === 0) return { average: 0, min: 0, max: 0, daysTracked: 0 };
  const values = points.map((p) => p.value);
  return {
    average: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    daysTracked: values.length,
  };
}
