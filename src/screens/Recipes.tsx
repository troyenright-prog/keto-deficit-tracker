import { useState } from 'react';
import type { Recipe, RecipeIngredient } from '../types';
import { calcRecipeTotals, calcRecipePerServing, emptyIngredient } from '../lib/recipes';
import { nanoid } from '../lib/nanoid';

interface RecipesProps {
  recipes: Recipe[];
  onSave: (recipe: Recipe) => boolean;
  onDelete: (id: string) => void;
  onAddToLog: (recipe: Recipe, servings: number) => void;
}

type View = 'list' | 'edit';

function num(val: string, min = 0): number {
  const n = parseFloat(val);
  return Number.isFinite(n) ? Math.max(min, n) : 0;
}

export function Recipes({ recipes, onSave, onDelete, onAddToLog }: RecipesProps) {
  const [view, setView] = useState<View>('list');
  const [editTarget, setEditTarget] = useState<Recipe | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftServings, setDraftServings] = useState(4);
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredient[]>([emptyIngredient()]);
  const [logServings, setLogServings] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState('');

  function startNew() {
    setDraftName('');
    setDraftServings(4);
    setDraftIngredients([emptyIngredient()]);
    setEditTarget(null);
    setView('edit');
  }

  function startEdit(recipe: Recipe) {
    setDraftName(recipe.name);
    setDraftServings(recipe.servings);
    setDraftIngredients([...recipe.ingredients]);
    setEditTarget(recipe);
    setView('edit');
  }

  function cancel() {
    setView('list');
  }

  function updateIngredient(id: string, field: keyof RecipeIngredient, value: string) {
    setDraftIngredients((ings) =>
      ings.map((ing) => {
        if (ing.id !== id) return ing;
        if (field === 'name' || field === 'servingSize') {
          return { ...ing, [field]: value };
        }
        return { ...ing, [field]: num(value) };
      }),
    );
  }

  function removeIngredient(id: string) {
    setDraftIngredients((ings) => ings.filter((i) => i.id !== id));
  }

  function addIngredient() {
    setDraftIngredients((ings) => [...ings, emptyIngredient()]);
  }

  function saveRecipe() {
    if (!draftName.trim()) { setValidationError('Recipe name is required.'); return; }
    if (!Number.isFinite(draftServings) || draftServings <= 0) { setValidationError('Recipe servings must be greater than zero.'); return; }
    if (draftIngredients.length === 0) { setValidationError('Add at least one ingredient.'); return; }
    if (draftIngredients.some((ing) => !ing.name.trim())) { setValidationError('Every ingredient needs a name.'); return; }
    if (draftIngredients.some((ing) => !Number.isFinite(ing.quantity) || ing.quantity <= 0)) {
      setValidationError('Every ingredient quantity must be greater than zero.'); return;
    }
    setValidationError('');
    const recipe: Recipe = {
      id: editTarget?.id ?? nanoid(),
      name: draftName.trim(),
      servings: Math.max(1, draftServings),
      ingredients: draftIngredients,
      createdAt: editTarget?.createdAt ?? new Date().toISOString(),
      updatedAt: editTarget ? new Date().toISOString() : undefined,
    };
    if (!onSave(recipe)) return;
    setView('list');
  }

  if (view === 'edit') {
    const totals = calcRecipeTotals({ id: '', name: draftName, servings: draftServings, ingredients: draftIngredients, createdAt: '' });
    const perServing = draftServings > 0
      ? { calories: totals.calories / draftServings, netCarbsG: totals.netCarbsG / draftServings, proteinG: totals.proteinG / draftServings, fatG: totals.fatG / draftServings }
      : null;

    return (
      <div className="screen">
        <div className="screen-header">
          <h1>{editTarget ? 'Edit Recipe' : 'New Recipe'}</h1>
          <button className="btn btn--ghost btn--sm" onClick={cancel}>Cancel</button>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label htmlFor="recipe-name">Recipe name</label>
            <input
              id="recipe-name"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="e.g. Keto beef stir-fry"
            />
          </div>
          <div className="form-group">
            <label htmlFor="recipe-servings">Servings</label>
            <input
              id="recipe-servings"
              type="number"
              min="1"
              step="1"
              value={draftServings}
              onChange={(e) => setDraftServings(num(e.target.value, 1))}
            />
          </div>
        </div>

        <div className="form-section-title">Ingredients</div>

        {draftIngredients.map((ing, idx) => (
          <div key={ing.id} className="ingredient-row">
            <div className="ingredient-header">
              <span className="ingredient-num">{idx + 1}.</span>
              <div className="form-group" style={{ flex: 2 }}>
                <input
                  type="text"
                  placeholder="Ingredient name"
                  value={ing.name}
                  onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)}
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Serving size"
                  value={ing.servingSize}
                  onChange={(e) => updateIngredient(ing.id, 'servingSize', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>×qty</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={ing.quantity}
                  className="qty-input"
                  onChange={(e) => updateIngredient(ing.id, 'quantity', e.target.value)}
                />
              </div>
              <button className="btn btn--danger btn--xs" onClick={() => removeIngredient(ing.id)}>✕</button>
            </div>
            <div className="ingredient-nutrition">
              {(['calories', 'proteinG', 'fatG', 'totalCarbsG', 'fibreG', 'sodiumMg'] as const).map((field) => (
                <div key={field} className="form-group form-group--tiny">
                  <label>{field === 'calories' ? 'kcal' : field === 'proteinG' ? 'prot g' : field === 'fatG' ? 'fat g' : field === 'totalCarbsG' ? 'carb g' : field === 'fibreG' ? 'fibre g' : 'Na mg'}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={ing[field]}
                    onChange={(e) => updateIngredient(ing.id, field, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <button className="btn btn--ghost btn--sm" onClick={addIngredient}>+ Add ingredient</button>

        {draftIngredients.length > 0 && (
          <div className="template-totals">
            <strong>Total:</strong>
            <span>{Math.round(totals.calories)} kcal</span>
            <span>{totals.netCarbsG.toFixed(1)}g net carbs</span>
            {perServing && (
              <>
                <strong>Per serving:</strong>
                <span>{Math.round(perServing.calories)} kcal</span>
                <span>{perServing.netCarbsG.toFixed(1)}g net carbs</span>
                <span>{perServing.proteinG.toFixed(1)}g protein</span>
                <span>{perServing.fatG.toFixed(1)}g fat</span>
              </>
            )}
          </div>
        )}

        <div className="form-actions">
          <button
            className="btn btn--primary"
            onClick={saveRecipe}
            disabled={!draftName.trim() || draftIngredients.length === 0}
          >
            Save recipe
          </button>
        </div>
        {validationError && <p className="form-error" role="alert">{validationError}</p>}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Recipes</h1>
        <button className="btn btn--primary btn--sm" onClick={startNew}>+ New</button>
      </div>

      {recipes.length === 0 ? (
        <p className="empty-hint">
          No recipes yet. Build a recipe from ingredients and log it by the serving.
        </p>
      ) : (
        <ul className="template-list">
          {recipes.map((r) => {
            const ps = calcRecipePerServing(r);
            const logVal = logServings[r.id] ?? '1';
            return (
              <li key={r.id} className="template-list-item">
                <div className="template-list-info">
                  <span className="template-list-name">{r.name}</span>
                  <span className="saved-food-macros">
                    {r.servings} serving{r.servings !== 1 ? 's' : ''} · per serving:{' '}
                    {Math.round(ps.calories)} kcal · {ps.proteinG.toFixed(1)}g protein ·{' '}
                    {ps.netCarbsG.toFixed(1)}g net carbs
                  </span>
                </div>
                <div className="saved-food-actions">
                  <div className="log-servings-row">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={logVal}
                      className="qty-input"
                      onChange={(e) => setLogServings((s) => ({ ...s, [r.id]: e.target.value }))}
                    />
                    <span className="dim">serving{parseFloat(logVal) !== 1 ? 's' : ''}</span>
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => {
                        const servings = parseFloat(logVal);
                        if (!Number.isFinite(servings) || servings <= 0) {
                          setValidationError('Servings to log must be greater than zero.'); return;
                        }
                        setValidationError(''); onAddToLog(r, servings);
                      }}
                    >
                      Log today
                    </button>
                  </div>
                  <button className="btn btn--ghost btn--sm" onClick={() => startEdit(r)}>Edit</button>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => { if (confirm(`Delete recipe "${r.name}"?`)) onDelete(r.id); }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {validationError && <p className="form-error" role="alert">{validationError}</p>}
    </div>
  );
}
