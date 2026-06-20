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

export interface FoodItem {
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
}

export interface FoodLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  foodItemId?: string; // reference to saved food, if applicable
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

export interface DailyNutritionSummary {
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

export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number;
  unit: 'kg' | 'lbs';
  loggedAt: string;
}

export type RecommendationPriority = 'info' | 'warning' | 'success';

export interface Recommendation {
  id: string;
  message: string;
  priority: RecommendationPriority;
}

export type CarbStatus = 'aligned' | 'approaching' | 'exceeded';
