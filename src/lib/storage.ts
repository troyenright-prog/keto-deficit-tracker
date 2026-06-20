import type {
  UserProfile,
  NutritionTargets,
  FoodLogEntry,
  FoodItem,
  WeightEntry,
} from '../types';

const KEYS = {
  profile: 'keto_profile',
  targets: 'keto_targets',
  foodLog: 'keto_food_log',
  savedFoods: 'keto_saved_foods',
  weightEntries: 'keto_weight_entries',
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

export function loadProfile(): UserProfile {
  return safeRead<UserProfile>(KEYS.profile, DEFAULT_PROFILE);
}

export function saveProfile(profile: UserProfile): void {
  safeWrite(KEYS.profile, profile);
}

export function loadTargets(): NutritionTargets {
  return safeRead<NutritionTargets>(KEYS.targets, DEFAULT_TARGETS);
}

export function saveTargets(targets: NutritionTargets): void {
  safeWrite(KEYS.targets, targets);
}

export function loadFoodLog(): FoodLogEntry[] {
  return safeRead<FoodLogEntry[]>(KEYS.foodLog, []);
}

export function saveFoodLog(log: FoodLogEntry[]): void {
  safeWrite(KEYS.foodLog, log);
}

export function loadSavedFoods(): FoodItem[] {
  return safeRead<FoodItem[]>(KEYS.savedFoods, []);
}

export function saveSavedFoods(foods: FoodItem[]): void {
  safeWrite(KEYS.savedFoods, foods);
}

export function loadWeightEntries(): WeightEntry[] {
  return safeRead<WeightEntry[]>(KEYS.weightEntries, []);
}

export function saveWeightEntries(entries: WeightEntry[]): void {
  safeWrite(KEYS.weightEntries, entries);
}
