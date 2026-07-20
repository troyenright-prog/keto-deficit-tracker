import { useRef, useState } from 'react';
import type { FoodItem, FoodDatabaseItem, MealSlot, MealTemplate, UserProfile, NutritionTargets, ReminderKey, ReminderRule, ReminderSettings, WeightEntry, ActivityLevel } from '../types';
import { dietModeDefaultNetCarbs } from '../lib/nutrition';
import { exportAppData, validateAppBundle, importAppData } from '../lib/storage';
import { localDateString } from '../lib/date';
import { APP_VERSION, formatBuildDate } from '../lib/version';
import { hardRefreshApp } from '../lib/app-update';
import { ALL_WEEKDAYS, sendTestReminder, type ReminderScheduleResult } from '../lib/reminders';
import { MICRONUTRIENT_FIELDS } from '../lib/micronutrients';
import { getRdaForAgeSex } from '../lib/rda';
import { displayNumericValue, parseNumericInput } from '../lib/numeric-field';
import { ACTIVITY_LEVELS, ACTIVITY_LEVEL_LABELS, estimateTdee, recalcMacrosFromTdee } from '../lib/tdee';
import { Meals } from './Meals';
import { SavedFoods } from './SavedFoods';

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
  foodDatabase: FoodDatabaseItem[];
  weightEntries: WeightEntry[];
  onSaveProfile: (p: UserProfile) => boolean;
  onSaveTargets: (t: NutritionTargets) => boolean;
  onSaveReminders: (settings: ReminderSettings) => Promise<ReminderScheduleResult>;
  onSaveTemplate: (template: MealTemplate) => boolean;
  onDeleteTemplate: (id: string) => void;
  onAddTemplateToLog: (template: MealTemplate, meal?: MealSlot) => void;
  onSaveFood: (food: FoodItem) => boolean;
  onDeleteSavedFood: (id: string) => boolean;
  onAddSavedFoodToLog: (food: FoodItem) => void;
  onImportComplete: () => void;
  // Push side: shares this app's food log out to Health Connect as Nutrition
  // records, so read-only Health Connect apps (e.g. RepIQ) can pick it up.
  // "Sync Garmin" (on the Garmin screen) does this automatically too - this
  // toggle/button is for manual control and one-off pushes.
  nutritionSyncSupported: boolean;
  nutritionSyncEnabled: boolean;
  nutritionSyncLastAt: string;
  onToggleNutritionSync: (enabled: boolean) => void;
  onSyncNutritionToHealthConnect: () => Promise<string>;
  // Recovery action: if today's records were removed directly in Health
  // Connect (e.g. cleaning up a mis-dated duplicate), this app would
  // otherwise never re-send them, since each entry is only ever pushed once.
  // Clears today's entries from the synced-ids list, then re-pushes.
  onForceResyncNutritionToday: () => Promise<string>;
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
  foodDatabase,
  weightEntries,
  onSaveProfile,
  onSaveTargets,
  onSaveReminders,
  onSaveTemplate,
  onDeleteTemplate,
  onAddTemplateToLog,
  onSaveFood,
  onDeleteSavedFood,
  onAddSavedFoodToLog,
  onImportComplete,
  nutritionSyncSupported,
  nutritionSyncEnabled,
  nutritionSyncLastAt,
  onToggleNutritionSync,
  onSyncNutritionToHealthConnect,
  onForceResyncNutritionToday,
}: SettingsProps) {
  const [prof, setProf] = useState<UserProfile>(profile);
  const [ageText, setAgeText] = useState<string>(profile.age ? String(profile.age) : '');
  const [heightText, setHeightText] = useState<string>(profile.heightCm ? String(profile.heightCm) : '');
  const [proteinPerKgText, setProteinPerKgText] = useState<string>(String(targets.proteinPerKg ?? 2.0));
  const [deficitPercentText, setDeficitPercentText] = useState<string>(String(targets.deficitPercent ?? 15));
  const [tgts, setTgts] = useState<NutritionTargets>(targets);
  const [targetTexts, setTargetTexts] = useState<Record<string, string>>(() => seedTargetTexts(targets));
  const [rdaMsg, setRdaMsg] = useState('');
  const [tdeeMsg, setTdeeMsg] = useState('');
  const [rem, setRem] = useState<ReminderSettings>(reminders);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [validationError, setValidationError] = useState('');
  const [reminderMsg, setReminderMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pushingNutrition, setPushingNutrition] = useState(false);
  const [nutritionPushMessage, setNutritionPushMessage] = useState('');
  const [resyncingNutritionToday, setResyncingNutritionToday] = useState(false);
  const [nutritionResyncMessage, setNutritionResyncMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function runNutritionPush() {
    if (pushingNutrition) return;
    setPushingNutrition(true);
    setNutritionPushMessage('');
    try {
      setNutritionPushMessage(await onSyncNutritionToHealthConnect());
    } catch (err) {
      setNutritionPushMessage(err instanceof Error ? err.message : 'Could not push nutrition to Health Connect.');
    } finally {
      setPushingNutrition(false);
    }
  }

  async function runForceResyncNutritionToday() {
    if (resyncingNutritionToday) return;
    setResyncingNutritionToday(true);
    setNutritionResyncMessage('');
    try {
      setNutritionResyncMessage(await onForceResyncNutritionToday());
    } catch (err) {
      setNutritionResyncMessage(err instanceof Error ? err.message : 'Could not resync nutrition to Health Connect.');
    } finally {
      setResyncingNutritionToday(false);
    }
  }

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

  function handleHeightChange(value: string) {
    setHeightText(value);
    const parsed = Number(value);
    setProf((p) => ({ ...p, heightCm: value !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined }));
  }

  function handleActivityLevelChange(value: ActivityLevel) {
    setProf((p) => ({ ...p, activityLevel: value }));
  }

  function handleProteinPerKgChange(value: string) {
    setProteinPerKgText(value);
    const parsed = Number(value);
    if (value !== '' && Number.isFinite(parsed)) setTgts((t) => ({ ...t, proteinPerKg: parsed }));
  }

  function handleDeficitPercentChange(value: string) {
    setDeficitPercentText(value);
    const parsed = Number(value);
    if (value !== '' && Number.isFinite(parsed)) setTgts((t) => ({ ...t, deficitPercent: parsed }));
  }

  function handleRecalculateMacros() {
    const estimate = estimateTdee(prof, weightEntries);
    if (!estimate) {
      setTdeeMsg('Set your height, age, and sex above, and log at least one weigh-in first.');
      return;
    }
    const proteinPerKg = tgts.proteinPerKg ?? 2.0;
    const deficitPercent = tgts.deficitPercent ?? 15;
    const { calories, proteinG, fatG } = recalcMacrosFromTdee(estimate, tgts.netCarbsG, proteinPerKg, deficitPercent);
    setTgts((t) => ({ ...t, calories, proteinG, fatG, proteinPerKg, deficitPercent }));
    setTargetTexts((texts) => ({
      ...texts,
      calories: displayNumericValue(calories),
      proteinG: displayNumericValue(proteinG),
      fatG: displayNumericValue(fatG),
    }));
    setTdeeMsg(
      `Est. TDEE ~${Math.round(estimate.tdee)} kcal${estimate.bodyFatPercent != null ? ` (from ${estimate.bodyFatPercent.toFixed(1)}% body fat)` : ' (no body fat logged, using height/age estimate)'} → calories, protein, and fat updated below. Review and save.`,
    );
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

  function setReminderDays(key: ReminderKey, days: number[]) {
    updateReminder(key, { days, weekday: days[0] } as Partial<ReminderSettings[typeof key]>);
  }

  function toggleReminderDay(key: ReminderKey, day: number, currentDays: number[]) {
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
  ) {
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
        <div className="reminder-days">
          <div className="reminder-days-presets">
            <button
              type="button"
              className={`btn btn--ghost btn--xs${sameDays(rule.days, ALL_WEEKDAYS) ? ' btn--preset-active' : ''}`}
              disabled={!rule.enabled}
              onClick={() => setReminderDays(key, ALL_WEEKDAYS)}
            >
              Every day
            </button>
            <button
              type="button"
              className={`btn btn--ghost btn--xs${sameDays(rule.days, WEEKDAY_ONLY_DAYS) ? ' btn--preset-active' : ''}`}
              disabled={!rule.enabled}
              onClick={() => setReminderDays(key, WEEKDAY_ONLY_DAYS)}
            >
              Weekdays
            </button>
          </div>
          <div className="reminder-day-chips" role="group" aria-label={`${label} days`}>
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                className={`day-chip${rule.days.includes(day.value) ? ' day-chip--active' : ''}`}
                aria-pressed={rule.days.includes(day.value)}
                aria-label={day.label}
                disabled={!rule.enabled}
                onClick={() => toggleReminderDay(key, day.value, rule.days)}
              >
                {day.label.slice(0, 1)}
              </button>
            ))}
          </div>
        </div>
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

      <form id="settings-form" onSubmit={handleSave} className="profile-form">
        <details className="settings-section">
          <summary>Profile</summary>
          <div className="settings-section-body">
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
              Age and sex are used to suggest recommended vitamin and mineral targets, and (with height, below) to estimate TDEE — they're not required otherwise.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="profile-height">Height (cm)</label>
                <input
                  id="profile-height"
                  type="number"
                  min="120"
                  max="230"
                  placeholder="e.g. 175"
                  value={heightText}
                  onChange={(e) => handleHeightChange(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="profile-activity">Activity level</label>
                <select
                  id="profile-activity"
                  value={prof.activityLevel ?? 'moderate'}
                  onChange={(e) => handleActivityLevelChange(e.target.value as ActivityLevel)}
                >
                  {ACTIVITY_LEVELS.map((level) => (
                    <option key={level} value={level}>{ACTIVITY_LEVEL_LABELS[level]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </details>

        <details className="settings-section">
          <summary>Diet mode</summary>
          <div className="settings-section-body">
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
          </div>
        </details>

        <details className="settings-section">
          <summary>Nutrition calculator</summary>
          <div className="settings-section-body">
            <p className="empty-hint" style={{ marginTop: 0 }}>
              Estimates TDEE (Katch-McArdle from your latest logged weight + body fat, or Mifflin-St Jeor from height/age/sex if no body fat is logged) and solves calories, protein, and fat around your net-carb ceiling above.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="t-protein-per-kg">Protein target (g/kg)</label>
                <input
                  id="t-protein-per-kg"
                  type="number"
                  min="1.2"
                  max="3.5"
                  step="0.1"
                  value={proteinPerKgText}
                  onChange={(e) => handleProteinPerKgChange(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="t-deficit-percent">Deficit % (negative = surplus)</label>
                <input
                  id="t-deficit-percent"
                  type="number"
                  min="-20"
                  max="40"
                  step="1"
                  value={deficitPercentText}
                  onChange={(e) => handleDeficitPercentChange(e.target.value)}
                />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 0, marginBottom: 8 }}>
              <button type="button" className="btn btn--secondary btn--sm" onClick={handleRecalculateMacros}>
                Recalculate macros from TDEE
              </button>
            </div>
            {tdeeMsg && <p className="empty-hint" style={{ marginTop: 0 }}>{tdeeMsg}</p>}
          </div>
        </details>

        <details className="settings-section">
          <summary>Daily targets</summary>
          <div className="settings-section-body">
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
          </div>
        </details>

        <details className="settings-section">
          <summary>Electrolyte targets</summary>
          <div className="settings-section-body">
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
          </div>
        </details>

        <details className="settings-section">
          <summary>Micronutrient &amp; vitamin targets</summary>
          <div className="settings-section-body">
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
          </div>
        </details>
      </form>

      <details className="settings-section">
        <summary>Native reminders</summary>
        <div className="settings-section-body">
          <div className="reminder-grid">
            {renderReminder('mealLogging', 'Meal logging', rem.mealLogging)}
            {renderReminder('weighIn', 'Weigh-in', rem.weighIn)}
            {renderReminder('electrolytes', 'Electrolytes', rem.electrolytes)}
            {renderReminder('shopping', 'Shopping list', rem.shopping)}
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
        </div>
      </details>

      <details className="settings-section">
        <summary>Meal templates</summary>
        <div className="settings-section-body">
          <Meals
            embedded
            templates={templates}
            savedFoods={savedFoods}
            foodDatabase={foodDatabase}
            onSave={onSaveTemplate}
            onDelete={onDeleteTemplate}
            onAddToLog={onAddTemplateToLog}
          />
        </div>
      </details>

      <details className="settings-section">
        <summary>Saved foods</summary>
        <div className="settings-section-body">
          <SavedFoods
            embedded
            foods={savedFoods}
            onSave={onSaveFood}
            onDelete={onDeleteSavedFood}
            onAddToLog={onAddSavedFoodToLog}
          />
        </div>
      </details>

      {nutritionSyncSupported && (
        <details className="settings-section">
          <summary>Share nutrition with Health Connect</summary>
          <div className="settings-section-body">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={nutritionSyncEnabled}
                onChange={(event) => onToggleNutritionSync(event.target.checked)}
              />
              Push logged meals to Health Connect
            </label>
            <p className="empty-hint" style={{ marginTop: 0 }}>
              Lets other Health Connect apps (like RepIQ) read your macros. "Sync Garmin" on the Garmin
              screen does this automatically too - use this button for a one-off push. Each meal is
              written once when logged; editing or deleting an entry afterwards won't change what was
              already sent.
            </p>
            <button type="button" className="btn btn--secondary btn--sm" onClick={runNutritionPush} disabled={pushingNutrition}>
              {pushingNutrition ? 'Pushing…' : 'Push now'}
            </button>
            {nutritionPushMessage && <p className="sync-status-line" role="status">{nutritionPushMessage}</p>}
            {!nutritionPushMessage && nutritionSyncLastAt && (
              <p className="sync-status-line">Last pushed {new Date(nutritionSyncLastAt).toLocaleString()}</p>
            )}
            <p className="empty-hint" style={{ marginTop: '12px' }}>
              If you deleted today's Nutrition records directly in Health Connect (e.g. to remove a
              mis-dated duplicate) and they're now missing there, use this to re-send today's entries -
              this app otherwise thinks they're already synced and won't push them again on its own.
            </p>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={runForceResyncNutritionToday}
              disabled={resyncingNutritionToday}
            >
              {resyncingNutritionToday ? 'Resyncing…' : "Force resync today's nutrition"}
            </button>
            {nutritionResyncMessage && <p className="sync-status-line" role="status">{nutritionResyncMessage}</p>}
          </div>
        </details>
      )}

      <details className="settings-section">
        <summary>Backup &amp; Restore</summary>
        <div className="settings-section-body">
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
        </div>
      </details>

      <details className="settings-section">
        <summary>App version</summary>
        <div className="settings-section-body">
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
      </details>

      <div className="form-actions">
        <button type="submit" form="settings-form" className="btn btn--primary">Save settings</button>
        {saved && <span className="success-inline">Saved!</span>}
      </div>
      {validationError && <p className="form-error" role="alert">{validationError}</p>}
    </div>
  );
}
