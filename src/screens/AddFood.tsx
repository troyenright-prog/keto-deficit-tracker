import { useMemo, useState } from 'react';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import type { FoodItem, FoodLogEntry, MealTemplate, Recipe } from '../types';
import { savedFoodToLogEntry, todayDateString } from '../lib/nutrition';
import { addLocalDays } from '../lib/date';
import { nanoid } from '../lib/nanoid';
import { recipeToLogEntry } from '../lib/recipes';
import { templateToLogEntries } from '../lib/meal-templates';
import { getStarterFoodOptions } from '../lib/australianFoods';
import { inferMealSlot, MEAL_SLOTS } from '../lib/meals';
import {
  buildQuickAddGroups, copyLogEntries, recentFoodsFromLog, type QuickAddItem,
} from '../lib/quick-add';

interface AddFoodProps {
  savedFoods: FoodItem[];
  log: FoodLogEntry[];
  recipes: Recipe[];
  templates: MealTemplate[];
  onAdd: (entry: FoodLogEntry) => boolean;
  onAddEntries: (entries: FoodLogEntry[]) => boolean;
  onSaveFood: (food: FoodItem) => boolean;
}

const QUICK_AMOUNTS = [0.5, 1, 1.5, 2];

export function AddFood({ savedFoods, log, recipes, templates, onAdd, onAddEntries, onSaveFood }: AddFoodProps) {
  const [date, setDate] = useState(todayDateString());
  const [meal, setMeal] = useState(inferMealSlot());
  const [successMsg, setSuccessMsg] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<QuickAddItem | null>(null);
  const [multiplier, setMultiplier] = useState('1');
  const [quickError, setQuickError] = useState('');

  const recentFoods = useMemo(() => recentFoodsFromLog(log), [log]);
  const groups = useMemo(() => buildQuickAddGroups({
    query, savedFoods, recentFoods, recipes, templates, starterFoods: getStarterFoodOptions(),
  }), [query, savedFoods, recentFoods, recipes, templates]);
  const previousDate = addLocalDays(date, -1);
  const previousEntries = log.filter((entry) => entry.date === previousDate);

  function showSuccess(message: string) {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  function validMultiplier(): number | null {
    const value = Number(multiplier);
    if (!Number.isFinite(value) || value <= 0) {
      setQuickError('Serving quantity must be greater than zero.');
      return null;
    }
    setQuickError('');
    return value;
  }

  function addSelected() {
    if (!selected) return;
    const amount = validMultiplier();
    if (amount === null) return;
    let entries: FoodLogEntry[];
    if (selected.kind === 'recipe') {
      entries = [recipeToLogEntry(selected.recipe, amount, date, meal)];
    } else if (selected.kind === 'template') {
      entries = templateToLogEntries(selected.template, date, amount, meal);
    } else {
      const entry = savedFoodToLogEntry(selected.food, date, amount, meal);
      if (selected.kind === 'recent' || selected.kind === 'starter') {
        delete entry.foodItemId;
        entry.source = 'manual';
      }
      entries = [entry];
    }
    if (!onAddEntries(entries)) return;
    showSuccess(`“${selected.name}” added to ${date === todayDateString() ? 'today' : date}.`);
    setSelected(null);
    setMultiplier('1');
    setQuery('');
  }

  function copyEntries(entries: FoodLogEntry[]) {
    if (!onAddEntries(copyLogEntries(entries, date))) return;
    showSuccess(`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} copied from ${previousDate}.`);
  }

  function handleSubmit(values: FoodFormValues) {
    const m = values.servingMultiplier;
    const entry: FoodLogEntry = {
      id: nanoid(), date, name: values.name, servingSize: values.servingSize, servingMultiplier: m,
      meal,
      calories: values.calories * m, proteinG: values.proteinG * m, fatG: values.fatG * m,
      totalCarbsG: values.totalCarbsG * m, fibreG: values.fibreG * m,
      sugarAlcoholsG: values.sugarAlcoholsG * m, sodiumMg: values.sodiumMg * m,
      potassiumMg: values.potassiumMg * m, magnesiumMg: values.magnesiumMg * m,
      calciumMg: values.calciumMg === undefined ? undefined : values.calciumMg * m,
      ironMg: values.ironMg === undefined ? undefined : values.ironMg * m,
      zincMg: values.zincMg === undefined ? undefined : values.zincMg * m,
      vitaminDMcg: values.vitaminDMcg === undefined ? undefined : values.vitaminDMcg * m,
      vitaminB12Mcg: values.vitaminB12Mcg === undefined ? undefined : values.vitaminB12Mcg * m,
      omega3G: values.omega3G === undefined ? undefined : values.omega3G * m,
      omega6G: values.omega6G === undefined ? undefined : values.omega6G * m,
      loggedAt: new Date().toISOString(),
    };
    if (onAdd(entry)) showSuccess(`“${values.name}” added to ${date === todayDateString() ? 'today' : date}.`);
  }

  function handleSaveFood(values: FoodFormValues) {
    const food: FoodItem = {
      id: nanoid(), name: values.name, servingSize: values.servingSize,
      calories: values.calories, proteinG: values.proteinG, fatG: values.fatG,
      totalCarbsG: values.totalCarbsG, fibreG: values.fibreG, sugarAlcoholsG: values.sugarAlcoholsG,
      sodiumMg: values.sodiumMg, potassiumMg: values.potassiumMg, magnesiumMg: values.magnesiumMg,
      calciumMg: values.calciumMg, ironMg: values.ironMg, zincMg: values.zincMg,
      vitaminDMcg: values.vitaminDMcg, vitaminB12Mcg: values.vitaminB12Mcg,
      omega3G: values.omega3G, omega6G: values.omega6G,
      createdAt: new Date().toISOString(), isFavourite: false,
    };
    if (onSaveFood(food)) showSuccess(`“${values.name}” saved to your food library.`);
  }

  return (
    <div className="screen">
      <div className="screen-header"><h1>Add Food</h1></div>
      {successMsg && <div className="success-toast">{successMsg}</div>}

      <div className="form-group">
        <label htmlFor="quick-date">Add to date</label>
        <input id="quick-date" type="date" value={date} max={todayDateString()} onChange={(event) => { setDate(event.target.value); setSelected(null); }} />
      </div>

      <div className="form-group">
        <label htmlFor="quick-meal">Meal</label>
        <select id="quick-meal" value={meal} onChange={(event) => setMeal(event.target.value as typeof meal)}>
          {MEAL_SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
        </select>
      </div>

      <div className="section-title">Quick add</div>
      <input
        type="search" className="search-input" placeholder="Search foods, recipes and meals…"
        value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }}
      />

      {groups.length === 0 ? <p className="empty-hint empty-hint--compact">No matching foods or meals.</p> : (
        <div className="quick-groups">
          {groups.map((group) => (
            <section key={group.key} className="quick-group">
              <h2>{group.label}</h2>
              <div className="quick-result-list">
                {group.items.slice(0, query ? 12 : 6).map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`} className={`quick-result${selected?.kind === item.kind && selected.id === item.id ? ' quick-result--selected' : ''}`}
                    onClick={() => { setSelected(item); setMultiplier('1'); setQuickError(''); }}
                  >
                    <span>{item.name}</span>
                    <small>{item.kind === 'template' && item.template.mealType ? item.template.mealType : item.kind}</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selected && (
        <div className="quick-add-panel">
          <strong>{selected.name}</strong>
          <span className="dim">Choose servings</span>
          <div className="serving-options">
            {QUICK_AMOUNTS.map((amount) => (
              <button key={amount} className={`serving-chip${multiplier === String(amount) ? ' serving-chip--active' : ''}`} onClick={() => { setMultiplier(String(amount)); setQuickError(''); }}>
                {amount}×
              </button>
            ))}
            <input aria-label="Custom serving multiplier" type="number" min="0.1" step="0.1" value={multiplier} onChange={(event) => setMultiplier(event.target.value)} />
          </div>
          {quickError && <span className="form-error" role="alert">{quickError}</span>}
          <button className="btn btn--primary" onClick={addSelected}>Add to {date === todayDateString() ? 'today' : date}</button>
        </div>
      )}

      {previousEntries.length > 0 && (
        <div className="copy-panel">
          <div className="copy-panel-header">
            <div><strong>Copy from {previousDate}</strong><div className="dim">Reuse yesterday’s nutrition snapshots</div></div>
            <button className="btn btn--secondary btn--sm" onClick={() => copyEntries(previousEntries)}>Copy all</button>
          </div>
          <ul>
            {previousEntries.map((entry) => (
              <li key={entry.id}><span>{entry.name}</span><button className="btn btn--ghost btn--xs" onClick={() => copyEntries([entry])}>Copy</button></li>
            ))}
          </ul>
        </div>
      )}

      <details className="manual-entry">
        <summary>Enter food manually</summary>
        <FoodForm onSubmit={handleSubmit} onSaveAsFood={handleSaveFood} savedFoods={savedFoods} />
      </details>
    </div>
  );
}
