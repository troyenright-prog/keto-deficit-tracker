// ── Diet / Profile ────────────────────────────────────────────────────────────

export type DietMode = 'strict-keto' | 'lazy-keto' | 'high-protein-keto';

export interface UserProfile {
  name: string;
  weightUnit: 'kg' | 'lbs';
  createdAt: string;
}

export interface NutritionTargets {
  calories: number;
  proteinG: number;
  netCarbsG: number;
  fatG: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
  dietMode: DietMode;
  manualNetCarbs: boolean;
}

// ── Core nutrition ─────────────────────────────────────────────────────────────

export interface NutritionTotals extends Micronutrients {
  calories: number;
  proteinG: number;
  fatG: number;
  totalCarbsG: number;
  fibreG: number;
  sugarAlcoholsG: number;
  netCarbsG: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
}

// Optional micronutrients — most foods won't have all values
export interface Micronutrients {
  calciumMg?: number;
  ironMg?: number;
  zincMg?: number;
  vitaminDMcg?: number;
  vitaminB12Mcg?: number;
  omega3G?: number;
  omega6G?: number;
}

// ── Saved food item ────────────────────────────────────────────────────────────

export interface FoodItem extends Micronutrients {
  id: string;
  name: string;
  servingSize: string;
  calories: number;
  proteinG: number;
  fatG: number;
  totalCarbsG: number;
  fibreG: number;
  sugarAlcoholsG: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
  createdAt: string;
  updatedAt?: string;
  isFavourite?: boolean;
  isStarter?: boolean;
}

// ── Food log entry ─────────────────────────────────────────────────────────────

export type LogSource = 'manual' | 'saved-food' | 'template' | 'recipe' | 'plan' | 'photo-estimate';

export interface FoodLogEntry extends Micronutrients {
  id: string;
  date: string; // YYYY-MM-DD
  foodItemId?: string;
  templateId?: string;
  recipeId?: string;
  source?: LogSource;
  name: string;
  servingSize: string;
  servingMultiplier: number;
  calories: number;
  proteinG: number;
  fatG: number;
  totalCarbsG: number;
  fibreG: number;
  sugarAlcoholsG: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
  loggedAt: string;
  sourceType?: 'photo-estimate';
  confidence?: number;
  assumptions?: string[];
}

// ── Daily summary ──────────────────────────────────────────────────────────────

export interface DailyNutritionSummary extends Micronutrients {
  date: string;
  calories: number;
  proteinG: number;
  fatG: number;
  totalCarbsG: number;
  fibreG: number;
  sugarAlcoholsG: number;
  netCarbsG: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
  entryCount: number;
}

// ── Weight ─────────────────────────────────────────────────────────────────────

export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number;
  unit: 'kg' | 'lbs';
  loggedAt: string;
}

// ── Meal templates ─────────────────────────────────────────────────────────────

export interface MealTemplateItem extends Micronutrients {
  id: string;
  savedFoodId?: string; // informational only — nutrition is snapshotted
  name: string;
  servingSize: string;
  quantity: number; // serving multiplier
  calories: number;
  proteinG: number;
  fatG: number;
  totalCarbsG: number;
  fibreG: number;
  sugarAlcoholsG: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  items: MealTemplateItem[];
  createdAt: string;
  updatedAt?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

// ── Recipes ────────────────────────────────────────────────────────────────────

export interface RecipeIngredient extends Micronutrients {
  id: string;
  name: string;
  servingSize: string;
  quantity: number; // serving multiplier
  calories: number;
  proteinG: number;
  fatG: number;
  totalCarbsG: number;
  fibreG: number;
  sugarAlcoholsG: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number; // total servings the recipe yields
  ingredients: RecipeIngredient[];
  createdAt: string;
  updatedAt?: string;
}

// ── Shopping list ──────────────────────────────────────────────────────────────

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string;
  completed: boolean;
  source: 'manual' | 'template' | 'recipe';
  sourceId?: string;
  createdAt: string;
}

// ── Meal planner ───────────────────────────────────────────────────────────────

export type PlanItemType = 'saved-food' | 'template' | 'recipe';

export interface MealPlanEntry extends Micronutrients {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: PlanItemType;
  sourceId: string;
  servings: number; // multiplier for foods/templates; serving count for recipes
  // Nutrition snapshot at time of planning
  calories: number;
  proteinG: number;
  fatG: number;
  totalCarbsG: number;
  fibreG: number;
  sugarAlcoholsG: number;
  netCarbsG: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
  converted: boolean;
  createdAt: string;
}

// ── Recommendations / suggestions ─────────────────────────────────────────────

export type RecommendationPriority = 'info' | 'warning' | 'success';

export interface Recommendation {
  id: string;
  message: string;
  priority: RecommendationPriority;
}

export type CarbStatus = 'aligned' | 'approaching' | 'exceeded';

// ── Import / export ────────────────────────────────────────────────────────────

export interface AppStateBundle {
  version: number;
  exportedAt: string;
  profile: UserProfile;
  targets: NutritionTargets;
  foodLog: FoodLogEntry[];
  savedFoods: FoodItem[];
  weightEntries: WeightEntry[];
  mealTemplates: MealTemplate[];
  recipes: Recipe[];
  shoppingList: ShoppingItem[];
  mealPlan: MealPlanEntry[];
}
