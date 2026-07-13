import type { Micronutrients } from '../types';

export type MicronutrientKey = keyof Micronutrients;

export interface MicronutrientField {
  key: MicronutrientKey;
  label: string;
  unit: 'mg' | 'mcg' | 'g';
  decimals: number;
  group: 'minerals' | 'vitamins' | 'fats';
}

export const MICRONUTRIENT_FIELDS = [
  { key: 'calciumMg', label: 'Calcium', unit: 'mg', decimals: 1, group: 'minerals' },
  { key: 'phosphorusMg', label: 'Phosphorus', unit: 'mg', decimals: 1, group: 'minerals' },
  { key: 'ironMg', label: 'Iron', unit: 'mg', decimals: 1, group: 'minerals' },
  { key: 'zincMg', label: 'Zinc', unit: 'mg', decimals: 1, group: 'minerals' },
  { key: 'copperMg', label: 'Copper', unit: 'mg', decimals: 2, group: 'minerals' },
  { key: 'manganeseMg', label: 'Manganese', unit: 'mg', decimals: 2, group: 'minerals' },
  { key: 'iodineMcg', label: 'Iodine', unit: 'mcg', decimals: 1, group: 'minerals' },
  { key: 'seleniumMcg', label: 'Selenium', unit: 'mcg', decimals: 1, group: 'minerals' },
  { key: 'vitaminAMcg', label: 'Vitamin A', unit: 'mcg', decimals: 1, group: 'vitamins' },
  { key: 'vitaminCMg', label: 'Vitamin C', unit: 'mg', decimals: 1, group: 'vitamins' },
  { key: 'vitaminDMcg', label: 'Vitamin D', unit: 'mcg', decimals: 1, group: 'vitamins' },
  { key: 'vitaminEMg', label: 'Vitamin E', unit: 'mg', decimals: 1, group: 'vitamins' },
  { key: 'vitaminKMcg', label: 'Vitamin K', unit: 'mcg', decimals: 1, group: 'vitamins' },
  { key: 'thiaminMg', label: 'B1 thiamin', unit: 'mg', decimals: 2, group: 'vitamins' },
  { key: 'riboflavinMg', label: 'B2 riboflavin', unit: 'mg', decimals: 2, group: 'vitamins' },
  { key: 'niacinMg', label: 'B3 niacin', unit: 'mg', decimals: 1, group: 'vitamins' },
  { key: 'pantothenicAcidMg', label: 'B5 pantothenic acid', unit: 'mg', decimals: 1, group: 'vitamins' },
  { key: 'vitaminB6Mg', label: 'Vitamin B6', unit: 'mg', decimals: 2, group: 'vitamins' },
  { key: 'biotinMcg', label: 'B7 biotin', unit: 'mcg', decimals: 1, group: 'vitamins' },
  { key: 'folateMcg', label: 'Folate', unit: 'mcg', decimals: 1, group: 'vitamins' },
  { key: 'vitaminB12Mcg', label: 'Vitamin B12', unit: 'mcg', decimals: 1, group: 'vitamins' },
  { key: 'cholineMg', label: 'Choline', unit: 'mg', decimals: 1, group: 'vitamins' },
  { key: 'saturatedFatG', label: 'Saturated fat', unit: 'g', decimals: 1, group: 'fats' },
  { key: 'omega3G', label: 'Omega-3', unit: 'g', decimals: 2, group: 'fats' },
  { key: 'omega6G', label: 'Omega-6', unit: 'g', decimals: 2, group: 'fats' },
] as const satisfies readonly MicronutrientField[];

export const MICRONUTRIENT_KEYS = MICRONUTRIENT_FIELDS.map((field) => field.key) as MicronutrientKey[];

type MicronutrientProbe = Partial<Record<MicronutrientKey, number | undefined>>;

function validAmount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function pickMicronutrients(source: MicronutrientProbe): Micronutrients {
  const result: Micronutrients = {};
  for (const key of MICRONUTRIENT_KEYS) {
    const value = validAmount(source[key]);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

export function zeroMicronutrients(): Record<MicronutrientKey, number> {
  return MICRONUTRIENT_KEYS.reduce((result, key) => {
    result[key] = 0;
    return result;
  }, {} as Record<MicronutrientKey, number>);
}

export function scaleMicronutrients(source: MicronutrientProbe, multiplier: number): Micronutrients {
  const amount = Number.isFinite(multiplier) && multiplier >= 0 ? multiplier : 0;
  const result: Micronutrients = {};
  for (const key of MICRONUTRIENT_KEYS) {
    const value = validAmount(source[key]);
    if (value !== undefined) result[key] = value * amount;
  }
  return result;
}

export function hasAnyMicronutrients(source: MicronutrientProbe): boolean {
  return MICRONUTRIENT_KEYS.some((key) => (source[key] ?? 0) > 0);
}

export function formatMicronutrientAmount(field: MicronutrientField, value: number): string {
  return `${value.toFixed(field.decimals)}${field.unit}`;
}
