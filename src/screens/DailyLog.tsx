import { useState } from 'react';
import type { FoodLogEntry, FoodItem } from '../types';
import { calcNetCarbs, todayDateString } from '../lib/nutrition';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import { nanoid } from '../lib/nanoid';

interface DailyLogProps {
  log: FoodLogEntry[];
  savedFoods: FoodItem[];
  onDelete: (id: string) => void;
  onEdit: (entry: FoodLogEntry) => void;
  onSaveFood: (food: FoodItem) => void;
}

export function DailyLog({ log, savedFoods, onDelete, onEdit, onSaveFood }: DailyLogProps) {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [editingId, setEditingId] = useState<string | null>(null);

  const dayEntries = log.filter((e) => e.date === selectedDate);

  function handleEditSubmit(entry: FoodLogEntry, values: FoodFormValues) {
    const m = values.servingMultiplier;
    onEdit({
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
    });
    setEditingId(null);
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
                        calories: entry.calories / entry.servingMultiplier,
                        proteinG: entry.proteinG / entry.servingMultiplier,
                        fatG: entry.fatG / entry.servingMultiplier,
                        totalCarbsG: entry.totalCarbsG / entry.servingMultiplier,
                        fibreG: entry.fibreG / entry.servingMultiplier,
                        sugarAlcoholsG: entry.sugarAlcoholsG / entry.servingMultiplier,
                        sodiumMg: entry.sodiumMg / entry.servingMultiplier,
                        potassiumMg: entry.potassiumMg / entry.servingMultiplier,
                        magnesiumMg: entry.magnesiumMg / entry.servingMultiplier,
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
