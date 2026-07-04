import { useState } from 'react';
import { ProgressBar } from '../components/ProgressBar';
import { StatCard } from '../components/StatCard';
import type { DailyActivityEntry, DailyNutritionSummary, FoodLogEntry, NutritionTargets, Recommendation, UserProfile } from '../types';
import { calcNetCarbs, carbStatus, carbStatusLabel, remainingCalories } from '../lib/nutrition';
import { entryMeal, MEAL_SLOTS } from '../lib/meals';
import { buildSmartSuggestions } from '../lib/suggestions';
import { formatMicronutrientAmount, MICRONUTRIENT_FIELDS } from '../lib/micronutrients';
import { buildNutritionHints } from '../lib/nutrition-hints';

interface DashboardProps {
  summary: DailyNutritionSummary;
  entries: FoodLogEntry[];
  activity?: DailyActivityEntry;
  targets: NutritionTargets;
  recommendations: Recommendation[];
  profile?: Pick<UserProfile, 'age' | 'sex'>;
  onAddFood: () => void;
  onSyncGarmin?: () => Promise<string>;
}

const SMART_SUGGESTION_HEADLINES: Record<string, string> = {
  'sugg-zero-carb': 'Choose zero-carb foods next.',
  'sugg-protein': 'Prioritise protein next.',
  'sugg-balanced': 'Add protein and healthy fats.',
  'sugg-small-meal': 'Fit a small protein snack.',
  'sugg-sodium': 'Top up sodium.',
  'sugg-potassium': 'Top up potassium.',
  'sugg-magnesium': 'Top up magnesium.',
  'calories-exceeded': 'Reset around protein at the next meal.',
  'calories-low-late': 'Add a simple protein-forward meal.',
  'protein-low': 'Prioritise protein next.',
  'carbs-exceeded': 'Choose zero-carb foods next.',
  'carbs-approaching': 'Choose very low-carb foods next.',
  'sodium-low': 'Top up sodium.',
  'potassium-low': 'Top up potassium.',
  'magnesium-low': 'Top up magnesium.',
  'on-track': 'Stay protein-first and low carb.',
};

function recommendationTopic(id: string): string {
  if (id === 'sugg-zero-carb' || id.startsWith('carbs-')) return 'carbs';
  if (id === 'sugg-balanced' || id === 'sugg-small-meal' || id.startsWith('calories-')) return 'calories';
  if (id.includes('protein')) return 'protein';
  if (id.includes('sodium')) return 'sodium';
  if (id.includes('potassium')) return 'potassium';
  if (id.includes('magnesium')) return 'magnesium';
  return id;
}

function relatedTopicsForMove(rec: Recommendation): string[] {
  const topic = recommendationTopic(rec.id);
  const topics = [topic];
  if (rec.id === 'sugg-protein' || rec.id === 'protein-low' || rec.id === 'sugg-balanced' || rec.id === 'sugg-small-meal') {
    topics.push('calories');
  }
  if (rec.id === 'calories-low-late') topics.push('protein');
  return topics;
}

function headlineForMove(rec: Recommendation): string {
  return SMART_SUGGESTION_HEADLINES[rec.id] ?? rec.message;
}

export function Dashboard({ summary, entries, activity, targets, recommendations, profile, onAddFood, onSyncGarmin }: DashboardProps) {
  const [garminSyncing, setGarminSyncing] = useState(false);
  const [garminSyncMessage, setGarminSyncMessage] = useState('');
  const status = carbStatus(summary, targets);
  const remaining = remainingCalories(summary, targets);
  const statusVariant = status === 'aligned' ? 'success' : status === 'approaching' ? 'warning' : 'danger';
  const carbVariant = status === 'aligned' ? 'success' : status === 'approaching' ? 'warning' : 'danger';
  const caloriesPercent = targets.calories > 0 ? Math.min(100, Math.max(0, (summary.calories / targets.calories) * 100)) : 0;
  const displayRemaining = Math.round(remaining);
  const proteinGap = Math.max(0, targets.proteinG - summary.proteinG);
  const fatRemaining = Math.max(0, targets.fatG - summary.fatG);
  const micronutrientProgress = MICRONUTRIENT_FIELDS
    .map((field) => ({
      field,
      value: summary[field.key] ?? 0,
      target: targets[field.key] ?? 0,
    }))
    .filter((item) => item.value > 0 || item.target > 0);
  const targetedMicronutrients = micronutrientProgress.filter((item) => item.target > 0);
  const untargetedMicronutrients = micronutrientProgress.filter((item) => item.target === 0 && item.value > 0);

  const nutritionHints = buildNutritionHints(summary, targets, entries, profile);
  const suggestions = buildSmartSuggestions(summary, targets);
  const nextMove = suggestions[0] ?? recommendations.find((rec) => rec.priority !== 'success') ?? recommendations[0];
  const surfacedMoves = summary.entryCount > 0 && nextMove ? [nextMove] : [];
  const surfacedTopics = new Set(surfacedMoves.flatMap(relatedTopicsForMove));
  const visibleRecommendations = recommendations.filter(
    (rec) => !surfacedMoves.some((move) => move.id === rec.id) && !surfacedTopics.has(recommendationTopic(rec.id)),
  );
  const mealSummaries = MEAL_SLOTS.map((slot) => {
    const mealEntries = entries.filter((entry) => entryMeal(entry) === slot.id);
    return {
      ...slot,
      count: mealEntries.length,
      calories: mealEntries.reduce((sum, entry) => sum + entry.calories, 0),
      netCarbsG: mealEntries.reduce((sum, entry) => sum + calcNetCarbs(entry.totalCarbsG, entry.fibreG, entry.sugarAlcoholsG), 0),
    };
  });

  async function runGarminSync() {
    if (!onSyncGarmin || garminSyncing) return;
    setGarminSyncing(true);
    setGarminSyncMessage('');
    try {
      setGarminSyncMessage(await onSyncGarmin());
    } catch (err) {
      setGarminSyncMessage(err instanceof Error ? err.message : 'Could not sync from Garmin.');
    } finally {
      setGarminSyncing(false);
    }
  }

  return (
    <div className="screen">
      {summary.entryCount > 0 && (
        <div className="suggestions-section" aria-label="What should I eat next">
          <div className="section-title">What should I eat next?</div>
          {nextMove ? (
            <div className={`next-move next-move--${nextMove.priority}`}>
              <strong>{nextMove.priority === 'warning' ? 'Check this first' : 'Next move'}</strong>
              <span>{headlineForMove(nextMove)}</span>
            </div>
          ) : (
            <p className="empty-hint empty-hint--compact">You are on track - keep the next meal protein-first and low carb.</p>
          )}
        </div>
      )}

      <div className="dashboard-hero dashboard-hero--compact">
        <div className="dashboard-hero__top">
          <div>
            <span className="eyebrow">Today</span>
            <h1>{displayRemaining >= 0 ? displayRemaining : Math.abs(displayRemaining)}</h1>
            <p>{displayRemaining >= 0 ? 'calories remaining' : 'calories over target'}</p>
          </div>
          <div className="dashboard-hero__actions">
            <button className="btn btn--primary" onClick={onAddFood}>+ Add food</button>
            {onSyncGarmin && (
              <button
                type="button"
                className="btn btn--secondary dashboard-hero__sync"
                onClick={() => void runGarminSync()}
                disabled={garminSyncing}
              >
                {garminSyncing ? 'Syncing...' : 'Sync Garmin'}
              </button>
            )}
          </div>
        </div>
        {garminSyncMessage && <p className="dashboard-garmin-sync-status" role="status">{garminSyncMessage}</p>}
        <div className="hero-meter" aria-label="Calories progress">
          <span style={{ width: `${caloriesPercent}%` }} />
        </div>
        <div className="dashboard-hero__meta">
          <span>{Math.round(summary.calories)} eaten</span>
          <span>{targets.calories} target</span>
        </div>
      </div>

      <div className={`keto-status keto-status--${statusVariant}`}>
        {carbStatusLabel(status)}
      </div>

      {visibleRecommendations.length > 0 && (
        <>
          <div className="section-title">Needs attention</div>
          <ul className="recommendations">
            {visibleRecommendations.map((r) => (
              <li key={r.id} className={`rec rec--${r.priority}`}>
                {r.message}
              </li>
            ))}
          </ul>
        </>
      )}

      {summary.entryCount === 0 && (
        <p className="empty-hint">No food logged yet. Add your first meal to get started.</p>
      )}

      <div className="cards-grid cards-grid--hero">
        <StatCard
          label="Protein"
          value={`${summary.proteinG.toFixed(1)}g`}
          sub={proteinGap > 0 ? `${proteinGap.toFixed(1)}g to go` : 'target met'}
          variant={summary.proteinG >= targets.proteinG ? 'success' : 'default'}
        />
        <StatCard
          label="Net carbs"
          value={`${summary.netCarbsG.toFixed(1)}g`}
          sub={`${Math.max(0, targets.netCarbsG - summary.netCarbsG).toFixed(1)}g left`}
          variant={carbVariant}
        />
        <StatCard
          label="Fat"
          value={`${summary.fatG.toFixed(1)}g`}
          sub={summary.fatG > targets.fatG ? `${(summary.fatG - targets.fatG).toFixed(1)}g over` : `${fatRemaining.toFixed(1)}g left`}
          variant={summary.fatG > targets.fatG ? 'warning' : 'default'}
        />
        <StatCard
          label="Logged"
          value={summary.entryCount}
          sub={summary.entryCount === 1 ? 'entry today' : 'entries today'}
          variant={summary.entryCount > 0 ? 'success' : 'default'}
        />
        {activity && (
          <StatCard
            label={activity.date === summary.date ? 'Steps today' : 'Latest steps'}
            value={activity.steps.toLocaleString()}
            sub={activity.date === summary.date ? 'Garmin via Health Connect' : activity.date}
          />
        )}
      </div>

      <div className="section-title">Daily progress</div>

      <div className="progress-panel">
        <ProgressBar
          label="Calories"
          value={summary.calories}
          max={targets.calories}
          unit=" kcal"
          variant={summary.calories > targets.calories ? 'danger' : 'default'}
        />
        <ProgressBar
          label="Protein"
          value={Math.round(summary.proteinG * 10) / 10}
          max={targets.proteinG}
          unit="g"
          decimals={1}
          variant={summary.proteinG >= targets.proteinG ? 'success' : 'default'}
        />
        <ProgressBar
          label="Net carbs"
          value={Math.round(summary.netCarbsG * 10) / 10}
          max={targets.netCarbsG}
          unit="g"
          decimals={1}
          variant={carbVariant}
        />
        <ProgressBar
          label="Fat"
          value={Math.round(summary.fatG * 10) / 10}
          max={targets.fatG}
          unit="g"
          decimals={1}
          variant={summary.fatG > targets.fatG ? 'warning' : 'default'}
        />
      </div>

      <div className="cards-grid cards-grid--calories">
        <StatCard
          label="Consumed"
          value={Math.round(summary.calories)}
          sub={`of ${targets.calories} kcal`}
          variant={summary.calories > targets.calories ? 'danger' : 'default'}
        />
        <StatCard
          label="Remaining"
          value={Math.round(remaining)}
          sub="kcal"
          variant={remaining < 0 ? 'danger' : remaining < 100 ? 'warning' : 'success'}
        />
      </div>

      {summary.entryCount > 0 && (
        <>
          <div className="section-title">Meals today</div>
          <div className="meal-summary-grid">
            {mealSummaries.map((meal) => (
              <div key={meal.id} className={`meal-summary-card${meal.count === 0 ? ' meal-summary-card--empty' : ''}`}>
                <strong>{meal.label}</strong>
                <span>{meal.count === 0 ? 'No entries' : `${Math.round(meal.calories)} kcal`}</span>
                {meal.count > 0 && <small>{meal.netCarbsG.toFixed(1)}g net carbs</small>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Electrolytes</div>

      <div className="progress-panel progress-panel--electrolytes">
        <ProgressBar
          label="Sodium"
          value={Math.round(summary.sodiumMg)}
          max={targets.sodiumMg}
          unit=" mg"
          variant={summary.sodiumMg >= targets.sodiumMg ? 'success' : 'default'}
        />
        <ProgressBar
          label="Potassium"
          value={Math.round(summary.potassiumMg)}
          max={targets.potassiumMg}
          unit=" mg"
          variant={summary.potassiumMg >= targets.potassiumMg ? 'success' : 'default'}
        />
        <ProgressBar
          label="Magnesium"
          value={Math.round(summary.magnesiumMg)}
          max={targets.magnesiumMg}
          unit=" mg"
          variant={summary.magnesiumMg >= targets.magnesiumMg ? 'success' : 'default'}
        />
      </div>

      {nutritionHints.length > 0 && (
        <>
          <div className="section-title">What to fix next</div>
          <ul className="nutrition-hints">
            {nutritionHints.map((hint) => (
              <li key={hint.id} className={`nutrition-hint nutrition-hint--${hint.kind}`}>
                <strong>{hint.title}</strong>
                <span>{hint.reason}</span>
                <span className="nutrition-hint__advice">{hint.advice}</span>
                {hint.caveat && <small>{hint.caveat}</small>}
              </li>
            ))}
          </ul>
        </>
      )}

      {micronutrientProgress.length > 0 && (
        <>
          <div className="section-title">Micronutrients &amp; vitamins</div>
          {targetedMicronutrients.length > 0 && (
            <div className="progress-panel progress-panel--micronutrients">
              {targetedMicronutrients.map(({ field, value, target }) => (
                <ProgressBar
                  key={field.key}
                  label={field.label}
                  value={Number(value.toFixed(field.decimals))}
                  max={target}
                  unit={` ${field.unit}`}
                  decimals={field.decimals}
                  variant={value >= target ? 'success' : 'default'}
                />
              ))}
            </div>
          )}
          {untargetedMicronutrients.length > 0 && (
            <div className="template-totals">
              <strong>Logged totals</strong>
              {untargetedMicronutrients.map(({ field, value }) => (
                <span key={field.key}>{field.label} {formatMicronutrientAmount(field, value)}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
