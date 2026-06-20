import type { DailyNutritionSummary, NutritionTargets, Recommendation } from '../types';

interface SuggestionContext {
  remainingCal: number;
  proteinGap: number;
  netCarbsLeft: number;
  carbRatio: number;
  sodiumRatio: number;
  potassiumRatio: number;
  magnesiumRatio: number;
}

function ctx(summary: DailyNutritionSummary, targets: NutritionTargets): SuggestionContext {
  return {
    remainingCal: targets.calories - summary.calories,
    proteinGap: targets.proteinG - summary.proteinG,
    netCarbsLeft: targets.netCarbsG - summary.netCarbsG,
    carbRatio: summary.netCarbsG / targets.netCarbsG,
    sodiumRatio: summary.sodiumMg / targets.sodiumMg,
    potassiumRatio: summary.potassiumMg / targets.potassiumMg,
    magnesiumRatio: summary.magnesiumMg / targets.magnesiumMg,
  };
}

export function buildRecommendations(
  summary: DailyNutritionSummary,
  targets: NutritionTargets,
): Recommendation[] {
  if (summary.entryCount === 0) return [];

  const recs: Recommendation[] = [];
  const c = ctx(summary, targets);

  // Calories
  if (summary.calories > targets.calories) {
    recs.push({ id: 'calories-exceeded', priority: 'warning',
      message: 'Return to target tomorrow and check your logging accuracy.' });
  } else if (c.remainingCal > 200 && c.proteinGap / targets.proteinG > 0.3) {
    recs.push({ id: 'protein-low', priority: 'info',
      message: 'Prioritise lean protein in your next meal.' });
  }

  // Carbs
  if (c.carbRatio >= 1) {
    recs.push({ id: 'carbs-exceeded', priority: 'warning',
      message: 'Carb limit exceeded — focus on protein and very low-carb foods for the rest of the day.' });
  } else if (c.carbRatio >= 0.8) {
    recs.push({ id: 'carbs-approaching', priority: 'warning',
      message: 'Choose very low-carb foods for the rest of the day to stay within your limit.' });
  }

  // Electrolytes
  if (c.sodiumRatio < 0.5) {
    recs.push({ id: 'sodium-low', priority: 'info',
      message: 'Consider sodium-rich keto-friendly foods or electrolyte supplementation.' });
  }
  if (c.potassiumRatio < 0.5) {
    recs.push({ id: 'potassium-low', priority: 'info',
      message: 'Consider potassium-rich keto-friendly foods such as avocado, spinach, or salmon.' });
  }
  if (c.magnesiumRatio < 0.5) {
    recs.push({ id: 'magnesium-low', priority: 'info',
      message: 'Consider magnesium-rich keto-friendly foods such as spinach, avocado, or pumpkin seeds.' });
  }

  if (recs.length === 0) {
    recs.push({ id: 'on-track', priority: 'success',
      message: 'Great progress — you are on track with your targets today.' });
  }

  return recs;
}

export function buildSmartSuggestions(
  summary: DailyNutritionSummary,
  targets: NutritionTargets,
): Recommendation[] {
  if (summary.entryCount === 0) return [];

  const suggs: Recommendation[] = [];
  const c = ctx(summary, targets);

  if (c.carbRatio >= 1) {
    suggs.push({ id: 'sugg-zero-carb', priority: 'warning',
      message: 'Near or over carb limit: choose zero-carb foods such as eggs, meat, fish, or cheese.' });
  } else if (c.proteinGap > 20 && c.remainingCal > 100) {
    suggs.push({ id: 'sugg-protein', priority: 'info',
      message: `Low protein remaining (${Math.round(c.proteinGap)}g gap): consider chicken breast, eggs, tuna, lean beef, or Greek yoghurt.` });
  } else if (c.remainingCal > 300 && c.carbRatio < 0.6) {
    suggs.push({ id: 'sugg-balanced', priority: 'info',
      message: `${Math.round(c.remainingCal)} kcal remaining — a meal with protein and healthy fats would keep you on target.` });
  }

  if (c.sodiumRatio < 0.4) {
    suggs.push({ id: 'sugg-sodium', priority: 'info',
      message: 'Low sodium: consider bone broth, salted meats, or an electrolyte supplement.' });
  }
  if (c.potassiumRatio < 0.4) {
    suggs.push({ id: 'sugg-potassium', priority: 'info',
      message: 'Low potassium: consider avocado, salmon, spinach, or a potassium supplement.' });
  }
  if (c.magnesiumRatio < 0.4) {
    suggs.push({ id: 'sugg-magnesium', priority: 'info',
      message: 'Low magnesium: consider spinach, avocado, pumpkin seeds, or almonds.' });
  }

  return suggs;
}
