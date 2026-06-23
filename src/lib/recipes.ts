import type { MealSlot, Recipe, RecipeIngredient, FoodLogEntry, NutritionTotals } from '../types';
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
        calciumMg: acc.calciumMg + (ing.calciumMg ?? 0) * q,
        ironMg: acc.ironMg + (ing.ironMg ?? 0) * q,
        zincMg: acc.zincMg + (ing.zincMg ?? 0) * q,
        vitaminDMcg: acc.vitaminDMcg + (ing.vitaminDMcg ?? 0) * q,
        vitaminB12Mcg: acc.vitaminB12Mcg + (ing.vitaminB12Mcg ?? 0) * q,
        omega3G: acc.omega3G + (ing.omega3G ?? 0) * q,
        omega6G: acc.omega6G + (ing.omega6G ?? 0) * q,
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
    calciumMg: (total.calciumMg ?? 0) / s,
    ironMg: (total.ironMg ?? 0) / s,
    zincMg: (total.zincMg ?? 0) / s,
    vitaminDMcg: (total.vitaminDMcg ?? 0) / s,
    vitaminB12Mcg: (total.vitaminB12Mcg ?? 0) / s,
    omega3G: (total.omega3G ?? 0) / s,
    omega6G: (total.omega6G ?? 0) / s,
  };
}

export function recipeToLogEntry(
  recipe: Recipe,
  servings: number,
  date: string,
  meal?: MealSlot,
): FoodLogEntry {
  const perServing = calcRecipePerServing(recipe);
  const n = Math.max(0.1, servings);
  return {
    id: nanoid(),
    date,
    recipeId: recipe.id,
    source: 'recipe' as const,
    meal,
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
    calciumMg: (perServing.calciumMg ?? 0) * n,
    ironMg: (perServing.ironMg ?? 0) * n,
    zincMg: (perServing.zincMg ?? 0) * n,
    vitaminDMcg: (perServing.vitaminDMcg ?? 0) * n,
    vitaminB12Mcg: (perServing.vitaminB12Mcg ?? 0) * n,
    omega3G: (perServing.omega3G ?? 0) * n,
    omega6G: (perServing.omega6G ?? 0) * n,
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
