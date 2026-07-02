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
import { Garmin } from './screens/Garmin';
import { Settings } from './screens/Settings';
import { BarcodeScanner } from './screens/BarcodeScanner';
import {
  loadProfile, saveProfile,
  loadTargets, saveTargets,
  loadFoodLog, saveFoodLog,
  loadSavedFoods, saveSavedFoods,
  loadFoodDatabase, saveFoodDatabase,
  loadWeightEntries, saveWeightEntries,
  loadDailyActivity, saveDailyActivity,
  loadSleepEntries, saveSleepEntries,
  loadVitalsEntries, saveVitalsEntries,
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
  markLocalDataModified,
  getLocalDataModifiedAt,
  ensureLocalModifiedBaseline,
  remoteBundleShouldReplaceLocal,
} from './lib/storage';
import {
  FIREBASE_AUTH_ACTIVE,
  FIREBASE_DB_CONFIGURED,
  STORAGE_NAMESPACE,
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
import { barcodeFoodToFoodDatabaseItem, savedFoodToFoodDatabaseItem, upsertFoodDatabaseItem } from './lib/food-database';
import { applyBarcodeNutritionToEntry, entryNeedsNutritionRepair, hasPositiveNutrition, lookupBarcodeFood, repairFailureMessage, type BarcodeFood, type RepairResult } from './lib/barcode';
import { scheduleReminderNotifications } from './lib/reminders';
import {
  isHealthConnectSupported, healthConnectAvailable,
  ensureStepPermissions, ensureWeightPermissions, ensureActivityExtrasPermissions, ensureSleepPermissions, ensureVitalsPermissions,
  fetchStepHistory, fetchWeightHistory, fetchActivityExtrasHistory, fetchSleepHistory, fetchVitalsHistory,
} from './lib/health-connect';
import { toGarminReadings, mergeGarminReadings, summarizeMerge } from './lib/garmin-weight-sync';
import {
  mergeGarminStepReadings, summarizeStepMerge, toGarminStepReadings,
  mergeGarminActivityExtras, summarizeActivityExtrasMerge, toGarminActivityExtras,
} from './lib/garmin-activity-sync';
import { mergeGarminSleepReadings, summarizeSleepMerge, toGarminSleepReadings } from './lib/garmin-sleep-sync';
import { mergeGarminVitalsReadings, summarizeVitalsMerge, toGarminVitalsReadings } from './lib/garmin-vitals-sync';
import { pickMicronutrients } from './lib/micronutrients';
import type {
  FoodLogEntry,
  FoodItem,
  FoodDatabaseItem,
  UserProfile,
  NutritionTargets,
  WeightEntry,
  DailyActivityEntry,
  SleepEntry,
  VitalsEntry,
  MealTemplate,
  Recipe,
  ShoppingItem,
  MealPlanEntry,
  ReminderSettings,
  AppStateBundle,
  MealSlot,
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

// Cloud sync only runs when Firebase credentials and a database URL are present.
// Without them, the app stays local-only instead of polling a database it can't
// reach and showing a misleading "Offline" status.
const SYNC_ENABLED = FIREBASE_AUTH_ACTIVE && FIREBASE_DB_CONFIGURED;
const SYNC_MISCONFIGURED = FIREBASE_AUTH_ACTIVE && !FIREBASE_DB_CONFIGURED;

function initialSyncStatus(hasUser: boolean): SyncStatus {
  if (!hasUser) return { tone: 'idle', text: 'Pick user' };
  if (SYNC_MISCONFIGURED) return { tone: 'error', text: 'Config' };
  return SYNC_ENABLED ? { tone: 'syncing', text: 'Connecting' } : { tone: 'idle', text: 'Local' };
}

function reloadAll() {
  return {
    profile: loadProfile(),
    targets: loadTargets(),
    foodLog: loadFoodLog(),
    savedFoods: loadSavedFoods(),
    foodDatabase: loadFoodDatabase(),
    weightEntries: loadWeightEntries(),
    dailyActivity: loadDailyActivity(),
    sleepEntries: loadSleepEntries(),
    vitalsEntries: loadVitalsEntries(),
    mealTemplates: loadMealTemplates(),
    recipes: loadRecipes(),
    shoppingList: loadShoppingList(),
    mealPlan: loadMealPlan(),
    reminders: loadReminders(),
  };
}

function prepareStorageForUser(userKey: AppUserKey) {
  configureStorageScope({ environment: STORAGE_NAMESPACE, userKey });
  claimLegacyDataForActiveScope();
  migrateIfNeeded();
  seedDemoDataIfEmpty();
  ensureLocalModifiedBaseline();
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
  const [dailyActivity, setDailyActivity] = useState<DailyActivityEntry[]>(loadDailyActivity);
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>(loadSleepEntries);
  const [vitalsEntries, setVitalsEntries] = useState<VitalsEntry[]>(loadVitalsEntries);
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>(loadMealTemplates);
  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(loadShoppingList);
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>(loadMealPlan);
  const [reminders, setReminders] = useState<ReminderSettings>(loadReminders);
  const [storageError, setStorageError] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => initialSyncStatus(Boolean(initialUser)));
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
  const dailyActivityRef = useRef(dailyActivity);
  const sleepEntriesRef = useRef(sleepEntries);
  const vitalsEntriesRef = useRef(vitalsEntries);
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
    setDailyActivity(data.dailyActivity);
    setSleepEntries(data.sleepEntries);
    setVitalsEntries(data.vitalsEntries);
    setMealTemplates(data.mealTemplates);
    setRecipes(data.recipes);
    setShoppingList(data.shoppingList);
    setMealPlan(data.mealPlan);
    setReminders(data.reminders);
    profileRef.current = data.profile; targetsRef.current = data.targets; foodLogRef.current = data.foodLog;
    savedFoodsRef.current = data.savedFoods; foodDatabaseRef.current = data.foodDatabase; weightEntriesRef.current = data.weightEntries;
    dailyActivityRef.current = data.dailyActivity;
    sleepEntriesRef.current = data.sleepEntries;
    vitalsEntriesRef.current = data.vitalsEntries;
    mealTemplatesRef.current = data.mealTemplates; recipesRef.current = data.recipes;
    shoppingListRef.current = data.shoppingList; mealPlanRef.current = data.mealPlan; remindersRef.current = data.reminders;
  }, []);

  const syncNow = useCallback(async () => {
    const userKey = currentUserRef.current;
    if (!SYNC_ENABLED || !userKey || applyingRemoteRef.current) return;

    const bundle = exportAppData();
    setSyncStatus({ tone: 'syncing', text: 'Syncing' });
    const result = await saveRemoteAppData(userKey, bundle);
    remoteStampRef.current = bundle.exportedAt;
    setSyncStatus(result.queued
      ? { tone: 'queued', text: 'Queued' }
      : { tone: 'synced', text: 'Synced' });
  }, []);

  const scheduleSync = useCallback(() => {
    if (!SYNC_ENABLED || !currentUserRef.current || applyingRemoteRef.current) return;
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
    setSyncStatus(initialSyncStatus(true));
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
    return subscribeLocalDataChanges(() => {
      // Writes made while applying a remote bundle are not user edits, so they
      // must not bump the local freshness marker or trigger a push-back.
      if (applyingRemoteRef.current) return;
      markLocalDataModified();
      scheduleSync();
    });
  }, [currentUser, scheduleSync]);

  useEffect(() => {
    return subscribeSyncQueue((state) => {
      if (state.pending > 0) setSyncStatus({ tone: state.error ? 'error' : 'queued', text: state.error ? 'Retrying' : 'Queued' });
    });
  }, []);

  useEffect(() => {
    if (!currentUser || !SYNC_ENABLED) return;

    let sawFirstRemoteRead = false;
    let consecutiveFailures = 0;
    void initAuth();

    const applyRemoteBundle = (bundle: AppStateBundle) => {
      applyingRemoteRef.current = true;
      try {
        if (importAppData(bundle)) {
          applyLoadedData(reloadAll());
          remoteStampRef.current = bundle.exportedAt;
          // Local now equals the remote bundle, so anchor the freshness marker to
          // its stamp — later local edits will move past it and push back up.
          markLocalDataModified(bundle.exportedAt);
          setSyncStatus({ tone: 'synced', text: 'Synced' });
        }
      } finally {
        applyingRemoteRef.current = false;
      }
    };

    const stop = subscribeRemoteAppData(currentUser, (bundle) => {
      consecutiveFailures = 0; // a successful read means we're connected again
      const firstRead = !sawFirstRemoteRead;
      sawFirstRemoteRead = true;
      if (!bundle) {
        // Remote is empty. On the first read, push local data up; on later reads
        // just confirm we're connected so a stale "Offline" can't stick.
        if (firstRead && hasLocalUserData()) { void syncNow(); return; }
        setSyncStatus((prev) => (prev.tone === 'synced' ? prev : { tone: 'synced', text: 'Synced' }));
        return;
      }
      if (bundle.exportedAt === remoteStampRef.current) {
        setSyncStatus({ tone: 'synced', text: 'Synced' });
        return;
      }
      // Only let the remote bundle replace local data when it is provably newer;
      // otherwise keep local (which is newer) and push it up so remote catches
      // up. This prevents an older remote read — on first poll, user switch,
      // reinstall, or queued-sync recovery — from clobbering newer local edits.
      if (remoteBundleShouldReplaceLocal(bundle.exportedAt, getLocalDataModifiedAt(), hasLocalUserData())) {
        applyRemoteBundle(bundle);
      } else {
        remoteStampRef.current = bundle.exportedAt;
        void syncNow();
      }
    }, {
      // A single blip (cold-start auth/network hiccup) shouldn't flash a scary red
      // "Offline"; only surface it after repeated consecutive failures.
      onError: () => {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2) setSyncStatus({ tone: 'error', text: 'Offline' });
      },
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

  // Re-fetch nutrition for barcode entries logged with no calories (the Open Food
  // Facts v3 empty-nutriments bug). Each entry's serving size is preserved.
  const handleRepairScannedNutrition = useCallback(async (): Promise<RepairResult> => {
    const targets = foodLogRef.current.filter(entryNeedsNutritionRepair);
    if (targets.length === 0) return { ok: true, message: 'No scanned foods need fixing.' };
    const cache = new Map<string, BarcodeFood>();
    let fixed = 0;
    let failed = 0;
    let failReason = '';
    for (const entry of targets) {
      const code = entry.barcode as string;
      try {
        let food = cache.get(code);
        if (!food) {
          food = await lookupBarcodeFood(code);
          cache.set(code, food);
          handleSaveFoodDatabaseItem(barcodeFoodToFoodDatabaseItem(food));
        }
        handleEditEntry(applyBarcodeNutritionToEntry(entry, food));
        if (hasPositiveNutrition(food)) fixed += 1;
      } catch (error) {
        failed += 1;
        failReason = repairFailureMessage(error) || failReason;
      }
    }
    if (fixed === 0) {
      if (failed === 0) return { ok: false, message: 'The food database has no nutrition for those barcodes — edit the entries to fill it in manually.' };
      return { ok: false, message: failReason || 'Could not fetch nutrition — try again shortly.' };
    }
    return {
      ok: true,
      message: `Updated ${fixed} scanned food${fixed === 1 ? '' : 's'}${failed > 0 ? `; ${failed} could not be fetched` : ''}.`,
    };
  }, [handleEditEntry, handleSaveFoodDatabaseItem]);

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

  const handleSaveDailyActivity = useCallback((entries: DailyActivityEntry[]) => {
    return persist(entries, dailyActivityRef, setDailyActivity, saveDailyActivity);
  }, [persist]);

  const handleSaveSleepEntries = useCallback((entries: SleepEntry[]) => {
    return persist(entries, sleepEntriesRef, setSleepEntries, saveSleepEntries);
  }, [persist]);

  const handleSaveVitalsEntries = useCallback((entries: VitalsEntry[]) => {
    return persist(entries, vitalsEntriesRef, setVitalsEntries, saveVitalsEntries);
  }, [persist]);

  // Garmin → Health Connect import (native Android only). One button, one
  // combined summary — each metric group is independently fault-tolerant so a
  // device missing one data type (e.g. no floors sensor) doesn't block the rest.
  const handleSyncGarmin = useCallback(async (): Promise<string> => {
    if (!(await healthConnectAvailable())) {
      return "Health Connect isn't available on this device. Install it and connect Garmin Connect first.";
    }
    await ensureWeightPermissions(); // throws a user-facing message if not granted
    const raw = await fetchWeightHistory();
    const activityParts: string[] = [];
    try {
      await ensureStepPermissions();
      const stepReadings = toGarminStepReadings(await fetchStepHistory());
      if (stepReadings.length > 0) {
        const importedAt = new Date().toISOString();
        const stepResult = mergeGarminStepReadings(dailyActivityRef.current, stepReadings, importedAt, nanoid);
        if (!handleSaveDailyActivity(stepResult.entries)) return 'Could not save the imported step entries.';
        const stepSummary = summarizeStepMerge(stepResult);
        if (stepSummary) activityParts.push(stepSummary);
      } else {
        activityParts.push('no Garmin step records found');
      }
    } catch (error) {
      activityParts.push(error instanceof Error ? `steps unavailable: ${error.message}` : 'steps unavailable');
    }
    try {
      await ensureActivityExtrasPermissions();
      const extras = toGarminActivityExtras(await fetchActivityExtrasHistory());
      if (extras.length > 0) {
        const importedAt = new Date().toISOString();
        const extrasResult = mergeGarminActivityExtras(dailyActivityRef.current, extras, importedAt, nanoid);
        if (!handleSaveDailyActivity(extrasResult.entries)) return 'Could not save the imported activity data.';
        const extrasSummary = summarizeActivityExtrasMerge(extrasResult);
        if (extrasSummary) activityParts.push(extrasSummary);
      }
    } catch (error) {
      activityParts.push(error instanceof Error ? `activity data unavailable: ${error.message}` : 'activity data unavailable');
    }
    try {
      await ensureSleepPermissions();
      const sleepReadings = toGarminSleepReadings(await fetchSleepHistory());
      if (sleepReadings.length > 0) {
        const importedAt = new Date().toISOString();
        const sleepResult = mergeGarminSleepReadings(sleepEntriesRef.current, sleepReadings, importedAt, nanoid);
        if (!handleSaveSleepEntries(sleepResult.entries)) return 'Could not save the imported sleep entries.';
        const sleepSummary = summarizeSleepMerge(sleepResult);
        if (sleepSummary) activityParts.push(`sleep: ${sleepSummary}`);
      } else {
        activityParts.push('no Garmin sleep records found');
      }
    } catch (error) {
      activityParts.push(error instanceof Error ? `sleep unavailable: ${error.message}` : 'sleep unavailable');
    }
    try {
      await ensureVitalsPermissions();
      const vitalsReadings = toGarminVitalsReadings(await fetchVitalsHistory());
      if (vitalsReadings.length > 0) {
        const importedAt = new Date().toISOString();
        const vitalsResult = mergeGarminVitalsReadings(vitalsEntriesRef.current, vitalsReadings, importedAt, nanoid);
        if (!handleSaveVitalsEntries(vitalsResult.entries)) return 'Could not save the imported vitals.';
        const vitalsSummary = summarizeVitalsMerge(vitalsResult);
        if (vitalsSummary) activityParts.push(`vitals: ${vitalsSummary}`);
      }
    } catch (error) {
      activityParts.push(error instanceof Error ? `vitals unavailable: ${error.message}` : 'vitals unavailable');
    }
    if (raw.length === 0) {
      return activityParts.length > 0
        ? `No weight data found in Health Connect yet; ${activityParts.join('; ')}.`
        : 'No weight data found in Health Connect yet.';
    }
    const unit = profileRef.current.weightUnit;
    const readings = toGarminReadings(raw, unit);
    const result = mergeGarminReadings(weightEntriesRef.current, readings, unit, new Date().toISOString(), nanoid);
    if (!handleSaveWeightEntries(result.entries)) return 'Could not save the imported weight entries.';
    const weightSummary = summarizeMerge(result);
    return activityParts.length > 0 ? `${weightSummary} Activity: ${activityParts.join('; ')}.` : weightSummary;
  }, [handleSaveDailyActivity, handleSaveSleepEntries, handleSaveVitalsEntries, handleSaveWeightEntries]);

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

  const handleAddTemplateToLog = useCallback((template: MealTemplate, meal?: MealSlot) => {
    if (handleAddEntries(templateToLogEntries(template, today, 1, meal ?? template.mealType ?? inferMealSlot()))) setScreen('dashboard');
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
      ...pickMicronutrients(e),
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
            activity={dailyActivity.find((entry) => entry.date === today) ?? [...dailyActivity].sort((a, b) => b.date.localeCompare(a.date))[0]}
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
            onSaveFoodDatabaseItem={handleSaveFoodDatabaseItem}
            onScanBarcode={() => setScreen('barcode')}
          />
        )}
        {screen === 'barcode' && (
          <BarcodeScanner
            foodDatabase={foodDatabase}
            onAdd={handleAddEntry}
            onSaveFood={handleSaveFood}
            onSaveFoodDatabaseItem={handleSaveFoodDatabaseItem}
            onAddManually={() => setScreen('add-food')}
            autoStart
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
            onRepairScannedNutrition={handleRepairScannedNutrition}
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
          <Garmin
            entries={weightEntries}
            weightUnit={profile.weightUnit}
            dailyActivity={dailyActivity}
            sleepEntries={sleepEntries}
            vitalsEntries={vitalsEntries}
            onSyncGarmin={isHealthConnectSupported() ? handleSyncGarmin : undefined}
          />
        )}
        {screen === 'settings' && (
          <Settings
            profile={profile}
            targets={targets}
            reminders={reminders}
            templates={mealTemplates}
            savedFoods={savedFoods}
            onSaveProfile={handleSaveProfile}
            onSaveTargets={handleSaveTargets}
            onSaveReminders={handleSaveReminders}
            onSaveTemplate={handleSaveTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onAddTemplateToLog={handleAddTemplateToLog}
            onImportComplete={handleImportComplete}
          />
        )}
      </main>

      <Nav current={screen} onChange={setScreen} />
    </div>
  );
}

export default App;
