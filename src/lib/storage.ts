import type {
  UserProfile, NutritionTargets, FoodLogEntry, FoodItem, WeightEntry,
  MealTemplate, MealTemplateItem, Recipe, RecipeIngredient, ShoppingItem,
  MealPlanEntry, AppStateBundle, Micronutrients, FoodDatabaseItem, FoodDatabaseSource,
} from '../types';
import { isDateString, localDateString } from './date';
import { dedupeFoodDatabase } from './food-database';
import { isMealSlot } from './meals';
import { calcNetCarbs, safeNonNegative, safePositive } from './nutrition';

export const CURRENT_VERSION = 4;

const KEYS = {
  version: 'keto_version', profile: 'keto_profile', targets: 'keto_targets',
  foodLog: 'keto_food_log', savedFoods: 'keto_saved_foods', weightEntries: 'keto_weight_entries',
  mealTemplates: 'keto_meal_templates', recipes: 'keto_recipes', shoppingList: 'keto_shopping_list',
  mealPlan: 'keto_meal_plan', foodDatabase: 'keto_food_database',
} as const;

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const optionalText = (value: unknown) => typeof value === 'string' ? value : undefined;
const date = (value: unknown) => isDateString(value) ? value : localDateString();
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : new Date().toISOString();

function safeRead(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function safeWrite(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_TARGETS: NutritionTargets = {
  calories: 1800, proteinG: 120, netCarbsG: 20, fatG: 140,
  sodiumMg: 2300, potassiumMg: 3500, magnesiumMg: 400,
  dietMode: 'strict-keto', manualNetCarbs: false,
};

export const DEFAULT_PROFILE: UserProfile = {
  name: '', weightUnit: 'kg', createdAt: new Date().toISOString(),
};

function micros(record: UnknownRecord): Micronutrients {
  const result: Micronutrients = {};
  for (const key of ['calciumMg', 'ironMg', 'zincMg', 'vitaminDMcg', 'vitaminB12Mcg', 'omega3G', 'omega6G'] as const) {
    if (typeof record[key] === 'number' && Number.isFinite(record[key]) && record[key] >= 0) result[key] = record[key];
  }
  return result;
}

function nutrition(record: UnknownRecord) {
  return {
    calories: safeNonNegative(record.calories), proteinG: safeNonNegative(record.proteinG),
    fatG: safeNonNegative(record.fatG), totalCarbsG: safeNonNegative(record.totalCarbsG),
    fibreG: safeNonNegative(record.fibreG), sugarAlcoholsG: safeNonNegative(record.sugarAlcoholsG),
    sodiumMg: safeNonNegative(record.sodiumMg), potassiumMg: safeNonNegative(record.potassiumMg),
    magnesiumMg: safeNonNegative(record.magnesiumMg), ...micros(record),
  };
}

function normalizeProfile(value: unknown): UserProfile {
  if (!isRecord(value)) return { ...DEFAULT_PROFILE };
  return {
    name: text(value.name), weightUnit: value.weightUnit === 'lbs' ? 'lbs' : 'kg',
    createdAt: timestamp(value.createdAt),
  };
}

function normalizeTargets(value: unknown): NutritionTargets {
  if (!isRecord(value)) return { ...DEFAULT_TARGETS };
  const mode = value.dietMode === 'lazy-keto' || value.dietMode === 'high-protein-keto' ? value.dietMode : 'strict-keto';
  return {
    calories: safePositive(value.calories, DEFAULT_TARGETS.calories),
    proteinG: safePositive(value.proteinG, DEFAULT_TARGETS.proteinG),
    netCarbsG: safePositive(value.netCarbsG, DEFAULT_TARGETS.netCarbsG),
    fatG: safePositive(value.fatG, DEFAULT_TARGETS.fatG),
    sodiumMg: safePositive(value.sodiumMg, DEFAULT_TARGETS.sodiumMg),
    potassiumMg: safePositive(value.potassiumMg, DEFAULT_TARGETS.potassiumMg),
    magnesiumMg: safePositive(value.magnesiumMg, DEFAULT_TARGETS.magnesiumMg),
    dietMode: mode, manualNetCarbs: value.manualNetCarbs === true,
  };
}

function normalizeFood(value: unknown): FoodItem | null {
  if (!isRecord(value)) return null;
  return {
    id: text(value.id, crypto.randomUUID()), name: text(value.name, 'Unnamed food'),
    barcode: optionalText(value.barcode), servingSize: text(value.servingSize, '1 serving'), ...nutrition(value),
    createdAt: timestamp(value.createdAt), updatedAt: optionalText(value.updatedAt),
    isFavourite: value.isFavourite === true, isStarter: value.isStarter === true,
  };
}

function normalizeFoodDatabaseItem(value: unknown): FoodDatabaseItem | null {
  if (!isRecord(value)) return null;
  const source: FoodDatabaseSource = value.source === 'openFoodFacts' || value.source === 'recipe' || value.source === 'template' || value.source === 'barcode'
    ? value.source : 'manual';
  const totalCarbsG = safeNonNegative(value.totalCarbsG);
  const fibreG = safeNonNegative(value.fibreG);
  const sugarAlcoholsG = safeNonNegative(value.sugarAlcoholsG);
  const createdAt = timestamp(value.createdAt);
  return {
    id: text(value.id, crypto.randomUUID()),
    barcode: optionalText(value.barcode),
    name: text(value.name, 'Unnamed food'),
    brand: optionalText(value.brand),
    source,
    servingSize: text(value.servingSize, '1 serving'),
    calories: safeNonNegative(value.calories),
    proteinG: safeNonNegative(value.proteinG),
    fatG: safeNonNegative(value.fatG),
    totalCarbsG,
    fibreG,
    sugarAlcoholsG,
    netCarbsG: safeNonNegative(value.netCarbsG) || calcNetCarbs(totalCarbsG, fibreG, sugarAlcoholsG),
    sodiumMg: safeNonNegative(value.sodiumMg),
    potassiumMg: safeNonNegative(value.potassiumMg),
    magnesiumMg: safeNonNegative(value.magnesiumMg),
    ...micros(value),
    verified: value.verified === true,
    userEdited: value.userEdited === true,
    createdAt,
    updatedAt: timestamp(value.updatedAt ?? createdAt),
  };
}

function normalizeLogEntry(value: unknown): FoodLogEntry | null {
  if (!isRecord(value)) return null;
  const sources = ['manual', 'saved-food', 'template', 'recipe', 'plan', 'barcode'];
  return {
    id: text(value.id, crypto.randomUUID()), date: date(value.date),
    barcode: optionalText(value.barcode),
    foodItemId: optionalText(value.foodItemId), templateId: optionalText(value.templateId), recipeId: optionalText(value.recipeId),
    source: typeof value.source === 'string' && sources.includes(value.source) ? value.source as FoodLogEntry['source'] : 'manual',
    meal: isMealSlot(value.meal) ? value.meal : undefined,
    name: text(value.name, 'Unnamed food'), servingSize: text(value.servingSize, '1 serving'),
    servingMultiplier: safePositive(value.servingMultiplier), ...nutrition(value), loggedAt: timestamp(value.loggedAt),
  };
}

function normalizeWeight(value: unknown): WeightEntry | null {
  if (!isRecord(value)) return null;
  const weight = safePositive(value.weight, 0);
  if (weight === 0) return null;
  return {
    id: text(value.id, crypto.randomUUID()), date: date(value.date), weight,
    unit: value.unit === 'lbs' ? 'lbs' : 'kg', loggedAt: timestamp(value.loggedAt),
  };
}

function normalizeTemplateItem(value: unknown): MealTemplateItem | null {
  if (!isRecord(value)) return null;
  return {
    id: text(value.id, crypto.randomUUID()), savedFoodId: optionalText(value.savedFoodId),
    name: text(value.name, 'Unnamed food'), servingSize: text(value.servingSize, '1 serving'),
    quantity: safePositive(value.quantity), ...nutrition(value),
  };
}

function normalizeTemplate(value: unknown): MealTemplate | null {
  if (!isRecord(value)) return null;
  return {
    id: text(value.id, crypto.randomUUID()), name: text(value.name, 'Unnamed meal'),
    items: Array.isArray(value.items) ? value.items.map(normalizeTemplateItem).filter((item): item is MealTemplateItem => item !== null) : [],
    createdAt: timestamp(value.createdAt), updatedAt: optionalText(value.updatedAt),
    mealType: value.mealType === 'breakfast' || value.mealType === 'lunch' || value.mealType === 'dinner' || value.mealType === 'snack'
      ? value.mealType : undefined,
  };
}

function normalizeIngredient(value: unknown): RecipeIngredient | null {
  if (!isRecord(value)) return null;
  return {
    id: text(value.id, crypto.randomUUID()), name: text(value.name, 'Unnamed ingredient'),
    servingSize: text(value.servingSize, '1 serving'), quantity: safePositive(value.quantity), ...nutrition(value),
  };
}

function normalizeRecipe(value: unknown): Recipe | null {
  if (!isRecord(value)) return null;
  return {
    id: text(value.id, crypto.randomUUID()), name: text(value.name, 'Unnamed recipe'), servings: safePositive(value.servings),
    ingredients: Array.isArray(value.ingredients) ? value.ingredients.map(normalizeIngredient).filter((item): item is RecipeIngredient => item !== null) : [],
    createdAt: timestamp(value.createdAt), updatedAt: optionalText(value.updatedAt),
  };
}

function normalizeShoppingItem(value: unknown): ShoppingItem | null {
  if (!isRecord(value)) return null;
  const source = value.source === 'template' || value.source === 'recipe' ? value.source : 'manual';
  return {
    id: text(value.id, crypto.randomUUID()), name: text(value.name, 'Unnamed item'), quantity: optionalText(value.quantity),
    completed: value.completed === true, source, sourceId: optionalText(value.sourceId), createdAt: timestamp(value.createdAt),
  };
}

function normalizePlanEntry(value: unknown): MealPlanEntry | null {
  if (!isRecord(value)) return null;
  const type = value.type === 'template' || value.type === 'recipe' ? value.type : 'saved-food';
  return {
    id: text(value.id, crypto.randomUUID()), date: date(value.date), name: text(value.name, 'Unnamed meal'),
    type, sourceId: text(value.sourceId), servings: safePositive(value.servings), ...nutrition(value),
    netCarbsG: safeNonNegative(value.netCarbsG), converted: value.converted === true, createdAt: timestamp(value.createdAt),
  };
}

function normalizeArray<T>(value: unknown, normalize: (item: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.map(normalize).filter((item): item is T => item !== null) : [];
}

export function migrateIfNeeded(): void {
  const version = safeNonNegative(safeRead(KEYS.version));
  if (version >= CURRENT_VERSION) return;
  try {
    for (const key of [KEYS.mealTemplates, KEYS.recipes, KEYS.shoppingList, KEYS.mealPlan, KEYS.foodDatabase]) {
      if (localStorage.getItem(key) === null && !safeWrite(key, [])) return;
    }
    safeWrite(KEYS.version, CURRENT_VERSION);
  } catch {
    // Loading still falls back to normalised defaults when storage is unavailable.
  }
}

export const loadProfile = () => normalizeProfile(safeRead(KEYS.profile));
export const saveProfile = (value: UserProfile) => safeWrite(KEYS.profile, value);
export const loadTargets = () => normalizeTargets(safeRead(KEYS.targets));
export const saveTargets = (value: NutritionTargets) => safeWrite(KEYS.targets, value);
export const loadFoodLog = () => normalizeArray(safeRead(KEYS.foodLog), normalizeLogEntry);
export const saveFoodLog = (value: FoodLogEntry[]) => safeWrite(KEYS.foodLog, value);
export const loadSavedFoods = () => normalizeArray(safeRead(KEYS.savedFoods), normalizeFood);
export const saveSavedFoods = (value: FoodItem[]) => safeWrite(KEYS.savedFoods, value);
export const loadFoodDatabase = () => dedupeFoodDatabase(normalizeArray(safeRead(KEYS.foodDatabase), normalizeFoodDatabaseItem));
export const saveFoodDatabase = (value: FoodDatabaseItem[]) => safeWrite(KEYS.foodDatabase, dedupeFoodDatabase(value));
export const loadWeightEntries = () => normalizeArray(safeRead(KEYS.weightEntries), normalizeWeight);
export const saveWeightEntries = (value: WeightEntry[]) => safeWrite(KEYS.weightEntries, value);
export const loadMealTemplates = () => normalizeArray(safeRead(KEYS.mealTemplates), normalizeTemplate);
export const saveMealTemplates = (value: MealTemplate[]) => safeWrite(KEYS.mealTemplates, value);
export const loadRecipes = () => normalizeArray(safeRead(KEYS.recipes), normalizeRecipe);
export const saveRecipes = (value: Recipe[]) => safeWrite(KEYS.recipes, value);
export const loadShoppingList = () => normalizeArray(safeRead(KEYS.shoppingList), normalizeShoppingItem);
export const saveShoppingList = (value: ShoppingItem[]) => safeWrite(KEYS.shoppingList, value);
export const loadMealPlan = () => normalizeArray(safeRead(KEYS.mealPlan), normalizePlanEntry);
export const saveMealPlan = (value: MealPlanEntry[]) => safeWrite(KEYS.mealPlan, value);

function writeAtomically(writes: [string, unknown][]): boolean {
  const previous = new Map<string, string | null>();
  try {
    for (const [key] of writes) previous.set(key, localStorage.getItem(key));
    for (const [key, item] of writes) localStorage.setItem(key, JSON.stringify(item));
    return true;
  } catch {
    try {
      for (const [key, oldValue] of previous) {
        if (oldValue === null) localStorage.removeItem(key);
        else localStorage.setItem(key, oldValue);
      }
    } catch {
      // Best-effort rollback; callers are still told the operation failed.
    }
    return false;
  }
}

export function saveFoodLogAndMealPlan(log: FoodLogEntry[], plan: MealPlanEntry[]): boolean {
  return writeAtomically([[KEYS.foodLog, log], [KEYS.mealPlan, plan]]);
}

export function exportAppData(): AppStateBundle {
  return {
    version: CURRENT_VERSION, exportedAt: new Date().toISOString(), profile: loadProfile(), targets: loadTargets(),
    foodLog: loadFoodLog(), savedFoods: loadSavedFoods(), weightEntries: loadWeightEntries(),
    foodDatabase: loadFoodDatabase(),
    mealTemplates: loadMealTemplates(), recipes: loadRecipes(), shoppingList: loadShoppingList(), mealPlan: loadMealPlan(),
  };
}

function hasInvalidNumber(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value) || value < 0;
  if (Array.isArray(value)) return value.some(hasInvalidNumber);
  if (isRecord(value)) return Object.values(value).some(hasInvalidNumber);
  return false;
}

export function normalizeAppBundle(value: unknown): AppStateBundle | null {
  if (!isRecord(value) || typeof value.version !== 'number' || !Number.isInteger(value.version) || value.version < 0 || value.version > CURRENT_VERSION) return null;
  if (typeof value.exportedAt !== 'string' || !isRecord(value.profile) || !isRecord(value.targets) || hasInvalidNumber(value)) return null;
  for (const key of ['foodLog', 'savedFoods', 'weightEntries', 'mealTemplates', 'recipes', 'shoppingList', 'mealPlan']) {
    if (!Array.isArray(value[key])) return null;
    if (value[key].some((item: unknown) => !isRecord(item))) return null;
  }
  const foodDatabaseValue = value.foodDatabase === undefined ? [] : value.foodDatabase;
  if (!Array.isArray(foodDatabaseValue) || foodDatabaseValue.some((item: unknown) => !isRecord(item))) return null;
  return {
    version: CURRENT_VERSION, exportedAt: timestamp(value.exportedAt), profile: normalizeProfile(value.profile), targets: normalizeTargets(value.targets),
    foodLog: normalizeArray(value.foodLog, normalizeLogEntry), savedFoods: normalizeArray(value.savedFoods, normalizeFood),
    foodDatabase: dedupeFoodDatabase(normalizeArray(foodDatabaseValue, normalizeFoodDatabaseItem)),
    weightEntries: normalizeArray(value.weightEntries, normalizeWeight), mealTemplates: normalizeArray(value.mealTemplates, normalizeTemplate),
    recipes: normalizeArray(value.recipes, normalizeRecipe), shoppingList: normalizeArray(value.shoppingList, normalizeShoppingItem),
    mealPlan: normalizeArray(value.mealPlan, normalizePlanEntry),
  };
}

export function validateAppBundle(value: unknown): value is AppStateBundle {
  return normalizeAppBundle(value) !== null;
}

export function importAppData(value: unknown): boolean {
  const bundle = normalizeAppBundle(value);
  if (!bundle) return false;
  const writes: [string, unknown][] = [
    [KEYS.profile, bundle.profile], [KEYS.targets, bundle.targets], [KEYS.foodLog, bundle.foodLog],
    [KEYS.savedFoods, bundle.savedFoods], [KEYS.foodDatabase, bundle.foodDatabase], [KEYS.weightEntries, bundle.weightEntries],
    [KEYS.mealTemplates, bundle.mealTemplates], [KEYS.recipes, bundle.recipes],
    [KEYS.shoppingList, bundle.shoppingList], [KEYS.mealPlan, bundle.mealPlan], [KEYS.version, CURRENT_VERSION],
  ];
  return writeAtomically(writes);
}
