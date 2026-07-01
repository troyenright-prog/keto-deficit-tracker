import { useCallback, useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import type { FoodDatabaseItem, FoodItem, FoodLogEntry } from '../types';
import { barcodeFoodToLogEntry, barcodeFoodToSavedFood, lookupBarcodeFood, normalizeBarcode, type BarcodeFood } from '../lib/barcode';
import { barcodeFoodToFoodDatabaseItem, findFoodDatabaseByBarcode, foodDatabaseItemToBarcodeFood } from '../lib/food-database';
import { inferMealSlot, MEAL_SLOTS } from '../lib/meals';
import { calcNetCarbs, todayDateString } from '../lib/nutrition';
import { isDateString } from '../lib/date';

interface BarcodeScannerProps {
  foodDatabase: FoodDatabaseItem[];
  onAdd: (entry: FoodLogEntry) => boolean;
  onSaveFood: (food: FoodItem) => boolean;
  onSaveFoodDatabaseItem: (food: FoodDatabaseItem) => boolean;
  onAddManually?: () => void;
  autoStart?: boolean;
}

type FoodOrigin = 'local' | 'openFoodFacts' | 'foodDataCentral' | 'manual' | 'corrected';

const originLabels: Record<FoodOrigin, string> = {
  local: 'Local database',
  openFoodFacts: 'Open Food Facts',
  foodDataCentral: 'USDA FoodData Central',
  manual: 'Manually created food',
  corrected: 'User-corrected food',
};

function remoteFoodOrigin(food: BarcodeFood): FoodOrigin {
  return food.attribution === 'USDA FoodData Central' ? 'foodDataCentral' : 'openFoodFacts';
}

const canUseCamera = (): boolean => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

type NutritionProbe = Partial<Record<
  | 'calories'
  | 'proteinG'
  | 'fatG'
  | 'totalCarbsG'
  | 'fibreG'
  | 'sugarAlcoholsG'
  | 'sodiumMg'
  | 'potassiumMg'
  | 'magnesiumMg'
  | 'calciumMg'
  | 'ironMg'
  | 'zincMg'
  | 'vitaminDMcg'
  | 'vitaminB12Mcg'
  | 'omega3G'
  | 'omega6G',
  number | undefined
>>;

const TRACKED_NUTRITION_KEYS = [
  'calories',
  'proteinG',
  'fatG',
  'totalCarbsG',
  'fibreG',
  'sugarAlcoholsG',
  'sodiumMg',
  'potassiumMg',
  'magnesiumMg',
  'calciumMg',
  'ironMg',
  'zincMg',
  'vitaminDMcg',
  'vitaminB12Mcg',
  'omega3G',
  'omega6G',
] as const;

const MACRO_NUTRITION_KEYS = ['calories', 'proteinG', 'fatG', 'totalCarbsG'] as const;

function hasPositiveNutrition(food: NutritionProbe): boolean {
  return TRACKED_NUTRITION_KEYS.some((key) => (food[key] ?? 0) > 0);
}

function hasPositiveMacros(food: NutritionProbe): boolean {
  return MACRO_NUTRITION_KEYS.some((key) => (food[key] ?? 0) > 0);
}

function shouldSkipEmptyRemoteCacheWrite(existing: FoodDatabaseItem | undefined, food: BarcodeFood, userEdited: boolean): boolean {
  return Boolean(existing && !userEdited && hasPositiveNutrition(existing) && !hasPositiveNutrition(food));
}

export function BarcodeScanner({ foodDatabase, onAdd, onSaveFood, onSaveFoodDatabaseItem, onAddManually, autoStart = false }: BarcodeScannerProps) {
  const [barcode, setBarcode] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [meal, setMeal] = useState(inferMealSlot());
  const [servings, setServings] = useState('1');
  const [food, setFood] = useState<BarcodeFood | null>(null);
  const [origin, setOrigin] = useState<FoodOrigin | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraSupported] = useState(canUseCamera);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const stopRef = useRef(false);
  const autoStartedRef = useRef(false);

  const stopCamera = useCallback(() => {
    stopRef.current = true;
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScanning(false);
  }, []);

  const waitForVideoElement = useCallback(async (): Promise<HTMLVideoElement> => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (videoRef.current) return videoRef.current;
      await new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(resolve);
        else setTimeout(resolve, 16);
      });
    }
    throw new Error('Camera preview could not start.');
  }, []);

  const lookup = useCallback(async (raw = barcode) => {
    const normalized = normalizeBarcode(raw);
    setBarcode(normalized);
    setFood(null);
    setOrigin(null);
    setEditing(false);
    setSuccess('');
    if (!normalized) { setError('Enter or scan a valid barcode.'); return; }

    const local = findFoodDatabaseByBarcode(foodDatabase, normalized);
    // Use the cached copy only when it has tracked nutrition or the user edited it;
    // a cached 0-calorie row (e.g. saved during the OFF v3 empty-nutriments bug)
    // is treated as a miss so we re-fetch fresh data.
    if (local && (local.userEdited || hasPositiveNutrition(local))) {
      setFood(foodDatabaseItemToBarcodeFood(local));
      setOrigin(local.userEdited ? 'corrected' : 'local');
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const remoteFood = await lookupBarcodeFood(normalized);
      setFood(remoteFood);
      setOrigin(remoteFoodOrigin(remoteFood));
      if (!shouldSkipEmptyRemoteCacheWrite(local, remoteFood, false)) {
        onSaveFoodDatabaseItem(barcodeFoodToFoodDatabaseItem(remoteFood, local));
      }
    } catch (err) {
      if (local) {
        // The fresh lookup failed but we have a cached copy (e.g. a supplement
        // Open Food Facts doesn't carry) - show it rather than a dead "not found".
        setFood(foodDatabaseItemToBarcodeFood(local));
        setOrigin(local.userEdited ? 'corrected' : 'local');
        setError('');
      } else {
        setError(err instanceof Error ? err.message : 'Barcode lookup failed.');
      }
    } finally {
      setLoading(false);
    }
  }, [barcode, foodDatabase, onSaveFoodDatabaseItem]);

  const startCamera = useCallback(async () => {
    if (scanning) return;
    if (!cameraSupported) { setError('Camera access is not available. Enter the barcode number instead.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access is not available. Enter the barcode number instead.'); return; }
    setError('');
    setSuccess('');
    setFood(null);
    setScanning(true);
    stopRef.current = false;
    try {
      const video = await waitForVideoElement();
      const { BarcodeFormat, BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      reader.possibleFormats = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
      ];
      scannerControlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        video,
        (result, _error, controls) => {
          if (!result || stopRef.current) return;
          const normalized = normalizeBarcode(result.getText());
          if (!normalized) return;
          controls.stop();
          scannerControlsRef.current = null;
          stopRef.current = true;
          setScanning(false);
          setBarcode(normalized);
          void lookup(normalized);
        },
      );
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Could not open the camera.';
      setError(`${message} Enter the barcode number instead.`);
      stopCamera();
    }
  }, [cameraSupported, lookup, scanning, stopCamera, waitForVideoElement]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startCamera();
  }, [autoStart, startCamera]);

  function validServings(): number | null {
    const value = Number(servings);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Servings must be greater than zero.');
      return null;
    }
    return value;
  }

  function validLogDate(): boolean {
    if (!isDateString(date) || date > todayDateString()) {
      setError('Choose a valid log date that is not in the future.');
      return false;
    }
    return true;
  }

  function validReviewedFood(): boolean {
    if (!food) return false;
    if (!food.name.trim()) {
      setError('Food name is required.');
      return false;
    }
    if (food.fibreG + food.sugarAlcoholsG > food.totalCarbsG) {
      setError('Fibre and sugar alcohols cannot exceed total carbs.');
      return false;
    }
    return true;
  }

  function updateFood<K extends keyof BarcodeFood>(key: K, value: BarcodeFood[K]) {
    setFood((current) => current ? { ...current, [key]: value } : current);
    setOrigin('corrected');
  }

  function updateFoodNumber(key: keyof BarcodeFood, value: string) {
    const next = Number(value);
    updateFood(key, (Number.isFinite(next) && next >= 0 ? next : 0) as never);
  }

  function persistReviewedFood(userEdited = origin === 'corrected' || origin === 'manual') {
    if (!food) return false;
    const existing = findFoodDatabaseByBarcode(foodDatabase, food.barcode);
    if (shouldSkipEmptyRemoteCacheWrite(existing, food, userEdited)) return true;
    return onSaveFoodDatabaseItem(barcodeFoodToFoodDatabaseItem(food, existing, userEdited));
  }

  function addToLog() {
    if (!food) return;
    if (!validLogDate() || !validReviewedFood()) return;
    const amount = validServings();
    if (amount === null) return;
    if (!persistReviewedFood()) return;
    const entry = barcodeFoodToLogEntry(food, date, amount, meal);
    if (!onAdd(entry)) return;
    setSuccess(`"${entry.name}" added to ${date === todayDateString() ? 'today' : date}.`);
    setError('');
  }

  function saveFood() {
    if (!food) return;
    if (!validReviewedFood()) return;
    if (!persistReviewedFood()) return;
    if (!onSaveFood(barcodeFoodToSavedFood(food))) return;
    setSuccess(`"${food.name}" saved to your food library.`);
    setError('');
  }

  function startManualFood() {
    const normalized = normalizeBarcode(barcode);
    if (!normalized) { setError('Enter a barcode before creating a food.'); return; }
    setFood({
      barcode: normalized,
      name: '',
      servingSize: '1 serving',
      dataBasis: 'serving',
      calories: 0,
      proteinG: 0,
      fatG: 0,
      totalCarbsG: 0,
      fibreG: 0,
      sugarAlcoholsG: 0,
      sodiumMg: 0,
      potassiumMg: 0,
      magnesiumMg: 0,
    });
    setOrigin('manual');
    setEditing(true);
    setError('');
  }

  return (
    <div className="screen">
      <div className="screen-header"><h1>Barcode</h1></div>
      <div className="estimate-warning" role="note">
        <strong>Packaged-food lookup</strong>
        <span>Scan a barcode or type the number. Review labels before logging - crowd-sourced nutrition can be incomplete.</span>
      </div>
      {success && <div className="success-toast">{success}</div>}
      {error && <div className="import-msg import-msg--error" role="alert">{error}</div>}

      <div className="barcode-panel">
        <div className="barcode-actions">
          <button className="btn btn--secondary" onClick={scanning ? stopCamera : startCamera}>
            {scanning ? 'Stop camera' : 'Scan with camera'}
          </button>
          {onAddManually && (
            <button className="btn btn--ghost" onClick={onAddManually}>
              No barcode? Add manually
            </button>
          )}
          {!cameraSupported && <span className="dim">Barcode number entry works on all devices.</span>}
        </div>
        {scanning && <video ref={videoRef} className="barcode-video" playsInline muted aria-label="Barcode scanner camera preview" />}

        <div className="form-group">
          <label htmlFor="barcode-input">Barcode number</label>
          <input
            id="barcode-input"
            inputMode="numeric"
            type="text"
            value={barcode}
            onChange={(event) => { setBarcode(normalizeBarcode(event.target.value)); setFood(null); }}
            placeholder="e.g. 9300675051132"
          />
        </div>
        <button className="btn btn--primary" onClick={() => lookup()} disabled={loading || !barcode}>
          {loading ? 'Looking up...' : 'Look up barcode'}
        </button>
        {error && barcode && (
          <button className="btn btn--secondary" onClick={startManualFood}>
            Create food for this barcode
          </button>
        )}
      </div>

      {food && (
        <div className="barcode-review">
          <div className="section-title">Review before logging</div>
          {origin && <span className="source-pill">{originLabels[origin]}</span>}
          <div className="barcode-product-card">
            <strong>{food.name || 'New barcode food'}</strong>
            {food.brand && <span>{food.brand}</span>}
            <small>{food.servingSize} - {food.dataBasis === '100g' ? 'nutrition per 100g' : 'nutrition per serving'} - {food.barcode}</small>
          </div>
          {!hasPositiveMacros(food) && (
            <p className="privacy-note">No macro nutrition found - values are zero or need manual adjustment.</p>
          )}

          <button className="btn btn--primary" onClick={addToLog} disabled={!food.name.trim()}>
            Add to log
          </button>

          <button className="btn btn--ghost btn--sm" onClick={() => setEditing((value) => !value)}>
            {editing ? 'Hide edits' : 'Edit nutrition'}
          </button>

          {editing && (
            <div className="barcode-edit-grid">
              <div className="form-group">
                <label htmlFor="barcode-food-name">Food name</label>
                <input id="barcode-food-name" value={food.name} onChange={(event) => updateFood('name', event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="barcode-food-brand">Brand</label>
                <input id="barcode-food-brand" value={food.brand ?? ''} onChange={(event) => updateFood('brand', event.target.value || undefined)} />
              </div>
              <div className="form-group">
                <label htmlFor="barcode-serving-size">Serving size</label>
                <input id="barcode-serving-size" value={food.servingSize} onChange={(event) => updateFood('servingSize', event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="barcode-calories">Calories</label>
                <input id="barcode-calories" type="number" min="0" value={food.calories} onChange={(event) => updateFoodNumber('calories', event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="barcode-protein">Protein (g)</label>
                <input id="barcode-protein" type="number" min="0" step="0.1" value={food.proteinG} onChange={(event) => updateFoodNumber('proteinG', event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="barcode-fat">Fat (g)</label>
                <input id="barcode-fat" type="number" min="0" step="0.1" value={food.fatG} onChange={(event) => updateFoodNumber('fatG', event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="barcode-carbs">Total carbs (g)</label>
                <input id="barcode-carbs" type="number" min="0" step="0.1" value={food.totalCarbsG} onChange={(event) => updateFoodNumber('totalCarbsG', event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="barcode-fibre">Fibre (g)</label>
                <input id="barcode-fibre" type="number" min="0" step="0.1" value={food.fibreG} onChange={(event) => updateFoodNumber('fibreG', event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="barcode-sugar-alcohols">Sugar alcohols (g)</label>
                <input id="barcode-sugar-alcohols" type="number" min="0" step="0.1" value={food.sugarAlcoholsG} onChange={(event) => updateFoodNumber('sugarAlcoholsG', event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="barcode-sodium">Sodium (mg)</label>
                <input id="barcode-sodium" type="number" min="0" value={food.sodiumMg} onChange={(event) => updateFoodNumber('sodiumMg', event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="barcode-potassium">Potassium (mg)</label>
                <input id="barcode-potassium" type="number" min="0" value={food.potassiumMg} onChange={(event) => updateFoodNumber('potassiumMg', event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="barcode-magnesium">Magnesium (mg)</label>
                <input id="barcode-magnesium" type="number" min="0" value={food.magnesiumMg} onChange={(event) => updateFoodNumber('magnesiumMg', event.target.value)} />
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="barcode-date">Log date</label>
              <input id="barcode-date" type="date" value={date} max={todayDateString()} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="barcode-meal">Meal</label>
              <select id="barcode-meal" value={meal} onChange={(event) => setMeal(event.target.value as typeof meal)}>
                {MEAL_SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="barcode-servings">Servings</label>
              <input id="barcode-servings" type="number" min="0.1" step="0.1" value={servings} onChange={(event) => setServings(event.target.value)} />
            </div>
          </div>

          <div className="nutrition-grid">
            <div className="stat-card"><div className="stat-card-label">Calories</div><div className="stat-card-value">{Math.round(food.calories)}</div></div>
            <div className="stat-card"><div className="stat-card-label">Protein</div><div className="stat-card-value">{food.proteinG.toFixed(1)}g</div></div>
            <div className="stat-card"><div className="stat-card-label">Fat</div><div className="stat-card-value">{food.fatG.toFixed(1)}g</div></div>
            <div className="stat-card"><div className="stat-card-label">Total carbs</div><div className="stat-card-value">{food.totalCarbsG.toFixed(1)}g</div></div>
            <div className="stat-card"><div className="stat-card-label">Net carbs</div><div className="stat-card-value">{calcNetCarbs(food.totalCarbsG, food.fibreG, food.sugarAlcoholsG).toFixed(1)}g</div></div>
            <div className="stat-card"><div className="stat-card-label">Sodium</div><div className="stat-card-value">{Math.round(food.sodiumMg)}mg</div></div>
          </div>

          <div className="form-actions">
            <button className="btn btn--primary" onClick={addToLog} disabled={!food.name.trim()}>Add to log</button>
            <button className="btn btn--secondary" onClick={saveFood} disabled={!food.name.trim()}>Save food</button>
          </div>
          <p className="privacy-note">Values are copied into your log so future database edits will not change history.</p>
        </div>
      )}
    </div>
  );
}
