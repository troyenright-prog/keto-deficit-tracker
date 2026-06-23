import { useState } from 'react';
import type { FoodLogEntry, FoodItem } from '../types';
import { calcNetCarbs, todayDateString } from '../lib/nutrition';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import { entryMeal, mealLabel, MEAL_SLOTS } from '../lib/meals';
import { nanoid } from '../lib/nanoid';

interface DailyLogProps {
  log: FoodLogEntry[];
  savedFoods: FoodItem[];
  onDelete: (id: string) => void;
  onEdit: (entry: FoodLogEntry) => boolean;
  onDuplicate: (entry: FoodLogEntry, targetDate?: string) => boolean;
  onSaveFood: (food: FoodItem) => boolean;
}

export function DailyLog({ log, savedFoods, onDelete, onEdit, onDuplicate, onSaveFood }: DailyLogProps) {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [editingId, setEditingId] = useState<string | null>(null);

  const dayEntries = log.filter((e) => e.date === selectedDate);
  const entriesByMeal = MEAL_SLOTS.map((slot) => ({
    ...slot,
    entries: dayEntries.filter((entry) => entryMeal(entry) === slot.id),
  }));

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
      calciumMg: values.calciumMg === undefined ? undefined : values.calciumMg * m,
      ironMg: values.ironMg === undefined ? undefined : values.ironMg * m,
      zincMg: values.zincMg === undefined ? undefined : values.zincMg * m,
      vitaminDMcg: values.vitaminDMcg === undefined ? undefined : values.vitaminDMcg * m,
      vitaminB12Mcg: values.vitaminB12Mcg === undefined ? undefined : values.vitaminB12Mcg * m,
      omega3G: values.omega3G === undefined ? undefined : values.omega3G * m,
      omega6G: values.omega6G === undefined ? undefined : values.omega6G * m,
    });
    if (saved) setEditingId(null);
  }

  function saveEditedEntryAsFood(values: FoodFormValues) {
    onSaveFood({
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
      calciumMg: values.calciumMg,
      ironMg: values.ironMg,
      zincMg: values.zincMg,
      vitaminDMcg: values.vitaminDMcg,
      vitaminB12Mcg: values.vitaminB12Mcg,
      omega3G: values.omega3G,
      omega6G: values.omega6G,
      createdAt: new Date().toISOString(),
    });
  }

  function initialValues(entry: FoodLogEntry): Partial<FoodFormValues> {
    const divisor = Math.max(entry.servingMultiplier, 1);
    return {
      name: entry.name,
      servingSize: entry.servingSize,
      servingMultiplier: entry.servingMultiplier,
      calories: entry.calories / divisor,
      proteinG: entry.proteinG / divisor,
      fatG: entry.fatG / divisor,
      totalCarbsG: entry.totalCarbsG / divisor,
      fibreG: entry.fibreG / divisor,
      sugarAlcoholsG: entry.sugarAlcoholsG / divisor,
      sodiumMg: entry.sodiumMg / divisor,
      potassiumMg: entry.potassiumMg / divisor,
      magnesiumMg: entry.magnesiumMg / divisor,
      calciumMg: entry.calciumMg === undefined ? undefined : entry.calciumMg / divisor,
      ironMg: entry.ironMg === undefined ? undefined : entry.ironMg / divisor,
      zincMg: entry.zincMg === undefined ? undefined : entry.zincMg / divisor,
      vitaminDMcg: entry.vitaminDMcg === undefined ? undefined : entry.vitaminDMcg / divisor,
      vitaminB12Mcg: entry.vitaminB12Mcg === undefined ? undefined : entry.vitaminB12Mcg / divisor,
      omega3G: entry.omega3G === undefined ? undefined : entry.omega3G / divisor,
      omega6G: entry.omega6G === undefined ? undefined : entry.omega6G / divisor,
    };
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
          {entriesByMeal.map((group) => {
            if (group.entries.length === 0) {
              return (
                <li key={group.id} className="meal-log-section meal-log-section--empty">
                  <div className="meal-log-header">
                    <strong>{group.label}</strong>
                    <span>No entries</span>
                  </div>
                </li>
              );
            }

            const totals = group.entries.reduce((acc, entry) => ({
              calories: acc.calories + entry.calories,
              netCarbsG: acc.netCarbsG + calcNetCarbs(entry.totalCarbsG, entry.fibreG, entry.sugarAlcoholsG),
            }), { calories: 0, netCarbsG: 0 });

            return (
              <li key={group.id} className="meal-log-section">
                <div className="meal-log-header">
                  <strong>{group.label}</strong>
                  <span>{Math.round(totals.calories)} kcal · {totals.netCarbsG.toFixed(1)}g net carbs</span>
                </div>
                <ul className="meal-log-items">
                  {group.entries.map((entry) => {
                    const netCarbs = calcNetCarbs(entry.totalCarbsG, entry.fibreG, entry.sugarAlcoholsG);
                    return (
                      <li key={entry.id} className="log-item">
                        {editingId === entry.id ? (
                          <div className="log-item-edit">
                            <FoodForm
                              initial={initialValues(entry)}
                              onSubmit={(vals) => handleEditSubmit(entry, vals)}
                              submitLabel="Save changes"
                              savedFoods={savedFoods}
                              onSaveAsFood={saveEditedEntryAsFood}
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
                                {Math.round(entry.calories)} kcal · {entry.proteinG.toFixed(1)}g protein ·{' '}
                                {netCarbs.toFixed(1)}g net carbs · {entry.fatG.toFixed(1)}g fat
                              </span>
                            </div>
                            <div className="log-item-actions">
                              <label className="meal-select-label">
                                <span>Meal</span>
                                <select
                                  value={entryMeal(entry)}
                                  aria-label={`Meal for ${entry.name}`}
                                  onChange={(event) => onEdit({ ...entry, meal: event.target.value as FoodLogEntry['meal'] })}
                                >
                                  {MEAL_SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{mealLabel(slot.id)}</option>)}
                                </select>
                              </label>
                              <button className="btn btn--secondary btn--sm" onClick={() => onDuplicate(entry, selectedDate)}>
                                Duplicate
                              </button>
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
