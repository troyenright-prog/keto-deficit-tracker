import { useEffect, useRef, useState } from 'react';
import type { FoodDatabaseItem, FoodItem, FoodLogEntry } from '../types';
import { barcodeFoodToLogEntry, barcodeFoodToSavedFood, lookupBarcodeFood, normalizeBarcode, type BarcodeFood } from '../lib/barcode';
import { barcodeFoodToFoodDatabaseItem, findFoodDatabaseByBarcode, foodDatabaseItemToBarcodeFood } from '../lib/food-database';
import { inferMealSlot, MEAL_SLOTS } from '../lib/meals';
import { calcNetCarbs, todayDateString } from '../lib/nutrition';

interface BarcodeScannerProps {
  foodDatabase: FoodDatabaseItem[];
  onAdd: (entry: FoodLogEntry) => boolean;
  onSaveFood: (food: FoodItem) => boolean;
  onSaveFoodDatabaseItem: (food: FoodDatabaseItem) => boolean;
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type FoodOrigin = 'local' | 'openFoodFacts' | 'manual' | 'corrected';

const originLabels: Record<FoodOrigin, string> = {
  local: 'Local database',
  openFoodFacts: 'Open Food Facts',
  manual: 'Manually created food',
  corrected: 'User-corrected food',
};

const canUseBarcodeDetector = (): boolean => typeof window !== 'undefined' && 'BarcodeDetector' in window;

export function BarcodeScanner({ foodDatabase, onAdd, onSaveFood, onSaveFoodDatabaseItem }: BarcodeScannerProps) {
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
  const [scannerSupported] = useState(canUseBarcodeDetector);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    stopRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function lookup(raw = barcode) {
    const normalized = normalizeBarcode(raw);
    setBarcode(normalized);
    setFood(null);
    setOrigin(null);
    setEditing(false);
    setSuccess('');
    if (!normalized) { setError('Enter or scan a valid barcode.'); return; }

    const local = findFoodDatabaseByBarcode(foodDatabase, normalized);
    if (local) {
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
      setOrigin('openFoodFacts');
      onSaveFoodDatabaseItem(barcodeFoodToFoodDatabaseItem(remoteFood));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Barcode lookup failed.');
    } finally {
      setLoading(false);
    }
  }

  async function startCamera() {
    if (!scannerSupported) { setError('Camera barcode scanning is not supported in this browser. Enter the barcode number instead.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access is not available. Enter the barcode number instead.'); return; }
    setError('');
    setSuccess('');
    setFood(null);
    setScanning(true);
    stopRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      scanLoop();
    } catch {
      setError('Could not open the camera. Enter the barcode number instead.');
      stopCamera();
    }
  }

  async function scanLoop() {
    const detector = new (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
    });
    while (!stopRef.current) {
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const results = await detector.detect(video);
          const rawValue = results.find((result) => result.rawValue)?.rawValue;
          if (rawValue) {
            const normalized = normalizeBarcode(rawValue);
            stopCamera();
            setBarcode(normalized);
            await lookup(normalized);
            return;
          }
        } catch {
          setError('Scanner had trouble reading the camera image. Try entering the barcode number.');
          stopCamera();
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  function validServings(): number | null {
    const value = Number(servings);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Servings must be greater than zero.');
      return null;
    }
    return value;
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
    return onSaveFoodDatabaseItem(barcodeFoodToFoodDatabaseItem(food, existing, userEdited));
  }

  function addToLog() {
    if (!food) return;
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
          {!scannerSupported && <span className="dim">Manual entry works on all browsers.</span>}
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
