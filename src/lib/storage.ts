import type {
  UserProfile, NutritionTargets, FoodLogEntry, FoodItem, WeightEntry,
  MealTemplate, MealTemplateItem, Recipe, RecipeIngredient, ShoppingItem,
  MealPlanEntry, AppStateBundle, Micronutrients, FoodDatabaseItem, FoodDatabaseSource, ReminderSettings,
  DailyActivityEntry, SleepEntry, SleepStage, SleepStageSegment, VitalsEntry,
} from '../types';
import { addLocalDays, isDateString, localDateString } from './date';
import { dedupeFoodDatabase } from './food-database';
import { isMealSlot } from './meals';
import { calcNetCarbs, safeNonNegative, safePositive } from './nutrition';
import { getStarterFoodOptions } from './australianFoods';
import { DEFAULT_REMINDERS, hasEnabledReminders, normalizeReminderSettings } from './reminders';
import { MICRONUTRIENT_KEYS, zeroMicronutrients } from './micronutrients';

export const CURRENT_VERSION = 6;

const KEYS = {
  version: 'keto_version', profile: 'keto_profile', targets: 'keto_targets',
  foodLog: 'keto_food_log', savedFoods: 'keto_saved_foods', weightEntries: 'keto_weight_entries',
  dailyActivity: 'keto_daily_activity', sleepEntries: 'keto_sleep_entries', vitalsEntries: 'keto_vitals_entries',
  mealTemplates: 'keto_meal_templates', recipes: 'keto_recipes', shoppingList: 'keto_shopping_list',
  mealPlan: 'keto_meal_plan', foodDatabase: 'keto_food_database', reminders: 'keto_reminders',
} as const;

const DEMO_SEED_KEY = 'keto_demo_seed_v1';
const LEGACY_CLAIM_KEY = 'keto_legacy_data_claimed_by';

type StorageScope = {
  environment: string;
  userKey: string;
};

let activeStorageScope: StorageScope | null = null;
const storageChangeListeners = new Set<() => void>();

function scopeId(scope = activeStorageScope): string {
  return scope ? `${scope.environment}:${scope.userKey}` : '';
}

function scopedKey(key: string): string {
  return activeStorageScope ? `keto_${activeStorageScope.environment}_${activeStorageScope.userKey}_${key}` : key;
}

export function configureStorageScope(scope: StorageScope | null): void {
  activeStorageScope = scope;
}

export function getStorageScopeId(): string {
  return scopeId();
}

export function subscribeLocalDataChanges(listener: () => void): () => void {
  storageChangeListeners.add(listener);
  return () => storageChangeListeners.delete(listener);
}

function notifyLocalDataChanged(): void {
  for (const listener of storageChangeListeners) {
    try {
      listener();
    } catch {
      // Listener failures should not break writes.
    }
  }
}

// Per-user marker of when local data last changed from a *user* action (not from
// applying a remote sync). Stored as a raw ISO string scoped to the active user
// so sync can compare local freshness against a remote bundle's exportedAt and
// avoid an older remote clobbering newer local edits. See firebase-db sync.
const LOCAL_MODIFIED_KEY = 'keto_local_modified_at';

export function markLocalDataModified(at: string = new Date().toISOString()): string {
  try {
    localStorage.setItem(scopedKey(LOCAL_MODIFIED_KEY), at);
  } catch {
    // Best-effort; freshness comparison falls back to "no marker" behaviour.
  }
  return at;
}

export function getLocalDataModifiedAt(): string {
  try {
    return localStorage.getItem(scopedKey(LOCAL_MODIFIED_KEY)) ?? '';
  } catch {
    return '';
  }
}

// Give existing on-device data a freshness baseline the first time this runs, so
// a stale remote bundle can't overwrite local data that predates the marker.
export function ensureLocalModifiedBaseline(): void {
  if (!getLocalDataModifiedAt() && hasUserData()) markLocalDataModified();
}

// Decide whether an incoming remote bundle should replace local data. Remote
// wins only when it is provably newer than the local marker; with no marker we
// only accept remote if there is no local data to lose (e.g. a fresh install).
export function remoteBundleShouldReplaceLocal(remoteExportedAt: string, localModifiedAt: string, localHasData: boolean): boolean {
  if (!localModifiedAt) return !localHasData;
  return remoteExportedAt > localModifiedAt;
}

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const optionalText = (value: unknown) => typeof value === 'string' ? value : undefined;
const date = (value: unknown) => isDateString(value) ? value : localDateString();
const isTimestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const timestamp = (value: unknown) => isTimestamp(value) ? value : new Date().toISOString();

function safeRead(key: string): unknown {
  try {
    const raw = localStorage.getItem(scopedKey(key));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function safeWrite(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(scopedKey(key), JSON.stringify(value));
    notifyLocalDataChanged();
    return true;
  } catch {
    return false;
  }
}

function hasRawUserData(prefix = ''): boolean {
  try {
    const read = (key: string) => localStorage.getItem(`${prefix}${key}`);
    return Boolean(
      read(KEYS.profile) ||
      read(KEYS.targets) ||
      read(KEYS.foodLog) ||
      read(KEYS.savedFoods) ||
      read(KEYS.weightEntries) ||
      read(KEYS.dailyActivity) ||
      read(KEYS.sleepEntries) ||
      read(KEYS.vitalsEntries) ||
      read(KEYS.mealTemplates) ||
      read(KEYS.recipes) ||
      read(KEYS.shoppingList) ||
      read(KEYS.mealPlan) ||
      read(KEYS.foodDatabase) ||
      read(KEYS.reminders)
    );
  } catch {
    return false;
  }
}

export function claimLegacyDataForActiveScope(): boolean {
  if (!activeStorageScope) return false;
  const prefix = `keto_${activeStorageScope.environment}_${activeStorageScope.userKey}_`;
  if (hasRawUserData(prefix) || !hasRawUserData()) return false;

  const activeId = scopeId();
  try {
    const claimedBy = localStorage.getItem(LEGACY_CLAIM_KEY);
    if (claimedBy && claimedBy !== activeId) return false;
    for (const key of Object.values(KEYS)) {
      const raw = localStorage.getItem(key);
      if (raw !== null) localStorage.setItem(`${prefix}${key}`, raw);
    }
    const demoRaw = localStorage.getItem(DEMO_SEED_KEY);
    if (demoRaw !== null) localStorage.setItem(`${prefix}${DEMO_SEED_KEY}`, demoRaw);
    localStorage.setItem(LEGACY_CLAIM_KEY, activeId);
    notifyLocalDataChanged();
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_TARGETS: NutritionTargets = {
  calories: 1800, proteinG: 120, netCarbsG: 20, fatG: 140,
  sodiumMg: 2300, potassiumMg: 3500, magnesiumMg: 400,
  dietMode: 'strict-keto', manualNetCarbs: false,
  ...zeroMicronutrients(),
};

export const DEFAULT_PROFILE: UserProfile = {
  name: '', weightUnit: 'kg', createdAt: new Date().toISOString(),
};

function micros(record: UnknownRecord): Micronutrients {
  const result: Micronutrients = {};
  for (const key of MICRONUTRIENT_KEYS) {
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
  const age = typeof value.age === 'number' && Number.isFinite(value.age) && value.age > 0 ? value.age : undefined;
  const sex = value.sex === 'male' || value.sex === 'female' ? value.sex : undefined;
  return {
    name: text(value.name), weightUnit: value.weightUnit === 'lbs' ? 'lbs' : 'kg',
    createdAt: timestamp(value.createdAt),
    ...(age !== undefined ? { age } : {}),
    ...(sex !== undefined ? { sex } : {}),
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
    ...zeroMicronutrients(),
    ...micros(value),
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
  const source: FoodDatabaseSource = value.source === 'openFoodFacts' || value.source === 'foodDataCentral' ||
    value.source === 'recipe' || value.source === 'template' || value.source === 'barcode'
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
  const bodyFat = safePositive(value.bodyFat, 0);
  const leanBodyMassKg = optionalNonNegative(value.leanBodyMassKg);
  const boneMassKg = optionalNonNegative(value.boneMassKg);
  const bodyWaterMassKg = optionalNonNegative(value.bodyWaterMassKg);
  const isGarmin = value.source === 'garminHealthConnect';
  return {
    id: text(value.id, crypto.randomUUID()), date: date(value.date), weight,
    unit: value.unit === 'lbs' ? 'lbs' : 'kg', loggedAt: timestamp(value.loggedAt),
    ...(bodyFat > 0 ? { bodyFat } : {}),
    ...(leanBodyMassKg !== undefined ? { leanBodyMassKg } : {}),
    ...(boneMassKg !== undefined ? { boneMassKg } : {}),
    ...(bodyWaterMassKg !== undefined ? { bodyWaterMassKg } : {}),
    ...(isGarmin ? {
      source: 'garminHealthConnect' as const,
      sourceLabel: optionalText(value.sourceLabel) ?? 'Garmin via Health Connect',
      importedAt: timestamp(value.importedAt),
    } : {}),
  };
}

function optionalNonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizeDailyActivity(value: unknown): DailyActivityEntry | null {
  if (!isRecord(value)) return null;
  const steps = Math.round(safeNonNegative(value.steps));
  const activeCalories = optionalNonNegative(value.activeCalories);
  const totalCalories = optionalNonNegative(value.totalCalories);
  const distanceMeters = optionalNonNegative(value.distanceMeters);
  const floorsClimbed = optionalNonNegative(value.floorsClimbed);
  const elevationGainedMeters = optionalNonNegative(value.elevationGainedMeters);
  if (steps <= 0 && activeCalories === undefined && totalCalories === undefined
    && distanceMeters === undefined && floorsClimbed === undefined && elevationGainedMeters === undefined) return null;
  return {
    id: text(value.id, crypto.randomUUID()),
    date: date(value.date),
    steps,
    ...(activeCalories !== undefined ? { activeCalories } : {}),
    ...(totalCalories !== undefined ? { totalCalories } : {}),
    ...(distanceMeters !== undefined ? { distanceMeters } : {}),
    ...(floorsClimbed !== undefined ? { floorsClimbed } : {}),
    ...(elevationGainedMeters !== undefined ? { elevationGainedMeters } : {}),
    source: 'garminHealthConnect',
    sourceLabel: optionalText(value.sourceLabel) ?? 'Garmin via Health Connect',
    importedAt: timestamp(value.importedAt),
  };
}

const SLEEP_STAGES: readonly SleepStage[] = ['awake', 'light', 'deep', 'rem', 'unknown'];

function normalizeSleepStage(value: unknown): SleepStageSegment | null {
  if (!isRecord(value)) return null;
  const stage = SLEEP_STAGES.includes(value.stage as SleepStage) ? (value.stage as SleepStage) : 'unknown';
  return { stage, startTime: timestamp(value.startTime), endTime: timestamp(value.endTime) };
}

function normalizeSleepEntry(value: unknown): SleepEntry | null {
  if (!isRecord(value)) return null;
  const totalMinutes = Math.round(safeNonNegative(value.totalMinutes));
  if (totalMinutes <= 0) return null;
  const stages = Array.isArray(value.stages)
    ? value.stages.map(normalizeSleepStage).filter((s): s is SleepStageSegment => s !== null)
    : [];
  return {
    id: text(value.id, crypto.randomUUID()),
    date: date(value.date),
    startTime: timestamp(value.startTime),
    endTime: timestamp(value.endTime),
    totalMinutes,
    ...(stages.length > 0 ? { stages } : {}),
    source: 'garminHealthConnect',
    sourceLabel: optionalText(value.sourceLabel) ?? 'Garmin via Health Connect',
    importedAt: timestamp(value.importedAt),
  };
}

function normalizeVitalsEntry(value: unknown): VitalsEntry | null {
  if (!isRecord(value)) return null;
  const restingHeartRate = optionalNonNegative(value.restingHeartRate);
  const hrv = optionalNonNegative(value.hrv);
  const vo2Max = optionalNonNegative(value.vo2Max);
  const oxygenSaturation = optionalNonNegative(value.oxygenSaturation);
  const respiratoryRate = optionalNonNegative(value.respiratoryRate);
  if (restingHeartRate === undefined && hrv === undefined && vo2Max === undefined
    && oxygenSaturation === undefined && respiratoryRate === undefined) return null;
  return {
    id: text(value.id, crypto.randomUUID()),
    date: date(value.date),
    ...(restingHeartRate !== undefined ? { restingHeartRate } : {}),
    ...(hrv !== undefined ? { hrv } : {}),
    ...(vo2Max !== undefined ? { vo2Max } : {}),
    ...(oxygenSaturation !== undefined ? { oxygenSaturation } : {}),
    ...(respiratoryRate !== undefined ? { respiratoryRate } : {}),
    source: 'garminHealthConnect',
    sourceLabel: optionalText(value.sourceLabel) ?? 'Garmin via Health Connect',
    importedAt: timestamp(value.importedAt),
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
    for (const key of [KEYS.mealTemplates, KEYS.recipes, KEYS.shoppingList, KEYS.mealPlan, KEYS.foodDatabase, KEYS.dailyActivity, KEYS.sleepEntries, KEYS.vitalsEntries]) {
      if (localStorage.getItem(scopedKey(key)) === null && !safeWrite(key, [])) return;
    }
    if (localStorage.getItem(scopedKey(KEYS.reminders)) === null && !safeWrite(KEYS.reminders, DEFAULT_REMINDERS)) return;
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
export const loadDailyActivity = () => normalizeArray(safeRead(KEYS.dailyActivity), normalizeDailyActivity);
export const saveDailyActivity = (value: DailyActivityEntry[]) => safeWrite(KEYS.dailyActivity, value);
export const loadSleepEntries = () => normalizeArray(safeRead(KEYS.sleepEntries), normalizeSleepEntry);
export const saveSleepEntries = (value: SleepEntry[]) => safeWrite(KEYS.sleepEntries, value);
export const loadVitalsEntries = () => normalizeArray(safeRead(KEYS.vitalsEntries), normalizeVitalsEntry);
export const saveVitalsEntries = (value: VitalsEntry[]) => safeWrite(KEYS.vitalsEntries, value);
export const loadMealTemplates = () => normalizeArray(safeRead(KEYS.mealTemplates), normalizeTemplate);
export const saveMealTemplates = (value: MealTemplate[]) => safeWrite(KEYS.mealTemplates, value);
export const loadRecipes = () => normalizeArray(safeRead(KEYS.recipes), normalizeRecipe);
export const saveRecipes = (value: Recipe[]) => safeWrite(KEYS.recipes, value);
export const loadShoppingList = () => normalizeArray(safeRead(KEYS.shoppingList), normalizeShoppingItem);
export const saveShoppingList = (value: ShoppingItem[]) => safeWrite(KEYS.shoppingList, value);
export const loadMealPlan = () => normalizeArray(safeRead(KEYS.mealPlan), normalizePlanEntry);
export const saveMealPlan = (value: MealPlanEntry[]) => safeWrite(KEYS.mealPlan, value);
export const loadReminders = () => normalizeReminderSettings(safeRead(KEYS.reminders));
export const saveReminders = (value: ReminderSettings) => safeWrite(KEYS.reminders, normalizeReminderSettings(value));

function writeAtomically(writes: [string, unknown][]): boolean {
  const previous = new Map<string, string | null>();
  try {
    for (const [key] of writes) previous.set(scopedKey(key), localStorage.getItem(scopedKey(key)));
    for (const [key, item] of writes) localStorage.setItem(scopedKey(key), JSON.stringify(item));
    notifyLocalDataChanged();
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

function hasUserData(): boolean {
  return loadFoodLog().length > 0 ||
    loadSavedFoods().length > 0 ||
    loadWeightEntries().length > 0 ||
    loadDailyActivity().length > 0 ||
    loadSleepEntries().length > 0 ||
    loadVitalsEntries().length > 0 ||
    loadMealTemplates().length > 0 ||
    loadRecipes().length > 0 ||
    loadShoppingList().length > 0 ||
    loadMealPlan().length > 0 ||
    hasEnabledReminders(loadReminders()) ||
    loadProfile().name.trim().length > 0;
}

export const hasLocalUserData = hasUserData;

function demoSeedAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') return true;

  const localPreviewHosts = new Set(['', 'localhost', '127.0.0.1', '::1', '[::1]']);
  return localPreviewHosts.has(window.location.hostname);
}

export function seedDemoDataIfEmpty(): boolean {
  const demoParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('demo') : null;
  const forceDemoReset = demoParam === 'reset';
  const demoRequested = forceDemoReset || demoParam === '1' || demoParam === 'true';
  if (!demoRequested || !demoSeedAllowed()) return false;

  if (forceDemoReset) {
    for (const key of [...Object.values(KEYS), DEMO_SEED_KEY]) localStorage.removeItem(scopedKey(key));
    migrateIfNeeded();
  }
  if (!forceDemoReset && (safeRead(DEMO_SEED_KEY) === true || hasUserData())) return false;

  const now = new Date().toISOString();
  const today = localDateString();
  const yesterday = addLocalDays(today, -1);
  const twoDaysAgo = addLocalDays(today, -2);
  const starterFoods = getStarterFoodOptions();
  const byName = (name: string) => starterFoods.find((food) => food.name === name)!;

  const eggs: FoodItem = { ...byName('Eggs (whole, large)'), id: 'demo-food-eggs', isFavourite: true, createdAt: now };
  const salmon: FoodItem = { ...byName('Salmon (Atlantic, raw)'), id: 'demo-food-salmon', isFavourite: true, createdAt: now };
  const avocado: FoodItem = { ...byName('Avocado'), id: 'demo-food-avocado', isFavourite: false, createdAt: now };
  const spinach: FoodItem = { ...byName('Spinach (raw)'), id: 'demo-food-spinach', isFavourite: false, createdAt: now };
  const yoghurt: FoodItem = { ...byName('Greek yoghurt (full fat, plain)'), id: 'demo-food-yoghurt', isFavourite: true, createdAt: now };
  const cheese: FoodItem = { ...byName('Cheddar cheese'), id: 'demo-food-cheese', barcode: '9300000000011', isFavourite: false, createdAt: now };
  const savedFoods: FoodItem[] = [eggs, salmon, avocado, spinach, yoghurt, cheese];

  const logEntry = (food: FoodItem, id: string, day: string, servingMultiplier: number, meal: FoodLogEntry['meal']): FoodLogEntry => ({
    id,
    date: day,
    foodItemId: food.id,
    source: 'saved-food',
    meal,
    name: food.name,
    servingSize: food.servingSize,
    servingMultiplier,
    calories: food.calories * servingMultiplier,
    proteinG: food.proteinG * servingMultiplier,
    fatG: food.fatG * servingMultiplier,
    totalCarbsG: food.totalCarbsG * servingMultiplier,
    fibreG: food.fibreG * servingMultiplier,
    sugarAlcoholsG: food.sugarAlcoholsG * servingMultiplier,
    sodiumMg: food.sodiumMg * servingMultiplier,
    potassiumMg: food.potassiumMg * servingMultiplier,
    magnesiumMg: food.magnesiumMg * servingMultiplier,
    loggedAt: now,
  });

  const foodLog: FoodLogEntry[] = [
    logEntry(eggs, 'demo-log-eggs-today', today, 2, 'breakfast'),
    logEntry(avocado, 'demo-log-avocado-today', today, 0.5, 'lunch'),
    logEntry(salmon, 'demo-log-salmon-today', today, 1.5, 'dinner'),
    logEntry(spinach, 'demo-log-spinach-today', today, 1, 'dinner'),
    logEntry(yoghurt, 'demo-log-yoghurt-yesterday', yesterday, 1, 'breakfast'),
    logEntry(cheese, 'demo-log-cheese-yesterday', yesterday, 1, 'snack'),
    logEntry(salmon, 'demo-log-salmon-yesterday', yesterday, 1, 'dinner'),
    logEntry(eggs, 'demo-log-eggs-older', twoDaysAgo, 2, 'breakfast'),
    logEntry(avocado, 'demo-log-avocado-older', twoDaysAgo, 1, 'lunch'),
  ];

  const templateItems: MealTemplateItem[] = [
    { ...eggs, id: 'demo-template-eggs', savedFoodId: eggs.id, quantity: 2 },
    { ...avocado, id: 'demo-template-avocado', savedFoodId: avocado.id, quantity: 0.5 },
  ];
  const mealTemplates: MealTemplate[] = [{
    id: 'demo-template-breakfast',
    name: 'Demo keto breakfast',
    mealType: 'breakfast',
    items: templateItems,
    createdAt: now,
  }];

  const recipeIngredients: RecipeIngredient[] = [
    { ...salmon, id: 'demo-recipe-salmon', quantity: 2 },
    { ...spinach, id: 'demo-recipe-spinach', quantity: 2 },
    { ...cheese, id: 'demo-recipe-cheese', quantity: 1 },
  ];
  const recipes: Recipe[] = [{
    id: 'demo-recipe-salmon-bake',
    name: 'Demo salmon bake',
    servings: 2,
    ingredients: recipeIngredients,
    createdAt: now,
  }];

  const shoppingList: ShoppingItem[] = [
    { id: 'demo-shop-eggs', name: 'Eggs', quantity: '1 dozen', completed: false, source: 'manual', createdAt: now },
    { id: 'demo-shop-salmon', name: 'Salmon fillets', quantity: '2 portions', completed: false, source: 'manual', createdAt: now },
    { id: 'demo-shop-spinach', name: 'Baby spinach', quantity: '1 bag', completed: true, source: 'manual', createdAt: now },
  ];

  const garminMeta = {
    source: 'garminHealthConnect' as const,
    sourceLabel: 'Garmin via Health Connect',
    importedAt: now,
  };

  const weightEntries: WeightEntry[] = [
    { id: 'demo-weight-1', date: addLocalDays(today, -21), weight: 93.0, unit: 'kg', bodyFat: 26.4, leanBodyMassKg: 68.4, boneMassKg: 3.2, bodyWaterMassKg: 48.2, loggedAt: now, ...garminMeta },
    { id: 'demo-weight-2', date: addLocalDays(today, -14), weight: 92.2, unit: 'kg', bodyFat: 25.9, leanBodyMassKg: 68.3, boneMassKg: 3.2, bodyWaterMassKg: 48.6, loggedAt: now, ...garminMeta },
    { id: 'demo-weight-3', date: addLocalDays(today, -7), weight: 91.5, unit: 'kg', bodyFat: 25.5, leanBodyMassKg: 68.1, boneMassKg: 3.1, bodyWaterMassKg: 48.9, loggedAt: now, ...garminMeta },
    { id: 'demo-weight-4', date: addLocalDays(today, -3), weight: 91.1, unit: 'kg', bodyFat: 25.2, leanBodyMassKg: 68.0, boneMassKg: 3.1, bodyWaterMassKg: 49.1, loggedAt: now, ...garminMeta },
    { id: 'demo-weight-5', date: today, weight: 90.7, unit: 'kg', bodyFat: 24.9, leanBodyMassKg: 68.1, boneMassKg: 3.1, bodyWaterMassKg: 49.4, loggedAt: now, ...garminMeta },
  ];

  const dailyActivity: DailyActivityEntry[] = [
    { id: 'demo-activity-1', date: addLocalDays(today, -6), steps: 7120, activeCalories: 368, totalCalories: 2288, distanceMeters: 5450, floorsClimbed: 6, elevationGainedMeters: 34, ...garminMeta },
    { id: 'demo-activity-2', date: addLocalDays(today, -5), steps: 9350, activeCalories: 512, totalCalories: 2440, distanceMeters: 7210, floorsClimbed: 10, elevationGainedMeters: 58, ...garminMeta },
    { id: 'demo-activity-3', date: addLocalDays(today, -4), steps: 6040, activeCalories: 306, totalCalories: 2180, distanceMeters: 4520, floorsClimbed: 4, elevationGainedMeters: 22, ...garminMeta },
    { id: 'demo-activity-4', date: yesterday, steps: 10880, activeCalories: 594, totalCalories: 2525, distanceMeters: 8350, floorsClimbed: 12, elevationGainedMeters: 74, ...garminMeta },
    { id: 'demo-activity-5', date: today, steps: 8460, activeCalories: 445, totalCalories: 2368, distanceMeters: 6410, floorsClimbed: 8, elevationGainedMeters: 45, ...garminMeta },
  ];

  const sleepEntries: SleepEntry[] = [
    {
      id: 'demo-sleep-1',
      date: today,
      startTime: `${yesterday}T22:54:00.000Z`,
      endTime: `${today}T06:30:00.000Z`,
      totalMinutes: 456,
      stages: [
        { stage: 'awake', startTime: `${yesterday}T22:54:00.000Z`, endTime: `${yesterday}T23:06:00.000Z` },
        { stage: 'light', startTime: `${yesterday}T23:06:00.000Z`, endTime: `${today}T00:45:00.000Z` },
        { stage: 'deep', startTime: `${today}T00:45:00.000Z`, endTime: `${today}T02:05:00.000Z` },
        { stage: 'rem', startTime: `${today}T02:05:00.000Z`, endTime: `${today}T03:20:00.000Z` },
        { stage: 'light', startTime: `${today}T03:20:00.000Z`, endTime: `${today}T05:18:00.000Z` },
        { stage: 'rem', startTime: `${today}T05:18:00.000Z`, endTime: `${today}T06:30:00.000Z` },
      ],
      ...garminMeta,
    },
    { id: 'demo-sleep-2', date: yesterday, startTime: `${twoDaysAgo}T23:08:00.000Z`, endTime: `${yesterday}T06:18:00.000Z`, totalMinutes: 430, ...garminMeta },
    { id: 'demo-sleep-3', date: twoDaysAgo, startTime: `${addLocalDays(today, -3)}T22:36:00.000Z`, endTime: `${twoDaysAgo}T06:04:00.000Z`, totalMinutes: 448, ...garminMeta },
  ];

  const vitalsEntries: VitalsEntry[] = [
    { id: 'demo-vitals-1', date: addLocalDays(today, -4), restingHeartRate: 61, hrv: 39, vo2Max: 41.8, oxygenSaturation: 97, respiratoryRate: 14.4, ...garminMeta },
    { id: 'demo-vitals-2', date: addLocalDays(today, -3), restingHeartRate: 60, hrv: 41, vo2Max: 42.0, oxygenSaturation: 98, respiratoryRate: 14.1, ...garminMeta },
    { id: 'demo-vitals-3', date: yesterday, restingHeartRate: 59, hrv: 44, vo2Max: 42.1, oxygenSaturation: 98, respiratoryRate: 13.9, ...garminMeta },
    { id: 'demo-vitals-4', date: today, restingHeartRate: 58, hrv: 46, vo2Max: 42.3, oxygenSaturation: 98, respiratoryRate: 13.8, ...garminMeta },
  ];

  const cheeseDatabase: FoodDatabaseItem = {
    id: 'demo-db-cheese',
    barcode: cheese.barcode,
    name: cheese.name,
    brand: 'Demo brand',
    source: 'barcode',
    servingSize: cheese.servingSize,
    calories: cheese.calories,
    proteinG: cheese.proteinG,
    fatG: cheese.fatG,
    totalCarbsG: cheese.totalCarbsG,
    fibreG: cheese.fibreG,
    sugarAlcoholsG: cheese.sugarAlcoholsG,
    netCarbsG: calcNetCarbs(cheese.totalCarbsG, cheese.fibreG, cheese.sugarAlcoholsG),
    sodiumMg: cheese.sodiumMg,
    potassiumMg: cheese.potassiumMg,
    magnesiumMg: cheese.magnesiumMg,
    userEdited: true,
    verified: true,
    createdAt: now,
    updatedAt: now,
  };

  return writeAtomically([
    [KEYS.profile, { ...DEFAULT_PROFILE, name: 'Demo', createdAt: now }],
    [KEYS.targets, DEFAULT_TARGETS],
    [KEYS.foodLog, foodLog],
    [KEYS.savedFoods, savedFoods],
    [KEYS.foodDatabase, [cheeseDatabase]],
    [KEYS.weightEntries, weightEntries],
    [KEYS.dailyActivity, dailyActivity],
    [KEYS.sleepEntries, sleepEntries],
    [KEYS.vitalsEntries, vitalsEntries],
    [KEYS.mealTemplates, mealTemplates],
    [KEYS.recipes, recipes],
    [KEYS.shoppingList, shoppingList],
    [KEYS.mealPlan, []],
    [KEYS.reminders, DEFAULT_REMINDERS],
    [DEMO_SEED_KEY, true],
  ]);
}

export function exportAppData(): AppStateBundle {
  return {
    version: CURRENT_VERSION, exportedAt: new Date().toISOString(), profile: loadProfile(), targets: loadTargets(),
    foodLog: loadFoodLog(), savedFoods: loadSavedFoods(), weightEntries: loadWeightEntries(),
    dailyActivity: loadDailyActivity(), sleepEntries: loadSleepEntries(), vitalsEntries: loadVitalsEntries(),
    foodDatabase: loadFoodDatabase(),
    mealTemplates: loadMealTemplates(), recipes: loadRecipes(), shoppingList: loadShoppingList(), mealPlan: loadMealPlan(),
    reminders: loadReminders(),
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
  if (!isTimestamp(value.exportedAt) || !isRecord(value.profile) || !isRecord(value.targets) || hasInvalidNumber(value)) return null;
  for (const key of ['foodLog', 'savedFoods', 'weightEntries', 'mealTemplates', 'recipes', 'shoppingList', 'mealPlan']) {
    if (!Array.isArray(value[key])) return null;
    if (value[key].some((item: unknown) => !isRecord(item))) return null;
  }
  const foodDatabaseValue = value.foodDatabase === undefined ? [] : value.foodDatabase;
  if (!Array.isArray(foodDatabaseValue) || foodDatabaseValue.some((item: unknown) => !isRecord(item))) return null;
  const dailyActivityValue = value.dailyActivity === undefined ? [] : value.dailyActivity;
  if (!Array.isArray(dailyActivityValue) || dailyActivityValue.some((item: unknown) => !isRecord(item))) return null;
  const sleepEntriesValue = value.sleepEntries === undefined ? [] : value.sleepEntries;
  if (!Array.isArray(sleepEntriesValue) || sleepEntriesValue.some((item: unknown) => !isRecord(item))) return null;
  const vitalsEntriesValue = value.vitalsEntries === undefined ? [] : value.vitalsEntries;
  if (!Array.isArray(vitalsEntriesValue) || vitalsEntriesValue.some((item: unknown) => !isRecord(item))) return null;
  return {
    version: CURRENT_VERSION, exportedAt: timestamp(value.exportedAt), profile: normalizeProfile(value.profile), targets: normalizeTargets(value.targets),
    foodLog: normalizeArray(value.foodLog, normalizeLogEntry), savedFoods: normalizeArray(value.savedFoods, normalizeFood),
    foodDatabase: dedupeFoodDatabase(normalizeArray(foodDatabaseValue, normalizeFoodDatabaseItem)),
    weightEntries: normalizeArray(value.weightEntries, normalizeWeight), dailyActivity: normalizeArray(dailyActivityValue, normalizeDailyActivity),
    sleepEntries: normalizeArray(sleepEntriesValue, normalizeSleepEntry),
    vitalsEntries: normalizeArray(vitalsEntriesValue, normalizeVitalsEntry),
    mealTemplates: normalizeArray(value.mealTemplates, normalizeTemplate),
    recipes: normalizeArray(value.recipes, normalizeRecipe), shoppingList: normalizeArray(value.shoppingList, normalizeShoppingItem),
    mealPlan: normalizeArray(value.mealPlan, normalizePlanEntry),
    reminders: normalizeReminderSettings(value.reminders),
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
    [KEYS.dailyActivity, bundle.dailyActivity], [KEYS.sleepEntries, bundle.sleepEntries], [KEYS.vitalsEntries, bundle.vitalsEntries],
    [KEYS.mealTemplates, bundle.mealTemplates], [KEYS.recipes, bundle.recipes],
    [KEYS.shoppingList, bundle.shoppingList], [KEYS.mealPlan, bundle.mealPlan], [KEYS.reminders, bundle.reminders],
    [KEYS.version, CURRENT_VERSION],
  ];
  return writeAtomically(writes);
}
