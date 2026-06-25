import { useRef, useState } from 'react';
import type { UserProfile, NutritionTargets } from '../types';
import { dietModeDefaultNetCarbs } from '../lib/nutrition';
import { exportAppData, validateAppBundle, importAppData } from '../lib/storage';
import { localDateString } from '../lib/date';
import { APP_VERSION, formatBuildDate } from '../lib/version';
import { hardRefreshApp } from '../lib/app-update';

interface SettingsProps {
  profile: UserProfile;
  targets: NutritionTargets;
  onSaveProfile: (p: UserProfile) => boolean;
  onSaveTargets: (t: NutritionTargets) => boolean;
  onImportComplete: () => void;
}

export function Settings({ profile, targets, onSaveProfile, onSaveTargets, onImportComplete }: SettingsProps) {
  const [prof, setProf] = useState<UserProfile>(profile);
  const [tgts, setTgts] = useState<NutritionTargets>(targets);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [validationError, setValidationError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
    const invalidTarget = Object.entries(tgts).find(([key, value]) => key !== 'manualNetCarbs' && key !== 'dietMode' && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0));
    if (invalidTarget) {
      setValidationError('All nutrition and electrolyte targets must be greater than zero.');
      return;
    }
    setValidationError('');
    const profileSaved = onSaveProfile(prof);
    const targetsSaved = onSaveTargets(tgts);
    if (!profileSaved || !targetsSaved) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleExport() {
    const bundle = exportAppData();
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keto-backup-${localDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!validateAppBundle(parsed)) {
          setImportMsg({ type: 'error', text: 'Invalid backup file format.' });
          return;
        }
        if (!confirm('This will replace ALL your current data. Continue?')) return;
        if (!importAppData(parsed)) {
          setImportMsg({ type: 'error', text: 'Import could not be saved. Your existing data was restored.' });
          return;
        }
        setImportMsg({ type: 'success', text: 'Import successful! Reloading data…' });
        setTimeout(() => {
          onImportComplete();
          setImportMsg(null);
        }, 1200);
      } catch {
        setImportMsg({ type: 'error', text: 'Failed to parse backup file.' });
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Settings</h1>
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
            <input id="t-calories" type="number" min="0" value={tgts.calories} onChange={(e) => numTarget('calories', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="t-protein">Protein (g)</label>
            <input id="t-protein" type="number" min="0" step="0.1" value={tgts.proteinG} onChange={(e) => numTarget('proteinG', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="t-fat">Fat (g)</label>
            <input id="t-fat" type="number" min="0" step="0.1" value={tgts.fatG} onChange={(e) => numTarget('fatG', e.target.value)} />
          </div>
          <div className="form-group">
            <div className="form-group-header">
              <label htmlFor="t-net-carbs">Net carbs (g)</label>
              <label className="checkbox-label">
                <input type="checkbox" checked={tgts.manualNetCarbs} onChange={handleManualNetCarbs} />
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
            <input id="t-sodium" type="number" min="0" value={tgts.sodiumMg} onChange={(e) => numTarget('sodiumMg', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="t-potassium">Potassium (mg)</label>
            <input id="t-potassium" type="number" min="0" value={tgts.potassiumMg} onChange={(e) => numTarget('potassiumMg', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="t-magnesium">Magnesium (mg)</label>
            <input id="t-magnesium" type="number" min="0" value={tgts.magnesiumMg} onChange={(e) => numTarget('magnesiumMg', e.target.value)} />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary">Save settings</button>
          {saved && <span className="success-inline">Saved!</span>}
        </div>
        {validationError && <p className="form-error" role="alert">{validationError}</p>}
      </form>

      <div className="section-title">Backup &amp; Restore</div>
      <p className="empty-hint" style={{ marginTop: 0 }}>
        Export your data as a JSON file or import a previous backup. Importing replaces all current data.
      </p>
      <div className="backup-actions">
        <button className="btn btn--secondary" onClick={handleExport}>Export backup</button>
        <label className="btn btn--ghost">
          Import backup
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </label>
      </div>
      {importMsg && (
        <p className={`import-msg import-msg--${importMsg.type}`}>{importMsg.text}</p>
      )}

      <div className="section-title">App version</div>
      <div className="app-version-panel">
        <div>
          <strong>Version {APP_VERSION}</strong>
          <span>Built {formatBuildDate()}</span>
        </div>
        <p>Feature releases advance the minor version. Improvements and bug fixes advance the patch version. Installed apps check for updates on launch and when reopened.</p>
        <button className="btn btn--secondary btn--sm" onClick={() => void hardRefreshApp()}>
          Hard refresh app
        </button>
      </div>
    </div>
  );
}
