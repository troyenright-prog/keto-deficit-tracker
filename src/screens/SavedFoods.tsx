import { useState } from 'react';
import type { FoodItem } from '../types';
import { calcNetCarbs } from '../lib/nutrition';

interface SavedFoodsProps {
  foods: FoodItem[];
  onDelete: (id: string) => void;
  onAddToLog: (food: FoodItem) => void;
}

export function SavedFoods({ foods, onDelete, onAddToLog }: SavedFoodsProps) {
  const [search, setSearch] = useState('');

  const filtered = foods.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Saved Foods</h1>
      </div>

      {foods.length === 0 ? (
        <p className="empty-hint">
          No saved foods yet. Use "Save as food" when adding food to build your library.
        </p>
      ) : (
        <>
          <input
            type="search"
            className="search-input"
            placeholder="Search saved foods…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

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
