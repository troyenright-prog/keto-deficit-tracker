import { useState } from 'react';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import type { FoodItem, FoodLogEntry } from '../types';
import { todayDateString } from '../lib/nutrition';
import { nanoid } from '../lib/nanoid';

interface AddFoodProps {
  savedFoods: FoodItem[];
  onAdd: (entry: FoodLogEntry) => boolean;
  onSaveFood: (food: FoodItem) => boolean;
}

export function AddFood({ savedFoods, onAdd, onSaveFood }: AddFoodProps) {
  const [date, setDate] = useState(todayDateString());
  const [successMsg, setSuccessMsg] = useState('');

  function handleSubmit(values: FoodFormValues) {
    const m = values.servingMultiplier;
    const entry: FoodLogEntry = {
      id: nanoid(),
      date,
      name: values.name,
      servingSize: values.servingSize,
      servingMultiplier: m,
      calories: values.calories * m,
      proteinG: values.proteinG * m,
      fatG: values.fatG * m,
      totalCarbsG: values.totalCarbsG * m,
      fibreG: values.fibreG * m,
      sugarAlcoholsG: values.sugarAlcoholsG * m,
      sodiumMg: values.sodiumMg * m,
      potassiumMg: values.potassiumMg * m,
      magnesiumMg: values.magnesiumMg * m,
      calciumMg: values.calciumMg === undefined ? undefined : values.calciumMg * m,
      ironMg: values.ironMg === undefined ? undefined : values.ironMg * m,
      zincMg: values.zincMg === undefined ? undefined : values.zincMg * m,
      vitaminDMcg: values.vitaminDMcg === undefined ? undefined : values.vitaminDMcg * m,
      vitaminB12Mcg: values.vitaminB12Mcg === undefined ? undefined : values.vitaminB12Mcg * m,
      omega3G: values.omega3G === undefined ? undefined : values.omega3G * m,
      omega6G: values.omega6G === undefined ? undefined : values.omega6G * m,
      loggedAt: new Date().toISOString(),
    };
    if (!onAdd(entry)) return;
    setSuccessMsg(`"${values.name}" added to ${date === todayDateString() ? 'today' : date}'s log.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  function handleSaveFood(values: FoodFormValues) {
    const food: FoodItem = {
      id: nanoid(),
      name: values.name,
      servingSize: values.servingSize,
      calories: values.calories,
      proteinG: values.proteinG,
      fatG: values.fatG,
      totalCarbsG: values.totalCarbsG,
      fibreG: values.fibreG,
      sugarAlcoholsG: values.sugarAlcoholsG,
      sodiumMg: values.sodiumMg,
      potassiumMg: values.potassiumMg,
      magnesiumMg: values.magnesiumMg,
      calciumMg: values.calciumMg, ironMg: values.ironMg, zincMg: values.zincMg,
      vitaminDMcg: values.vitaminDMcg, vitaminB12Mcg: values.vitaminB12Mcg,
      omega3G: values.omega3G, omega6G: values.omega6G,
      createdAt: new Date().toISOString(),
    };
    if (!onSaveFood(food)) return;
    setSuccessMsg(`"${values.name}" saved to your food library.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Add Food</h1>
      </div>
      {successMsg && <div className="success-toast">{successMsg}</div>}
      <FoodForm
        onSubmit={handleSubmit}
        onSaveAsFood={handleSaveFood}
        savedFoods={savedFoods}
        showDate
        date={date}
        onDateChange={setDate}
      />
    </div>
  );
}
