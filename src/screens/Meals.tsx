import { useState } from 'react';
import type { MealTemplate, MealTemplateItem, FoodItem } from '../types';
import { calcTemplateTotals, foodItemToTemplateItem } from '../lib/meal-templates';
import { nanoid } from '../lib/nanoid';

interface MealsProps {
  templates: MealTemplate[];
  savedFoods: FoodItem[];
  onSave: (template: MealTemplate) => boolean;
  onDelete: (id: string) => void;
  onAddToLog: (template: MealTemplate) => void;
}

type View = 'list' | 'edit';

export function Meals({ templates, savedFoods, onSave, onDelete, onAddToLog }: MealsProps) {
  const [view, setView] = useState<View>('list');
  const [editTarget, setEditTarget] = useState<MealTemplate | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftItems, setDraftItems] = useState<MealTemplateItem[]>([]);
  const [foodSearch, setFoodSearch] = useState('');
  const [validationError, setValidationError] = useState('');
  const [draftMealType, setDraftMealType] = useState<MealTemplate['mealType']>(undefined);

  function startNew() {
    setDraftName('');
    setDraftItems([]);
    setEditTarget(null);
    setDraftMealType(undefined);
    setView('edit');
  }

  function startEdit(template: MealTemplate) {
    setDraftName(template.name);
    setDraftItems([...template.items]);
    setEditTarget(template);
    setDraftMealType(template.mealType);
    setView('edit');
  }

  function cancel() {
    setView('list');
    setFoodSearch('');
  }

  function addFoodToTemplate(food: FoodItem) {
    setDraftItems((items) => [...items, foodItemToTemplateItem(food)]);
    setFoodSearch('');
  }

  function updateItemQty(id: string, qty: number) {
    setDraftItems((items) => items.map((i) => i.id === id ? { ...i, quantity: Math.max(0.1, qty) } : i));
  }

  function removeItem(id: string) {
    setDraftItems((items) => items.filter((i) => i.id !== id));
  }

  function saveTemplate() {
    if (!draftName.trim()) { setValidationError('Template name is required.'); return; }
    if (draftItems.length === 0) { setValidationError('Add at least one food to the template.'); return; }
    if (draftItems.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      setValidationError('Every item quantity must be greater than zero.'); return;
    }
    setValidationError('');
    const template: MealTemplate = {
      id: editTarget?.id ?? nanoid(),
      name: draftName.trim(),
      items: draftItems,
      createdAt: editTarget?.createdAt ?? new Date().toISOString(),
      updatedAt: editTarget ? new Date().toISOString() : undefined,
      mealType: draftMealType,
    };
    if (!onSave(template)) return;
    setView('list');
    setFoodSearch('');
  }

  const matchingFoods = foodSearch.length >= 1
    ? savedFoods.filter((f) => f.name.toLowerCase().includes(foodSearch.toLowerCase()))
    : [];

  if (view === 'edit') {
    const totals = calcTemplateTotals({ id: '', name: draftName, items: draftItems, createdAt: '' });
    return (
      <div className="screen">
        <div className="screen-header">
          <h1>{editTarget ? 'Edit Template' : 'New Template'}</h1>
          <button className="btn btn--ghost btn--sm" onClick={cancel}>Cancel</button>
        </div>

        <div className="form-group">
          <label htmlFor="template-name">Template name</label>
          <input
            id="template-name"
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="e.g. Keto breakfast"
          />
        </div>

        <div className="form-group">
          <label htmlFor="meal-type">Meal shortcut (optional)</label>
          <select id="meal-type" value={draftMealType ?? ''} onChange={(event) => setDraftMealType((event.target.value || undefined) as MealTemplate['mealType'])}>
            <option value="">No shortcut</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>

        <div className="form-section-title">Add foods from library</div>
        <div className="form-group">
          <input
            type="search"
            placeholder="Search saved foods…"
            value={foodSearch}
            onChange={(e) => setFoodSearch(e.target.value)}
            className="search-input"
          />
          {matchingFoods.length > 0 && (
            <ul className="autocomplete-list">
              {matchingFoods.slice(0, 8).map((f) => (
                <li key={f.id}>
                  <button className="autocomplete-item" onClick={() => addFoodToTemplate(f)}>
                    {f.name} <span className="dim">({f.servingSize})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {draftItems.length > 0 && (
          <>
            <div className="form-section-title">Template items</div>
            <ul className="template-items-list">
              {draftItems.map((item) => (
                <li key={item.id} className="template-item">
                  <span className="template-item-name">{item.name}</span>
                  <span className="dim">{item.servingSize}</span>
                  <div className="template-item-controls">
                    <label>×</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={item.quantity}
                      className="qty-input"
                      onChange={(e) => updateItemQty(item.id, parseFloat(e.target.value) || 0.1)}
                    />
                    <button className="btn btn--danger btn--xs" onClick={() => removeItem(item.id)}>✕</button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="template-totals">
              <span>{Math.round(totals.calories)} kcal</span>
              <span>{totals.proteinG.toFixed(1)}g protein</span>
              <span>{totals.netCarbsG.toFixed(1)}g net carbs</span>
              <span>{totals.fatG.toFixed(1)}g fat</span>
            </div>
          </>
        )}

        <div className="form-actions">
          <button
            className="btn btn--primary"
            onClick={saveTemplate}
            disabled={!draftName.trim() || draftItems.length === 0}
          >
            Save template
          </button>
        </div>
        {validationError && <p className="form-error" role="alert">{validationError}</p>}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Meal Templates</h1>
        <button className="btn btn--primary btn--sm" onClick={startNew}>+ New</button>
      </div>

      {templates.length === 0 ? (
        <p className="empty-hint">
          No meal templates yet. Create a template to quickly log repeated meals.
        </p>
      ) : (
        <ul className="template-list">
          {templates.map((t) => {
            const totals = calcTemplateTotals(t);
            return (
              <li key={t.id} className="template-list-item">
                <div className="template-list-info">
                  <span className="template-list-name">{t.name}</span>
                  {t.mealType && <span className="meal-type-badge">{t.mealType}</span>}
                  <span className="saved-food-macros">
                    {Math.round(totals.calories)} kcal · {totals.proteinG.toFixed(1)}g protein ·{' '}
                    {totals.netCarbsG.toFixed(1)}g net carbs · {t.items.length} item{t.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="saved-food-actions">
                  <button className="btn btn--secondary btn--sm" onClick={() => onAddToLog(t)}>
                    Log today
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => startEdit(t)}>
                    Edit
                  </button>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => { if (confirm(`Delete template "${t.name}"?`)) onDelete(t.id); }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
