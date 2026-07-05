import { useState } from 'react';
import type { FoodLogEntry, FoodItem, MealSlot } from '../types';
import { calcNetCarbs, safePositive, todayDateString } from '../lib/nutrition';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import { entryMeal, mealLabel, MEAL_SLOTS } from '../lib/meals';
import { entryNeedsNutritionRepair, type RepairResult } from '../lib/barcode';
import { nanoid } from '../lib/nanoid';
import { pickMicronutrients, scaleMicronutrients } from '../lib/micronutrients';

interface DailyLogProps {
  log: FoodLogEntry[];
  savedFoods: FoodItem[];
  onDelete: (id: string) => void;
  onEdit: (entry: FoodLogEntry) => boolean;
  onDuplicate: (entry: FoodLogEntry, targetDate?: string) => boolean;
  onSaveFood: (food: FoodItem) => boolean;
  onRepairScannedNutrition?: () => Promise<RepairResult>;
  onAddFood: () => void;
}

function formatLoggedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function DailyLog({ log, savedFoods, onDelete, onEdit, onDuplicate, onSaveFood, onRepairScannedNutrition, onAddFood }: DailyLogProps) {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const [repairing, setRepairing] = useState(false);

  const repairableCount = log.filter(entryNeedsNutritionRepair).length;

  async function runRepair() {
    if (!onRepairScannedNutrition || repairing) return;
    setRepairing(true);
    try {
      const result = await onRepairScannedNutrition();
      setMessage({ text: result.message, tone: result.ok ? 'success' : 'error' });
    } catch {
      setMessage({ text: 'Something went wrong while fetching nutrition — try again shortly.', tone: 'error' });
    } finally {
      setRepairing(false);
    }
  }

  const dayEntries = log.filter((e) => e.date === selectedDate);
  const dayTotals = dayEntries.reduce((acc, entry) => ({
    calories: acc.calories + entry.calories,
    proteinG: acc.proteinG + entry.proteinG,
    netCarbsG: acc.netCarbsG + calcNetCarbs(entry.totalCarbsG, entry.fibreG, entry.sugarAlcoholsG),
    fatG: acc.fatG + entry.fatG,
  }), { calories: 0, proteinG: 0, netCarbsG: 0, fatG: 0 });
  const entriesByMeal = MEAL_SLOTS.map((slot) => ({
    ...slot,
    entries: dayEntries.filter((entry) => entryMeal(entry) === slot.id),
  }));

  function showMessage(text: string) {
    setMessage({ text, tone: 'success' });
    setTimeout(() => setMessage(null), 2500);
  }

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
      ...scaleMicronutrients(values, m),
    });
    if (saved) {
      setEditingId(null);
      showMessage(`Updated "${values.name}".`);
    }
  }

  function saveEditedEntryAsFood(values: FoodFormValues) {
    if (onSaveFood({
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
      ...pickMicronutrients(values),
      createdAt: new Date().toISOString(),
    })) {
      showMessage(`Saved "${values.name}" to foods.`);
    }
  }

  function initialValues(entry: FoodLogEntry): Partial<FoodFormValues> {
    // The form edits per-serving values and re-scales by servingMultiplier on
    // save, so the divisor must be the multiplier itself — clamping it to >= 1
    // showed a 0.5x entry's totals as "per serving" and then re-halved them on
    // every save.
    const divisor = safePositive(entry.servingMultiplier);
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
      ...scaleMicronutrients(entry, 1 / divisor),
    };
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Daily Log</h1>
        <div className="daily-log-header-actions">
          <input
            type="date"
            value={selectedDate}
            max={todayDateString()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-picker"
          />
          <button type="button" className="btn btn--primary btn--sm" onClick={onAddFood}>+ Add food</button>
        </div>
      </div>

      {message && (
        <div className={message.tone === 'error' ? 'error-toast' : 'success-toast'} role={message.tone === 'error' ? 'alert' : 'status'}>
          {message.text}
        </div>
      )}

      {repairableCount > 0 && onRepairScannedNutrition && (
        <div className="estimate-warning" role="status">
          <strong>Some scanned foods are missing nutrition</strong>
          <span>{repairableCount} logged item{repairableCount === 1 ? '' : 's'} came through with 0 calories. Re-fetch to fill in the macros (serving sizes are kept).</span>
          <button className="btn btn--primary btn--sm" onClick={runRepair} disabled={repairing}>
            {repairing ? 'Fetching nutrition…' : 'Re-fetch nutrition'}
          </button>
        </div>
      )}

      {dayEntries.length === 0 ? (
        <p className="empty-hint">No entries for {selectedDate}.</p>
      ) : (
        <>
          <div className="template-totals daily-log-totals" aria-label="Daily log totals">
            <strong>{dayEntries.length} logged</strong>
            <span>{Math.round(dayTotals.calories)} kcal</span>
            <span>{dayTotals.proteinG.toFixed(1)}g protein</span>
            <span>{dayTotals.netCarbsG.toFixed(1)}g net carbs</span>
            <span>{dayTotals.fatG.toFixed(1)}g fat</span>
          </div>

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
                    <span>{Math.round(totals.calories)} kcal - {totals.netCarbsG.toFixed(1)}g net carbs</span>
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
                            <>
                              <button
                                type="button"
                                className="log-item-row"
                                aria-expanded={expandedId === entry.id}
                                onClick={() => setExpandedId((cur) => (cur === entry.id ? null : entry.id))}
                              >
                                <span className="log-item-time">{formatLoggedTime(entry.loggedAt)}</span>
                                <div className="log-item-info">
                                  <div className="log-item-top">
                                    <span className="log-item-name">{entry.name}</span>
                                    <span className="log-item-kcal">{Math.round(entry.calories)} kcal</span>
                                  </div>
                                  <span className="log-item-sub">
                                    {entry.servingMultiplier !== 1
                                      ? `${entry.servingMultiplier}x ${entry.servingSize}`
                                      : entry.servingSize}
                                    {' · '}{netCarbs.toFixed(1)}g net carbs
                                  </span>
                                </div>
                                <span className={`log-item-chevron${expandedId === entry.id ? ' log-item-chevron--open' : ''}`} aria-hidden="true" />
                              </button>
                              {expandedId === entry.id && (
                                <div className="log-item-actions">
                                  <span className="log-item-full-macros">
                                    {entry.proteinG.toFixed(1)}g protein · {entry.fatG.toFixed(1)}g fat
                                  </span>
                                  <label className="meal-select-label">
                                    <span>Meal</span>
                                    <select
                                      value={entryMeal(entry)}
                                      aria-label={`Meal for ${entry.name}`}
                                      onChange={(event) => {
                                        const nextMeal = event.target.value as MealSlot;
                                        if (onEdit({ ...entry, meal: nextMeal })) {
                                          showMessage(`Moved "${entry.name}" to ${mealLabel(nextMeal)}.`);
                                        }
                                      }}
                                    >
                                      {MEAL_SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{mealLabel(slot.id)}</option>)}
                                    </select>
                                  </label>
                                  <button
                                    className="btn btn--secondary btn--sm"
                                    onClick={() => {
                                      if (onDuplicate(entry, selectedDate)) showMessage(`Duplicated "${entry.name}".`);
                                    }}
                                  >
                                    Duplicate
                                  </button>
                                  <button className="btn btn--ghost btn--sm" onClick={() => setEditingId(entry.id)}>
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn--danger btn--sm"
                                    onClick={() => {
                                      if (confirm(`Delete "${entry.name}"?`)) {
                                        onDelete(entry.id);
                                        showMessage(`Deleted "${entry.name}".`);
                                      }
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
