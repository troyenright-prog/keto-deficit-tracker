import type { FoodItem, MealPlanEntry, MealTemplate, Recipe } from '../types';
import { nanoid } from './nanoid';
import { calcNetCarbs, safePositive } from './nutrition';
import { calcTemplateTotals } from './meal-templates';
import { calcRecipePerServing } from './recipes';

const now = () => new Date().toISOString();

export function foodToPlanEntry(food: FoodItem, date: string): MealPlanEntry {
  return {
    id: nanoid(), date, name: food.name, type: 'saved-food', sourceId: food.id, servings: 1,
    calories: food.calories, proteinG: food.proteinG, fatG: food.fatG, totalCarbsG: food.totalCarbsG,
    fibreG: food.fibreG, sugarAlcoholsG: food.sugarAlcoholsG,
    netCarbsG: calcNetCarbs(food.totalCarbsG, food.fibreG, food.sugarAlcoholsG),
    sodiumMg: food.sodiumMg, potassiumMg: food.potassiumMg, magnesiumMg: food.magnesiumMg,
    calciumMg: food.calciumMg, ironMg: food.ironMg, zincMg: food.zincMg,
    vitaminDMcg: food.vitaminDMcg, vitaminB12Mcg: food.vitaminB12Mcg,
    omega3G: food.omega3G, omega6G: food.omega6G, converted: false, createdAt: now(),
  };
}

export function templateToPlanEntry(template: MealTemplate, date: string): MealPlanEntry {
  return {
    id: nanoid(), date, name: template.name, type: 'template', sourceId: template.id,
    servings: 1, ...calcTemplateTotals(template), converted: false, createdAt: now(),
  };
}

export function recipeToPlanEntry(recipe: Recipe, servings: number, date: string): MealPlanEntry {
  const perServing = calcRecipePerServing(recipe);
  const count = safePositive(servings);
  return {
    id: nanoid(), date, name: recipe.name, type: 'recipe', sourceId: recipe.id, servings: count,
    calories: perServing.calories * count, proteinG: perServing.proteinG * count,
    fatG: perServing.fatG * count, totalCarbsG: perServing.totalCarbsG * count,
    fibreG: perServing.fibreG * count, sugarAlcoholsG: perServing.sugarAlcoholsG * count,
    netCarbsG: perServing.netCarbsG * count, sodiumMg: perServing.sodiumMg * count,
    potassiumMg: perServing.potassiumMg * count, magnesiumMg: perServing.magnesiumMg * count,
    calciumMg: (perServing.calciumMg ?? 0) * count, ironMg: (perServing.ironMg ?? 0) * count,
    zincMg: (perServing.zincMg ?? 0) * count, vitaminDMcg: (perServing.vitaminDMcg ?? 0) * count,
    vitaminB12Mcg: (perServing.vitaminB12Mcg ?? 0) * count, omega3G: (perServing.omega3G ?? 0) * count,
    omega6G: (perServing.omega6G ?? 0) * count, converted: false, createdAt: now(),
  };
}
