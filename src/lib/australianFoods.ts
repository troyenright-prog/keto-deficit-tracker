import type { FoodItem } from '../types';
import { nanoid } from './nanoid';

// Approximate nutritional values for common Australian keto foods.
// Values are per the listed serving size. These are estimates — always verify
// against the packet if accuracy is critical.
//
// Micronutrient panels are USDA FoodData Central–typical values for the raw
// food, per the listed serving. Fields a food genuinely lacks solid data for
// are left undefined (NOT zero) so the hint engine's data-coverage logic can
// treat them as "unknown" rather than "none" — biotin in particular is only
// filled where the NIH ODS biotin table actually lists the food.
export const AUSTRALIAN_STARTER_FOODS: Omit<FoodItem, 'id' | 'createdAt'>[] = [
  // Proteins
  {
    name: 'Eggs (whole, large)', servingSize: '1 egg (55g)', calories: 78, proteinG: 6.3, fatG: 5.3, totalCarbsG: 0.6, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 62, potassiumMg: 63, magnesiumMg: 6,
    saturatedFatG: 1.6, calciumMg: 28, phosphorusMg: 99, ironMg: 0.9, zincMg: 0.65, seleniumMcg: 15, iodineMcg: 24,
    vitaminAMcg: 80, vitaminDMcg: 1.1, vitaminEMg: 0.5, riboflavinMg: 0.23, pantothenicAcidMg: 0.77, vitaminB6Mg: 0.09,
    biotinMcg: 10, folateMcg: 24, vitaminB12Mcg: 0.45, cholineMg: 147, omega3G: 0.04,
  },
  {
    name: 'Boiled egg (large)', servingSize: '1 egg (55g)', calories: 78, proteinG: 6.3, fatG: 5.3, totalCarbsG: 0.6, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 62, potassiumMg: 63, magnesiumMg: 6,
    saturatedFatG: 1.6, calciumMg: 28, phosphorusMg: 99, ironMg: 0.9, zincMg: 0.65, seleniumMcg: 15, iodineMcg: 24,
    vitaminAMcg: 80, vitaminDMcg: 1.1, vitaminEMg: 0.5, riboflavinMg: 0.23, pantothenicAcidMg: 0.77, vitaminB6Mg: 0.09,
    biotinMcg: 10, folateMcg: 24, vitaminB12Mcg: 0.45, cholineMg: 147, omega3G: 0.04,
  },
  // Harris Farm 700g eggs — 700g per dozen, so ~58g per egg. Micronutrients
  // scaled from the USDA whole-egg panel (×58/100 of per-100g values).
  {
    name: 'Eggs 700g (Harris Farm)', servingSize: '1 egg (58g)', calories: 83, proteinG: 6.7, fatG: 5.6, totalCarbsG: 0.6, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 66, potassiumMg: 67, magnesiumMg: 6,
    saturatedFatG: 1.7, calciumMg: 30, phosphorusMg: 105, ironMg: 0.95, zincMg: 0.69, copperMg: 0.04, manganeseMg: 0.02, seleniumMcg: 16, iodineMcg: 25,
    vitaminAMcg: 85, vitaminDMcg: 1.2, vitaminEMg: 0.53, vitaminKMcg: 0.2, thiaminMg: 0.02, riboflavinMg: 0.24, niacinMg: 0.04, pantothenicAcidMg: 0.81, vitaminB6Mg: 0.1,
    biotinMcg: 10.5, folateMcg: 25, vitaminB12Mcg: 0.48, cholineMg: 155, omega3G: 0.04, omega6G: 0.9,
  },
  {
    name: 'Chicken breast (raw, skinless)', servingSize: '100g', calories: 120, proteinG: 22.5, fatG: 2.6, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 74, potassiumMg: 360, magnesiumMg: 29,
    saturatedFatG: 0.6, phosphorusMg: 210, ironMg: 0.4, zincMg: 0.7, seleniumMcg: 22, thiaminMg: 0.07, riboflavinMg: 0.09,
    niacinMg: 9.6, pantothenicAcidMg: 1.5, vitaminB6Mg: 0.8, vitaminB12Mcg: 0.2, cholineMg: 82,
  },
  {
    name: 'Beef eye fillet (raw)', servingSize: '100g', calories: 143, proteinG: 21.4, fatG: 6.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 55, potassiumMg: 315, magnesiumMg: 22,
    saturatedFatG: 2.4, phosphorusMg: 200, ironMg: 2.0, zincMg: 3.8, seleniumMcg: 24, thiaminMg: 0.07, riboflavinMg: 0.15,
    niacinMg: 6.0, pantothenicAcidMg: 0.6, vitaminB6Mg: 0.6, biotinMcg: 4.4, vitaminB12Mcg: 2.0, cholineMg: 65,
  },
  {
    name: 'Beef mince 80/20 (raw)', servingSize: '100g', calories: 254, proteinG: 17.4, fatG: 20.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 72, potassiumMg: 270, magnesiumMg: 19,
    saturatedFatG: 7.6, phosphorusMg: 158, ironMg: 1.9, zincMg: 4.2, seleniumMcg: 15, niacinMg: 4.2,
    pantothenicAcidMg: 0.5, vitaminB6Mg: 0.3, biotinMcg: 4.4, vitaminB12Mcg: 2.1, cholineMg: 56,
  },
  // Woolworths "Beef Porterhouse Steak with Herb & Garlic Butter" 400g pack — label
  // values (per 100g); potassium/magnesium aren't on the label, estimated from
  // plain beef porterhouse/sirloin since the butter medallion is a small share of the pack.
  {
    name: 'Beef porterhouse steak with herb & garlic butter (raw)', servingSize: '100g', calories: 263, proteinG: 19.5, fatG: 20.3, totalCarbsG: 1.0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 157, potassiumMg: 320, magnesiumMg: 22,
    saturatedFatG: 9.5,
  },
  // Super Butcher thick-cut rib fillet, sold as ~300g steaks. Values are
  // USDA/AUSNUT-typical raw beef ribeye (scotch fillet) per 100g, ×3 for the
  // whole steak.
  {
    name: 'Beef rib fillet thick cut (Super Butcher, raw)', servingSize: '1 steak (300g)', calories: 620, proteinG: 60.0, fatG: 42.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 156, potassiumMg: 960, magnesiumMg: 63,
    saturatedFatG: 17.7, calciumMg: 15, phosphorusMg: 570, ironMg: 5.4, zincMg: 12.0, copperMg: 0.22, manganeseMg: 0.03, seleniumMcg: 66,
    vitaminDMcg: 0.3, vitaminEMg: 0.5, vitaminKMcg: 4.5, thiaminMg: 0.21, riboflavinMg: 0.45,
    niacinMg: 15.0, pantothenicAcidMg: 1.8, vitaminB6Mg: 1.5, biotinMcg: 13, folateMcg: 9, vitaminB12Mcg: 6.6, cholineMg: 170,
    omega3G: 0.15, omega6G: 1.0,
  },
  {
    name: 'Salmon (Atlantic, raw)', servingSize: '100g', calories: 208, proteinG: 20.0, fatG: 13.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 59, potassiumMg: 490, magnesiumMg: 29,
    saturatedFatG: 3.1, phosphorusMg: 240, ironMg: 0.3, zincMg: 0.4, seleniumMcg: 24, vitaminDMcg: 11, vitaminEMg: 3.6,
    thiaminMg: 0.2, riboflavinMg: 0.16, niacinMg: 8.5, pantothenicAcidMg: 1.5, vitaminB6Mg: 0.6, biotinMcg: 5.9,
    vitaminB12Mcg: 3.2, cholineMg: 79, omega3G: 2.2,
  },
  {
    name: 'Tuna (canned in water, drained)', servingSize: '100g', calories: 116, proteinG: 26.0, fatG: 1.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 320, potassiumMg: 290, magnesiumMg: 35,
    saturatedFatG: 0.3, phosphorusMg: 160, ironMg: 1.0, zincMg: 0.7, seleniumMcg: 70, vitaminDMcg: 1.2,
    niacinMg: 10, pantothenicAcidMg: 0.2, vitaminB6Mg: 0.3, biotinMcg: 0.6, vitaminB12Mcg: 2.5, cholineMg: 65, omega3G: 0.27,
  },
  {
    name: 'Bacon (middle rasher, raw)', servingSize: '1 rasher (25g)', calories: 100, proteinG: 3.0, fatG: 9.3, totalCarbsG: 0.1, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 430, potassiumMg: 65, magnesiumMg: 5,
    saturatedFatG: 3.1, phosphorusMg: 36, zincMg: 0.28, seleniumMcg: 5, thiaminMg: 0.07, niacinMg: 1.0,
    vitaminB6Mg: 0.06, vitaminB12Mcg: 0.12, cholineMg: 16,
  },
  {
    name: 'Lamb chops (raw)', servingSize: '100g', calories: 235, proteinG: 16.0, fatG: 19.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 72, potassiumMg: 290, magnesiumMg: 21,
    saturatedFatG: 8.8, phosphorusMg: 160, ironMg: 1.5, zincMg: 3.3, seleniumMcg: 20, riboflavinMg: 0.21,
    niacinMg: 5.7, vitaminB6Mg: 0.13, vitaminB12Mcg: 2.5, cholineMg: 70,
  },
  {
    name: 'Pork belly (raw)', servingSize: '100g', calories: 395, proteinG: 9.0, fatG: 40.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 42, potassiumMg: 196, magnesiumMg: 10,
    saturatedFatG: 14.5, phosphorusMg: 130, ironMg: 0.5, zincMg: 1.1, seleniumMcg: 17, thiaminMg: 0.4,
    niacinMg: 4.4, vitaminB6Mg: 0.2, vitaminB12Mcg: 0.8, cholineMg: 60,
  },

  // Dairy
  {
    name: 'Greek yoghurt (full fat, plain)', servingSize: '100g', calories: 97, proteinG: 9.0, fatG: 5.0, totalCarbsG: 4.0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 46, potassiumMg: 141, magnesiumMg: 11,
    saturatedFatG: 3.5, calciumMg: 110, phosphorusMg: 135, zincMg: 0.5, seleniumMcg: 10, iodineMcg: 35,
    vitaminAMcg: 47, riboflavinMg: 0.28, pantothenicAcidMg: 0.33, vitaminB12Mcg: 0.75, cholineMg: 15,
  },
  {
    name: 'Cheddar cheese', servingSize: '30g', calories: 121, proteinG: 7.5, fatG: 10.0, totalCarbsG: 0.4, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 180, potassiumMg: 30, magnesiumMg: 8,
    saturatedFatG: 5.9, calciumMg: 216, phosphorusMg: 137, zincMg: 1.1, seleniumMcg: 8, iodineMcg: 12,
    vitaminAMcg: 96, riboflavinMg: 0.13, vitaminB12Mcg: 0.33, cholineMg: 5,
  },
  {
    name: 'Cream cheese (full fat)', servingSize: '30g', calories: 99, proteinG: 1.9, fatG: 9.8, totalCarbsG: 1.2, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 93, potassiumMg: 40, magnesiumMg: 4,
    saturatedFatG: 5.5, calciumMg: 29, phosphorusMg: 32, vitaminAMcg: 93, riboflavinMg: 0.07, vitaminB12Mcg: 0.07, cholineMg: 8,
  },
  {
    name: 'Thickened cream', servingSize: '30ml', calories: 104, proteinG: 0.6, fatG: 11.0, totalCarbsG: 0.8, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 10, potassiumMg: 30, magnesiumMg: 3,
    saturatedFatG: 7.0, calciumMg: 20, phosphorusMg: 18, vitaminAMcg: 120, cholineMg: 5,
  },
  {
    name: 'Parmesan cheese', servingSize: '20g', calories: 88, proteinG: 7.3, fatG: 6.0, totalCarbsG: 0.8, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 260, potassiumMg: 24, magnesiumMg: 8,
    saturatedFatG: 3.9, calciumMg: 236, phosphorusMg: 139, zincMg: 0.55, seleniumMcg: 4.5,
    vitaminAMcg: 49, riboflavinMg: 0.07, vitaminB12Mcg: 0.45, cholineMg: 3,
  },
  // Wicked Sister High Protein Pudding 170g tubs — label values per tub
  // (energy converted from kJ). Sweetened with erythritol/stevia but the label
  // doesn't split out polyol grams, so sugar alcohols stay 0 (carbs as
  // labelled). Fibre is listed "-" (not available) → 0. Micronutrients aren't
  // on the label; estimated from the skim-milk-powder/MPC/cream base (~15.5g
  // milk protein ≈ the protein of ~450ml milk, discounted for processing).
  // Chocolate additionally gets cocoa's iron/copper/manganese/magnesium.
  {
    name: 'Wicked Sister High Protein Pudding — Caramel', servingSize: '1 tub (170g)', calories: 157, proteinG: 15.6, fatG: 5.3, totalCarbsG: 10.4, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 175, potassiumMg: 250, magnesiumMg: 19,
    saturatedFatG: 3.4, calciumMg: 400, phosphorusMg: 320, ironMg: 0.1, zincMg: 1.8, iodineMcg: 50, seleniumMcg: 9,
    vitaminAMcg: 45, vitaminDMcg: 0.2, thiaminMg: 0.15, riboflavinMg: 0.6, pantothenicAcidMg: 1.2, vitaminB6Mg: 0.15,
    folateMcg: 20, vitaminB12Mcg: 1.5, cholineMg: 60,
  },
  {
    name: 'Wicked Sister High Protein Pudding — Chocolate', servingSize: '1 tub (170g)', calories: 169, proteinG: 15.3, fatG: 6.3, totalCarbsG: 9.9, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 163, potassiumMg: 260, magnesiumMg: 24,
    saturatedFatG: 3.9, calciumMg: 390, phosphorusMg: 330, ironMg: 0.6, zincMg: 1.9, copperMg: 0.15, manganeseMg: 0.15, iodineMcg: 50, seleniumMcg: 9,
    vitaminAMcg: 45, vitaminDMcg: 0.2, thiaminMg: 0.15, riboflavinMg: 0.6, pantothenicAcidMg: 1.2, vitaminB6Mg: 0.15,
    folateMcg: 20, vitaminB12Mcg: 1.5, cholineMg: 60,
  },
  {
    name: 'Butter (salted)', servingSize: '10g', calories: 72, proteinG: 0.1, fatG: 8.1, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 82, potassiumMg: 2, magnesiumMg: 0,
    saturatedFatG: 5.1, vitaminAMcg: 68, vitaminDMcg: 0.15, vitaminEMg: 0.23, vitaminKMcg: 0.7, cholineMg: 1.9,
  },

  // Beverages
  {
    name: 'Flat white (full cream milk, large)', servingSize: '1 large (350ml)', calories: 165, proteinG: 8.0, fatG: 8.5, totalCarbsG: 12.0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 105, potassiumMg: 360, magnesiumMg: 26,
    saturatedFatG: 5.6, calciumMg: 360, phosphorusMg: 280, zincMg: 1.1, seleniumMcg: 6, iodineMcg: 60,
    vitaminAMcg: 140, riboflavinMg: 0.5, vitaminB12Mcg: 1.4, cholineMg: 120,
  },

  // Fats & oils
  {
    name: 'Olive oil (extra virgin)', servingSize: '1 tbsp (15ml)', calories: 133, proteinG: 0, fatG: 15.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0,
    saturatedFatG: 2.1, vitaminEMg: 2.2, vitaminKMcg: 9.1, omega3G: 0.11, omega6G: 1.5,
  },
  // Sol Ghee (grass fed, Byron Bay) — label values per 10g serve (370kJ).
  // Vitamins A/D/E/K and fatty acids estimated from USDA ghee/butter-oil since
  // the label claims them but gives no amounts.
  {
    name: 'Sol Ghee (grass fed)', servingSize: '10g', calories: 88, proteinG: 0.1, fatG: 10.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0,
    saturatedFatG: 6.5, vitaminAMcg: 84, vitaminDMcg: 0.2, vitaminEMg: 0.28, vitaminKMcg: 0.9, omega3G: 0.15, omega6G: 0.22,
  },
  {
    name: 'Coconut oil', servingSize: '1 tbsp (15ml)', calories: 130, proteinG: 0, fatG: 14.4, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0,
    saturatedFatG: 12.5,
  },

  // Vegetables
  {
    name: 'Avocado', servingSize: '100g (approx. half)', calories: 160, proteinG: 2.0, fatG: 14.7, totalCarbsG: 9.0, fibreG: 6.7, sugarAlcoholsG: 0, sodiumMg: 7, potassiumMg: 485, magnesiumMg: 29,
    saturatedFatG: 2.1, calciumMg: 12, phosphorusMg: 52, ironMg: 0.55, zincMg: 0.64, copperMg: 0.19, manganeseMg: 0.14,
    vitaminCMg: 10, vitaminEMg: 2.1, vitaminKMcg: 21, niacinMg: 1.7, pantothenicAcidMg: 1.4, vitaminB6Mg: 0.26,
    folateMcg: 81, cholineMg: 14,
  },
  {
    name: 'Spinach (raw)', servingSize: '100g', calories: 23, proteinG: 2.9, fatG: 0.4, totalCarbsG: 3.6, fibreG: 2.2, sugarAlcoholsG: 0, sodiumMg: 79, potassiumMg: 558, magnesiumMg: 79,
    saturatedFatG: 0.1, calciumMg: 99, phosphorusMg: 49, ironMg: 2.7, zincMg: 0.53, copperMg: 0.13, manganeseMg: 0.9,
    vitaminAMcg: 469, vitaminCMg: 28, vitaminEMg: 2.0, vitaminKMcg: 483, riboflavinMg: 0.19, vitaminB6Mg: 0.2,
    folateMcg: 194, cholineMg: 19,
  },
  {
    name: 'Broccoli (raw)', servingSize: '100g', calories: 34, proteinG: 2.8, fatG: 0.4, totalCarbsG: 7.0, fibreG: 2.6, sugarAlcoholsG: 0, sodiumMg: 33, potassiumMg: 316, magnesiumMg: 21,
    calciumMg: 47, phosphorusMg: 66, ironMg: 0.73, zincMg: 0.41, manganeseMg: 0.21, seleniumMcg: 2.5,
    vitaminAMcg: 31, vitaminCMg: 89, vitaminEMg: 0.78, vitaminKMcg: 102, pantothenicAcidMg: 0.57, vitaminB6Mg: 0.18,
    folateMcg: 63, cholineMg: 19,
  },
  {
    name: 'Zucchini (raw)', servingSize: '100g', calories: 17, proteinG: 1.2, fatG: 0.3, totalCarbsG: 3.1, fibreG: 1.0, sugarAlcoholsG: 0, sodiumMg: 8, potassiumMg: 261, magnesiumMg: 18,
    phosphorusMg: 38, manganeseMg: 0.18, vitaminAMcg: 10, vitaminCMg: 18, vitaminKMcg: 4.3, riboflavinMg: 0.09,
    vitaminB6Mg: 0.16, folateMcg: 24, cholineMg: 9.5,
  },
  {
    name: 'Cauliflower (raw)', servingSize: '100g', calories: 25, proteinG: 1.9, fatG: 0.3, totalCarbsG: 5.0, fibreG: 2.0, sugarAlcoholsG: 0, sodiumMg: 30, potassiumMg: 299, magnesiumMg: 15,
    calciumMg: 22, phosphorusMg: 44, ironMg: 0.42, manganeseMg: 0.16, vitaminCMg: 48, vitaminKMcg: 15.5,
    pantothenicAcidMg: 0.67, vitaminB6Mg: 0.18, folateMcg: 57, cholineMg: 44,
  },
  {
    name: 'Capsicum (green, raw)', servingSize: '100g', calories: 20, proteinG: 0.9, fatG: 0.2, totalCarbsG: 4.6, fibreG: 1.7, sugarAlcoholsG: 0, sodiumMg: 3, potassiumMg: 175, magnesiumMg: 10,
    vitaminAMcg: 18, vitaminCMg: 80, vitaminEMg: 0.37, vitaminKMcg: 7.4, vitaminB6Mg: 0.22, folateMcg: 10,
  },
  {
    name: 'Mushrooms (button, raw)', servingSize: '100g', calories: 22, proteinG: 3.1, fatG: 0.3, totalCarbsG: 3.3, fibreG: 1.0, sugarAlcoholsG: 0, sodiumMg: 5, potassiumMg: 318, magnesiumMg: 9,
    phosphorusMg: 86, zincMg: 0.52, copperMg: 0.32, seleniumMcg: 9.3, vitaminDMcg: 0.2, riboflavinMg: 0.4,
    niacinMg: 3.6, pantothenicAcidMg: 1.5, folateMcg: 17, cholineMg: 17,
  },

  // Fruits
  {
    name: 'Banana (large, Cavendish)',
    servingSize: '1 large (136g)',
    calories: 121,
    proteinG: 1.5,
    fatG: 0.4,
    totalCarbsG: 31.0,
    fibreG: 3.5,
    sugarAlcoholsG: 0,
    sodiumMg: 1,
    potassiumMg: 540,
    magnesiumMg: 40,
    vitaminCMg: 12,
    vitaminB6Mg: 0.5,
  },

  // Nuts & seeds
  {
    name: 'Almonds (raw)', servingSize: '30g', calories: 174, proteinG: 6.3, fatG: 15.0, totalCarbsG: 6.6, fibreG: 3.8, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 209, magnesiumMg: 76,
    saturatedFatG: 1.1, calciumMg: 81, phosphorusMg: 144, ironMg: 1.1, zincMg: 0.9, copperMg: 0.31, manganeseMg: 0.65,
    vitaminEMg: 7.7, riboflavinMg: 0.34, niacinMg: 1.1, biotinMcg: 1.3, folateMcg: 13, cholineMg: 16, omega6G: 3.7,
  },
  {
    name: 'Macadamia nuts (raw)', servingSize: '30g', calories: 214, proteinG: 2.4, fatG: 22.5, totalCarbsG: 3.9, fibreG: 2.4, sugarAlcoholsG: 0, sodiumMg: 1, potassiumMg: 104, magnesiumMg: 37,
    saturatedFatG: 3.6, phosphorusMg: 56, ironMg: 1.1, zincMg: 0.39, copperMg: 0.23, manganeseMg: 1.2,
    thiaminMg: 0.36, vitaminEMg: 0.16, omega6G: 0.4,
  },
  {
    name: 'Pumpkin seeds (pepitas)', servingSize: '30g', calories: 163, proteinG: 8.5, fatG: 13.0, totalCarbsG: 5.0, fibreG: 1.2, sugarAlcoholsG: 0, sodiumMg: 5, potassiumMg: 240, magnesiumMg: 156,
    saturatedFatG: 2.4, phosphorusMg: 370, ironMg: 2.7, zincMg: 2.3, copperMg: 0.4, manganeseMg: 1.4,
    vitaminEMg: 0.66, vitaminKMcg: 2.2, folateMcg: 17, cholineMg: 19, omega6G: 6.3,
  },
  {
    name: 'Walnuts (raw)', servingSize: '30g', calories: 196, proteinG: 4.6, fatG: 19.6, totalCarbsG: 4.1, fibreG: 2.0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 130, magnesiumMg: 45,
    saturatedFatG: 1.8, phosphorusMg: 104, ironMg: 0.87, zincMg: 0.93, copperMg: 0.48, manganeseMg: 1.0,
    vitaminEMg: 0.21, vitaminB6Mg: 0.16, folateMcg: 29, cholineMg: 12, omega3G: 2.7, omega6G: 11.4,
  },

  // Supplements
  {
    name: "Swisse Ultivite Men's Multivitamin",
    servingSize: '1 tablet',
    calories: 0,
    proteinG: 0,
    fatG: 0,
    totalCarbsG: 0,
    fibreG: 0,
    sugarAlcoholsG: 0,
    sodiumMg: 0,
    potassiumMg: 4,
    magnesiumMg: 105,
    calciumMg: 21,
    ironMg: 3,
    zincMg: 15,
    copperMg: 0.058,
    manganeseMg: 1.2,
    iodineMcg: 50,
    seleniumMcg: 26,
    vitaminCMg: 165,
    vitaminDMcg: 25,
    vitaminEMg: 24.79,
    thiaminMg: 22.03,
    riboflavinMg: 30,
    niacinMg: 25,
    vitaminB6Mg: 24.68,
    folateMcg: 500,
    vitaminB12Mcg: 50,
  },
  {
    name: "Nature's Own Complete Sleep + Magnesium",
    servingSize: '1 tablet',
    calories: 0,
    proteinG: 0,
    fatG: 0,
    totalCarbsG: 0,
    fibreG: 0,
    sugarAlcoholsG: 0,
    sodiumMg: 0,
    potassiumMg: 0,
    magnesiumMg: 160,
  },
];

export function getStarterFoods(): FoodItem[] {
  return AUSTRALIAN_STARTER_FOODS.map((f) => ({
    ...f,
    id: nanoid(),
    createdAt: new Date().toISOString(),
    isStarter: true,
    isFavourite: false,
  }));
}

export function getStarterFoodOptions(): FoodItem[] {
  return AUSTRALIAN_STARTER_FOODS.map((food, index) => ({
    ...food,
    id: `starter-${index}`,
    createdAt: '2020-01-01T00:00:00.000Z',
    isStarter: true,
    isFavourite: false,
  }));
}
