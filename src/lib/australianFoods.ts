import type { FoodItem } from '../types';
import { nanoid } from './nanoid';

// Approximate nutritional values for common Australian keto foods.
// Values are per the listed serving size. These are estimates — always verify
// against the packet if accuracy is critical.
export const AUSTRALIAN_STARTER_FOODS: Omit<FoodItem, 'id' | 'createdAt'>[] = [
  // Proteins
  { name: 'Eggs (whole, large)', servingSize: '1 egg (55g)', calories: 78, proteinG: 6.3, fatG: 5.3, totalCarbsG: 0.6, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 62, potassiumMg: 63, magnesiumMg: 6 },
  { name: 'Chicken breast (raw, skinless)', servingSize: '100g', calories: 120, proteinG: 22.5, fatG: 2.6, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 74, potassiumMg: 360, magnesiumMg: 29 },
  { name: 'Beef eye fillet (raw)', servingSize: '100g', calories: 143, proteinG: 21.4, fatG: 6.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 55, potassiumMg: 315, magnesiumMg: 22 },
  { name: 'Beef mince 80/20 (raw)', servingSize: '100g', calories: 254, proteinG: 17.4, fatG: 20.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 72, potassiumMg: 270, magnesiumMg: 19 },
  { name: 'Salmon (Atlantic, raw)', servingSize: '100g', calories: 208, proteinG: 20.0, fatG: 13.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 59, potassiumMg: 490, magnesiumMg: 29 },
  { name: 'Tuna (canned in water, drained)', servingSize: '100g', calories: 116, proteinG: 26.0, fatG: 1.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 320, potassiumMg: 290, magnesiumMg: 35 },
  { name: 'Bacon (middle rasher, raw)', servingSize: '1 rasher (25g)', calories: 100, proteinG: 3.0, fatG: 9.3, totalCarbsG: 0.1, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 430, potassiumMg: 65, magnesiumMg: 5 },
  { name: 'Lamb chops (raw)', servingSize: '100g', calories: 235, proteinG: 16.0, fatG: 19.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 72, potassiumMg: 290, magnesiumMg: 21 },
  { name: 'Pork belly (raw)', servingSize: '100g', calories: 395, proteinG: 9.0, fatG: 40.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 42, potassiumMg: 196, magnesiumMg: 10 },

  // Dairy
  { name: 'Greek yoghurt (full fat, plain)', servingSize: '100g', calories: 97, proteinG: 9.0, fatG: 5.0, totalCarbsG: 4.0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 46, potassiumMg: 141, magnesiumMg: 11 },
  { name: 'Cheddar cheese', servingSize: '30g', calories: 121, proteinG: 7.5, fatG: 10.0, totalCarbsG: 0.4, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 180, potassiumMg: 30, magnesiumMg: 8 },
  { name: 'Cream cheese (full fat)', servingSize: '30g', calories: 99, proteinG: 1.9, fatG: 9.8, totalCarbsG: 1.2, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 93, potassiumMg: 40, magnesiumMg: 4 },
  { name: 'Thickened cream', servingSize: '30ml', calories: 104, proteinG: 0.6, fatG: 11.0, totalCarbsG: 0.8, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 10, potassiumMg: 30, magnesiumMg: 3 },
  { name: 'Parmesan cheese', servingSize: '20g', calories: 88, proteinG: 7.3, fatG: 6.0, totalCarbsG: 0.8, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 260, potassiumMg: 24, magnesiumMg: 8 },
  { name: 'Butter (salted)', servingSize: '10g', calories: 72, proteinG: 0.1, fatG: 8.1, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 82, potassiumMg: 2, magnesiumMg: 0 },

  // Fats & oils
  { name: 'Olive oil (extra virgin)', servingSize: '1 tbsp (15ml)', calories: 133, proteinG: 0, fatG: 15.0, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0 },
  { name: 'Coconut oil', servingSize: '1 tbsp (15ml)', calories: 130, proteinG: 0, fatG: 14.4, totalCarbsG: 0, fibreG: 0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0 },

  // Vegetables
  { name: 'Avocado', servingSize: '100g (approx. half)', calories: 160, proteinG: 2.0, fatG: 14.7, totalCarbsG: 9.0, fibreG: 6.7, sugarAlcoholsG: 0, sodiumMg: 7, potassiumMg: 485, magnesiumMg: 29 },
  { name: 'Spinach (raw)', servingSize: '100g', calories: 23, proteinG: 2.9, fatG: 0.4, totalCarbsG: 3.6, fibreG: 2.2, sugarAlcoholsG: 0, sodiumMg: 79, potassiumMg: 558, magnesiumMg: 79 },
  { name: 'Broccoli (raw)', servingSize: '100g', calories: 34, proteinG: 2.8, fatG: 0.4, totalCarbsG: 7.0, fibreG: 2.6, sugarAlcoholsG: 0, sodiumMg: 33, potassiumMg: 316, magnesiumMg: 21 },
  { name: 'Zucchini (raw)', servingSize: '100g', calories: 17, proteinG: 1.2, fatG: 0.3, totalCarbsG: 3.1, fibreG: 1.0, sugarAlcoholsG: 0, sodiumMg: 8, potassiumMg: 261, magnesiumMg: 18 },
  { name: 'Cauliflower (raw)', servingSize: '100g', calories: 25, proteinG: 1.9, fatG: 0.3, totalCarbsG: 5.0, fibreG: 2.0, sugarAlcoholsG: 0, sodiumMg: 30, potassiumMg: 299, magnesiumMg: 15 },
  { name: 'Capsicum (green, raw)', servingSize: '100g', calories: 20, proteinG: 0.9, fatG: 0.2, totalCarbsG: 4.6, fibreG: 1.7, sugarAlcoholsG: 0, sodiumMg: 3, potassiumMg: 175, magnesiumMg: 10 },
  { name: 'Mushrooms (button, raw)', servingSize: '100g', calories: 22, proteinG: 3.1, fatG: 0.3, totalCarbsG: 3.3, fibreG: 1.0, sugarAlcoholsG: 0, sodiumMg: 5, potassiumMg: 318, magnesiumMg: 9 },

  // Nuts & seeds
  { name: 'Almonds (raw)', servingSize: '30g', calories: 174, proteinG: 6.3, fatG: 15.0, totalCarbsG: 6.6, fibreG: 3.8, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 209, magnesiumMg: 76 },
  { name: 'Macadamia nuts (raw)', servingSize: '30g', calories: 214, proteinG: 2.4, fatG: 22.5, totalCarbsG: 3.9, fibreG: 2.4, sugarAlcoholsG: 0, sodiumMg: 1, potassiumMg: 104, magnesiumMg: 37 },
  { name: 'Pumpkin seeds (pepitas)', servingSize: '30g', calories: 163, proteinG: 8.5, fatG: 13.0, totalCarbsG: 5.0, fibreG: 1.2, sugarAlcoholsG: 0, sodiumMg: 5, potassiumMg: 240, magnesiumMg: 156 },
  { name: 'Walnuts (raw)', servingSize: '30g', calories: 196, proteinG: 4.6, fatG: 19.6, totalCarbsG: 4.1, fibreG: 2.0, sugarAlcoholsG: 0, sodiumMg: 0, potassiumMg: 130, magnesiumMg: 45 },
];

export function getStarterFoods(): FoodItem[] {
  return AUSTRALIAN_STARTER_FOODS.map((f) => ({
    ...f,
    id: nanoid(),
    createdAt: new Date().toISOString(),
  }));
}
