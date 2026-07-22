import { useState } from 'react';
import type { FoodItem, Micronutrients } from '../types';
import { calcNetCarbs, todayDateString } from '../lib/nutrition';
import { hasAnyMicronutrients, MICRONUTRIENT_FIELDS, pickMicronutrients, type MicronutrientKey } from '../lib/micronutrients';
import { parseNumericInput } from '../lib/numeric-field';
import { implausibleMacroMassMessage } from '../lib/nutrition-validation';

export interface FoodFormValues extends Micronutrients {
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

function optNum(val: string): number | undefined {
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n === 0) return undefined;
  return Math.max(0, n);
}

// Numeric fields are backed by their raw text so an empty field stays empty
// (showing the placeholder) instead of a controlled 0 that cannot be cleared.
const NUMERIC_KEYS = [
  'servingMultiplier', 'calories', 'proteinG', 'fatG', 'totalCarbsG',
  'fibreG', 'sugarAlcoholsG', 'sodiumMg', 'potassiumMg', 'magnesiumMg',
] as const;

function displayNum(value: number | undefined): string {
  return value === undefined || value === 0 ? '' : String(value);
}

function seedTexts(values: FoodFormValues): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const key of NUMERIC_KEYS) texts[key] = displayNum(values[key]);
  for (const field of MICRONUTRIENT_FIELDS) texts[field.key] = displayNum(values[field.key]);
  return texts;
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
  hideServingMultiplier?: boolean;
  // Minimal quick-log layout: no "Load saved food" picker and the whole
  // nutrition block (macros, electrolytes, micronutrients) collapses behind a
  // single toggle so name/serving/servings and the live totals are all that
  // shows by default. Used when logging an existing food where the macros are
  // already correct and you only tweak servings before saving.
  compact?: boolean;
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
  hideServingMultiplier = false,
  compact = false,
}: FoodFormProps) {
  const [values, setValues] = useState<FoodFormValues>({ ...EMPTY, ...initial });
  const [texts, setTexts] = useState<Record<string, string>>(() => seedTexts({ ...EMPTY, ...initial }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedSaved, setSelectedSaved] = useState('');
  // null = no explicit user choice yet - defer to whether the food already
  // carries electrolyte/micronutrient data. Once the user clicks the toggle,
  // their choice (true/false) overrides that default, so it stays collapsed for
  // a quick manual add yet auto-opens when editing a food that already has them.
  const [showExtras, setShowExtras] = useState<boolean | null>(null);

  function num(key: keyof FoodFormValues, val: string) {
    setTexts((t) => ({ ...t, [key]: val }));
    setValues((v) => ({ ...v, [key]: parseNumericInput(val) }));
  }

  function micro(key: MicronutrientKey, val: string) {
    setTexts((t) => ({ ...t, [key]: val }));
    setValues((v) => ({ ...v, [key]: optNum(val) }));
  }

  function str(key: keyof FoodFormValues, val: string) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = 'Name is required';
    if (!Number.isFinite(values.servingMultiplier) || values.servingMultiplier <= 0)
      e.servingMultiplier = 'Servings must be greater than zero';
    if (values.fibreG > values.totalCarbsG)
      e.fibreG = 'Fibre cannot exceed total carbs';
    if (values.sugarAlcoholsG > values.totalCarbsG)
      e.sugarAlcoholsG = 'Sugar alcohols cannot exceed total carbs';
    if (values.fibreG + values.sugarAlcoholsG > values.totalCarbsG) {
      e.fibreG = e.fibreG ?? 'Fibre and sugar alcohols cannot exceed total carbs';
      e.sugarAlcoholsG = e.sugarAlcoholsG ?? 'Fibre and sugar alcohols cannot exceed total carbs';
    }
    const macroMassError = implausibleMacroMassMessage(values);
    if (macroMassError) e.macros = macroMassError;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      // Compact mode hides the macro fields, so reveal them when a validation
      // error lands there — otherwise the message points at a field the user
      // cannot see.
      if (compact) setShowExtras(true);
      return;
    }
    onSubmit(values);
    setValues({ ...EMPTY });
    setTexts(seedTexts({ ...EMPTY }));
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
    const loaded: FoodFormValues = {
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
      ...pickMicronutrients(food),
    };
    setValues(loaded);
    setTexts(seedTexts(loaded));
    setSelectedSaved(id);
  }

  const previewNetCarbs = calcNetCarbs(values.totalCarbsG, values.fibreG, values.sugarAlcoholsG);
  const hasElectrolytes = values.sodiumMg > 0 || values.potassiumMg > 0 || values.magnesiumMg > 0;
  const hasExtras = hasElectrolytes || hasAnyMicronutrients(values);
  // In compact mode the nutrition block always starts collapsed (the live
  // totals cover the common case); elsewhere it auto-opens when the food
  // already carries electrolyte/micronutrient data.
  const extrasVisible = showExtras ?? (compact ? false : hasExtras);

  // The macro/electrolyte/micronutrient fields above are always per-serving;
  // "Servings" scales them at log time. Preview that scaled total live so
  // changing servings visibly updates calories/macros instead of only
  // applying silently on submit (see the same pattern in BarcodeScanner).
  const multiplier = Number.isFinite(values.servingMultiplier) && values.servingMultiplier > 0
    ? values.servingMultiplier
    : 1;
  const scaledTotals = {
    calories: values.calories * multiplier,
    proteinG: values.proteinG * multiplier,
    netCarbsG: previewNetCarbs * multiplier,
    fatG: values.fatG * multiplier,
  };

  const macrosBlock = (
    <>
      <div className="form-section-title">Macros</div>
      {errors.macros && <span className="form-error">{errors.macros}</span>}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="calories">Calories</label>
          <input id="calories" type="number" min="0" placeholder="0" value={texts.calories} onChange={(e) => num('calories', e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="protein">Protein (g)</label>
          <input id="protein" type="number" min="0" step="0.1" placeholder="0" value={texts.proteinG} onChange={(e) => num('proteinG', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="fat">Fat (g)</label>
          <input id="fat" type="number" min="0" step="0.1" placeholder="0" value={texts.fatG} onChange={(e) => num('fatG', e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="total-carbs">Total carbs (g)</label>
          <input id="total-carbs" type="number" min="0" step="0.1" placeholder="0" value={texts.totalCarbsG} onChange={(e) => num('totalCarbsG', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="fibre">Fibre (g)</label>
          <input id="fibre" type="number" min="0" step="0.1" placeholder="0" value={texts.fibreG} onChange={(e) => num('fibreG', e.target.value)} />
          {errors.fibreG && <span className="form-error">{errors.fibreG}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="sugar-alc">Sugar alcohols (g)</label>
          <input id="sugar-alc" type="number" min="0" step="0.1" placeholder="0" value={texts.sugarAlcoholsG} onChange={(e) => num('sugarAlcoholsG', e.target.value)} />
          {errors.sugarAlcoholsG && <span className="form-error">{errors.sugarAlcoholsG}</span>}
        </div>
      </div>

      <div className="net-carbs-preview">
        Net carbs: <strong>{previewNetCarbs.toFixed(1)}g</strong>
      </div>
    </>
  );

  const extrasBlock = (
    <>
      <div className="form-section-title">Electrolytes</div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="sodium">Sodium (mg)</label>
          <input id="sodium" type="number" min="0" placeholder="0" value={texts.sodiumMg} onChange={(e) => num('sodiumMg', e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="potassium">Potassium (mg)</label>
          <input id="potassium" type="number" min="0" placeholder="0" value={texts.potassiumMg} onChange={(e) => num('potassiumMg', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="magnesium">Magnesium (mg)</label>
          <input id="magnesium" type="number" min="0" placeholder="0" value={texts.magnesiumMg} onChange={(e) => num('magnesiumMg', e.target.value)} />
        </div>
      </div>

      <div className="form-section-title">Micronutrients (optional)</div>
      <div className="form-row form-row--wrap">
        {MICRONUTRIENT_FIELDS.map((field) => (
          <div className="form-group" key={field.key}>
            <label htmlFor={`micro-${field.key}`}>{field.label} ({field.unit})</label>
            <input
              id={`micro-${field.key}`}
              type="number"
              min="0"
              step={field.unit === 'g' ? '0.01' : '0.1'}
              value={texts[field.key] ?? ''}
              placeholder="0"
              onChange={(e) => micro(field.key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </>
  );

  return (
    <form className="food-form" onSubmit={handleSubmit} noValidate>
      {!compact && savedFoods.length > 0 && (
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
          autoComplete="off"
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
        {!hideServingMultiplier && (
          <div className="form-group">
            <label htmlFor="serving-mult">Servings</label>
            <input
              id="serving-mult"
              type="number"
              min="0.1"
              step="0.1"
              placeholder="1"
              value={texts.servingMultiplier}
              onChange={(e) => num('servingMultiplier', e.target.value)}
            />
            {errors.servingMultiplier && <span className="form-error">{errors.servingMultiplier}</span>}
          </div>
        )}
      </div>

      {!hideServingMultiplier && (
        <div className="net-carbs-preview">
          Logging {multiplier}× serving: <strong>{Math.round(scaledTotals.calories)} kcal</strong>,{' '}
          {scaledTotals.proteinG.toFixed(1)}g protein, {scaledTotals.netCarbsG.toFixed(1)}g net carbs,{' '}
          {scaledTotals.fatG.toFixed(1)}g fat
        </div>
      )}

      {compact ? (
        <>
          <button
            type="button"
            className="btn btn--ghost btn--sm micro-toggle"
            onClick={() => setShowExtras(!extrasVisible)}
            aria-expanded={extrasVisible}
          >
            {extrasVisible ? 'Hide' : 'Show'} macros &amp; nutrients
          </button>
          {extrasVisible && (
            <>
              {macrosBlock}
              {extrasBlock}
            </>
          )}
        </>
      ) : (
        <>
          {macrosBlock}
          <button
            type="button"
            className="btn btn--ghost btn--sm micro-toggle"
            onClick={() => setShowExtras(!extrasVisible)}
            aria-expanded={extrasVisible}
          >
            {extrasVisible ? 'Hide' : 'Add'} electrolytes &amp; micronutrients
          </button>
          {extrasVisible && extrasBlock}
        </>
      )}

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
