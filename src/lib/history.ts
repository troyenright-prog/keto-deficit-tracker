import type { FoodLogEntry } from '../types';

// All distinct dates that have at least one logged entry, oldest first —
// unlike last7Days() in weekly.ts this doesn't fill in a fixed calendar
// window, since all-time history can span months with long gaps.
export function loggedDates(entries: FoodLogEntry[]): string[] {
  return [...new Set(entries.map((e) => e.date))].sort();
}
