import type { FoodLogEntry } from '../types';

// Human label for where a logged entry's nutrition came from, so users can
// judge how much to trust the numbers (manual entry vs. a scanned database
// value). Older entries predate the `source` field — infer what we can from
// the ids they carry, otherwise show nothing rather than guessing.
export function entrySourceLabel(
  entry: Pick<FoodLogEntry, 'source' | 'barcode' | 'foodItemId' | 'templateId' | 'recipeId'>,
): string | undefined {
  switch (entry.source) {
    case 'manual': return 'Manual entry';
    case 'saved-food': return 'Saved food';
    case 'template': return 'Meal template';
    case 'recipe': return 'Recipe';
    case 'plan': return 'From plan';
    case 'barcode': return 'Scanned barcode';
  }
  if (entry.barcode) return 'Scanned barcode';
  if (entry.recipeId) return 'Recipe';
  if (entry.templateId) return 'Meal template';
  if (entry.foodItemId) return 'Saved food';
  return undefined;
}
