import { useState } from 'react';
import type { FoodItem } from '../types';
import { calcNetCarbs } from '../lib/nutrition';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import { nanoid } from '../lib/nanoid';
import { getStarterFoods } from '../lib/australianFoods';

interface SavedFoodsProps {
  foods: FoodItem[];
  onSave: (food: FoodItem) => boolean;
  onDelete: (id: string) => void;
  onAddToLog: (food: FoodItem) => void;
}

export function SavedFoods({ foods, onSave, onDelete, onAddToLog }: SavedFoodsProps) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const filtered = foods.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleEdit(food: FoodItem) {
    setEditing(food);
    setAddingNew(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSaveEdit(values: FoodFormValues) {
    if (!editing) return;
    const saved = onSave({
      ...editing,
      ...values,
      updatedAt: new Date().toISOString(),
    });
    if (saved) setEditing(null);
  }

  function handleAddNew(values: FoodFormValues) {
    const saved = onSave({
      id: nanoid(),
      createdAt: new Date().toISOString(),
      ...values,
    });
    if (saved) setAddingNew(false);
  }

  function handleLoadStarter() {
    if (!confirm('This will add ~28 common Australian keto foods to your library. Continue?')) return;
    const starters = getStarterFoods();
    for (const food of starters) {
      if (!onSave(food)) break;
    }
  }

  const editInitial: Partial<FoodFormValues> | undefined = editing
    ? {
        name: editing.name,
        servingSize: editing.servingSize,
        servingMultiplier: 1,
        calories: editing.calories,
        proteinG: editing.proteinG,
        fatG: editing.fatG,
        totalCarbsG: editing.totalCarbsG,
        fibreG: editing.fibreG,
        sugarAlcoholsG: editing.sugarAlcoholsG,
        sodiumMg: editing.sodiumMg,
        potassiumMg: editing.potassiumMg,
        magnesiumMg: editing.magnesiumMg,
        calciumMg: editing.calciumMg,
        ironMg: editing.ironMg,
        zincMg: editing.zincMg,
        vitaminDMcg: editing.vitaminDMcg,
        vitaminB12Mcg: editing.vitaminB12Mcg,
        omega3G: editing.omega3G,
        omega6G: editing.omega6G,
      }
    : undefined;

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Saved Foods</h1>
        <button className="btn btn--primary btn--sm" onClick={() => { setAddingNew(true); setEditing(null); }}>
          + New Food
        </button>
      </div>

      {(addingNew || editing) && (
        <div className="inline-form-panel">
          <div className="inline-form-header">
            <h2>{editing ? `Edit: ${editing.name}` : 'Add new food'}</h2>
            <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(null); setAddingNew(false); }}>
              Cancel
            </button>
          </div>
          <FoodForm
            key={editing?.id ?? 'new-food'}
            initial={editInitial}
            onSubmit={editing ? handleSaveEdit : handleAddNew}
            submitLabel={editing ? 'Save changes' : 'Save food'}
            hideServingMultiplier
          />
        </div>
      )}

      {foods.length === 0 ? (
        <div>
          <p className="empty-hint">
            No saved foods yet. Add a food above, use "Save as food" when logging, or load the starter library.
          </p>
          <button className="btn btn--secondary" onClick={handleLoadStarter}>
            Load Australian keto starter foods
          </button>
        </div>
      ) : (
        <>
          <div className="search-row">
            <input
              type="search"
              className="search-input"
              placeholder="Search saved foods…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn--ghost btn--sm" onClick={handleLoadStarter}>
              + Starter foods
            </button>
          </div>

          {filtered.length === 0 ? (
            <p className="empty-hint">No foods match "{search}".</p>
          ) : (
            <ul className="saved-foods-list">
              {filtered.map((food) => {
                const netCarbs = calcNetCarbs(food.totalCarbsG, food.fibreG, food.sugarAlcoholsG);
                return (
                  <li key={food.id} className="saved-food-item">
                    <div className="saved-food-info">
                      <span className="saved-food-name">{food.name}</span>
                      <span className="saved-food-serving">{food.servingSize}</span>
                      <span className="saved-food-macros">
                        {Math.round(food.calories)} kcal · {food.proteinG.toFixed(1)}g protein ·{' '}
                        {netCarbs.toFixed(1)}g net carbs · {food.fatG.toFixed(1)}g fat
                      </span>
                      {(food.sodiumMg > 0 || food.potassiumMg > 0 || food.magnesiumMg > 0) && (
                        <span className="saved-food-electrolytes">
                          Na {food.sodiumMg}mg · K {food.potassiumMg}mg · Mg {food.magnesiumMg}mg
                        </span>
                      )}
                    </div>
                    <div className="saved-food-actions">
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => onAddToLog(food)}
                      >
                        Add to today
                      </button>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => handleEdit(food)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => {
                          if (confirm(`Delete "${food.name}" from saved foods?`)) onDelete(food.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
