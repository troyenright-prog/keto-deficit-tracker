export interface MacroMassInput {
  servingSize: string;
  proteinG: number;
  fatG: number;
  totalCarbsG: number;
}

/**
 * Extract the labelled mass from serving strings such as "40g",
 * "1 wafer (40 g)", or "0.04 kg". Volume servings are deliberately ignored:
 * comparing millilitres with nutrient grams would require knowing density.
 */
export function servingWeightGrams(servingSize: string): number | null {
  const matches = [...servingSize.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/gi)];
  if (matches.length === 0) return null;

  const match = matches[matches.length - 1];
  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return match[2].toLowerCase() === 'kg' ? amount * 1000 : amount;
}

/**
 * Returns a blocking validation message when the three energy-bearing macro
 * weights physically cannot fit in the labelled serving. A 10% / 2 g
 * allowance avoids false positives from nutrition-label rounding.
 */
export function implausibleMacroMassMessage(input: MacroMassInput): string | null {
  const servingWeight = servingWeightGrams(input.servingSize);
  if (servingWeight === null) return null;

  const macros = [input.proteinG, input.fatG, input.totalCarbsG]
    .map((value) => Number.isFinite(value) ? Math.max(0, value) : 0)
    .reduce((sum, value) => sum + value, 0);
  const allowance = Math.max(2, servingWeight * 0.1);
  if (macros <= servingWeight + allowance) return null;

  return `Protein, fat, and carbs total ${macros.toFixed(1)}g, which cannot fit in a ${servingWeight.toFixed(1)}g serving. Check the serving size and nutrition label.`;
}
