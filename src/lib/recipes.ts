import type { Recipe, RecipeIngredient, FoodLogEntry, NutritionTotals } from '../types';
import { calcNetCarbs } from './nutrition';
import { nanoid } from './nanoid';

export function calcRecipeTotals(recipe: Recipe): NutritionTotals {
  const sum = recipe.ingredients.reduce(
    (acc, ing) => {
      const q = ing.quantity;
      return {
        calories: acc.calories + ing.calories * q,
        proteinG: acc.proteinG + ing.proteinG * q,
        fatG: acc.fatG + ing.fatG * q,
        totalCarbsG: acc.totalCarbsG + ing.totalCarbsG * q,
        fibreG: acc.fibreG + ing.fibreG * q,
        sugarAlcoholsG: acc.sugarAlcoholsG + ing.sugarAlcoholsG * q,
        sodiumMg: acc.sodiumMg + ing.sodiumMg * q,
        potassiumMg: acc.potassiumMg + ing.potassiumMg * q,
        magnesiumMg: acc.magnesiumMg + ing.magnesiumMg * q,
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

export function calcRecipePerServing(recipe: Recipe): NutritionTotals {
  const total = calcRecipeTotals(recipe);
  const s = Math.max(1, recipe.servings);
  return {
    calories: total.calories / s,
    proteinG: total.proteinG / s,
    fatG: total.fatG / s,
    totalCarbsG: total.totalCarbsG / s,
    fibreG: total.fibreG / s,
    sugarAlcoholsG: total.sugarAlcoholsG / s,
    netCarbsG: total.netCarbsG / s,
    sodiumMg: total.sodiumMg / s,
    potassiumMg: total.potassiumMg / s,
    magnesiumMg: total.magnesiumMg / s,
  };
}

export function recipeToLogEntry(
  recipe: Recipe,
  servings: number,
  date: string,
): FoodLogEntry {
  const perServing = calcRecipePerServing(recipe);
  const n = Math.max(0.1, servings);
  return {
    id: nanoid(),
    date,
    recipeId: recipe.id,
    source: 'recipe' as const,
    name: servings === 1 ? recipe.name : `${recipe.name} (${servings} servings)`,
    servingSize: `1 of ${recipe.servings} servings`,
    servingMultiplier: n,
    calories: perServing.calories * n,
    proteinG: perServing.proteinG * n,
    fatG: perServing.fatG * n,
    totalCarbsG: perServing.totalCarbsG * n,
    fibreG: perServing.fibreG * n,
    sugarAlcoholsG: perServing.sugarAlcoholsG * n,
    sodiumMg: perServing.sodiumMg * n,
    potassiumMg: perServing.potassiumMg * n,
    magnesiumMg: perServing.magnesiumMg * n,
    loggedAt: new Date().toISOString(),
  };
}

export function emptyIngredient(): RecipeIngredient {
  return {
    id: nanoid(),
    name: '',
    servingSize: '100g',
    quantity: 1,
    calories: 0, proteinG: 0, fatG: 0, totalCarbsG: 0,
    fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0,
  };
}
