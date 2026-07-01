import type { FoodItem, MealPlanEntry, MealTemplate, Recipe } from '../types';
import { nanoid } from './nanoid';
import { calcNetCarbs, safePositive } from './nutrition';
import { calcTemplateTotals } from './meal-templates';
import { calcRecipePerServing } from './recipes';
import { pickMicronutrients, scaleMicronutrients } from './micronutrients';

const now = () => new Date().toISOString();

export function foodToPlanEntry(food: FoodItem, date: string): MealPlanEntry {
  return {
    id: nanoid(), date, name: food.name, type: 'saved-food', sourceId: food.id, servings: 1,
    calories: food.calories, proteinG: food.proteinG, fatG: food.fatG, totalCarbsG: food.totalCarbsG,
    fibreG: food.fibreG, sugarAlcoholsG: food.sugarAlcoholsG,
    netCarbsG: calcNetCarbs(food.totalCarbsG, food.fibreG, food.sugarAlcoholsG),
    sodiumMg: food.sodiumMg, potassiumMg: food.potassiumMg, magnesiumMg: food.magnesiumMg,
    ...pickMicronutrients(food), converted: false, createdAt: now(),
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
    ...scaleMicronutrients(perServing, count), converted: false, createdAt: now(),
  };
}
