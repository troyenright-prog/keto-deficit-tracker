import { useState } from 'react';
import type { UserProfile, NutritionTargets } from '../types';
import { dietModeDefaultNetCarbs } from '../lib/nutrition';

interface ProfileProps {
  profile: UserProfile;
  targets: NutritionTargets;
  onSaveProfile: (p: UserProfile) => void;
  onSaveTargets: (t: NutritionTargets) => void;
}

export function Profile({ profile, targets, onSaveProfile, onSaveTargets }: ProfileProps) {
  const [prof, setProf] = useState<UserProfile>(profile);
  const [tgts, setTgts] = useState<NutritionTargets>(targets);
  const [saved, setSaved] = useState(false);

  function numTarget(key: keyof NutritionTargets, val: string) {
    const n = parseFloat(val);
    setTgts((t) => ({ ...t, [key]: Number.isFinite(n) ? Math.max(0, n) : 0 }));
  }

  function handleDietMode(mode: NutritionTargets['dietMode']) {
    setTgts((t) => ({
      ...t,
      dietMode: mode,
      netCarbsG: t.manualNetCarbs ? t.netCarbsG : dietModeDefaultNetCarbs(mode),
    }));
  }

  function handleManualNetCarbs(e: React.ChangeEvent<HTMLInputElement>) {
    const manual = e.target.checked;
    setTgts((t) => ({
      ...t,
      manualNetCarbs: manual,
      netCarbsG: manual ? t.netCarbsG : dietModeDefaultNetCarbs(t.dietMode),
    }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    onSaveProfile(prof);
    onSaveTargets(tgts);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Profile & Targets</h1>
      </div>

      <form onSubmit={handleSave} className="profile-form">
        <div className="section-title">Profile</div>

        <div className="form-group">
          <label htmlFor="profile-name">Your name</label>
          <input
            id="profile-name"
            type="text"
            value={prof.name}
            onChange={(e) => setProf((p) => ({ ...p, name: e.target.value }))}
            placeholder="Optional"
          />
        </div>

        <div className="form-group">
          <label htmlFor="weight-unit">Weight unit</label>
          <select
            id="weight-unit"
            value={prof.weightUnit}
            onChange={(e) => setProf((p) => ({ ...p, weightUnit: e.target.value as 'kg' | 'lbs' }))}
          >
            <option value="kg">kg</option>
            <option value="lbs">lbs</option>
          </select>
        </div>

        <div className="section-title">Diet mode</div>

        <div className="diet-mode-group">
          {(['strict-keto', 'lazy-keto', 'high-protein-keto'] as const).map((mode) => (
            <label key={mode} className={`diet-mode-option${tgts.dietMode === mode ? ' diet-mode-option--selected' : ''}`}>
              <input
                type="radio"
                name="diet-mode"
                value={mode}
                checked={tgts.dietMode === mode}
                onChange={() => handleDietMode(mode)}
              />
              <span className="diet-mode-label">
                {mode === 'strict-keto' && 'Strict keto (≤20g)'}
                {mode === 'lazy-keto' && 'Lazy keto (≤50g)'}
                {mode === 'high-protein-keto' && 'High-protein keto (≤30g)'}
              </span>
            </label>
          ))}
        </div>

        <div className="section-title">Daily targets</div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="t-calories">Calories (kcal)</label>
            <input
              id="t-calories"
              type="number"
              min="0"
              value={tgts.calories}
              onChange={(e) => numTarget('calories', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="t-protein">Protein (g)</label>
            <input
              id="t-protein"
              type="number"
              min="0"
              step="0.1"
              value={tgts.proteinG}
              onChange={(e) => numTarget('proteinG', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="t-fat">Fat (g)</label>
            <input
              id="t-fat"
              type="number"
              min="0"
              step="0.1"
              value={tgts.fatG}
              onChange={(e) => numTarget('fatG', e.target.value)}
            />
          </div>
          <div className="form-group">
            <div className="form-group-header">
              <label htmlFor="t-net-carbs">Net carbs (g)</label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={tgts.manualNetCarbs}
                  onChange={handleManualNetCarbs}
                />
                Override
              </label>
            </div>
            <input
              id="t-net-carbs"
              type="number"
              min="0"
              step="0.1"
              value={tgts.netCarbsG}
              disabled={!tgts.manualNetCarbs}
              onChange={(e) => numTarget('netCarbsG', e.target.value)}
            />
          </div>
        </div>

        <div className="section-title">Electrolyte targets</div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="t-sodium">Sodium (mg)</label>
            <input
              id="t-sodium"
              type="number"
              min="0"
              value={tgts.sodiumMg}
              onChange={(e) => numTarget('sodiumMg', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="t-potassium">Potassium (mg)</label>
            <input
              id="t-potassium"
              type="number"
              min="0"
              value={tgts.potassiumMg}
              onChange={(e) => numTarget('potassiumMg', e.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="t-magnesium">Magnesium (mg)</label>
            <input
              id="t-magnesium"
              type="number"
              min="0"
              value={tgts.magnesiumMg}
              onChange={(e) => numTarget('magnesiumMg', e.target.value)}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary">Save settings</button>
          {saved && <span className="success-inline">Saved!</span>}
        </div>
      </form>
    </div>
  );
}
