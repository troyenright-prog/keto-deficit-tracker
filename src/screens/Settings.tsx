import { useRef, useState } from 'react';
import type { FoodItem, MealSlot, MealTemplate, UserProfile, NutritionTargets, ReminderKey, ReminderRule, ReminderSettings, WeeklyReminderRule } from '../types';
import { dietModeDefaultNetCarbs } from '../lib/nutrition';
import { exportAppData, validateAppBundle, importAppData } from '../lib/storage';
import { localDateString } from '../lib/date';
import { APP_VERSION, formatBuildDate } from '../lib/version';
import { hardRefreshApp } from '../lib/app-update';
import { ALL_WEEKDAYS, sendTestReminder, type ReminderScheduleResult } from '../lib/reminders';
import { MICRONUTRIENT_FIELDS } from '../lib/micronutrients';
import { getRdaForAgeSex } from '../lib/rda';
import { displayNumericValue, parseNumericInput } from '../lib/numeric-field';
import { Meals } from './Meals';

// Every numeric target field is backed by raw input text so a 0 renders as an
// empty placeholder the user can type straight into (no stuck "0" to delete).
const BASE_TARGET_KEYS = ['calories', 'proteinG', 'fatG', 'netCarbsG', 'sodiumMg', 'potassiumMg', 'magnesiumMg'] as const;

function seedTargetTexts(targets: NutritionTargets): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const key of BASE_TARGET_KEYS) texts[key] = displayNumericValue(targets[key]);
  for (const field of MICRONUTRIENT_FIELDS) texts[field.key] = displayNumericValue(targets[field.key]);
  return texts;
}

interface SettingsProps {
  profile: UserProfile;
  targets: NutritionTargets;
  reminders: ReminderSettings;
  templates: MealTemplate[];
  savedFoods: FoodItem[];
  onSaveProfile: (p: UserProfile) => boolean;
  onSaveTargets: (t: NutritionTargets) => boolean;
  onSaveReminders: (settings: ReminderSettings) => Promise<ReminderScheduleResult>;
  onSaveTemplate: (template: MealTemplate) => boolean;
  onDeleteTemplate: (id: string) => void;
  onAddTemplateToLog: (template: MealTemplate, meal?: MealSlot) => void;
  onImportComplete: () => void;
}

const WEEKDAYS = [
  { value: 1, label: 'Sunday' },
  { value: 2, label: 'Monday' },
  { value: 3, label: 'Tuesday' },
  { value: 4, label: 'Wednesday' },
  { value: 5, label: 'Thursday' },
  { value: 6, label: 'Friday' },
  { value: 7, label: 'Saturday' },
];

const WEEKDAY_ONLY_DAYS = [2, 3, 4, 5, 6]; // Monday - Friday

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((d) => b.includes(d));
}

export function Settings({
  profile,
  targets,
  reminders,
  templates,
  savedFoods,
  onSaveProfile,
  onSaveTargets,
  onSaveReminders,
  onSaveTemplate,
  onDeleteTemplate,
  onAddTemplateToLog,
  onImportComplete,
}: SettingsProps) {
  const [prof, setProf] = useState<UserProfile>(profile);
  const [ageText, setAgeText] = useState<string>(profile.age ? String(profile.age) : '');
  const [tgts, setTgts] = useState<NutritionTargets>(targets);
  const [targetTexts, setTargetTexts] = useState<Record<string, string>>(() => seedTargetTexts(targets));
  const [rdaMsg, setRdaMsg] = useState('');
  const [rem, setRem] = useState<ReminderSettings>(reminders);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [validationError, setValidationError] = useState('');
  const [reminderMsg, setReminderMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function numTarget(key: keyof NutritionTargets, val: string) {
    setTargetTexts((t) => ({ ...t, [key]: val }));
    setTgts((t) => ({ ...t, [key]: parseNumericInput(val) }));
  }

  function handleDietMode(mode: NutritionTargets['dietMode']) {
    setTgts((t) => {
      const netCarbsG = t.manualNetCarbs ? t.netCarbsG : dietModeDefaultNetCarbs(mode);
      setTargetTexts((texts) => ({ ...texts, netCarbsG: displayNumericValue(netCarbsG) }));
      return { ...t, dietMode: mode, netCarbsG };
    });
  }

  function handleAgeChange(value: string) {
    setAgeText(value);
    const parsed = Number(value);
    setProf((p) => ({ ...p, age: value !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined }));
  }

  function handleFillRda() {
    if (!prof.age || !prof.sex) {
      setRdaMsg('Set your age and sex above first.');
      return;
    }
    const rda = getRdaForAgeSex(prof.age, prof.sex);
    setTgts((t) => ({ ...t, ...rda }));
    setTargetTexts((texts) => {
      const next = { ...texts };
      for (const field of MICRONUTRIENT_FIELDS) {
        const value = rda[field.key];
        if (value !== undefined) next[field.key] = displayNumericValue(value);
      }
      return next;
    });
    setRdaMsg(`Filled with RDA values for ${prof.sex === 'male' ? 'men' : 'women'} aged ${prof.age}. Review and save below.`);
  }

  function handleManualNetCarbs(e: React.ChangeEvent<HTMLInputElement>) {
    const manual = e.target.checked;
    setTgts((t) => {
      const netCarbsG = manual ? t.netCarbsG : dietModeDefaultNetCarbs(t.dietMode);
      setTargetTexts((texts) => ({ ...texts, netCarbsG: displayNumericValue(netCarbsG) }));
      return { ...t, manualNetCarbs: manual, netCarbsG };
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const requiredTargetKeys = ['calories', 'proteinG', 'fatG', 'netCarbsG', 'sodiumMg', 'potassiumMg', 'magnesiumMg'] as const;
    const invalidTarget = requiredTargetKeys.find((key) => {
      const value = tgts[key];
      return typeof value !== 'number' || !Number.isFinite(value) || value <= 0;
    });
    if (invalidTarget) {
      setValidationError('All nutrition and electrolyte targets must be greater than zero.');
      return;
    }
    const invalidMicronutrientTarget = MICRONUTRIENT_FIELDS.find((field) => {
      const value = tgts[field.key] ?? 0;
      return typeof value !== 'number' || !Number.isFinite(value) || value < 0;
    });
    if (invalidMicronutrientTarget) {
      setValidationError('Micronutrient targets must be zero or greater.');
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function updateReminder<K extends ReminderKey>(key: K, patch: Partial<ReminderSettings[K]>) {
    setRem((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  }

  function setReminderDays(key: 'weighIn' | 'shopping', days: number[]) {
    updateReminder(key, { days, weekday: days[0] } as Partial<ReminderSettings[typeof key]>);
  }

  function toggleReminderDay(key: 'weighIn' | 'shopping', day: number, currentDays: number[]) {
    const has = currentDays.includes(day);
    const next = has ? currentDays.filter((d) => d !== day) : [...currentDays, day].sort((a, b) => a - b);
    if (next.length === 0) return; // keep at least one day selected
    setReminderDays(key, next);
  }

  async function handleSaveReminders() {
    const next = { ...rem, updatedAt: new Date().toISOString() };
    setRem(next);
    const result = await onSaveReminders(next);
    setReminderMsg({ type: result.ok ? 'success' : 'error', text: result.message });
  }

  async function handleTestReminder() {
    const result = await sendTestReminder();
    setReminderMsg({ type: result.ok ? 'success' : 'error', text: result.message });
  }

  function renderReminder(
    key: ReminderKey,
    label: string,
    rule: ReminderRule,
    weekly?: WeeklyReminderRule,
  ) {
    const weeklyKey = weekly ? (key as 'weighIn' | 'shopping') : null;
    return (
      <div className="reminder-card">
        <label className="checkbox-label reminder-toggle">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(event) => updateReminder(key, { enabled: event.target.checked } as Partial<ReminderSettings[typeof key]>)}
          />
          {label}
        </label>
        <input
          type="time"
          value={rule.time}
          disabled={!rule.enabled}
          aria-label={`${label} time`}
          onChange={(event) => updateReminder(key, { time: event.target.value } as Partial<ReminderSettings[typeof key]>)}
        />
        {weekly && weeklyKey && (
          <div className="reminder-days">
            <div className="reminder-days-presets">
              <button
                type="button"
                className={`btn btn--ghost btn--xs${sameDays(weekly.days, ALL_WEEKDAYS) ? ' btn--preset-active' : ''}`}
                disabled={!rule.enabled}
                onClick={() => setReminderDays(weeklyKey, ALL_WEEKDAYS)}
              >
                Every day
              </button>
              <button
                type="button"
                className={`btn btn--ghost btn--xs${sameDays(weekly.days, WEEKDAY_ONLY_DAYS) ? ' btn--preset-active' : ''}`}
                disabled={!rule.enabled}
                onClick={() => setReminderDays(weeklyKey, WEEKDAY_ONLY_DAYS)}
              >
                Weekdays
              </button>
            </div>
            <div className="reminder-day-chips" role="group" aria-label={`${label} days`}>
              {WEEKDAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={`day-chip${weekly.days.includes(day.value) ? ' day-chip--active' : ''}`}
                  aria-pressed={weekly.days.includes(day.value)}
                  aria-label={day.label}
                  disabled={!rule.enabled}
                  onClick={() => toggleReminderDay(weeklyKey, day.value, weekly.days)}
                >
                  {day.label.slice(0, 1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
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
        if (!confirm('This will replace ALL your current data. Continue?')) {
          setImportMsg({ type: 'error', text: 'Import cancelled. Your current data was not changed.' });
          return;
        }
        if (!importAppData(parsed)) {
          setImportMsg({ type: 'error', text: 'Import could not be saved. Your existing data was restored.' });
          return;
        }
        setImportMsg({ type: 'success', text: 'Import successful. Reloading data...' });
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

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="profile-age">Age</label>
            <input
              id="profile-age"
              type="number"
              min="1"
              max="120"
              placeholder="e.g. 35"
              value={ageText}
              onChange={(e) => handleAgeChange(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="profile-sex">Sex</label>
            <select
              id="profile-sex"
              value={prof.sex ?? ''}
              onChange={(e) => setProf((p) => ({ ...p, sex: e.target.value === '' ? undefined : (e.target.value as 'male' | 'female') }))}
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>
        <p className="empty-hint" style={{ marginTop: 0 }}>
          Age and sex are used to suggest recommended vitamin and mineral targets below — they're not required otherwise.
        </p>

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
                {mode === 'strict-keto' && 'Strict keto (<=20g)'}
                {mode === 'lazy-keto' && 'Lazy keto (<=50g)'}
                {mode === 'high-protein-keto' && 'High-protein keto (<=30g)'}
              </span>
            </label>
          ))}
        </div>

        <div className="section-title">Daily targets</div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="t-calories">Calories (kcal)</label>
            <input id="t-calories" type="number" min="0" placeholder="0" value={targetTexts.calories} onChange={(e) => numTarget('calories', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="t-protein">Protein (g)</label>
            <input id="t-protein" type="number" min="0" step="0.1" placeholder="0" value={targetTexts.proteinG} onChange={(e) => numTarget('proteinG', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="t-fat">Fat (g)</label>
            <input id="t-fat" type="number" min="0" step="0.1" placeholder="0" value={targetTexts.fatG} onChange={(e) => numTarget('fatG', e.target.value)} />
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
              placeholder="0"
              value={targetTexts.netCarbsG}
              disabled={!tgts.manualNetCarbs}
              onChange={(e) => numTarget('netCarbsG', e.target.value)}
            />
          </div>
        </div>

        <div className="section-title">Electrolyte targets</div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="t-sodium">Sodium (mg)</label>
            <input id="t-sodium" type="number" min="0" placeholder="0" value={targetTexts.sodiumMg} onChange={(e) => numTarget('sodiumMg', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="t-potassium">Potassium (mg)</label>
            <input id="t-potassium" type="number" min="0" placeholder="0" value={targetTexts.potassiumMg} onChange={(e) => numTarget('potassiumMg', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="t-magnesium">Magnesium (mg)</label>
            <input id="t-magnesium" type="number" min="0" placeholder="0" value={targetTexts.magnesiumMg} onChange={(e) => numTarget('magnesiumMg', e.target.value)} />
          </div>
        </div>

        <div className="section-title">Micronutrient &amp; vitamin targets</div>

        <div className="form-actions" style={{ marginTop: 0, marginBottom: 8 }}>
          <button type="button" className="btn btn--secondary btn--sm" onClick={handleFillRda}>
            Fill recommended amounts (RDA)
          </button>
        </div>
        {rdaMsg && <p className="empty-hint" style={{ marginTop: 0 }}>{rdaMsg}</p>}

        <div className="form-row form-row--wrap">
          {MICRONUTRIENT_FIELDS.map((field) => (
            <div className="form-group" key={field.key}>
              <label htmlFor={`t-${field.key}`}>{field.label} ({field.unit})</label>
              <input
                id={`t-${field.key}`}
                type="number"
                min="0"
                step={field.unit === 'g' ? '0.01' : '0.1'}
                placeholder="0"
                value={targetTexts[field.key] ?? ''}
                onChange={(e) => numTarget(field.key, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary">Save settings</button>
          {saved && <span className="success-inline">Saved!</span>}
        </div>
        {validationError && <p className="form-error" role="alert">{validationError}</p>}
      </form>

      <div className="section-title">Native reminders</div>
      <div className="reminder-grid">
        {renderReminder('mealLogging', 'Meal logging', rem.mealLogging)}
        {renderReminder('weighIn', 'Weigh-in', rem.weighIn, rem.weighIn)}
        {renderReminder('electrolytes', 'Electrolytes', rem.electrolytes)}
        {renderReminder('shopping', 'Shopping list', rem.shopping, rem.shopping)}
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--primary" onClick={() => void handleSaveReminders()}>
          Save reminders
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => void handleTestReminder()}>
          Send test notification
        </button>
      </div>
      {reminderMsg && (
        <p className={`import-msg import-msg--${reminderMsg.type}`}>{reminderMsg.text}</p>
      )}

      <div className="section-title">Meal templates</div>
      <Meals
        embedded
        templates={templates}
        savedFoods={savedFoods}
        onSave={onSaveTemplate}
        onDelete={onDeleteTemplate}
        onAddToLog={onAddTemplateToLog}
      />

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
