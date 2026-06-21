import { describe, expect, it } from 'vitest';
import { normalizePhotoEstimate, photoEstimateToLogEntry } from '../lib/photo-estimate';
import { validPhotoEstimate } from './fixtures/photo-estimate';

describe('photo estimate validation', () => {
  it('accepts a structured estimate and clamps net carbs to zero', () => {
    const estimate = normalizePhotoEstimate(validPhotoEstimate());
    expect(estimate).not.toBeNull();
    expect(estimate!.totals.netCarbs).toBe(0);
  });

  it('rejects missing, negative, non-finite, or malformed values', () => {
    expect(normalizePhotoEstimate({})).toBeNull();
    expect(normalizePhotoEstimate({ ...validPhotoEstimate(), overallConfidence: 2 })).toBeNull();
    expect(normalizePhotoEstimate({ ...validPhotoEstimate(), totals: { ...validPhotoEstimate().totals, calories: -1 } })).toBeNull();
    expect(normalizePhotoEstimate({ ...validPhotoEstimate(), totals: { ...validPhotoEstimate().totals, calories: Infinity } })).toBeNull();
  });

  it('creates a stable reviewed food-log snapshot with photo metadata', () => {
    const estimate = normalizePhotoEstimate(validPhotoEstimate())!;
    const entry = photoEstimateToLogEntry(estimate, '2026-06-21');
    estimate.totals.calories = 999;
    estimate.assumptions[0] = 'Changed later';
    expect(entry).toMatchObject({
      date: '2026-06-21', source: 'photo-estimate', sourceType: 'photo-estimate',
      calories: 410, confidence: 0.72,
    });
    expect(entry.assumptions).toEqual(['Chicken appears grilled without breading.']);
  });
});
