import type {
  FoodLogEntry,
  DailyNutritionSummary,
  NutritionTargets,
  CarbStatus,
  FoodItem,
  MealSlot,
} from '../types';
import { localDateString } from './date';
import { nanoid } from './nanoid';
import { MICRONUTRIENT_KEYS, scaleMicronutrients, zeroMicronutrients } from './micronutrients';

export function safeNonNegative(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function safePositive(value: unknown, fallback = 1): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function calcNetCarbs(
  totalCarbsG: number,
  fibreG: number,
  sugarAlcoholsG: number,
): number {
  const net = safeNonNegative(totalCarbsG) - safeNonNegative(fibreG) - safeNonNegative(sugarAlcoholsG);
  return Math.max(0, net);
}

export function summariseDay(date: string, entries: FoodLogEntry[]): DailyNutritionSummary {
  const dayEntries = entries.filter((e) => e.date === date);

  const sum = dayEntries.reduce((acc, e) => {
    acc.calories += safeNonNegative(e.calories);
    acc.proteinG += safeNonNegative(e.proteinG);
    acc.fatG += safeNonNegative(e.fatG);
    acc.totalCarbsG += safeNonNegative(e.totalCarbsG);
    acc.fibreG += safeNonNegative(e.fibreG);
    acc.sugarAlcoholsG += safeNonNegative(e.sugarAlcoholsG);
    acc.sodiumMg += safeNonNegative(e.sodiumMg);
    acc.potassiumMg += safeNonNegative(e.potassiumMg);
    acc.magnesiumMg += safeNonNegative(e.magnesiumMg);
    for (const key of MICRONUTRIENT_KEYS) {
      acc[key] = (acc[key] ?? 0) + safeNonNegative(e[key]);
    }
    return acc;
  }, {
    calories: 0,
    proteinG: 0,
    fatG: 0,
    totalCarbsG: 0,
    fibreG: 0,
    sugarAlcoholsG: 0,
    sodiumMg: 0,
    potassiumMg: 0,
    magnesiumMg: 0,
    ...zeroMicronutrients(),
  });

  return {
    date,
    ...sum,
    netCarbsG: calcNetCarbs(sum.totalCarbsG, sum.fibreG, sum.sugarAlcoholsG),
    entryCount: dayEntries.length,
  };
}

export function remainingCalories(summary: DailyNutritionSummary, targets: NutritionTargets): number {
  return targets.calories - summary.calories;
}

export function proteinProgress(summary: DailyNutritionSummary, targets: NutritionTargets): number {
  if (targets.proteinG <= 0) return 100;
  return Math.min(100, (summary.proteinG / targets.proteinG) * 100);
}

export function carbStatus(summary: DailyNutritionSummary, targets: NutritionTargets): CarbStatus {
  if (!Number.isFinite(targets.netCarbsG) || targets.netCarbsG <= 0) return 'aligned';
  const ratio = summary.netCarbsG / targets.netCarbsG;
  if (ratio >= 1) return 'exceeded';
  if (ratio >= 0.8) return 'approaching';
  return 'aligned';
}

// "Within carb budget", not "keto-aligned": the app only knows logged carbs,
// not ketosis, and an under-logged day shouldn't read as a keto success.
export function carbStatusLabel(status: CarbStatus): string {
  switch (status) {
    case 'aligned': return 'Within carb budget today';
    case 'approaching': return 'Approaching carb limit';
    case 'exceeded': return 'Carb limit exceeded';
  }
}

export function netCarbsForEntry(entry: Pick<FoodLogEntry, 'totalCarbsG' | 'fibreG' | 'sugarAlcoholsG'>): number {
  return calcNetCarbs(entry.totalCarbsG, entry.fibreG, entry.sugarAlcoholsG);
}

export function todayDateString(): string {
  return localDateString();
}

export function savedFoodToLogEntry(food: FoodItem, date: string, multiplier = 1, meal?: MealSlot): FoodLogEntry {
  const amount = safePositive(multiplier);
  return {
    id: nanoid(), date, foodItemId: food.id, source: 'saved-food', meal, name: food.name,
    servingSize: food.servingSize, servingMultiplier: amount, calories: food.calories * amount,
    proteinG: food.proteinG * amount, fatG: food.fatG * amount, totalCarbsG: food.totalCarbsG * amount,
    fibreG: food.fibreG * amount, sugarAlcoholsG: food.sugarAlcoholsG * amount, sodiumMg: food.sodiumMg * amount,
    potassiumMg: food.potassiumMg * amount, magnesiumMg: food.magnesiumMg * amount,
    ...scaleMicronutrients(food, amount),
    loggedAt: new Date().toISOString(),
  };
}

export function dietModeDefaultNetCarbs(mode: NutritionTargets['dietMode']): number {
  switch (mode) {
    case 'strict-keto': return 20;
    case 'lazy-keto': return 50;
    case 'high-protein-keto': return 30;
  }
}
