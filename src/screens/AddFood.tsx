import { useEffect, useMemo, useState } from 'react';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import type { FoodDatabaseItem, FoodItem, FoodLogEntry, MealTemplate, Recipe } from '../types';
import { calcNetCarbs, savedFoodToLogEntry, todayDateString } from '../lib/nutrition';
import { addLocalDays, isDateString } from '../lib/date';
import { nanoid } from '../lib/nanoid';
import { recipeToLogEntry } from '../lib/recipes';
import { templateToLogEntries } from '../lib/meal-templates';
import { getStarterFoodOptions } from '../lib/australianFoods';
import { inferMealSlot, MEAL_SLOTS } from '../lib/meals';
import {
  buildQuickAddGroups, copyLogEntries, recentFoodsFromLog, type QuickAddItem,
} from '../lib/quick-add';
import { pickMicronutrients, scaleMicronutrients } from '../lib/micronutrients';
import { barcodeFoodToSavedFood, type BarcodeFood } from '../lib/barcode';
import { barcodeFoodToFoodDatabaseItem } from '../lib/food-database';
import { MIN_FOOD_SEARCH_LENGTH, searchFoodsByName } from '../lib/food-search';

interface AddFoodProps {
  savedFoods: FoodItem[];
  foodDatabase: FoodDatabaseItem[];
  log: FoodLogEntry[];
  recipes: Recipe[];
  templates: MealTemplate[];
  onAdd: (entry: FoodLogEntry) => boolean;
  onAddEntries: (entries: FoodLogEntry[]) => boolean;
  onSaveFood: (food: FoodItem) => boolean;
  onSaveFoodDatabaseItem?: (item: FoodDatabaseItem) => boolean;
  onScanBarcode?: () => void;
}

const QUICK_AMOUNTS = [0.5, 1, 1.5, 2];
const BOILED_EGG_QUANTITIES = [1, 2, 3] as const;
const BOILED_EGG_FOOD: FoodItem = {
  id: 'quick-boiled-egg-large',
  name: 'Boiled egg (large)',
  servingSize: '1 egg (55g)',
  calories: 78,
  proteinG: 6.3,
  fatG: 5.3,
  totalCarbsG: 0.6,
  fibreG: 0,
  sugarAlcoholsG: 0,
  sodiumMg: 62,
  potassiumMg: 63,
  magnesiumMg: 6,
  createdAt: '2020-01-01T00:00:00.000Z',
  isStarter: true,
};

export function AddFood({ savedFoods, foodDatabase, log, recipes, templates, onAdd, onAddEntries, onSaveFood, onSaveFoodDatabaseItem, onScanBarcode }: AddFoodProps) {
  const [date, setDate] = useState(todayDateString());
  const [meal, setMeal] = useState(inferMealSlot());
  const [successMsg, setSuccessMsg] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<QuickAddItem | null>(null);
  const [multiplier, setMultiplier] = useState('1');
  const [quickError, setQuickError] = useState('');
  const [dateError, setDateError] = useState('');
  const [remoteResults, setRemoteResults] = useState<BarcodeFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Debounced Open Food Facts name search so typing pulls in packaged foods that
  // have not been scanned yet. All state updates happen inside the debounced
  // callback (never synchronously in the effect body), and stale responses are
  // ignored via the cancel flag.
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const handle = setTimeout(() => {
      if (q.length < MIN_FOOD_SEARCH_LENGTH) {
        setRemoteResults([]);
        setSearching(false);
        setSearchError('');
        return;
      }
      setSearching(true);
      setSearchError('');
      searchFoodsByName(q)
        .then((foods) => { if (!cancelled) { setRemoteResults(foods); setSearching(false); } })
        .catch((err) => {
          if (cancelled) return;
          setRemoteResults([]);
          setSearching(false);
          setSearchError(err instanceof Error ? err.message : 'Food search failed.');
        });
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query]);

  const recentFoods = useMemo(() => recentFoodsFromLog(log), [log]);
  const remoteFoods = useMemo(
    () => remoteResults.map((food) => ({ ...barcodeFoodToSavedFood(food), id: `off-${food.barcode}` })),
    [remoteResults],
  );
  const groups = useMemo(() => buildQuickAddGroups({
    query, savedFoods, foodDatabase, recentFoods, recipes, templates, starterFoods: getStarterFoodOptions(), remoteFoods,
  }), [query, savedFoods, foodDatabase, recentFoods, recipes, templates, remoteFoods]);
  const previousDate = addLocalDays(date, -1);
  const previousEntries = log.filter((entry) => entry.date === previousDate);
  const previewMultiplier = Number(multiplier);
  const previewScale = Number.isFinite(previewMultiplier) && previewMultiplier > 0 ? previewMultiplier : 1;
  const selectedNutrition = selected && 'food' in selected ? {
    calories: selected.food.calories * previewScale,
    proteinG: selected.food.proteinG * previewScale,
    netCarbsG: calcNetCarbs(selected.food.totalCarbsG, selected.food.fibreG, selected.food.sugarAlcoholsG) * previewScale,
    fatG: selected.food.fatG * previewScale,
  } : null;

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

  function validLogDate(): boolean {
    if (!isDateString(date) || date > todayDateString()) {
      setDateError('Choose a valid log date that is not in the future.');
      return false;
    }
    setDateError('');
    return true;
  }

  function addSelected() {
    if (!selected) return;
    if (!validLogDate()) return;
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
      } else if (selected.kind === 'database' && selected.food.barcode) {
        entry.source = 'barcode';
      }
      entries = [entry];
    }
    if (!onAddEntries(entries)) return;
    // Cache an Open Food Facts search hit into the local database so it becomes
    // instantly (and offline) name-searchable next time, like a scanned food.
    if (onSaveFoodDatabaseItem && selected.kind === 'database') {
      const remoteHit = remoteResults.find((food) => `off-${food.barcode}` === selected.id);
      if (remoteHit) onSaveFoodDatabaseItem(barcodeFoodToFoodDatabaseItem(remoteHit));
    }
    showSuccess(`"${selected.name}" added to ${date === todayDateString() ? 'today' : date}.`);
    setSelected(null);
    setMultiplier('1');
    setQuery('');
  }

  function selectBoiledEggs(quantity: number) {
    setSelected({ kind: 'starter', id: BOILED_EGG_FOOD.id, name: BOILED_EGG_FOOD.name, food: BOILED_EGG_FOOD });
    setMultiplier(String(quantity));
    setQuickError('');
    setQuery('');
  }

  function copyEntries(entries: FoodLogEntry[]) {
    if (!validLogDate()) return;
    if (!onAddEntries(copyLogEntries(entries, date))) return;
    showSuccess(`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} copied from ${previousDate}.`);
  }

  function handleSubmit(values: FoodFormValues) {
    if (!validLogDate()) return;
    const m = values.servingMultiplier;
    const entry: FoodLogEntry = {
      id: nanoid(), date, name: values.name, servingSize: values.servingSize, servingMultiplier: m,
      meal,
      calories: values.calories * m, proteinG: values.proteinG * m, fatG: values.fatG * m,
      totalCarbsG: values.totalCarbsG * m, fibreG: values.fibreG * m,
      sugarAlcoholsG: values.sugarAlcoholsG * m, sodiumMg: values.sodiumMg * m,
      potassiumMg: values.potassiumMg * m, magnesiumMg: values.magnesiumMg * m,
      ...scaleMicronutrients(values, m),
      loggedAt: new Date().toISOString(),
    };
    if (onAdd(entry)) showSuccess(`"${values.name}" added to ${date === todayDateString() ? 'today' : date}.`);
  }

  function handleSaveFood(values: FoodFormValues) {
    const food: FoodItem = {
      id: nanoid(), name: values.name, servingSize: values.servingSize,
      calories: values.calories, proteinG: values.proteinG, fatG: values.fatG,
      totalCarbsG: values.totalCarbsG, fibreG: values.fibreG, sugarAlcoholsG: values.sugarAlcoholsG,
      sodiumMg: values.sodiumMg, potassiumMg: values.potassiumMg, magnesiumMg: values.magnesiumMg,
      ...pickMicronutrients(values),
      createdAt: new Date().toISOString(), isFavourite: false,
    };
    if (onSaveFood(food)) showSuccess(`"${values.name}" saved to your food library.`);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Add Food</h1>
        {onScanBarcode && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={onScanBarcode}>Scan barcode</button>
        )}
      </div>
      <p className="empty-hint empty-hint--compact">No barcode? Search below or enter the food manually — ideal for fruit, veg and home-cooked meals.</p>
      {successMsg && <div className="success-toast">{successMsg}</div>}

      <div className="form-group">
        <label htmlFor="quick-date">Add to date</label>
        <input id="quick-date" type="date" value={date} max={todayDateString()} onChange={(event) => { setDate(event.target.value); setSelected(null); setDateError(''); }} />
        {dateError && <span className="form-error" role="alert">{dateError}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="quick-meal">Meal</label>
        <select id="quick-meal" value={meal} onChange={(event) => setMeal(event.target.value as typeof meal)}>
          {MEAL_SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
        </select>
      </div>

      <div className="section-title">Quick add</div>
      <div className="boiled-egg-quick" aria-label="Boiled eggs quick entry">
        <span>Boiled eggs</span>
        <div>
          {BOILED_EGG_QUANTITIES.map((quantity) => (
            <button
              key={quantity}
              type="button"
              className="serving-chip"
              onClick={() => selectBoiledEggs(quantity)}
            >
              {quantity} {quantity === 1 ? 'egg' : 'eggs'}
            </button>
          ))}
        </div>
      </div>
      <input
        type="search" className="search-input" placeholder="Search foods, recipes and meals..."
        value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }}
      />
      {searching && <p className="empty-hint empty-hint--compact" role="status">Searching Open Food Facts…</p>}
      {searchError && <p className="form-error" role="alert">{searchError}</p>}

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
          {selectedNutrition && (
            <div className="quick-nutrition-preview" aria-label="Selected food nutrition for chosen servings">
              <span>{Math.round(selectedNutrition.calories)} kcal</span>
              <span>{selectedNutrition.proteinG.toFixed(1)}g protein</span>
              <span>{selectedNutrition.netCarbsG.toFixed(1)}g net carbs</span>
              <span>{selectedNutrition.fatG.toFixed(1)}g fat</span>
            </div>
          )}
          <div className="serving-options">
            {QUICK_AMOUNTS.map((amount) => (
              <button key={amount} className={`serving-chip${multiplier === String(amount) ? ' serving-chip--active' : ''}`} onClick={() => { setMultiplier(String(amount)); setQuickError(''); }}>
                {amount}x
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
            <div><strong>Copy from {previousDate}</strong><div className="dim">Reuse yesterday's nutrition snapshots</div></div>
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
