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
      };
    },
    {
      calories: 0, proteinG: 0, fatG: 0, totalCarbsG: 0,
      fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0,
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
): FoodLogEntry[] {
  return template.items.map((item) => ({
    id: nanoid(),
    date,
    templateId: template.id,
    source: 'template' as const,
    name: `${template.name} — ${item.name}`,
    servingSize: item.servingSize,
    servingMultiplier: item.quantity,
    calories: item.calories * item.quantity,
    proteinG: item.proteinG * item.quantity,
    fatG: item.fatG * item.quantity,
    totalCarbsG: item.totalCarbsG * item.quantity,
    fibreG: item.fibreG * item.quantity,
    sugarAlcoholsG: item.sugarAlcoholsG * item.quantity,
    sodiumMg: item.sodiumMg * item.quantity,
    potassiumMg: item.potassiumMg * item.quantity,
    magnesiumMg: item.magnesiumMg * item.quantity,
    loggedAt: new Date().toISOString(),
  }));
}

export function foodItemToTemplateItem(
  food: { id?: string; name: string; servingSize: string; calories: number; proteinG: number; fatG: number; totalCarbsG: number; fibreG: number; sugarAlcoholsG: number; sodiumMg: number; potassiumMg: number; magnesiumMg: number },
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
  };
}
