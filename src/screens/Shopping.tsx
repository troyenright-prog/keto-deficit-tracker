import { useState } from 'react';
import type { ShoppingItem, MealTemplate, Recipe } from '../types';
import { nanoid } from '../lib/nanoid';

interface ShoppingProps {
  items: ShoppingItem[];
  templates: MealTemplate[];
  recipes: Recipe[];
  onSave: (items: ShoppingItem[]) => void;
}

export function Shopping({ items, templates, recipes, onSave }: ShoppingProps) {
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');

  function addManual() {
    if (!newItemName.trim()) return;
    const item: ShoppingItem = {
      id: nanoid(),
      name: newItemName.trim(),
      quantity: newItemQty.trim() || undefined,
      completed: false,
      source: 'manual',
      createdAt: new Date().toISOString(),
    };
    onSave([...items, item]);
    setNewItemName('');
    setNewItemQty('');
  }

  function toggle(id: string) {
    onSave(items.map((i) => i.id === id ? { ...i, completed: !i.completed } : i));
  }

  function remove(id: string) {
    onSave(items.filter((i) => i.id !== id));
  }

  function clearCompleted() {
    onSave(items.filter((i) => !i.completed));
  }

  function generateFromTemplate(template: MealTemplate) {
    const newItems: ShoppingItem[] = template.items.map((item) => ({
      id: nanoid(),
      name: item.name,
      quantity: item.quantity !== 1 ? `×${item.quantity} (${item.servingSize})` : item.servingSize,
      completed: false,
      source: 'template' as const,
      sourceId: template.id,
      createdAt: new Date().toISOString(),
    }));
    onSave([...items, ...newItems]);
  }

  function generateFromRecipe(recipe: Recipe) {
    const newItems: ShoppingItem[] = recipe.ingredients.map((ing) => ({
      id: nanoid(),
      name: ing.name,
      quantity: ing.quantity !== 1 ? `×${ing.quantity} (${ing.servingSize})` : ing.servingSize,
      completed: false,
      source: 'recipe' as const,
      sourceId: recipe.id,
      createdAt: new Date().toISOString(),
    }));
    onSave([...items, ...newItems]);
  }

  const pending = items.filter((i) => !i.completed);
  const completed = items.filter((i) => i.completed);

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Shopping List</h1>
        {completed.length > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={clearCompleted}>
            Clear done ({completed.length})
          </button>
        )}
      </div>

      <div className="shopping-add-row">
        <input
          type="text"
          placeholder="Item name"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addManual()}
          className="search-input"
        />
        <input
          type="text"
          placeholder="Qty (optional)"
          value={newItemQty}
          onChange={(e) => setNewItemQty(e.target.value)}
          className="qty-text-input"
          style={{ width: '100px' }}
        />
        <button className="btn btn--primary btn--sm" onClick={addManual}>Add</button>
      </div>

      {(templates.length > 0 || recipes.length > 0) && (
        <div className="shopping-generate">
          <div className="form-section-title">Generate from</div>
          <div className="generate-buttons">
            {templates.map((t) => (
              <button key={t.id} className="btn btn--ghost btn--sm" onClick={() => generateFromTemplate(t)}>
                + {t.name}
              </button>
            ))}
            {recipes.map((r) => (
              <button key={r.id} className="btn btn--ghost btn--sm" onClick={() => generateFromRecipe(r)}>
                + {r.name} (recipe)
              </button>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="empty-hint">Your shopping list is empty. Add items above or generate from a template or recipe.</p>
      ) : (
        <>
          {pending.length > 0 && (
            <ul className="shopping-list">
              {pending.map((item) => (
                <li key={item.id} className="shopping-item">
                  <label className="shopping-check-label">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => toggle(item.id)}
                    />
                    <span className="shopping-item-name">{item.name}</span>
                    {item.quantity && <span className="shopping-item-qty dim">{item.quantity}</span>}
                    {item.source !== 'manual' && (
                      <span className="shopping-item-source dim">{item.source}</span>
                    )}
                  </label>
                  <button className="btn btn--ghost btn--xs" onClick={() => remove(item.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}

          {completed.length > 0 && (
            <>
              <div className="form-section-title" style={{ marginTop: '1rem' }}>
                Done ({completed.length})
              </div>
              <ul className="shopping-list shopping-list--done">
                {completed.map((item) => (
                  <li key={item.id} className="shopping-item shopping-item--done">
                    <label className="shopping-check-label">
                      <input
                        type="checkbox"
                        checked
                        onChange={() => toggle(item.id)}
                      />
                      <span className="shopping-item-name">{item.name}</span>
                      {item.quantity && <span className="dim">{item.quantity}</span>}
                    </label>
                    <button className="btn btn--ghost btn--xs" onClick={() => remove(item.id)}>✕</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
