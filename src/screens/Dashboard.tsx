import { ProgressBar } from '../components/ProgressBar';
import { StatCard } from '../components/StatCard';
import type { DailyNutritionSummary, NutritionTargets, Recommendation } from '../types';
import { carbStatus, carbStatusLabel, remainingCalories } from '../lib/nutrition';

interface DashboardProps {
  summary: DailyNutritionSummary;
  targets: NutritionTargets;
  recommendations: Recommendation[];
  onAddFood: () => void;
}

export function Dashboard({ summary, targets, recommendations, onAddFood }: DashboardProps) {
  const status = carbStatus(summary, targets);
  const remaining = remainingCalories(summary, targets);
  const statusVariant = status === 'aligned' ? 'success' : status === 'approaching' ? 'warning' : 'danger';
  const carbVariant = status === 'aligned' ? 'success' : status === 'approaching' ? 'warning' : 'danger';

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Today</h1>
        <button className="btn btn--primary btn--sm" onClick={onAddFood}>+ Add Food</button>
      </div>

      <div className={`keto-status keto-status--${statusVariant}`}>
        {carbStatusLabel(status)}
      </div>

      {summary.entryCount === 0 && (
        <p className="empty-hint">No food logged yet. Add your first meal to get started.</p>
      )}

      <div className="cards-grid">
        <StatCard
          label="Calories consumed"
          value={Math.round(summary.calories)}
          sub={`of ${targets.calories} kcal`}
          variant={summary.calories > targets.calories ? 'danger' : 'default'}
        />
        <StatCard
          label="Calories remaining"
          value={Math.round(remaining)}
          sub="kcal"
          variant={remaining < 0 ? 'danger' : remaining < 100 ? 'warning' : 'success'}
        />
      </div>

      <div className="section-title">Macros</div>

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
        variant={summary.fatG >= targets.fatG ? 'success' : 'default'}
      />

      <div className="section-title">Electrolytes</div>

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

      {recommendations.length > 0 && (
        <>
          <div className="section-title">Recommendations</div>
          <ul className="recommendations">
            {recommendations.map((r) => (
              <li key={r.id} className={`rec rec--${r.priority}`}>
                {r.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
