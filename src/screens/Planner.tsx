import { useState } from 'react';
import type { MealPlanEntry, FoodItem, MealTemplate, Recipe } from '../types';
import { todayDateString } from '../lib/nutrition';
import { foodToPlanEntry, recipeToPlanEntry, templateToPlanEntry } from '../lib/planner';

interface PlannerProps {
  plan: MealPlanEntry[];
  savedFoods: FoodItem[];
  templates: MealTemplate[];
  recipes: Recipe[];
  onSavePlan: (plan: MealPlanEntry[]) => boolean;
  onConvertToLog: (entries: MealPlanEntry[], nextPlan: MealPlanEntry[]) => boolean;
}

export function Planner({ plan, savedFoods, templates, recipes, onSavePlan, onConvertToLog }: PlannerProps) {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [addType, setAddType] = useState<'food' | 'template' | 'recipe'>('food');
  const [search, setSearch] = useState('');
  const [pendingServings, setPendingServings] = useState<Record<string, string>>({});

  const dayEntries = plan.filter((e) => e.date === selectedDate);

  function addFoodToPlan(food: FoodItem) {
    const entry = foodToPlanEntry(food, selectedDate);
    if (onSavePlan([...plan, entry])) setSearch('');
  }

  function addTemplateToPlan(template: MealTemplate) {
    const entry = templateToPlanEntry(template, selectedDate);
    if (onSavePlan([...plan, entry])) setSearch('');
  }

  function addRecipeToPlan(recipe: Recipe, servings: number) {
    const entry = recipeToPlanEntry(recipe, servings, selectedDate);
    if (onSavePlan([...plan, entry])) setSearch('');
  }

  function removeFromPlan(id: string) {
    onSavePlan(plan.filter((e) => e.id !== id));
  }

  function convertDayToLog() {
    const toConvert = dayEntries.filter((e) => !e.converted);
    if (toConvert.length === 0) return;
    const nextPlan = plan.map((e) => e.date === selectedDate && !e.converted ? { ...e, converted: true } : e);
    onConvertToLog(toConvert, nextPlan);
  }

  const dayTotals = dayEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      netCarbsG: acc.netCarbsG + e.netCarbsG,
      proteinG: acc.proteinG + e.proteinG,
      fatG: acc.fatG + e.fatG,
    }),
    { calories: 0, netCarbsG: 0, proteinG: 0, fatG: 0 },
  );

  const allSearchItems = [
    ...savedFoods.map((f) => ({ type: 'food' as const, id: f.id, name: f.name, item: f })),
    ...templates.map((t) => ({ type: 'template' as const, id: t.id, name: t.name, item: t })),
    ...recipes.map((r) => ({ type: 'recipe' as const, id: r.id, name: r.name, item: r })),
  ];

  const filtered = search.length >= 1
    ? allSearchItems.filter(
        (i) =>
          (addType === 'food' ? i.type === 'food' : addType === 'template' ? i.type === 'template' : i.type === 'recipe') &&
          i.name.toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Meal Planner</h1>
      </div>

      <div className="form-group">
        <label htmlFor="plan-date">Date</label>
        <input
          id="plan-date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <div className="plan-type-tabs">
        {(['food', 'template', 'recipe'] as const).map((t) => (
          <button
            key={t}
            className={`tab-btn${addType === t ? ' tab-btn--active' : ''}`}
            onClick={() => { setAddType(t); setSearch(''); }}
          >
            {t === 'food' ? 'Food' : t === 'template' ? 'Template' : 'Recipe'}
          </button>
        ))}
      </div>

      <div className="form-group">
        <input
          type="search"
          placeholder={`Search ${addType === 'food' ? 'saved foods' : addType === 'template' ? 'meal templates' : 'recipes'}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        {filtered.length > 0 && (
          <ul className="autocomplete-list">
            {filtered.slice(0, 8).map((item) => (
              <li key={item.id}>
                {item.type === 'recipe' ? (
                  <div className="autocomplete-item-row">
                    <span>{item.name}</span>
                    <div className="log-servings-row">
                      <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={pendingServings[item.id] ?? '1'}
                        className="qty-input"
                        onChange={(e) => setPendingServings((s) => ({ ...s, [item.id]: e.target.value }))}
                      />
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => addRecipeToPlan(item.item as Recipe, parseFloat(pendingServings[item.id] ?? '1') || 1)}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="autocomplete-item"
                    onClick={() => {
                      if (item.type === 'food') addFoodToPlan(item.item as FoodItem);
                      else addTemplateToPlan(item.item as MealTemplate);
                    }}
                  >
                    {item.name}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {dayEntries.length > 0 ? (
        <>
          <div className="form-section-title">Plan for {selectedDate}</div>
          <ul className="template-list">
            {dayEntries.map((e) => (
              <li key={e.id} className={`template-list-item${e.converted ? ' plan-item--converted' : ''}`}>
                <div className="template-list-info">
                  <span className="template-list-name">
                    {e.name}
                    {e.converted && <span className="badge-converted">logged</span>}
                  </span>
                  <span className="saved-food-macros">
                    {Math.round(e.calories)} kcal · {e.netCarbsG.toFixed(1)}g net carbs ·{' '}
                    {e.proteinG.toFixed(1)}g protein
                  </span>
                </div>
                <button className="btn btn--ghost btn--xs" onClick={() => removeFromPlan(e.id)}>✕</button>
              </li>
            ))}
          </ul>

          <div className="template-totals">
            <strong>Day total:</strong>
            <span>{Math.round(dayTotals.calories)} kcal</span>
            <span>{dayTotals.netCarbsG.toFixed(1)}g net carbs</span>
            <span>{dayTotals.proteinG.toFixed(1)}g protein</span>
            <span>{dayTotals.fatG.toFixed(1)}g fat</span>
          </div>

          {dayEntries.some((e) => !e.converted) && (
            <button className="btn btn--primary" onClick={convertDayToLog}>
              Add to food log for {selectedDate}
            </button>
          )}
        </>
      ) : (
        <p className="empty-hint">No meals planned for {selectedDate}. Search and add above.</p>
      )}
    </div>
  );
}
