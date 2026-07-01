import { useState } from 'react';
import type { FoodItem } from '../types';
import { calcNetCarbs } from '../lib/nutrition';
import { FoodForm, type FoodFormValues } from '../components/FoodForm';
import { nanoid } from '../lib/nanoid';
import { getStarterFoods } from '../lib/australianFoods';
import { foodSignature } from '../lib/quick-add';
import { hasAnyMicronutrients, pickMicronutrients } from '../lib/micronutrients';

interface SavedFoodsProps {
  foods: FoodItem[];
  onSave: (food: FoodItem) => boolean;
  onDelete: (id: string) => boolean;
  onAddToLog: (food: FoodItem) => void;
}

export function SavedFoods({ foods, onSave, onDelete, onAddToLog }: SavedFoodsProps) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [message, setMessage] = useState('');

  const filtered = foods
    .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.isFavourite === true) - Number(a.isFavourite === true) || a.name.localeCompare(b.name));

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(''), 2500);
  }

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
    if (saved) {
      setEditing(null);
      showMessage(`Saved "${values.name}".`);
    }
  }

  function handleAddNew(values: FoodFormValues) {
    const saved = onSave({
      id: nanoid(),
      createdAt: new Date().toISOString(),
      ...values,
    });
    if (saved) {
      setAddingNew(false);
      showMessage(`Added "${values.name}" to saved foods.`);
    }
  }

  function handleLoadStarter() {
    const existing = new Set(foods.map(foodSignature));
    const starters = getStarterFoods().filter((food) => !existing.has(foodSignature(food)));
    if (starters.length === 0) return;
    if (!confirm(`Add ${starters.length} missing Australian keto starter foods? Existing and edited foods will not be changed.`)) return;
    let added = 0;
    for (const food of starters) {
      if (!onSave(food)) break;
      added += 1;
    }
    if (added > 0) showMessage(`Loaded ${added} starter food${added === 1 ? '' : 's'}.`);
  }

  const starterMissing = getStarterFoods().filter((food) => !new Set(foods.map(foodSignature)).has(foodSignature(food))).length;

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
        ...pickMicronutrients(editing),
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
      {message && <div className="success-toast">{message}</div>}

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
          <button className="btn btn--secondary" onClick={handleLoadStarter} disabled={starterMissing === 0}>
            {starterMissing === 0 ? 'Starter foods loaded' : `Load ${starterMissing} starter foods`}
          </button>
        </div>
      ) : (
        <>
          <div className="search-row">
            <input
              type="search"
              className="search-input"
              placeholder="Search saved foods..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn--ghost btn--sm" onClick={handleLoadStarter} disabled={starterMissing === 0}>
              {starterMissing === 0 ? 'Starter foods loaded' : `+ ${starterMissing} starter foods`}
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
                        {Math.round(food.calories)} kcal - {food.proteinG.toFixed(1)}g protein -{' '}
                        {netCarbs.toFixed(1)}g net carbs - {food.fatG.toFixed(1)}g fat
                      </span>
                      {(food.sodiumMg > 0 || food.potassiumMg > 0 || food.magnesiumMg > 0) && (
                        <span className="saved-food-electrolytes">
                          Na {food.sodiumMg}mg - K {food.potassiumMg}mg - Mg {food.magnesiumMg}mg
                        </span>
                      )}
                      {hasAnyMicronutrients(food) && (
                        <span className="saved-food-electrolytes">
                          Micronutrients logged
                        </span>
                      )}
                    </div>
                    <div className="saved-food-actions">
                      <button
                        className={`btn btn--sm ${food.isFavourite ? 'btn--favourite' : 'btn--ghost'}`}
                        aria-label={food.isFavourite ? `Unfavourite ${food.name}` : `Favourite ${food.name}`}
                        onClick={() => {
                          const nextFavourite = !food.isFavourite;
                          if (onSave({ ...food, isFavourite: nextFavourite, updatedAt: new Date().toISOString() })) {
                            showMessage(`${nextFavourite ? 'Favorited' : 'Unfavorited'} "${food.name}".`);
                          }
                        }}
                      >
                        {food.isFavourite ? 'Favorited' : 'Favorite'}
                      </button>
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
                          if (confirm(`Delete "${food.name}" from saved foods?`) && onDelete(food.id)) showMessage(`Deleted "${food.name}".`);
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
