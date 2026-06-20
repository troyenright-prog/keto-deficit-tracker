import type {
  UserProfile,
  NutritionTargets,
  FoodLogEntry,
  FoodItem,
  WeightEntry,
  MealTemplate,
  Recipe,
  ShoppingItem,
  MealPlanEntry,
  AppStateBundle,
} from '../types';

// ── Version ────────────────────────────────────────────────────────────────────
const CURRENT_VERSION = 2;

const KEYS = {
  version: 'keto_version',
  profile: 'keto_profile',
  targets: 'keto_targets',
  foodLog: 'keto_food_log',
  savedFoods: 'keto_saved_foods',
  weightEntries: 'keto_weight_entries',
  mealTemplates: 'keto_meal_templates',
  recipes: 'keto_recipes',
  shoppingList: 'keto_shopping_list',
  mealPlan: 'keto_meal_plan',
} as const;

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded)
  }
}

// ── Migration ──────────────────────────────────────────────────────────────────

export function migrateIfNeeded(): void {
  const v = safeRead<number>(KEYS.version, 0);
  if (v >= CURRENT_VERSION) return;

  // v0 → v2: MVP data already present in individual keys; just add defaults
  // for any missing new keys so they start as empty arrays.
  if (!localStorage.getItem(KEYS.mealTemplates)) safeWrite(KEYS.mealTemplates, []);
  if (!localStorage.getItem(KEYS.recipes)) safeWrite(KEYS.recipes, []);
  if (!localStorage.getItem(KEYS.shoppingList)) safeWrite(KEYS.shoppingList, []);
  if (!localStorage.getItem(KEYS.mealPlan)) safeWrite(KEYS.mealPlan, []);

  safeWrite(KEYS.version, CURRENT_VERSION);
}

// ── Defaults ───────────────────────────────────────────────────────────────────

export const DEFAULT_TARGETS: NutritionTargets = {
  calories: 1800,
  proteinG: 120,
  netCarbsG: 20,
  fatG: 140,
  sodiumMg: 2300,
  potassiumMg: 3500,
  magnesiumMg: 400,
  dietMode: 'strict-keto',
  manualNetCarbs: false,
};

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  weightUnit: 'kg',
  createdAt: new Date().toISOString(),
};

// ── Profile ────────────────────────────────────────────────────────────────────

export function loadProfile(): UserProfile {
  return safeRead<UserProfile>(KEYS.profile, DEFAULT_PROFILE);
}

export function saveProfile(profile: UserProfile): void {
  safeWrite(KEYS.profile, profile);
}

// ── Targets ────────────────────────────────────────────────────────────────────

export function loadTargets(): NutritionTargets {
  return safeRead<NutritionTargets>(KEYS.targets, DEFAULT_TARGETS);
}

export function saveTargets(targets: NutritionTargets): void {
  safeWrite(KEYS.targets, targets);
}

// ── Food log ───────────────────────────────────────────────────────────────────

export function loadFoodLog(): FoodLogEntry[] {
  return safeRead<FoodLogEntry[]>(KEYS.foodLog, []);
}

export function saveFoodLog(log: FoodLogEntry[]): void {
  safeWrite(KEYS.foodLog, log);
}

// ── Saved foods ────────────────────────────────────────────────────────────────

export function loadSavedFoods(): FoodItem[] {
  return safeRead<FoodItem[]>(KEYS.savedFoods, []);
}

export function saveSavedFoods(foods: FoodItem[]): void {
  safeWrite(KEYS.savedFoods, foods);
}

// ── Weight ─────────────────────────────────────────────────────────────────────

export function loadWeightEntries(): WeightEntry[] {
  return safeRead<WeightEntry[]>(KEYS.weightEntries, []);
}

export function saveWeightEntries(entries: WeightEntry[]): void {
  safeWrite(KEYS.weightEntries, entries);
}

// ── Meal templates ─────────────────────────────────────────────────────────────

export function loadMealTemplates(): MealTemplate[] {
  return safeRead<MealTemplate[]>(KEYS.mealTemplates, []);
}

export function saveMealTemplates(templates: MealTemplate[]): void {
  safeWrite(KEYS.mealTemplates, templates);
}

// ── Recipes ────────────────────────────────────────────────────────────────────

export function loadRecipes(): Recipe[] {
  return safeRead<Recipe[]>(KEYS.recipes, []);
}

export function saveRecipes(recipes: Recipe[]): void {
  safeWrite(KEYS.recipes, recipes);
}

// ── Shopping list ──────────────────────────────────────────────────────────────

export function loadShoppingList(): ShoppingItem[] {
  return safeRead<ShoppingItem[]>(KEYS.shoppingList, []);
}

export function saveShoppingList(items: ShoppingItem[]): void {
  safeWrite(KEYS.shoppingList, items);
}

// ── Meal plan ──────────────────────────────────────────────────────────────────

export function loadMealPlan(): MealPlanEntry[] {
  return safeRead<MealPlanEntry[]>(KEYS.mealPlan, []);
}

export function saveMealPlan(plan: MealPlanEntry[]): void {
  safeWrite(KEYS.mealPlan, plan);
}

// ── Import / export ────────────────────────────────────────────────────────────

export function exportAppData(): AppStateBundle {
  return {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: loadProfile(),
    targets: loadTargets(),
    foodLog: loadFoodLog(),
    savedFoods: loadSavedFoods(),
    weightEntries: loadWeightEntries(),
    mealTemplates: loadMealTemplates(),
    recipes: loadRecipes(),
    shoppingList: loadShoppingList(),
    mealPlan: loadMealPlan(),
  };
}

export function validateAppBundle(data: unknown): data is AppStateBundle {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.version === 'number' &&
    typeof d.exportedAt === 'string' &&
    typeof d.profile === 'object' &&
    typeof d.targets === 'object' &&
    Array.isArray(d.foodLog) &&
    Array.isArray(d.savedFoods) &&
    Array.isArray(d.weightEntries) &&
    Array.isArray(d.mealTemplates) &&
    Array.isArray(d.recipes) &&
    Array.isArray(d.shoppingList) &&
    Array.isArray(d.mealPlan)
  );
}

export function importAppData(bundle: AppStateBundle): void {
  saveProfile(bundle.profile);
  saveTargets(bundle.targets);
  saveFoodLog(bundle.foodLog);
  saveSavedFoods(bundle.savedFoods);
  saveWeightEntries(bundle.weightEntries);
  saveMealTemplates(bundle.mealTemplates);
  saveRecipes(bundle.recipes);
  saveShoppingList(bundle.shoppingList);
  saveMealPlan(bundle.mealPlan);
  safeWrite(KEYS.version, CURRENT_VERSION);
}
