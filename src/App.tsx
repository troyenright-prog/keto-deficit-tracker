import { useState, useCallback } from 'react';
import './App.css';
import { Nav } from './components/Nav';
import { Dashboard } from './screens/Dashboard';
import { AddFood } from './screens/AddFood';
import { DailyLog } from './screens/DailyLog';
import { WeeklySummary } from './screens/WeeklySummary';
import { SavedFoods } from './screens/SavedFoods';
import { Meals } from './screens/Meals';
import { Recipes } from './screens/Recipes';
import { Planner } from './screens/Planner';
import { Shopping } from './screens/Shopping';
import { Weight } from './screens/Weight';
import { Settings } from './screens/Settings';
import {
  loadProfile, saveProfile,
  loadTargets, saveTargets,
  loadFoodLog, saveFoodLog,
  loadSavedFoods, saveSavedFoods,
  loadWeightEntries, saveWeightEntries,
  loadMealTemplates, saveMealTemplates,
  loadRecipes, saveRecipes,
  loadShoppingList, saveShoppingList,
  loadMealPlan, saveMealPlan,
  migrateIfNeeded,
} from './lib/storage';
import { summariseDay, todayDateString } from './lib/nutrition';
import { buildRecommendations } from './lib/recommendations';
import { templateToLogEntries } from './lib/meal-templates';
import { recipeToLogEntry } from './lib/recipes';
import { nanoid } from './lib/nanoid';
import type {
  FoodLogEntry,
  FoodItem,
  UserProfile,
  NutritionTargets,
  WeightEntry,
  MealTemplate,
  Recipe,
  ShoppingItem,
  MealPlanEntry,
} from './types';

// Run migration once on startup
migrateIfNeeded();

export type Screen =
  | 'dashboard'
  | 'add-food'
  | 'daily-log'
  | 'weekly'
  | 'saved-foods'
  | 'meals'
  | 'recipes'
  | 'planner'
  | 'shopping'
  | 'weight'
  | 'settings';

function reloadAll() {
  return {
    profile: loadProfile(),
    targets: loadTargets(),
    foodLog: loadFoodLog(),
    savedFoods: loadSavedFoods(),
    weightEntries: loadWeightEntries(),
    mealTemplates: loadMealTemplates(),
    recipes: loadRecipes(),
    shoppingList: loadShoppingList(),
    mealPlan: loadMealPlan(),
  };
}

function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [targets, setTargets] = useState<NutritionTargets>(loadTargets);
  const [foodLog, setFoodLog] = useState<FoodLogEntry[]>(loadFoodLog);
  const [savedFoods, setSavedFoods] = useState<FoodItem[]>(loadSavedFoods);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>(loadWeightEntries);
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>(loadMealTemplates);
  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(loadShoppingList);
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>(loadMealPlan);

  const today = todayDateString();
  const todaySummary = summariseDay(today, foodLog);
  const recommendations = buildRecommendations(todaySummary, targets);

  // ── Food log ───────────────────────────────────────────────────────────────

  const handleAddEntry = useCallback((entry: FoodLogEntry) => {
    setFoodLog((prev) => { const next = [...prev, entry]; saveFoodLog(next); return next; });
  }, []);

  const handleAddEntries = useCallback((entries: FoodLogEntry[]) => {
    setFoodLog((prev) => { const next = [...prev, ...entries]; saveFoodLog(next); return next; });
  }, []);

  const handleDeleteEntry = useCallback((id: string) => {
    setFoodLog((prev) => { const next = prev.filter((e) => e.id !== id); saveFoodLog(next); return next; });
  }, []);

  const handleEditEntry = useCallback((updated: FoodLogEntry) => {
    setFoodLog((prev) => { const next = prev.map((e) => (e.id === updated.id ? updated : e)); saveFoodLog(next); return next; });
  }, []);

  // ── Saved foods ────────────────────────────────────────────────────────────

  const handleSaveFood = useCallback((food: FoodItem) => {
    setSavedFoods((prev) => {
      const exists = prev.findIndex((f) => f.id === food.id);
      const next = exists >= 0 ? prev.map((f) => f.id === food.id ? food : f) : [...prev, food];
      saveSavedFoods(next);
      return next;
    });
  }, []);

  const handleDeleteSavedFood = useCallback((id: string) => {
    setSavedFoods((prev) => { const next = prev.filter((f) => f.id !== id); saveSavedFoods(next); return next; });
  }, []);

  const handleAddSavedFoodToLog = useCallback((food: FoodItem) => {
    const entry: FoodLogEntry = {
      id: nanoid(),
      date: today,
      foodItemId: food.id,
      source: 'saved-food',
      name: food.name,
      servingSize: food.servingSize,
      servingMultiplier: 1,
      calories: food.calories,
      proteinG: food.proteinG,
      fatG: food.fatG,
      totalCarbsG: food.totalCarbsG,
      fibreG: food.fibreG,
      sugarAlcoholsG: food.sugarAlcoholsG,
      sodiumMg: food.sodiumMg,
      potassiumMg: food.potassiumMg,
      magnesiumMg: food.magnesiumMg,
      loggedAt: new Date().toISOString(),
    };
    handleAddEntry(entry);
    setScreen('dashboard');
  }, [today, handleAddEntry]);

  // ── Profile / targets ──────────────────────────────────────────────────────

  const handleSaveProfile = useCallback((p: UserProfile) => { setProfile(p); saveProfile(p); }, []);
  const handleSaveTargets = useCallback((t: NutritionTargets) => { setTargets(t); saveTargets(t); }, []);

  // ── Weight ─────────────────────────────────────────────────────────────────

  const handleSaveWeightEntries = useCallback((entries: WeightEntry[]) => {
    setWeightEntries(entries);
    saveWeightEntries(entries);
  }, []);

  // ── Meal templates ─────────────────────────────────────────────────────────

  const handleSaveTemplate = useCallback((template: MealTemplate) => {
    setMealTemplates((prev) => {
      const exists = prev.findIndex((t) => t.id === template.id);
      const next = exists >= 0 ? prev.map((t) => t.id === template.id ? template : t) : [...prev, template];
      saveMealTemplates(next);
      return next;
    });
  }, []);

  const handleDeleteTemplate = useCallback((id: string) => {
    setMealTemplates((prev) => { const next = prev.filter((t) => t.id !== id); saveMealTemplates(next); return next; });
  }, []);

  const handleAddTemplateToLog = useCallback((template: MealTemplate) => {
    handleAddEntries(templateToLogEntries(template, today));
    setScreen('dashboard');
  }, [today, handleAddEntries]);

  // ── Recipes ────────────────────────────────────────────────────────────────

  const handleSaveRecipe = useCallback((recipe: Recipe) => {
    setRecipes((prev) => {
      const exists = prev.findIndex((r) => r.id === recipe.id);
      const next = exists >= 0 ? prev.map((r) => r.id === recipe.id ? recipe : r) : [...prev, recipe];
      saveRecipes(next);
      return next;
    });
  }, []);

  const handleDeleteRecipe = useCallback((id: string) => {
    setRecipes((prev) => { const next = prev.filter((r) => r.id !== id); saveRecipes(next); return next; });
  }, []);

  const handleAddRecipeToLog = useCallback((recipe: Recipe, servings: number) => {
    handleAddEntry(recipeToLogEntry(recipe, servings, today));
    setScreen('dashboard');
  }, [today, handleAddEntry]);

  // ── Shopping list ──────────────────────────────────────────────────────────

  const handleSaveShoppingList = useCallback((items: ShoppingItem[]) => {
    setShoppingList(items);
    saveShoppingList(items);
  }, []);

  // ── Meal plan ──────────────────────────────────────────────────────────────

  const handleSaveMealPlan = useCallback((plan: MealPlanEntry[]) => {
    setMealPlan(plan);
    saveMealPlan(plan);
  }, []);

  const handleConvertPlanToLog = useCallback((entries: MealPlanEntry[]) => {
    const logEntries: FoodLogEntry[] = entries.map((e) => ({
      id: nanoid(),
      date: e.date,
      source: 'plan' as const,
      name: e.name,
      servingSize: `${e.servings} serving(s)`,
      servingMultiplier: e.servings,
      calories: e.calories,
      proteinG: e.proteinG,
      fatG: e.fatG,
      totalCarbsG: e.totalCarbsG,
      fibreG: e.fibreG,
      sugarAlcoholsG: e.sugarAlcoholsG,
      sodiumMg: e.sodiumMg,
      potassiumMg: e.potassiumMg,
      magnesiumMg: e.magnesiumMg,
      loggedAt: new Date().toISOString(),
    }));
    handleAddEntries(logEntries);
  }, [handleAddEntries]);

  // ── Import complete ────────────────────────────────────────────────────────

  const handleImportComplete = useCallback(() => {
    const data = reloadAll();
    setProfile(data.profile);
    setTargets(data.targets);
    setFoodLog(data.foodLog);
    setSavedFoods(data.savedFoods);
    setWeightEntries(data.weightEntries);
    setMealTemplates(data.mealTemplates);
    setRecipes(data.recipes);
    setShoppingList(data.shoppingList);
    setMealPlan(data.mealPlan);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Keto Tracker</span>
        {profile.name && <span className="app-user">Hi, {profile.name}</span>}
      </header>

      <main className="app-main">
        {screen === 'dashboard' && (
          <Dashboard
            summary={todaySummary}
            targets={targets}
            recommendations={recommendations}
            onAddFood={() => setScreen('add-food')}
          />
        )}
        {screen === 'add-food' && (
          <AddFood
            savedFoods={savedFoods}
            onAdd={handleAddEntry}
            onSaveFood={handleSaveFood}
          />
        )}
        {screen === 'daily-log' && (
          <DailyLog
            log={foodLog}
            savedFoods={savedFoods}
            onDelete={handleDeleteEntry}
            onEdit={handleEditEntry}
            onSaveFood={handleSaveFood}
          />
        )}
        {screen === 'weekly' && (
          <WeeklySummary log={foodLog} targets={targets} />
        )}
        {screen === 'saved-foods' && (
          <SavedFoods
            foods={savedFoods}
            onSave={handleSaveFood}
            onDelete={handleDeleteSavedFood}
            onAddToLog={handleAddSavedFoodToLog}
          />
        )}
        {screen === 'meals' && (
          <Meals
            templates={mealTemplates}
            savedFoods={savedFoods}
            onSave={handleSaveTemplate}
            onDelete={handleDeleteTemplate}
            onAddToLog={handleAddTemplateToLog}
          />
        )}
        {screen === 'recipes' && (
          <Recipes
            recipes={recipes}
            onSave={handleSaveRecipe}
            onDelete={handleDeleteRecipe}
            onAddToLog={handleAddRecipeToLog}
          />
        )}
        {screen === 'planner' && (
          <Planner
            plan={mealPlan}
            savedFoods={savedFoods}
            templates={mealTemplates}
            recipes={recipes}
            onSavePlan={handleSaveMealPlan}
            onConvertToLog={handleConvertPlanToLog}
          />
        )}
        {screen === 'shopping' && (
          <Shopping
            items={shoppingList}
            templates={mealTemplates}
            recipes={recipes}
            onSave={handleSaveShoppingList}
          />
        )}
        {screen === 'weight' && (
          <Weight
            entries={weightEntries}
            weightUnit={profile.weightUnit}
            onSave={handleSaveWeightEntries}
          />
        )}
        {screen === 'settings' && (
          <Settings
            profile={profile}
            targets={targets}
            onSaveProfile={handleSaveProfile}
            onSaveTargets={handleSaveTargets}
            onImportComplete={handleImportComplete}
          />
        )}
      </main>

      <Nav current={screen} onChange={setScreen} />
    </div>
  );
}

export default App;
