import { useEffect, useState } from 'react';
import type { FoodLogEntry } from '../types';
import { calcNetCarbs, todayDateString } from '../lib/nutrition';
import {
  normalizePhotoEstimate, photoEstimateToLogEntry, updateEstimateNutrition,
  type PhotoEstimateNutrition, type PhotoFoodEstimate,
} from '../lib/photo-estimate';

interface PhotoEstimateProps {
  onAdd: (entry: FoodLogEntry) => boolean;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const NUTRITION_FIELDS: { key: keyof PhotoEstimateNutrition; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'totalCarbs', label: 'Total carbs', unit: 'g' },
  { key: 'fibre', label: 'Fibre', unit: 'g' },
  { key: 'sugarAlcohols', label: 'Sugar alcohols', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'potassium', label: 'Potassium', unit: 'mg' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg' },
];
const OPTIONAL_FIELDS: { key: keyof PhotoEstimateNutrition; label: string; unit: string }[] = [
  { key: 'calciumMg', label: 'Calcium', unit: 'mg' },
  { key: 'ironMg', label: 'Iron', unit: 'mg' },
  { key: 'zincMg', label: 'Zinc', unit: 'mg' },
  { key: 'vitaminDMcg', label: 'Vitamin D', unit: 'mcg' },
  { key: 'vitaminB12Mcg', label: 'Vitamin B12', unit: 'mcg' },
  { key: 'omega3G', label: 'Omega-3', unit: 'g' },
  { key: 'omega6G', label: 'Omega-6', unit: 'g' },
];

export function PhotoEstimate({ onAdd }: PhotoEstimateProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [estimate, setEstimate] = useState<PhotoFoodEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseImage(selected: File | undefined) {
    setEstimate(null); setSuccess('');
    if (!selected) { setFile(null); setPreview(''); setError('No image was selected.'); return; }
    if (!selected.type.startsWith('image/')) { setFile(null); setPreview(''); setError('Choose a supported image file.'); return; }
    if (selected.size > MAX_IMAGE_BYTES) { setFile(null); setPreview(''); setError('Image is too large. Choose one under 8 MB.'); return; }
    setError(''); setFile(selected); setPreview(URL.createObjectURL(selected));
  }

  async function analyse() {
    if (!file) { setError('Take or upload a food photo first.'); return; }
    setLoading(true); setError(''); setEstimate(null);
    const form = new FormData(); form.append('image', file);
    try {
      const response = await fetch('/api/analyze-food-photo', { method: 'POST', body: form });
      const body = await response.json() as unknown;
      if (!response.ok) {
        const message = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
          ? (body as { error: string }).error : 'Photo analysis failed. Try again.';
        setError(message); return;
      }
      const normalized = normalizePhotoEstimate(body);
      if (!normalized) { setError('The returned estimate was invalid. Try another photo.'); return; }
      setEstimate(normalized);
    } catch {
      setError('Could not reach the photo analysis service. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function updateNumber(key: keyof PhotoEstimateNutrition, raw: string) {
    if (!estimate || key === 'netCarbs') return;
    const value = Number(raw);
    setEstimate(updateEstimateNutrition(estimate, { [key]: Number.isFinite(value) && value >= 0 ? value : 0 }));
  }

  function addToLog() {
    if (!estimate) return;
    if (!estimate.summaryName.trim() || !estimate.servingDescription.trim()) { setError('Add a food name and serving description before logging.'); return; }
    const entry = photoEstimateToLogEntry(estimate, date);
    if (!onAdd(entry)) return;
    setSuccess(`“${entry.name}” was added to ${date === todayDateString() ? 'today' : date}.`);
    setEstimate(null); setFile(null); setPreview(''); setError('');
  }

  return (
    <div className="screen">
      <div className="screen-header"><h1>Photo Food Estimate</h1></div>
      <div className="estimate-warning" role="note">
        <strong>AI estimate — review before logging.</strong>
        <span>Photo estimates can be wrong, especially for hidden oils, sauces, portion sizes, or mixed dishes.</span>
      </div>
      <p className="privacy-note">Your photo is sent to the configured AI analysis provider. It is used for this request and is not saved in localStorage.</p>
      {success && <div className="success-toast">{success}</div>}
      {error && <div className="import-msg import-msg--error" role="alert">{error}</div>}

      <div className="photo-upload-panel">
        <label className="btn btn--secondary photo-upload-button">
          Take or upload photo
          <input type="file" accept="image/*" capture="environment" onChange={(event) => chooseImage(event.target.files?.[0])} />
        </label>
        {preview && <img className="photo-preview" src={preview} alt="Selected food preview" />}
        <button className="btn btn--primary" onClick={analyse} disabled={!file || loading}>
          {loading ? 'Estimating…' : 'Estimate macros'}
        </button>
      </div>

      {estimate && (
        <div className="photo-review">
          <div className="section-title">Review before logging</div>
          <div className={`confidence-card${estimate.overallConfidence < 0.5 ? ' confidence-card--low' : ''}`}>
            Overall confidence: <strong>{Math.round(estimate.overallConfidence * 100)}%</strong>
            {estimate.overallConfidence < 0.5 && <span>Low confidence — check every value carefully.</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="estimate-name">Food name</label>
              <input id="estimate-name" type="text" value={estimate.summaryName} onChange={(event) => setEstimate({ ...estimate, summaryName: event.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="estimate-serving">Estimated serving</label>
              <input id="estimate-serving" type="text" value={estimate.servingDescription} onChange={(event) => setEstimate({ ...estimate, servingDescription: event.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="estimate-date">Log date</label>
            <input id="estimate-date" type="date" value={date} max={todayDateString()} onChange={(event) => setDate(event.target.value)} />
          </div>

          <div className="form-section-title">Editable nutrition estimate</div>
          <div className="photo-nutrition-grid">
            {NUTRITION_FIELDS.map((field) => (
              <div className="form-group" key={field.key}>
                <label htmlFor={`estimate-${field.key}`}>{field.label} ({field.unit})</label>
                <input id={`estimate-${field.key}`} type="number" min="0" step="0.1" value={estimate.totals[field.key] as number} onChange={(event) => updateNumber(field.key, event.target.value)} />
              </div>
            ))}
          </div>
          <div className="net-carbs-preview">Net carbs: <strong>{calcNetCarbs(estimate.totals.totalCarbs, estimate.totals.fibre, estimate.totals.sugarAlcohols).toFixed(1)}g</strong></div>
          {OPTIONAL_FIELDS.some((field) => estimate.totals[field.key] !== undefined) && (
            <>
              <div className="form-section-title">Optional micronutrients returned</div>
              <div className="photo-nutrition-grid">
                {OPTIONAL_FIELDS.filter((field) => estimate.totals[field.key] !== undefined).map((field) => (
                  <div className="form-group" key={field.key}>
                    <label htmlFor={`estimate-${field.key}`}>{field.label} ({field.unit})</label>
                    <input id={`estimate-${field.key}`} type="number" min="0" step="0.1" value={estimate.totals[field.key] as number} onChange={(event) => updateNumber(field.key, event.target.value)} />
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="form-section-title">Identified foods</div>
          <ul className="identified-foods">
            {estimate.items.map((item, index) => (
              <li key={`${item.name}-${index}`}><strong>{item.name}</strong><span>{item.portionEstimate} · {Math.round(item.confidence * 100)}% confidence</span></li>
            ))}
          </ul>

          {estimate.assumptions.length > 0 && <div className="estimate-notes"><strong>Assumptions</strong><ul>{estimate.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {estimate.warnings.length > 0 && <div className="estimate-notes estimate-notes--warning"><strong>Warnings</strong><ul>{estimate.warnings.map((item) => <li key={item}>{item}</li>)}</ul></div>}

          <button className="btn btn--primary" onClick={addToLog}>Add reviewed estimate to log</button>
          <button className="btn btn--ghost" onClick={() => { setEstimate(null); setError(''); }}>Cancel estimate</button>
        </div>
      )}
    </div>
  );
}
