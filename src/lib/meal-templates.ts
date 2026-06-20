import type { MealTemplate, MealTemplateItem, FoodLogEntry, NutritionTotals } from '../types';
import { calcNetCarbs } from './nutrition';
import { nanoid } from './nanoid';

export function calcTemplateTotals(template: MealTemplate): NutritionTotals {
  return calcItemsTotals(template.items);
}

export function calcItemsTotals(items: MealTemplateItem[]): NutritionTotals {
  const sum = items.reduce(
    (acc, item) => {
      const q = item.quantity;
      return {
        calories: acc.calories + item.calories * q,
        proteinG: acc.proteinG + item.proteinG * q,
        fatG: acc.fatG + item.fatG * q,
        totalCarbsG: acc.totalCarbsG + item.totalCarbsG * q,
        fibreG: acc.fibreG + item.fibreG * q,
        sugarAlcoholsG: acc.sugarAlcoholsG + item.sugarAlcoholsG * q,
        sodiumMg: acc.sodiumMg + item.sodiumMg * q,
        potassiumMg: acc.potassiumMg + item.potassiumMg * q,
        magnesiumMg: acc.magnesiumMg + item.magnesiumMg * q,
        calciumMg: acc.calciumMg + (item.calciumMg ?? 0) * q,
        ironMg: acc.ironMg + (item.ironMg ?? 0) * q,
        zincMg: acc.zincMg + (item.zincMg ?? 0) * q,
        vitaminDMcg: acc.vitaminDMcg + (item.vitaminDMcg ?? 0) * q,
        vitaminB12Mcg: acc.vitaminB12Mcg + (item.vitaminB12Mcg ?? 0) * q,
        omega3G: acc.omega3G + (item.omega3G ?? 0) * q,
        omega6G: acc.omega6G + (item.omega6G ?? 0) * q,
      };
    },
    {
      calories: 0, proteinG: 0, fatG: 0, totalCarbsG: 0,
      fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0,
      calciumMg: 0, ironMg: 0, zincMg: 0, vitaminDMcg: 0, vitaminB12Mcg: 0, omega3G: 0, omega6G: 0,
    },
  );

  return {
    ...sum,
    netCarbsG: calcNetCarbs(sum.totalCarbsG, sum.fibreG, sum.sugarAlcoholsG),
  };
}

export function templateToLogEntries(
  template: MealTemplate,
  date: string,
  multiplier = 1,
): FoodLogEntry[] {
  const amount = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return template.items.map((item) => ({
    id: nanoid(),
    date,
    templateId: template.id,
    source: 'template' as const,
    name: `${template.name} — ${item.name}`,
    servingSize: item.servingSize,
    servingMultiplier: item.quantity * amount,
    calories: item.calories * item.quantity * amount,
    proteinG: item.proteinG * item.quantity * amount,
    fatG: item.fatG * item.quantity * amount,
    totalCarbsG: item.totalCarbsG * item.quantity * amount,
    fibreG: item.fibreG * item.quantity * amount,
    sugarAlcoholsG: item.sugarAlcoholsG * item.quantity * amount,
    sodiumMg: item.sodiumMg * item.quantity * amount,
    potassiumMg: item.potassiumMg * item.quantity * amount,
    magnesiumMg: item.magnesiumMg * item.quantity * amount,
    calciumMg: (item.calciumMg ?? 0) * item.quantity * amount,
    ironMg: (item.ironMg ?? 0) * item.quantity * amount,
    zincMg: (item.zincMg ?? 0) * item.quantity * amount,
    vitaminDMcg: (item.vitaminDMcg ?? 0) * item.quantity * amount,
    vitaminB12Mcg: (item.vitaminB12Mcg ?? 0) * item.quantity * amount,
    omega3G: (item.omega3G ?? 0) * item.quantity * amount,
    omega6G: (item.omega6G ?? 0) * item.quantity * amount,
    loggedAt: new Date().toISOString(),
  }));
}

export function foodItemToTemplateItem(
  food: { id?: string; name: string; servingSize: string; calories: number; proteinG: number; fatG: number; totalCarbsG: number; fibreG: number; sugarAlcoholsG: number; sodiumMg: number; potassiumMg: number; magnesiumMg: number; calciumMg?: number; ironMg?: number; zincMg?: number; vitaminDMcg?: number; vitaminB12Mcg?: number; omega3G?: number; omega6G?: number },
  quantity = 1,
): MealTemplateItem {
  return {
    id: nanoid(),
    savedFoodId: food.id,
    name: food.name,
    servingSize: food.servingSize,
    quantity,
    calories: food.calories,
    proteinG: food.proteinG,
    fatG: food.fatG,
    totalCarbsG: food.totalCarbsG,
    fibreG: food.fibreG,
    sugarAlcoholsG: food.sugarAlcoholsG,
    sodiumMg: food.sodiumMg,
    potassiumMg: food.potassiumMg,
    magnesiumMg: food.magnesiumMg,
    ...('calciumMg' in food ? {
      calciumMg: food.calciumMg, ironMg: food.ironMg, zincMg: food.zincMg,
      vitaminDMcg: food.vitaminDMcg, vitaminB12Mcg: food.vitaminB12Mcg,
      omega3G: food.omega3G, omega6G: food.omega6G,
    } : {}),
  };
}
