import type { FoodDatabaseItem, FoodItem, FoodLogEntry, MealTemplate, Recipe } from '../types';
import { foodDatabaseItemToSavedFood, foodDatabaseSignature } from './food-database';
import { nanoid } from './nanoid';
import { safePositive } from './nutrition';

const MICRO_KEYS = ['calciumMg', 'ironMg', 'zincMg', 'vitaminDMcg', 'vitaminB12Mcg', 'omega3G', 'omega6G'] as const;

export function foodSignature(item: Pick<FoodItem, 'name' | 'servingSize'>): string {
  return `${item.name.trim().toLowerCase()}|${item.servingSize.trim().toLowerCase()}`;
}

export function recentFoodsFromLog(log: FoodLogEntry[], limit = 8): FoodItem[] {
  const seen = new Set<string>();
  const result: FoodItem[] = [];
  const sorted = [...log].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  for (const entry of sorted) {
    const key = foodSignature(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    const multiplier = safePositive(entry.servingMultiplier);
    const food: FoodItem = {
      id: `recent-${entry.id}`, name: entry.name, servingSize: entry.servingSize,
      calories: entry.calories / multiplier, proteinG: entry.proteinG / multiplier,
      fatG: entry.fatG / multiplier, totalCarbsG: entry.totalCarbsG / multiplier,
      fibreG: entry.fibreG / multiplier, sugarAlcoholsG: entry.sugarAlcoholsG / multiplier,
      sodiumMg: entry.sodiumMg / multiplier, potassiumMg: entry.potassiumMg / multiplier,
      magnesiumMg: entry.magnesiumMg / multiplier, createdAt: entry.loggedAt,
    };
    for (const micro of MICRO_KEYS) {
      if (entry[micro] !== undefined) food[micro] = entry[micro]! / multiplier;
    }
    result.push(food);
    if (result.length >= limit) break;
  }
  return result;
}

export function duplicateLogEntry(entry: FoodLogEntry, targetDate = entry.date): FoodLogEntry {
  return { ...entry, id: nanoid(), date: targetDate, loggedAt: new Date().toISOString() };
}

export function copyLogEntries(entries: FoodLogEntry[], targetDate: string): FoodLogEntry[] {
  return entries.map((entry) => duplicateLogEntry(entry, targetDate));
}

export type QuickAddItem =
  | { kind: 'favourite' | 'saved' | 'database' | 'recent' | 'starter'; id: string; name: string; food: FoodItem }
  | { kind: 'recipe'; id: string; name: string; recipe: Recipe }
  | { kind: 'template'; id: string; name: string; template: MealTemplate };

export interface QuickAddGroup {
  key: string;
  label: string;
  items: QuickAddItem[];
}

export function buildQuickAddGroups(options: {
  query: string;
  savedFoods: FoodItem[];
  foodDatabase?: FoodDatabaseItem[];
  recentFoods: FoodItem[];
  recipes: Recipe[];
  templates: MealTemplate[];
  starterFoods: FoodItem[];
}): QuickAddGroup[] {
  const query = options.query.trim().toLowerCase();
  const matches = (name: string) => !query || name.toLowerCase().includes(query);
  const favourites = options.savedFoods.filter((food) => food.isFavourite && matches(food.name));
  const saved = options.savedFoods.filter((food) => !food.isFavourite && matches(food.name));
  const existingFoods = new Set(options.savedFoods.map((food) => food.barcode ? `barcode:${food.barcode}` : `sig:${foodSignature(food)}`));
  const databaseFoods = (options.foodDatabase ?? [])
    .filter((item) => {
      const key = item.barcode ? `barcode:${item.barcode}` : `sig:${foodDatabaseSignature(item)}`;
      return !existingFoods.has(key) && matches(`${item.name} ${item.brand ?? ''} ${item.barcode ?? ''}`);
    })
    .map(foodDatabaseItemToSavedFood);
  const recent = options.recentFoods.filter((food) => matches(food.name));
  const recipes = options.recipes.filter((recipe) => matches(recipe.name));
  const shortcuts = options.templates.filter((template) => template.mealType && matches(template.name));
  const templates = options.templates.filter((template) => !template.mealType && matches(template.name));
  const existing = new Set(options.savedFoods.map(foodSignature));
  const starters = options.starterFoods.filter((food) => !existing.has(foodSignature(food)) && matches(food.name));

  const groups: QuickAddGroup[] = [
    { key: 'favourites', label: 'Favourites', items: favourites.map((food) => ({ kind: 'favourite', id: food.id, name: food.name, food })) },
    { key: 'recent', label: 'Recent foods', items: recent.map((food) => ({ kind: 'recent', id: food.id, name: food.name, food })) },
    { key: 'shortcuts', label: 'Meal shortcuts', items: shortcuts.map((template) => ({ kind: 'template', id: template.id, name: template.name, template })) },
  ];
  if (query) groups.push(
    { key: 'saved', label: 'Saved foods', items: saved.map((food) => ({ kind: 'saved', id: food.id, name: food.name, food })) },
    { key: 'database', label: 'Food database', items: databaseFoods.map((food) => ({ kind: 'database', id: food.id, name: food.name, food })) },
    { key: 'recipes', label: 'Recipes', items: recipes.map((recipe) => ({ kind: 'recipe', id: recipe.id, name: recipe.name, recipe })) },
    { key: 'templates', label: 'Meal templates', items: templates.map((template) => ({ kind: 'template', id: template.id, name: template.name, template })) },
    { key: 'starters', label: 'Starter foods', items: starters.map((food) => ({ kind: 'starter', id: food.id, name: food.name, food })) },
  );
  return groups.filter((group) => group.items.length > 0);
}
