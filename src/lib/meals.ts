import type { FoodLogEntry, MealSlot } from '../types';

export const MEAL_SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
];

export function isMealSlot(value: unknown): value is MealSlot {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack';
}

export function inferMealSlot(date = new Date()): MealSlot {
  const hour = date.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export function entryMeal(entry: Pick<FoodLogEntry, 'meal'>): MealSlot {
  return isMealSlot(entry.meal) ? entry.meal : 'snack';
}

export function mealLabel(meal: MealSlot): string {
  return MEAL_SLOTS.find((slot) => slot.id === meal)?.label ?? 'Snack';
}
