import { ProgressBar } from '../components/ProgressBar';
import { StatCard } from '../components/StatCard';
import type { DailyNutritionSummary, FoodLogEntry, NutritionTargets, Recommendation } from '../types';
import { calcNetCarbs, carbStatus, carbStatusLabel, remainingCalories } from '../lib/nutrition';
import { entryMeal, MEAL_SLOTS } from '../lib/meals';
import { buildSmartSuggestions } from '../lib/suggestions';
import { formatMicronutrientAmount, MICRONUTRIENT_FIELDS } from '../lib/micronutrients';

interface DashboardProps {
  summary: DailyNutritionSummary;
  entries: FoodLogEntry[];
  targets: NutritionTargets;
  recommendations: Recommendation[];
  onAddFood: () => void;
}

export function Dashboard({ summary, entries, targets, recommendations, onAddFood }: DashboardProps) {
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

  const suggestions = buildSmartSuggestions(summary, targets);
  const nextMove = suggestions[0] ?? recommendations.find((rec) => rec.priority !== 'success') ?? recommendations[0];
  const mealSummaries = MEAL_SLOTS.map((slot) => {
    const mealEntries = entries.filter((entry) => entryMeal(entry) === slot.id);
    return {
      ...slot,
      count: mealEntries.length,
      calories: mealEntries.reduce((sum, entry) => sum + entry.calories, 0),
      netCarbsG: mealEntries.reduce((sum, entry) => sum + calcNetCarbs(entry.totalCarbsG, entry.fibreG, entry.sugarAlcoholsG), 0),
    };
  });

  return (
    <div className="screen">
      <div className="dashboard-hero">
        <div className="dashboard-hero__top">
          <div>
            <span className="eyebrow">Today</span>
            <h1>{displayRemaining >= 0 ? displayRemaining : Math.abs(displayRemaining)}</h1>
            <p>{displayRemaining >= 0 ? 'calories remaining' : 'calories over target'}</p>
          </div>
          <button className="btn btn--primary" onClick={onAddFood}>+ Add food</button>
        </div>
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

      {recommendations.length > 0 && (
        <>
          <div className="section-title">Needs attention</div>
          <ul className="recommendations">
            {recommendations.map((r) => (
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
      </div>

      {summary.entryCount > 0 && (
        <div className="suggestions-section" aria-label="What should I eat next">
          <div className="section-title">What should I eat next?</div>
          {nextMove ? (
            <div className={`next-move next-move--${nextMove.priority}`}>
              <strong>{nextMove.priority === 'warning' ? 'Check this first' : 'Next move'}</strong>
              <span>{nextMove.message}</span>
            </div>
          ) : (
            <p className="empty-hint empty-hint--compact">You are on track - keep the next meal protein-first and low carb.</p>
          )}
          {suggestions.length > 1 && (
            <ul className="recommendations recommendations--compact">
              {suggestions.slice(1).map((s) => (
                <li key={s.id} className={`rec rec--${s.priority}`}>
                  {s.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
