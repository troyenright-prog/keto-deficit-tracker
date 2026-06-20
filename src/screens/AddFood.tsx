import { useState } from 'react';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import type { FoodItem, FoodLogEntry } from '../types';
import { todayDateString } from '../lib/nutrition';
import { nanoid } from '../lib/nanoid';

interface AddFoodProps {
  savedFoods: FoodItem[];
  onAdd: (entry: FoodLogEntry) => void;
  onSaveFood: (food: FoodItem) => void;
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
      loggedAt: new Date().toISOString(),
    };
    onAdd(entry);
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
      createdAt: new Date().toISOString(),
    };
    onSaveFood(food);
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
