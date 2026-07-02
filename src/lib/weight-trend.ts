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

const MIN_Y = 10;
const MAX_Y = 88;
const MIN_X = 8;
const MAX_X = 92;

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

// Smooths a point series into a cubic-bezier SVG path (Catmull-Rom style) so
// trend lines read as a gentle curve instead of a jagged zigzag.
export function toSmoothPath(points: TrendPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 8;
    const c1y = p1.y + (p2.y - p0.y) / 8;
    const c2x = p2.x - (p3.x - p1.x) / 8;
    const c2y = p2.y - (p3.y - p1.y) / 8;
    path += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

// Same smoothed curve, closed down to a baseline so it can be used as a filled area.
export function toSmoothAreaPath(points: TrendPoint[], baselineY = MAX_Y): string {
  if (points.length < 2) return '';
  const line = toSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x.toFixed(2)} ${baselineY} L ${first.x.toFixed(2)} ${baselineY} Z`;
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
