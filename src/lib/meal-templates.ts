import type { MealSlot, MealTemplate, MealTemplateItem, FoodLogEntry, NutritionTotals, Micronutrients } from '../types';
import { calcNetCarbs } from './nutrition';
import { nanoid } from './nanoid';
import { MICRONUTRIENT_KEYS, pickMicronutrients, scaleMicronutrients, zeroMicronutrients } from './micronutrients';

export function calcTemplateTotals(template: MealTemplate): NutritionTotals {
  return calcItemsTotals(template.items);
}

export function calcItemsTotals(items: MealTemplateItem[]): NutritionTotals {
  const sum = items.reduce((acc, item) => {
    const q = item.quantity;
    acc.calories += item.calories * q;
    acc.proteinG += item.proteinG * q;
    acc.fatG += item.fatG * q;
    acc.totalCarbsG += item.totalCarbsG * q;
    acc.fibreG += item.fibreG * q;
    acc.sugarAlcoholsG += item.sugarAlcoholsG * q;
    acc.sodiumMg += item.sodiumMg * q;
    acc.potassiumMg += item.potassiumMg * q;
    acc.magnesiumMg += item.magnesiumMg * q;
    for (const key of MICRONUTRIENT_KEYS) {
      acc[key] = (acc[key] ?? 0) + (item[key] ?? 0) * q;
    }
    return acc;
  }, {
    calories: 0, proteinG: 0, fatG: 0, totalCarbsG: 0,
    fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0,
    ...zeroMicronutrients(),
  });

  return {
    ...sum,
    netCarbsG: calcNetCarbs(sum.totalCarbsG, sum.fibreG, sum.sugarAlcoholsG),
  };
}

export function templateToLogEntries(
  template: MealTemplate,
  date: string,
  multiplier = 1,
  meal?: MealSlot,
): FoodLogEntry[] {
  const amount = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return template.items.map((item) => ({
    id: nanoid(),
    date,
    templateId: template.id,
    source: 'template' as const,
    meal,
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
    ...scaleMicronutrients(item, item.quantity * amount),
    loggedAt: new Date().toISOString(),
  }));
}

export function foodItemToTemplateItem(
  food: { id?: string; name: string; servingSize: string; calories: number; proteinG: number; fatG: number; totalCarbsG: number; fibreG: number; sugarAlcoholsG: number; sodiumMg: number; potassiumMg: number; magnesiumMg: number } & Micronutrients,
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
    ...pickMicronutrients(food),
  };
}
