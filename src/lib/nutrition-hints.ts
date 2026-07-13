import type { DailyNutritionSummary, FoodLogEntry, MealPlanEntry, Micronutrients, NutritionTargets, UserProfile } from '../types';
import { MICRONUTRIENT_KEYS, type MicronutrientKey } from './micronutrients';
import { FIBRE_TARGET_G, NUTRIENT_HINT_CATALOGUE, type HintNutrientKey, type NutrientHintDef } from './nutrient-catalogue';
import { getRdaForAgeSex } from './rda';

export type HintSeverity = 'low' | 'high' | 'caution' | 'nextMeal';
export type HintConfidence = 'high' | 'medium' | 'low';
export type HintTimeframe = 'today' | 'repeated';

export interface NutritionHint {
  id: string;
  nutrientKey: HintNutrientKey | 'meal' | 'calories';
  severity: HintSeverity;
  confidence: HintConfidence;
  title: string;
  reason: string;
  suggestions: string[];
  likelyDrivers: string[];
  caveat?: string;
  priorityScore: number;
  timeframe: HintTimeframe;
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

// Fraction of a nutrient's daily total contributed by entries whose name
// matches the given keywords, plus the matching entry names themselves (for
// likelyDrivers / requiresDriverForHigh gating).
function driversFromKeywords(
  entries: FoodLogEntry[],
  key: HintNutrientKey,
  keywords: string[],
): { share: number; names: string[] } {
  let total = 0;
  let matched = 0;
  const names = new Set<string>();
  for (const entry of entries) {
    const amount = (entry as unknown as Record<string, number | undefined>)[key] ?? 0;
    total += amount;
    if (keywords.some((word) => entry.name.toLowerCase().includes(word))) {
      matched += amount;
      if (amount > 0) names.add(entry.name);
    }
  }
  return { share: total > 0 ? matched / total : 0, names: [...names] };
}

// Coverage = fraction of "substantial" (real, calorie-bearing) entries that
// actually reported this micronutrient field, vs. left it undefined. Low
// coverage means a "low" reading is more likely a database gap than a true
// deficiency — see confidenceFor().
function dataCoverage(entries: FoodLogEntry[], key: MicronutrientKey): number {
  const substantial = entries.filter(isSubstantialEntry);
  if (substantial.length === 0) return 1;
  const covered = substantial.filter((entry) => entry[key] !== undefined).length;
  return covered / substantial.length;
}

function confidenceFor(def: NutrientHintDef, dayEntries: FoodLogEntry[]): HintConfidence {
  const isMicronutrient = (MICRONUTRIENT_KEYS as readonly string[]).includes(def.key);
  if (!isMicronutrient) return 'high'; // macros/electrolytes are core required fields, never left undefined
  if (!dayEntries.some(isSubstantialEntry)) return 'high'; // nothing substantial logged to doubt
  const coverage = dataCoverage(dayEntries, def.key as MicronutrientKey);
  if (coverage >= 0.8) return 'high';
  if (coverage >= 0.4) return 'medium';
  return 'low';
}

const INCOMPLETE_DATA_CAVEAT = 'Some logged foods may have incomplete micronutrient data, so this is an estimate.';

// Planned-but-not-yet-logged meals for the day. Planned food is never added to
// logged totals — it only softens "low so far" warnings that the plan itself
// would resolve (e.g. don't warn about protein when a steak is planned).
interface PlannedContext {
  entries: MealPlanEntry[];
}

function plannedForDay(mealPlan: MealPlanEntry[] | undefined, date: string): PlannedContext {
  return { entries: (mealPlan ?? []).filter((entry) => entry.date === date && !entry.converted) };
}

function plannedAmount(planned: PlannedContext, key: HintNutrientKey): { amount: number; names: string[] } {
  let amount = 0;
  const names: string[] = [];
  for (const entry of planned.entries) {
    const value = (entry as unknown as Record<string, number | undefined>)[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      amount += value;
      names.push(entry.name);
    }
  }
  return { amount, names };
}

interface Candidate {
  hint: NutritionHint;
  score: number;
}

function targetFor(def: NutrientHintDef, targets: NutritionTargets, rdaFallback: Micronutrients): number {
  if (def.key === 'fibreG') return FIBRE_TARGET_G;
  if (def.key === 'proteinG' || def.key === 'sodiumMg' || def.key === 'potassiumMg' || def.key === 'magnesiumMg') {
    return targets[def.key];
  }
  const micronutrientKey = def.key as MicronutrientKey;
  const configured = targets[micronutrientKey];
  return configured && configured > 0 ? configured : (rdaFallback[micronutrientKey] ?? 0);
}

// Was this nutrient also low on most of the recent tracked days (excluding
// today)? Powers the "today" vs. "repeated" distinction — a future-ready hook
// into rolling history without building a full trend system here.
function repeatedLowTimeframe(
  def: NutrientHintDef,
  target: number,
  today: string,
  recentSummaries: DailyNutritionSummary[] | undefined,
): HintTimeframe {
  if (!recentSummaries || target <= 0) return 'today';
  const priorDays = recentSummaries.filter((s) => s.date !== today && s.entryCount > 0);
  if (priorDays.length < 2) return 'today';
  const lowCount = priorDays.filter((s) => {
    const value = (s as unknown as Record<string, number | undefined>)[def.key] ?? 0;
    return value / target < (def.lowRatio ?? 0.5);
  }).length;
  return lowCount >= Math.ceil(priorDays.length / 2) ? 'repeated' : 'today';
}

function buildLowCandidate(
  def: NutrientHintDef,
  value: number,
  target: number,
  ratio: number,
  dayEntries: FoodLogEntry[],
  today: string,
  recentSummaries: DailyNutritionSummary[] | undefined,
  planned: PlannedContext,
): Candidate | undefined {
  if (!def.lowRatio || ratio >= def.lowRatio) return undefined;

  const confidence = confidenceFor(def, dayEntries);
  const timeframe = repeatedLowTimeframe(def, target, today, recentSummaries);
  const reason = `Logged: ${formatAmount(value, def.decimals)} ${def.unit} / ${formatAmount(target, def.decimals)} ${def.unit}`;

  // If today's still-planned meals would lift this nutrient out of the low
  // zone, say that instead of warning as if the day were over.
  const plan = plannedAmount(planned, def.key);
  const planCoversLow = plan.amount > 0 && (value + plan.amount) / target >= def.lowRatio;
  if (planCoversLow) {
    return {
      // Softened score: an on-plan day shouldn't outrank genuinely open gaps.
      score: (def.priority + Math.min(1, def.lowRatio - ratio) * 10) * 0.5,
      hint: {
        id: `${def.key}-low-planned`,
        nutrientKey: def.key,
        severity: 'low',
        confidence,
        title: `${def.label} is low so far, but your plan should cover it`,
        reason,
        suggestions: [
          `Planned: ${plan.names.join(', ')} adds about ${formatAmount(plan.amount, def.decimals)} ${def.unit}, which should improve this once eaten and logged.`,
        ],
        likelyDrivers: [],
        caveat: confidence === 'high' ? undefined : INCOMPLETE_DATA_CAVEAT,
        priorityScore: def.priority,
        timeframe,
      },
    };
  }

  const suggestions = [`Try: ${def.lowSuggestion}`];
  if (def.supplementNote) suggestions.push(`Optional: ${def.supplementNote}`);

  const title = confidence === 'high' ? `Low ${lowerFirst(def.label)}` : `${def.label} appears low`;
  const magnitude = Math.min(1, def.lowRatio - ratio) * 10;
  // Uncertain readings are still worth surfacing, but shouldn't crowd out
  // confident ones for one of the limited hint slots.
  const confidencePenalty = confidence === 'high' ? 1 : confidence === 'medium' ? 0.8 : 0.5;

  return {
    score: (def.priority + magnitude) * confidencePenalty,
    hint: {
      id: `${def.key}-low`,
      nutrientKey: def.key,
      severity: 'low',
      confidence,
      title,
      reason,
      suggestions,
      likelyDrivers: [],
      caveat: confidence === 'high' ? undefined : INCOMPLETE_DATA_CAVEAT,
      priorityScore: def.priority,
      timeframe,
    },
  };
}

function buildHighCandidate(
  def: NutrientHintDef,
  value: number,
  target: number,
  ratio: number,
  dayEntries: FoodLogEntry[],
  today: string,
  recentSummaries: DailyNutritionSummary[] | undefined,
): Candidate | undefined {
  if (!def.highRatio || ratio <= def.highRatio || !def.highCaution) return undefined;

  let likelyDrivers: string[] = [];
  if (def.requiresDriverForHigh) {
    const keywords = def.requiresDriverForHigh === 'supplement' ? SUPPLEMENT_KEYWORDS : DAIRY_KEYWORDS;
    const threshold = def.requiresDriverForHigh === 'supplement' ? 0.5 : 0.35;
    const drivers = driversFromKeywords(dayEntries, def.key, keywords);
    if (drivers.share < threshold) return undefined;
    likelyDrivers = drivers.names;
  }

  const reason = `Logged: ${formatAmount(value, def.decimals)} ${def.unit} / ${formatAmount(target, def.decimals)} ${def.unit} target`;
  const magnitude = Math.min(3, ratio - def.highRatio) * 5;
  const timeframe = repeatedLowTimeframe(def, target, today, recentSummaries) === 'repeated' ? 'repeated' : 'today';
  return {
    score: def.priority + magnitude,
    hint: {
      id: `${def.key}-high`,
      nutrientKey: def.key,
      severity: 'high',
      confidence: 'high', // the logged total itself is real data, only attribution is a guess
      title: `High ${lowerFirst(def.label)}`,
      reason,
      suggestions: [capitalize(def.highCaution)],
      likelyDrivers,
      priorityScore: def.priority,
      timeframe,
    },
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
      nutrientKey: 'calories',
      severity: 'caution',
      confidence: 'high',
      title: 'Calories close to target already',
      reason: `Logged: ${Math.round(summary.calories)} / ${targets.calories} kcal, still early in the day`,
      suggestions: ['Choose leaner protein (chicken breast, white fish, or eggs) for the rest of the day.'],
      likelyDrivers: [],
      priorityScore: 50,
      timeframe: 'today',
    },
  };
}

// Suggests what kind of next meal would close the protein gap while also
// pairing in whichever tracked nutrients are currently running low — not a
// meal planner, just a one-line steer using the day's own low-nutrient list.
function buildNextMealCandidate(
  summary: DailyNutritionSummary,
  targets: NutritionTargets,
  lowKeys: Set<HintNutrientKey>,
  planned: PlannedContext,
): Candidate | undefined {
  if (targets.proteinG <= 0 || targets.calories <= 0) return undefined;
  const proteinGap = targets.proteinG - summary.proteinG;
  const remainingCal = targets.calories - summary.calories;
  if (proteinGap < targets.proteinG * 0.2 || remainingCal < 150) return undefined;

  // If planned meals already close most of the protein gap, steer to the plan
  // instead of suggesting a generic protein meal on top of it.
  const plannedProtein = plannedAmount(planned, 'proteinG');
  if (plannedProtein.amount >= proteinGap * 0.8) {
    return {
      score: 60,
      hint: {
        id: 'next-meal-planned',
        nutrientKey: 'meal',
        severity: 'nextMeal',
        confidence: 'high',
        title: 'Protein is behind, but your planned meals should close the gap',
        reason: `${Math.round(proteinGap)}g protein remaining; planned ${plannedProtein.names.join(', ')} adds about ${Math.round(plannedProtein.amount)}g`,
        suggestions: ['Stick with the plan — log the meal once eaten so totals stay accurate.'],
        likelyDrivers: [],
        priorityScore: 60,
        timeframe: 'today',
      },
    };
  }

  const greensPairing: string[] = [];
  if (lowKeys.has('potassiumMg')) greensPairing.push('potassium');
  if (lowKeys.has('fibreG')) greensPairing.push('fibre');
  if (lowKeys.has('vitaminKMcg')) greensPairing.push('vitamin K');

  const proteinSuggestion = 'Steak, chicken, eggs, or fish would help close the protein gap.';
  const suggestions = [proteinSuggestion];
  if (greensPairing.length > 0) {
    suggestions.push(`Add avocado, spinach, or leafy greens too, for ${greensPairing.join(', ')}.`);
  }
  if (lowKeys.has('omega3G')) {
    suggestions.push('Salmon or sardines would also help top up omega-3.');
  }
  const pairingNutrients = [...greensPairing, ...(lowKeys.has('omega3G') ? ['omega-3'] : [])];

  return {
    score: 70,
    hint: {
      id: 'next-meal',
      nutrientKey: 'meal',
      severity: 'nextMeal',
      confidence: 'high',
      title: pairingNutrients.length > 0 ? 'Next meal: cover protein, then top up what\'s low' : 'Next meal: protein is still behind',
      reason: `${Math.round(proteinGap)}g protein and ${Math.round(remainingCal)} kcal remaining today`,
      suggestions,
      likelyDrivers: [],
      priorityScore: 70,
      timeframe: 'today',
    },
  };
}

export function buildNutritionHints(
  summary: DailyNutritionSummary,
  targets: NutritionTargets,
  entries: FoodLogEntry[],
  profile?: Pick<UserProfile, 'age' | 'sex'>,
  now = new Date(),
  recentSummaries?: DailyNutritionSummary[],
  mealPlan?: MealPlanEntry[],
): NutritionHint[] {
  if (summary.entryCount === 0) return [];

  const dayEntries = entries.filter((entry) => entry.date === summary.date);
  const planned = plannedForDay(mealPlan, summary.date);
  const rdaFallback = getRdaForAgeSex(profile?.age ?? 30, profile?.sex ?? 'male');
  const candidates: Candidate[] = [];
  const lowKeys = new Set<HintNutrientKey>();

  for (const def of NUTRIENT_HINT_CATALOGUE) {
    if (def.priority <= 0) continue;
    const target = targetFor(def, targets, rdaFallback);
    if (target <= 0) continue;
    const value = (summary as unknown as Record<string, number | undefined>)[def.key] ?? 0;
    const ratio = value / target;

    const low = buildLowCandidate(def, value, target, ratio, dayEntries, summary.date, recentSummaries, planned);
    if (low) {
      candidates.push(low);
      // A plan-covered nutrient isn't an open gap, so it shouldn't steer the
      // next-meal pairing suggestions.
      if (!low.hint.id.endsWith('-low-planned')) lowKeys.add(def.key);
      continue;
    }
    const high = buildHighCandidate(def, value, target, ratio, dayEntries, summary.date, recentSummaries);
    if (high) candidates.push(high);
  }

  const caloriesHighEarly = buildCaloriesHighEarlyCandidate(summary, targets, now);
  if (caloriesHighEarly) candidates.push(caloriesHighEarly);

  const nextMeal = buildNextMealCandidate(summary, targets, lowKeys, planned);
  if (nextMeal) {
    candidates.push(nextMeal);
    // The planned next-meal card already says the plan covers protein — a
    // second "protein is low so far, but planned" card would repeat it.
    if (nextMeal.hint.id === 'next-meal-planned') {
      const duplicate = candidates.findIndex((c) => c.hint.id === 'proteinG-low-planned');
      if (duplicate !== -1) candidates.splice(duplicate, 1);
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((candidate) => candidate.hint);
}
