import type { DailyNutritionSummary, NutritionTargets, Recommendation } from '../types';

export function buildRecommendations(
  summary: DailyNutritionSummary,
  targets: NutritionTargets,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const remaining = targets.calories - summary.calories;
  const carbRatio = summary.netCarbsG / targets.netCarbsG;
  const proteinRatio = summary.proteinG / targets.proteinG;
  const sodiumRatio = summary.sodiumMg / targets.sodiumMg;
  const potassiumRatio = summary.potassiumMg / targets.potassiumMg;
  const magnesiumRatio = summary.magnesiumMg / targets.magnesiumMg;

  if (summary.entryCount === 0) return recs;

  if (summary.calories > targets.calories) {
    recs.push({
      id: 'calories-exceeded',
      message: 'Return to target tomorrow and check your logging accuracy.',
      priority: 'warning',
    });
  } else if (remaining > 200 && proteinRatio < 0.7) {
    recs.push({
      id: 'protein-low',
      message: 'Prioritise lean protein in your next meal.',
      priority: 'info',
    });
  }

  if (carbRatio >= 1) {
    recs.push({
      id: 'carbs-exceeded',
      message: 'Carb limit exceeded — focus on protein and very low-carb foods for the rest of the day.',
      priority: 'warning',
    });
  } else if (carbRatio >= 0.8) {
    recs.push({
      id: 'carbs-approaching',
      message: 'Choose very low-carb foods for the rest of the day to stay within your limit.',
      priority: 'warning',
    });
  }

  if (sodiumRatio < 0.5) {
    recs.push({
      id: 'sodium-low',
      message: 'Consider sodium-rich keto-friendly foods or electrolyte supplementation.',
      priority: 'info',
    });
  }

  if (potassiumRatio < 0.5) {
    recs.push({
      id: 'potassium-low',
      message: 'Consider potassium-rich keto-friendly foods such as avocado, spinach, or salmon.',
      priority: 'info',
    });
  }

  if (magnesiumRatio < 0.5) {
    recs.push({
      id: 'magnesium-low',
      message: 'Consider magnesium-rich keto-friendly foods such as spinach, avocado, or pumpkin seeds.',
      priority: 'info',
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: 'on-track',
      message: 'Great progress — you are on track with your targets today.',
      priority: 'success',
    });
  }

  return recs;
}
