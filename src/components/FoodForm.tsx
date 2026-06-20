import { useState, useEffect } from 'react';
import type { FoodItem } from '../types';
import { calcNetCarbs, todayDateString } from '../lib/nutrition';

export interface FoodFormValues {
  name: string;
  servingSize: string;
  servingMultiplier: number;
  calories: number;
  proteinG: number;
  fatG: number;
  totalCarbsG: number;
  fibreG: number;
  sugarAlcoholsG: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
}

const EMPTY: FoodFormValues = {
  name: '',
  servingSize: '1 serving',
  servingMultiplier: 1,
  calories: 0,
  proteinG: 0,
  fatG: 0,
  totalCarbsG: 0,
  fibreG: 0,
  sugarAlcoholsG: 0,
  sodiumMg: 0,
  potassiumMg: 0,
  magnesiumMg: 0,
};

function clampNum(val: string, min = 0): number {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  return Math.max(min, n);
}

interface FoodFormProps {
  initial?: Partial<FoodFormValues>;
  onSubmit: (values: FoodFormValues) => void;
  onSaveAsFood?: (values: FoodFormValues) => void;
  submitLabel?: string;
  savedFoods?: FoodItem[];
  showDate?: boolean;
  date?: string;
  onDateChange?: (d: string) => void;
}

export function FoodForm({
  initial,
  onSubmit,
  onSaveAsFood,
  submitLabel = 'Add to Log',
  savedFoods = [],
  showDate = false,
  date,
  onDateChange,
}: FoodFormProps) {
  const [values, setValues] = useState<FoodFormValues>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedSaved, setSelectedSaved] = useState('');

  useEffect(() => {
    if (initial) setValues({ ...EMPTY, ...initial });
  }, []);

  function num(key: keyof FoodFormValues, val: string) {
    setValues((v) => ({ ...v, [key]: clampNum(val) }));
  }

  function str(key: keyof FoodFormValues, val: string) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = 'Name is required';
    if (values.fibreG > values.totalCarbsG)
      e.fibreG = 'Fibre cannot exceed total carbs';
    if (values.sugarAlcoholsG > values.totalCarbsG)
      e.sugarAlcoholsG = 'Sugar alcohols cannot exceed total carbs';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(values);
    setValues({ ...EMPTY });
    setSelectedSaved('');
  }

  function handleSaveAsFood(e: React.MouseEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSaveAsFood?.(values);
  }

  function loadSavedFood(id: string) {
    const food = savedFoods.find((f) => f.id === id);
    if (!food) return;
    setValues({
      name: food.name,
      servingSize: food.servingSize,
      servingMultiplier: 1,
      calories: food.calories,
      proteinG: food.proteinG,
      fatG: food.fatG,
      totalCarbsG: food.totalCarbsG,
      fibreG: food.fibreG,
      sugarAlcoholsG: food.sugarAlcoholsG,
      sodiumMg: food.sodiumMg,
      potassiumMg: food.potassiumMg,
      magnesiumMg: food.magnesiumMg,
    });
    setSelectedSaved(id);
  }

  const previewNetCarbs = calcNetCarbs(values.totalCarbsG, values.fibreG, values.sugarAlcoholsG);

  return (
    <form className="food-form" onSubmit={handleSubmit} noValidate>
      {savedFoods.length > 0 && (
        <div className="form-group">
          <label htmlFor="saved-food-select">Load saved food</label>
          <select
            id="saved-food-select"
            value={selectedSaved}
            onChange={(e) => loadSavedFood(e.target.value)}
          >
            <option value="">— choose saved food —</option>
            {savedFoods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.servingSize})
              </option>
            ))}
          </select>
        </div>
      )}

      {showDate && (
        <div className="form-group">
          <label htmlFor="log-date">Date</label>
          <input
            id="log-date"
            type="date"
            value={date ?? todayDateString()}
            max={todayDateString()}
            onChange={(e) => onDateChange?.(e.target.value)}
          />
        </div>
      )}

      <div className="form-group">
        <label htmlFor="food-name">Food name *</label>
        <input
          id="food-name"
          type="text"
          value={values.name}
          onChange={(e) => str('name', e.target.value)}
          placeholder="e.g. Chicken breast"
        />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="serving-size">Serving size</label>
          <input
            id="serving-size"
            type="text"
            value={values.servingSize}
            onChange={(e) => str('servingSize', e.target.value)}
            placeholder="e.g. 100g"
          />
        </div>
        <div className="form-group">
          <label htmlFor="serving-mult">Servings</label>
          <input
            id="serving-mult"
            type="number"
            min="0.1"
            step="0.1"
            value={values.servingMultiplier}
            onChange={(e) => num('servingMultiplier', e.target.value)}
          />
        </div>
      </div>

      <div className="form-section-title">Macros</div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="calories">Calories</label>
          <input id="calories" type="number" min="0" value={values.calories} onChange={(e) => num('calories', e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="protein">Protein (g)</label>
          <input id="protein" type="number" min="0" step="0.1" value={values.proteinG} onChange={(e) => num('proteinG', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="fat">Fat (g)</label>
          <input id="fat" type="number" min="0" step="0.1" value={values.fatG} onChange={(e) => num('fatG', e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="total-carbs">Total carbs (g)</label>
          <input id="total-carbs" type="number" min="0" step="0.1" value={values.totalCarbsG} onChange={(e) => num('totalCarbsG', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="fibre">Fibre (g)</label>
          <input id="fibre" type="number" min="0" step="0.1" value={values.fibreG} onChange={(e) => num('fibreG', e.target.value)} />
          {errors.fibreG && <span className="form-error">{errors.fibreG}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="sugar-alc">Sugar alcohols (g)</label>
          <input id="sugar-alc" type="number" min="0" step="0.1" value={values.sugarAlcoholsG} onChange={(e) => num('sugarAlcoholsG', e.target.value)} />
          {errors.sugarAlcoholsG && <span className="form-error">{errors.sugarAlcoholsG}</span>}
        </div>
      </div>

      <div className="net-carbs-preview">
        Net carbs: <strong>{previewNetCarbs.toFixed(1)}g</strong>
      </div>

      <div className="form-section-title">Electrolytes</div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="sodium">Sodium (mg)</label>
          <input id="sodium" type="number" min="0" value={values.sodiumMg} onChange={(e) => num('sodiumMg', e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="potassium">Potassium (mg)</label>
          <input id="potassium" type="number" min="0" value={values.potassiumMg} onChange={(e) => num('potassiumMg', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="magnesium">Magnesium (mg)</label>
          <input id="magnesium" type="number" min="0" value={values.magnesiumMg} onChange={(e) => num('magnesiumMg', e.target.value)} />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn--primary">{submitLabel}</button>
        {onSaveAsFood && (
          <button type="button" className="btn btn--secondary" onClick={handleSaveAsFood}>
            Save as food
          </button>
        )}
      </div>
    </form>
  );
}
