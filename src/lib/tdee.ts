import type { ActivityLevel, BiologicalSex, UserProfile, WeightEntry } from '../types';

// Ported from the LiFT gym app's nutrition calculator (Settings, 2026-07-03):
// Katch-McArdle from logged weight + body fat when available (more accurate,
// since it's based on actual lean mass), falling back to Mifflin-St Jeor from
// height/age/sex when no body-fat reading has been logged yet.
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  veryActive: 1.725,
  extraActive: 1.9,
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (desk job)',
  light: 'Light (some walking)',
  moderate: 'Moderate (on-feet job/cardio)',
  veryActive: 'Very active (hard training 6-7 days/wk)',
  extraActive: 'Extra active (physical job + training)',
};

export const ACTIVITY_LEVELS = Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[];

const LB_PER_KG = 2.20462;

function toKg(weight: number, unit: 'kg' | 'lbs'): number {
  return unit === 'lbs' ? weight / LB_PER_KG : weight;
}

export function latestWeightKg(entries: WeightEntry[]): number | null {
  const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
  return latest ? toKg(latest.weight, latest.unit) : null;
}

export function latestBodyFatPercent(entries: WeightEntry[]): number | null {
  const withBodyFat = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((entry) => entry.bodyFat != null);
  return withBodyFat?.bodyFat ?? null;
}

export function calcBmr(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: BiologicalSex,
  bodyFatPercent: number | null,
): number {
  if (bodyFatPercent != null) {
    const leanMassKg = weightKg * (1 - bodyFatPercent / 100);
    return 370 + 21.6 * leanMassKg;
  }
  return sex === 'female'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
}

export function calcTdee(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: BiologicalSex,
  bodyFatPercent: number | null,
  activityLevel: ActivityLevel,
): number {
  return calcBmr(weightKg, heightCm, age, sex, bodyFatPercent) * ACTIVITY_MULTIPLIERS[activityLevel];
}

export interface TdeeEstimate {
  tdee: number;
  weightKg: number;
  bodyFatPercent: number | null;
}

// Returns null when required inputs (a logged weight, height, age, sex) are missing,
// so callers can prompt the user to fill those in rather than compute on placeholders.
export function estimateTdee(profile: UserProfile, weightEntries: WeightEntry[]): TdeeEstimate | null {
  const weightKg = latestWeightKg(weightEntries);
  if (weightKg == null || !profile.heightCm || !profile.age || !profile.sex) return null;
  const bodyFatPercent = latestBodyFatPercent(weightEntries);
  const activityLevel = profile.activityLevel ?? 'moderate';
  const tdee = calcTdee(weightKg, profile.heightCm, profile.age, profile.sex, bodyFatPercent, activityLevel);
  return { tdee, weightKg, bodyFatPercent };
}

export interface RecalculatedMacros {
  calories: number;
  proteinG: number;
  fatG: number;
}

// Carbs are the user's call (dietMode / manual override) — this solves calories,
// protein, and fat around a fixed net-carb ceiling, matching the LiFT calculator's
// "carbs fixed, everything else solved around them" approach.
export function recalcMacrosFromTdee(
  estimate: TdeeEstimate,
  netCarbsG: number,
  proteinPerKg: number,
  deficitPercent: number,
): RecalculatedMacros {
  const targetCalories = estimate.tdee * (1 - deficitPercent / 100);
  const proteinG = Math.round(estimate.weightKg * proteinPerKg);
  const proteinKcal = proteinG * 4;
  const carbKcal = netCarbsG * 4;
  const fatG = Math.max(20, Math.round((targetCalories - proteinKcal - carbKcal) / 9));
  const calories = Math.round(targetCalories / 10) * 10;
  return { calories, proteinG, fatG };
}
