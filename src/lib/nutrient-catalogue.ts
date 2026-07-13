import type { MicronutrientKey } from './micronutrients';

// Central catalogue that drives the "What to fix next" hint engine (see
// nutrition-hints.ts). This is deliberately separate from MICRONUTRIENT_FIELDS
// in micronutrients.ts, which only controls unit/decimal formatting for the
// on-screen progress bars — this file adds the extra hint-only metadata
// (thresholds, food suggestions, caution copy) without touching that display
// logic.
export type HintNutrientKey = 'proteinG' | 'fibreG' | 'sodiumMg' | 'potassiumMg' | 'magnesiumMg' | MicronutrientKey;

export interface NutrientHintDef {
  key: HintNutrientKey;
  label: string;
  unit: string;
  decimals: number;
  // Ratio (logged / target) below which the nutrient counts as low. Omit to
  // never flag this nutrient as low.
  lowRatio?: number;
  // Ratio above which the nutrient counts as high. Omit to never flag this
  // nutrient as high (either because excess is harmless from food, or because
  // we only want to warn when a supplement/single food is clearly driving it
  // — see requiresDriverForHigh).
  highRatio?: number;
  // When true, a high hint only fires if a dominant contributor (a supplement
  // or a named food group) is identified — otherwise a high reading is too
  // easily a false positive from a single generous serving.
  requiresDriverForHigh?: 'supplement' | 'dairy';
  // Food-first suggestion, always shown first when this nutrient is low.
  lowSuggestion: string;
  // Secondary, softly-worded supplement mention — only set for nutrients
  // where a supplement is a reasonable optional add-on (magnesium, omega-3,
  // iodine, vitamin D). Never shown ahead of the food suggestion.
  supplementNote?: string;
  highCaution?: string;
  // Base ranking weight — higher surfaces first. See nutrition-hints.ts for
  // how this combines with how far off-target the day is.
  priority: number;
}

// General-wellness conservative thresholds, not medical advice. Where the app
// doesn't have a user-configurable target (fibre has no NutritionTargets
// field), a fixed fallback is used instead — see FIBRE_TARGET_G below.
export const FIBRE_TARGET_G = 25;

export const NUTRIENT_HINT_CATALOGUE: NutrientHintDef[] = [
  {
    key: 'potassiumMg', label: 'Potassium', unit: 'mg', decimals: 0, lowRatio: 0.5, priority: 100,
    lowSuggestion: 'avocado, spinach, mushrooms, salmon, or beef',
  },
  {
    key: 'magnesiumMg', label: 'Magnesium', unit: 'mg', decimals: 0, lowRatio: 0.5, priority: 98,
    lowSuggestion: 'spinach, pumpkin seeds, almonds, or dark chocolate',
    supplementNote: 'a magnesium glycinate supplement, if appropriate',
  },
  {
    key: 'sodiumMg', label: 'Sodium', unit: 'mg', decimals: 0, lowRatio: 0.5, highRatio: 1.3, priority: 92,
    lowSuggestion: 'bone broth, salted meat, pickles, or an electrolyte drink',
    highCaution: 'skip extra salty snacks, cured meats, or electrolyte sodium for the rest of today',
  },
  {
    key: 'proteinG', label: 'Protein', unit: 'g', decimals: 0, lowRatio: 0.7, priority: 85,
    lowSuggestion: 'chicken breast, eggs, tuna, salmon, lean beef, or Greek yoghurt',
  },
  {
    key: 'fibreG', label: 'Fibre', unit: 'g', decimals: 0, lowRatio: 0.6, priority: 80,
    lowSuggestion: 'avocado, chia seeds, psyllium husk, broccoli, zucchini, or leafy greens',
  },
  {
    key: 'omega3G', label: 'Omega-3', unit: 'g', decimals: 1, lowRatio: 0.5, priority: 75,
    lowSuggestion: 'salmon, sardines, or mackerel',
    supplementNote: 'a fish oil supplement, if appropriate',
  },
  {
    key: 'calciumMg', label: 'Calcium', unit: 'mg', decimals: 0, lowRatio: 0.5, highRatio: 1.5, requiresDriverForHigh: 'dairy', priority: 65,
    lowSuggestion: 'cheese, sardines with bones, leafy greens, or almonds',
    highCaution: 'mostly from cheese/dairy today — consider a lighter dairy day tomorrow',
  },
  {
    key: 'vitaminB6Mg', label: 'Vitamin B6', unit: 'mg', decimals: 1, lowRatio: 0.5, highRatio: 3, requiresDriverForHigh: 'supplement', priority: 60,
    lowSuggestion: 'salmon, chicken, beef, or avocado',
    highCaution: 'mainly from a multivitamin/supplement — avoid stacking extra B6 on top of it',
  },
  {
    key: 'zincMg', label: 'Zinc', unit: 'mg', decimals: 1, lowRatio: 0.5, highRatio: 2.5, requiresDriverForHigh: 'supplement', priority: 55,
    lowSuggestion: 'beef, lamb, pumpkin seeds, or oysters',
    highCaution: 'largely from a supplement — long-term high zinc can throw off copper balance, so avoid stacking more zinc',
  },
  {
    key: 'vitaminAMcg', label: 'Vitamin A', unit: 'mcg', decimals: 0, lowRatio: 0.5, highRatio: 3, requiresDriverForHigh: 'supplement', priority: 55,
    lowSuggestion: 'liver, eggs, leafy greens, or butter',
    highCaution: 'mainly from a supplement — high-dose vitamin A adds up over time, so avoid stacking more',
  },
  {
    key: 'seleniumMcg', label: 'Selenium', unit: 'mcg', decimals: 0, lowRatio: 0.5, highRatio: 3, priority: 50,
    lowSuggestion: 'brazil nuts, salmon, sardines, or eggs',
    highCaution: 'likely from brazil nuts or a supplement — easy to overshoot, so ease off tomorrow',
  },
  {
    key: 'ironMg', label: 'Iron', unit: 'mg', decimals: 1, lowRatio: 0.5, highRatio: 4, requiresDriverForHigh: 'supplement', priority: 45,
    lowSuggestion: 'beef, lamb, liver, spinach, or pumpkin seeds',
    highCaution: 'largely from a supplement — extra iron on top of a multivitamin usually is not needed unless prescribed',
  },
  {
    key: 'vitaminKMcg', label: 'Vitamin K', unit: 'mcg', decimals: 0, lowRatio: 0.5, priority: 40,
    lowSuggestion: 'spinach, kale, rocket, broccoli, or eggs',
  },
  {
    key: 'vitaminB12Mcg', label: 'Vitamin B12', unit: 'mcg', decimals: 1, lowRatio: 0.5, priority: 38,
    lowSuggestion: 'beef, salmon, eggs, or sardines',
  },
  {
    key: 'folateMcg', label: 'Folate', unit: 'mcg', decimals: 0, lowRatio: 0.5, priority: 36,
    lowSuggestion: 'leafy greens, avocado, broccoli, or eggs',
  },
  {
    key: 'cholineMg', label: 'Choline', unit: 'mg', decimals: 0, lowRatio: 0.5, priority: 35,
    lowSuggestion: 'eggs, liver, salmon, or beef',
  },
  {
    key: 'vitaminDMcg', label: 'Vitamin D', unit: 'mcg', decimals: 1, lowRatio: 0.5, priority: 34,
    lowSuggestion: 'salmon, sardines, or egg yolks',
    supplementNote: 'a vitamin D supplement in low-sun months, if appropriate',
  },
  {
    key: 'vitaminCMg', label: 'Vitamin C', unit: 'mg', decimals: 0, lowRatio: 0.5, priority: 32,
    lowSuggestion: 'capsicum, broccoli, brussels sprouts, or leafy greens',
  },
  {
    key: 'phosphorusMg', label: 'Phosphorus', unit: 'mg', decimals: 0, lowRatio: 0.5, priority: 30,
    lowSuggestion: 'meat, fish, eggs, dairy, or nuts',
  },
  {
    key: 'vitaminEMg', label: 'Vitamin E', unit: 'mg', decimals: 1, lowRatio: 0.5, priority: 28,
    lowSuggestion: 'almonds, sunflower seeds, or avocado',
  },
  {
    key: 'niacinMg', label: 'B3 niacin', unit: 'mg', decimals: 0, lowRatio: 0.5, priority: 26,
    lowSuggestion: 'chicken, tuna, salmon, or beef',
  },
  {
    key: 'iodineMcg', label: 'Iodine', unit: 'mcg', decimals: 0, lowRatio: 0.5, priority: 24,
    lowSuggestion: 'seafood, eggs, or iodised salt',
    supplementNote: 'an iodine supplement, if appropriate and checked against label doses',
  },
  {
    key: 'riboflavinMg', label: 'B2 riboflavin', unit: 'mg', decimals: 1, lowRatio: 0.5, priority: 22,
    lowSuggestion: 'eggs, almonds, mushrooms, or organ meat',
  },
  {
    key: 'thiaminMg', label: 'B1 thiamin', unit: 'mg', decimals: 1, lowRatio: 0.5, priority: 20,
    lowSuggestion: 'pork, salmon, sunflower seeds, or macadamias',
  },
  {
    key: 'pantothenicAcidMg', label: 'B5 pantothenic acid', unit: 'mg', decimals: 1, lowRatio: 0.5, priority: 19,
    lowSuggestion: 'chicken, beef, mushrooms, avocado, or eggs',
  },
  {
    key: 'biotinMcg', label: 'B7 biotin', unit: 'mcg', decimals: 0, lowRatio: 0.5, priority: 17,
    lowSuggestion: 'eggs, salmon, almonds, or liver',
  },
  {
    key: 'manganeseMg', label: 'Manganese', unit: 'mg', decimals: 1, lowRatio: 0.5, priority: 18,
    lowSuggestion: 'nuts, leafy greens, or shellfish',
  },
  {
    key: 'copperMg', label: 'Copper', unit: 'mg', decimals: 2, lowRatio: 0.5, priority: 16,
    lowSuggestion: 'liver, nuts, seeds, or dark chocolate',
  },
  // Omega-6 has no established keto-specific concern, and there's no reliable
  // way to tell "too much" from typical cooking-oil use — tracked for display
  // only, no hint is generated for it.
  { key: 'omega6G', label: 'Omega-6', unit: 'g', decimals: 1, priority: 0, lowSuggestion: '' },
  // Saturated fat is a normal part of a keto diet and has no RDA; flagging it
  // "high" would be alarmist and flagging it "low" nonsensical — display only.
  { key: 'saturatedFatG', label: 'Saturated fat', unit: 'g', decimals: 1, priority: 0, lowSuggestion: '' },
];
