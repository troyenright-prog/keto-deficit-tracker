import type { BarcodeFood } from './barcode';
import type { FoodDatabaseItem, FoodItem } from '../types';
import { calcNetCarbs } from './nutrition';
import { nanoid } from './nanoid';

const MICRO_KEYS = ['calciumMg', 'ironMg', 'zincMg', 'vitaminDMcg', 'vitaminB12Mcg', 'omega3G', 'omega6G'] as const;

function barcodeFoodSource(food: BarcodeFood, userEdited: boolean): FoodDatabaseItem['source'] {
  if (userEdited) return 'barcode';
  if (food.attribution === 'USDA FoodData Central') return 'foodDataCentral';
  return 'openFoodFacts';
}

export function foodDatabaseSignature(item: Pick<FoodDatabaseItem | FoodItem, 'name' | 'servingSize'>): string {
  return `${item.name.trim().toLowerCase()}|${item.servingSize.trim().toLowerCase()}`;
}

export function findFoodDatabaseByBarcode(items: FoodDatabaseItem[], barcode: string): FoodDatabaseItem | undefined {
  return items.find((item) => item.barcode === barcode);
}

export function foodDatabaseItemToSavedFood(item: FoodDatabaseItem): FoodItem {
  const food: FoodItem = {
    id: item.id,
    barcode: item.barcode,
    name: item.brand && !item.name.includes(`(${item.brand})`) ? `${item.name} (${item.brand})` : item.name,
    servingSize: item.servingSize,
    calories: item.calories,
    proteinG: item.proteinG,
    fatG: item.fatG,
    totalCarbsG: item.totalCarbsG,
    fibreG: item.fibreG,
    sugarAlcoholsG: item.sugarAlcoholsG,
    sodiumMg: item.sodiumMg,
    potassiumMg: item.potassiumMg,
    magnesiumMg: item.magnesiumMg,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    isFavourite: false,
  };
  for (const key of MICRO_KEYS) {
    if (item[key] !== undefined) food[key] = item[key];
  }
  return food;
}

export function savedFoodToFoodDatabaseItem(food: FoodItem, existing?: FoodDatabaseItem): FoodDatabaseItem {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? food.id,
    barcode: food.barcode,
    name: food.name,
    brand: existing?.brand,
    source: food.barcode ? 'barcode' : 'manual',
    servingSize: food.servingSize,
    calories: food.calories,
    proteinG: food.proteinG,
    fatG: food.fatG,
    totalCarbsG: food.totalCarbsG,
    fibreG: food.fibreG,
    sugarAlcoholsG: food.sugarAlcoholsG,
    netCarbsG: calcNetCarbs(food.totalCarbsG, food.fibreG, food.sugarAlcoholsG),
    sodiumMg: food.sodiumMg,
    potassiumMg: food.potassiumMg,
    magnesiumMg: food.magnesiumMg,
    calciumMg: food.calciumMg,
    ironMg: food.ironMg,
    zincMg: food.zincMg,
    vitaminDMcg: food.vitaminDMcg,
    vitaminB12Mcg: food.vitaminB12Mcg,
    omega3G: food.omega3G,
    omega6G: food.omega6G,
    verified: existing?.verified,
    userEdited: existing?.userEdited ?? false,
    createdAt: existing?.createdAt ?? food.createdAt ?? now,
    updatedAt: now,
  };
}

export function barcodeFoodToFoodDatabaseItem(food: BarcodeFood, existing?: FoodDatabaseItem, userEdited = false): FoodDatabaseItem {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? nanoid(),
    barcode: food.barcode,
    name: food.name,
    brand: food.brand,
    source: barcodeFoodSource(food, userEdited),
    servingSize: food.servingSize,
    calories: food.calories,
    proteinG: food.proteinG,
    fatG: food.fatG,
    totalCarbsG: food.totalCarbsG,
    fibreG: food.fibreG,
    sugarAlcoholsG: food.sugarAlcoholsG,
    netCarbsG: calcNetCarbs(food.totalCarbsG, food.fibreG, food.sugarAlcoholsG),
    sodiumMg: food.sodiumMg,
    potassiumMg: food.potassiumMg,
    magnesiumMg: food.magnesiumMg,
    calciumMg: food.calciumMg,
    ironMg: food.ironMg,
    zincMg: food.zincMg,
    vitaminDMcg: food.vitaminDMcg,
    vitaminB12Mcg: food.vitaminB12Mcg,
    omega3G: food.omega3G,
    omega6G: food.omega6G,
    verified: existing?.verified ?? false,
    userEdited: existing?.userEdited || userEdited,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function foodDatabaseItemToBarcodeFood(item: FoodDatabaseItem): BarcodeFood {
  return {
    barcode: item.barcode ?? '',
    name: item.name,
    brand: item.brand,
    servingSize: item.servingSize,
    dataBasis: 'serving',
    calories: item.calories,
    proteinG: item.proteinG,
    fatG: item.fatG,
    totalCarbsG: item.totalCarbsG,
    fibreG: item.fibreG,
    sugarAlcoholsG: item.sugarAlcoholsG,
    sodiumMg: item.sodiumMg,
    potassiumMg: item.potassiumMg,
    magnesiumMg: item.magnesiumMg,
    calciumMg: item.calciumMg,
    ironMg: item.ironMg,
    zincMg: item.zincMg,
    vitaminDMcg: item.vitaminDMcg,
    vitaminB12Mcg: item.vitaminB12Mcg,
    omega3G: item.omega3G,
    omega6G: item.omega6G,
  };
}

export function upsertFoodDatabaseItem(items: FoodDatabaseItem[], item: FoodDatabaseItem): FoodDatabaseItem[] {
  const existingIndex = items.findIndex((candidate) =>
    (item.barcode && candidate.barcode === item.barcode) ||
    (!item.barcode && foodDatabaseSignature(candidate) === foodDatabaseSignature(item))
  );
  if (existingIndex < 0) return [...items, item];

  const existing = items[existingIndex];
  const shouldKeepExisting = existing.userEdited && !item.userEdited;
  const next = [...items];
  next[existingIndex] = shouldKeepExisting ? existing : {
    ...item,
    id: existing.id,
    createdAt: existing.createdAt,
    userEdited: existing.userEdited || item.userEdited,
  };
  return next;
}

export function dedupeFoodDatabase(items: FoodDatabaseItem[]): FoodDatabaseItem[] {
  return items.reduce<FoodDatabaseItem[]>((result, item) => upsertFoodDatabaseItem(result, item), []);
}
