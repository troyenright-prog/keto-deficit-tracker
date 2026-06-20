import { useState } from 'react';
import type { FoodLogEntry, FoodItem } from '../types';
import { calcNetCarbs, todayDateString } from '../lib/nutrition';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import { nanoid } from '../lib/nanoid';

interface DailyLogProps {
  log: FoodLogEntry[];
  savedFoods: FoodItem[];
  onDelete: (id: string) => void;
  onEdit: (entry: FoodLogEntry) => boolean;
  onSaveFood: (food: FoodItem) => boolean;
}

export function DailyLog({ log, savedFoods, onDelete, onEdit, onSaveFood }: DailyLogProps) {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [editingId, setEditingId] = useState<string | null>(null);

  const dayEntries = log.filter((e) => e.date === selectedDate);

  function handleEditSubmit(entry: FoodLogEntry, values: FoodFormValues) {
    const m = values.servingMultiplier;
    const saved = onEdit({
      ...entry,
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
      calciumMg: (values.calciumMg ?? 0) * m, ironMg: (values.ironMg ?? 0) * m,
      zincMg: (values.zincMg ?? 0) * m, vitaminDMcg: (values.vitaminDMcg ?? 0) * m,
      vitaminB12Mcg: (values.vitaminB12Mcg ?? 0) * m, omega3G: (values.omega3G ?? 0) * m,
      omega6G: (values.omega6G ?? 0) * m,
    });
    if (saved) setEditingId(null);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Daily Log</h1>
        <input
          type="date"
          value={selectedDate}
          max={todayDateString()}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="date-picker"
        />
      </div>

      {dayEntries.length === 0 ? (
        <p className="empty-hint">No entries for {selectedDate}.</p>
      ) : (
        <ul className="log-list">
          {dayEntries.map((entry) => {
            const netCarbs = calcNetCarbs(entry.totalCarbsG, entry.fibreG, entry.sugarAlcoholsG);
            return (
              <li key={entry.id} className="log-item">
                {editingId === entry.id ? (
                  <div className="log-item-edit">
                    <FoodForm
                      initial={{
                        name: entry.name,
                        servingSize: entry.servingSize,
                        servingMultiplier: entry.servingMultiplier,
                        calories: entry.calories / Math.max(entry.servingMultiplier, 1),
                        proteinG: entry.proteinG / Math.max(entry.servingMultiplier, 1),
                        fatG: entry.fatG / Math.max(entry.servingMultiplier, 1),
                        totalCarbsG: entry.totalCarbsG / Math.max(entry.servingMultiplier, 1),
                        fibreG: entry.fibreG / Math.max(entry.servingMultiplier, 1),
                        sugarAlcoholsG: entry.sugarAlcoholsG / Math.max(entry.servingMultiplier, 1),
                        sodiumMg: entry.sodiumMg / Math.max(entry.servingMultiplier, 1),
                        potassiumMg: entry.potassiumMg / Math.max(entry.servingMultiplier, 1),
                        magnesiumMg: entry.magnesiumMg / Math.max(entry.servingMultiplier, 1),
                        calciumMg: (entry.calciumMg ?? 0) / Math.max(entry.servingMultiplier, 1),
                        ironMg: (entry.ironMg ?? 0) / Math.max(entry.servingMultiplier, 1),
                        zincMg: (entry.zincMg ?? 0) / Math.max(entry.servingMultiplier, 1),
                        vitaminDMcg: (entry.vitaminDMcg ?? 0) / Math.max(entry.servingMultiplier, 1),
                        vitaminB12Mcg: (entry.vitaminB12Mcg ?? 0) / Math.max(entry.servingMultiplier, 1),
                        omega3G: (entry.omega3G ?? 0) / Math.max(entry.servingMultiplier, 1),
                        omega6G: (entry.omega6G ?? 0) / Math.max(entry.servingMultiplier, 1),
                      }}
                      onSubmit={(vals) => handleEditSubmit(entry, vals)}
                      submitLabel="Save changes"
                      savedFoods={savedFoods}
                      onSaveAsFood={(vals) => {
                        onSaveFood({
                          id: nanoid(),
                          name: vals.name,
                          servingSize: vals.servingSize,
                          calories: vals.calories,
                          proteinG: vals.proteinG,
                          fatG: vals.fatG,
                          totalCarbsG: vals.totalCarbsG,
                          fibreG: vals.fibreG,
                          sugarAlcoholsG: vals.sugarAlcoholsG,
                          sodiumMg: vals.sodiumMg,
                          potassiumMg: vals.potassiumMg,
                          magnesiumMg: vals.magnesiumMg,
                          calciumMg: vals.calciumMg, ironMg: vals.ironMg, zincMg: vals.zincMg,
                          vitaminDMcg: vals.vitaminDMcg, vitaminB12Mcg: vals.vitaminB12Mcg,
                          omega3G: vals.omega3G, omega6G: vals.omega6G,
                          createdAt: new Date().toISOString(),
                        });
                      }}
                    />
                    <button className="btn btn--ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="log-item-row">
                    <div className="log-item-info">
                      <span className="log-item-name">{entry.name}</span>
                      <span className="log-item-serving">
                        {entry.servingMultiplier !== 1
                          ? `${entry.servingMultiplier}× ${entry.servingSize}`
                          : entry.servingSize}
                      </span>
                      <span className="log-item-macros">
                        {Math.round(entry.calories)} kcal · {(entry.proteinG).toFixed(1)}g protein ·{' '}
                        {netCarbs.toFixed(1)}g net carbs · {(entry.fatG).toFixed(1)}g fat
                      </span>
                    </div>
                    <div className="log-item-actions">
                      <button className="btn btn--ghost btn--sm" onClick={() => setEditingId(entry.id)}>
                        Edit
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => {
                          if (confirm(`Delete "${entry.name}"?`)) onDelete(entry.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
