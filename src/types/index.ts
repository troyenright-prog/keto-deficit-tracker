// ── Diet / Profile ────────────────────────────────────────────────────────────

export type DietMode = 'strict-keto' | 'lazy-keto' | 'high-protein-keto';

export type BiologicalSex = 'male' | 'female';

// Ordered lowest to highest activity for iteration in Settings' select options.
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'veryActive' | 'extraActive';

export interface UserProfile {
  name: string;
  weightUnit: 'kg' | 'lbs';
  createdAt: string;
  age?: number;
  sex?: BiologicalSex;
  heightCm?: number;
  activityLevel?: ActivityLevel;
}

export interface NutritionTargets extends Micronutrients {
  calories: number;
  proteinG: number;
  netCarbsG: number;
  fatG: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
  dietMode: DietMode;
  manualNetCarbs: boolean;
  // TDEE calculator inputs (see lib/tdee.ts) — kept with targets since they drive
  // calories/protein/fat, unlike height/activityLevel which are body stats on the profile.
  proteinPerKg?: number;
  deficitPercent?: number;
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
  saturatedFatG?: number;
  calciumMg?: number;
  phosphorusMg?: number;
  ironMg?: number;
  zincMg?: number;
  copperMg?: number;
  manganeseMg?: number;
  iodineMcg?: number;
  seleniumMcg?: number;
  vitaminAMcg?: number;
  vitaminCMg?: number;
  vitaminDMcg?: number;
  vitaminEMg?: number;
  vitaminKMcg?: number;
  thiaminMg?: number;
  riboflavinMg?: number;
  niacinMg?: number;
  pantothenicAcidMg?: number;
  vitaminB6Mg?: number;
  biotinMcg?: number;
  folateMcg?: number;
  vitaminB12Mcg?: number;
  cholineMg?: number;
  omega3G?: number;
  omega6G?: number;
}

// ── Saved food item ────────────────────────────────────────────────────────────

export interface FoodItem extends Micronutrients {
  id: string;
  barcode?: string;
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

export type FoodDatabaseSource = 'manual' | 'barcode' | 'openFoodFacts' | 'foodDataCentral' | 'recipe' | 'template';

export interface FoodDatabaseItem extends Micronutrients {
  id: string;
  barcode?: string;
  name: string;
  brand?: string;
  source: FoodDatabaseSource;
  servingSize: string;
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
  verified?: boolean;
  userEdited?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Food log entry ─────────────────────────────────────────────────────────────

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type LogSource = 'manual' | 'saved-food' | 'template' | 'recipe' | 'plan' | 'barcode';

export interface FoodLogEntry extends Micronutrients {
  id: string;
  date: string; // YYYY-MM-DD
  barcode?: string;
  foodItemId?: string;
  templateId?: string;
  recipeId?: string;
  source?: LogSource;
  meal?: MealSlot;
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

export type WeightEntrySource = 'manual' | 'garminHealthConnect';

export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number;
  unit: 'kg' | 'lbs';
  loggedAt: string;
  bodyFat?: number; // body-fat percentage, when available (e.g. from a Garmin scale)
  leanBodyMassKg?: number; // same-day body-composition companions to bodyFat, always in kg
  boneMassKg?: number;
  bodyWaterMassKg?: number;
  source?: WeightEntrySource; // absent/`manual` for hand-entered rows
  sourceLabel?: string; // human label for imported rows, e.g. "Garmin via Health Connect"
  importedAt?: string; // ISO timestamp of the last Health Connect import
}

// Daily activity imported from Garmin via Health Connect. Kept separate from
// nutrition targets so activity can be displayed without changing calorie goals.
export type DailyActivitySource = 'garminHealthConnect';

export interface DailyActivityEntry {
  id: string;
  date: string; // YYYY-MM-DD
  steps: number;
  activeCalories?: number;
  totalCalories?: number;
  distanceMeters?: number;
  floorsClimbed?: number;
  elevationGainedMeters?: number;
  source: DailyActivitySource;
  sourceLabel?: string;
  importedAt: string;
}

// ── Sleep ──────────────────────────────────────────────────────────────────────
// Imported from Garmin via Health Connect. `date` buckets a session by its wake
// date (the day the session ends), since sessions typically span midnight.

export type SleepStage = 'awake' | 'light' | 'deep' | 'rem' | 'unknown';
export type SleepEntrySource = 'garminHealthConnect';

export interface SleepStageSegment {
  stage: SleepStage;
  startTime: string; // ISO
  endTime: string; // ISO
}

export interface SleepEntry {
  id: string;
  date: string; // YYYY-MM-DD, the wake date
  startTime: string; // ISO
  endTime: string; // ISO
  totalMinutes: number;
  stages?: SleepStageSegment[];
  source: SleepEntrySource;
  sourceLabel?: string;
  importedAt: string;
}

// ── Vitals ─────────────────────────────────────────────────────────────────────
// Point-in-time physiological readings imported from Garmin via Health Connect.
// One entry per day; each field is independently optional since Health Connect
// returns each metric as its own record stream and not every Garmin device
// produces every metric.

export type VitalsEntrySource = 'garminHealthConnect';

export interface VitalsEntry {
  id: string;
  date: string; // YYYY-MM-DD
  restingHeartRate?: number; // bpm
  hrv?: number; // ms (HRV RMSSD)
  vo2Max?: number; // mL/(kg·min)
  oxygenSaturation?: number; // percent
  respiratoryRate?: number; // breaths/min
  source: VitalsEntrySource;
  sourceLabel?: string;
  importedAt: string;
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

export type ReminderKey = 'mealLogging' | 'weighIn' | 'electrolytes' | 'shopping';

export interface ReminderRule {
  enabled: boolean;
  time: string; // HH:mm
  weekday: number; // 1 Sunday - 7 Saturday - the first selected day, kept for backward compatibility
  days: number[]; // full set of selected days (1-7), always includes `weekday`; all 7 = every day
}

export type WeeklyReminderRule = ReminderRule;

export interface ReminderSettings {
  mealLogging: ReminderRule;
  weighIn: WeeklyReminderRule;
  electrolytes: ReminderRule;
  shopping: WeeklyReminderRule;
  updatedAt?: string;
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

// ── Health Connect nutrition write-sync ───────────────────────────────────────

// Tracks which food-log entries have already been pushed to Health Connect as
// Nutrition records, since the plugin only supports insert (no update/delete) -
// re-pushing an entry would double-count it in any reader (e.g. RepIQ) that
// sums records per day. `syncedEntryIds` is pruned to ids still present in the
// food log so it doesn't grow unbounded after entries are deleted.
export interface NutritionSyncSettings {
  enabled: boolean;
  syncedEntryIds: string[];
  lastSyncAt: string;
}

// ── Import / export ────────────────────────────────────────────────────────────

export interface AppStateBundle {
  version: number;
  exportedAt: string;
  profile: UserProfile;
  targets: NutritionTargets;
  foodLog: FoodLogEntry[];
  savedFoods: FoodItem[];
  foodDatabase: FoodDatabaseItem[];
  weightEntries: WeightEntry[];
  dailyActivity: DailyActivityEntry[];
  sleepEntries: SleepEntry[];
  vitalsEntries: VitalsEntry[];
  mealTemplates: MealTemplate[];
  recipes: Recipe[];
  shoppingList: ShoppingItem[];
  mealPlan: MealPlanEntry[];
  reminders: ReminderSettings;
  nutritionSync: NutritionSyncSettings;
}
