import { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import { Nav } from './components/Nav';
import { UserPicker } from './components/UserPicker';
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
import { BarcodeScanner } from './screens/BarcodeScanner';
import {
  loadProfile, saveProfile,
  loadTargets, saveTargets,
  loadFoodLog, saveFoodLog,
  loadSavedFoods, saveSavedFoods,
  loadFoodDatabase, saveFoodDatabase,
  loadWeightEntries, saveWeightEntries,
  loadMealTemplates, saveMealTemplates,
  loadRecipes, saveRecipes,
  loadShoppingList, saveShoppingList,
  loadMealPlan, saveMealPlan,
  loadReminders, saveReminders,
  saveFoodLogAndMealPlan,
  migrateIfNeeded,
  seedDemoDataIfEmpty,
  configureStorageScope,
  claimLegacyDataForActiveScope,
  subscribeLocalDataChanges,
  exportAppData,
  importAppData,
  hasLocalUserData,
} from './lib/storage';
import {
  ENV,
  initAuth,
  saveRemoteAppData,
  subscribeRemoteAppData,
  subscribeSyncQueue,
} from './lib/firebase-db';
import { APP_USERS, clearCurrentUser, loadCurrentUser, saveCurrentUser, type AppUserKey } from './lib/users';
import { savedFoodToLogEntry, summariseDay, todayDateString } from './lib/nutrition';
import { buildRecommendations } from './lib/recommendations';
import { templateToLogEntries } from './lib/meal-templates';
import { recipeToLogEntry } from './lib/recipes';
import { nanoid } from './lib/nanoid';
import { inferMealSlot } from './lib/meals';
import { duplicateLogEntry } from './lib/quick-add';
import { savedFoodToFoodDatabaseItem, upsertFoodDatabaseItem } from './lib/food-database';
import { scheduleReminderNotifications } from './lib/reminders';
import type {
  FoodLogEntry,
  FoodItem,
  FoodDatabaseItem,
  UserProfile,
  NutritionTargets,
  WeightEntry,
  MealTemplate,
  Recipe,
  ShoppingItem,
  MealPlanEntry,
  ReminderSettings,
  AppStateBundle,
} from './types';

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
  | 'barcode';

type SyncStatus = {
  tone: 'idle' | 'syncing' | 'synced' | 'queued' | 'error';
  text: string;
};

function reloadAll() {
  return {
    profile: loadProfile(),
    targets: loadTargets(),
    foodLog: loadFoodLog(),
    savedFoods: loadSavedFoods(),
    foodDatabase: loadFoodDatabase(),
    weightEntries: loadWeightEntries(),
    mealTemplates: loadMealTemplates(),
    recipes: loadRecipes(),
    shoppingList: loadShoppingList(),
    mealPlan: loadMealPlan(),
    reminders: loadReminders(),
  };
}

function prepareStorageForUser(userKey: AppUserKey) {
  configureStorageScope({ environment: ENV, userKey });
  claimLegacyDataForActiveScope();
  migrateIfNeeded();
  seedDemoDataIfEmpty();
}

const initialUser = loadCurrentUser();
if (initialUser) prepareStorageForUser(initialUser);

function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [currentUser, setCurrentUser] = useState<AppUserKey | null>(initialUser);
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [targets, setTargets] = useState<NutritionTargets>(loadTargets);
  const [foodLog, setFoodLog] = useState<FoodLogEntry[]>(loadFoodLog);
  const [savedFoods, setSavedFoods] = useState<FoodItem[]>(loadSavedFoods);
  const [foodDatabase, setFoodDatabase] = useState<FoodDatabaseItem[]>(loadFoodDatabase);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>(loadWeightEntries);
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>(loadMealTemplates);
  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(loadShoppingList);
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>(loadMealPlan);
  const [reminders, setReminders] = useState<ReminderSettings>(loadReminders);
  const [storageError, setStorageError] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    initialUser ? { tone: 'syncing', text: 'Connecting' } : { tone: 'idle', text: 'Pick user' },
  );
  const currentUserRef = useRef(currentUser);
  const applyingRemoteRef = useRef(false);
  const remoteStampRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef(profile);
  const targetsRef = useRef(targets);
  const foodLogRef = useRef(foodLog);
  const savedFoodsRef = useRef(savedFoods);
  const foodDatabaseRef = useRef(foodDatabase);
  const weightEntriesRef = useRef(weightEntries);
  const mealTemplatesRef = useRef(mealTemplates);
  const recipesRef = useRef(recipes);
  const shoppingListRef = useRef(shoppingList);
  const mealPlanRef = useRef(mealPlan);
  const remindersRef = useRef(reminders);

  const applyLoadedData = useCallback((data: ReturnType<typeof reloadAll>) => {
    setProfile(data.profile);
    setTargets(data.targets);
    setFoodLog(data.foodLog);
    setSavedFoods(data.savedFoods);
    setFoodDatabase(data.foodDatabase);
    setWeightEntries(data.weightEntries);
    setMealTemplates(data.mealTemplates);
    setRecipes(data.recipes);
    setShoppingList(data.shoppingList);
    setMealPlan(data.mealPlan);
    setReminders(data.reminders);
    profileRef.current = data.profile; targetsRef.current = data.targets; foodLogRef.current = data.foodLog;
    savedFoodsRef.current = data.savedFoods; foodDatabaseRef.current = data.foodDatabase; weightEntriesRef.current = data.weightEntries;
    mealTemplatesRef.current = data.mealTemplates; recipesRef.current = data.recipes;
    shoppingListRef.current = data.shoppingList; mealPlanRef.current = data.mealPlan; remindersRef.current = data.reminders;
  }, []);

  const syncNow = useCallback(async () => {
    const userKey = currentUserRef.current;
    if (!userKey || applyingRemoteRef.current) return;

    const bundle = exportAppData();
    setSyncStatus({ tone: 'syncing', text: 'Syncing' });
    const result = await saveRemoteAppData(userKey, bundle);
    remoteStampRef.current = bundle.exportedAt;
    setSyncStatus(result.queued
      ? { tone: 'queued', text: 'Queued' }
      : { tone: 'synced', text: 'Synced' });
  }, []);

  const scheduleSync = useCallback(() => {
    if (!currentUserRef.current || applyingRemoteRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      void syncNow();
    }, 350);
  }, [syncNow]);

  const activateUser = useCallback((userKey: AppUserKey) => {
    saveCurrentUser(userKey);
    prepareStorageForUser(userKey);
    currentUserRef.current = userKey;
    remoteStampRef.current = null;
    applyLoadedData(reloadAll());
    setCurrentUser(userKey);
    setStorageError('');
    setSyncStatus({ tone: 'syncing', text: 'Connecting' });
  }, [applyLoadedData]);

  const switchUser = useCallback(() => {
    clearCurrentUser();
    configureStorageScope(null);
    currentUserRef.current = null;
    remoteStampRef.current = null;
    setCurrentUser(null);
    setSyncStatus({ tone: 'idle', text: 'Pick user' });
  }, []);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeLocalDataChanges(scheduleSync);
  }, [currentUser, scheduleSync]);

  useEffect(() => {
    return subscribeSyncQueue((state) => {
      if (state.pending > 0) setSyncStatus({ tone: state.error ? 'error' : 'queued', text: state.error ? 'Retrying' : 'Queued' });
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let sawFirstRemoteRead = false;
    void initAuth();

    const applyRemoteBundle = (bundle: AppStateBundle) => {
      applyingRemoteRef.current = true;
      try {
        if (importAppData(bundle)) {
          applyLoadedData(reloadAll());
          remoteStampRef.current = bundle.exportedAt;
          setSyncStatus({ tone: 'synced', text: 'Synced' });
        }
      } finally {
        applyingRemoteRef.current = false;
      }
    };

    const stop = subscribeRemoteAppData(currentUser, (bundle) => {
      if (!bundle) {
        if (!sawFirstRemoteRead && hasLocalUserData()) void syncNow();
        sawFirstRemoteRead = true;
        return;
      }
      sawFirstRemoteRead = true;
      if (bundle.exportedAt === remoteStampRef.current) {
        setSyncStatus({ tone: 'synced', text: 'Synced' });
        return;
      }
      applyRemoteBundle(bundle);
    }, {
      onError: () => setSyncStatus({ tone: 'error', text: 'Offline' }),
    });

    return () => {
      stop();
    };
  }, [currentUser, applyLoadedData, syncNow]);

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
    if (!persist(next, savedFoodsRef, setSavedFoods, saveSavedFoods)) return false;
    const existingDbFood = food.barcode
      ? foodDatabaseRef.current.find((item) => item.barcode === food.barcode)
      : foodDatabaseRef.current.find((item) => item.name === food.name && item.servingSize === food.servingSize);
    const nextDatabase = upsertFoodDatabaseItem(foodDatabaseRef.current, savedFoodToFoodDatabaseItem(food, existingDbFood));
    return persist(nextDatabase, foodDatabaseRef, setFoodDatabase, saveFoodDatabase);
  }, [persist]);

  const handleSaveFoodDatabaseItem = useCallback((item: FoodDatabaseItem) => {
    const nextDatabase = upsertFoodDatabaseItem(foodDatabaseRef.current, item);
    return persist(nextDatabase, foodDatabaseRef, setFoodDatabase, saveFoodDatabase);
  }, [persist]);

  const handleDeleteSavedFood = useCallback((id: string) => {
    return persist(savedFoodsRef.current.filter((f) => f.id !== id), savedFoodsRef, setSavedFoods, saveSavedFoods);
  }, [persist]);

  const handleAddSavedFoodToLog = useCallback((food: FoodItem) => {
    const entry = savedFoodToLogEntry(food, today, 1, inferMealSlot());
    if (handleAddEntry(entry)) setScreen('dashboard');
  }, [today, handleAddEntry]);

  // ── Profile / targets ──────────────────────────────────────────────────────

  const handleSaveProfile = useCallback((p: UserProfile) => persist(p, profileRef, setProfile, saveProfile), [persist]);
  const handleSaveTargets = useCallback((t: NutritionTargets) => persist(t, targetsRef, setTargets, saveTargets), [persist]);

  const handleSaveReminders = useCallback(async (r: ReminderSettings) => {
    if (!persist(r, remindersRef, setReminders, saveReminders)) {
      return { ok: false, native: false, permission: 'unsupported' as const, scheduled: 0, message: 'Reminder settings could not be saved.' };
    }
    return scheduleReminderNotifications(r);
  }, [persist]);

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
    if (handleAddEntries(templateToLogEntries(template, today, 1, template.mealType ?? inferMealSlot()))) setScreen('dashboard');
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
    if (handleAddEntry(recipeToLogEntry(recipe, servings, today, inferMealSlot()))) setScreen('dashboard');
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
    applyLoadedData(reloadAll());
  }, [applyLoadedData]);

  if (!currentUser) {
    return <UserPicker onPick={activateUser} />;
  }

  const user = APP_USERS[currentUser];

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Keto Tracker</span>
        <div className="app-header-meta">
          <span className={`sync-pill sync-pill--${syncStatus.tone}`}>{syncStatus.text}</span>
          <button type="button" className="app-user" onClick={switchUser} title="Switch user">
            {profile.name ? `Hi, ${profile.name}` : user.label}
          </button>
        </div>
      </header>

      <main className="app-main">
        {storageError && <div className="storage-error" role="alert">{storageError}</div>}
        {screen === 'dashboard' && (
          <Dashboard
            summary={todaySummary}
            entries={foodLog.filter((entry) => entry.date === today)}
            targets={targets}
            recommendations={recommendations}
            onAddFood={() => setScreen('barcode')}
          />
        )}
        {screen === 'add-food' && (
          <AddFood
            savedFoods={savedFoods}
            foodDatabase={foodDatabase}
            log={foodLog}
            recipes={recipes}
            templates={mealTemplates}
            onAdd={handleAddEntry}
            onAddEntries={handleAddEntries}
            onSaveFood={handleSaveFood}
          />
        )}
        {screen === 'barcode' && (
          <BarcodeScanner
            foodDatabase={foodDatabase}
            onAdd={handleAddEntry}
            onSaveFood={handleSaveFood}
            onSaveFoodDatabaseItem={handleSaveFoodDatabaseItem}
          />
        )}
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
            reminders={reminders}
            onSaveProfile={handleSaveProfile}
            onSaveTargets={handleSaveTargets}
            onSaveReminders={handleSaveReminders}
            onImportComplete={handleImportComplete}
          />
        )}
      </main>

      <Nav current={screen} onChange={setScreen} />
    </div>
  );
}

export default App;
