import type {
  FoodLogEntry,
  DailyNutritionSummary,
  NutritionTargets,
  CarbStatus,
} from '../types';

export function calcNetCarbs(
  totalCarbsG: number,
  fibreG: number,
  sugarAlcoholsG: number,
): number {
  const net = totalCarbsG - fibreG - sugarAlcoholsG;
  return Math.max(0, net);
}

export function summariseDay(date: string, entries: FoodLogEntry[]): DailyNutritionSummary {
  const dayEntries = entries.filter((e) => e.date === date);

  const sum = dayEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      fatG: acc.fatG + e.fatG,
      totalCarbsG: acc.totalCarbsG + e.totalCarbsG,
      fibreG: acc.fibreG + e.fibreG,
      sugarAlcoholsG: acc.sugarAlcoholsG + e.sugarAlcoholsG,
      sodiumMg: acc.sodiumMg + e.sodiumMg,
      potassiumMg: acc.potassiumMg + e.potassiumMg,
      magnesiumMg: acc.magnesiumMg + e.magnesiumMg,
    }),
    {
      calories: 0,
      proteinG: 0,
      fatG: 0,
      totalCarbsG: 0,
      fibreG: 0,
      sugarAlcoholsG: 0,
      sodiumMg: 0,
      potassiumMg: 0,
      magnesiumMg: 0,
    },
  );

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
  const ratio = summary.netCarbsG / targets.netCarbsG;
  if (ratio >= 1) return 'exceeded';
  if (ratio >= 0.8) return 'approaching';
  return 'aligned';
}

export function carbStatusLabel(status: CarbStatus): string {
  switch (status) {
    case 'aligned': return 'Keto-aligned today';
    case 'approaching': return 'Approaching carb limit';
    case 'exceeded': return 'Carb limit exceeded';
  }
}

export function netCarbsForEntry(entry: Pick<FoodLogEntry, 'totalCarbsG' | 'fibreG' | 'sugarAlcoholsG'>): number {
  return calcNetCarbs(entry.totalCarbsG, entry.fibreG, entry.sugarAlcoholsG);
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dietModeDefaultNetCarbs(mode: NutritionTargets['dietMode']): number {
  switch (mode) {
    case 'strict-keto': return 20;
    case 'lazy-keto': return 50;
    case 'high-protein-keto': return 30;
  }
}
