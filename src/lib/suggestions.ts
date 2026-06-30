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
  const ratio = (value: number, target: number) => Number.isFinite(target) && target > 0 ? value / target : 0;
  return {
    remainingCal: targets.calories - summary.calories,
    proteinGap: targets.proteinG - summary.proteinG,
    netCarbsLeft: targets.netCarbsG - summary.netCarbsG,
    carbRatio: ratio(summary.netCarbsG, targets.netCarbsG),
    sodiumRatio: ratio(summary.sodiumMg, targets.sodiumMg),
    potassiumRatio: ratio(summary.potassiumMg, targets.potassiumMg),
    magnesiumRatio: ratio(summary.magnesiumMg, targets.magnesiumMg),
  };
}

export function buildRecommendations(
  summary: DailyNutritionSummary,
  targets: NutritionTargets,
  now = new Date(),
): Recommendation[] {
  if (summary.entryCount === 0) return [];

  const recs: Recommendation[] = [];
  const c = ctx(summary, targets);
  const hour = now.getHours();

  if (summary.calories > targets.calories) {
    recs.push({
      id: 'calories-exceeded',
      priority: 'warning',
      message: 'Return to target tomorrow and check your logging accuracy.',
    });
  } else if (hour >= 18 && c.remainingCal > targets.calories * 0.35 && summary.calories < targets.calories * 0.65) {
    recs.push({
      id: 'calories-low-late',
      priority: 'warning',
      message: `${Math.round(c.remainingCal)} kcal remain late in the day. Add a simple protein-forward meal if this is not intentional.`,
    });
  } else if (c.remainingCal > 200 && targets.proteinG > 0 && c.proteinGap / targets.proteinG > 0.3) {
    recs.push({
      id: 'protein-low',
      priority: 'info',
      message: `${Math.round(c.proteinGap)}g protein to go. Prioritise eggs, chicken, tuna, salmon, lean beef, or Greek yoghurt next.`,
    });
  }

  if (c.carbRatio >= 1) {
    recs.push({
      id: 'carbs-exceeded',
      priority: 'warning',
      message: 'Carb limit exceeded - keep the rest of the day to protein, oils, eggs, fish, meat, or cheese.',
    });
  } else if (c.carbRatio >= 0.8) {
    recs.push({
      id: 'carbs-approaching',
      priority: 'warning',
      message: `${Math.max(0, Math.round(c.netCarbsLeft))}g net carbs left. Choose very low-carb foods for the rest of the day.`,
    });
  }

  if (c.sodiumRatio < 0.5) {
    recs.push({
      id: 'sodium-low',
      priority: 'info',
      message: 'Sodium is low. Consider broth, salted meat, pickles, or an electrolyte drink.',
    });
  }
  if (c.potassiumRatio < 0.5) {
    recs.push({
      id: 'potassium-low',
      priority: 'info',
      message: 'Potassium is low. Avocado, spinach, salmon, or mushrooms can help.',
    });
  }
  if (c.magnesiumRatio < 0.5) {
    recs.push({
      id: 'magnesium-low',
      priority: 'info',
      message: 'Magnesium is low. Spinach, pumpkin seeds, almonds, or avocado are useful options.',
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: 'on-track',
      priority: 'success',
      message: 'You are on track today. Keep the next meal similar: protein first, carbs deliberate.',
    });
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
    suggs.push({
      id: 'sugg-zero-carb',
      priority: 'warning',
      message: 'Near or over carb limit: choose zero-carb foods such as eggs, meat, fish, or cheese.',
    });
  } else if (c.proteinGap > 20 && c.remainingCal > 100) {
    suggs.push({
      id: 'sugg-protein',
      priority: 'info',
      message: `Low protein remaining (${Math.round(c.proteinGap)}g gap): consider chicken breast, eggs, tuna, lean beef, or Greek yoghurt.`,
    });
  } else if (c.remainingCal > 300 && c.carbRatio < 0.6) {
    suggs.push({
      id: 'sugg-balanced',
      priority: 'info',
      message: `${Math.round(c.remainingCal)} kcal remaining - a meal with protein and healthy fats would keep you on target.`,
    });
  } else if (c.remainingCal > 100 && c.netCarbsLeft > 0) {
    suggs.push({
      id: 'sugg-small-meal',
      priority: 'info',
      message: `${Math.round(c.remainingCal)} kcal and ${Math.round(c.netCarbsLeft)}g net carbs remain. A small protein snack should fit well.`,
    });
  }

  if (c.sodiumRatio < 0.4) {
    suggs.push({
      id: 'sugg-sodium',
      priority: 'info',
      message: 'Low sodium: consider bone broth, salted meats, or an electrolyte supplement.',
    });
  }
  if (c.potassiumRatio < 0.4) {
    suggs.push({
      id: 'sugg-potassium',
      priority: 'info',
      message: 'Low potassium: consider avocado, salmon, spinach, or a potassium supplement.',
    });
  }
  if (c.magnesiumRatio < 0.4) {
    suggs.push({
      id: 'sugg-magnesium',
      priority: 'info',
      message: 'Low magnesium: consider spinach, avocado, pumpkin seeds, or almonds.',
    });
  }

  return suggs;
}
