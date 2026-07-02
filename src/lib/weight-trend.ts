import type { WeightEntry } from '../types';

export interface TrendPoint {
  id: string;
  date: string;
  x: number;
  y: number;
  value: number;
}

export interface WeightTrendChart {
  entries: WeightEntry[];
  weightPoints: TrendPoint[];
  bodyFatPoints: TrendPoint[];
  weightRange: { min: number; max: number };
  bodyFatRange: { min: number; max: number } | null;
}

const MIN_Y = 18;
const MAX_Y = 82;
const MIN_X = 10;
const MAX_X = 90;

function paddedRange(values: number[], minimumRange: number): { min: number; max: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(minimumRange, max - min);
  const pad = range === minimumRange ? minimumRange / 2 : range * 0.1;
  return { min: min - pad, max: max + pad };
}

function mapY(value: number, range: { min: number; max: number }): number {
  const span = Math.max(0.1, range.max - range.min);
  return MAX_Y - ((value - range.min) / span) * (MAX_Y - MIN_Y);
}

function pointString(points: TrendPoint[]): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

export function toPolylinePoints(points: TrendPoint[]): string {
  return pointString(points);
}

export function buildWeightTrendChart(
  entries: WeightEntry[],
  weightUnit: 'kg' | 'lbs',
  limit = 14,
): WeightTrendChart | null {
  const chartEntries = entries
    .filter((entry) => entry.unit === weightUnit && Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit);

  if (chartEntries.length < 2) return null;

  const xForIndex = (index: number): number =>
    chartEntries.length === 1 ? 50 : MIN_X + (index / (chartEntries.length - 1)) * (MAX_X - MIN_X);

  const weightRange = paddedRange(chartEntries.map((entry) => entry.weight), 0.6);
  const bodyFatEntries = chartEntries.filter((entry) => Number.isFinite(entry.bodyFat) && (entry.bodyFat as number) > 0);
  const bodyFatRange = bodyFatEntries.length > 0
    ? paddedRange(bodyFatEntries.map((entry) => entry.bodyFat as number), 1)
    : null;

  return {
    entries: chartEntries,
    weightRange,
    bodyFatRange,
    weightPoints: chartEntries.map((entry, index) => ({
      id: entry.id,
      date: entry.date,
      x: xForIndex(index),
      y: mapY(entry.weight, weightRange),
      value: entry.weight,
    })),
    bodyFatPoints: bodyFatRange
      ? chartEntries.flatMap((entry, index) => {
          if (!Number.isFinite(entry.bodyFat) || (entry.bodyFat as number) <= 0) return [];
          return [{
            id: entry.id,
            date: entry.date,
            x: xForIndex(index),
            y: mapY(entry.bodyFat as number, bodyFatRange),
            value: entry.bodyFat as number,
          }];
        })
      : [],
  };
}
