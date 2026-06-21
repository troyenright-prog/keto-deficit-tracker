import { useState, useCallback, useRef } from 'react';
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
import { PhotoEstimate } from './screens/PhotoEstimate';
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
  saveFoodLogAndMealPlan,
  migrateIfNeeded,
} from './lib/storage';
import { savedFoodToLogEntry, summariseDay, todayDateString } from './lib/nutrition';
import { buildRecommendations } from './lib/recommendations';
import { templateToLogEntries } from './lib/meal-templates';
import { recipeToLogEntry } from './lib/recipes';
import { nanoid } from './lib/nanoid';
import { duplicateLogEntry } from './lib/quick-add';
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
  | 'settings'
  | 'photo-estimate';

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
  const [storageError, setStorageError] = useState('');
  const profileRef = useRef(profile);
  const targetsRef = useRef(targets);
  const foodLogRef = useRef(foodLog);
  const savedFoodsRef = useRef(savedFoods);
  const weightEntriesRef = useRef(weightEntries);
  const mealTemplatesRef = useRef(mealTemplates);
  const recipesRef = useRef(recipes);
  const shoppingListRef = useRef(shoppingList);
  const mealPlanRef = useRef(mealPlan);

  const persist = useCallback(<T,>(
    next: T,
    ref: { current: T },
    setter: (value: T) => void,
    save: (value: T) => boolean,
  ): boolean => {
    if (!save(next)) {
      setStorageError('Your changes could not be saved. Check browser storage space or privacy settings, then try again.');
      return false;
    }
    ref.current = next;
    setter(next);
    setStorageError('');
    return true;
  }, []);

  const today = todayDateString();
  const todaySummary = summariseDay(today, foodLog);
  const recommendations = buildRecommendations(todaySummary, targets);

  // ── Food log ───────────────────────────────────────────────────────────────

  const handleAddEntry = useCallback((entry: FoodLogEntry) =>
    persist([...foodLogRef.current, entry], foodLogRef, setFoodLog, saveFoodLog), [persist]);

  const handleAddEntries = useCallback((entries: FoodLogEntry[]) =>
    persist([...foodLogRef.current, ...entries], foodLogRef, setFoodLog, saveFoodLog), [persist]);

  const handleDeleteEntry = useCallback((id: string) =>
    persist(foodLogRef.current.filter((e) => e.id !== id), foodLogRef, setFoodLog, saveFoodLog), [persist]);

  const handleEditEntry = useCallback((updated: FoodLogEntry) =>
    persist(foodLogRef.current.map((e) => e.id === updated.id ? updated : e), foodLogRef, setFoodLog, saveFoodLog), [persist]);

  // ── Saved foods ────────────────────────────────────────────────────────────

  const handleSaveFood = useCallback((food: FoodItem) => {
    const current = savedFoodsRef.current;
    const exists = current.findIndex((f) => f.id === food.id);
    const next = exists >= 0 ? current.map((f) => f.id === food.id ? food : f) : [...current, food];
    return persist(next, savedFoodsRef, setSavedFoods, saveSavedFoods);
  }, [persist]);

  const handleDeleteSavedFood = useCallback((id: string) => {
    return persist(savedFoodsRef.current.filter((f) => f.id !== id), savedFoodsRef, setSavedFoods, saveSavedFoods);
  }, [persist]);

  const handleAddSavedFoodToLog = useCallback((food: FoodItem) => {
    const entry = savedFoodToLogEntry(food, today);
    if (handleAddEntry(entry)) setScreen('dashboard');
  }, [today, handleAddEntry]);

  // ── Profile / targets ──────────────────────────────────────────────────────

  const handleSaveProfile = useCallback((p: UserProfile) => persist(p, profileRef, setProfile, saveProfile), [persist]);
  const handleSaveTargets = useCallback((t: NutritionTargets) => persist(t, targetsRef, setTargets, saveTargets), [persist]);

  // ── Weight ─────────────────────────────────────────────────────────────────

  const handleSaveWeightEntries = useCallback((entries: WeightEntry[]) => {
    return persist(entries, weightEntriesRef, setWeightEntries, saveWeightEntries);
  }, [persist]);

  // ── Meal templates ─────────────────────────────────────────────────────────

  const handleSaveTemplate = useCallback((template: MealTemplate) => {
    const current = mealTemplatesRef.current;
    const exists = current.findIndex((t) => t.id === template.id);
    const next = exists >= 0 ? current.map((t) => t.id === template.id ? template : t) : [...current, template];
    return persist(next, mealTemplatesRef, setMealTemplates, saveMealTemplates);
  }, [persist]);

  const handleDeleteTemplate = useCallback((id: string) => {
    return persist(mealTemplatesRef.current.filter((t) => t.id !== id), mealTemplatesRef, setMealTemplates, saveMealTemplates);
  }, [persist]);

  const handleAddTemplateToLog = useCallback((template: MealTemplate) => {
    if (handleAddEntries(templateToLogEntries(template, today))) setScreen('dashboard');
  }, [today, handleAddEntries]);

  // ── Recipes ────────────────────────────────────────────────────────────────

  const handleSaveRecipe = useCallback((recipe: Recipe) => {
    const current = recipesRef.current;
    const exists = current.findIndex((r) => r.id === recipe.id);
    const next = exists >= 0 ? current.map((r) => r.id === recipe.id ? recipe : r) : [...current, recipe];
    return persist(next, recipesRef, setRecipes, saveRecipes);
  }, [persist]);

  const handleDeleteRecipe = useCallback((id: string) => {
    return persist(recipesRef.current.filter((r) => r.id !== id), recipesRef, setRecipes, saveRecipes);
  }, [persist]);

  const handleAddRecipeToLog = useCallback((recipe: Recipe, servings: number) => {
    if (handleAddEntry(recipeToLogEntry(recipe, servings, today))) setScreen('dashboard');
  }, [today, handleAddEntry]);

  // ── Shopping list ──────────────────────────────────────────────────────────

  const handleSaveShoppingList = useCallback((items: ShoppingItem[]) => {
    return persist(items, shoppingListRef, setShoppingList, saveShoppingList);
  }, [persist]);

  // ── Meal plan ──────────────────────────────────────────────────────────────

  const handleSaveMealPlan = useCallback((plan: MealPlanEntry[]) => {
    return persist(plan, mealPlanRef, setMealPlan, saveMealPlan);
  }, [persist]);

  const handleConvertPlanToLog = useCallback((entries: MealPlanEntry[], nextPlan: MealPlanEntry[]) => {
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
      calciumMg: e.calciumMg, ironMg: e.ironMg, zincMg: e.zincMg,
      vitaminDMcg: e.vitaminDMcg, vitaminB12Mcg: e.vitaminB12Mcg,
      omega3G: e.omega3G, omega6G: e.omega6G,
      loggedAt: new Date().toISOString(),
    }));
    const nextLog = [...foodLogRef.current, ...logEntries];
    if (!saveFoodLogAndMealPlan(nextLog, nextPlan)) {
      setStorageError('The planned meals could not be logged. Nothing was changed; check browser storage and try again.');
      return false;
    }
    foodLogRef.current = nextLog; mealPlanRef.current = nextPlan;
    setFoodLog(nextLog); setMealPlan(nextPlan); setStorageError('');
    return true;
  }, []);

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
    profileRef.current = data.profile; targetsRef.current = data.targets; foodLogRef.current = data.foodLog;
    savedFoodsRef.current = data.savedFoods; weightEntriesRef.current = data.weightEntries;
    mealTemplatesRef.current = data.mealTemplates; recipesRef.current = data.recipes;
    shoppingListRef.current = data.shoppingList; mealPlanRef.current = data.mealPlan;
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Keto Tracker</span>
        {profile.name && <span className="app-user">Hi, {profile.name}</span>}
      </header>

      <main className="app-main">
        {storageError && <div className="storage-error" role="alert">{storageError}</div>}
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
            log={foodLog}
            recipes={recipes}
            templates={mealTemplates}
            onAdd={handleAddEntry}
            onAddEntries={handleAddEntries}
            onSaveFood={handleSaveFood}
          />
        )}
        {screen === 'photo-estimate' && <PhotoEstimate onAdd={handleAddEntry} />}
        {screen === 'daily-log' && (
          <DailyLog
            log={foodLog}
            savedFoods={savedFoods}
            onDelete={handleDeleteEntry}
            onEdit={handleEditEntry}
            onDuplicate={(entry, targetDate) => handleAddEntry(duplicateLogEntry(entry, targetDate))}
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
