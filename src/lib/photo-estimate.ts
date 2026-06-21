import type { FoodLogEntry, Micronutrients } from '../types';
import { calcNetCarbs, safeNonNegative } from './nutrition';
import { nanoid } from './nanoid';

export interface PhotoEstimateNutrition extends Micronutrients {
  calories: number;
  protein: number;
  fat: number;
  totalCarbs: number;
  fibre: number;
  sugarAlcohols: number;
  netCarbs: number;
  sodium: number;
  potassium: number;
  magnesium: number;
}

export interface PhotoEstimateItem extends PhotoEstimateNutrition {
  name: string;
  portionEstimate: string;
  confidence: number;
}

export interface PhotoFoodEstimate {
  analysisId: string;
  createdAt: string;
  overallConfidence: number;
  summaryName: string;
  servingDescription: string;
  items: PhotoEstimateItem[];
  totals: PhotoEstimateNutrition;
  assumptions: string[];
  warnings: string[];
  needsUserReview: boolean;
}

const MICRO_KEYS = ['calciumMg', 'ironMg', 'zincMg', 'vitaminDMcg', 'vitaminB12Mcg', 'omega3G', 'omega6G'] as const;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isConfidence = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const isNutritionNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function normalizeNutrition(value: unknown): PhotoEstimateNutrition | null {
  if (!isRecord(value)) return null;
  const required = ['calories', 'protein', 'fat', 'totalCarbs', 'fibre', 'sugarAlcohols', 'netCarbs', 'sodium', 'potassium', 'magnesium'] as const;
  if (required.some((key) => key !== 'netCarbs' && !isNutritionNumber(value[key]))) return null;
  if (typeof value.netCarbs !== 'number' || !Number.isFinite(value.netCarbs)) return null;
  const result: PhotoEstimateNutrition = {
    calories: value.calories as number,
    protein: value.protein as number,
    fat: value.fat as number,
    totalCarbs: value.totalCarbs as number,
    fibre: value.fibre as number,
    sugarAlcohols: value.sugarAlcohols as number,
    netCarbs: calcNetCarbs(value.totalCarbs as number, value.fibre as number, value.sugarAlcohols as number),
    sodium: value.sodium as number,
    potassium: value.potassium as number,
    magnesium: value.magnesium as number,
  };
  for (const key of MICRO_KEYS) {
    if (value[key] !== undefined && value[key] !== null) {
      if (!isNutritionNumber(value[key])) return null;
      result[key] = value[key] as number;
    }
  }
  return result;
}

export function normalizePhotoEstimate(value: unknown): PhotoFoodEstimate | null {
  if (!isRecord(value) || !isText(value.analysisId) || !isText(value.createdAt) ||
      !isConfidence(value.overallConfidence) || !isText(value.summaryName) ||
      !isText(value.servingDescription) || !Array.isArray(value.items) || value.items.length === 0 ||
      !Array.isArray(value.assumptions) || !value.assumptions.every(isText) ||
      !Array.isArray(value.warnings) || !value.warnings.every(isText) || typeof value.needsUserReview !== 'boolean') return null;

  const items: PhotoEstimateItem[] = [];
  for (const item of value.items) {
    if (!isRecord(item) || !isText(item.name) || !isText(item.portionEstimate) || !isConfidence(item.confidence)) return null;
    const nutrition = normalizeNutrition(item);
    if (!nutrition) return null;
    items.push({ name: item.name, portionEstimate: item.portionEstimate, confidence: item.confidence, ...nutrition });
  }
  const totals = normalizeNutrition(value.totals);
  if (!totals) return null;
  return {
    analysisId: value.analysisId,
    createdAt: value.createdAt,
    overallConfidence: value.overallConfidence,
    summaryName: value.summaryName,
    servingDescription: value.servingDescription,
    items,
    totals,
    assumptions: [...value.assumptions],
    warnings: [...value.warnings],
    needsUserReview: value.needsUserReview,
  };
}

export function photoEstimateToLogEntry(estimate: PhotoFoodEstimate, date: string): FoodLogEntry {
  const totals = estimate.totals;
  return {
    id: nanoid(), date, source: 'photo-estimate', sourceType: 'photo-estimate',
    name: estimate.summaryName.trim(), servingSize: estimate.servingDescription.trim(), servingMultiplier: 1,
    calories: safeNonNegative(totals.calories), proteinG: safeNonNegative(totals.protein),
    fatG: safeNonNegative(totals.fat), totalCarbsG: safeNonNegative(totals.totalCarbs),
    fibreG: safeNonNegative(totals.fibre), sugarAlcoholsG: safeNonNegative(totals.sugarAlcohols),
    sodiumMg: safeNonNegative(totals.sodium), potassiumMg: safeNonNegative(totals.potassium),
    magnesiumMg: safeNonNegative(totals.magnesium), calciumMg: totals.calciumMg,
    ironMg: totals.ironMg, zincMg: totals.zincMg, vitaminDMcg: totals.vitaminDMcg,
    vitaminB12Mcg: totals.vitaminB12Mcg, omega3G: totals.omega3G, omega6G: totals.omega6G,
    confidence: estimate.overallConfidence, assumptions: [...estimate.assumptions],
    loggedAt: new Date().toISOString(),
  };
}

export function updateEstimateNutrition(estimate: PhotoFoodEstimate, updates: Partial<PhotoEstimateNutrition>): PhotoFoodEstimate {
  const totals = { ...estimate.totals, ...updates };
  totals.netCarbs = calcNetCarbs(totals.totalCarbs, totals.fibre, totals.sugarAlcohols);
  return { ...estimate, totals };
}
