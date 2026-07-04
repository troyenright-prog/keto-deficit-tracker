import type { DailyNutritionSummary, FoodLogEntry, NutritionTargets, UserProfile } from '../types';
import { MICRONUTRIENT_KEYS, type MicronutrientKey } from './micronutrients';
import { FIBRE_TARGET_G, NUTRIENT_HINT_CATALOGUE, type HintNutrientKey, type NutrientHintDef } from './nutrient-catalogue';
import { getRdaForAgeSex } from './rda';

export type NutritionHintKind = 'low' | 'high' | 'data-caveat';

export interface NutritionHint {
  id: string;
  kind: NutritionHintKind;
  title: string;
  reason: string;
  advice: string;
  caveat?: string;
}

const SUPPLEMENT_KEYWORDS = ['multivitamin', 'multi-vitamin', 'vitamin', 'supplement', 'tablet', 'capsule', 'softgel', 'gummies', 'gummy'];
const DAIRY_KEYWORDS = ['cheese', 'halloumi', 'haloumi', 'feta', 'parmesan', 'cheddar', 'mozzarella', 'yoghurt', 'yogurt', 'milk', 'dairy'];

// Entries substantial enough that a missing micronutrient field is likely a
// database gap, not the food genuinely containing none (see the steak/B12
// example in the feature spec).
function isSubstantialEntry(entry: FoodLogEntry): boolean {
  return entry.calories >= 50 || entry.proteinG >= 5 || entry.fatG >= 5;
}

function lowerFirst(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatAmount(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

function shareFromKeywords(entries: FoodLogEntry[], key: HintNutrientKey, keywords: string[]): number {
  let total = 0;
  let matched = 0;
  for (const entry of entries) {
    const amount = (entry as unknown as Record<string, number | undefined>)[key] ?? 0;
    total += amount;
    if (keywords.some((word) => entry.name.toLowerCase().includes(word))) matched += amount;
  }
  return total > 0 ? matched / total : 0;
}

function dataCoverage(entries: FoodLogEntry[], key: MicronutrientKey): number {
  const substantial = entries.filter(isSubstantialEntry);
  if (substantial.length === 0) return 1;
  const covered = substantial.filter((entry) => entry[key] !== undefined).length;
  return covered / substantial.length;
}

interface Candidate {
  hint: NutritionHint;
  score: number;
}

function targetFor(def: NutrientHintDef, targets: NutritionTargets, rdaFallback: Record<MicronutrientKey, number>): number {
  if (def.key === 'fibreG') return FIBRE_TARGET_G;
  if (def.key === 'proteinG' || def.key === 'sodiumMg' || def.key === 'potassiumMg' || def.key === 'magnesiumMg') {
    return targets[def.key];
  }
  const micronutrientKey = def.key as MicronutrientKey;
  const configured = targets[micronutrientKey];
  return configured && configured > 0 ? configured : (rdaFallback[micronutrientKey] ?? 0);
}

function buildLowCandidate(
  def: NutrientHintDef,
  value: number,
  target: number,
  ratio: number,
  dayEntries: FoodLogEntry[],
): Candidate | undefined {
  if (!def.lowRatio || ratio >= def.lowRatio) return undefined;

  const isMicronutrient = (MICRONUTRIENT_KEYS as readonly string[]).includes(def.key);
  const coverage = isMicronutrient ? dataCoverage(dayEntries, def.key as MicronutrientKey) : 1;
  const hasSubstantialEntries = dayEntries.some(isSubstantialEntry);
  const lowConfidence = isMicronutrient && hasSubstantialEntries && coverage < 0.5;

  const reason = `Logged: ${formatAmount(value, def.decimals)} ${def.unit} / ${formatAmount(target, def.decimals)} ${def.unit}`;
  const advice = `Try: ${def.lowSuggestion}`;
  const magnitude = Math.min(1, def.lowRatio - ratio) * 10;

  if (lowConfidence) {
    return {
      score: def.priority * 0.5 + magnitude,
      hint: {
        id: `${def.key}-data-caveat`,
        kind: 'data-caveat',
        title: `Possibly low ${lowerFirst(def.label)}`,
        reason,
        advice,
        caveat: 'Some logged foods may have incomplete micronutrient data, so this may be an underestimate.',
      },
    };
  }

  return {
    score: def.priority + magnitude,
    hint: { id: `${def.key}-low`, kind: 'low', title: `Low ${lowerFirst(def.label)}`, reason, advice },
  };
}

function buildHighCandidate(
  def: NutrientHintDef,
  value: number,
  target: number,
  ratio: number,
  dayEntries: FoodLogEntry[],
): Candidate | undefined {
  if (!def.highRatio || ratio <= def.highRatio || !def.highCaution) return undefined;

  if (def.requiresDriverForHigh) {
    const keywords = def.requiresDriverForHigh === 'supplement' ? SUPPLEMENT_KEYWORDS : DAIRY_KEYWORDS;
    const threshold = def.requiresDriverForHigh === 'supplement' ? 0.5 : 0.35;
    if (shareFromKeywords(dayEntries, def.key, keywords) < threshold) return undefined;
  }

  const reason = `Logged: ${formatAmount(value, def.decimals)} ${def.unit} / ${formatAmount(target, def.decimals)} ${def.unit} target`;
  const magnitude = Math.min(3, ratio - def.highRatio) * 5;
  return {
    score: def.priority + magnitude,
    hint: { id: `${def.key}-high`, kind: 'high', title: `High ${lowerFirst(def.label)}`, reason, advice: capitalize(def.highCaution) },
  };
}

function buildCaloriesHighEarlyCandidate(summary: DailyNutritionSummary, targets: NutritionTargets, now: Date): Candidate | undefined {
  const hour = now.getHours();
  if (hour >= 18 || targets.calories <= 0) return undefined;
  if (summary.calories < targets.calories * 0.9) return undefined;
  return {
    score: 50,
    hint: {
      id: 'calories-high-early',
      kind: 'high',
      title: 'Calories close to target already',
      reason: `Logged: ${Math.round(summary.calories)} / ${targets.calories} kcal, still early in the day`,
      advice: 'Choose leaner protein (chicken breast, white fish, or eggs) for the rest of the day.',
    },
  };
}

export function buildNutritionHints(
  summary: DailyNutritionSummary,
  targets: NutritionTargets,
  entries: FoodLogEntry[],
  profile?: Pick<UserProfile, 'age' | 'sex'>,
  now = new Date(),
): NutritionHint[] {
  if (summary.entryCount === 0) return [];

  const dayEntries = entries.filter((entry) => entry.date === summary.date);
  const rdaFallback = getRdaForAgeSex(profile?.age ?? 30, profile?.sex ?? 'male');
  const candidates: Candidate[] = [];

  for (const def of NUTRIENT_HINT_CATALOGUE) {
    if (def.priority <= 0) continue;
    const target = targetFor(def, targets, rdaFallback);
    if (target <= 0) continue;
    const value = (summary as unknown as Record<string, number | undefined>)[def.key] ?? 0;
    const ratio = value / target;

    const low = buildLowCandidate(def, value, target, ratio, dayEntries);
    if (low) { candidates.push(low); continue; }
    const high = buildHighCandidate(def, value, target, ratio, dayEntries);
    if (high) candidates.push(high);
  }

  const caloriesHighEarly = buildCaloriesHighEarlyCandidate(summary, targets, now);
  if (caloriesHighEarly) candidates.push(caloriesHighEarly);

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((candidate) => candidate.hint);
}
